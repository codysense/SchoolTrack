import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTerm } from "../context/TermContext";

const ADMIN_NAV = [
  { path: "/", label: "Dashboard", icon: "▦" },
  { path: "/students", label: "Students", icon: "👥" },
  { path: "/classes", label: "Classes", icon: "🏛" },
  { path: "/payments", label: "Payments", icon: "💳" },
  { path: "/optional-fees", label: "Optional Fees", icon: "🏷" },
  { path: "/results", label: "Results", icon: "📋" },
  { path: "/sessions", label: "Sessions", icon: "📅" },
  { path: "/notifications", label: "Notifications", icon: "🔔" },
  { path: "/audit", label: "Audit Log", icon: "🔍" },
  { path: "/setup", label: "Setup", icon: "⚙️" },
];

const TEACHER_NAV = [
  { path: "/", label: "Dashboard", icon: "▦" },
  { path: "/students", label: "Students", icon: "👥" },
  { path: "/classes", label: "Classes", icon: "🏛" },
  { path: "/results", label: "Results", icon: "📋" },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { currentTerm } = useTerm();
  const [open, setOpen] = useState(false);

  const nav = isAdmin ? ADMIN_NAV : TEACHER_NAV;
  const roleBadge = isAdmin
    ? { label: "Admin", bg: "#eff6ff", color: "#2563eb" }
    : { label: "Teacher", bg: "#d1fae5", color: "#065f46" };

  const sidebar = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 14,
                fontWeight: 700,
                margin: 0,
                color: "#fff",
              }}
            >
              🏫 SchoolTrack
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "#8891b4",
                margin: "3px 0 5px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.name}
            </p>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: roleBadge.bg,
                color: roleBadge.color,
                padding: "2px 7px",
                borderRadius: 10,
              }}
            >
              {roleBadge.label}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="close-btn"
            style={{
              display: "none",
              background: "none",
              border: "none",
              color: "#8891b4",
              fontSize: 22,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Active term badge */}
        {currentTerm && (
          <div
            style={{
              marginTop: 10,
              padding: "5px 8px",
              background: "rgba(79,142,247,.15)",
              borderRadius: 6,
              border: "1px solid rgba(79,142,247,.25)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: "#8891b4",
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              Active Term
            </p>
            <p
              style={{
                margin: "1px 0 0",
                fontSize: 11,
                color: "#93c5fd",
                fontWeight: 600,
              }}
            >
              {currentTerm.session?.name} {currentTerm.name}
            </p>
          </div>
        )}
        {!currentTerm && isAdmin && (
          <div
            style={{
              marginTop: 10,
              padding: "5px 8px",
              background: "rgba(245,158,11,.1)",
              borderRadius: 6,
              border: "1px solid rgba(245,158,11,.25)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: "#fcd34d",
                fontWeight: 600,
              }}
            >
              ⚠ No active term
            </p>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, paddingTop: 6, overflowY: "auto" }}>
        {nav.map((n) => {
          const active =
            n.path === "/" ? pathname === "/" : pathname.startsWith(n.path);
          return (
            <Link
              key={n.path}
              to={n.path}
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 18px",
                fontSize: 13,
                color: active ? "#fff" : "#8891b4",
                background: active ? "rgba(255,255,255,.1)" : "transparent",
                textDecoration: "none",
                borderLeft: active
                  ? "3px solid #4f8ef7"
                  : "3px solid transparent",
                transition: "all .1s",
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                {n.icon}
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: "12px 18px",
          borderTop: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <button
          onClick={logout}
          style={{
            width: "100%",
            padding: 8,
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
            color: "#8891b4",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .topbar          { display: flex !important; }
          .close-btn       { display: block !important; }
        }
        @media (min-width: 769px) { .sidebar-mobile { display: none !important; } }
      `}</style>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "#f5f6fa",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <aside
          className="sidebar-desktop"
          style={{
            width: 220,
            background: "#1a1f36",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          {sidebar}
        </aside>
        {open && (
          <>
            <div
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.5)",
                zIndex: 40,
              }}
            />
            <aside
              className="sidebar-mobile"
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                bottom: 0,
                width: 240,
                background: "#1a1f36",
                zIndex: 50,
                boxShadow: "4px 0 24px rgba(0,0,0,.3)",
                overflowY: "auto",
              }}
            >
              {sidebar}
            </aside>
          </>
        )}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            className="topbar"
            style={{
              display: "none",
              alignItems: "center",
              gap: 12,
              background: "#1a1f36",
              padding: "12px 16px",
              position: "sticky",
              top: 0,
              zIndex: 30,
            }}
          >
            <button
              onClick={() => setOpen(true)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: 22,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ☰
            </button>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
              🏫 SchoolTrack
            </span>
          </div>
          <main style={{ flex: 1, padding: "24px 28px", overflowX: "hidden" }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
