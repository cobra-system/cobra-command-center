import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

const deferSentry = () => import("./lib/sentry").then((m) => m.initSentry());
if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(deferSentry, { timeout: 3000 });
} else {
  setTimeout(deferSentry, 1500);
}
