
import { createRoot } from "react-dom/client";
import App, { type ApplicationMode } from "./app/App.tsx";
import "./styles/index.css";

const mode: ApplicationMode = window.location.pathname.startsWith("/real")
  ? "real"
  : "demo";

createRoot(document.getElementById("root")!).render(<App mode={mode} />);
