import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, adminOnly, staffOnly } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /assessment-categories
 *
 * Returns:
 * {
 *   Behaviour: [],
 *   Sport: [],
 *   Psychomotor: [],
 *   Comments: []
 * }
 */
router.get("/", async (req, res) => {
  try {
    const categories = await prisma.assessmentCategory.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    const grouped = categories.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }

      acc[item.type].push({
        id: item.id,
        name: item.name,
        type: item.type,
        description: item.description,
      });

      return acc;
    }, {});

    res.json(grouped);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch assessment categories",
    });
  }
});

//POST /assessment-categories
router.post("/", adminOnly, async (req, res) => {
  try {
    const { id, name, type, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        error: "Name is required",
      });
    }

    if (!type?.trim()) {
      return res.status(400).json({
        error: "Type is required",
      });
    }

    const category = id
      ? await prisma.assessmentCategory.update({
          where: { id },
          data: {
            name: name.trim(),
            type,
            description,
          },
        })
      : await prisma.assessmentCategory.create({
          data: {
            name: name.trim(),
            type,
            description,
          },
        });

    res.json(category);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to save assessment category",
    });
  }
});

//Delete /assessment-categories/:id
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await prisma.assessmentCategory.delete({
      where: {
        id: req.params.id,
      },
    });

    res.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to delete assessment category",
    });
  }
});

export default router;
