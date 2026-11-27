import { startGame } from "../game/controller.js";
import { mountWalkthrough } from "../game/walkthrough.js";
import { gameProgress } from "../shared/progress.js";
import { loadModularArtwork } from "../shared/scenery.js";
import { mountSession } from "../shared/session.js";

async function loadGame() {
  const status = document.querySelector("#level-load-status");
  try {
    const id = document.querySelector(".case").dataset.levelId;
    const response = await fetch("/api/levels/" + encodeURIComponent(id), { signal: AbortSignal.timeout(10000) });
    if (response.status === 404) {
      status.textContent = "Este nivel no existe. Elige otro desde la selección de niveles.";
      return;
    }
    if (!response.ok) throw new Error("Error al cargar el nivel.");
    const level = await response.json();
    await Promise.all([gameProgress.ready, loadModularArtwork(level.scenery ?? [])]);
    let walkthrough;
    const loadWalkthrough = () => {
      walkthrough ??= fetch("/api/levels/" + encodeURIComponent(level.id) + "/walkthrough", {
        signal: AbortSignal.timeout(10000),
      })
        .then(response => {
          if (!response.ok) throw new Error("Error al cargar la solución.");
          return response.json();
        })
        .catch(error => {
          walkthrough = undefined;
          throw error;
        });
      return walkthrough;
    };
    const restored = startGame(level, loadWalkthrough);
    mountWalkthrough(level, loadWalkthrough);
    document.querySelector("#case-content").hidden = false;
    status.hidden = true;
    await restored;
  } catch (error) {
    console.error("No se pudo cargar el nivel.", error);
    status.textContent = "No se pudo cargar el nivel. Recarga la página para volver a intentarlo.";
  }
}

mountSession();
await loadGame();
