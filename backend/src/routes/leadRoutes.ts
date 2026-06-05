import { Router } from "express";
import { 
  getLeads, 
  getLeadById, 
  createLead, 
  importLeads, 
  assignLeads, 
  updateLeadStatus, 
  addFollowUp, 
  uploadLeadDocument 
} from "../controllers/leadController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

// Secure all endpoints with JWT auth
router.use(authenticateJWT as any);

router.get("/", getLeads as any);
router.get("/:id", getLeadById as any);
router.post("/", requireRole(["OWNER"]) as any, createLead as any);
router.post("/import", requireRole(["OWNER"]) as any, importLeads as any);
router.post("/assign", requireRole(["OWNER"]) as any, assignLeads as any);
router.put("/:id/status", updateLeadStatus as any);
router.post("/followup", addFollowUp as any);
router.post("/document", uploadLeadDocument as any);

export default router;
