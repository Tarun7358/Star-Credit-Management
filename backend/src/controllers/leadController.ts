import { Response } from "express";
import { CustomRequest } from "../middleware/auth";
import { prisma } from "../index";

// List Leads with Filters and Role-Based Access Isolation
export const getLeads = async (req: CustomRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Base filter by agency
    const whereClause: any = {
      agencyId: user.agencyId
    };

    // Role-based visibility
    if (user.role === "TELECALLER") {
      whereClause.telecallerId = user.id;
    } else if (user.role === "WORKER") {
      whereClause.workerId = user.id;
    }

    // Extraction of query filters
    const { loanType, bankName, status, workerStatus, telecallerId, workerId, search } = req.query;

    if (loanType) whereClause.loanType = String(loanType);
    if (bankName) whereClause.bankName = String(bankName);
    if (status) whereClause.status = String(status);
    if (workerStatus) whereClause.workerStatus = String(workerStatus);
    if (telecallerId && user.role === "OWNER") whereClause.telecallerId = String(telecallerId);
    if (workerId && user.role === "OWNER") whereClause.workerId = String(workerId);

    // Search query on customer name, mobile, address, bank
    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { customerName: { contains: searchStr } },
        { mobile: { contains: searchStr } },
        { bankName: { contains: searchStr } },
        { address: { contains: searchStr } }
      ];
    }

    const leads = await prisma.lead.findMany({
      where: whereClause,
      include: {
        telecaller: { select: { id: true, name: true, employeeId: true } },
        worker: { select: { id: true, name: true, employeeId: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ leads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get single lead details with logs, follow-ups, and documents
export const getLeadById = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        agencyId: user.agencyId,
        // Role isolation double check
        telecallerId: user.role === "TELECALLER" ? user.id : undefined,
        workerId: user.role === "WORKER" ? user.id : undefined
      },
      include: {
        telecaller: { select: { id: true, name: true, employeeId: true } },
        worker: { select: { id: true, name: true, employeeId: true } },
        activities: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { timestamp: "desc" }
        },
        documents: {
          include: { uploadedBy: { select: { name: true } } },
          orderBy: { uploadedAt: "desc" }
        },
        followUps: {
          orderBy: { scheduledTime: "desc" }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found or unauthorized access" });
    }

    res.json({ lead });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create Lead (Single Lead)
export const createLead = async (req: CustomRequest, res: Response) => {
  const { customerName, mobile, alternateMobile, address, loanType, loanAmount, bankName } = req.body;
  const user = req.user;

  try {
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!customerName || !mobile || !address || !loanType || !loanAmount || !bankName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const lead = await prisma.lead.create({
      data: {
        customerName,
        mobile,
        alternateMobile,
        address,
        loanType,
        loanAmount: parseFloat(loanAmount),
        bankName,
        agencyId: user.agencyId,
        status: "NEW"
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        action: "LEAD_IMPORTED",
        details: "Lead created manually."
      }
    });

    res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk Import Leads (From parsed Excel on frontend)
export const importLeads = async (req: CustomRequest, res: Response) => {
  const { leads } = req.body; // Array of lead objects
  const user = req.user;

  try {
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "No leads data provided" });
    }

    // Insert leads in a transaction
    const createdLeadsCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const item of leads) {
        const lead = await tx.lead.create({
          data: {
            customerName: item.customerName || "Unknown",
            mobile: String(item.mobile || ""),
            alternateMobile: item.alternateMobile ? String(item.alternateMobile) : null,
            address: item.address || "No Address Provided",
            loanType: item.loanType || "PERSONAL",
            loanAmount: parseFloat(item.loanAmount) || 0,
            bankName: item.bankName || "Unknown Bank",
            agencyId: user.agencyId,
            status: "NEW"
          }
        });

        await tx.activityLog.create({
          data: {
            leadId: lead.id,
            userId: user.id,
            action: "LEAD_IMPORTED",
            details: "Lead imported via spreadsheet upload."
          }
        });
        count++;
      }
      return count;
    });

    res.json({ message: `Successfully imported ${createdLeadsCount} leads.` });
  } catch (error: any) {
    console.error("Bulk Import Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Assign Leads (Bulk or Single)
export const assignLeads = async (req: CustomRequest, res: Response) => {
  const { leadIds, telecallerId, workerId } = req.body;
  const user = req.user;

  try {
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: "Invalid lead ID list" });
    }

    let telecallerName = "";
    let workerName = "";

    if (telecallerId) {
      const tc = await prisma.user.findFirst({ where: { id: telecallerId, agencyId: user.agencyId } });
      if (!tc) return res.status(400).json({ error: "Telecaller not found" });
      telecallerName = tc.name;
    }

    if (workerId) {
      const wk = await prisma.user.findFirst({ where: { id: workerId, agencyId: user.agencyId } });
      if (!wk) return res.status(400).json({ error: "Field worker not found" });
      workerName = wk.name;
    }

    // Process assignment updates in transaction
    await prisma.$transaction(async (tx) => {
      for (const id of leadIds) {
        const updateData: any = {};
        if (telecallerId !== undefined) updateData.telecallerId = telecallerId;
        if (workerId !== undefined) {
          updateData.workerId = workerId;
          updateData.workerStatus = "ASSIGNED";
        }

        const updatedLead = await tx.lead.update({
          where: { id },
          data: updateData
        });

        // Add history log
        if (telecallerId) {
          await tx.activityLog.create({
            data: {
              leadId: id,
              userId: user.id,
              action: "ASSIGNED",
              details: `Lead assigned to telecaller ${telecallerName}`
            }
          });
        }
        if (workerId) {
          await tx.activityLog.create({
            data: {
              leadId: id,
              userId: user.id,
              action: "ASSIGNED",
              details: `Lead assigned to field worker ${workerName}`
            }
          });
        }
      }
    });

    res.json({ message: "Leads assigned successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update Telecaller Lead Status or Remarks (Updates SCM Lead States)
export const updateLeadStatus = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const { status, remarks, workerStatus } = req.body;
  const user = req.user;

  try {
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const lead = await prisma.lead.findFirst({
      where: { id, agencyId: user.agencyId }
    });

    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const updateData: any = {};
    if (status) updateData.status = status;
    if (workerStatus) updateData.workerStatus = workerStatus;

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData
    });

    // Create activity log
    let details = `Lead record modified by ${user.name}.`;
    if (status && status !== lead.status) {
      details += ` Telecalling status updated from '${lead.status}' to '${status}'.`;
    }
    if (workerStatus && workerStatus !== lead.workerStatus) {
      details += ` Worker status updated from '${lead.workerStatus}' to '${workerStatus}'.`;
    }
    if (remarks) {
      details += ` Remarks added: "${remarks}"`;
    }

    await prisma.activityLog.create({
      data: {
        leadId: id,
        userId: user.id,
        action: "STATUS_UPDATE",
        details
      }
    });

    res.json({ message: "Lead status updated successfully", lead: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Schedule Follow-Up
export const addFollowUp = async (req: CustomRequest, res: Response) => {
  const { leadId, scheduledTime, notes } = req.body;
  const user = req.user;

  try {
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!leadId || !scheduledTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const followUp = await prisma.followUp.create({
      data: {
        leadId,
        userId: user.id,
        scheduledTime: new Date(scheduledTime),
        notes,
        status: "PENDING"
      }
    });

    // Log in timeline
    await prisma.activityLog.create({
      data: {
        leadId,
        userId: user.id,
        action: "STATUS_UPDATE",
        details: `Follow-up scheduled for ${new Date(scheduledTime).toLocaleString()}. Notes: ${notes || "None"}`
      }
    });

    res.status(201).json({ message: "Follow-up scheduled successfully", followUp });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Upload Document (Mock implementation saving files virtually onto dev database)
export const uploadLeadDocument = async (req: CustomRequest, res: Response) => {
  const { leadId, fileName, fileType, mockUrl } = req.body;
  const user = req.user;

  try {
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!leadId || !fileName || !fileType) {
      return res.status(400).json({ error: "Missing document fields" });
    }

    const newDoc = await prisma.document.create({
      data: {
        leadId,
        fileName,
        fileType,
        filePath: mockUrl || `/uploads/${Date.now()}-${fileName}`,
        uploadedByUserId: user.id
      }
    });

    // Log timeline
    await prisma.activityLog.create({
      data: {
        leadId,
        userId: user.id,
        action: "DOCUMENT_UPLOAD",
        details: `Document [${fileType}] "${fileName}" uploaded successfully.`
      }
    });

    res.status(201).json({ message: "Document uploaded successfully", document: newDoc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
