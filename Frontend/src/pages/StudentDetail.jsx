import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Spinner, ErrorMessage, Badge, ActionButton } from "../components/ui";

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api(`/students/${id}`),
      api("/setup/school").catch(() => null),
    ])
      .then(([st, sch]) => {
        setStudent(st);
        setSchool(sch);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (error)
    return <ErrorMessage message={error} onRetry={() => navigate(0)} />;
  if (!student) return null;

  const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

  const expectedPayment = student.totalFee || student.expectedPayment || 0;
  const totalPaid = student.totalPaid || 0;
  const balance = student.balance ?? expectedPayment - totalPaid;
  const pct = Math.min(
    100,
    Math.round((totalPaid / Math.max(expectedPayment, 1)) * 100),
  );

  const printTermBill = (term) => {
    if (!student || !term) return;

    const schoolPayments = term.schoolPayments || [];
    const optAssigns = term.optAssigns || [];
    const optionalPayments = optAssigns.flatMap((a) =>
      (a.payments || []).map((p) => ({
        ...p,
        feeName: a.name,
        feeAmount: a.amount,
      })),
    );

    const schoolFeeRows = schoolPayments.length
      ? schoolPayments
          .map(
            (p, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${new Date(p.date || p.createdAt).toLocaleDateString("en-GB")}</td>
          <td>${p.paymentMethod || "-"}</td>
          <td style="text-align:left">
            ₦${Number(p.amountPaid).toLocaleString()}
          </td>
          <td>${p.note || "-"}</td>
        </tr>
      `,
          )
          .join("")
      : `
      <tr>
        <td colspan="5" style="text-align:center;color:#6b7280">
          No school fee payment records found for this term
        </td>
      </tr>
    `;

    const assignedOptionalFeeRows = optAssigns.length
      ? optAssigns
          .map(
            (f, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${f.name}</strong>${f.description ? `<br><small style="color:#6b7280">${f.description}</small>` : ""}</td>
          <td style="text-align:left">₦${Number(f.amount || 0).toLocaleString()}</td>
          <td style="text-align:left;color:#10b981">₦${Number(f.paid || 0).toLocaleString()}</td>
          <td style="text-align:left;color:${f.balance > 0 ? "#f59e0b" : "#10b981"};font-weight:600">
            ₦${Number(f.balance || 0).toLocaleString()}
          </td>
        </tr>
      `,
          )
          .join("")
      : `
      <tr>
        <td colspan="5" style="text-align:center;color:#6b7280">
          No optional fees assigned for this term
        </td>
      </tr>
    `;

    const optionalFeeRows = optionalPayments.length
      ? optionalPayments
          .map(
            (p, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${p.feeName || "-"}</td>
          <td style="text-align:left">
            ₦${Number(p.feeAmount || 0).toLocaleString()}
          </td>
          <td>${new Date(p.date || p.createdAt).toLocaleDateString("en-GB")}</td>
          <td>${p.paymentMethod || "-"}</td>
          <td style="text-align:left">
            ₦${Number(p.amountPaid).toLocaleString()}
          </td>
        </tr>
      `,
          )
          .join("")
      : `
      <tr>
        <td colspan="6" style="text-align:center;color:#6b7280">
          No optional fee payment records found for this term
        </td>
      </tr>
    `;

    const logoHtml = school?.logoUrl
      ? `<img src="${school.logoUrl}" style="height:64px;object-fit:contain;margin-bottom:6px"/>`
      : `<div style="font-size:48px;">🏫</div>`;

    const w = window.open("", "_blank");

    w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Statement of Account — ${student.name}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Roboto','Open Sans',sans-serif;max-width:950px;margin:30px auto;padding:20px;color:#1a1f36;}
        .header{text-align:center;border-bottom:3px double #111827;padding-bottom:18px;margin-bottom:25px;}
        .header h1{font-size:24px;margin:6px 0;}
        .sub{color:#6b7280;font-size:13px;margin:2px 0;}
        .title{margin-top:12px;font-size:17px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;}
        .student-info{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;}
        .student-info div{border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;}
        .student-info span{display:block;font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px;}
        .section-title{margin:30px 0 12px;font-size:16px;font-weight:700;color:#111827;}
        table{width:100%;border-collapse:collapse;margin-bottom:20px;}
        th{background:#f9fafb;padding:10px;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e7eb;text-align:left;}
        td{padding:10px;border-bottom:1px solid #f3f4f6;font-size:14px;}
        .summary{margin-top:30px;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}
        .summary div{padding:16px;text-align:center;border-right:1px solid #e5e7eb;}
        .summary div:last-child{border-right:none;}
        .summary .label{font-size:11px;color:#9ca3af;text-transform:uppercase;margin-bottom:5px;}
        .summary .val{font-size:22px;font-weight:700;}
        .green{color:#16a34a;}
        .red{color:#dc2626;}
        .footer{margin-top:45px;border-top:2px dashed #d1d5db;padding-top:20px;}
        .bank-box{background:#f9fafb;border-radius:8px;padding:16px;line-height:1.9;font-size:14px;}
        .signatures{margin-top:55px;display:flex;justify-content:space-between;gap:40px;}
        .sign{flex:1;border-top:1px solid #111827;padding-top:8px;text-align:center;font-size:12px;color:#6b7280;}
        @media print{body{margin:10px;}}
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHtml}
        <h1>${school?.name || "School Name"}</h1>
        ${school?.address ? `<p class="sub">${school.address}</p>` : ""}
        ${school?.phone ? `<p class="sub">${school.phone}</p>` : ""}
        ${school?.motto ? `<p class="sub"><i>"${school.motto}"</i></p>` : ""}
        <div class="title">Student Statement of Account</div>
      </div>

      <div class="student-info">
        <div><span>Student Name</span>${student.name}</div>
        <div><span>Admission Number</span>${student.admissionNumber}</div>
        <div><span>Class</span>${student.class?.className || "-"}</div>
        <div><span>Session / Term</span>${term.termLabel}</div>
        <div><span>Date Generated</span>${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
        <div><span>Parent Phone</span>${student.parentPhone || "-"}</div>
        ${
          term.hasScholarship
            ? `
        <div style="grid-column:1 / -1; background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9;">
          <span>Scholarship / Fee Concession</span>
          <strong>🎓 ${term.scholarshipType === "PERCENTAGE" ? `${term.scholarshipValue}%` : `₦${Number(term.scholarshipValue).toLocaleString()}`} ${term.scholarshipTarget === "TOTAL" ? "Total Fees" : "Tuition"} Scholarship</strong>
          ${term.scholarshipReason ? ` <i>(${term.scholarshipReason})</i>` : ""} — 
          Standard Tuition: ₦${Number(term.baseSchoolFee || 0).toLocaleString()} | Discount: -₦${Number(term.totalDiscount || 0).toLocaleString()} | Net Expected: ₦${Number(term.schoolFee).toLocaleString()}
        </div>`
            : ""
        }
      </div>

      <div class="section-title">Assigned Optional Fees Breakdown (Bill Items)</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Optional Fee Item</th>
            <th>Amount (₦)</th>
            <th>Amount Paid (₦)</th>
            <th>Remaining Balance (₦)</th>
          </tr>
        </thead>
        <tbody>
          ${assignedOptionalFeeRows}
        </tbody>
      </table>

      <div class="section-title">School Fees Payment History</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Payment Method</th>
            <th>Amount Paid</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          ${schoolFeeRows}
        </tbody>
      </table>

      <div class="section-title">Optional Fees Payment History</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Fee Name</th>
            <th>Expected</th>
            <th>Date</th>
            <th>Method</th>
            <th>Amount Paid</th>
          </tr>
        </thead>
        <tbody>
          ${optionalFeeRows}
        </tbody>
      </table>

      <div class="summary">
        <div>
          <div class="label">School Fees Balance</div>
          <div class="val ${term.schoolBalance > 0 ? "red" : "green"}">₦${term.schoolBalance.toLocaleString()}</div>
        </div>
        <div>
          <div class="label">Optional Fees Balance</div>
          <div class="val ${term.optBalance > 0 ? "red" : "green"}">₦${term.optBalance.toLocaleString()}</div>
        </div>
        <div>
          <div class="label">Total Paid (This Term)</div>
          <div class="val green">₦${term.totalPaid.toLocaleString()}</div>
        </div>
        <div>
          <div class="label">Outstanding Balance</div>
          <div class="val ${term.totalBalance > 0 ? "red" : "green"}">₦${term.totalBalance.toLocaleString()}</div>
        </div>
      </div>

      <div class="footer">
        <h3 style="margin-bottom:10px;">School Bank Details</h3>
        <div class="bank-box">
          Bank Name: <strong>${school?.bankName || "-"}</strong> <br/>
          Account Name: <strong>${school?.accountName || "-"}</strong> <br/>
          Account Number: <strong>${school?.accountNumber || "-"}</strong> <br/>
        </div>
        <div class="signatures">
          <div class="sign">Bursar / Accounts Officer</div>
          <div class="sign">Principal / Administrator Stamp</div>
        </div>
      </div>

      <script>
        window.onload = () => window.print();
      </script>
    </body>
    </html>
    `);

    w.document.close();
  };

  const terms = student.terms || [];

  return (
    <div>
      <button
        onClick={() => navigate("/students")}
        style={{
          background: "none",
          border: "none",
          color: "#4f8ef7",
          cursor: "pointer",
          fontSize: 14,
          marginBottom: 20,
          padding: 0,
        }}
      >
        ← Back to Students
      </button>

      {/* Profile card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {student.name}
                </h2>
                <Badge
                  label={student.status || (student.isActive ? "ACTIVE" : "INACTIVE")}
                  color={student.status === "ACTIVE" || student.isActive ? "green" : "gray"}
                />
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6b7280" }}>
                {student.class?.className} · {student.admissionNumber}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
                📞 {student.parentPhone}
              </p>
            </div>
          </div>
          {terms.length > 0 && (
            <ActionButton
              onClick={() => printTermBill(terms[0])}
              variant="secondary"
            >
              🖨 Print Current Statement / Bill
            </ActionButton>
          )}
        </div>

        {/* Lifetime / Cumulative Stats across all terms */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            fontSize: 13,
          }}
        >
          {[
            {
              label: "Expected Payment (All Terms)",
              value: fmt(expectedPayment),
              sub: `Tuition: ${fmt(student.schoolFee)} | Optional: ${fmt(student.optExpected)}`,
            },
            {
              label: "Total Paid (All Terms)",
              value: fmt(totalPaid),
              color: "#10b981",
              sub: `Tuition: ${fmt(student.schoolPaid)} | Optional: ${fmt(student.optPaid)}`,
            },
            {
              label: "Total Outstanding Balance",
              value: fmt(balance),
              color: balance > 0 ? "#f59e0b" : "#10b981",
              sub: `Tuition Bal: ${fmt(student.schoolFeeBalance)} | Opt Bal: ${fmt(student.optFeeBalance)}`,
            },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                padding: "12px 14px",
                background: "#f9fafb",
                borderRadius: 8,
              }}
            >
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 11 }}>
                {c.label}
              </p>
              <p
                style={{
                  margin: "3px 0 2px",
                  fontWeight: 700,
                  fontSize: 16,
                  color: c.color || "#1a1f36",
                }}
              >
                {c.value}
              </p>
              {c.sub && (
                <p style={{ margin: 0, color: "#6b7280", fontSize: 11 }}>
                  {c.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Scholarship Banner */}
        {student.hasScholarship && Number(student.scholarshipValue) > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "#f5f3ff",
              border: "1px solid #ddd6fe",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🎓</span>
              <div>
                <strong style={{ color: "#6d28d9" }}>
                  {student.scholarshipType === "PERCENTAGE"
                    ? `${student.scholarshipValue}%`
                    : fmt(student.scholarshipValue)}{" "}
                  {student.scholarshipTarget === "TOTAL"
                    ? "Total Fees"
                    : "Tuition (School Fees)"}{" "}
                  Scholarship
                </strong>
                {student.scholarshipReason && (
                  <span style={{ color: "#7c3aed", marginLeft: 6 }}>
                    ({student.scholarshipReason})
                  </span>
                )}
              </div>
            </div>
            <div style={{ color: "#6d28d9", fontSize: 12 }}>
              Standard Class Fee: {fmt(student.class?.feeAmount)}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 5,
            }}
          >
            <span>Overall fee payment progress</span>
            <span>{pct}%</span>
          </div>
          <div
            style={{
              background: "#f3f4f6",
              borderRadius: 6,
              height: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 6,
                background:
                  pct >= 100 ? "#10b981" : pct >= 50 ? "#4f8ef7" : "#f59e0b",
                transition: "width .4s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Per-term breakdown */}
      {terms.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            color: "#9ca3af",
          }}
        >
          No terms or payment records found for this student.
        </div>
      ) : (
        terms.map((t) => {
          const termPayments = t.schoolPayments || [];
          const optAssigns = t.optAssigns || [];
          const optPayments = optAssigns.flatMap((a) =>
            (a.payments || []).map((p) => ({
              ...p,
              feeName: a.name,
              feeAmount: a.amount,
            })),
          );

          return (
            <div
              key={t.termId}
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                marginBottom: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                borderLeft: t.isCurrent ? "5px solid #2563eb" : "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1a1f36",
                    }}
                  >
                    📅 {t.termLabel}
                  </h3>
                  {t.isCurrent && (
                    <Badge label="⚡ Current Term" color="blue" />
                  )}
                </div>
                <ActionButton
                  size="sm"
                  variant="secondary"
                  onClick={() => printTermBill(t)}
                >
                  🖨 Print Statement / Bill
                </ActionButton>
              </div>

              {/* Term Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    background: "#f9fafb",
                    padding: "10px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#9ca3af", display: "block" }}>
                    Tuition Fees
                  </span>
                  <strong>Expected: {fmt(t.schoolFee)}</strong>
                  <div style={{ color: "#10b981", marginTop: 2 }}>
                    Paid: {fmt(t.schoolPaid)}
                  </div>
                  <div style={{ color: t.schoolBalance > 0 ? "#f59e0b" : "#10b981" }}>
                    Balance: {fmt(t.schoolBalance)}
                  </div>
                </div>

                <div
                  style={{
                    background: "#f9fafb",
                    padding: "10px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#9ca3af", display: "block" }}>
                    Optional Fees ({optAssigns.length} assigned)
                  </span>
                  <strong>Expected: {fmt(t.optExpected)}</strong>
                  <div style={{ color: "#10b981", marginTop: 2 }}>
                    Paid: {fmt(t.optPaid)}
                  </div>
                  <div style={{ color: t.optBalance > 0 ? "#f59e0b" : "#10b981" }}>
                    Balance: {fmt(t.optBalance)}
                  </div>
                </div>

                <div
                  style={{
                    background: t.totalBalance > 0 ? "#fffbeb" : "#ecfdf5",
                    border: `1px solid ${t.totalBalance > 0 ? "#fde68a" : "#a7f3d0"}`,
                    padding: "10px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#6b7280", display: "block" }}>
                    Term Net Total
                  </span>
                  <strong>Total Expected: {fmt(t.totalFee)}</strong>
                  <div style={{ color: "#10b981", marginTop: 2 }}>
                    Total Paid: {fmt(t.totalPaid)}
                  </div>
                  <div
                    style={{
                      color: t.totalBalance > 0 ? "#b45309" : "#065f46",
                      fontWeight: 700,
                    }}
                  >
                    Outstanding: {fmt(t.totalBalance)}
                  </div>
                </div>
              </div>

              {/* Assigned Optional Fees (Bill Items) */}
              <div style={{ marginBottom: 16 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}
                >
                  ⚡ Assigned Optional Fees ({optAssigns.length})
                </p>
                {optAssigns.length > 0 ? (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                      marginBottom: 10,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["Fee Name", "Amount", "Paid", "Balance"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "7px 12px",
                              textAlign: "left",
                              fontWeight: 600,
                              fontSize: 12,
                              color: "#374151",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {optAssigns.map((a) => (
                        <tr
                          key={a.id}
                          style={{ borderTop: "1px solid #f3f4f6" }}
                        >
                          <td style={{ padding: "7px 12px" }}>
                            <strong>{a.name}</strong>
                            {a.description && (
                              <span style={{ display: "block", color: "#6b7280", fontSize: 11 }}>
                                {a.description}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "7px 12px" }}>
                            {fmt(a.amount)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              color: "#10b981",
                              fontWeight: 600,
                            }}
                          >
                            {fmt(a.paid)}
                          </td>
                          <td style={{ padding: "7px 12px" }}>
                            <Badge
                              label={fmt(a.balance)}
                              color={a.balance <= 0 ? "green" : "yellow"}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 10px" }}>
                    No optional fees assigned for this term.
                  </p>
                )}
              </div>

              {/* School fee payments */}
              <div style={{ marginBottom: 16 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}
                >
                  🎓 Tuition / School Fee Payments ({termPayments.length})
                </p>
                {termPayments.length > 0 ? (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["Date", "Amount", "Method", "Note"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "7px 12px",
                              textAlign: "left",
                              fontWeight: 600,
                              fontSize: 12,
                              color: "#374151",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {termPayments.map((p) => (
                        <tr
                          key={p.id}
                          style={{ borderTop: "1px solid #f3f4f6" }}
                        >
                          <td style={{ padding: "7px 12px", color: "#6b7280" }}>
                            {new Date(p.date || p.createdAt).toLocaleDateString()}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              fontWeight: 600,
                              color: "#10b981",
                            }}
                          >
                            {fmt(p.amountPaid)}
                          </td>
                          <td style={{ padding: "7px 12px" }}>
                            <Badge label={p.paymentMethod} color="blue" />
                          </td>
                          <td style={{ padding: "7px 12px", color: "#9ca3af" }}>
                            {p.note || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 10px" }}>
                    No school fee payments recorded yet for this term.
                  </p>
                )}
              </div>

              {/* Optional fee payment history */}
              {optPayments.length > 0 && (
                <div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                    }}
                  >
                    ⚡ Optional Fee Payments Receipts ({optPayments.length})
                  </p>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["Date", "Fee Name", "Amount Paid", "Method"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "7px 12px",
                              textAlign: "left",
                              fontWeight: 600,
                              fontSize: 12,
                              color: "#374151",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {optPayments.map((p) => (
                        <tr
                          key={p.id}
                          style={{ borderTop: "1px solid #f3f4f6" }}
                        >
                          <td style={{ padding: "7px 12px", color: "#6b7280" }}>
                            {new Date(p.date || p.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "7px 12px", fontWeight: 600 }}>
                            {p.feeName}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              fontWeight: 600,
                              color: "#10b981",
                            }}
                          >
                            {fmt(p.amountPaid)}
                          </td>
                          <td style={{ padding: "7px 12px" }}>
                            <Badge label={p.paymentMethod} color="blue" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

