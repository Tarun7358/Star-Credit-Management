import { Router } from "express";
import { login, registerAgency, requestEmployeeRegistration, getCurrentUser } from "../controllers/authController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.post("/register-agency", registerAgency);
router.post("/request-employee", requestEmployeeRegistration);
router.get("/me", authenticateJWT as any, getCurrentUser as any);

export default router;
