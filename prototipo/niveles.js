"use strict";

const levelGrid = document.querySelector("#level-grid");
const levelTemplate = document.querySelector("#level-card-template");
const catalogStatus = document.querySelector("#catalog-status");
const selectedTitle = document.querySelector("#selected-title");
const selectedDescription = document.querySelector("#selected-description");
const playLevel = document.querySelector("#play-level");
const themes = ["archive", "greenhouse", "museum", "arcade", "repair"];
const difficulties = { easy: "Fácil", medium: "Medio", hard: "Difícil", expert: "Experto" };

function renderCompletedLevels() {
  for (const card of levelGrid.querySelectorAll(".level-card")) {
    card.querySelector(".completed").hidden = !gameProgress.has(card.dataset.levelId);
  }
}

function selectLevel(level, card) {
  for (const option of levelGrid.querySelectorAll(".level-card")) {
    option.setAttribute("aria-pressed", String(option === card));
  }

  selectedTitle.textContent = level.order + ". " + level.title;
  selectedDescription.textContent = level.description;
  playLevel.href = "index.html?nivel=" + encodeURIComponent(level.id);
  playLevel.closest(".level-detail").hidden = false;
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/levels");
    if (!response.ok) throw new Error("Error al cargar el catálogo.");
    const levels = await response.json();

    for (const [index, level] of levels.entries()) {
      const item = levelTemplate.content.firstElementChild.cloneNode(true);
      const card = item.querySelector("button");
      const meta = item.querySelector(".level-meta");
      card.dataset.levelId = level.id;
      item.querySelector(".level-art").classList.add(themes[index % themes.length]);
      item.querySelector(".level-number").textContent = "Nivel " + level.order;
      item.querySelector("img").src = "Resources/" + level.cover;
      item.querySelector(".level-name").textContent = level.title;
      meta.classList.add("level-badge", level.difficulty);
      meta.textContent = difficulties[level.difficulty] + " · " + level.size + " × " + level.size;
      card.addEventListener("click", () => selectLevel(level, card));
      levelGrid.append(item);
      if (index === 0) selectLevel(level, card);
    }

    renderCompletedLevels();
    catalogStatus.hidden = true;
  } catch {
    catalogStatus.textContent = "No se pudieron cargar los niveles. Recarga la página para volver a intentarlo.";
  }
}

document.addEventListener("gameprogress", renderCompletedLevels);
loadCatalog();
