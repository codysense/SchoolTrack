import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Spinner, ErrorMessage } from "../components/ui";
import {
  getOrdinal,
  getOrdinalHijri,
  formatNameWithComma,
  formatHijrahDate,
} from "./Results";
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
      api("/portal/school-info").catch(() => null),
    ])
      .then(([p, s]) => {
        setProfile(p);
        setSchool(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  //console.log({ Profile: profile, School: school });

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
    //  `/results/student-result/${studentId}?termId=${termId}&classId=${classId}`,
    try {
      const r = await api(
        `/portal/results/${profile.id}?termId=${termData.termId}&classId=${profile?.classId}`,
      );
      setResults(r);

      console.log("Entered Results:", r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingResults(false);
    }
  };

  console.log("Active term", activeTerm);

  const API_BASE = (import.meta.env.VITE_API_URL || "/api/V1").replace(
    "/api/V1",
    "",
  );
  const getMediaUrl = (value) =>
    value?.startsWith("http") ? value : `${API_BASE}${value}`;

  const classOrder = [
    "preschool",
    "preparatory class 1",
    "preparatory class 2",
    "preparatory class 3",
    "primary 1",
    "primary 2",
    "primary 3",
    "primary 4",
    "primary 5",
    "primary 6",
  ];

  const printResult = () => {
    if (!results || !activeTerm || !profile) return;

    const selectedTerm = activeTerm.termId;
    // console.log("Select Term", activeTerm);

    const promotioninfo =
      results.summary?.termAverages.cummulative <= 39
        ? "Advised to discuss with the school Management"
        : "Promoted";

    const currentClass = results.student?.class?.className.toLowerCase();
    let promotionRemark = "";

    if (promotioninfo === "Promoted" && currentClass !== "primary 6") {
      //Determine current class index in the class order array and get the next class for promotion remark
      const currentClassIndex = classOrder.indexOf(currentClass);
      promotionRemark = `Promoted to ${classOrder[currentClassIndex + 1]}`;
    } else if (promotioninfo === "Promoted" && currentClass === "primary 6") {
      promotionRemark = "Completed primary education and transited to JSS 1";
    } else {
      promotionRemark = promotioninfo;
    }

    const watermarkHtml = school?.logoUrl
      ? `
    <div class="watermark">
      <img src="${getMediaUrl(school.logoUrl)}" />
    </div>
  `
      : "";
    const termLabel = selectedTerm
      ? `${selectedTerm.sessionName} — ${selectedTerm.name}`
      : "";
    const attendance = results.attendance || {};

    const behaviour = results.assessments?.behaviour || [];
    const psychomotor = results.assessments?.psychomotor || [];
    const sports = results.assessments?.sports || [];
    const clubs = results.assessments?.clubs || [];

    const comments = results.comments || {};

    const student = results.student || {};

    const absent = (attendance.schoolOpened || 0) - (attendance.present || 0);

    const classSection = [
      "preschool",
      "preparatory class 1",
      "preparatory class 2",
      "preparatory class 3",
    ].includes(results.student.class.className.toLowerCase())
      ? "Nursery Section"
      : "Primary Section";

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

    const subjectRows = results.subjects
      .map(
        (r) => `
<tr>
<td>${r.subject}</td>

<td>${r.attendanceScore ?? 0}</td>

<td>${r.assignmentScore ?? 0}</td>

${classSection.toLowerCase() === "primary section" ? <td>${r.ca1Score ?? 0}</td> : ""}

<td>${r.ca2Score ?? 0}</td>

<td>${r.examScore ?? 0}</td>

<td style="font-weight:700">
${r.TotalScore ?? 0}
</td>

${activeTerm?.termName === "Second Term" || activeTerm?.termName === "Third Term" ? `<td>${r.firstTermScore ?? "-"}</td>` : ""}

${activeTerm?.termName === "Third Term" ? `<td>${r.secondTermScore ?? "-"}</td>` : ""}

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

    //     w.document.write(`
    // <!DOCTYPE html>
    // <html>
    // <head>
    // <title>${student.name} Report Card</title>

    // <style>

    // *{
    // margin:0;
    // padding:0;
    // box-sizing:border-box;
    // }

    // .report-card{
    //   position:relative;
    //   width:100%;
    // }

    // .watermark{
    //   position:fixed;
    //   top:50%;
    //   left:50%;
    //   transform:translate(-50%, -50%);
    //   z-index:0;
    //   pointer-events:none;
    // }

    // .watermark img{
    //   width:800px;
    //   height:800px;
    //   object-fit:contain;
    //   opacity:0.06;
    // }

    // @media print{

    //   .watermark{
    //     position:fixed;
    //     top:50%;
    //     left:50%;
    //     transform:translate(-50%, -50%);
    //   }

    //   .watermark img{
    //     opacity:0.05;
    //     -webkit-print-color-adjust:exact;
    //     print-color-adjust:exact;
    //   }

    // }

    // body{
    // font-family:Arial,sans-serif;
    // padding:20px;
    // color:#111827;
    // }

    // :root{
    // --primary:#10b981;
    // --light:#d1fae5;
    // }

    // .report-card{
    // width:100%;
    // }

    // .header{
    // display:grid;
    // grid-template-columns:120px 1fr 120px;
    // gap:15px;
    // align-items:center;
    // margin-bottom:15px;
    // }

    // .logo{
    // width:150px;
    // height:150px;
    // object-fit:contain;
    // }

    // .passport{
    // width:100px;
    // height:120px;
    // object-fit:cover;
    // border:1px solid #cbd5e1;
    // }

    // .school-info{
    // text-align:center;
    // }

    // .school-name{
    // font-size:26px;
    // font-weight:700;
    // color:#0c4a6e;
    // }

    // .school-address{
    // font-size:12px;
    // margin-top:4px;
    // }

    // .report-title{
    // font-size:28px;
    // font-weight:700;
    // color:#0c4a6e;
    // margin-top:10px;
    // }

    // .student-name{
    // font-size:32px;
    // font-weight:700;
    // font-style:italic;
    // text-align:center;
    // margin:15px 0;
    // color:#0c4a6e;
    // }

    // .student-grid{
    // display:grid;
    // grid-template-columns:repeat(4,1fr);
    // gap:8px;
    // margin-bottom:15px;
    // font-size:13px;
    // }

    // .section-title{
    // background:var(--primary);
    // color:white;
    // padding:8px;
    // font-weight:700;
    // margin-top:12px;
    // margin-bottom:5px;
    // }

    // table{
    // width:100%;
    // border-collapse:collapse;
    // margin-bottom:12px;
    // }

    // th{
    // background:var(--light);
    // color:#0c4a6e;
    // font-size:12px;
    // padding:6px;
    // border:1px solid #93c5fd;
    // }

    // td{
    // padding:6px;
    // border:1px solid #cbd5e1;
    // font-size:12px;
    // }

    // .assessment-grid{
    // display:grid;
    // grid-template-columns:repeat(2,1fr);
    // gap:8px;
    // margin-bottom:12px;
    // }

    // .assessment-item{
    // display:flex;
    // justify-content:space-between;
    // padding:8px;
    // border:1px solid #cbd5e1;
    // background:#f8fafc;
    // }

    // .summary{
    // display:grid;
    // grid-template-columns:repeat(6,1fr);
    // gap:8px;
    // margin-top:10px;
    // }

    // .summary-card{
    // background:#d1fae5;
    // padding:10px;
    // text-align:center;
    // border-radius:6px;
    // }

    // .summary-card .label{
    // font-size:11px;
    // color:#0c4a6e;
    // }

    // .summary-card .value{
    // font-size:18px;
    // font-weight:700;
    // margin-top:4px;
    // }

    // .comment-box{
    // border:1px solid #cbd5e1;
    // padding:10px;
    // margin-bottom:10px;
    // min-height:60px;
    // }

    // .grade{
    // font-weight:bold;
    // }

    // .signature-section{
    // margin-top:30px;
    // display:flex;
    // justify-content:space-between;
    // align-items:flex-end;
    // }

    // .signature-image{
    // height:60px;
    // object-fit:contain;
    // }

    // .signature-line{
    // width:220px;
    // border-top:1px solid #111827;
    // padding-top:5px;
    // text-align:center;
    // font-size:12px;
    // }

    // @media print{

    // body{
    // padding:10px;
    // }

    // .section-title{
    // -webkit-print-color-adjust:exact;
    // print-color-adjust:exact;
    // }

    // th{
    // -webkit-print-color-adjust:exact;
    // print-color-adjust:exact;
    // }

    // }

    // </style>

    // </head>

    // <body>

    // <div class="report-card">
    // ${watermarkHtml}
    // <div class="header">

    // <div>
    // ${logoHtml}
    // </div>

    // <div class="school-info">
    // <div class="school-name">
    // ${school?.name || ""}
    // </div>

    // <div class="school-address">
    // ${school?.address || ""}
    // </div>

    // <div class="report-title">
    // REPORT SHEET
    // </div>
    // </div>

    // <div>
    // ${passportHtml}
    // </div>

    // </div>

    // <div class="student-name">
    // ${student.name}
    // </div>

    // <div class="student-grid">

    // <div>
    // <b>Admission No:</b><br/>
    // ${student.admissionNumber || ""}
    // </div>

    // <div>
    // <b>Class:</b><br/>
    // ${student.class.className || ""}
    // </div>

    // <div>
    // <b>Session:</b><br/>
    // ${activeTerm?.sessionName || ""}
    // </div>

    // <div>
    // <b>Term:</b><br/>
    // ${activeTerm?.termName || ""}
    // </div>

    // <div>
    // <b>Gender:</b><br/>
    // ${student.gender || ""}
    // </div>

    // <div>
    // <b>Date Of Birth:</b><br/>
    // ${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : ""}
    // </div>

    // <div>
    // <b>Class Size:</b><br/>
    // ${results.summary.classSize}
    // </div>

    // <div>
    // <b>Date:</b><br/>
    // ${new Date().toLocaleDateString()}
    // </div>

    // </div>

    // <div class="section-title">
    // 1. ATTENDANCE
    // </div>

    // <table>

    // <tr>
    // <td>School Opened</td>
    // <td>${attendance.schoolOpened || 0}</td>
    // </tr>

    // <tr>
    // <td>Present</td>
    // <td>${attendance.present || 0}</td>
    // </tr>

    // <tr>
    // <td>Absent</td>
    // <td>${absent}</td>
    // </tr>

    // </table>

    // <div class="section-title">
    // 2. BEHAVIOUR
    // </div>

    // <div class="assessment-grid">
    // ${renderAssessmentGrid(behaviour)}
    // </div>

    // <div class="section-title">
    // 3. PSYCHOMOTOR
    // </div>

    // <div class="assessment-grid">
    // ${renderAssessmentGrid(psychomotor)}
    // </div>

    // <div class="section-title">
    // 4. PERFORMANCE IN SUBJECTS
    // </div>

    // <table>

    // <thead>

    // <tr>

    // <th>Subject</th>

    // <th>Att</th>

    // <th>Assign</th>

    // <th>CA1</th>

    // <th>CA2</th>

    // <th>Exam</th>

    // <th>Total</th>

    // ${activeTerm?.termName === "Second Term" || activeTerm?.termName === "Third Term" ? "<th>1st</th>" : ""}

    // ${activeTerm?.termName === "Third Term" ? "<th>2nd</th>" : ""}

    // <th>Grade</th>

    // <th>Pos</th>

    // <th>Remark</th>

    // </tr>

    // </thead>

    // <tbody>

    // ${subjectRows}

    // </tbody>

    // </table>

    // <div class="summary">

    // <div class="summary-card">
    // <div class="label">Total</div>
    // <div class="value">${results.summary.totalScore}</div>
    // </div>

    // <div class="summary-card">
    // <div class="label">Average</div>
    // <div class="value">${results.summary.average}%</div>
    // </div>

    // <div class="summary-card">
    // <div class="label">Grade</div>
    // <div class="value">${results.summary.finalGrade}</div>
    // </div>

    // <div class="summary-card">
    // <div class="label">Position</div>
    // <div class="value">${getOrdinal(results.summary.position)}</div>
    // </div>

    // <div class="summary-card">
    // <div class="label">Subjects</div>
    // <div class="value">${results.summary.subjectsOffered}</div>
    // </div>

    // <div class="summary-card">
    // <div class="label">Class Size</div>
    // <div class="value">${results.summary.classSize}</div>
    // </div>

    // </div>

    // <div class="section-title">
    // 5. SPORTS
    // </div>

    // <div class="assessment-grid">
    // ${renderAssessmentGrid(sports)}
    // </div>

    // <div class="section-title">
    // 6. CLUBS
    // </div>

    // <div class="assessment-grid">
    // ${renderAssessmentGrid(clubs)}
    // </div>

    // <div class="section-title">
    // TEACHER COMMENT
    // </div>

    // <div class="comment-box">
    // ${comments.teacher || ""}
    // </div>

    // <div class="section-title">
    // PRINCIPAL COMMENT
    // </div>

    // <div class="comment-box">
    // ${comments.principal || ""}
    // </div>

    // <div class="signature-section">

    // <div class="signature-line">
    // Class Teacher
    // </div>

    // <div>
    // ${principalSignature}
    // <div class="signature-line">
    // Principal
    // </div>
    // </div>

    // </div>

    // </div>

    // <script>
    // window.onload = () => {
    // setTimeout(() => window.print(), 500);
    // };
    // </script>

    // </body>
    // </html>
    // `);
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
  grid-template-columns:repeat(8,1fr);
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
  height:30px;
  object-fit:contain;
  padding-left:80px;
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
  ${activeTerm?.termName.toUpperCase() || ""} ${activeTerm?.sessionName || ""} REPORT SHEET
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
  <b>Absent: </b>
  ${attendance.absent || 0}
  </div>
  
  <div>
  <b>Gender:</b>
  ${student.gender || ""}
  </div>
  
  <div>
  <b>Date of Birth:</b>
  ${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : ""}
  </div>
  
  
  
  <div>
  <b>Term Closed:</b>
  ${formatHijrahDate(results.term.termCloseDate?.split("T")[0]) || ""}
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
  
  <th>Subjects</th>
  
  <th>Attendance</th>
  
  <th>Assignment</th>
  
  ${classSection.toLowerCase() === "primary section" ? "<th>CA1</th>" : ""}

  ${classSection.toLowerCase() === "primary section" ? "<th>CA2</th>" : "<th>CA</th>"}
  <th>Exam</th>
  
  <th>Total</th>
  
  ${activeTerm?.termName === "Second Term" || activeTerm?.termName === "Third Term" ? "<th>1st Term</th>" : ""}
  
  ${activeTerm?.termName === "Third Term" ? "<th>2nd Term</th>" : ""}
  
  <th>Grade</th>
  
  <th>Position</th>
  
  <th>Remarks</th>
  
  </tr>
  
  </thead>
  
  <tbody>
  
  ${subjectRows}
  
  </tbody>
  
  </table>
  
  <div class="summary">
  
  <div class="summary-card">
  <div class="label">Total</div>
  <div class="value">${results.summary.totalScore}</div>
  </div>
  
  <div class="summary-card">
  <div class="label">Average</div>
  <div class="value">${results.summary.average}%</div>
  </div>
  
  <div class="summary-card">
  <div class="label">Grade</div>
  <div class="value">${results.summary.finalGrade}</div>
  </div>
  
  <div class="summary-card">
  <div class="label">Position</div>
  <div class="value">${activeTerm?.termName === "Third Term" ? getOrdinal(results.summary?.termTotals.position) : getOrdinal(results.summary.position)}</div>
  </div>
  
  <div class="summary-card">
  <div class="label">Subjects</div>
  <div class="value">${results.summary.subjectsOffered}</div>
  </div>
  
  <div class="summary-card">
  <div class="label">No in Class</div>
  <div class="value">${results.summary.classSize}</div>
  </div>

<div class="summary-card">
<div class="label">Cummulative Total</div>
<div class="value">${activeTerm?.termName === "Third Term" ? results.summary.termTotals.cumulativeTotal : "-"}</div>
</div>

<div class="summary-card">
<div class="label">Cummulative Average</div>
<div class="value">${activeTerm?.termName === "Third Term" ? Number(results.summary.termAverages.cumulative?.toFixed(2)) + "%" : "-"}</div>
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
  ${formatHijrahDate(results.term.nextTermDateBegins?.split("T")[0]) || ""}
  </div>

  <div>
      <strong> ${activeTerm?.termName === "Third Term" ? promotionRemark : ""}</strong>
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
            {school?.name || "SchoolTrack"}
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
                                      "Assignment",
                                      "ca1Score",
                                      "ca2Score",
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
                                        {r.assignmentScore}
                                      </td>

                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {r.attendanceScore}
                                      </td>

                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {r.ca1Score}
                                      </td>
                                      <td
                                        style={{
                                          padding: "9px 14px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {r.ca2Score}
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
