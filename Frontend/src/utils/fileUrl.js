export const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(
  "/api",
  "",
);

export const fileUrl = (path) => (path ? `${API_BASE}${path}` : "");
