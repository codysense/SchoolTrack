import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTerm } from "../context/TermContext";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import {
  Spinner,
  ErrorMessage,
  Badge,
  ActionButton,
  FormField,
  inputStyle,
} from "../components/ui";

function gradeColor(g) {
  return (
    { A: "green", B: "blue", C: "yellow", D: "yellow", F: "red" }[g] || "gray"
  );
}

export function getOrdinal(n) {
  if (!n) return "-";

  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;

  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function gradeHex(g) {
  return (
    { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" }[
      g
    ] || "#6b7280"
  );
}

const cellInput = {
  width: 65,
  padding: "4px 6px",
  fontSize: 13,
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  outline: "none",
  background: "#fff",
  transition: "all 0.15s ease",
};

export default function Results() {
  const { currentTerm, sessions } = useTerm();
  const { user } = useAuth();
  const [sheet, setSheet] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [modal, setModal] = useState(false);
  const [scoreForm, setScore] = useState({ subjectId: "", score: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState(null);
  const [focused, setFocused] = useState(null);
  const [attendance, setAttendance] = useState({
    schoolOpened: "",
    present: "",
    punctual: "",
  });

  const [behaviour, setBehaviour] = useState([]);
  const [psychomotor, setPsychomotor] = useState([]);
  const [sports, setSports] = useState([]);
  const [clubs, setClubs] = useState([]);

  const [comments, setComments] = useState({
    teacher: "",
    principal: "",
  });

  const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace("/api", "");

  const getMediaUrl = (value) =>
    value?.startsWith("http") ? value : `${API_BASE}${value}`;

  // Flatten all terms
  const allTerms = sessions.flatMap((s) =>
    s.terms.map((t) => ({
      ...t,
      sessionName: s.name,
      label: `${s.name} — ${t.name}${t.isCurrent ? " ✓" : ""}`,
    })),
  );

  // Default to current term when it loads
  useEffect(() => {
    if (currentTerm && !selectedTermId) setSelectedTermId(currentTerm.id);
  }, [currentTerm]);

  useEffect(() => {
    Promise.all([
      api("/students"),
      api("/results/subjects"),
      api("/setup/school").catch(() => null),
    ])
      .then(([s, sub, sch]) => {
        setStudents(s);
        setSubjects(sub);
        setSchool(sch);
      })
      .catch((e) => setError(e.message));
  }, []);

  // console.log("Selected", selected);

  const loadReport = async (studentId, termId, classId) => {
    if (!termId) return;
    setLoadingReport(true);

    try {
      // const data = await api(
      //   `/results/student-result/${studentId}?termId=${termId}&classId=${classId}`,
      // );

      const data = await api(
        `/results/report-card/${studentId}?termId=${termId}`,
      );

      console.log("Report data", data);

      setReport(data);

      setAttendance(
        data.attendance || {
          schoolOpened: "",
          present: "",
          punctual: "",
        },
      );

      setBehaviour(data.behaviour || []);
      setPsychomotor(data.psychomotor || []);
      setSports(data.sports || []);
      setClubs(data.clubs || []);

      setComments(
        data.comments || {
          teacher: "",
          principal: "",
        },
      );

      //  Build editable sheet
      const subjectMap = {};

      data.academics.forEach((r) => {
        subjectMap[r.subject] = r;
      });

      const classSubjects = subjects.filter((s) => s.classId === classId);

      // const sheetData = classSubjects.map((sub) => {
      //   const existing = subjectMap[sub.name];

      //   return {
      //     subjectId: sub.id,
      //     subject: sub.name,
      //     testScore: existing?.testScore || "",
      //     examScore: existing?.examScore || "",
      //     totalScore: existing?.TotalScore || 0,
      //     grade: existing?.grade || "",
      //     subjectPosition: getOrdinal(existing?.subjectPosition) || "-",
      //     remark: existing?.remark || "",
      //   };
      // });

      const sheetData = data.academics.map((s) => ({
        subjectId: s.subjectId,

        subject: s.subject,

        attendanceScore: s.attendanceScore || 0,

        assignmentScore: s.assignmentScore || 0,

        ca1Score: s.ca1Score || 0,

        ca2Score: s.ca2Score || 0,

        examScore: s.examScore || 0,

        totalScore: s.TotalScore || 0,

        grade: s.grade || "",

        subjectPosition: s.subjectPosition,

        remark: s.remark || "",
      }));

      setSheet(sheetData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingReport(false);
    }
  };

  // const updateSheet = (index, field, value) => {
  //   setSheet((prev) => {
  //     const updated = [...prev];
  //     updated[index][field] = value;

  //     const test = parseFloat(updated[index].testScore) || 0;
  //     const exam = parseFloat(updated[index].examScore) || 0;

  //     updated[index].totalScore = test + exam;

  //     updated[index].testError = test > 30;
  //     updated[index].examError = exam > 70;

  //     return updated;
  //   });
  // };

  const updateSheet = (index, field, value) => {
    setSheet((prev) => {
      const updated = [...prev];

      updated[index][field] = value;

      const att = Number(updated[index].attendanceScore) || 0;

      const ass = Number(updated[index].assignmentScore) || 0;

      const ca1 = Number(updated[index].ca1Score) || 0;

      const ca2 = Number(updated[index].ca2Score) || 0;

      const exam = Number(updated[index].examScore) || 0;

      updated[index].totalScore = att + ass + ca1 + ca2 + exam;

      return updated;
    });
  };

  const updateBehaviour = (index, value) => {
    setBehaviour((prev) => {
      const copy = [...prev];
      copy[index].score = value;
      return copy;
    });
  };

  const selectStudent = (s) => {
    setSelected(s);
    console.log("Selected student", s);
    setReport(null);
    if (selectedTermId) loadReport(s.id, selectedTermId, s.classId);
  };

  const handleTermChange = (termId) => {
    setSelectedTermId(termId);
    if (selected) loadReport(s.id, termId, s.classId);
  };

  const saveReportCard = async () => {
    if (!selectedTermId) return setError("Select a term");

    setSaving(true);

    try {
      await api("/results/report-card", {
        method: "POST",

        body: {
          studentId: selected.id,

          termId: selectedTermId,

          attendance,

          results: sheet.map((s) => ({
            subjectId: s.subjectId,

            attendanceScore: Number(s.attendanceScore) || 0,

            assignmentScore: Number(s.assignmentScore) || 0,

            ca1Score: Number(s.ca1Score) || 0,

            ca2Score: Number(s.ca2Score) || 0,

            examScore: Number(s.examScore) || 0,
          })),

          assessments: [...behaviour, ...psychomotor, ...sports, ...clubs],

          comments,
        },
      });
      // await api("/results", {
      //   method: "POST",
      //   body: {
      //     studentId: selected.id,
      //     termId: selectedTermId,
      //     results: sheet.map((s) => ({
      //       subjectId: s.subjectId,
      //       testScore: Number(s.testScore) || 0,
      //       examScore: Number(s.examScore) || 0,
      //     })),
      //   },
      // });

      loadReport(selected.id, selectedTermId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteScore = async (resultId) => {
    if (!confirm("Delete this score?")) return;
    await api(`/results/${resultId}`, { method: "DELETE" }).catch((e) =>
      setError(e.message),
    );
    loadReport(selected.id, selectedTermId);
  };

  const printReport = () => {
    if (!report || !selected) return;
    const selectedTerm = allTerms.find((t) => t.id === selectedTermId);
    const termLabel = selectedTerm
      ? `${selectedTerm.sessionName} — ${selectedTerm.name}`
      : "";
    const w = window.open("", "_blank");

    const rows = report.subjects
      .map(
        (r) => `
      <tr>
        <td>${r.subject}</td>
        <td style="text-align:center;font-weight:500">${r.testScore}</td>
        <td style="text-align:center;font-weight:500">${r.examScore}</td>
        <td style="text-align:center;font-weight:500">${r.TotalScore}</td>
        <td style="text-align:center;font-weight:500">${getOrdinal(r.subjectPosition) || "-"}</td>
       

        <td style="text-align:center;color:${gradeHex(r.grade)};font-weight:600">${r.grade}</td>
        <td style="color:#6b7280">${r.grade === "A" ? "Excellent" : r.grade === "B" ? "Very Good" : r.grade === "C" ? "Average" : r.grade === "D" ? "Below Average" : "Fail"}</td>
      </tr>
    `,
      )
      .join("");

    const logoHtml = school?.logoUrl
      ? `<img src="${getMediaUrl(school.logoUrl)}" style="height:64px;object-fit:contain;margin-bottom:6px"/>`
      : '<div style="font-size:48px;line-height:1">🏫</div>';

    w.document.write(`<!DOCTYPE html><html><head>
      <title>Report Card — ${selected.name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Roboto, Open Sans, Lato', serif; max-width: 720px; margin: 40px auto; color: #1a1f36; padding: 20px; }
        .header { text-align: center; border-bottom: 3px double #1a1f36; padding-bottom: 18px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; margin: 6px 0 3px; }
        .header .sub { font-size: 13px; color: #6b7280; margin: 2px 0; }
        .header .title { font-size: 16px; font-weight: bold; margin-top: 12px; letter-spacing: .06em; text-transform: uppercase; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
        .info div { border: 1px solid #e5e7eb; padding: 8px 12px; border-radius: 6px; }
        .info span { font-size: 10px; color: #9ca3af; display: block; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { background: #f9fafb; padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #e5e7eb; }
        td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
        .summary { margin-top: 20px; display: flex; gap: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .summary div { flex: 1; padding: 14px; text-align: center; border-right: 1px solid #e5e7eb; }
        .summary div:last-child { border-right: none; }
        .summary .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px; }
        .summary .val { font-size: 22px; font-weight: 700; }
        .sigs { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; }
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
        <div class="title">Student Academic Report</div>
      </div>

      <div class="info">
        <div><span>Student Name</span>${selected.name}</div>
        <div><span>Admission No.</span>${selected.admissionNumber}</div>
        <div><span>Class</span>${selected.class.className}</div>
        <div><span>Term</span>${termLabel}</div>
        <div><span>No. of Subjects</span>${report.subjects?.length}</div>
        <div><span>Date Issued</span>${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th style="text-align:center">Test Score</th>
            <th style="text-align:center">Exam Score</th>
            <th style="text-align:center">Total Score (/100)</th>
            <th style="text-align:center">Subject Position</th>
            <th style="text-align:center">Grade</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary">
        <div><div class="label">Total Score</div><div class="val">${report.summary.totalScore}</div></div>
        <div><div class="label">Average</div><div class="val">${report.summary.average}%</div></div>
        <div><div class="label">Final Grade</div><div class="val" style="color:${gradeHex(report.summary.finalGrade)}">${report.summary.finalGrade}</div></div>
        <div><div class="label">Class Position</div><div class="val" style="color:${gradeHex(report.summary.position)}">${getOrdinal(report.summary.position)}</div></div>

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

  const classSubjects = subjects.filter((s) => s.classId === selected?.classId);
  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.class.className.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNumber?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Results</h2>
      <ErrorMessage message={error} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Student picker */}
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
            position: "sticky",
            top: 24,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#9ca3af",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            Term
          </label>
          <select
            value={selectedTermId}
            onChange={(e) => handleTermChange(e.target.value)}
            style={{ ...inputStyle, marginBottom: 14, fontSize: 13 }}
          >
            <option value="">Select term…</option>
            {allTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#9ca3af",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            Students
          </label>
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, fontSize: 13, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 440, overflowY: "auto" }}>
            {filtered.map((s) => (
              <div
                key={s.id}
                onClick={() => selectStudent(s)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: selected?.id === s.id ? "#eff6ff" : "transparent",
                  marginBottom: 2,
                  transition: "background .1s",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: selected?.id === s.id ? 600 : 400,
                    color: selected?.id === s.id ? "#2563eb" : "#374151",
                  }}
                >
                  {s.name}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
                  {s.class.className} · {s.admissionNumber}
                </p>
              </div>
            ))}
            {filtered.length === 0 && (
              <p
                style={{
                  color: "#9ca3af",
                  fontSize: 13,
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                No students found
              </p>
            )}
          </div>
        </div>

        {/* Result sheet */}
        {!selected ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 48,
              textAlign: "center",
              color: "#9ca3af",
              boxShadow: "0 1px 4px rgba(0,0,0,.06)",
            }}
          >
            <p style={{ fontSize: 36, margin: "0 0 8px" }}>📋</p>
            <p style={{ margin: 0 }}>
              Select a student to view or enter results
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 22,
              boxShadow: "0 1px 4px rgba(0,0,0,.06)",
            }}
          >
            {/* Sheet header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 18,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17 }}>{selected.name}</h3>
                <p
                  style={{ margin: "3px 0 0", color: "#6b7280", fontSize: 13 }}
                >
                  {selected.class.className} · {selected.admissionNumber}
                  {selectedTermId &&
                    allTerms.find((t) => t.id === selectedTermId) && (
                      <span style={{ marginLeft: 8, color: "#9ca3af" }}>
                        · {allTerms.find((t) => t.id === selectedTermId).label}
                      </span>
                    )}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {report?.subjects?.length > 0 && (
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    onClick={printReport}
                  >
                    🖨 Print
                  </ActionButton>
                )}
                {/* {classSubjects.length > 0 && selectedTermId && ( */}
                {selectedTermId && (
                  <ActionButton onClick={saveReportCard} disabled={saving}>
                    Save Report Card
                  </ActionButton>
                )}
              </div>
            </div>

            {/* No term selected */}
            {!selectedTermId && (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "#9ca3af",
                }}
              >
                Select a term above to view results.
              </div>
            )}

            {/* No subjects warning */}
            {selectedTermId && classSubjects.length === 0 && (
              <div
                style={{
                  background: "#fef3c7",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#92400e",
                  marginBottom: 14,
                }}
              >
                No subjects added to {selected.class.className} yet. Go to{" "}
                <strong>Classes</strong> → Edit → add subjects first.
              </div>
            )}

            {loadingReport ? (
              <Spinner size={24} />
            ) : (
              report &&
              selectedTermId && (
                <>
                  {/* {report?.subjects?.length === 0 ? (
                    <div
                      style={{
                        padding: "28px 0",
                        textAlign: "center",
                        color: "#9ca3af",
                      }}
                    >
                      No scores entered yet for this term.
                      {classSubjects.length > 0
                        ? ' Click "+ Enter Score" to begin.'
                        : ""}
                    </div>
                  )  */}

                  <>
                    {/* Attendance Section */}

                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 20,
                        marginBottom: 20,
                      }}
                    >
                      <h3
                        style={{
                          marginBottom: 16,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        Attendance Summary
                      </h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(180px,1fr))",
                          gap: 16,
                        }}
                      >
                        <FormField label="School Opened">
                          <input
                            type="number"
                            value={attendance.schoolOpened}
                            onChange={(e) =>
                              setAttendance({
                                ...attendance,
                                schoolOpened: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </FormField>

                        <FormField label="Present">
                          <input
                            type="number"
                            value={attendance.present}
                            onChange={(e) =>
                              setAttendance({
                                ...attendance,
                                present: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </FormField>

                        <FormField label="Punctual">
                          <input
                            type="number"
                            value={attendance.punctual}
                            onChange={(e) =>
                              setAttendance({
                                ...attendance,
                                punctual: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </FormField>

                        <div
                          style={{
                            background: "#f9fafb",
                            borderRadius: 8,
                            padding: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                          }}
                        >
                          Absent:
                          {(attendance.schoolOpened || 0) -
                            (attendance.present || 0)}
                        </div>
                      </div>
                    </div>

                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        fontSize: 14,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          {[
                            "Subject",
                            "Att",
                            "Ass",
                            "CA1",
                            "CA2",
                            "Exam",
                            "Total",
                            "Grade",
                            "Position",
                            "Remark",
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "10px 12px",
                                textAlign: "left",
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#6b7280",
                                textTransform: "uppercase",
                                letterSpacing: ".04em",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {sheet.map((row, i) => (
                          <tr key={row.subjectId}>
                            <td>{row.subject}</td>

                            <td>
                              <input
                                type="number"
                                value={row.attendanceScore}
                                onChange={(e) =>
                                  updateSheet(
                                    i,
                                    "attendanceScore",
                                    e.target.value,
                                  )
                                }
                                style={cellInput}
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                value={row.assignmentScore}
                                onChange={(e) =>
                                  updateSheet(
                                    i,
                                    "assignmentScore",
                                    e.target.value,
                                  )
                                }
                                style={cellInput}
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                value={row.ca1Score}
                                onChange={(e) =>
                                  updateSheet(i, "ca1Score", e.target.value)
                                }
                                style={cellInput}
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                value={row.ca2Score}
                                onChange={(e) =>
                                  updateSheet(i, "ca2Score", e.target.value)
                                }
                                style={cellInput}
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                value={row.examScore}
                                onChange={(e) =>
                                  updateSheet(i, "examScore", e.target.value)
                                }
                                style={cellInput}
                              />
                            </td>

                            <td>
                              <strong>{row.totalScore}</strong>
                            </td>

                            <td>
                              <Badge
                                label={row.grade}
                                color={gradeColor(row.grade)}
                              />
                            </td>

                            <td>{row.subjectPosition}</td>

                            <td>{row.remark}</td>
                          </tr>
                          // <tr
                          //   key={row.subjectId}
                          //   style={{
                          //     borderBottom: "1px solid #f3f4f6",
                          //     transition: "background 0.15s",
                          //   }}
                          //   onMouseEnter={(e) =>
                          //     (e.currentTarget.style.background = "#fafafa")
                          //   }
                          //   onMouseLeave={(e) =>
                          //     (e.currentTarget.style.background = "transparent")
                          //   }
                          // >
                          //   {/* Subject */}
                          //   <td
                          //     style={{ padding: "10px 12px", fontWeight: 500 }}
                          //   >
                          //     {row.subject}
                          //   </td>

                          //   {/* Test */}
                          //   <td style={{ padding: "8px 12px" }}>
                          //     <input
                          //       type="number"
                          //       value={row.testScore}
                          //       onChange={(e) =>
                          //         updateSheet(i, "testScore", e.target.value)
                          //       }
                          //       onFocus={() => setFocused(`test-${i}`)}
                          //       onBlur={() => setFocused(null)}
                          //       style={{
                          //         ...cellInput,
                          //         borderColor:
                          //           focused === `test-${i}`
                          //             ? "#3b82f6"
                          //             : "#e5e7eb",
                          //         boxShadow:
                          //           focused === `test-${i}`
                          //             ? "0 0 0 2px rgba(59,130,246,0.15)"
                          //             : "none",

                          //         borderColor: row.testError
                          //           ? "#ef4444"
                          //           : "#e5e7eb",
                          //         background: row.testError
                          //           ? "#fef2f2"
                          //           : "#fff",
                          //       }}
                          //     />
                          //   </td>

                          //   {/* Exam */}
                          //   <td style={{ padding: "8px 12px" }}>
                          //     <input
                          //       type="number"
                          //       value={row.examScore}
                          //       onChange={(e) =>
                          //         updateSheet(i, "examScore", e.target.value)
                          //       }
                          //       onFocus={() => setFocused(`exam-${i}`)}
                          //       onBlur={() => setFocused(null)}
                          //       style={{
                          //         ...cellInput,
                          //         borderColor:
                          //           focused === `exam-${i}`
                          //             ? "#3b82f6"
                          //             : "#e5e7eb",
                          //         boxShadow:
                          //           focused === `exam-${i}`
                          //             ? "0 0 0 2px rgba(59,130,246,0.15)"
                          //             : "none",
                          //         borderColor: row.examError
                          //           ? "#ef4444"
                          //           : "#e5e7eb",
                          //         background: row.examError
                          //           ? "#fef2f2"
                          //           : "#fff",
                          //       }}
                          //     />
                          //   </td>

                          //   {/* Total */}
                          //   <td
                          //     style={{
                          //       padding: "8px 12px",
                          //       fontWeight: 600,
                          //       color: "#111827",
                          //     }}
                          //   >
                          //     {row.totalScore}
                          //   </td>

                          //   {/* Grade */}
                          //   <td style={{ padding: "8px 12px" }}>
                          //     <Badge
                          //       label={row.grade}
                          //       color={gradeColor(row.grade)}
                          //     />
                          //   </td>

                          //   {/* Position */}
                          //   <td
                          //     style={{
                          //       padding: "8px 12px",
                          //       fontWeight: 500,
                          //       color: "#374151",
                          //     }}
                          //   >
                          //     {row.subjectPosition || "-"}
                          //   </td>

                          //   {/* Remark */}
                          //   <td
                          //     style={{
                          //       padding: "8px 12px",
                          //       fontSize: 12,
                          //       color: "#6b7280",
                          //     }}
                          //   >
                          //     {row.remark}
                          //   </td>
                          // </tr>
                        ))}
                      </tbody>
                    </table>

                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 20,
                        marginTop: 20,
                      }}
                    >
                      <h3>Behaviour Assessment</h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(250px,1fr))",
                          gap: 16,
                        }}
                      >
                        {behaviour.map((item, index) => (
                          <FormField key={item.categoryId} label={item.name}>
                            <select
                              value={item.score || ""}
                              onChange={(e) =>
                                updateBehaviour(index, e.target.value)
                              }
                              style={inputStyle}
                            >
                              <option value="">Select</option>
                              <option>A</option>
                              <option>B</option>
                              <option>C</option>
                              <option>D</option>
                              <option>E</option>
                            </select>
                          </FormField>
                        ))}
                      </div>
                    </div>

                    {/* <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(350px,1fr))",
                        gap: 20,
                        marginTop: 20,
                      }}
                    > */}
                    <h3>PSychomotor Assessment</h3>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(250px,1fr))",
                        gap: 16,
                      }}
                    >
                      {psychomotor.map((item, index) => (
                        <FormField key={item.categoryId} label={item.name}>
                          <select
                            value={item.score || ""}
                            onChange={(e) =>
                              updatePsychomotor(index, e.target.value)
                            }
                            style={inputStyle}
                          >
                            <option value="">Select</option>
                            <option>A</option>
                            <option>B</option>
                            <option>C</option>
                            <option>D</option>
                            <option>E</option>
                          </select>
                        </FormField>
                      ))}
                    </div>

                    <h3>Sports Assessment</h3>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(250px,1fr))",
                        gap: 16,
                      }}
                    >
                      {sports.map((item, index) => (
                        <FormField key={item.categoryId} label={item.name}>
                          <select
                            value={item.score || ""}
                            onChange={(e) => updateSport(index, e.target.value)}
                            style={inputStyle}
                          >
                            <option value="">Select</option>
                            <option>A</option>
                            <option>B</option>
                            <option>C</option>
                            <option>D</option>
                            <option>E</option>
                          </select>
                        </FormField>
                      ))}
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 20,
                        marginTop: 20,
                      }}
                    >
                      <h3>Comments</h3>

                      <div
                        style={{
                          display: "grid",
                          gap: 20,
                        }}
                      >
                        <FormField label="Teacher Comment">
                          <textarea
                            rows={4}
                            value={comments.teacher}
                            onChange={(e) =>
                              setComments({
                                ...comments,
                                teacher: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </FormField>

                        <FormField label="Principal Comment">
                          <textarea
                            rows={4}
                            value={comments.principal}
                            onChange={(e) =>
                              setComments({
                                ...comments,
                                principal: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </FormField>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 24,
                      }}
                    >
                      <ActionButton onClick={saveReportCard} disabled={saving}>
                        Save Report Card
                      </ActionButton>
                    </div>

                    {/* Summary */}
                    {/* <div
                      style={{
                        marginTop: 16,
                        padding: "12px 14px",
                        background: "#f9fafb",
                        borderRadius: 8,
                        display: "flex",
                        gap: 28,
                        fontSize: 14,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        Subjects: <strong>{report?.subjects?.length}</strong>
                      </span>
                      <span>
                        Total: <strong>{report.summary?.totalScore}</strong>
                      </span>
                      <span>
                        Average: <strong>{report.summary?.average}%</strong>
                      </span>
                      <span>
                        Final Grade:{" "}
                        <strong
                          style={{
                            color: gradeHex(report.summary?.finalGrade),
                          }}
                        >
                          {report.summary?.finalGrade}
                        </strong>
                      </span> */}
                    {/* <span>
                        Class Position:{" "}
                        <strong>{getOrdinal(report.summary.position)}</strong>
                      </span> */}
                    {/* </div> */}
                  </>
                </>
              )
            )}
          </div>
        )}
      </div>

      {/* Score entry modal */}
      {modal && (
        <Modal
          title={`Enter Score — ${selected?.name}`}
          onClose={() => {
            setModal(false);
            setScore({ subjectId: "", score: "" });
          }}
        >
          <FormField label="Subject">
            <select
              value={scoreForm.subjectId}
              onChange={(e) =>
                setScore((p) => ({ ...p, subjectId: e.target.value }))
              }
              style={inputStyle}
            >
              <option value="">Select subject…</option>
              {classSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Score (0 – 100)"
            hint="Saving a score for an existing subject overwrites it."
          >
            <input
              type="number"
              min="0"
              max="100"
              value={scoreForm.score}
              onChange={(e) =>
                setScore((p) => ({ ...p, score: e.target.value }))
              }
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
                saving || !scoreForm.subjectId || scoreForm.score === ""
              }
              onClick={saveScore}
            >
              {saving ? "Saving…" : "Save Score"}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
