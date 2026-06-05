import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Spinner, ErrorMessage } from "../components/ui";
import { getOrdinal } from "./Results";
// import PayButton from "../components/PayButton";

function gradeHex(g) {
  return (
    { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" }[
      g
    ] || "#6b7280"
  );
}

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTerm, setActiveTerm] = useState(null); // term summary object from /me
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [school, setSchool] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/portal/me"),
      fetch("/api/portal/school-info")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([p, s]) => {
        setProfile(p);
        setSchool(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  console.log({ profile, school });

  const contactSchool = () => {
    const phone = school?.phone?.replace(/\D/g, ""); // Remove non-digit characters

    const message = `
Hello,

I would like to chat with you regarding my child's result/payment.

Student: ${profile?.name}
Admission No: ${profile?.admissionNumber}
Class: ${profile?.className}

Lets discuss the details here.

Thank you.
`.trim();

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const selectTerm = async (termData) => {
    setActiveTerm(termData);
    setResults(null);
    setLoadingResults(true);
    try {
      const r = await api(`/portal/results?termId=${termData.termId}`);
      setResults(r);

      console.log({ r });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingResults(false);
    }
  };

  const printResult = () => {
    if (!results || !activeTerm || !profile) return;
    const w = window.open("", "_blank");

    const rows = results.subjects
      .map(
        (r) => `
      <tr>
        <td>${r.subject}</td>
        <td style="text-align:center;font-weight:600">${r.testScore}</td>
        <td style="text-align:center;font-weight:600">${r.examScore}</td>
        <td style="text-align:center;font-weight:600">${r.TotalScore}</td>
        <td style="text-align:center;color:${gradeHex(r.grade)};font-weight:700">${r.grade}</td>
         <td style="text-align:center;font-weight:600">${getOrdinal(r.subjectPosition)}</td>
        <td style="color:#6b7280">${r.remark}</td>
      </tr>
    `,
      )
      .join("");

    const logoHtml = school?.logoUrl
      ? `<img src="${school.logoUrl}" style="height:64px;object-fit:contain;margin-bottom:6px"/>`
      : '<div style="font-size:48px;line-height:1">🏫</div>';

    w.document.write(`<!DOCTYPE html><html><head>
      <title>Report Card — ${profile.name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family:Roboto, sans-serif; max-width: 720px; margin: 40px auto; color: #1a1f36; padding: 20px; }
        .header { text-align: center; border-bottom: 3px double #1a1f36; padding-bottom: 18px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; margin: 6px 0 3px; }
        .header .sub { font-size: 13px; color: #6b7280; margin: 2px 0; }
        .header .badge { font-size: 15px; font-weight: bold; margin-top: 12px; text-transform: uppercase; letter-spacing: .06em; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
        .info div { border: 1px solid #e5e7eb; padding: 8px 12px; border-radius: 6px; }
        .info span { font-size: 10px; color: #9ca3af; display: block; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
        .paid-stamp { display: inline-block; border: 2px solid #10b981; color: #10b981; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: .06em; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { background: #f9fafb; padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #e5e7eb; }
        td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; }
        .summary { margin-top: 20px; display: flex; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .summary div { flex: 1; padding: 14px; text-align: center; border-right: 1px solid #e5e7eb; }
        .summary div:last-child { border-right: none; }
        .summary .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px; }
        .summary .val { font-size: 22px; font-weight: 700; }
        .sigs { margin-top: 52px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; }
        .sig { border-top: 1px solid #1a1f36; padding-top: 6px; font-size: 12px; color: #6b7280; }
        @media print { body { margin: 10px; } }
      </style>
    </head><body>
      <div class="header">
        ${logoHtml}
        <h1>${school?.name || "School Name"}</h1>
        ${school?.address ? `<p class="sub">${school.address}</p>` : ""}
        ${school?.phone ? `<p class="sub">${school.phone}</p>` : ""}
        ${school?.motto ? `<p class="sub" style="font-style:italic;margin-top:4px">"${school.motto}"</p>` : ""}
        <div class="badge">Student Academic Report</div>
      </div>

      <div class="info">
        <div><span>Student Name</span>${profile.name}</div>
        <div><span>Admission No.</span>${profile.admissionNumber}</div>
        <div><span>Class</span>${profile.className}</div>
        <div><span>Term</span>${activeTerm.termLabel}</div>
        <div><span>Subjects</span>${results.subjects.length}</div>
        <div><span>Date Issued</span>${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div style="margin-bottom:16px"><span class="paid-stamp">✓ FEES FULLY PAID</span></div>

      <table>
        <thead><tr><th>Subject</th><th style="text-align:center">Test Score</th><th style="text-align:center">Exam Score</th><th style="text-align:center">Total Score</th><th style="text-align:center">Grade</th><th style="text-align:center">Subject Position</th><th>Remark</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary">
        <div><div class="label">Total Score</div><div class="val">${results.summary.totalScore}</div></div>
        <div><div class="label">Average</div><div class="val">${results.summary.average}%</div></div>
        <div><div class="label">Final Grade</div><div class="val" style="color:${gradeHex(results.summary.finalGrade)}">${results.summary.finalGrade}</div></div>
        <div><div class="label">Student Position</div><div class="val">${getOrdinal(results.summary.position)}</div></div>
      </div>

      <div class="sigs">
        <div class="sig">Class Teacher</div>
        <div class="sig">Head of Department</div>
        <div class="sig">Principal / Head Teacher</div>
      </div>
      <script>window.onload = () => window.print()</script>
    </body></html>`);
    w.document.close();
  };

  const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f6fa",
        }}
      >
        <Spinner />
      </div>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6fa",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Topbar */}
      <div
        style={{
          background: "#1a1f36",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{ color: "#fff", margin: 0, fontSize: 15, fontWeight: 700 }}
          >
            🏫 Student Portal
          </h1>
          <p style={{ color: "#8891b4", margin: "2px 0 0", fontSize: 12 }}>
            {school?.name || "SchoolMgmt"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                color: "#fff",
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {user?.name}
            </p>
            <p style={{ color: "#8891b4", margin: 0, fontSize: 11 }}>
              {user?.admissionNumber}
            </p>
          </div>
          <button
            onClick={logout}
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.15)",
              color: "#8891b4",
              padding: "6px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
        <ErrorMessage message={error} />

        {profile && (
          <>
            {/* Profile card */}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                marginBottom: 22,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#eff6ff",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </div>

                <div>
                  <h2 style={{ margin: 0, fontSize: 17 }}>{profile.name}</h2>

                  <p
                    style={{
                      margin: "3px 0 0",
                      color: "#6b7280",
                      fontSize: 13,
                    }}
                  >
                    {profile.className} · {profile.admissionNumber}
                  </p>
                </div>
              </div>

              <button
                onClick={contactSchool}
                style={{
                  background: "#25D366",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  onfocus: {
                    outline: "2px solid #25D366",
                    outlineOffset: "2px",
                  },
                }}
              >
                💬 Contact Us
              </button>
            </div>

            {/* Term cards */}
            {profile.terms.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 48,
                  textAlign: "center",
                  color: "#9ca3af",
                }}
              >
                No payment records found. Please contact your school admin.
              </div>
            ) : (
              <>
                <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>
                  Your Fee Records
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 14,
                    marginBottom: 24,
                  }}
                >
                  {profile.terms.map((t) => (
                    <div
                      key={t.termId}
                      onClick={() => selectTerm(t)}
                      style={{
                        background: "#fff",
                        borderRadius: 12,
                        padding: 20,
                        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                        cursor: "pointer",
                        border:
                          activeTerm?.termId === t.termId
                            ? "2px solid #4f8ef7"
                            : "2px solid transparent",
                        transition: "border .15s, box-shadow .15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 4px 12px rgba(0,0,0,.1)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 1px 4px rgba(0,0,0,.06)")
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <p
                            style={{ margin: 0, fontWeight: 700, fontSize: 14 }}
                          >
                            {t.termName}
                          </p>
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: 12,
                              color: "#9ca3af",
                            }}
                          >
                            {t.sessionName}
                          </p>
                        </div>
                        <span
                          style={{
                            background: t.fullyPaid ? "#d1fae5" : "#fef3c7",
                            color: t.fullyPaid ? "#065f46" : "#92400e",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 12,
                          }}
                        >
                          {t.fullyPaid ? "✓ PAID" : "OWING"}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          fontSize: 13,
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <p
                            style={{
                              margin: 0,
                              color: "#9ca3af",
                              fontSize: 11,
                            }}
                          >
                            School Fee
                          </p>
                          <p style={{ margin: "2px 0 0", fontWeight: 600 }}>
                            {fmt(t.schoolFee)}
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              margin: 0,
                              color: "#9ca3af",
                              fontSize: 11,
                            }}
                          >
                            School Paid
                          </p>
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontWeight: 600,
                              color: "#10b981",
                            }}
                          >
                            {fmt(t.schoolPaid)}
                          </p>
                        </div>
                        {t.optExpected > 0 && (
                          <>
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  color: "#9ca3af",
                                  fontSize: 11,
                                }}
                              >
                                Other Fees
                              </p>
                              <p style={{ margin: "2px 0 0", fontWeight: 600 }}>
                                {fmt(t.optExpected)}
                              </p>
                            </div>
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  color: "#9ca3af",
                                  fontSize: 11,
                                }}
                              >
                                Other Paid
                              </p>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontWeight: 600,
                                  color: "#10b981",
                                }}
                              >
                                {fmt(t.optPaid)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          paddingTop: 10,
                          borderTop: "1px solid #f3f4f6",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          Balance
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color: t.totalBalance <= 0 ? "#10b981" : "#f59e0b",
                          }}
                        >
                          {fmt(t.totalBalance)}
                        </span>
                      </div>

                      {/* Progress */}
                      <div style={{ marginTop: 10 }}>
                        <div
                          style={{
                            background: "#f3f4f6",
                            borderRadius: 4,
                            height: 5,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, t.totalFee > 0 ? (t.totalPaid / t.totalFee) * 100 : 0)}%`,
                              height: "100%",
                              borderRadius: 4,
                              background: t.fullyPaid ? "#10b981" : "#4f8ef7",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        {/* <PayButton
                          disabled={t.totalBalance <= 0}
                          email={profile.email}
                          amount={t.totalBalance > 0 ? t.totalBalance : 0}
                          studentId={profile.studentId}
                        /> */}
                      </div>

                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: 12,
                          color: "#4f8ef7",
                          textAlign: "center",
                        }}
                      >
                        Click to view results →
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Results panel */}
            {activeTerm && (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                }}
              >
                {/* <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {activeTerm.termLabel} — Results
                    </h3>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 13,
                        color: "#6b7280",
                      }}
                    >
                      {profile.className}
                    </p>
                  </div>
                </div> */}

                {loadingResults ? (
                  <Spinner size={24} />
                ) : (
                  results && (
                    <>
                      {/* NOT FULLY PAID → SHOW ONLY WARNING */}
                      {!results.fullyPaid ? (
                        <div
                          style={{
                            background: "#fef3c7",
                            border: "1px solid #fcd34d",
                            borderRadius: 8,
                            padding: "16px",
                            marginBottom: 16,
                            fontSize: 14,
                            textAlign: "center",
                          }}
                        >
                          <strong>
                            ⚠ Outstanding Balance: {fmt(results.totalBalance)}
                          </strong>
                          <p style={{ margin: "6px 0 0", color: "#92400e" }}>
                            Your results are not visible until all fees are
                            fully paid.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* FULLY PAID → SHOW RESULTS */}

                          {results.subjects.length === 0 ? (
                            <p
                              style={{
                                color: "#9ca3af",
                                textAlign: "center",
                                padding: "24px 0",
                              }}
                            >
                              No results have been entered for this term yet.
                            </p>
                          ) : (
                            <>
                              {/* Print Button */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: 12,
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
                                <div>
                                  <h3 style={{ margin: 0 }}>
                                    {activeTerm.termLabel} — Results
                                  </h3>
                                  <p
                                    style={{
                                      margin: "3px 0 0",
                                      fontSize: 13,
                                      color: "#6b7280",
                                    }}
                                  >
                                    {profile.className}
                                  </p>
                                </div>

                                <button
                                  onClick={printResult}
                                  style={{
                                    background: "#4f8ef7",
                                    color: "#fff",
                                    border: "none",
                                    padding: "8px 16px",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: 14,
                                  }}
                                >
                                  🖨 Print Result
                                </button>
                              </div>

                              {/* TABLE */}
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
                                      "Subject",
                                      "Test Score",
                                      "Exam Score",
                                      "Total Score",
                                      "Position",
                                      "Grade",
                                      "Remark",
                                    ].map((h) => (
                                      <th
                                        key={h}
                                        style={{
                                          padding: "9px 14px",
                                          textAlign: "left",
                                          fontSize: 13,
                                          fontWeight: 600,
                                          color: "#374151",
                                        }}
                                      >
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>

                                <tbody>
                                  {results.subjects.map((r) => (
                                    <tr
                                      key={r.id}
                                      style={{ borderTop: "1px solid #f3f4f6" }}
                                    >
                                      <td style={{ padding: "9px 14px" }}>
                                        {r.subject}
                                      </td>

                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {r.testScore}
                                      </td>

                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {r.examScore}
                                      </td>

                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {r.TotalScore}
                                      </td>

                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {getOrdinal(r.subjectPosition)}
                                      </td>

                                      <td style={{ padding: "9px 14px" }}>
                                        <span
                                          style={{
                                            color: gradeHex(r.grade),
                                            fontWeight: 700,
                                            fontSize: 15,
                                          }}
                                        >
                                          {r.grade}
                                        </span>
                                      </td>

                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          color: "#6b7280",
                                          fontSize: 13,
                                        }}
                                      >
                                        {r.remark}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {/* SUMMARY */}
                              <div
                                style={{
                                  marginTop: 14,
                                  padding: "11px 14px",
                                  background: "#f9fafb",
                                  borderRadius: 8,
                                  display: "flex",
                                  gap: 28,
                                  fontSize: 14,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span>
                                  Total:{" "}
                                  <strong>{results.summary.totalScore}</strong>
                                </span>

                                <span>
                                  Average:{" "}
                                  <strong>{results.summary.average}%</strong>
                                </span>

                                <span>
                                  Grade:{" "}
                                  <strong
                                    style={{
                                      color: gradeHex(
                                        results.summary.finalGrade,
                                      ),
                                    }}
                                  >
                                    {results.summary.finalGrade}
                                  </strong>
                                </span>

                                <span>
                                  Class Position:{" "}
                                  <strong>
                                    {getOrdinal(results.summary.position)}
                                  </strong>
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
