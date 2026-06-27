import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/students.js";
import classRoutes from "./routes/classes.js";
import paymentRoutes from "./routes/payments.js";
import resultRoutes from "./routes/results.js";
import notificationRoutes from "./routes/notifications.js";
import optionalFeeRoutes from "./routes/optionalFees.js";
import setupRoutes from "./routes/setup.js";
import portalRoutes from "./routes/portal.js";
import sessionRoutes from "./routes/sessions.js";
import auditRoutes from "./routes/auditLog.js";
import assessmentCategoryRoutes from "./routes/assessmentCategories.routes.js";
// import paymentRoutes from "./routes/payment.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// const express = require("express");

//app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));

// import cors from "cors";

app.use(
  cors({
    origin: [
      "https://skooltrack.netlify.app",
      "https://markaztaaliim.com",
      "https://www.markaztaaliim.com",
    ],
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/classes", classRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/results", resultRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/optional-fees", optionalFeeRoutes);
app.use("/api/v1/setup", setupRoutes);
app.use("/api/v1/portal", portalRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1/audit", auditRoutes);
app.use("/api/v1/assessment-categories", assessmentCategoryRoutes);
app.use("/uploads", express.static("uploads"));

app.use((req, res) =>
  res.status(404).json({ error: `${req.method} ${req.path} not found` }),
);

app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

// routes

app.use("/api/payment", paymentRoutes);

app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  const prismaErrors = {
    P2002: "A record with that value already exists.",
    P2003: "Cannot delete — other records depend on this item.",
    P2025: "Record not found.",
  };
  if (err.code && prismaErrors[err.code])
    return res.status(400).json({ error: prismaErrors[err.code] });
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError")
    return res.status(401).json({ error: "Invalid or expired token" });
  res.status(500).json({ error: "An unexpected error occurred." });
});

app.listen(PORT, () => console.log(`  API → http://localhost:${PORT}`));
