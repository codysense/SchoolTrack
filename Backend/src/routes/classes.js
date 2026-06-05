import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// GET all classes (with student + subject counts)
router.get("/", async (_, res) => {
  const classes = await prisma.class.findMany({
    include: {
      _count: {
        select: {
          students: true,
          subjects: true,
        },
      },
    },
    orderBy: { className: "asc" },
  });
  res.json(classes);
});

// POST create a class
router.post("/", async (req, res) => {
  const { className, feeAmount } = req.body;
  try {
    const cls = await prisma.class.create({
      data: { className: className.trim(), feeAmount: parseFloat(feeAmount) },
    });
    res.status(201).json(cls);
  } catch (e) {
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A class with this name already exists" });
    }
    throw e;
  }
});

// PUT update a class
router.put("/:id", async (req, res) => {
  const { className, feeAmount } = req.body;
  try {
    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: { className: className.trim(), feeAmount: parseFloat(feeAmount) },
    });
    res.json(cls);
  } catch (e) {
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A class with this name already exists" });
    }
    throw e;
  }
});

// DELETE a class
router.delete("/:id", async (req, res) => {
  try {
    await prisma.class.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    if (e.code === "P2003") {
      return res
        .status(400)
        .json({ error: "Cannot delete class with enrolled students" });
    }
    throw e;
  }
});

export default router;
