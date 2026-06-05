import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Minimal global reset
const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #f5f6fa; color: #1a1f36; }
  input, select, button, textarea { font-family: inherit; }
  a { text-decoration: none; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
