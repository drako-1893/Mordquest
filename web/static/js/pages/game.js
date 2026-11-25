import { startGame } from "../game/controller.js";
import { mountWalkthrough } from "../game/walkthrough.js";
import { gameProgress } from "../shared/progress.js";
import { mountSession } from "../shared/session.js";

async function loadGame() {
  const status = document.querySelector("#level-load-status");
  try {
    let id = new URLSearchParams(location.search).get("nivel");
    if (id === null) {
      const catalog = await fetch("/api/levels");
      if (!catalog.ok) throw new Error("Error al cargar el catálogo.");
      const [firstLevel] = await catalog.json();
      id = firstLevel.id;
    }
    const response = await fetch("/api/levels/" + encodeURIComponent(id));
    if (response.status === 404) {
      status.textContent = "Este nivel no existe. Elige otro desde la selección de niveles.";
      return;
    }
    if (!response.ok) throw new Error("Error al cargar el nivel.");
    const level = await response.json();
    await gameProgress.ready;
    startGame(level);
    mountWalkthrough(level);
    document.querySelector("#case-content").hidden = false;
    status.hidden = true;
  } catch {
    status.textContent = "No se pudo cargar el nivel. Recarga la página para volver a intentarlo.";
  }
}

mountSession();
loadGame();
