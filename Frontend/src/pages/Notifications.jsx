import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function Notifications() {
  const [logs, setLogs] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api("/notifications").then(setLogs);
  }, []);

  const remindAll = async () => {
    setSending(true);
    const result = await api("/notifications/remind-all", { method: "POST" });
    alert(`Sent ${result.sent} of ${result.total} reminders`);
    setSending(false);
    api("/notifications").then(setLogs);
  };

  const statusColor = (s) =>
    ({ sent: "#d1fae5", failed: "#fee2e2", mock: "#fef3c7" })[s] || "#f3f4f6";
  const statusText = (s) =>
    ({ sent: "#065f46", failed: "#991b1b", mock: "#92400e" })[s] || "#374151";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0 }}>Notifications</h2>
        <button
          onClick={remindAll}
          disabled={sending}
          style={{
            background: "#f59e0b",
            color: "#fff",
            border: "none",
            padding: "8px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {sending ? "Sending…" : "📢 Remind All Owing"}
        </button>
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
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Phone", "Message", "Type", "Status", "Sent At"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    color: "#374151",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>
                  {l.phone}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    maxWidth: 300,
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  {l.message}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <span
                    style={{
                      background: "#eff6ff",
                      color: "#2563eb",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  >
                    {l.type.replace("_", " ")}
                  </span>
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <span
                    style={{
                      background: statusColor(l.status),
                      color: statusText(l.status),
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {l.status}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    color: "#9ca3af",
                    fontSize: 12,
                  }}
                >
                  {new Date(l.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
