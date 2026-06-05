import { Router } from "express";
import { getOwnerDashboard, getTelecallerDashboard, getWorkerDashboard, getMonthlyReport } from "../controllers/reportController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

// Secure all endpoints with JWT auth
router.use(authenticateJWT as any);

router.get("/owner", requireRole(["OWNER"]) as any, getOwnerDashboard as any);
router.get("/telecaller", requireRole(["TELECALLER", "OWNER"]) as any, getTelecallerDashboard as any);
router.get("/worker", requireRole(["WORKER", "OWNER"]) as any, getWorkerDashboard as any);
router.get("/monthly", requireRole(["OWNER"]) as any, getMonthlyReport as any);

export default router;
