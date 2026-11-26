import { gameProgress } from "../shared/progress.js";
import { mountSession } from "../shared/session.js";

const levelGrid = document.querySelector("#level-grid");
const levelTemplate = document.querySelector("#level-card-template");
const catalogStatus = document.querySelector("#catalog-status");
const catalogControls = document.querySelector("#catalog-controls");
const hideCompleted = document.querySelector("#hide-completed");
const sortOrder = document.querySelector("#level-order");
const difficulties = { easy: "Fácil", medium: "Medio", hard: "Difícil", expert: "Experto" };
const ranks = Object.keys(difficulties);
const titleOrder = new Intl.Collator("es");
const cards = [];
const preferencesKey = "archivo-nocturno:catalog-options";
const orderBy = {
  number: (a, b) => a.order - b.order,
  recent: (a, b) => b.order - a.order,
  easy: (a, b) => ranks.indexOf(a.difficulty) - ranks.indexOf(b.difficulty),
  hard: (a, b) => ranks.indexOf(b.difficulty) - ranks.indexOf(a.difficulty),
  name: (a, b) => titleOrder.compare(a.title, b.title),
};

try {
  const prefs = JSON.parse(sessionStorage.getItem(preferencesKey));
  hideCompleted.checked = prefs?.hideCompleted === true;
  if (Object.hasOwn(orderBy, prefs?.sortOrder)) sortOrder.value = prefs.sortOrder;
} catch {
  // The controls work without saved preferences.
}

function savePreferences() {
  try {
    sessionStorage.setItem(preferencesKey, JSON.stringify({
      hideCompleted: hideCompleted.checked,
      sortOrder: sortOrder.value,
    }));
  } catch {
    // Keep the current selections when storage is unavailable.
  }
}

function sortLevels() {
  const compare = orderBy[sortOrder.value];
  const ordered = [...cards].sort((a, b) => compare(a.level, b.level) || a.level.order - b.level.order);
  levelGrid.replaceChildren(...ordered.map(({ card }) => card));
}

function renderCompletedLevels() {
  if (catalogControls.hidden) return;
  let visible = 0;
  for (const { card, level } of cards) {
    const solved = gameProgress.has(level.id);
    card.hidden = hideCompleted.checked && solved;
    if (!card.hidden) visible++;
    card.classList.toggle("is-solved", solved);
    card.querySelector(".completed").hidden = !solved;
    const play = card.querySelector(".level-play");
    play.firstChild.textContent = solved ? "Ver resuelto " : "Jugar ";
    play.setAttribute("aria-label", (solved ? "Ver resuelto: " : "Jugar: ") + level.title);
  }
  catalogStatus.hidden = visible > 0;
  if (!visible) catalogStatus.textContent = "Ya resolviste todos los niveles.";
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
      const release = card.querySelector(".level-release");
      release.textContent = `v${level.release}`;
      release.title = `Publicado en la versión ${level.release}`;
      card.querySelector(".level-name").textContent = level.title;
      card.querySelector(".level-play").href = `/level/${level.order}/`;
      cards.push({ card, level });
    }

    catalogControls.hidden = false;
    sortLevels();
    renderCompletedLevels();
  } catch {
    catalogStatus.textContent = "No se pudieron cargar los niveles. Recarga la página para volver a intentarlo.";
  }
}

mountSession();
document.addEventListener("gameprogress", renderCompletedLevels);
hideCompleted.addEventListener("change", () => {
  savePreferences();
  renderCompletedLevels();
});
sortOrder.addEventListener("change", () => {
  savePreferences();
  sortLevels();
});
loadCatalog();
