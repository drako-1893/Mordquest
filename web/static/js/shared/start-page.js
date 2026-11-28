import { finishPageLoading } from "./loading.js";
import "./heartbeat.js";

const page = document.querySelector("#page-loading").dataset.page;
const content = document.querySelector("#page-content");
content.inert = true;
try {
  await import(`../pages/${page}.js`);
} catch {
  const error = document.createElement("p");
  error.className = "page-load-error";
  error.setAttribute("role", "alert");
  const retry = document.createElement("a");
  retry.href = location.href;
  retry.textContent = "Reintentar";
  error.append("No se pudo iniciar Assoku. ", retry);
  content.prepend(error);
  for (const pending of content.querySelectorAll("[data-load-pending]")) pending.removeAttribute("data-load-pending");
} finally {
  finishPageLoading(content);
}

