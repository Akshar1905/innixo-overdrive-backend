import crypto from "crypto";
import { storage } from "./storage";
import { insertRegistrationSchema, eventsConfig } from "./shared/schema";
import Razorpay from "razorpay";
import { sendConfirmationEmail } from "./email";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { stringify } from "csv-stringify/sync";
export async function registerRoutes(httpServer, app) {
    // put application routes here
    // prefix all routes with /api
    // Health check route for root
    app.get("/", (_req, res) => {
        res.json({ status: "ok", message: "Backend is running successfully!" });
    });
    // Strict Rate Limiter for sensitive routes (Register, Payments, Admin)
    const strictLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 20, // Limit each IP to 20 requests per 15 minutes
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { message: "Too many requests, please try again later." }
    });
    // General API Limiter (for read-only or less sensitive routes)
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 100,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
    });
    // Apply rate limiting to registration endpoint
    app.post("/api/register", strictLimiter, async (req, res) => {
        try {
            const data = insertRegistrationSchema.parse(req.body);
            const registration = await storage.createRegistration(data);
            // Send Confirmation Email (Async - don't block response)
            sendConfirmationEmail({
                to: registration.email,
                fullName: registration.fullName,
                registrationId: registration.id,
                eventName: registration.eventName
            });
            res.status(201).json({
                message: "Registration successful",
                id: registration.id,
                status: registration.status
            });
        }
        catch (error) {
            console.error("Registration Error:", error); // Log full error details
            if (error instanceof ZodError) {
                const validationError = fromZodError(error);
                res.status(400).json({ message: validationError.message });
            }
            else {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                res.status(500).json({ message: "Internal Server Error: " + errorMessage });
            }
        }
    });
    // Helper to get event fee from config
    const getEventFee = (eventName) => {
        const event = eventsConfig[eventName];
        return event ? event.fee : 0;
    };
    // Payment Order Creation Endpoint
    app.post("/api/payments/create-order", strictLimiter, async (req, res) => {
        try {
            const { registrationId } = req.body;
            if (!registrationId)
                return res.status(400).json({ message: "Registration ID is required" });
            const registration = await storage.getRegistration(registrationId);
            if (!registration)
                return res.status(404).json({ message: "Registration not found" });
            // Ensure status is DRAFT
            if (registration.status !== "DRAFT" && registration.paymentStatus !== "DRAFT") {
                return res.status(400).json({ message: "Registration is not in DRAFT status or already paid" });
            }
            // Fetch fee from server config
            const fee = getEventFee(registration.eventName);
            if (fee === 0) {
                // If free event, maybe just confirm? But requirement says Razorpay flow.
                // Razorpay min amount is 1 INR usually. If 0, we should skip payment.
                return res.status(200).json({ message: "Free event", amount: 0 });
            }
            const amountInPaise = fee * 100;
            // Initialize Razorpay
            // NOTE: Using environment variables for security.
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID || "test_key_id", // Fallback for dev if env missing
                key_secret: process.env.RAZORPAY_KEY_SECRET || "test_key_secret"
            });
            // Check if order already exists to prevent duplicates
            if (registration.razorpayOrderId) {
                return res.json({
                    orderId: registration.razorpayOrderId,
                    amount: amountInPaise,
                    currency: "INR",
                    keyId: process.env.RAZORPAY_KEY_ID
                });
            }
            const options = {
                amount: amountInPaise,
                currency: "INR",
                receipt: registrationId,
            };
            try {
                const order = await razorpay.orders.create(options);
                // Update registration with order details
                await storage.updateRegistrationPaymentDetails(registrationId, {
                    razorpayOrderId: order.id,
                    amountExpected: amountInPaise,
                    paymentStatus: "DRAFT"
                });
                res.json({
                    orderId: order.id,
                    amount: amountInPaise,
                    currency: "INR",
                    keyId: process.env.RAZORPAY_KEY_ID
                });
            }
            catch (rpError) {
                console.error("Razorpay Error:", rpError);
                // If keys are invalid (test keys), this will fail.
                // Return valid error
                res.status(500).json({ message: "Payment initialization failed", error: rpError.error });
            }
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });
    // Admin Middleware
    const requireAdmin = (req, res, next) => {
        const adminSecret = process.env.ADMIN_SECRET || "admin123"; // Fallback only for dev if env missing
        const authHeader = req.headers["x-admin-secret"];
        if (authHeader === adminSecret) {
            next();
        }
        else {
            res.status(401).json({ message: "Unauthorized" });
        }
    };
    // Admin Registration Fetch
    app.get("/api/admin/registrations", strictLimiter, requireAdmin, async (req, res) => {
        try {
            const registrations = await storage.getAllRegistrations();
            res.json(registrations);
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });
    // Admin CSV Export
    app.get("/api/admin/export", strictLimiter, requireAdmin, async (req, res) => {
        try {
            const registrations = await storage.getAllRegistrations();
            const csvData = registrations.map(reg => ({
                "Registration ID": reg.id,
                "Full Name": reg.fullName,
                "Email": reg.email,
                "Mobile": reg.mobile,
                "College": reg.college,
                "Class": reg.class,
                "Branch": reg.branch,
                "Event": reg.eventName,
                "Type": reg.eventType,
                "Team Name": reg.teamName || "N/A",
                "Team Leader": reg.teamLeader || "N/A",
                "Team Members": reg.teamMembers || "[]",
                "Status": reg.status,
                "Payment Status": reg.paymentStatus,
                "Amount Paid": reg.amountPaid || 0,
                "Razorpay Order ID": reg.razorpayOrderId || "N/A",
                "Created At": reg.createdAt
            }));
            const output = stringify(csvData, {
                header: true
            });
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=registrations.csv");
            res.send(output);
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });
    // Webhook Endpoint (Scaffold)
    app.post("/api/razorpay/webhook", async (req, res) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "test_secret";
        const signature = req.headers["x-razorpay-signature"];
        if (!signature)
            return res.status(400).json({ message: "Missing signature" });
        // Verify signature
        const shasum = crypto.createHmac("sha256", secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest("hex");
        if (digest === signature) {
            const event = req.body.event;
            console.log("Razorpay Webhook Event:", event);
            // Future Logic:
            // if (event === "payment.captured") { ... update registration to PAID ... }
            res.status(200).json({ status: "ok" });
        }
        else {
            res.status(400).json({ message: "Invalid signature" });
        }
    });
    return httpServer;
}
