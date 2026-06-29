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

// function getOrdinal(n) {
//   const s = ["th", "st", "nd", "rd"];
//   const v = n % 100;
//   return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
// }

export function formatHijrahDate(dateInput) {
  const date = new Date(dateInput);

  // Gregorian parts
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
  }).format(date);

  const gregDay = getOrdinalHijri(date.getDate());

  const gregMonth = new Intl.DateTimeFormat("en-GB", {
    month: "long",
  }).format(date);

  const gregYear = date.getFullYear();

  // Hijri parts
  const hijriFormatter = new Intl.DateTimeFormat(
    "en-TN-u-ca-islamic-umalqura",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  const parts = hijriFormatter.formatToParts(date);

  const hijriDay = getOrdinalHijri(
    Number(parts.find((p) => p.type === "day")?.value),
  );

  const hijriMonth = parts.find((p) => p.type === "month")?.value;

  const hijriYear = parts.find((p) => p.type === "year")?.value;

  return `${weekday} ${hijriDay} ${hijriMonth} ${hijriYear} AH (${gregDay} ${gregMonth}, ${gregYear})`;
}

export function getOrdinal(n) {
  if (!n) return "-";

  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const finalPosition = n + (s[(v - 20) % 10] || s[v] || s[0]);
  console.log("Final Position", finalPosition);

  return finalPosition.includes("1st", "2nd", "3rd") ? finalPosition : "Nil";
}
export function getOrdinalHijri(n) {
  if (!n) return "-";

  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const finalPosition = n + (s[(v - 20) % 10] || s[v] || s[0]);
  console.log("Final Position", finalPosition);

  return finalPosition;
}

function gradeHex(g) {
  return (
    { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" }[
      g
    ] || "#6b7280"
  );
}

export function formatNameWithComma(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const first = parts.shift();
  const rest = parts.join(" ");
  return `${first}, ${rest}`;
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
  const { user, isAdmin, isTeacher } = useAuth();
  const [sheet, setSheet] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [report, setReport] = useState(null);
  const [printerReport, setPrinterReport] = useState(null);
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
  });
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [behaviour, setBehaviour] = useState([]);
  const [psychomotor, setPsychomotor] = useState([]);
  const [sports, setSports] = useState([]);
  const [clubs, setClubs] = useState([]);

  const [comments, setComments] = useState({
    teacher: "",
    principal: "",
    sportMistress: "",
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

  // Default to current term and 1st class when it loads
  useEffect(() => {
    if (currentTerm && !selectedTermId) setSelectedTermId(currentTerm.id);
  }, [currentTerm]);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      const defaultClassId = isTeacher
        ? user?.teacher?.classId || classes[0].id
        : classes[0].id;
      setSelectedClassId(defaultClassId);
    }
  }, [classes, selectedClassId, isTeacher, user?.teacher?.classId]);

  useEffect(() => {
    Promise.all([
      api("/students"),
      api("/results/subjects"),
      api("/setup/school").catch(() => null),
      api("/classes"),
    ])
      .then(([s, sub, sch, c]) => {
        setStudents(s);
        setSubjects(sub);
        setSchool(sch);
        setClasses(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  //console.log("classess", classes);

  const loadReport = async (studentId, termId, classId) => {
    if (!termId) return;
    if (isTeacher && classId !== user?.teacher?.classId) return;
    setLoadingReport(true);

    try {
      const printReportData = await api(
        `/results/student-result/${studentId}?termId=${termId}&classId=${classId}`,
      );

      const data = await api(
        `/results/report-card/${studentId}?termId=${termId}`,
      );

      setPrinterReport(printReportData);
      console.log("Print report data", printReportData);

      console.log("Report data", data);

      setReport(data);

      setAttendance(
        data.attendance || {
          schoolOpened: "",
          present: "",
          punctual: "",
        },
      );

      // setBehaviour(data.behaviour || []);
      // setPsychomotor(data.psychomotor || []);
      // setSports(data.sports || []);

      setBehaviour(
        data.behaviour.map((item) => ({
          ...item,
          score: item.score || "A",
        })),
      );

      setPsychomotor(
        data.psychomotor.map((item) => ({
          ...item,
          score: item.score || "A",
        })),
      );

      setSports(
        data.sports.map((item) => ({
          ...item,
          score: item.score || "A",
        })),
      );
      // setClubs(data.clubs || []);

      setClubs(
        data.clubs.map((item) => ({
          ...item,
          score: item.score || "A",
        })),
      );
      // setClubs(data.clubs || []);

      setComments(
        data.comments || {
          teacher: "",
          principal: "",
        },
      );

      //  Build editable sheet
      const subjectMap = {};
      const filteredSubjects = subjects.filter(
        (s) => s.classId === selected?.classId,
      );
      filteredSubjects.forEach((r) => {
        subjectMap[r.subject] = r;
      });

      // const classSubjects = subjects.filter(
      //   (s) => s.classId === selected?.classId,
      // );
      // console.log("Class subjects", classSubjects);

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

      // const sheetData = data.academics.map((s) => ({
      //   subjectId: s.subjectId,

      //   subject: s.subject || "",

      //   attendanceScore: s.attendanceScore || 0,

      //   assignmentScore: s.assignmentScore || 0,

      //   ca1Score: s.ca1Score || 0,

      //   ca2Score: s.ca2Score || 0,

      //   examScore: s.examScore || 0,

      //   totalScore: s.TotalScore || 0,

      //   grade: s.grade || "",

      //   subjectPosition: s.subjectPosition,

      //   remark: s.remark || "",
      // }));

      const classSubjects = subjects.filter((s) => s.classId === classId);

      const academicMap = {};

      data.academics.forEach((a) => {
        academicMap[a.subjectId] = a;
      });

      const sheetData = classSubjects.map((sub) => {
        const existing = academicMap[sub.id];

        return {
          subjectId: sub.id,
          subject: sub.name,

          attendanceScore: existing?.attendanceScore ?? 0,
          assignmentScore: existing?.assignmentScore ?? 0,
          ca1Score: existing?.ca1Score ?? 0,
          ca2Score: existing?.ca2Score ?? 0,
          examScore: existing?.examScore ?? 0,

          totalScore: existing?.TotalScore ?? 0,

          grade: existing?.grade ?? "",
          subjectPosition: existing?.subjectPosition ?? null,
          remark: existing?.remark ?? "",
        };
      });

      // setSheet(sheetData);

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

  const updatePsychomotor = (index, value) => {
    setPsychomotor((prev) => {
      const copy = [...prev];
      copy[index].score = value;
      return copy;
    });
  };
  const updateSports = (index, value) => {
    setSports((prev) => {
      const copy = [...prev];
      copy[index].score = value;
      return copy;
    });
  };
  const updateClubs = (index, value) => {
    setClubs((prev) => {
      const copy = [...prev];
      copy[index].score = value;
      return copy;
    });
  };

  const selectStudent = (s) => {
    if (isTeacher && s.classId !== user?.teacher?.classId) return;

    setSelected(s);
    console.log("Selected student", s);
    setReport(null);
    if (selectedTermId) loadReport(s.id, selectedTermId, s.classId);
  };

  const handleTermChange = (termId) => {
    setSelectedTermId(termId);
    if (selected) loadReport(selected.id, termId, selected.classId);
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);

    // Clear selection if the current selected student is not in the new class.
    if (selected?.classId !== classId) {
      setSelected(null);
      setReport(null);
      setPrinterReport(null);
      setSheet([]);
    }
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

      loadReport(selected.id, selectedTermId, selected.classId);
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
  console.log("Selected", selected);
  console.log("Printer Report", printerReport);
  const printReport = () => {
    if (!printerReport || !selected) return;

    const classSection = [
      "preschool",
      "preparatory class 1",
      "preparatory class 2",
      "preparatory class 3",
    ].includes(selected.class.className.toLowerCase())
      ? "Nursery Section"
      : "Primary Section";
    const selectedTerm = allTerms.find((t) => t.id === selectedTermId);
    const termLabel = selectedTerm
      ? `${selectedTerm.sessionName} — ${selectedTerm.name}`
      : "";
    const attendance = printerReport.attendance || {};

    const watermarkHtml = school?.logoUrl
      ? `
    <div class="watermark">
      <img src="${getMediaUrl(school.logoUrl)}" />
    </div>
  `
      : "";

    const behaviour = printerReport.assessments?.behaviour || [];
    const psychomotor = printerReport.assessments?.psychomotor || [];
    const sports = printerReport.assessments?.sports || [];
    const clubs = printerReport.assessments?.clubs || [];

    const comments = printerReport.comments || {};

    const student = printerReport.student || {};

    const absent = (attendance.schoolOpened || 0) - (attendance.present || 0);

    const renderAssessmentGrid = (items) =>
      items
        .map(
          (i) => `
      <div class="assessment-item">
        <span>${i.name}</span>
        <strong>${i.score || "-"}</strong>
      </div>
    `,
        )
        .join("");

    const subjectRows = printerReport.subjects
      .map(
        (r) => `
<tr>
<td>${r.subject}</td>

<td>${r.attendanceScore ?? 0}</td>

<td>${r.assignmentScore ?? 0}</td>

${classSection.toLowerCase() === "Primary Section".toLowerCase() ? <td>${r.ca1Score ?? 0}</td> : ""}

<td>${r.ca2Score ?? 0}</td>

<td>${r.examScore ?? 0}</td>

<td style="font-weight:700">
${r.TotalScore ?? 0}
</td>

${selectedTerm?.name === "Second Term" || selectedTerm?.name === "Third Term" ? `<td>${r.firstTermScore ?? "-"}</td>` : ""}

${selectedTerm?.name === "Third Term" ? `<td>${r.secondTermScore ?? "-"}</td>` : ""}

<td>
<span class="grade grade-${r.grade}">
${r.grade}
</span>
</td>

<td>
${getOrdinal(r.subjectPosition)}
</td>

<td>
${r.remark}
</td>
</tr>
`,
      )
      .join("");

    const logoHtml = school?.logoUrl
      ? `<img src="${getMediaUrl(school.logoUrl)}" class="logo"/>`
      : "";

    const passportHtml = student?.passportPhoto
      ? `<img src="${getMediaUrl(student.passportPhoto)}" class="passport"/>`
      : "";

    const principalSignature = school?.principalSignatureUrl
      ? `
    <img
      src="${getMediaUrl(school.principalSignatureUrl)}"
      class="signature-image"
    />
  `
      : "";

    const w = window.open("", "_blank");

    w.document.write(`
<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet">
<title>${formatNameWithComma(student.name)} Report Card</title>

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
}

.report-card{
  position:relative;
  width:100%;
}

.watermark{
  position:fixed;
  top:50%;
  left:50%;
  transform:translate(-50%, -50%);
  z-index:0;
  pointer-events:none;
}

.watermark img{
  width:800px;
  height:800px;
  object-fit:contain;
  opacity:0.06;
}

@media print{

  .watermark{
    position:fixed;
    top:50%;
    left:50%;
    transform:translate(-50%, -50%);
  }

  .watermark img{
    opacity:0.05;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }

}

body{
font-family:Arial,sans-serif;
padding:20px;
color:#111827;
}

:root {
  --primary: #10b981;
  --light: #d1fae5;
  
  /* Harmonized dark gray shades */
  --dark-bg: #131414ee;     /* Dark background */
  --dark-card: #1c2e28;   /* Dark card/border */
  --dark-text: #c7d1cf;   /* Light green-gray text for dark mode */
}

.report-card{
width:100%;
}

.header{
display:grid;
grid-template-columns:80px 1fr 80px;
gap:5px;
align-items:center;

}



.logo{
width:150px;
height:150px;
object-fit:contain;
}

.passport{
width:100px;
height:120px;
object-fit:cover;
border:1px solid #cbd5e1;
}

.school-info{
text-align:center;
color:var(--dark-card);
}



.school-name{
text-transform:capitalise;
font-variant:small-caps;
display:block;
font-size:28px;
font-weight:600;
font-family:"Times New Roman", Times, serif;

}

.school-address{
font-size:12px;
margin-top:4px;
}

.report-title{
font-size:20px;
font-weight:600;

margin-top:10px;
}

.student-name{
font-size:25px;
font-weight:700;
font-style:italic;
text-align:center;
font-family: "Lucida Calligraphy", "Apple Chancery", "URW Chancery L", cursive;
margin:10px 0;
color:var(--dark-card);
}

.principal-title{
  margin-top:10px;
}

.comment-grade{
display:flex;
justify-content: space-between;

}

.student-grid{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:10px;
margin-bottom:5px;
font-size:10px;
}

.section-title{
background:var(--dark-text);
color:var(--dark-bg);
padding:3px;
font-weight:600;
font-size: 10px;
margin-top:12px;
margin-bottom:5px;
}

table{
width:100%;
border-collapse:collapse;
margin-bottom:12px;
}

th{
background:var(--dark-text);
color:var(--dark-bg);
font-size:8px;
padding:4px;
border:1px solid #93c5fd;
}

td{
padding:3px;
border:1px solid #cbd5e1;
font-size:8px;
}

.next-term-promotion{
display:flex;
justify-content:space-between;
margin-top:5px;
font-size:10px;
font-style:italic;
}

.assessment-grid{
display:grid;
grid-template-columns:repeat(5,1fr);
gap:5px;
margin-bottom:12px;
}

.assessment-grid-club{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:5px;
margin-bottom:12px;
}

.assessment-item{
display:flex;
justify-content:space-between;
padding:2px;
font-size:10px;
border:1px solid #cbd5e1;
background:#f8fafc;
}

.summary{
display:grid;
grid-template-columns:repeat(6,1fr);
gap:8px;
margin-top:10px;
margin-bottom:5px;
}

.summary-card{
background:var(--dark-bg);
padding:6px;
text-align:center;
border-radius:6px;
}

.summary-card .label{
font-size:10px;
font-weight:500;
color:var(--dark-text);
}

.summary-card .value{
font-size:10px;
font-weight:600;
margin-top:4px;
color:var(--dark-text);
}

.comment-box{
border:1px solid #cbd5e1;
padding:10px;
margin-bottom:10px;
min-height:60px;
}

.grade{
font-weight:bold;
}

.signature-section{
margin-top:30px;
display:flex;
justify-content:space-between;
align-items:flex-end;
}

.signature-image{
height:60px;
object-fit:contain;
}

.signature-line{
width:220px;
border-top:1px solid #111827;
padding-top:5px;
text-align:center;
font-size:12px;
}

@media print{

body{
padding:10px;
}

.section-title, .summary-card, .value, .label {
-webkit-print-color-adjust:exact;
print-color-adjust:exact;
}



th{
-webkit-print-color-adjust:exact;
print-color-adjust:exact;
}

}

</style>

</head>

<body>

<div class="report-card">
${watermarkHtml}
<div class="header">

<div>
${logoHtml}
</div>

<div class="school-info">
<div class="school-name">
${school?.name || ""}
</div>

<div class="school-address">
${school?.address || ""}
</div>

<div class="report-title">
${selectedTerm?.name.toUpperCase() || ""} ${selectedTerm?.sessionName || ""} REPORT SHEET
</div>
<div class="report-title">
(${classSection.toUpperCase()})
</div>

</div>

<div>
${passportHtml}
</div>

</div>

<div class="student-name">
${formatNameWithComma(student.name)}
</div>

<div class="student-grid">

<div>
<b>Admission No:</b>
${student.admissionNumber || ""}
</div>

<div>
<b>Class: </b>
${student.class.className || ""}
</div>

<div>
<b>School Opened: </b> 
${attendance.schoolOpened || 0}
</div>

<div>
<b>Present: </b>
${attendance.present || 0}
</div>
<div>
<b>Punctual: </b>
${attendance.punctual || 0}
</div>

<div>
<b>Gender:</b>
${student.gender || ""}
</div>

<div>
<b>Date Of Birth:</b>
${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : ""}
</div>



<div>
<b>Term Closed:</b>
${formatHijrahDate(printerReport.term.termCloseDate?.split("T")[0]) || ""}
</div>



</div>



<div class="section-title">
1. BEHAVIOUR & PSYCHOMOTOR
</div>

<div class="assessment-grid">
${renderAssessmentGrid(behaviour)}
</div>
<div class="assessment-grid">
${renderAssessmentGrid(psychomotor)}
</div>

<div class="section-title">
2. PERFORMANCE IN SUBJECTS
</div>
<table>
<thead>
<tr>
<th>Subject</th>
<th>Att</th>
<th>Ass</th>

${classSection.toLowerCase() === "primary section" ? "<th>CA1</th>" : ""}

  ${classSection.toLowerCase() === "primary section" ? "<th>CA2</th>" : "<th>CA</th>"}

<th>Exam</th>

<th>Total</th>

${selectedTerm?.name === "Second Term" || selectedTerm?.name === "Third Term" ? "<th>1st</th>" : ""}

${selectedTerm?.name === "Third Term" ? "<th>2nd</th>" : ""}

<th>Grade</th>

<th>Pos</th>

<th>Remark</th>

</tr>

</thead>

<tbody>

${subjectRows}

</tbody>

</table>

<div class="summary">

<div class="summary-card">
<div class="label">Total</div>
<div class="value">${printerReport.summary.totalScore}</div>
</div>

<div class="summary-card">
<div class="label">Average</div>
<div class="value">${printerReport.summary.average}%</div>
</div>

<div class="summary-card">
<div class="label">Grade</div>
<div class="value">${printerReport.summary.finalGrade}</div>
</div>

<div class="summary-card">
<div class="label">Position</div>
<div class="value">${getOrdinal(printerReport.summary.position)}</div>
</div>

<div class="summary-card">
<div class="label">Subjects</div>
<div class="value">${printerReport.summary.subjectsOffered}</div>
</div>

<div class="summary-card">
<div class="label">No in Class</div>
<div class="value">${printerReport.summary.classSize}</div>
</div>

</div>

<div class="section-title">
3. SPORTS
</div>

<div class="assessment-grid">
${renderAssessmentGrid(sports)}
</div>

<div class="section-title" style="bottom-margin:5px">
4. CLUBS - OFFICE HELD
</div>

<div class="assessment-grid-club">
${renderAssessmentGrid(clubs)}
</div>




<div class="comment-grade" style="display: flex; gap: 20px;">
<div style="width: 60%; margin-top:0;">
    <div class="section-title">
    5 COMMENTS & REMARKS
    </div>
    <table style="width: 100%;">
       <tr > <td><b>Sports Mistress:</b></td> <td style="font-family: 'Lucida Calligraphy', 'Apple Chancery', 'URW Chancery L', cursive;">${comments.sportMistress || ""}</td> </tr>
       <tr> <td><b>Class Teacher:</b></td>  <td style="font-family: 'Lucida Calligraphy', 'Apple Chancery', 'URW Chancery L', cursive;">${comments.teacher || ""}</td> </tr>
       <tr> <td><b>Head Teacher:</b></td>  <td style="font-family: 'Lucida Calligraphy', 'Apple Chancery', 'URW Chancery L', cursive;">${comments.principal || ""}</td> </tr>
    </table>
</div>

<div style="width: 40%; margin-top:0;">
    <div class="section-title">
     GRADE INTERPRETATION
    </div>
    <table style="width: 100%;">
       <tr> <td><b> (80 - 100)</b> </td> <td><b>A</b></td> <td>Excellent</td></tr>
       <tr> <td><b> (60 - 79)</b> </td>  <td><b>B</b></td> <td>Very Good</td></tr>
       <tr> <td><b> (40 - 59)</b> </td>  <td><b>C</b></td> <td>Good</td></tr>
       <tr> <td><b> (0 - 39)</b> </td>   <td><b>P</b></td> <td>Poor</td></tr>
    </table>
</div>
</div>



<div style="margin-top:15px;">
${principalSignature}
</div>
<div class="signature-line">
Director/Head
</div>

<div class="next-term-promotion">
<div>
<b>Next Term Begins:</b>
${formatHijrahDate(selectedTerm.nextTermDateBegins?.split("T")[0]) || ""}
</div>


</div>


</div>

</div>

</div>

<script>
window.onload = () => {
setTimeout(() => window.print(), 500);
};
</script>

</body>
</html>
`);

    w.document.close();
  };

  const visibleClasses = isAdmin
    ? classes
    : classes.filter((cls) => cls.id === user?.teacher?.classId);

  const classSubjects = subjects.filter((s) => s.classId === selected?.classId);
  const filtered = students.filter(
    (s) =>
      (!isTeacher || s.classId === user?.teacher?.classId) &&
      (!selectedClassId || s.classId === selectedClassId) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.class.className.toLowerCase().includes(search.toLowerCase()) ||
        s.admissionNumber?.toLowerCase().includes(search.toLowerCase())),
  );
  const isMobile = window.innerWidth < 768;
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Results</h2>
      <ErrorMessage message={error} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
          gap: 20,
          alignItems: "start",
          overflowX: "auto",
        }}
      >
        {/* Student picker */}
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            padding: isMobile ? 12 : 16,
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
            position: isMobile ? "static" : "sticky",
            top: isMobile ? 0 : 24,
            // width: isMobile ? "85vw" : 1024,
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
            <option value="">Select term...</option>
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
            Class
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            style={{ ...inputStyle, marginBottom: 14, fontSize: 13 }}
          >
            <option value="">Select Class</option>
            {visibleClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className}
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

                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "flex-start",
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
                {report?.academics.length > 0 && (
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
                            disabled
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

                        <FormField label="Absent">
                          <input
                            value={
                              Number(attendance.schoolOpened || 0) -
                              Number(attendance.present || 0)
                            }
                            disabled
                            style={{
                              ...inputStyle,
                              background: "#f9fafb",
                            }}
                          />
                        </FormField>
                      </div>
                    </div>
                    <div
                      style={{
                        overflowX: "auto",
                        width: "100%",
                      }}
                    >
                      <table
                        style={{
                          width: isMobile ? "85%vw" : "100%",
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
                            <tr key={row.id} style={{ margin: " 5px 0" }}>
                              <td>{row.subject}</td>

                              <td>
                                <input
                                  type="number"
                                  min={0}
                                  max={5}
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
                                  min={0}
                                  max={5}
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
                                  min={0}
                                  max={15}
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
                                  min={0}
                                  max={15}
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
                                  min={0}
                                  max={60}
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

                              {/* <td>
                              <Badge
                                label={row.grade}
                                color={gradeColor(row.grade)}
                              />
                            </td> */}

                              {/* <td>{row.subjectPosition}</td>

                            <td>{row.remark}</td> */}
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
                      <h3>Behaviour Assessment</h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(180px,1fr))",
                          gap: 16,
                        }}
                      >
                        {behaviour.map((item, index) => (
                          <FormField key={item.categoryId} label={item.name}>
                            <select
                              value={item.score || "A"}
                              onChange={(e) =>
                                updateBehaviour(index, e.target.value)
                              }
                              style={inputStyle}
                            >
                              {/* <option value="">Select</option> */}
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="P">P</option>
                            </select>
                          </FormField>
                        ))}
                      </div>
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
                      <h3>PSychomotor Assessment</h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(180px,1fr))",
                          gap: 16,
                        }}
                      >
                        {psychomotor.map((item, index) => (
                          <FormField key={item.categoryId} label={item.name}>
                            <select
                              value={item.score || "A"}
                              onChange={(e) =>
                                updatePsychomotor(index, e.target.value)
                              }
                              style={inputStyle}
                            >
                              {/* <option value="">Select</option> */}
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="P">P</option>
                            </select>
                          </FormField>
                        ))}
                      </div>
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
                      <h3>Sports Assessment</h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(180px,1fr))",
                          gap: 16,
                        }}
                      >
                        {sports.map((item, index) => (
                          <FormField key={item.categoryId} label={item.name}>
                            <select
                              value={item.score || ""}
                              onChange={(e) =>
                                updateSports(index, e.target.value)
                              }
                              style={inputStyle}
                            >
                              {/* <option value="">Select</option> */}
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="P">P</option>
                            </select>
                          </FormField>
                        ))}
                      </div>
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
                      <h3>Clubs Assessment</h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(180px,1fr))",
                          gap: 16,
                        }}
                      >
                        {clubs.map((item, index) => (
                          <FormField key={item.categoryId} label={item.name}>
                            <select
                              value={item.score || ""}
                              onChange={(e) =>
                                updateClubs(index, e.target.value)
                              }
                              style={inputStyle}
                            >
                              <option value="">Choose Office</option>
                              <option value="Member">Member</option>
                              <option value="Representative">
                                Representative
                              </option>
                            </select>
                          </FormField>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: isMobile ? 14 : 20,
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
                            rows={isMobile ? 3 : 2}
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
                        <FormField label="Sport Mistress Comment">
                          <textarea
                            rows={isMobile ? 3 : 2}
                            value={comments.sportMistress}
                            onChange={(e) =>
                              setComments({
                                ...comments,
                                sportMistress: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </FormField>

                        <FormField label="Principal Comment">
                          <textarea
                            rows={isMobile ? 3 : 2}
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
                        justifyContent: isMobile ? "stretch" : "flex-end",
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
