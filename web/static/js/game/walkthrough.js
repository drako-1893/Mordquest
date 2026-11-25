import { clueText } from "./presentation.js";

export function mountWalkthrough(level, loadWalkthrough) {
  const trigger = document.querySelector("#show-walkthrough");
  const dialog = document.querySelector("#walkthrough-dialog");
  const status = dialog.querySelector("#walkthrough-status");
  const card = dialog.querySelector(".walkthrough-card");
  const count = dialog.querySelector("#walkthrough-count");
  const title = dialog.querySelector("#walkthrough-step-title");
  const text = dialog.querySelector("#walkthrough-text");
  const details = dialog.querySelector("#walkthrough-details");
  const proof = dialog.querySelector("#walkthrough-proof");
  const proofDetails = dialog.querySelector("#walkthrough-proof-details");
  const plan = dialog.querySelector(".walkthrough-plan");
  const navigation = dialog.querySelector(".walkthrough-navigation");
  const previous = dialog.querySelector("#walkthrough-previous");
  const next = dialog.querySelector("#walkthrough-next");
  const rooms = new Map(level.rooms.map(room => [room.id, room]));
  const people = new Map(level.participants.map(person => [person.initial, person]));
  let steps;
  let index = 0;
  const planCells = [];
  const size = level.size;
  plan.style.setProperty("--plan-size", size);
  for (let row = -1; row < size; row++) {
    for (let column = -1; column < size; column++) {
      const cell = document.createElement("span");
      if (row === -1 || column === -1) {
        if (row !== column) cell.textContent = Math.max(row, column) + 1;
        cell.className = "walkthrough-axis";
      } else {
        const room = level.room_map[row][column];
        cell.className = "walkthrough-cell";
        cell.style.setProperty("--room-color", rooms.get(room).color);
        cell.classList.toggle("is-blocked", level.tiles[row][column] === "#");
        cell.classList.toggle("room-edge-right", room !== level.room_map[row][column + 1]);
        cell.classList.toggle("room-edge-bottom", room !== level.room_map[row + 1]?.[column]);
        planCells.push(cell);
      }
      plan.append(cell);
    }
  }

  function renderLine(target, line) {
    const content = document.createDocumentFragment();
    for (const [index, part] of line.split(/\[\[([A-Z])\]\]/g).entries()) {
      const person = index % 2 ? people.get(part) : null;
      if (!person) {
        content.append(part);
        continue;
      }
      const reference = document.createElement("span");
      reference.className = "walkthrough-person";
      const badge = document.createElement("span");
      badge.className = "walkthrough-initial";
      badge.style.setProperty("--person-color", person.color);
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = person.initial;
      reference.append(badge, person.name);
      content.append(reference);
    }
    target.replaceChildren(content);
  }

  function render() {
    const step = steps[index];
    count.textContent = `Paso ${index + 1} de ${steps.length}`;
    renderLine(title, step.title);
    renderLine(text, step.text);
    const positions = step.positions ?? {};
    const preceding = steps[index - 1]?.positions ?? {};
    const occupants = new Map(Object.entries(positions).map(([initial, cell]) => [cell, initial]));
    planCells.forEach((cell, number) => {
      const initial = occupants.get(number);
      cell.textContent = initial ?? "";
      cell.classList.toggle("is-confirmed", Boolean(initial));
      cell.classList.toggle("is-new", Boolean(initial) && !Object.hasOwn(preceding, initial));
      if (initial) cell.style.setProperty("--person-color", people.get(initial).color);
      else cell.style.removeProperty("--person-color");
    });
    const clues = people.get(step.person)?.clues
      .filter(clue => !Object.hasOwn(clue, "person"))
      .map(clue => clueText(clue, rooms, people)) ?? [];
    const lines = [...clues, ...step.details];
    const items = lines.map(line => {
      const item = document.createElement("li");
      renderLine(item, line);
      return item;
    });
    details.replaceChildren(...(step.proof ? [] : items));
    proofDetails.replaceChildren(...(step.proof ? items : []));
    details.hidden = step.proof || !items.length;
    proof.hidden = !step.proof;
    proof.open = false;
    status.hidden = true;
    card.hidden = false;
    navigation.hidden = false;
    previous.disabled = index === 0;
    next.disabled = index === steps.length - 1;
    title.focus({ preventScroll: true });
    card.scrollTop = 0;
  }

  trigger.addEventListener("click", async () => {
    dialog.showModal();
    if (steps) {
      render();
      return;
    }
    status.hidden = false;
    status.textContent = "Cargando solución…";
    try {
      steps = await loadWalkthrough();
      if (dialog.open) render();
    } catch {
      status.textContent = "No se pudo cargar la solución. Cierra el diálogo y vuelve a intentarlo.";
    }
  });
  previous.addEventListener("click", () => { index--; render(); });
  next.addEventListener("click", () => { index++; render(); });
  dialog.addEventListener("close", () => trigger.focus());
}
