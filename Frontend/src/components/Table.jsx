// A generic reusable table component for any list page
export default function Table({
  columns,
  data,
  emptyText = "No records found",
}) {
  return (
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
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "10px 16px",
                  textAlign: col.align || "left",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  color: "#9ca3af",
                }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i} style={{ borderTop: "1px solid #f3f4f6" }}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "10px 16px",
                      textAlign: col.align || "left",
                      color: col.muted ? "#6b7280" : "#1a1f36",
                    }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
