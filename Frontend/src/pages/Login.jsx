import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [tab, setTab] = useState("staff");
  const [form, setForm] = useState({
    email: "",
    password: "",
    admissionNumber: "",
    firstName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoad] = useState(false);
  const { login, studentLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoad(true);
    try {
      if (tab === "staff") {
        await login(form.email, form.password);
        navigate("/");
      } else {
        await studentLogin(form.admissionNumber, form.firstName);
        navigate("/portal");
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoad(false);
    }
  };

  const field = (label, key, type = "text", placeholder = "", hint = "") => (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        required
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: "1px solid #d1d5db",
          borderRadius: 8,
          fontSize: 14,
          boxSizing: "border-box",
          outline: "none",
          color: "#1a1f36",
          transition: "border-color .15s",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#4f8ef7")}
        onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
      />
      {hint && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1f36 0%, #2d3561 100%)",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🏫</div>
          <h1
            style={{ color: "#fff", margin: 0, fontSize: 24, fontWeight: 700 }}
          >
            SchoolTrack
          </h1>
          <p style={{ color: "#8891b4", margin: "4px 0 0", fontSize: 14 }}>
            Sign in to continue
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "28px 32px",
            boxShadow: "0 20px 60px rgba(0,0,0,.3)",
          }}
        >
          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              background: "#f3f4f6",
              borderRadius: 8,
              padding: 4,
              marginBottom: 24,
            }}
          >
            {[
              { key: "staff", label: "Staff / Admin" },
              { key: "student", label: "Student Portal" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setError("");
                }}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all .15s",
                  background: tab === t.key ? "#fff" : "transparent",
                  color: tab === t.key ? "#1a1f36" : "#6b7280",
                  boxShadow:
                    tab === t.key ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {tab === "staff" ? (
              <>
                {field("Email address", "email", "email", "admin@school.ng")}
                {field("Password", "password", "password", "••••••••")}
              </>
            ) : (
              <>
                {field(
                  "Admission Number",
                  "admissionNumber",
                  "text",
                  "SCH/2024/0001",
                )}
                {field(
                  "First Name",
                  "firstName",
                  "text",
                  "As on your records",
                  "Enter your first name exactly as registered by your school.",
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: 11,
                marginTop: 4,
                background: loading ? "#93c5fd" : "#4f8ef7",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {tab === "staff" && (
            <p
              style={{
                textAlign: "center",
                marginTop: 16,
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              Default admin: admin@school.ng / admin123
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
