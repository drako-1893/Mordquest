import { draftKey, readDraft } from "../shared/drafts.js";
import { gameProgress } from "../shared/progress.js";
import { mountSession } from "../shared/session.js";

const levelGrid = document.querySelector("#level-grid");
const levelTemplate = document.querySelector("#level-card-template");
const catalogStatus = document.querySelector("#catalog-status");
const catalogControls = document.querySelector("#catalog-controls");
const catalogTotal = document.querySelector("#catalog-total");
const catalogSolved = document.querySelector("#catalog-solved");
const difficultyButtons = document.querySelectorAll(".catalog-difficulties button");
const hideCompleted = document.querySelector("#hide-completed");
const sortOrder = document.querySelector("#level-order");
const difficulties = { very_easy: "Muy fácil", easy: "Fácil", medium: "Medio", hard: "Difícil", expert: "Experto" };
const ranks = Object.keys(difficulties);
const titleOrder = new Intl.Collator("es");
const releaseOrder = new Intl.Collator("es", { numeric: true });
const cards = [];
let selectedDifficulty = "all";
const preferencesKey = "archivo-nocturno:catalog-options";
const byDifficulty = (a, b) => ranks.indexOf(a.difficulty) - ranks.indexOf(b.difficulty);
const orderBy = {
  number: (a, b) => a.order - b.order,
  recent: (a, b) => byDifficulty(a, b) || releaseOrder.compare(b.release, a.release),
  easy: byDifficulty,
  hard: (a, b) => byDifficulty(b, a),
  name: (a, b) => titleOrder.compare(a.title, b.title),
};

try {
  const prefs = JSON.parse(sessionStorage.getItem(preferencesKey));
  hideCompleted.checked = prefs?.hideCompleted === true;
  if (Object.hasOwn(orderBy, prefs?.sortOrder)) sortOrder.value = prefs.sortOrder;
  if (ranks.includes(prefs?.difficulty)) selectedDifficulty = prefs.difficulty;
} catch {
  // The controls work without saved preferences.
}

function savePreferences() {
  try {
    sessionStorage.setItem(preferencesKey, JSON.stringify({
      hideCompleted: hideCompleted.checked,
      sortOrder: sortOrder.value,
      difficulty: selectedDifficulty,
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

function hasDraftProgress(level) {
  const draft = readDraft(draftKey(gameProgress.username, level.id));
  return draft?.size === level.size && [draft.positions, draft.notes, draft.crosses]
    .some(entries => Array.isArray(entries) && entries.length > 0);
}

function renderCatalog() {
  if (catalogControls.hidden) return;
  for (const button of difficultyButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === selectedDifficulty));
  }

  let visible = 0;
  let matching = 0;
  let completed = 0;
  for (const { card, level } of cards) {
    const solved = gameProgress.has(level.id);
    const matchesDifficulty = selectedDifficulty === "all" || selectedDifficulty === level.difficulty;
    if (solved) completed++;
    if (matchesDifficulty) matching++;
    card.hidden = !matchesDifficulty || (hideCompleted.checked && solved);
    if (!card.hidden) visible++;
    card.classList.toggle("is-solved", solved);
    const ribbon = card.querySelector(".completed");
    ribbon.hidden = !solved && !hasDraftProgress(level);
    ribbon.textContent = solved ? "Resuelto" : "En curso";
    ribbon.dataset.state = solved ? "solved" : "in-progress";
    const play = card.querySelector(".level-play");
    play.textContent = solved ? "Ver resuelto" : "Jugar";
    play.setAttribute("aria-label", (solved ? "Ver resuelto: " : "Jugar: ") + level.title);
  }
  catalogTotal.textContent = cards.length;
  catalogSolved.textContent = completed;
  catalogStatus.hidden = visible > 0;
  if (!visible) {
    catalogStatus.textContent = matching
      ? "Ya resolviste todos los niveles de esta selección."
      : "No hay niveles para esta selección.";
  }
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/levels", { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Error al cargar el catálogo.");
    const levels = await response.json();
    await gameProgress.ready;

    for (const level of levels) {
      const card = levelTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.levelId = level.id;
      card.querySelector(".level-art").classList.add(level.theme);
      card.querySelector("img").src = new URL(`../../resources/${level.cover}`, import.meta.url).href;
      const difficulty = card.querySelector(".level-difficulty");
      difficulty.textContent = difficulties[level.difficulty];
      difficulty.classList.add(level.difficulty);
      const release = card.querySelector(".level-release");
      release.textContent = `v${level.release}`;
      release.title = `Publicado en la versión ${level.release}`;
      card.querySelector(".level-name").textContent = level.title;
      card.querySelector(".level-play").href = level.url;
      cards.push({ card, level });
    }

    catalogControls.hidden = false;
    sortLevels();
    renderCatalog();
  } catch {
    catalogStatus.textContent = "No se pudieron cargar los niveles. Recarga la página para volver a intentarlo.";
  }
}

mountSession();
document.addEventListener("gameprogress", renderCatalog);
window.addEventListener("storage", event => {
  if (event.key === null || cards.some(({ level }) => event.key === draftKey(gameProgress.username, level.id))) {
    renderCatalog();
  }
});
for (const button of difficultyButtons) {
  button.addEventListener("click", () => {
    selectedDifficulty = button.dataset.difficulty;
    savePreferences();
    renderCatalog();
  });
}
hideCompleted.addEventListener("change", () => {
  savePreferences();
  renderCatalog();
});
sortOrder.addEventListener("change", () => {
  savePreferences();
  sortLevels();
});
await loadCatalog();
