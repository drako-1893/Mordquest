import { startGame } from "../game/controller.js";
import { mountWalkthrough } from "../game/walkthrough.js";
import { hasSavedDraft } from "../shared/drafts.js";
import { gameProgress } from "../shared/progress.js";
import { applyFloor, loadModularArtwork } from "../shared/scenery.js";
import { mountSession } from "../shared/session.js";

async function loadGame(welcomeFinished) {
  const page = document.querySelector(".case[data-level-id]");
  const loadState = document.querySelector("#level-load-state");
  const status = document.querySelector("#level-load-status");
  const retry = document.querySelector("#retry-level");
  retry.hidden = true;
  status.textContent = "Cargando nivel…";
  page.setAttribute("data-load-pending", "");
  try {
    const id = page.dataset.levelId;
    const response = await fetch("/api/levels/" + encodeURIComponent(id), { signal: AbortSignal.timeout(10000) });
    if (response.status === 404) {
      status.textContent = "Este nivel no existe. Elige otro desde la selección de niveles.";
      return;
    }
    if (!response.ok) throw new Error("Error al cargar el nivel.");
    const level = await response.json();
    void loadModularArtwork(level.scenery ?? []);
    await gameProgress.ready;
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
    const { restored, startPractice } = startGame(level, loadWalkthrough);
    mountWalkthrough(level, loadWalkthrough);
    page.setAttribute("data-ready", "");
    loadState.hidden = true;
    await restored;
    void welcomeFinished.then(() => {
      if (!gameProgress.tutorialSeen && !gameProgress.hasCompletedLevels && !hasSavedDraft(gameProgress.username)) {
        startPractice();
      }
      gameProgress.rememberTutorial();
    });
  } catch (error) {
    console.error("No se pudo cargar el nivel.", error);
    status.textContent = "No se pudo cargar el nivel.";
    retry.hidden = false;
  } finally {
    page.removeAttribute("data-load-pending");
  }
}

const welcomeFinished = mountSession();
for (const cell of document.querySelectorAll(".tutorial-grid .cell[data-floor]")) {
  applyFloor(cell, cell.dataset.floor);
}
document.querySelector("#retry-level").addEventListener("click", () => void loadGame(welcomeFinished));
void loadGame(welcomeFinished);
