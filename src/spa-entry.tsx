import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SpaApp } from "./spa-app";
import "./styles.css";

window.__QWANTIZE_HASH__ = true;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

function showFatal(err: unknown) {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  root.innerHTML = `<div style="max-width:40rem;margin:2rem auto;padding:1.25rem;font-family:ui-sans-serif,system-ui;color:#e6e9ed">
    <h1 style="font-size:1.25rem;margin:0 0 .75rem">Qwantize failed to start</h1>
    <p style="color:#8b95a1">The dashboard hit a runtime error. Try a hard refresh. If this persists, open an issue with the text below.</p>
    <pre style="white-space:pre-wrap;background:#11151a;border:1px solid #232b34;padding:12px;border-radius:8px;font-size:12px">${message.replace(/[<>&]/g, (c) => ({ "<": "<", ">": ">", "&": "&" }[c] as string))}</pre>
  </div>`;
}

window.addEventListener("error", (event) => {
  if (!root.childElementCount || root.querySelector("[data-boot]")) showFatal(event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  if (!root.childElementCount || root.querySelector("[data-boot]")) showFatal(event.reason);
});

try {
  createRoot(root).render(
    <StrictMode>
      <SpaApp />
    </StrictMode>,
  );
} catch (err) {
  showFatal(err);
}
