import { randomUUID } from "crypto";
export class MemStorage {
    users;
    registrations;
    constructor() {
        this.users = new Map();
        this.registrations = new Map();
    }
    async getUser(id) {
        return this.users.get(id);
    }
    async getUserByUsername(username) {
        return Array.from(this.users.values()).find((user) => user.username === username);
    }
    async getRegistration(id) {
        return this.registrations.get(id);
    }
    async getAllRegistrations() {
        return Array.from(this.registrations.values());
    }
    async createUser(insertUser) {
        const id = randomUUID();
        const user = { ...insertUser, id };
        this.users.set(id, user);
        return user;
    }
    async createRegistration(insertRegistration) {
        const id = randomUUID();
        const registration = {
            ...insertRegistration,
            id,
            teamName: insertRegistration.teamName ?? null,
            teamLeader: insertRegistration.teamLeader ?? null,
            teamMembers: insertRegistration.teamMembers ?? null,
            status: "DRAFT",
            createdAt: new Date().toISOString(),
            razorpayOrderId: null,
            paymentStatus: "DRAFT",
            paymentMethod: null,
            amountExpected: 0,
            amountPaid: null,
            paymentCreatedAt: null
        };
        this.registrations.set(id, registration);
        return registration;
    }
    async updateRegistrationPaymentDetails(id, details) {
        const registration = this.registrations.get(id);
        if (!registration)
            throw new Error("Registration not found");
        // Check for duplicate order creation prevention if needed, but here we just update
        const updated = { ...registration, ...details };
        this.registrations.set(id, updated);
        return updated;
    }
}
export const storage = new MemStorage();
