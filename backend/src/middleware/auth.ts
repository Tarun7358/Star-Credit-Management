import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../index";

export interface CustomRequest extends Request {
  user?: {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    role: string;
    agencyId: string;
  };
}

export const authenticateJWT = async (req: CustomRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access Denied: No Token Provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET || "star-credit-management-secret-key-super-secure";
    const decoded = jwt.verify(token, secret) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, employeeId: true, name: true, email: true, role: true, agencyId: true, status: true }
    });

    if (!user) {
      return res.status(401).json({ error: "User not found or deleted" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Your account is disabled. Please contact the administrator." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires role ${roles.join(" or ")}` });
    }

    next();
  };
};
