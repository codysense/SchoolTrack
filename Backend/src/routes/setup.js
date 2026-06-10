import { Router } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authenticate, adminOnly } from "../middleware/auth.js";
import { uploadSchoolLogo } from "../middleware/uploadSchoolLogo.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, adminOnly);
router.use(uploadSchoolLogo.single("logo"));

// ── School Info ───────────────────────────────────────────────────────────────

// GET school info (creates a default row if none exists)
router.get("/school", async (_, res) => {
  let school = await prisma.school.findFirst();
  if (!school) {
    school = await prisma.school.create({
      data: { name: "My School", updatedAt: new Date() },
    });
  }
  res.json(school);
});

// PUT update school info (upsert by first record)
router.put("/school", async (req, res) => {
  const {
    name,
    address,
    phone,
    email,
    motto,
    logoUrl,
    website,
    accountName,
    accountNumber,
    bankName,
  } = req.body;
  let school = await prisma.school.findFirst();
  if (school) {
    const finalLogoUrl = req.file
      ? `/uploads/school-logos/${req.file.filename}`
      : logoUrl || school.logoUrl;
    school = await prisma.school.update({
      where: { id: school.id },
      data: {
        name,
        address,
        phone,
        email,
        motto,
        logoUrl: finalLogoUrl,
        website,
        accountName,
        accountNumber,
        bankName,
        updatedAt: new Date(),
      },
    });
  } else {
    const finalLogoUrl = req.file
      ? `/uploads/school-logos/${req.file.filename}`
      : logoUrl || null;
    school = await prisma.school.create({
      data: {
        name,
        address,
        phone,
        email,
        motto,
        logoUrl: finalLogoUrl,
        website,
        accountName,
        accountNumber,
        bankName,
        createdAt: new Date(),
      },
    });
  }
  res.json(school);
});

// ── Users (Admin + Teachers) ──────────────────────────────────────────────────

// GET all users
router.get("/users", async (_, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      teacher: { include: { class: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// POST create a user (admin or teacher)
router.post("/users", async (req, res) => {
  const { name, email, password, role, classId, subjectName } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email and password are required" });
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: role === "TEACHER" ? "TEACHER" : "ADMIN",
        ...(role === "TEACHER" && {
          teacher: {
            create: {
              classId: classId || null,
              subjectName: subjectName || null,
            },
          },
        }),
      },
      include: { teacher: { include: { class: true } } },
    });

    // Don't return password
    const { password: _, ...safe } = user;
    res.status(201).json(safe);
  } catch (e) {
    if (e.code === "P2002")
      return res.status(409).json({ error: "Email already in use" });
    throw e;
  }
});

// PUT update a user
router.put("/users/:id", async (req, res) => {
  const { name, email, password, classId, subjectName } = req.body;

  const data = { name, email };
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    include: { teacher: true },
  });

  // Update teacher profile if exists
  if (user.teacher) {
    await prisma.teacher.update({
      where: { userId: req.params.id },
      data: {
        classId: classId || null,
        subjectName: subjectName || null,
      },
    });
  }

  const { password: _, ...safe } = user;
  res.json(safe);
});

// DELETE a user
router.delete("/users/:id", async (req, res) => {
  // Prevent deleting yourself
  if (req.user.id === req.params.id) {
    return res
      .status(400)
      .json({ error: "You cannot delete your own account" });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
