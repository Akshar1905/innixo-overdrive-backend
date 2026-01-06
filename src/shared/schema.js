import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export const users = pgTable("users", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
});
export const insertUserSchema = createInsertSchema(users).pick({
    username: true,
    password: true,
});
export const registrations = pgTable("registrations", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    college: text("college").notNull(),
    class: text("class").notNull(),
    branch: text("branch").notNull(),
    academicYear: text("academic_year").notNull(),
    eventName: text("event_name").notNull(),
    eventType: text("event_type").notNull(), // 'Individual' or 'Team'
    teamName: text("team_name"),
    teamLeader: text("team_leader"), // Stores name of leader (usually same as fullName)
    teamMembers: text("team_members"), // JSON stringified array of members
    status: text("status").notNull().default("DRAFT"),
    createdAt: text("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
    // Payment Integration Fields
    razorpayOrderId: text("razorpay_order_id"), // Nullable initially
    paymentStatus: text("payment_status").notNull().default("DRAFT"), // DRAFT | PAID | FAILED
    paymentMethod: text("payment_method"), // Stores method like 'UPI', currently undefined/null until paid
    amountExpected: integer("amount_expected").notNull().default(0),
    amountPaid: integer("amount_paid"),
    paymentCreatedAt: text("payment_created_at"),
});
export const insertRegistrationSchema = createInsertSchema(registrations).pick({
    fullName: true,
    email: true,
    mobile: true,
    college: true,
    class: true,
    branch: true,
    academicYear: true,
    eventName: true,
    eventType: true,
    teamName: true,
    teamLeader: true,
    teamMembers: true,
}).extend({
    email: z.string().email("Invalid email address"),
    mobile: z.string().regex(/^(\+91[\-\s]?)?[6-9]\d{9}$/, "Invalid mobile number (10 digits)"),
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    college: z.string().min(2, "College name required"),
    teamMembers: z.string().optional().nullable(), // Allow it to be optional/nullable explicitly if needed
});
// Enum helper for event configuration
export const eventsConfig = {
    "Code Red: Innixo Files": { title: "Code Red: Innixo Files", type: "Team", fee: 90, teamSize: 3 },
    "Paper Presentation": { title: "Paper Presentation", type: "Team", fee: 0, teamSize: 2 },
    "Prompt Forge": { title: "Prompt Forge", type: "Individual", fee: 30, teamSize: 1 },
    "Overdrive UI": { title: "Overdrive UI", type: "Individual", fee: 50, teamSize: 1 },
    "Debug Arena": { title: "Debug Arena", type: "Team", fee: 120, teamSize: 2 },
    "Code Sprint": { title: "Code Sprint", type: "Team", fee: 120, teamSize: 2 },
    "Fall Guys": { title: "Fall Guys", type: "Team", fee: 200, teamSize: 4 },
    "Valorant": { title: "Valorant", type: "Team", fee: 500, teamSize: 5 },
    "CS:GO": { title: "CS:GO", type: "Team", fee: 500, teamSize: 5 },
    "Overdrive Hack": { title: "Overdrive Hack", type: "Team", fee: 200, teamSize: 5 }
};
