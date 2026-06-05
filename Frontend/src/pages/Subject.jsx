// Add to the Classes page, below the class grid:
// Subjects section — per class

export function SubjectsSection({ classId, className }) {
  const [subjects, setSubjects] = useState([]);
  const [newName, setNewName] = useState("");

  const load = () =>
    api("/results/subjects").then((all) =>
      setSubjects(all.filter((s) => s.classId === classId)),
    );
  useEffect(() => {
    load();
  }, [classId]);

  const add = async () => {
    if (!newName.trim()) return;
    await api("/results/subjects", {
      method: "POST",
      body: { name: newName, classId },
    });
    setNewName("");
    load();
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ marginBottom: 12 }}>Subjects — {className}</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Subject name…"
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
          }}
        />
        <button
          onClick={add}
          style={{
            padding: "8px 16px",
            background: "#4f8ef7",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Add
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {subjects.map((s) => (
          <span
            key={s.id}
            style={{
              background: "#eff6ff",
              color: "#2563eb",
              padding: "5px 12px",
              borderRadius: 20,
              fontSize: 13,
            }}
          >
            {s.name}
          </span>
        ))}
        {subjects.length === 0 && (
          <span style={{ color: "#9ca3af", fontSize: 13 }}>
            No subjects yet
          </span>
        )}
      </div>
    </div>
  );
}
