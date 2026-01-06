import { type User, type InsertUser, type Registration, type InsertRegistration } from "./shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getRegistration(id: string): Promise<Registration | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createRegistration(registration: InsertRegistration): Promise<Registration>;
  getAllRegistrations(): Promise<Registration[]>;
  updateRegistrationPaymentDetails(id: string, details: Partial<Registration>): Promise<Registration>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private registrations: Map<string, Registration>;

  constructor() {
    this.users = new Map();
    this.registrations = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getRegistration(id: string): Promise<Registration | undefined> {
    return this.registrations.get(id);
  }

  async getAllRegistrations(): Promise<Registration[]> {
    return Array.from(this.registrations.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createRegistration(insertRegistration: InsertRegistration): Promise<Registration> {
    const id = randomUUID();
    const registration: Registration = {
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

  async updateRegistrationPaymentDetails(id: string, details: Partial<Registration>): Promise<Registration> {
    const registration = this.registrations.get(id);
    if (!registration) throw new Error("Registration not found");

    // Check for duplicate order creation prevention if needed, but here we just update
    const updated = { ...registration, ...details };
    this.registrations.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
