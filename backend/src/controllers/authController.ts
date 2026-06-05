import { Response } from "express";
import { CustomRequest } from "../middleware/auth";
import { prisma } from "../index";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "star-credit-management-secret-key-super-secure";

// User Login
export const login = async (req: CustomRequest, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { agency: true }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Your account is currently inactive. Contact Owner." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      token,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        branch: user.branch,
        joiningDate: user.joiningDate,
        agency: {
          id: user.agency.id,
          name: user.agency.name,
          slug: user.agency.slug
        }
      }
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({ error: error.message || "Login failed" });
  }
};

// Onboard Agency & Owner (SaaS registration)
export const registerAgency = async (req: CustomRequest, res: Response) => {
  const { agencyName, slug, name, phone, email, password, branch } = req.body;

  try {
    if (!agencyName || !slug || !name || !email || !password) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    const existingAgency = await prisma.agency.findUnique({ where: { slug } });
    if (existingAgency) {
      return res.status(400).json({ error: "Agency slug already in use" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create agency & owner in transaction
    const result = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: { name: agencyName, slug }
      });

      // Generate a unique employee ID
      const employeeId = "EMP" + Math.floor(100 + Math.random() * 900);

      const owner = await tx.user.create({
        data: {
          employeeId,
          name,
          phone: phone || "",
          email,
          passwordHash: hashedPassword,
          role: "OWNER",
          status: "ACTIVE",
          branch: branch || "Headquarters",
          agencyId: agency.id
        }
      });

      return { agency, owner };
    });

    res.status(201).json({ message: "Agency and Owner registered successfully", result });
  } catch (error: any) {
    console.error("Agency Registration Error:", error);
    res.status(500).json({ error: error.message || "Registration failed" });
  }
};

// Submit Employee Creation Request (Submitted by active telecaller or worker without login, or custom screen)
export const requestEmployeeRegistration = async (req: CustomRequest, res: Response) => {
  const { name, phone, email, role, branch, agencySlug } = req.body;

  try {
    if (!name || !phone || !email || !role || !agencySlug) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const agency = await prisma.agency.findUnique({ where: { slug: agencySlug } });
    if (!agency) {
      return res.status(404).json({ error: "Agency not found" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered as an employee" });
    }

    // Check if duplicate request exists
    const duplicateRequest = await prisma.employeeRequest.findFirst({
      where: { email, agencyId: agency.id, status: "PENDING" }
    });
    if (duplicateRequest) {
      return res.status(400).json({ error: "A registration request is already pending for this email" });
    }

    const newRequest = await prisma.employeeRequest.create({
      data: {
        name,
        phone,
        email,
        role,
        branch: branch || "Main Branch",
        agencyId: agency.id,
        requestedByUserId: req.user?.id || "anonymous" // could be request from a logged-in telecaller
      }
    });

    res.status(201).json({ message: "Registration request submitted. Waiting for Owner approval.", newRequest });
  } catch (error: any) {
    console.error("Employee Request Error:", error);
    res.status(500).json({ error: error.message || "Request submission failed" });
  }
};

// Check Auth state (Get current user)
export const getCurrentUser = async (req: CustomRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not Authenticated" });
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { agency: true }
  });

  res.json({ user });
};
