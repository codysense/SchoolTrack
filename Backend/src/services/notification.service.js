import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function sendNotification({ phone, message, type }) {
  let status = "mock";

  try {
    const formattedPhone = phone.startsWith("0")
      ? "234" + phone.slice(1)
      : phone;

    const resp = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: formattedPhone,
        from: "Termii",
        sms: message,
        type: "plain",
        channel: "dnd",
        api_key: process.env.TERMII_API_KEY,
      }),
    });

    const data = await resp.json();
    console.log("Termii response:", data);

    if (!resp.ok || data.code !== "ok") {
      throw new Error(data.message || "Termii failed");
    }

    status = "sent";
  } catch (err) {
    console.error("Notification failed:", err.message);
    status = "failed";
  }

  return prisma.notificationLog.create({
    data: { phone, message, type, status },
  });
}

/**
 * Main send function — swap in real provider below.
 * Currently logs as mock. Returns the log record.
 */
// export async function sendNotification({ phone, message, type }) {
//   let status = "mock";

//   try {
//     // --- OPTION A: Termii (recommended for Nigeria) ---
//     // Uncomment and add TERMII_API_KEY to .env
//     //api/sms/send/bulk
//     //const resp = await fetch("https://api.ng.termii.com/api/sms/send", {
//     const resp = await fetch("https://v3.api.termii.com/api/sms/send/bulk", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         to: phone,
//         from: "SchoolTrack",
//         sms: message,
//         type: "plain",
//         channel: "generic",
//         api_key: process.env.TERMII_API_KEY,
//       }),
//     });
//     if (!resp.ok) throw new Error("Termii error");
//     status = "sent";

//     // --- OPTION B: Twilio SMS ---
//     /*
//     import twilio from 'twilio'
//     const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH)
//     await client.messages.create({ body: message, from: process.env.TWILIO_FROM, to: phone })
//     status = 'sent'
//     */

//     // --- OPTION C: WhatsApp via Twilio sandbox ---
//     /*
//     await client.messages.create({
//       body: message,
//       from: 'whatsapp:+14155238886',  // Twilio sandbox number
//       to: `whatsapp:${phone}`
//     })
//     status = 'sent'
//     */

//     console.log(`[MOCK SMS] → ${phone}: ${message}`);
//   } catch (err) {
//     console.error("Notification failed:", err.message);
//     status = "failed";
//   }

//   return prisma.notificationLog.create({
//     data: { phone, message, type, status },
//   });
// }
