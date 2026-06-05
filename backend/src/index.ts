import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Load environment variables
dotenv.config();

export const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "http://localhost:5173", // Vite default port
  credentials: true
}));
app.use(express.json());

// Routes
import authRoutes from "./routes/authRoutes";
import leadRoutes from "./routes/leadRoutes";
import employeeRoutes from "./routes/employeeRoutes";
import reportRoutes from "./routes/reportRoutes";

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/reports", reportRoutes);

// Simple Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Self-Seeding Function
async function seedDatabase() {
  try {
    const agencyCount = await prisma.agency.count();
    if (agencyCount === 0) {
      console.log("No agencies found. Seeding initial demo agency and owner...");
      
      const newAgency = await prisma.agency.create({
        data: {
          name: "Star Credit Agency",
          slug: "star-credit",
          subscriptionPlan: "STANDARD",
          subscriptionStatus: "ACTIVE",
        }
      });

      const hashedPassword = await bcrypt.hash("Password123", 10);
      
      const defaultOwner = await prisma.user.create({
        data: {
          employeeId: "EMP001",
          name: "Tarun SCM Owner",
          phone: "9876543210",
          email: "owner@scm.com",
          passwordHash: hashedPassword,
          role: "OWNER",
          status: "ACTIVE",
          branch: "Chennai Main Branch",
          agencyId: newAgency.id
        }
      });

      console.log("Database seeded successfully!");
      console.log(`Agency Slug: ${newAgency.slug}`);
      console.log(`Default Owner Email: ${defaultOwner.email}`);
      console.log(`Default Owner Password: Password123`);
    } else {
      console.log("Database already initialized.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedDatabase();
});
