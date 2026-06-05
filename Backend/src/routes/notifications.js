import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth.js";
import { sendNotification } from "../services/notification.service.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// Get notification logs
router.get("/", async (_, res) => {
  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(logs);
});

// Send reminder to all students with outstanding balance
router.post("/remind-all", async (_, res) => {
  const students = await prisma.student.findMany({
    include: { class: true, payments: true },
  });

  const owing = students.filter((s) => {
    const paid = s.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    return s.class.feeAmount - paid > 0;
  });

  const results = await Promise.allSettled(
    owing.map((s) => {
      const balance =
        s.class.feeAmount -
        s.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      return sendNotification({
        phone: s.parentPhone,
        type: "fee_reminder",
        message: `Reminder: ₦${balance.toFixed(2)} outstanding fee for ${s.name}. Please pay promptly.`,
      });
    }),
  );

  res.json({
    sent: results.filter((r) => r.status === "fulfilled").length,
    total: owing.length,
  });
});

export default router;
