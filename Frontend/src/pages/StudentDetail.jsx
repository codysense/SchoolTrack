import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Spinner, ErrorMessage, Badge } from "../components/ui";

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/students/${id}`)
      .then(setStudent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (error)
    return <ErrorMessage message={error} onRetry={() => navigate(0)} />;
  if (!student) return null;

  // Group payments by term
  const paymentsByTerm = {};
  for (const p of student.payments) {
    const label = p.term
      ? `${p.term.session?.name || ""} — ${p.term.name}`
      : "Unknown term";
    if (!paymentsByTerm[label]) paymentsByTerm[label] = [];
    paymentsByTerm[label].push(p);
  }

  // Group optional fee assignments by term
  const optByTerm = {};
  for (const a of student.optionalFeeAssigns) {
    const label = a.term
      ? `${a.term.session?.name || ""} — ${a.term.name}`
      : "Unknown term";
    if (!optByTerm[label]) optByTerm[label] = [];
    optByTerm[label].push(a);
  }

  // const allTermLabels = [
  //   ...new Set([...Object.keys(paymentsByTerm), ...Object.keys(optByTerm)]),
  // ].sort();
  const allTermLabels = [...new Set([...Object.keys(paymentsByTerm)])].sort();

  const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;
  const pct = Math.min(
    100,
    Math.round(
      (student.totalPaid /
        Math.max(student.class.feeAmount * allTermLabels.length, 1)) *
        100,
    ),
  );
  // console.log({ paymentsByTerm, optByTerm, allTermLabels, student });

  const expectedPayment =
    student.class.feeAmount * allTermLabels.length + student.optExpected;
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
            gap: 16,
            marginBottom: 20,
          }}
        >
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {student.name}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6b7280" }}>
              {student.class.className} · {student.admissionNumber}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
              {student.parentPhone}
            </p>
          </div>
        </div>

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
              label: "Expected Payment",
              value: fmt(expectedPayment),
            },
            {
              label: "Total Paid",
              value: fmt(student.totalPaid),
              color: "#10b981",
            },
            {
              label: "Balance",
              value: fmt(expectedPayment - student.totalPaid),
              color: student.balance > 0 ? "#f59e0b" : "#10b981",
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
                  margin: "3px 0 0",
                  fontWeight: 700,
                  fontSize: 16,
                  color: c.color || "#1a1f36",
                }}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>

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
      {allTermLabels.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            color: "#9ca3af",
          }}
        >
          No payment records yet for this student.
        </div>
      ) : (
        allTermLabels.map((termLabel) => {
          const termPayments = paymentsByTerm[termLabel] || [];
          const termOptional = optByTerm[termLabel] || [];
          const schoolPaid = termPayments.reduce((s, p) => s + p.amountPaid, 0);
          const optExpected = termOptional.reduce(
            (s, a) => s + a.optionalFee.amount,
            0,
          );
          const optPaid = termOptional.reduce(
            (s, a) => s + a.payments.reduce((sp, p) => sp + p.amountPaid, 0),
            0,
          );

          return (
            <div
              key={termLabel}
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                marginBottom: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a1f36",
                }}
              >
                📅 {termLabel}
              </h3>

              {/* School fee payments */}
              {termPayments.length > 0 && (
                <>
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
                    School Fee Payments
                  </p>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                      marginBottom: 14,
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
                            {new Date(p.date).toLocaleDateString()}
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
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #e5e7eb" }}>
                        <td
                          style={{
                            padding: "7px 12px",
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          Total paid
                        </td>
                        <td
                          style={{
                            padding: "7px 12px",
                            fontWeight: 700,
                            color: "#10b981",
                          }}
                        >
                          {fmt(schoolPaid)}
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            padding: "7px 12px",
                            color: "#6b7280",
                            fontSize: 12,
                          }}
                        >
                          Balance:{" "}
                          <strong
                            style={{
                              color:
                                student.class.feeAmount - schoolPaid > 0
                                  ? "#f59e0b"
                                  : "#10b981",
                            }}
                          >
                            {fmt(student.class.feeAmount - schoolPaid)}
                          </strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}

              {/* Optional fees */}
              {termOptional.length > 0 && (
                <>
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
                    Optional Fees
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
                        {["Fee", "Amount", "Paid", "Balance"].map((h) => (
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
                      {termOptional.map((a) => {
                        const paid = a.payments.reduce(
                          (s, p) => s + p.amountPaid,
                          0,
                        );
                        const balance = a.optionalFee.amount - paid;
                        return (
                          <tr
                            key={a.id}
                            style={{ borderTop: "1px solid #f3f4f6" }}
                          >
                            <td style={{ padding: "7px 12px" }}>
                              {a.optionalFee.name}
                            </td>
                            <td style={{ padding: "7px 12px" }}>
                              {fmt(a.optionalFee.amount)}
                            </td>
                            <td
                              style={{
                                padding: "7px 12px",
                                color: "#10b981",
                                fontWeight: 600,
                              }}
                            >
                              {fmt(paid)}
                            </td>
                            <td style={{ padding: "7px 12px" }}>
                              <Badge
                                label={fmt(balance)}
                                color={balance <= 0 ? "green" : "yellow"}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #e5e7eb" }}>
                        <td
                          style={{
                            padding: "7px 12px",
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          Total
                        </td>
                        <td style={{ padding: "7px 12px", fontWeight: 700 }}>
                          {fmt(optExpected)}
                        </td>
                        <td
                          style={{
                            padding: "7px 12px",
                            fontWeight: 700,
                            color: "#10b981",
                          }}
                        >
                          {fmt(optPaid)}
                        </td>
                        <td style={{ padding: "7px 12px" }}>
                          <Badge
                            label={fmt(optExpected - optPaid)}
                            color={
                              optExpected - optPaid <= 0 ? "green" : "yellow"
                            }
                          />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}

              {termPayments.length === 0 && termOptional.length === 0 && (
                <p style={{ color: "#9ca3af", fontSize: 13 }}>
                  No records for this term.
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
