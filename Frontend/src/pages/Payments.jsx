import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTerm } from "../context/TermContext";
import Modal from "../components/Modal";
import { calculateStudentFeeBreakdown } from "../utils/scholarship";
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
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState(null);

  // Fee category in payment modal: "TUITION" vs "OPTIONAL"
  const [feeCategory, setFeeCategory] = useState("TUITION");
  const [studentAssigns, setStudentAssigns] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Searchable student picker states
  const [studentSearch, setStudentSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [form, setForm] = useState({
    studentId: "",
    termId: "",
    optionalFeeAssignIds: [],
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
    const params = new URLSearchParams();
    if (filterTermId) params.set("termId", filterTermId);
    if (filterType !== "ALL") params.set("type", filterType.toLowerCase());
    if (filterStatus) params.set("status", filterStatus);
    const url = `/payments?${params.toString()}`;

    Promise.all([api(url), api("/students?status=ACTIVE"), api("/setup/school")])
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
  }, [filterTermId, filterType, filterStatus]);

  // When student or term changes in OPTIONAL mode, fetch student's assigned optional fees
  useEffect(() => {
    if (form.studentId && form.termId && feeCategory === "OPTIONAL") {
      setAssignLoading(true);
      api(`/optional-fees/assigns?studentId=${form.studentId}&termId=${form.termId}`)
        .then((res) => {
          setStudentAssigns(res);
          setForm((p) => ({ ...p, optionalFeeAssignIds: [] }));
        })
        .catch((err) => console.error(err))
        .finally(() => setAssignLoading(false));
    }
  }, [form.studentId, form.termId, feeCategory]);

  // Pre-fill termId with current active term when modal opens
  const openModal = () => {
    setFeeCategory("TUITION");
    setStudentAssigns([]);
    setStudentSearch("");
    setDropdownOpen(false);
    setForm({
      studentId: "",
      termId: currentTerm?.id || "",
      optionalFeeAssignIds: [],
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
    const amt = parseFloat(form.amountPaid);
    if (amt <= 0 || isNaN(amt)) return setFormErr("Amount must be greater than 0");

    let allocations = [];
    if (feeCategory === "OPTIONAL") {
      const selectedAssigns = studentAssigns.filter((a) => form.optionalFeeAssignIds.includes(a.id) && a.balance > 0);
      const maxPayable = selectedAssigns.reduce((sum, a) => sum + a.balance, 0);
      if (!selectedAssigns.length) return setFormErr("Select at least one assigned optional fee with an outstanding balance");
      if (amt > maxPayable + 0.01) return setFormErr(`Maximum payable for selected fees is ₦${maxPayable.toLocaleString()}`);

      let remaining = amt;
      allocations = selectedAssigns.map((a) => {
        const allocation = Math.min(remaining, a.balance);
        remaining = Math.max(0, remaining - allocation);
        return { optionalFeeAssignId: a.id, amountPaid: allocation };
      }).filter((a) => a.amountPaid > 0);
    }

    setSaving(true);
    try {
      if (feeCategory === "OPTIONAL") {
        await api("/optional-fees/payments", {
          method: "POST",
          body: {
            allocations,
            studentId: form.studentId,
            termId: form.termId,
            paymentMethod: form.paymentMethod,
            note: form.note || null,
          },
        });
      } else {
        await api("/payments", {
          method: "POST",
          body: {
            studentId: form.studentId,
            termId: form.termId,
            amountPaid: amt,
            paymentMethod: form.paymentMethod,
            note: form.note || null,
          },
        });
      }
      setModal(false);
      load();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

  // Show student balance for selected student + term (Tuition)
  const selectedStudent = students.find((s) => s.id === form.studentId);
  const studentBreakdown = calculateStudentFeeBreakdown(selectedStudent, 0);
  const termPayments =
    selectedStudent?.payments?.filter((p) => p.termId === form.termId) || [];
  const termPaid = termPayments.reduce((s, p) => s + p.amountPaid, 0);
  const termBalance = selectedStudent
    ? studentBreakdown.expectedSchoolFee - termPaid
    : null;

  // Selected optional fee assignment
  const selectedAssigns = studentAssigns.filter((a) => form.optionalFeeAssignIds.includes(a.id));
  const optionalMax = selectedAssigns.reduce((sum, a) => sum + a.balance, 0);

  //print Receipt
  const printReceipt = (payment) => {
    if (!payment) return;

    const isOptional = payment.paymentType === "OPTIONAL" || Boolean(payment.optionalFeeAssign);
    const receiptTitle = isOptional
      ? `Optional Fee Payment Receipt`
      : `School Fees Payment Receipt`;
    const feeItemName = payment.feeName || (isOptional ? "Optional Fee" : "Tuition / School Fees");

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
      <title>${receiptTitle}</title>
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

        <div class="title">${receiptTitle}</div>
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
            <td><strong>Fee Type / Purpose</strong></td>
            <td><strong>${feeItemName}</strong></td>
          </tr>

          <tr>
            <td><strong>Amount Paid</strong></td>
            <td class="amount-paid">
              ₦${Number(payment.amountPaid).toLocaleString()}
            </td>
          </tr>

          ${!isOptional ? `
          <tr>
            <td><strong>Current Balance</strong></td>
            <td class="balance">
              ₦${Number(payment.currentBalance || 0).toLocaleString()}
            </td>
          </tr>
          ` : ""}

          <tr>
            <td><strong>Payment Note</strong></td>
            <td>
              ${payment.note || (isOptional ? "Optional fee payment" : "School fee payment")}
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

      {/* Filter by search, status, term & fee type */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          type="text"
          placeholder="🔍 Search student, class, or fee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, maxWidth: 260, fontSize: 13 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ ...inputStyle, maxWidth: 170, fontSize: 13 }}
        >
          <option value="ACTIVE">Active Students</option>
          <option value="GRADUATED">Graduated</option>
          <option value="LEFT">Left / Transferred</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPELLED">Expelled</option>
          <option value="ALL">All Statuses</option>
        </select>
        <select
          value={filterTermId}
          onChange={(e) => setFilterTermId(e.target.value)}
          style={{ ...inputStyle, maxWidth: 220, fontSize: 13 }}
        >
          <option value="">All terms</option>
          {allTerms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ ...inputStyle, maxWidth: 180, fontSize: 13 }}
        >
          <option value="ALL">All Payment Types</option>
          <option value="TUITION">Tuition Only</option>
          <option value="OPTIONAL">Optional Fees Only</option>
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
          <div
            style={{
              overflowX: "auto",
              width: "100%",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "Date",
                    "Student",
                    "Class",
                    "Fee Type",
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
                {payments
                  .filter((p) => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (
                      p.student?.name?.toLowerCase().includes(q) ||
                      p.student?.admissionNumber?.toLowerCase().includes(q) ||
                      p.student?.class?.className?.toLowerCase().includes(q) ||
                      p.feeName?.toLowerCase().includes(q) ||
                      p.paymentMethod?.toLowerCase().includes(q) ||
                      p.note?.toLowerCase().includes(q)
                    );
                  })
                  .map((p) => (
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
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: p.paymentType === "OPTIONAL" ? "#fef3c7" : "#ecfdf5",
                          color: p.paymentType === "OPTIONAL" ? "#b45309" : "#065f46",
                          border: `1px solid ${p.paymentType === "OPTIONAL" ? "#fde68a" : "#a7f3d0"}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.paymentType === "OPTIONAL" ? `⚡ ${p.feeName || "Optional"}` : "🎓 Tuition"}
                      </span>
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
                {payments.filter((p) => {
                  if (!search.trim()) return true;
                  const q = search.toLowerCase();
                  return (
                    p.student?.name?.toLowerCase().includes(q) ||
                    p.student?.admissionNumber?.toLowerCase().includes(q) ||
                    p.student?.class?.className?.toLowerCase().includes(q) ||
                    p.feeName?.toLowerCase().includes(q) ||
                    p.paymentMethod?.toLowerCase().includes(q) ||
                    p.note?.toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
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
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={
            feeCategory === "OPTIONAL"
              ? "Record Optional Fee Payment"
              : "Record School Fee Payment"
          }
          onClose={() => setModal(false)}
        >
          {/* Fee Type Selection Tab Buttons */}
          <div
            style={{
              display: "flex",
              background: "#f3f4f6",
              borderRadius: 8,
              padding: 4,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setFeeCategory("TUITION");
                setFormErr("");
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: feeCategory === "TUITION" ? "#fff" : "transparent",
                color: feeCategory === "TUITION" ? "#1a1f36" : "#6b7280",
                boxShadow: feeCategory === "TUITION" ? "0 1px 4px rgba(0,0,0,.08)" : "none",
              }}
            >
              🎓 School Fees (Tuition)
            </button>
            <button
              type="button"
              onClick={() => {
                setFeeCategory("OPTIONAL");
                setFormErr("");
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: feeCategory === "OPTIONAL" ? "#fff" : "transparent",
                color: feeCategory === "OPTIONAL" ? "#1a1f36" : "#6b7280",
                boxShadow: feeCategory === "OPTIONAL" ? "0 1px 4px rgba(0,0,0,.08)" : "none",
              }}
            >
              ⚡ Assigned Optional Fees
            </button>
          </div>

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

          <FormField label="Student" hint="Type student name or admission number to search">
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="🔍 Search student by name or admission no…"
                  value={
                    dropdownOpen
                      ? studentSearch
                      : selectedStudent
                        ? `${selectedStudent.name} (${selectedStudent.class?.className}) — ${selectedStudent.admissionNumber}`
                        : studentSearch
                  }
                  onFocus={() => {
                    setDropdownOpen(true);
                    if (selectedStudent && !studentSearch) {
                      setStudentSearch("");
                    }
                  }}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    if (!dropdownOpen) setDropdownOpen(true);
                  }}
                  style={{ ...inputStyle, width: "100%" }}
                />
                {form.studentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((p) => ({ ...p, studentId: "" }));
                      setStudentSearch("");
                      setDropdownOpen(true);
                    }}
                    style={{
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #fca5a5",
                      borderRadius: 6,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                    title="Clear student selection"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* Dropdown search results */}
              {dropdownOpen && (
                <>
                  <div
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 998,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                      maxHeight: 220,
                      overflowY: "auto",
                      zIndex: 999,
                    }}
                  >
                    {students
                      .filter((s) => {
                        const q = studentSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          s.name?.toLowerCase().includes(q) ||
                          s.admissionNumber?.toLowerCase().includes(q) ||
                          s.class?.className?.toLowerCase().includes(q)
                        );
                      })
                      .map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setForm((p) => ({ ...p, studentId: s.id }));
                            setStudentSearch("");
                            setDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f3f4f6",
                            background: form.studentId === s.id ? "#eff6ff" : "#fff",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 13,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              form.studentId === s.id ? "#eff6ff" : "#fff")
                          }
                        >
                          <div>
                            <strong style={{ color: "#1f2937" }}>{s.name}</strong>
                            <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 12 }}>
                              ({s.class?.className})
                            </span>
                            {s.hasScholarship && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: 11,
                                  color: "#7c3aed",
                                  fontWeight: 600,
                                }}
                              >
                                🎓
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 11,
                              color: "#6b7280",
                              background: "#f3f4f6",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {s.admissionNumber}
                          </span>
                        </div>
                      ))}

                    {students.filter((s) => {
                      const q = studentSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        s.name?.toLowerCase().includes(q) ||
                        s.admissionNumber?.toLowerCase().includes(q) ||
                        s.class?.className?.toLowerCase().includes(q)
                      );
                    }).length === 0 && (
                      <div
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          color: "#9ca3af",
                          fontSize: 13,
                        }}
                      >
                        No students found matching "{studentSearch}"
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </FormField>

          {/* If Optional Fee mode: Select assigned optional fees */}
          {feeCategory === "OPTIONAL" && (
            <FormField
              label="Assigned Optional Fees"
              hint={
                assignLoading
                  ? "Loading assigned fees…"
                  : studentAssigns.length === 0 && form.studentId && form.termId
                    ? "No optional fees assigned to this student for this term"
                    : undefined
              }
            >
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                {studentAssigns.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid #f3f4f6", cursor: a.balance > 0 ? "pointer" : "not-allowed", opacity: a.balance > 0 ? 1 : 0.55 }}>
                    <input type="checkbox" disabled={assignLoading || a.balance <= 0} checked={form.optionalFeeAssignIds.includes(a.id)} onChange={(e) => setForm((p) => ({ ...p, optionalFeeAssignIds: e.target.checked ? [...p.optionalFeeAssignIds, a.id] : p.optionalFeeAssignIds.filter((id) => id !== a.id) }))} />
                    <span style={{ flex: 1 }}>{a.optionalFee.name}</span>
                    <span style={{ color: "#6b7280", fontSize: 12 }}>Balance: {fmt(a.balance)}</span>
                  </label>
                ))}
              </div>
            </FormField>
          )}

          {/* Optional Fee live balance hint */}
          {feeCategory === "OPTIONAL" && selectedAssigns.length > 0 && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 14,
                fontSize: 13,
              }}
            >
              {selectedAssigns.map((a) => <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}><strong>⚡ {a.optionalFee.name}</strong><span>Fee: {fmt(a.optionalFee.amount)} · Paid: {fmt(a.paid)} · Balance: <strong>{fmt(a.balance)}</strong></span></div>)}
              <div style={{ borderTop: "1px solid #fde68a", paddingTop: 7, marginTop: 7, color: "#78350f" }}>Selected fees outstanding: <strong>{fmt(optionalMax)}</strong></div>
            </div>
          )}

          {/* Tuition live balance hint */}
          {feeCategory === "TUITION" && selectedStudent && form.termId && (
            <div
              style={{
                background: selectedStudent.hasScholarship ? "#f5f3ff" : "#f9fafb",
                border: selectedStudent.hasScholarship ? "1px solid #ddd6fe" : "none",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 14,
                fontSize: 13,
              }}
            >
              {selectedStudent.hasScholarship && Number(selectedStudent.scholarshipValue) > 0 && (
                <div style={{ marginBottom: 6, color: "#7c3aed", fontWeight: 600 }}>
                  🎓 {selectedStudent.scholarshipType === "PERCENTAGE" ? `${selectedStudent.scholarshipValue}%` : fmt(selectedStudent.scholarshipValue)}{" "}
                  {selectedStudent.scholarshipTarget === "TOTAL" ? "Total Fee" : "Tuition"} Scholarship
                  {selectedStudent.scholarshipReason && ` (${selectedStudent.scholarshipReason})`}
                  <span style={{ color: "#6b7280", fontWeight: "normal", marginLeft: 8 }}>
                    (Standard Fee: {fmt(selectedStudent.class?.feeAmount)})
                  </span>
                </div>
              )}
              <span style={{ color: "#6b7280" }}>
                {selectedStudent.hasScholarship ? "Net school fee: " : "School fee: "}
              </span>
              <strong>{fmt(studentBreakdown.expectedSchoolFee)}</strong>
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

          <FormField
            label={`Amount Paid (₦)${feeCategory === 'OPTIONAL' && selectedAssigns.length ? ` — max ${fmt(optionalMax)}` : ''}`}
          >
            <input
              type="number"
              min="0"
              max={feeCategory === "OPTIONAL" && selectedAssigns.length ? optionalMax : undefined}
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
            <ActionButton
              disabled={
                saving ||
                (feeCategory === "OPTIONAL" && (!form.optionalFeeAssignIds.length || studentAssigns.length === 0))
              }
              onClick={record}
            >
              {saving ? "Recording…" : "Record & Notify"}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
