import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTerm } from "../context/TermContext";
import {
  Spinner,
  ErrorMessage,
  Badge,
  ActionButton,
  FormField,
  inputStyle,
} from "../components/ui";
import Modal from "../components/Modal";

export default function Sessions() {
  const { currentTerm, refresh: refreshTerm } = useTerm();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", createTerms: true });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [settingTerm, setSettingTerm] = useState(null);

  // Date edit state
  const [dateEdit, setDateEdit] = useState(null); // { termId, startDate, endDate }

  const load = () => {
    setLoading(true);
    api("/sessions")
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const createSession = async () => {
    if (!form.name.trim())
      return setFormErr("Session name is required e.g. 2025/2026");
    setSaving(true);
    try {
      await api("/sessions", { method: "POST", body: form });
      setModal(false);
      setForm({ name: "", createTerms: true });
      load();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setCurrentTerm = async (termId) => {
    setSettingTerm(termId);
    try {
      await api(`/sessions/terms/${termId}/set-current`, { method: "PUT" });
      load();
      refreshTerm();
    } catch (e) {
      alert(e.message);
    } finally {
      setSettingTerm(null);
    }
  };

  const saveDates = async () => {
    try {
      await api(`/sessions/terms/${dateEdit.termId}`, {
        method: "PUT",
        body: {
          startDate: dateEdit.startDate,
          endDate: dateEdit.endDate,
          schoolOpened: dateEdit.schoolOpened,
        },
      });
      setDateEdit(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteSession = async (id, name) => {
    if (
      !confirm(
        `Delete session "${name}"? All payments, results and assignments for this session will be permanently removed.`,
      )
    )
      return;
    await api(`/sessions/${id}`, { method: "DELETE" }).catch((e) =>
      alert(e.message),
    );
    load();
    refreshTerm();
  };

  if (loading) return <Spinner />;

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
        <div>
          <h2 style={{ margin: 0 }}>Sessions & Terms</h2>
          {currentTerm && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              Active term:{" "}
              <strong style={{ color: "#2563eb" }}>
                {currentTerm.session?.name} — {currentTerm.name}
              </strong>
            </p>
          )}
          {!currentTerm && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#dc2626" }}>
              ⚠ No active term set. Set one below before recording payments or
              results.
            </p>
          )}
        </div>
        <ActionButton
          onClick={() => {
            setForm({ name: "", createTerms: true });
            setFormErr("");
            setModal(true);
          }}
        >
          + New Session
        </ActionButton>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {sessions.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 48,
            textAlign: "center",
            color: "#9ca3af",
          }}
        >
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>📅</p>
          <p style={{ margin: 0 }}>
            No sessions yet. Create your first academic session to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                border: session.isCurrent
                  ? "2px solid #4f8ef7"
                  : "2px solid transparent",
              }}
            >
              {/* Session header */}
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #f3f4f6",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                    {session.name}
                  </h3>
                  {session.isCurrent && (
                    <Badge label="Current Session" color="blue" />
                  )}
                </div>
                <ActionButton
                  size="sm"
                  variant="danger"
                  onClick={() => deleteSession(session.id, session.name)}
                >
                  Delete Session
                </ActionButton>
              </div>

              {/* Terms grid */}
              <div
                style={{
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                {session.terms.map((term) => {
                  const isActive = term.isCurrent;
                  const isEditing = dateEdit?.termId === term.id;
                  return (
                    <div
                      key={term.id}
                      style={{
                        borderRadius: 10,
                        padding: 16,
                        background: isActive ? "#eff6ff" : "#f9fafb",
                        border: isActive
                          ? "1px solid #bfdbfe"
                          : "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: isActive ? "#1e40af" : "#374151",
                          }}
                        >
                          {term.name}
                        </span>
                        {isActive && <Badge label="ACTIVE" color="blue" />}
                      </div>

                      {/* Dates display */}
                      {!isEditing ? (
                        <>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              marginBottom: 12,
                            }}
                          >
                            {term.startDate
                              ? `${new Date(term.startDate).toLocaleDateString()} → ${term.endDate ? new Date(term.endDate).toLocaleDateString() : "ongoing"}`
                              : "No dates set"}
                          </div>

                          <FormField
                            label="School days opened"
                            hint="Total number of days school was open during this term"
                          >
                            <input
                              type="number"
                              value={term.schoolOpened || ""}
                              style={{
                                ...inputStyle,
                                fontSize: 12,
                                padding: "5px 8px",
                                background: "#f3f4f6",
                                // cursor: "not-allowed",
                              }}
                            />
                          </FormField>
                        </>
                      ) : (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ marginBottom: 6 }}>
                            <label
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              Start date
                            </label>
                            <input
                              type="date"
                              value={dateEdit.startDate || ""}
                              onChange={(e) =>
                                setDateEdit((p) => ({
                                  ...p,
                                  startDate: e.target.value,
                                }))
                              }
                              style={{
                                ...inputStyle,
                                fontSize: 12,
                                padding: "5px 8px",
                              }}
                            />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <label
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              End date
                            </label>
                            <input
                              type="date"
                              value={dateEdit.endDate || ""}
                              onChange={(e) =>
                                setDateEdit((p) => ({
                                  ...p,
                                  endDate: e.target.value,
                                }))
                              }
                              style={{
                                ...inputStyle,
                                fontSize: 12,
                                padding: "5px 8px",
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              School days opened
                            </label>
                            <input
                              type="number"
                              value={dateEdit.schoolOpened || ""}
                              onChange={(e) =>
                                setDateEdit((p) => ({
                                  ...p,
                                  schoolOpened: e.target.value,
                                }))
                              }
                              style={{
                                ...inputStyle,
                                fontSize: 12,
                                padding: "5px 8px",
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <ActionButton size="sm" onClick={saveDates}>
                              Save
                            </ActionButton>
                            <ActionButton
                              size="sm"
                              variant="secondary"
                              onClick={() => setDateEdit(null)}
                            >
                              Cancel
                            </ActionButton>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {!isEditing && (
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          {!isActive && (
                            <ActionButton
                              size="sm"
                              disabled={settingTerm === term.id}
                              onClick={() => setCurrentTerm(term.id)}
                            >
                              {settingTerm === term.id ? "…" : "Set Active"}
                            </ActionButton>
                          )}
                          <ActionButton
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setDateEdit({
                                termId: term.id,
                                startDate: term.startDate?.split("T")[0] || "",
                                endDate: term.endDate?.split("T")[0] || "",
                                schoolOpened: term.schoolOpened || "",
                              })
                            }
                          >
                            Edit Dates
                          </ActionButton>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create session modal */}
      {modal && (
        <Modal title="New Academic Session" onClose={() => setModal(false)}>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
            A session represents one academic year. Three terms will be created
            automatically.
          </p>
          <ErrorMessage message={formErr} />
          <FormField label="Session Name" hint='Format: "2025/2026"'>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. 2025/2026"
              style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && createSession()}
            />
          </FormField>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <input
              type="checkbox"
              id="createTerms"
              checked={form.createTerms}
              onChange={(e) =>
                setForm((p) => ({ ...p, createTerms: e.target.checked }))
              }
              style={{ width: 16, height: 16 }}
            />
            <label
              htmlFor="createTerms"
              style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}
            >
              Auto-create First, Second and Third terms
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </ActionButton>
            <ActionButton disabled={saving} onClick={createSession}>
              {saving ? "Creating…" : "Create Session"}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
