import { gameProgress } from "../shared/progress.js";
import { mountSession } from "../shared/session.js";

const levelGrid = document.querySelector("#level-grid");
const levelTemplate = document.querySelector("#level-card-template");
const catalogStatus = document.querySelector("#catalog-status");
const difficulties = { easy: "Fácil", medium: "Medio", hard: "Difícil", expert: "Experto" };

function renderCompletedLevels() {
  for (const card of levelGrid.querySelectorAll(".level-card")) {
    const solved = gameProgress.has(card.dataset.levelId);
    card.classList.toggle("is-solved", solved);
    card.querySelector(".completed").hidden = !solved;
    const play = card.querySelector(".level-play");
    play.firstChild.textContent = solved ? "Ver resuelto " : "Jugar ";
    play.setAttribute("aria-label", (solved ? "Ver resuelto: " : "Jugar: ") + card.querySelector(".level-name").textContent);
  }
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/levels");
    if (!response.ok) throw new Error("Error al cargar el catálogo.");
    const levels = await response.json();

    for (const level of levels) {
      const card = levelTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.levelId = level.id;
      card.querySelector(".level-art").classList.add(level.theme);
      card.querySelector("img").src = "/Resources/" + level.cover;
      const difficulty = card.querySelector(".level-difficulty");
      difficulty.textContent = difficulties[level.difficulty];
      difficulty.classList.add(level.difficulty);
      card.querySelector(".level-name").textContent = level.title;
      card.querySelector(".level-play").href = "/index.html?nivel=" + encodeURIComponent(level.id);
      levelGrid.append(card);
    }

    renderCompletedLevels();
    catalogStatus.hidden = true;
  } catch {
    catalogStatus.textContent = "No se pudieron cargar los niveles. Recarga la página para volver a intentarlo.";
  }
}

mountSession();
document.addEventListener("gameprogress", renderCompletedLevels);
loadCatalog();
