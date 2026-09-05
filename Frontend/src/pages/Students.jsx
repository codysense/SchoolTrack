import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useTerm } from "../context/TermContext";
import Modal from "../components/Modal";
import { fileUrl } from "../utils/fileUrl";
import { calculateStudentFeeBreakdown } from "../utils/scholarship";
import {
  Spinner,
  ErrorMessage,
  Badge,
  ActionButton,
  FormField,
  inputStyle,
} from "../components/ui";

const empty = {
  passcode: "",
  admissionNumber: "",
  name: "",

  parentName: "",
  parentPhone: "",
  parentEmail: "",
  parentAddress: "",

  classId: "",
  entryClass: "",
  admissionDate: "",

  gender: "",
  dateOfBirth: "",

  sportHouse: "",

  bloodGroup: "",
  genotype: "",

  height: "",
  weight: "",

  hasScholarship: false,
  scholarshipType: "PERCENTAGE",
  scholarshipValue: "",
  scholarshipTarget: "TUITION",
  scholarshipReason: "",

  status: "ACTIVE",

  passportPhoto: null,
  // existingPassportPhoto: "",
};

export default function Students() {
  // console.log("API URL:", import.meta.env.VITE_API_URL);
  const navigate = useNavigate();
  const { currentTerm, sessions } = useTerm();

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [search, setSearch] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterStatus, setFilterStatus] = useState("ACTIVE");
  const [filterTermId, setFilterTermId] = useState(
    currentTerm ? currentTerm.id : "",
  );
  const [studentId, setStudentId] = useState("");
  const [payments, setPayments] = useState([]);
  const [school, setSchool] = useState(null);

  const allTerms = sessions.flatMap((s) =>
    s.terms.map((t) => ({
      ...t,
      sessionName: s.name,
      label: `${s.name} — ${t.name}${t.isCurrent ? " ✓" : ""}`,
    })),
  );

  // Default filter to current term
  useEffect(() => {
    if (currentTerm && !filterTermId) setFilterTermId(currentTerm.id);
  }, [currentTerm]);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterClassId) params.set("classId", filterClassId);
    if (filterTermId) params.set("termId", filterTermId);
    if (filterStatus) params.set("status", filterStatus);
    Promise.all([api(`/students?${params}`), api("/classes")])
      .then(([s, c, p]) => {
        setStudents(s);
        setClasses(c);
        // setPayments(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [filterClassId, filterTermId, filterStatus]);

  const openCreate = () => {
    setForm(empty);
    setFormErr("");
    setModal("create");
  };

  const openEdit = (e, s) => {
    e.stopPropagation();
    // console.log("Editing student:", s);
    setForm({
      passcode: s.id.slice(-6).toUpperCase(),
      admissionNumber: s.admissionNumber || "",
      name: s.name || "",

      parentName: s.parentName || "",
      parentPhone: s.parentPhone || "",
      parentEmail: s.parentEmail || "",
      parentAddress: s.parentAddress || "",

      classId: s.classId || "",
      entryClass: s.entryClass || "",
      admissionDate: s.admissionDate ? s.admissionDate.split("T")[0] : "",

      gender: s.gender || "",
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split("T")[0] : "",

      sportHouse: s.sportHouse || "",

      bloodGroup: s.bloodGroup || "",
      genotype: s.genotype || "",

      height: s.height || "",
      weight: s.weight || "",

      hasScholarship: Boolean(s.hasScholarship),
      scholarshipType: s.scholarshipType || "PERCENTAGE",
      scholarshipValue: s.scholarshipValue ?? "",
      scholarshipTarget: s.scholarshipTarget || "TUITION",
      scholarshipReason: s.scholarshipReason || "",

      status: s.status || (s.isActive ? "ACTIVE" : "LEFT"),

      passportPhoto: null, // File object for new upload,
      existingPassportPhoto: s.passportPhoto || "",
    });

    setFormErr("");
    setModal(s);
  };
  const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(
    "/api/v1",
    "",
  );
  const photoPreview = form.passportPhoto
    ? URL.createObjectURL(form.passportPhoto)
    : form.existingPassportPhoto
      ? `${API_BASE}${form.existingPassportPhoto}`
      : null;
  console.log("Photo preview URL:", photoPreview);

  const handlePaymentHistory = async (e, s) => {
    e.stopPropagation();

    if (!s?.id) {
      console.log("Student object missing");
      return;
    }

    try {
      setStudentId(s.id);

      const [history, c, school] = await Promise.all([
        api(`/students/${s.id}/payments?termId=${filterTermId}`),
        api("/classes"),
        api("/setup/school"),
      ]);

      setPayments(history);
      setClasses(c);
      setSchool(school);

      const schoolPayments = history.payments || [];
      const optionalPayments = history.optPayments || [];

      const totalSchoolFeesPaid = schoolPayments.reduce(
        (sum, p) => sum + Number(p.amountPaid || 0),
        0,
      );

      const breakdown =
        history.breakdown ||
        calculateStudentFeeBreakdown(s, history.optFeeExpected || 0);

      const expectedSchoolFees = breakdown.expectedSchoolFee;
      const schoolFeeBalance = expectedSchoolFees - totalSchoolFeesPaid;
      const optionalFeeExpected = breakdown.expectedOptFee;
      const optionalFeePaid = history.optFeePaid || 0;
      const optionalFeeBalance = optionalFeeExpected - optionalFeePaid;
      const totalPaid = totalSchoolFeesPaid + optionalFeePaid;
      const grandBalance = schoolFeeBalance + optionalFeeBalance;

      const schoolFeeRows = schoolPayments.length
        ? schoolPayments
            .map(
              (p, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${new Date(p.date).toLocaleDateString("en-GB")}</td>
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
            No school fee payment record found
          </td>
        </tr>
      `;

      const assignedOptFees = history.optFees || [];
      const assignedOptionalFeeRows = assignedOptFees.length
        ? assignedOptFees
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
            <td>
              ${p.optionalFeeAssign?.optionalFee?.name || "-"}
            </td>
            <td style="text-align:left">
              ₦${Number(
                p.optionalFeeAssign?.optionalFee?.amount || 0,
              ).toLocaleString()}
            </td>
            <td>${new Date(p.date).toLocaleDateString("en-GB")}</td>
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
            No optional fee payment record found
          </td>
        </tr>
      `;

      const selectedTerm = allTerms.find((t) => t.id === filterTermId);

      const termLabel = selectedTerm
        ? `${selectedTerm.sessionName} — ${selectedTerm.name}`
        : "N/A";

      const logoHtml = school?.logoUrl
        ? `<img src="${school.logoUrl}" style="height:64px;object-fit:contain;margin-bottom:6px"/>`
        : `<div style="font-size:48px;">🏫</div>`;

      const w = window.open("", "_blank");

      w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Statement of Account</title>

        <style>
          *{
            box-sizing:border-box;
            margin:0;
            padding:0;
          }

          body{
            font-family:'Roboto','Open Sans',sans-serif;
            max-width:950px;
            margin:30px auto;
            padding:20px;
            color:#1a1f36;
          }

          .header{
            text-align:center;
            border-bottom:3px double #111827;
            padding-bottom:18px;
            margin-bottom:25px;
          }

          .header h1{
            font-size:24px;
            margin:6px 0;
          }

          .sub{
            color:#6b7280;
            font-size:13px;
            margin:2px 0;
          }

          .title{
            margin-top:12px;
            font-size:17px;
            font-weight:bold;
            text-transform:uppercase;
            letter-spacing:.06em;
          }

          .student-info{
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:10px;
            margin-bottom:24px;
          }

          .student-info div{
            border:1px solid #e5e7eb;
            padding:10px 12px;
            border-radius:6px;
          }

          .student-info span{
            display:block;
            font-size:10px;
            color:#9ca3af;
            text-transform:uppercase;
            margin-bottom:4px;
          }

          .section-title{
            margin:30px 0 12px;
            font-size:16px;
            font-weight:700;
            color:#111827;
          }

          table{
            width:100%;
            border-collapse:collapse;
            margin-bottom:20px;
          }

          th{
            background:#f9fafb;
            padding:10px;
            font-size:12px;
            text-transform:uppercase;
            border-bottom:2px solid #e5e7eb;
            text-align:left;
          }

          td{
            padding:10px;
            border-bottom:1px solid #f3f4f6;
            font-size:14px;
          }

          .summary{
            margin-top:30px;
            display:grid;
            grid-template-columns:repeat(4,1fr);
            border:1px solid #e5e7eb;
            border-radius:8px;
            overflow:hidden;
          }

          .summary div{
            padding:16px;
            text-align:center;
            border-right:1px solid #e5e7eb;
          }

          .summary div:last-child{
            border-right:none;
          }

          .summary .label{
            font-size:11px;
            color:#9ca3af;
            text-transform:uppercase;
            margin-bottom:5px;
          }

          .summary .val{
            font-size:22px;
            font-weight:700;
          }

          .green{
            color:#16a34a;
          }

          .red{
            color:#dc2626;
          }

          .footer{
            margin-top:45px;
            border-top:2px dashed #d1d5db;
            padding-top:20px;
          }

          .bank-box{
            background:#f9fafb;
            border-radius:8px;
            padding:16px;
            line-height:1.9;
            font-size:14px;
          }

          .signatures{
            margin-top:55px;
            display:flex;
            justify-content:space-between;
            gap:40px;
          }

          .sign{
            flex:1;
            border-top:1px solid #111827;
            padding-top:8px;
            text-align:center;
            font-size:12px;
            color:#6b7280;
          }

          @media print{
            body{
              margin:10px;
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

          <div class="title">
            Student Statement of Account
          </div>
        </div>

        <div class="student-info">

          <div>
            <span>Student Name</span>
            ${s.name}
          </div>

          <div>
            <span>Admission Number</span>
            ${s.admissionNumber || "-"}
          </div>

          <div>
            <span>Class</span>
            ${s.class?.className || "-"}
          </div>

          <div>
            <span>Session / Term</span>
            ${termLabel}
          </div>

          <div>
            <span>Date Generated</span>
            ${new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>

          <div>
            <span>Parent Phone</span>
            ${s.parentPhone || "-"}
          </div>

          ${
            breakdown.hasScholarship
              ? `
          <div style="grid-column:1 / -1; background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9;">
            <span>Scholarship / Fee Concession</span>
            <strong>🎓 ${breakdown.scholarshipType === "PERCENTAGE" ? `${breakdown.scholarshipValue}%` : `₦${Number(breakdown.scholarshipValue).toLocaleString()}`} ${breakdown.scholarshipTarget === "TOTAL" ? "Total Fees" : "Tuition"} Scholarship</strong>
            ${breakdown.scholarshipReason ? ` <i>(${breakdown.scholarshipReason})</i>` : ""} — 
            Standard Tuition: ₦${Number(breakdown.baseSchoolFee).toLocaleString()} | Discount: -₦${Number(breakdown.totalDiscount).toLocaleString()} | Net Expected: ₦${Number(breakdown.expectedSchoolFee).toLocaleString()}
          </div>`
              : ""
          }

        </div>

        <div class="section-title">
          School Fees Payment History
        </div>

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

        <div class="section-title">
          Assigned Optional Fees Breakdown (Bill Items)
        </div>

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

        <div class="section-title">
          Optional Fees Payment History
        </div>

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
            <div class="label">
              School Fees Balance
            </div>

            <div class="val red">
              ₦${schoolFeeBalance.toLocaleString()}
            </div>
          </div>

          <div>
            <div class="label">
              Optional Fees Balance
            </div>

            <div class="val red">
              ₦${optionalFeeBalance.toLocaleString()}
            </div>
          </div>

          <div>
            <div class="label">
              Total Paid
            </div>

            <div class="val green">
              ₦${totalPaid.toLocaleString()}
            </div>
          </div>

          <div>
            <div class="label">
              Outstanding Balance
            </div>

            <div class="val red">
              ₦${grandBalance.toLocaleString()}
            </div>
          </div>

        </div>

        <div class="footer">

          <h3 style="margin-bottom:10px;">
            School Bank Details
          </h3>

          <div class="bank-box">
            Bank Name: <strong>${school?.bankName || "-"}</strong> <br/>
            Account Name: <strong>${school?.accountName || "-"}</strong> <br/>
            Account Number: <strong>${school?.accountNumber || "-"}</strong> <br/>
          </div>

          <div class="signatures">
            <div class="sign">
              Bursar Signature
            </div>

            <div class="sign">
              School Management
            </div>
          </div>

        </div>

        <script>
          window.onload = () => window.print()
        </script>

      </body>
      </html>
    `);

      w.document.close();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return setFormErr("Name is required");
    if (!form.parentPhone.trim()) return setFormErr("Parent phone is required");
    if (!form.classId) return setFormErr("Select a class");
    setSaving(true);

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        payload.append(key, value);
      }
    });

    try {
      if (modal === "create") {
        await api("/students", {
          method: "POST",
          body: payload,
        });
      } else {
        await api(`/students/${modal.id}`, { method: "PUT", body: payload });
      }
      setModal(null);
      load();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this student and all their records permanently?"))
      return;
    await api(`/students/${id}`, { method: "DELETE" }).catch((err) =>
      alert(err.message),
    );
    load();
  };

  const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.class.className.toLowerCase().includes(search.toLowerCase()) ||
      s.parentPhone.includes(search) ||
      s.admissionNumber?.toLowerCase().includes(search.toLowerCase()),
  );

  const formGridStyle = {
    display: "grid",
    gridTemplateColumns:
      window.innerWidth < 768 ? "1fr" : "repeat(2, minmax(0, 1fr))",
    gap: 14,
  };
  if (loading && !students.length) return <Spinner />;

  return (
    <div>
      {/* Header */}
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
        <h2 style={{ margin: 0 }}>
          Students
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: "#9ca3af",
              marginLeft: 8,
            }}
          >
            ({students.length})
          </span>
        </h2>
        <ActionButton onClick={openCreate}>+ Add Student</ActionButton>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* Filters */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}
      >
        <input
          placeholder="Search by name, class, phone or admission no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, maxWidth: 320, fontSize: 13 }}
        />
        <select
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          style={{ ...inputStyle, maxWidth: 160, fontSize: 13 }}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.className}
            </option>
          ))}
        </select>
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
          style={{ ...inputStyle, maxWidth: 240, fontSize: 13 }}
        >
          <option value="">Balance: all time</option>
          {allTerms.map((t) => (
            <option key={t.id} value={t.id}>
              Balance: {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
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
                    "Adm. No.",
                    "Name",
                    "Class",
                    "Phone",
                    "Paid",
                    "Balance",
                    "Actions",
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
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/students/${s.id}`)}
                    style={{
                      borderTop: "1px solid #f3f4f6",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f9fafb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "")
                    }
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      {s.admissionNumber}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{s.name}</span>
                        {s.status && s.status !== "ACTIVE" && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              textTransform: "uppercase",
                              background:
                                s.status === "GRADUATED"
                                  ? "#e0e7ff"
                                  : s.status === "SUSPENDED"
                                    ? "#ffedd5"
                                    : s.status === "EXPELLED"
                                      ? "#fee2e2"
                                      : "#f3f4f6",
                              color:
                                s.status === "GRADUATED"
                                  ? "#4338ca"
                                  : s.status === "SUSPENDED"
                                    ? "#c2410c"
                                    : s.status === "EXPELLED"
                                      ? "#b91c1c"
                                      : "#4b5563",
                            }}
                          >
                            {s.status}
                          </span>
                        )}
                      </div>
                      {s.hasScholarship && Number(s.scholarshipValue) > 0 && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#7c3aed",
                            background: "#f5f3ff",
                            border: "1px solid #ddd6fe",
                            padding: "1px 6px",
                            borderRadius: 10,
                          }}
                        >
                          🎓 {s.scholarshipType === "PERCENTAGE" ? `${s.scholarshipValue}%` : fmt(s.scholarshipValue)}{" "}
                          {s.scholarshipTarget === "TOTAL" ? "Total" : "Tuition"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>
                      {s.class.className}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#6b7280",
                        fontSize: 13,
                      }}
                    >
                      {s.parentPhone}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: 600,
                        color: "#10b981",
                      }}
                    >
                      {fmt(s.totalPaid)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge
                        label={fmt(s.balance)}
                        color={
                          s.balance <= 0
                            ? "green"
                            : s.balance < s.totalFee
                              ? "yellow"
                              : "red"
                        }
                      />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <ActionButton
                          size="sm"
                          variant="secondary"
                          onClick={(e) => openEdit(e, s)}
                        >
                          Edit
                        </ActionButton>
                        <ActionButton
                          size="sm"
                          variant="danger"
                          onClick={(e) => del(e, s.id)}
                        >
                          Delete
                        </ActionButton>
                        <ActionButton
                          size="sm"
                          variant="primary"
                          onClick={(e) => handlePaymentHistory(e, s)}
                        >
                          Get Payment History
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "40px 14px",
                        textAlign: "center",
                        color: "#9ca3af",
                      }}
                    >
                      {search
                        ? "No students match your search"
                        : "No students registered yet"}
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
          title={modal === "create" ? "Add Student" : "Edit Student"}
          onClose={() => setModal(null)}
          width="900px"
        >
          <ErrorMessage message={formErr} />

          <div
            style={{
              formGridStyle,
            }}
          >
            <h4 style={{ margin: "24px 0 12px" }}>Passport Information</h4>

            <div style={formGridStyle}>
              {/* <div style={{ gridColumn: "1 / -1" }}> */}
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{
                    width: 120,
                    height: 140,
                    objectFit: "cover",
                    borderRadius: 8,
                    marginTop: 10,
                    border: "1px solid #e5e7eb",
                  }}
                />
              )}
              <FormField label="Passport Photo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      passportPhoto: e.target.files[0],
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Passcode">
                <input
                  disabled
                  value={form.passcode}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      passcode: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              {/* </div> */}
            </div>
            {/* Academic Information */}
            <h4 style={{ marginBottom: 12 }}>Academic Information</h4>

            <div style={formGridStyle}>
              <FormField
                label="Admission Number"
                hint="Leave blank to auto-generate"
              >
                <input
                  value={form.admissionNumber}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      admissionNumber: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Full Name">
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      name: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Class">
                <select
                  value={form.classId}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      classId: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Select class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Entry Class">
                <select
                  value={form.entryClass}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      entryClass: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Select class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className}
                    </option>
                  ))}
                </select>
                {/* <input
                  value={form.entryClass}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      entryClass: e.target.value,
                    }))
                  }
                  style={inputStyle}
                /> */}
              </FormField>

              <FormField label="Admission Date">
                <input
                  type="date"
                  value={form.admissionDate}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      admissionDate: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Student Status">
                <select
                  value={form.status || "ACTIVE"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="LEFT">Left / Transferred</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="EXPELLED">Expelled</option>
                </select>
              </FormField>
            </div>

            {/* Student Information */}
            <h4 style={{ margin: "24px 0 12px" }}>Student Information</h4>

            <div style={formGridStyle}>
              <FormField label="Gender">
                <select
                  value={form.gender}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      gender: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </FormField>

              <FormField label="Date of Birth">
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      dateOfBirth: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Sport House">
                <select
                  value={form.sportHouse}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      sportHouse: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Select Sport House</option>
                  <option value="Blue">Blue</option>
                  <option value="Green">Green</option>
                  <option value="Red">Red</option>
                  <option value="Yellow">Yellow</option>
                </select>
              </FormField>
            </div>

            {/* Parent Information */}
            <h4 style={{ margin: "24px 0 12px" }}>
              Parent / Guardian Information
            </h4>

            <div style={formGridStyle}>
              <FormField label="Parent Name">
                <input
                  value={form.parentName}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      parentName: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Parent Phone">
                <input
                  value={form.parentPhone}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      parentPhone: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Parent Email">
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      parentEmail: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <div style={{ gridColumn: "1 / -1" }}>
                <FormField label="Parent Address">
                  <textarea
                    rows={3}
                    value={form.parentAddress}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        parentAddress: e.target.value,
                      }))
                    }
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                    }}
                  />
                </FormField>
              </div>
            </div>

            {/* Health Information */}
            <h4 style={{ margin: "24px 0 12px" }}>Health Information</h4>

            <div style={formGridStyle}>
              <FormField label="Blood Group">
                <select
                  value={form.bloodGroup}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      bloodGroup: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>B-</option>
                  <option>AB+</option>
                  <option>AB-</option>
                  <option>O+</option>
                  <option>O-</option>
                </select>
              </FormField>

              <FormField label="Genotype">
                <select
                  value={form.genotype}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      genotype: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  <option>AA</option>
                  <option>AS</option>
                  <option>SS</option>
                  <option>AC</option>
                  <option>SC</option>
                </select>
              </FormField>
            </div>

            {/* Physical Information */}
            <h4 style={{ margin: "24px 0 12px" }}>Physical Information</h4>

            <div style={formGridStyle}>
              <FormField label="Height (m)">
                <input
                  type="number"
                  step="0.01"
                  value={form.height}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      height: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Weight (kg)">
                <input
                  type="number"
                  step="0.1"
                  value={form.weight}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      weight: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>
            </div>

            {/* Scholarship & Financial Aid */}
            <h4 style={{ margin: "24px 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span>🎓 Scholarship & Fee Discount</span>
            </h4>

            <div
              style={{
                background: form.hasScholarship ? "#f5f3ff" : "#f9fafb",
                border: form.hasScholarship ? "1px solid #c4b5fd" : "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
                transition: "all 0.2s",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  color: form.hasScholarship ? "#6d28d9" : "#374151",
                  marginBottom: form.hasScholarship ? 14 : 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(form.hasScholarship)}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      hasScholarship: e.target.checked,
                    }))
                  }
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                Apply Scholarship / Fee Concession
              </label>

              {form.hasScholarship && (
                <>
                  <div style={formGridStyle}>
                    <FormField label="Discount Type">
                      <select
                        value={form.scholarshipType || "PERCENTAGE"}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            scholarshipType: e.target.value,
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Amount (₦)</option>
                      </select>
                    </FormField>

                    <FormField
                      label={
                        form.scholarshipType === "PERCENTAGE"
                          ? "Discount Percentage (%)"
                          : "Discount Amount (₦)"
                      }
                    >
                      <input
                        type="number"
                        min="0"
                        max={form.scholarshipType === "PERCENTAGE" ? 100 : undefined}
                        step={form.scholarshipType === "PERCENTAGE" ? "1" : "500"}
                        placeholder={
                          form.scholarshipType === "PERCENTAGE"
                            ? "e.g. 50"
                            : "e.g. 20000"
                        }
                        value={form.scholarshipValue}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            scholarshipValue: e.target.value,
                          }))
                        }
                        style={inputStyle}
                      />
                    </FormField>

                    <FormField label="Apply Discount To">
                      <select
                        value={form.scholarshipTarget || "TUITION"}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            scholarshipTarget: e.target.value,
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="TUITION">School Fees (Tuition) Only</option>
                        <option value="TOTAL">Total Fees (Tuition + Optional)</option>
                      </select>
                    </FormField>

                    <FormField label="Scholarship Reason / Category (Optional)">
                      <input
                        type="text"
                        placeholder="e.g. Merit Award, Staff Child, Orphan Aid"
                        value={form.scholarshipReason}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            scholarshipReason: e.target.value,
                          }))
                        }
                        style={inputStyle}
                      />
                    </FormField>
                  </div>

                  {/* Real-time preview */}
                  {(() => {
                    const selectedClass = classes.find((c) => c.id === form.classId);
                    const classFee = selectedClass?.feeAmount || 0;
                    const previewBreakdown = calculateStudentFeeBreakdown(
                      {
                        hasScholarship: true,
                        scholarshipType: form.scholarshipType,
                        scholarshipValue: form.scholarshipValue,
                        scholarshipTarget: form.scholarshipTarget,
                        class: { feeAmount: classFee },
                      },
                      0,
                    );

                    return (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "10px 14px",
                          background: "#fff",
                          borderRadius: 6,
                          border: "1px dashed #c4b5fd",
                          display: "flex",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <span style={{ color: "#6b7280" }}>Standard Tuition: </span>
                          <strong>{fmt(classFee)}</strong>
                        </div>
                        <div>
                          <span style={{ color: "#6b7280" }}>Discount: </span>
                          <strong style={{ color: "#7c3aed" }}>
                            -{fmt(previewBreakdown.schoolFeeDiscount)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: "#6b7280" }}>Net Expected Tuition: </span>
                          <strong style={{ color: "#16a34a" }}>
                            {fmt(previewBreakdown.expectedSchoolFee)}
                          </strong>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          <div style={{ formGridStyle, marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <ActionButton variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </ActionButton>
              <ActionButton disabled={saving} onClick={save}>
                {saving
                  ? "Saving…"
                  : modal === "create"
                    ? "Register Student"
                    : "Save Changes"}
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
