import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTerm } from "../context/TermContext";
import Modal from "../components/Modal";
import {
  Spinner,
  ErrorMessage,
  Badge,
  ActionButton,
  FormField,
  inputStyle,
} from "../components/ui";

const METHODS = ["cash", "transfer", "card", "POS"];

export default function Payments() {
  const { currentTerm, sessions } = useTerm();
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [filterTermId, setFilterTermId] = useState("");
  const [school, setSchool] = useState(null);

  const [form, setForm] = useState({
    studentId: "",
    termId: "",
    amountPaid: "",
    paymentMethod: "cash",
    note: "",
  });

  // Flatten all terms for selectors
  const allTerms = sessions.flatMap((s) =>
    s.terms.map((t) => ({
      ...t,
      sessionName: s.name,
      label: `${s.name} — ${t.name}${t.isCurrent ? " ✓" : ""}`,
    })),
  );

  const load = () => {
    setLoading(true);
    const url = filterTermId ? `/payments?termId=${filterTermId}` : "/payments";
    Promise.all([api(url), api("/students"), api("/setup/school")])
      .then(([p, s, sc]) => {
        setPayments(p);
        setStudents(s);
        setSchool(sc);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filterTermId]);

  console.log({ payments, students });

  // Pre-fill termId with current active term when modal opens
  const openModal = () => {
    setForm({
      studentId: "",
      termId: currentTerm?.id || "",
      amountPaid: "",
      paymentMethod: "cash",
      note: "",
    });
    setFormErr("");
    setModal(true);
  };

  const record = async () => {
    if (!form.studentId) return setFormErr("Select a student");
    if (!form.termId) return setFormErr("Select a term");
    if (!form.amountPaid) return setFormErr("Enter amount paid");
    setSaving(true);
    try {
      await api("/payments", { method: "POST", body: form });
      setModal(false);
      load();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

  // Show student balance for selected student + term
  const selectedStudent = students.find((s) => s.id === form.studentId);
  const termPayments =
    selectedStudent?.payments?.filter((p) => p.termId === form.termId) || [];
  const termPaid = termPayments.reduce((s, p) => s + p.amountPaid, 0);
  const termBalance = selectedStudent
    ? (selectedStudent.class?.feeAmount || 0) - termPaid
    : null;

  //print Receipt
  const printReceipt = (payment) => {
    if (!payment) return;

    const w = window.open("", "_blank");

    const logoHtml = school?.logoUrl
      ? `<img src="${school.logoUrl}" style="height:64px;object-fit:contain;margin-bottom:6px"/>`
      : `<div style="font-size:48px;">🏫</div>`;

    const sessionTermLabel =
      payment.term && payment.term.session
        ? `${payment.term.session.name} — ${payment.term.name}`
        : "N/A";

    const formattedDate = new Date(
      payment.date || payment.createdAt,
    ).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const formattedTime = new Date(
      payment.date || payment.createdAt,
    ).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>School Fees Payment Receipt</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Roboto', 'Open Sans', sans-serif;
          max-width: 720px;
          margin: 30px auto;
          color: #1a1f36;
          padding: 20px;
        }

        .header {
          text-align: center;
          border-bottom: 3px double #1a1f36;
          padding-bottom: 18px;
          margin-bottom: 24px;
        }

        .header h1 {
          font-size: 22px;
          margin: 6px 0;
        }

        .sub {
          font-size: 13px;
          color: #6b7280;
          margin: 2px 0;
        }

        .title {
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .receipt-badge {
          display: inline-block;
          background: #ecfdf5;
          color: #065f46;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 10px;
        }

        .info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 25px;
        }

        .info div {
          border: 1px solid #e5e7eb;
          padding: 10px 12px;
          border-radius: 6px;
        }

        .info span {
          display: block;
          font-size: 10px;
          color: #9ca3af;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .payment-summary {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          margin-top: 20px;
        }

        .payment-summary table {
          width: 100%;
          border-collapse: collapse;
        }

        .payment-summary td {
          padding: 14px;
          border-bottom: 1px solid #f3f4f6;
        }

        .payment-summary tr:last-child td {
          border-bottom: none;
        }

        .amount-paid {
          color: #16a34a;
          font-weight: bold;
          font-size: 20px;
        }

        .balance {
          color: #dc2626;
          font-weight: bold;
        }

        .footer {
          margin-top: 40px;
          border-top: 2px dashed #d1d5db;
          padding-top: 20px;
        }

        .bank-box {
          background: #f9fafb;
          padding: 14px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.8;
        }

        .signature {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
        }

        .signature div {
          width: 45%;
          border-top: 1px solid #1a1f36;
          text-align: center;
          padding-top: 8px;
          font-size: 12px;
          color: #6b7280;
        }

        @media print {
          body {
            margin: 10px;
          }
        }
      </style>
    </head>

    <body>

      <div class="header">
        ${logoHtml}
        <h1>${school?.name || "School Name"}</h1>
        ${school?.address ? `<p class="sub">${school.address}</p>` : ""}
        ${school?.phone ? `<p class="sub">${school.phone}</p>` : ""}
        ${school?.motto ? `<p class="sub"><i>"${school.motto}"</i></p>` : ""}

        <div class="title">Official Payment Receipt</div>
        <div class="receipt-badge">
          Receipt No: ${payment.id.slice(-8).toUpperCase()}
        </div>
      </div>

      <div class="info">
        <div>
          <span>Date</span>
          ${formattedDate}
        </div>

        <div>
          <span>Time</span>
          ${formattedTime}
        </div>

        <div>
          <span>Payment Method</span>
          ${payment.paymentMethod || "N/A"}
        </div>

        <div>
          <span>Session / Term</span>
          ${sessionTermLabel}
        </div>

        <div>
          <span>Student Name</span>
          ${payment.student?.name || "N/A"}
        </div>

        <div>
          <span>Admission Number</span>
          ${payment.student?.admissionNumber || "N/A"}
        </div>

        <div>
          <span>Class</span>
          ${payment.student?.class?.className || "N/A"}
        </div>

        <div>
          <span>Parent Phone</span>
          ${payment.student?.parentPhone || "N/A"}
        </div>
      </div>

      <div class="payment-summary">
        <table>
          <tr>
            <td><strong>Amount Paid</strong></td>
            <td class="amount-paid">
              ₦${Number(payment.amountPaid).toLocaleString()}
            </td>
          </tr>

          <tr>
            <td><strong>Current Balance</strong></td>
            <td class="balance">
              ₦${Number(payment.currentBalance || 0).toLocaleString()}
            </td>
          </tr>

          <tr>
            <td><strong>Payment Note</strong></td>
            <td>
              ${payment.note || "School fee payment"}
            </td>
          </tr>
        </table>
      </div>

      <div class="footer">
       

        <div class="signature">
          <div>Bursar Signature</div>
          <div>School Stamp / Management</div>
        </div>
      </div>

      <script>
        window.onload = () => window.print()
      </script>

    </body>
    </html>
  `);

    w.document.close();
  };

  if (loading && !payments.length) return <Spinner />;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0 }}>Payments</h2>
        <ActionButton onClick={openModal}>+ Record Payment</ActionButton>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* No active term warning */}
      {!currentTerm && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#92400e",
          }}
        >
          ⚠ No active term set. Go to <strong>Sessions</strong> to set one
          before recording payments.
        </div>
      )}

      {/* Filter by term */}
      <div style={{ marginBottom: 14 }}>
        <select
          value={filterTermId}
          onChange={(e) => setFilterTermId(e.target.value)}
          style={{ ...inputStyle, maxWidth: 260, fontSize: 13 }}
        >
          <option value="">All terms</option>
          {allTerms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Payments table */}
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}
      >
        {loading ? (
          <Spinner />
        ) : (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {[
                  "Date",
                  "Student",
                  "Class",
                  "Amount",
                  "Term",
                  "Session",
                  "Method",
                  "Note",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      color: "#374151",
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                    {p.date ? new Date(p.date).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                    {p.student.name}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#6b7280" }}>
                    {p.student.class.className}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontWeight: 600,
                      color: "#10b981",
                    }}
                  >
                    {fmt(p.amountPaid)}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#374151" }}>
                    {p.term?.name || "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#6b7280",
                      fontSize: 12,
                    }}
                  >
                    {p.term?.session?.name || "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge label={p.paymentMethod} color="blue" />
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#6b7280",
                      fontSize: 12,
                    }}
                  >
                    {p.note || "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#9ca3af",
                      fontSize: 12,
                    }}
                  >
                    <ActionButton
                      style={{
                        color: "#3b82f6",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        printReceipt(p);
                      }}
                    >
                      🖨 Print
                    </ActionButton>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "40px 14px",
                      textAlign: "center",
                      color: "#9ca3af",
                    }}
                  >
                    No payments recorded{filterTermId ? " for this term" : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title="Record School Fee Payment"
          onClose={() => setModal(false)}
        >
          <ErrorMessage message={formErr} />

          <FormField label="Term">
            <select
              value={form.termId}
              onChange={(e) =>
                setForm((p) => ({ ...p, termId: e.target.value }))
              }
              style={inputStyle}
            >
              <option value="">Select term…</option>
              {allTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Student">
            <select
              value={form.studentId}
              onChange={(e) =>
                setForm((p) => ({ ...p, studentId: e.target.value }))
              }
              style={inputStyle}
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.class.className}) — {s.admissionNumber}
                </option>
              ))}
            </select>
          </FormField>

          {/* Live balance hint */}
          {selectedStudent && form.termId && (
            <div
              style={{
                background: "#f9fafb",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 14,
                fontSize: 13,
              }}
            >
              <span style={{ color: "#6b7280" }}>School fee: </span>
              <strong>{fmt(selectedStudent.class?.feeAmount)}</strong>
              <span style={{ color: "#6b7280", margin: "0 8px" }}>·</span>
              <span style={{ color: "#6b7280" }}>Paid this term: </span>
              <strong style={{ color: "#10b981" }}>{fmt(termPaid)}</strong>
              <span style={{ color: "#6b7280", margin: "0 8px" }}>·</span>
              <span style={{ color: "#6b7280" }}>Balance: </span>
              <strong
                style={{ color: termBalance > 0 ? "#f59e0b" : "#10b981" }}
              >
                {fmt(termBalance)}
              </strong>
            </div>
          )}

          <FormField label="Amount Paid (₦)">
            <input
              type="number"
              min="0"
              value={form.amountPaid}
              onChange={(e) =>
                setForm((p) => ({ ...p, amountPaid: e.target.value }))
              }
              placeholder="e.g. 45000"
              style={inputStyle}
            />
          </FormField>

          <FormField label="Payment Method">
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm((p) => ({ ...p, paymentMethod: e.target.value }))
              }
              style={inputStyle}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Note (optional)">
            <input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="e.g. Part payment, bank teller no."
              style={inputStyle}
            />
          </FormField>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <ActionButton variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </ActionButton>
            <ActionButton disabled={saving} onClick={record}>
              {saving ? "Recording…" : "Record & Notify"}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
