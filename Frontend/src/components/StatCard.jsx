export default function StatCard({ label, value, sub, color = "#4f8ef7" }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "20px 24px",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        borderTop: `3px solid ${color}`,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{label}</p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 26,
          fontWeight: 700,
          color: "#1a1f36",
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
