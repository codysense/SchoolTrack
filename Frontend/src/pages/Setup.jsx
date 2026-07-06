import { useEffect, useState } from "react";
import { api } from "../api/client";
import Modal from "../components/Modal";
import {
  Spinner,
  ErrorMessage,
  Badge,
  ActionButton,
  FormField,
  inputStyle,
} from "../components/ui";

export default function Setup() {
  const [tab, setTab] = useState("school"); // 'school' | 'users'

  // School info
  const [school, setSchool] = useState(null);
  const [schoolForm, setSchoolForm] = useState({});
  const [schoolSaving, setSchoolSaving] = useState(false);
  const [schoolMsg, setSchoolMsg] = useState("");

  // Users
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | 'create' | user obj
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "TEACHER",
    classId: "",
    subjectName: "",
  });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [assessmentCategories, setAssessmentCategories] = useState({});
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  const [assessmentModal, setAssessmentModal] = useState(null);

  const [assessmentForm, setAssessmentForm] = useState({
    id: "",
    name: "",
    type: "Behaviour",
    description: "",
  });

  const loadAssessmentCategories = async () => {
    try {
      setAssessmentLoading(true);

      const data = await api("/assessment-categories");

      setAssessmentCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAssessmentLoading(false);
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      api("/setup/school"),
      api("/setup/users"),
      api("/classes"),
      api("/assessment-categories"),
    ])
      .then(([s, u, c, categories]) => {
        setSchool(s);
        setSchoolForm({
          name: s.name,
          address: s.address || "",
          phone: s.phone || "",
          email: s.email || "",
          motto: s.motto || "",
          logoUrl: s.logoUrl || "",
          principalSignatureUrl: s.principalSignatureUrl || "",
          website: s.website || "",
          bankName: s.bankName || "",
          accountName: s.accountName || "",
          accountNumber: s.accountNumber || "",
        });
        setAssessmentCategories(categories);
        setUsers(u);
        setClasses(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  // payload is built on submit to include any selected file

  // ── School info ───────────────────────────────────────────────────────────
  
const saveSchool = async () => {
  setSchoolSaving(true);
  setSchoolMsg("");
  try {
    const payload = new FormData();

    Object.entries(schoolForm).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        // Just append with the original key. 
        // This works perfectly for both text and file objects.
        payload.append(key, value);
      }
    });

    const updated = await api("/setup/school", {
      method: "PUT",
      body: payload,
    });
    setSchool(updated);
    setSchoolMsg("School information saved successfully.");
  } catch (e) {
    setSchoolMsg(`Error: ${e.message}`);
  } finally {
    setSchoolSaving(false);
  }
};
  
  // const saveSchool = async () => {
  //   setSchoolSaving(true);
  //   setSchoolMsg("");
  //   try {
  //     const payload = new FormData();

  //     Object.entries(schoolForm).forEach(([key, value]) => {
  //       if (value !== undefined && value !== null && value !== "") {
  //         if (value instanceof File) {
  //           // backend expects file field name 'logo'
  //           payload.append("logo", value);
  //           payload.append("principalSignature", value);
  //         } else {
  //           payload.append(key, value);
  //         }
  //       }
  //     });

  //     const updated = await api("/setup/school", {
  //       method: "PUT",
  //       body: payload,
  //     });
  //     setSchool(updated);
  //     setSchoolMsg("School information saved successfully.");
  //   } catch (e) {
  //     setSchoolMsg(`Error: ${e.message}`);
  //   } finally {
  //     setSchoolSaving(false);
  //   }
  // };

  // ── Users ─────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      role: "TEACHER",
      classId: "",
      subjectName: "",
    });
    setFormErr("");
    setModal("create");
  };
  const openEdit = (u) => {
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      classId: u.teacher?.classId || "",
      subjectName: u.teacher?.subjectName || "",
    });
    setFormErr("");
    setModal(u);
  };

  const saveUser = async () => {
    if (!form.name.trim() || !form.email.trim())
      return setFormErr("Name and email are required");
    if (modal === "create" && !form.password)
      return setFormErr("Password is required for new users");
    setSaving(true);
    try {
      if (modal === "create")
        await api("/setup/users", { method: "POST", body: form });
      else await api(`/setup/users/${modal.id}`, { method: "PUT", body: form });
      setModal(null);
      load();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id) => {
    if (!confirm("Delete this user?")) return;
    await api(`/setup/users/${id}`, { method: "DELETE" }).catch((e) =>
      alert(e.message),
    );
    load();
  };

  if (loading) return <Spinner />;

  const saveAssessmentCategory = async () => {
    try {
      if (!assessmentForm.name.trim()) {
        return alert("Category name is required");
      }

      await api("/assessment-categories", {
        method: "POST",
        body: assessmentForm,
      });

      await loadAssessmentCategories();

      setAssessmentModal(null);

      setAssessmentForm({
        id: "",
        name: "",
        type: "Behaviour",
        description: "",
      });
    } catch (err) {
      console.error(err);

      alert(err?.message || "Failed to save assessment category");
    }
  };

  const deleteAssessmentCategory = async (id) => {
    const ok = window.confirm("Delete this assessment category?");

    if (!ok) return;

    try {
      await api(`/assessment-categories/${id}`, {
        method: "DELETE",
      });

      await loadAssessmentCategories();
    } catch (err) {
      console.error(err);

      alert(err?.message || "Failed to delete category");
    }
  };

  const schoolField = (label, key, type = "text", placeholder = "") => {
    if (type === "file" && key === "logoUrl") {
      return (
        <FormField key={key} label={label}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              setSchoolForm((p) => ({
                ...p,
                // store selected File under `logo` so we can append as 'logo'
                logo: file,
                // update preview/url field if needed
                logoUrl: file ? URL.createObjectURL(file) : p.logoUrl,
              }));
            }}
            style={inputStyle}
          />
        </FormField>
      );
    } else if (type === "file" && key === "principalSignatureUrl") {
      return (
        <FormField key={key} label={label}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              setSchoolForm((p) => ({
                ...p,
                // store selected File under `principalSignature` so we can append as 'principalSignature'
                principalSignature: file,
                // update preview/url field if needed
                principalSignatureUrl: file
                  ? URL.createObjectURL(file)
                  : p.principalSignatureUrl,
              }));
            }}
            style={inputStyle}
          />
        </FormField>
      );
    }

    return (
      <FormField key={key} label={label}>
        <input
          type={type}
          value={schoolForm[key] || ""}
          placeholder={placeholder}
          onChange={(e) =>
            setSchoolForm((p) => ({ ...p, [key]: e.target.value }))
          }
          style={inputStyle}
        />
      </FormField>
    );
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Setup</h2>
      <ErrorMessage message={error} />
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#f3f4f6",
          borderRadius: 8,
          padding: 4,
          marginBottom: 24,
          width: "fit-content",
        }}
      >
        {[
          { key: "school", label: "🏫 School Info" },
          { key: "users", label: "👤 Users & Teachers" },
          { key: "assessment", label: "📝 Assessment Categories" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "7px 20px",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: tab === t.key ? "#fff" : "transparent",
              color: tab === t.key ? "#1a1f36" : "#6b7280",
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,.08)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* ── School Info tab ── */}
      {tab === "school" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 28,
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
            maxWidth: 600,
          }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 16 }}>
            School Information
          </h3>
          <p style={{ margin: "-12px 0 20px", fontSize: 13, color: "#6b7280" }}>
            This information appears on result sheets and official documents.
          </p>

          {schoolField("School Name *", "name", "text", "e.g. Sunrise Academy")}
          {schoolField("Address", "address", "text", "123 School Road, Lagos")}
          {schoolField("Phone", "phone", "tel", "+234 800 000 0000")}
          {schoolField("Email", "email", "email", "info@school.ng")}
          {schoolField("Website", "website", "url", "https://school.ng")}
          {schoolField(
            "School Motto",
            "motto",
            "text",
            "e.g. Knowledge is Power",
          )}
          {schoolField(
            "Logo URL",
            "logoUrl",
            "file",
            "https://... (image link)",
          )}
          {schoolField(
            "Principal Signature URL",
            "principalSignatureUrl",
            "file",
            "https://... (image link)",
          )}
          {schoolField(
            "Bank Account Name",
            "accountName",
            "text",
            "e.g. Sunrise Academy",
          )}
          {schoolField(
            "Bank Account Number",
            "accountNumber",
            "text",
            "e.g. 1234567890",
          )}
          {schoolField("Bank Name", "bankName", "text", "e.g. GTBank")}

          {schoolMsg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
                background: schoolMsg.startsWith("Error")
                  ? "#fee2e2"
                  : "#d1fae5",
                color: schoolMsg.startsWith("Error") ? "#991b1b" : "#065f46",
              }}
            >
              {schoolMsg}
            </div>
          )}

          <ActionButton disabled={schoolSaving} onClick={saveSchool}>
            {schoolSaving ? "Saving…" : "Save School Info"}
          </ActionButton>
        </div>
      )}
      {/* ── Users tab ── */}
      {tab === "users" && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 14,
            }}
          >
            <ActionButton onClick={openCreate}>+ Add User</ActionButton>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,.06)",
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
                    "Name",
                    "Email",
                    "Role",
                    "Assigned Class",
                    "Subject",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
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
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 500 }}>
                      {u.name}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        color: "#6b7280",
                        fontSize: 13,
                      }}
                    >
                      {u.email}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <Badge
                        label={u.role}
                        color={u.role === "ADMIN" ? "blue" : "green"}
                      />
                    </td>
                    <td style={{ padding: "10px 16px", color: "#6b7280" }}>
                      {u.teacher?.class?.className || "—"}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#6b7280" }}>
                      {u.teacher?.subjectName || "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <ActionButton
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </ActionButton>
                        <ActionButton
                          size="sm"
                          variant="danger"
                          onClick={() => deleteUser(u.id)}
                        >
                          Delete
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#9ca3af",
                      }}
                    >
                      No users yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "assessment" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h3>Assessment Categories</h3>

            <ActionButton
              onClick={() => {
                setAssessmentForm({
                  id: "",
                  name: "",
                  type: "Behaviour",
                  description: "",
                });

                setAssessmentModal("create");
              }}
            >
              + Add Category
            </ActionButton>
          </div>

          {Object.entries(assessmentCategories).map(([type, items]) => (
            <div
              key={type}
              style={{
                background: "#fff",
                borderRadius: 10,
                padding: 20,
                marginBottom: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}
            >
              <h4>{type}</h4>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ padding: "10px 0" }}>{item.name}</td>

                      <td
                        style={{
                          textAlign: "right",
                        }}
                      >
                        <ActionButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setAssessmentForm(item);
                            setAssessmentModal("edit");
                          }}
                        >
                          Edit
                        </ActionButton>

                        <ActionButton
                          size="sm"
                          variant="danger"
                          onClick={() => deleteAssessmentCategory(item.id)}
                        >
                          Delete
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {/* ── User modal ── */}
      {modal && (
        <Modal
          title={modal === "create" ? "Add User" : `Edit — ${modal.name}`}
          onClose={() => setModal(null)}
        >
          <ErrorMessage message={formErr} />
          <FormField label="Full Name">
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Mrs Adunola Bello"
              style={inputStyle}
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="teacher@school.ng"
              style={inputStyle}
            />
          </FormField>
          <FormField
            label={
              modal === "create"
                ? "Password"
                : "New Password (leave blank to keep)"
            }
          >
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="••••••••"
              style={inputStyle}
            />
          </FormField>
          <FormField label="Role">
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              style={inputStyle}
            >
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </select>
          </FormField>
          {form.role === "TEACHER" && (
            <>
              <FormField label="Assigned Class (optional)">
                <select
                  value={form.classId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, classId: e.target.value }))
                  }
                  style={inputStyle}
                >
                  <option value="">No class assigned</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Subject They Teach (optional)">
                <input
                  value={form.subjectName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, subjectName: e.target.value }))
                  }
                  placeholder="e.g. Mathematics"
                  style={inputStyle}
                />
              </FormField>
            </>
          )}
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
            <ActionButton disabled={saving} onClick={saveUser}>
              {saving
                ? "Saving…"
                : modal === "create"
                  ? "Create User"
                  : "Save Changes"}
            </ActionButton>
          </div>
        </Modal>
      )}

      {assessmentModal && (
        <Modal
          title={
            assessmentModal === "create" ? "Add Category" : "Edit Category"
          }
          onClose={() => setAssessmentModal(null)}
        >
          <FormField label="Name">
            <input
              value={assessmentForm.name}
              onChange={(e) =>
                setAssessmentForm((p) => ({
                  ...p,
                  name: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </FormField>

          <FormField label="Type">
            <select
              value={assessmentForm.type}
              onChange={(e) =>
                setAssessmentForm((p) => ({
                  ...p,
                  type: e.target.value,
                }))
              }
              style={inputStyle}
            >
              <option>Behaviour</option>
              <option>Psychomotor</option>
              <option>Sport</option>
              <option>Club</option>
              <option>Comments</option>
            </select>
          </FormField>

          <ActionButton onClick={saveAssessmentCategory}>Save</ActionButton>
        </Modal>
      )}
    </div>
  );
}
