import { Response } from "express";
import { CustomRequest } from "../middleware/auth";
import { prisma } from "../index";
import bcrypt from "bcryptjs";

// Get employees list (only same agency)
export const getEmployees = async (req: CustomRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    
    const employees = await prisma.user.findMany({
      where: { agencyId },
      orderBy: { joiningDate: "desc" },
      select: {
        id: true,
        employeeId: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        branch: true,
        joiningDate: true
      }
    });

    res.json({ employees });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Add Employee (Owner Only)
export const addEmployee = async (req: CustomRequest, res: Response) => {
  const { employeeId, name, phone, email, password, role, branch } = req.body;
  const agencyId = req.user?.agencyId;

  try {
    if (!employeeId || !name || !email || !password || !role || !agencyId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if ID or Email already exists
    const duplicateId = await prisma.user.findUnique({ where: { employeeId } });
    if (duplicateId) {
      return res.status(400).json({ error: "Employee ID already exists" });
    }

    const duplicateEmail = await prisma.user.findUnique({ where: { email } });
    if (duplicateEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newEmployee = await prisma.user.create({
      data: {
        employeeId,
        name,
        phone: phone || "",
        email,
        passwordHash: hashedPassword,
        role, // TELECALLER or WORKER or OWNER
        branch: branch || "Main Branch",
        agencyId,
        status: "ACTIVE"
      }
    });

    res.status(201).json({ message: "Employee created successfully", employee: newEmployee });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update Employee
export const updateEmployee = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const { name, phone, role, branch, status, password } = req.body;
  const agencyId = req.user?.agencyId;

  try {
    const employee = await prisma.user.findFirst({ where: { id, agencyId } });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found in your agency" });
    }

    const updateData: any = {
      name: name ?? employee.name,
      phone: phone ?? employee.phone,
      role: role ?? employee.role,
      branch: branch ?? employee.branch,
      status: status ?? employee.status
    };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData
    });

    res.json({ message: "Employee updated successfully", employee: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get pending employee registration requests (Owner Only)
export const getEmployeeRequests = async (req: CustomRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    
    const requests = await prisma.employeeRequest.findMany({
      where: { agencyId, status: "PENDING" },
      orderBy: { createdAt: "desc" }
    });

    res.json({ requests });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Process Employee Request (Approve/Reject)
export const processEmployeeRequest = async (req: CustomRequest, res: Response) => {
  const { requestId } = req.params;
  const { action, employeeId, password } = req.body; // action: APPROVE or REJECT
  const agencyId = req.user?.agencyId;

  try {
    if (!agencyId) return res.status(401).json({ error: "Unauthorized" });

    const request = await prisma.employeeRequest.findFirst({
      where: { id: requestId, agencyId }
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (action === "REJECT") {
      await prisma.employeeRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" }
      });
      return res.json({ message: "Employee request rejected successfully" });
    }

    if (action === "APPROVE") {
      if (!employeeId || !password) {
        return res.status(400).json({ error: "Employee ID and Temporary Password are required for approval" });
      }

      // Check duplicate Employee ID or email
      const duplicateId = await prisma.user.findUnique({ where: { employeeId } });
      if (duplicateId) {
        return res.status(400).json({ error: "Employee ID already exists" });
      }

      const duplicateEmail = await prisma.user.findUnique({ where: { email: request.email } });
      if (duplicateEmail) {
        return res.status(400).json({ error: "Email is already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Perform request state change and user creation in transaction
      await prisma.$transaction(async (tx) => {
        await tx.employeeRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED" }
        });

        await tx.user.create({
          data: {
            employeeId,
            name: request.name,
            phone: request.phone,
            email: request.email,
            passwordHash: hashedPassword,
            role: request.role,
            branch: request.branch,
            agencyId,
            status: "ACTIVE"
          }
        });
      });

      return res.json({ message: "Employee request approved and account created successfully" });
    }

    res.status(400).json({ error: "Invalid action. Use APPROVE or REJECT" });
  } catch (error: any) {
    console.error("Process Request Error:", error);
    res.status(500).json({ error: error.message });
  }
};
