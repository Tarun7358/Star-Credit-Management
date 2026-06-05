import { Router } from "express";
import { getEmployees, addEmployee, updateEmployee, getEmployeeRequests, processEmployeeRequest } from "../controllers/employeeController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

// Secure all routes with JWT check
router.use(authenticateJWT as any);

// Employee Management (Owner Only)
router.get("/", requireRole(["OWNER"]) as any, getEmployees as any);
router.post("/", requireRole(["OWNER"]) as any, addEmployee as any);
router.put("/:id", requireRole(["OWNER"]) as any, updateEmployee as any);

// Registration Approval Request Routes (Owner Only)
router.get("/requests", requireRole(["OWNER"]) as any, getEmployeeRequests as any);
router.post("/requests/:requestId", requireRole(["OWNER"]) as any, processEmployeeRequest as any);

export default router;
