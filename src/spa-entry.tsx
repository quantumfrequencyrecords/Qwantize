import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SpaApp } from "./spa-app";
import "./styles.css";

window.__QWANTIZE_HASH__ = true;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <SpaApp />
  </StrictMode>,
);
