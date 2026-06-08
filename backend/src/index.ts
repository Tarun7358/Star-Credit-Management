import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Load environment variables
dotenv.config();

export const prisma = new PrismaClient();

// Custom ApiError Class for structured error handling
export class ApiError extends Error {
  statusCode: number;
  errors?: any;
  constructor(statusCode: number, message: string, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Hardened CORS Configuration
const allowedOrigins = [
  "http://localhost:5173", // Local Vite dev
  "http://localhost:5174",
  process.env.FRONTEND_URL,
  process.env.ADMIN_PANEL_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. Flutter mobile app, postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
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

// Health Monitoring Endpoints
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date()
  });
});

app.get("/health/database", async (req: Request, res: Response) => {
  try {
    // Ping database
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "OK",
      database: "CONNECTED",
      timestamp: new Date()
    });
  } catch (err: any) {
    console.error("Database health check failed:", err);
    res.status(500).json({
      status: "ERROR",
      database: "DISCONNECTED",
      error: err.message || "Database connection failed",
      timestamp: new Date()
    });
  }
});

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled Error:", err);
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";
  
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    errors: err.errors || null,
    stack: isProduction ? undefined : err.stack
  });
});

// Graceful Shutdown Management
const shutdownGracefully = async () => {
  console.log("Received kill signal, shutting down Prisma and Express gracefully...");
  try {
    await prisma.$disconnect();
    console.log("Prisma disconnected successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", shutdownGracefully);
process.on("SIGTERM", shutdownGracefully);


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

      const defaultPassword = process.env.DEFAULT_OWNER_PASSWORD || "Password123";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
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
      console.log(`Default Owner Password: ${defaultPassword}`);
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
