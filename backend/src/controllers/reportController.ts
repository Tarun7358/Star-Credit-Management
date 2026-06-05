import { Response } from "express";
import { CustomRequest } from "../middleware/auth";
import { prisma } from "../index";

// Get Owner Dashboard Aggregates
export const getOwnerDashboard = async (req: CustomRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) return res.status(401).json({ error: "Unauthorized" });

    // Parallel queries to construct dashboard state
    const [
      totalLeads,
      assignedLeads,
      newLeads,
      interestedLeads,
      completedLeads,
      recentActivities,
      telecallers,
      workers,
      pendingRequests
    ] = await Promise.all([
      prisma.lead.count({ where: { agencyId } }),
      prisma.lead.count({ where: { agencyId, telecallerId: { not: null } } }),
      prisma.lead.count({ where: { agencyId, status: "NEW" } }),
      prisma.lead.count({ where: { agencyId, status: "INTERESTED" } }),
      prisma.lead.count({ where: { agencyId, workerStatus: "COMPLETED" } }),
      prisma.activityLog.findMany({
        where: { lead: { agencyId } },
        orderBy: { timestamp: "desc" },
        take: 5,
        include: {
          lead: { select: { customerName: true } },
          user: { select: { name: true, role: true } }
        }
      }),
      prisma.user.findMany({
        where: { agencyId, role: "TELECALLER" },
        select: {
          id: true,
          name: true,
          employeeId: true,
          assignedTeleLeads: { select: { status: true } }
        }
      }),
      prisma.user.findMany({
        where: { agencyId, role: "WORKER" },
        select: {
          id: true,
          name: true,
          employeeId: true,
          assignedWorkLeads: { select: { workerStatus: true } }
        }
      }),
      prisma.employeeRequest.count({ where: { agencyId, status: "PENDING" } })
    ]);

    // Format Telecaller performance metrics
    const telecallerPerformance = telecallers.map(tc => {
      const total = tc.assignedTeleLeads.length;
      const interested = tc.assignedTeleLeads.filter(l => l.status === "INTERESTED" || l.status === "DOCUMENTS_RECEIVED" || l.status === "READY_FOR_WORKER").length;
      return {
        id: tc.id,
        name: tc.name,
        employeeId: tc.employeeId,
        assignedCount: total,
        conversionRate: total > 0 ? Math.round((interested / total) * 100) : 0
      };
    });

    // Format Worker performance metrics
    const workerPerformance = workers.map(wk => {
      const total = wk.assignedWorkLeads.length;
      const completed = wk.assignedWorkLeads.filter(l => l.workerStatus === "COMPLETED").length;
      return {
        id: wk.id,
        name: wk.name,
        employeeId: wk.employeeId,
        assignedCount: total,
        completedCount: completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    });

    // Loan type breakdown
    const loanBreakdownRaw = await prisma.lead.groupBy({
      by: ["loanType"],
      where: { agencyId },
      _count: { id: true },
      _sum: { loanAmount: true }
    });

    const loanBreakdown = loanBreakdownRaw.map(item => ({
      name: item.loanType,
      value: item._count.id,
      amount: item._sum.loanAmount || 0
    }));

    // Status breakdown
    const statusBreakdownRaw = await prisma.lead.groupBy({
      by: ["status"],
      where: { agencyId },
      _count: { id: true }
    });

    const statusBreakdown = statusBreakdownRaw.map(item => ({
      name: item.status,
      value: item._count.id
    }));

    res.json({
      stats: {
        totalLeads,
        assignedLeads,
        newLeads,
        interestedLeads,
        completedLeads,
        pendingRequests
      },
      recentActivities,
      telecallerPerformance,
      workerPerformance,
      loanBreakdown,
      statusBreakdown
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get Telecaller Dashboard Aggregates
export const getTelecallerDashboard = async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      assignedLeadsCount,
      todayFollowUps,
      missedFollowUps,
      interestedLeadsCount,
      recentFollowUps
    ] = await Promise.all([
      prisma.lead.count({ where: { telecallerId: userId } }),
      prisma.followUp.count({
        where: {
          userId,
          scheduledTime: {
            gte: startOfToday,
            lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
          },
          status: "PENDING"
        }
      }),
      prisma.followUp.count({
        where: {
          userId,
          scheduledTime: { lt: startOfToday },
          status: "PENDING"
        }
      }),
      prisma.lead.count({
        where: {
          telecallerId: userId,
          status: { in: ["INTERESTED", "DOCUMENTS_REQUESTED", "DOCUMENTS_RECEIVED", "READY_FOR_WORKER"] }
        }
      }),
      prisma.followUp.findMany({
        where: { userId, status: "PENDING" },
        include: { lead: { select: { customerName: true, mobile: true, loanType: true } } },
        orderBy: { scheduledTime: "asc" },
        take: 10
      })
    ]);

    const conversionRate = assignedLeadsCount > 0 ? Math.round((interestedLeadsCount / assignedLeadsCount) * 100) : 0;

    res.json({
      stats: {
        assignedLeadsCount,
        todayFollowUps,
        missedFollowUps,
        conversionRate
      },
      recentFollowUps
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get Worker Dashboard Aggregates
export const getWorkerDashboard = async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [
      assignedCount,
      pendingCount,
      completedCount,
      pendingDocsCount,
      assignedLeads
    ] = await Promise.all([
      prisma.lead.count({ where: { workerId: userId } }),
      prisma.lead.count({ where: { workerId: userId, workerStatus: { in: ["ASSIGNED", "CUSTOMER_MET", "PENDING_DOCUMENTS"] } } }),
      prisma.lead.count({ where: { workerId: userId, workerStatus: "COMPLETED" } }),
      prisma.lead.count({ where: { workerId: userId, workerStatus: "PENDING_DOCUMENTS" } }),
      prisma.lead.findMany({
        where: { workerId: userId },
        select: {
          id: true,
          customerName: true,
          mobile: true,
          address: true,
          loanType: true,
          loanAmount: true,
          bankName: true,
          workerStatus: true,
          updatedAt: true
        },
        orderBy: { updatedAt: "desc" },
        take: 10
      })
    ]);

    res.json({
      stats: {
        assignedCount,
        pendingCount,
        completedCount,
        pendingDocsCount
      },
      assignedLeads
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get Monthly Report Aggregates
export const getMonthlyReport = async (req: CustomRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) return res.status(401).json({ error: "Unauthorized" });

    const [
      totalLeads,
      contacted,
      interested,
      documentsCollected,
      completed,
      loanBreakdown,
      conversionRate
    ] = await Promise.all([
      prisma.lead.count({ where: { agencyId } }),
      prisma.lead.count({ where: { agencyId, status: { not: "NEW" } } }),
      prisma.lead.count({ where: { agencyId, status: { in: ["INTERESTED", "DOCUMENTS_REQUESTED", "DOCUMENTS_RECEIVED", "READY_FOR_WORKER"] } } }),
      prisma.lead.count({ where: { agencyId, workerStatus: { in: ["DOCUMENTS_COLLECTED", "SUBMITTED", "COMPLETED"] } } }),
      prisma.lead.count({ where: { agencyId, workerStatus: "COMPLETED" } }),
      prisma.lead.groupBy({
        by: ["loanType"],
        where: { agencyId },
        _count: { id: true },
        _sum: { loanAmount: true }
      }),
      prisma.lead.count({ where: { agencyId, status: "INTERESTED" } })
    ]);

    const breakdown = loanBreakdown.map(item => ({
      loanType: item.loanType,
      count: item._count.id,
      totalAmount: item._sum.loanAmount || 0
    }));

    res.json({
      report: {
        totalLeads,
        contacted,
        interested,
        documentsCollected,
        completed,
        conversionRate: totalLeads > 0 ? Math.round((interested / totalLeads) * 100) : 0,
        breakdown
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
