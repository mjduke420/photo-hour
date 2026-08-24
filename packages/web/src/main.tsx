import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Photo Hour could not find its mount point");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
