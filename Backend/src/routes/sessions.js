import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, adminOnly } from "../middleware/auth.js";
import { log } from "../services/audit.service.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

function calculateSchoolDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  let days = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();

    // Monday-Friday only
    if (day !== 0 && day !== 6) {
      days++;
    }
  }

  return days;
}

// ── GET all sessions with their terms ────────────────────────────────────────
router.get("/", async (_, res) => {
  const sessions = await prisma.session.findMany({
    include: { terms: { orderBy: { name: "asc" } } },
    orderBy: { name: "desc" },
  });
  res.json(sessions);
});

// ── GET current active term ───────────────────────────────────────────────────
router.get("/current-term", async (_, res) => {
  const term = await prisma.term.findFirst({
    where: { isCurrent: true },
    include: { session: true },
  });
  res.json(term || null);
});

// ── POST create a session ─────────────────────────────────────────────────────
router.post("/", adminOnly, async (req, res) => {
  const { name, createTerms = true } = req.body;
  // name format: "2024/2025"
  if (!name?.trim())
    return res
      .status(400)
      .json({ error: "Session name is required (e.g. 2024/2025)" });

  try {
    const session = await prisma.session.create({
      data: {
        name: name.trim(),
        terms: createTerms
          ? {
              create: [
                { name: "First Term" },
                { name: "Second Term" },
                { name: "Third Term" },
              ],
            }
          : undefined,
      },
      include: { terms: true },
    });

    await log({
      req,
      action: "CREATE",
      entity: "Session",
      entityId: session.id,
      detail: `Created session ${session.name}`,
    });
    res.status(201).json(session);
  } catch (e) {
    if (e.code === "P2002")
      return res
        .status(409)
        .json({ error: "A session with that name already exists" });
    throw e;
  }
});

// ── PUT set a term as the current active term ─────────────────────────────────
// Only one term can be active at a time (across ALL sessions)
router.put("/terms/:termId/set-current", adminOnly, async (req, res) => {
  const { termId } = req.params;

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });
  if (!term) return res.status(404).json({ error: "Term not found" });

  // Clear all current flags
  await prisma.term.updateMany({
    where: { isCurrent: true },
    data: { isCurrent: false },
  });
  await prisma.session.updateMany({
    where: { isCurrent: true },
    data: { isCurrent: false },
  });

  // Set new current
  await prisma.term.update({
    where: { id: termId },
    data: { isCurrent: true },
  });
  await prisma.session.update({
    where: { id: term.sessionId },
    data: { isCurrent: true },
  });

  await log({
    req,
    action: "UPDATE",
    entity: "Term",
    entityId: termId,
    detail: `Set current term to "${term.name}" — ${term.session.name}`,
  });

  res.json({ success: true, term: { ...term, isCurrent: true } });
});

// ── PUT update term dates ─────────────────────────────────────────────────────
router.put("/terms/:termId", adminOnly, async (req, res) => {
  try {
    const { startDate, endDate, schoolOpened } = req.body;

    const schoolOpenedDays =
      startDate && endDate && !schoolOpened
        ? calculateSchoolDays(startDate, endDate)
        : parseInt(schoolOpened || 0);

    const term = await prisma.term.update({
      where: {
        id: req.params.termId,
      },

      data: {
        startDate: startDate ? new Date(startDate) : null,

        endDate: endDate ? new Date(endDate) : null,

        schoolOpened: schoolOpenedDays,
      },

      include: {
        session: true,
      },
    });

    res.json(term);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update term dates",
    });
  }
});
// router.put("/terms/:termId", adminOnly, async (req, res) => {
//   const { startDate, endDate } = req.body;
//   const term = await prisma.term.update({
//     where: { id: req.params.termId },
//     data: {
//       startDate: startDate ? new Date(startDate) : null,
//       endDate: endDate ? new Date(endDate) : null,
//     },
//     include: { session: true },
//   });
//   res.json(term);
// });

// ── DELETE a session (cascades to terms, payments, results, assigns) ──────────
router.delete("/:id", adminOnly, async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });

  await prisma.session.delete({ where: { id: req.params.id } });
  await log({
    req,
    action: "DELETE",
    entity: "Session",
    entityId: req.params.id,
    detail: `Deleted session ${session.name}`,
  });
  res.json({ success: true });
});

// ── GET summary for a specific term (used by dashboard) ──────────────────────
router.get("/terms/:termId/summary", async (req, res) => {
  const { termId } = req.params;

  const [students, payments, optAssigns] = await Promise.all([
    prisma.student.findMany({ include: { class: true } }),
    prisma.payment.findMany({ where: { termId } }),
    prisma.optionalFeeAssign.findMany({
      where: { termId },
      include: { optionalFee: true, payments: true },
    }),
  ]);

  const schoolFeeExpected = students.reduce(
    (s, st) => s + st.class.feeAmount,
    0,
  );
  const schoolFeeCollected = payments.reduce((s, p) => s + p.amountPaid, 0);

  // Group optional fees by fee type
  const optFeeMap = {};
  for (const a of optAssigns) {
    const id = a.optionalFeeId;
    if (!optFeeMap[id]) {
      optFeeMap[id] = {
        id,
        name: a.optionalFee.name,
        expected: 0,
        collected: 0,
        assignCount: 0,
      };
    }
    optFeeMap[id].expected += a.optionalFee.amount;
    optFeeMap[id].collected += a.payments.reduce((s, p) => s + p.amountPaid, 0);
    optFeeMap[id].assignCount += 1;
  }

  const optFeeSummary = Object.values(optFeeMap);
  const optFeeExpected = optFeeSummary.reduce((s, f) => s + f.expected, 0);
  const optFeeCollected = optFeeSummary.reduce((s, f) => s + f.collected, 0);

  res.json({
    totalStudents: students.length,
    schoolFeeExpected,
    schoolFeeCollected,
    schoolFeeOutstanding: schoolFeeExpected - schoolFeeCollected,
    optFeeSummary,
    optFeeExpected,
    optFeeCollected,
    optFeeOutstanding: optFeeExpected - optFeeCollected,
    totalExpected: schoolFeeExpected + optFeeExpected,
    totalCollected: schoolFeeCollected + optFeeCollected,
    totalOutstanding:
      schoolFeeExpected +
      optFeeExpected -
      (schoolFeeCollected + optFeeCollected),
  });
});

export default router;
