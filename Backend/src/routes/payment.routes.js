import express from "express";
import crypto from "crypto";

import {
  initializePayment,
  verifyPayment,
} from "../services/paystack.service.js";

import { updateStudentPayment } from "../services/student.service.js";

const router = express.Router();

// Initialize payment
router.post("/initialize", async (req, res) => {
  try {
    const { email, amount, studentId } = req.body;

    const reference = `SCH_${studentId}_${Date.now()}`;

    const payment = await initializePayment({
      email,
      amount,
      reference,
    });

    res.json({
      authorization_url: payment.authorization_url,
      reference,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Payment initialization failed",
    });
  }
});

// Verify payment after redirect
router.get("/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await verifyPayment(reference);

    if (payment.status === "success") {
      const studentId = reference.split("_")[1];

      await updateStudentPayment(studentId, {
        fullyPaid: true,
        amountPaid: payment.amount / 100,
        paymentReference: reference,
      });
    }

    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Verification failed",
    });
  }
});

// Webhook
router.post("/webhook", async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const reference = event.data.reference;
      const amount = event.data.amount / 100;
      const studentId = reference.split("_")[1];

      await updateStudentPayment(studentId, {
        fullyPaid: true,
        amountPaid: amount,
        paymentReference: reference,
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

export default router;
