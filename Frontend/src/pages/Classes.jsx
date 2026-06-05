import { useEffect, useState } from "react";
import { api } from "../api/client";
import Modal from "../components/Modal";

const emptyClass = { className: "", feeAmount: "" };

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | class-obj
  const [form, setForm] = useState(emptyClass);
  const [error, setError] = useState("");

  // Subjects state (only used when editing an existing class)
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);

  const loadClasses = () => api("/classes").then(setClasses);
  useEffect(() => {
    loadClasses();
  }, []);

  // Load subjects for a class whenever the edit modal opens
  const loadSubjects = (classId) => {
    api("/results/subjects").then((all) =>
      setSubjects(all.filter((s) => s.classId === classId)),
    );
  };

  const openCreate = () => {
    setForm(emptyClass);
    setError("");
    setSubjects([]);
    setNewSubject("");
    setModal("create");
  };

  const openEdit = (cls) => {
    setForm({ className: cls.className, feeAmount: cls.feeAmount });
    setError("");
    setSubjectError("");
    setNewSubject("");
    setModal(cls);
    loadSubjects(cls.id);
  };

  const closeModal = () => {
    setModal(null);
    setSubjects([]);
    setNewSubject("");
    setError("");
    setSubjectError("");
  };

  // Save class name / fee edits
  const saveClass = async () => {
    setError("");
    if (!form.className.trim()) return setError("Class name is required");
    if (!form.feeAmount || isNaN(form.feeAmount))
      return setError("Valid fee amount is required");
    try {
      if (modal === "create") {
        await api("/classes", { method: "POST", body: form });
      } else {
        await api(`/classes/${modal.id}`, { method: "PUT", body: form });
      }
      closeModal();
      loadClasses();
    } catch (e) {
      setError(e.message);
    }
  };

  // Add a subject to the current class
  const addSubject = async () => {
    const name = newSubject.trim();
    if (!name) return setSubjectError("Enter a subject name");
    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      return setSubjectError("Subject already exists in this class");

    setSubjectError("");
    setAddingSubject(true);
    try {
      const created = await api("/results/subjects", {
        method: "POST",
        body: { name, classId: modal.id },
      });
      setSubjects((prev) => [...prev, created]);
      setNewSubject("");
    } catch (e) {
      setSubjectError(e.message);
    } finally {
      setAddingSubject(false);
    }
  };

  // Remove a subject
  const removeSubject = async (subjectId) => {
    if (
      !confirm(
        "Remove this subject? Any recorded results for it will also be deleted.",
      )
    )
      return;
    try {
      await api(`/results/subjects/${subjectId}`, { method: "DELETE" });
      setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
    } catch (e) {
      setSubjectError(e.message);
    }
  };

  const deleteClass = async (id) => {
    if (!confirm("Delete this class? All linked students will be affected."))
      return;
    try {
      await api(`/classes/${id}`, { method: "DELETE" });
      loadClasses();
    } catch (e) {
      alert(e.message);
    }
  };

  const isEditing = modal && modal !== "create";

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0 }}>Classes</h2>
        <button
          onClick={openCreate}
          style={{
            background: "#4f8ef7",
            color: "#fff",
            border: "none",
            padding: "8px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add Class
        </button>
      </div>

      {/* Class cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {classes.map((c) => (
          <div
            key={c.id}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              borderTop: "3px solid #4f8ef7",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#1a1f36",
                  }}
                >
                  {c.className}
                </h3>
                <p
                  style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}
                >
                  {c._count.students} student
                  {c._count.students !== 1 ? "s" : ""}
                </p>
              </div>
              <span
                style={{
                  background: "#eff6ff",
                  color: "#2563eb",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                ₦{Number(c.feeAmount).toLocaleString()}
              </span>
            </div>

            {/* Subject count badge */}
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  background: "#f0fdf4",
                  color: "#15803d",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {c._count.subjects ?? "—"} subject
                {c._count.subjects !== 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => openEdit(c)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  border: "1px solid #d1d5db",
                  borderRadius: 7,
                  cursor: "pointer",
                  fontSize: 13,
                  background: "#fff",
                  color: "#374151",
                }}
              >
                Edit
              </button>
              <button
                onClick={() => deleteClass(c.id)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  border: "1px solid #fca5a5",
                  borderRadius: 7,
                  cursor: "pointer",
                  fontSize: 13,
                  background: "#fff",
                  color: "#dc2626",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {classes.length === 0 && (
          <div
            style={{
              gridColumn: "1/-1",
              textAlign: "center",
              padding: 48,
              color: "#9ca3af",
              background: "#fff",
              borderRadius: 12,
            }}
          >
            No classes yet. Add your first class to get started.
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={modal === "create" ? "Add Class" : `Edit — ${modal.className}`}
          onClose={closeModal}
        >
          {/* ── Class details ── */}
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#9ca3af",
              textTransform: "uppercase",
              margin: "0 0 12px",
            }}
          >
            Class Details
          </p>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "8px 12px",
                borderRadius: 7,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Class Name
            </label>
            <input
              type="text"
              value={form.className}
              onChange={(e) =>
                setForm((p) => ({ ...p, className: e.target.value }))
              }
              placeholder="e.g. JSS 1, SS 2, Primary 3"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Term Fee Amount (₦)
            </label>
            <input
              type="number"
              min="0"
              value={form.feeAmount}
              onChange={(e) =>
                setForm((p) => ({ ...p, feeAmount: e.target.value }))
              }
              placeholder="e.g. 45000"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* ── Subjects section (edit only) ── */}
          {isEditing && (
            <>
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #f3f4f6",
                  margin: "20px 0 16px",
                }}
              />

              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Subjects ({subjects.length})
              </p>

              {/* Existing subjects list */}
              <div style={{ marginBottom: 14, minHeight: 32 }}>
                {subjects.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                    No subjects added yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {subjects.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#eff6ff",
                          borderRadius: 20,
                          padding: "4px 6px 4px 12px",
                          fontSize: 13,
                          color: "#1e40af",
                        }}
                      >
                        <span>{s.name}</span>
                        <button
                          onClick={() => removeSubject(s.id)}
                          title={`Remove ${s.name}`}
                          style={{
                            background: "#bfdbfe",
                            border: "none",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            color: "#1e40af",
                            lineHeight: 1,
                            padding: 0,
                            flexShrink: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add subject input */}
              {subjectError && (
                <div
                  style={{
                    background: "#fff7ed",
                    color: "#c2410c",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  {subjectError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => {
                    setNewSubject(e.target.value);
                    setSubjectError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addSubject()}
                  placeholder="New subject name…"
                  style={{
                    flex: 1,
                    padding: "7px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
                <button
                  onClick={addSubject}
                  disabled={addingSubject}
                  style={{
                    padding: "7px 16px",
                    background: addingSubject ? "#93c5fd" : "#4f8ef7",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: addingSubject ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                  }}
                >
                  {addingSubject ? "…" : "+ Add"}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 4px" }}>
                Press Enter or click Add
              </p>
            </>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 20,
            }}
          >
            <button
              onClick={closeModal}
              style={{
                padding: "8px 16px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                cursor: "pointer",
                background: "#fff",
                fontSize: 14,
              }}
            >
              {isEditing ? "Done" : "Cancel"}
            </button>
            <button
              onClick={saveClass}
              style={{
                padding: "8px 20px",
                background: "#4f8ef7",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {modal === "create" ? "Create Class" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
