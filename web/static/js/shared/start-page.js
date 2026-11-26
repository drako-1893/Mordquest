import { finishPageLoading } from "./loading.js";
import "./heartbeat.js";

const page = document.querySelector("#page-loading").dataset.page;
const content = document.querySelector("#page-content");
content.inert = true;
try {
  await import(`../pages/${page}.js`);
  const images = [...content.querySelectorAll("img[src]:not([loading='lazy'])")];
  await Promise.allSettled(images.map(image => image.decode()));
} catch {
  const error = document.createElement("p");
  error.className = "page-load-error";
  error.setAttribute("role", "alert");
  error.textContent = "No se pudo cargar Assoku. Recarga la página para volver a intentarlo.";
  content.replaceChildren(error);
} finally {
  await finishPageLoading(content);
}

