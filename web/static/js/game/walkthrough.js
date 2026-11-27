import { applyFloor } from "../shared/scenery.js";
import { clueText, columnLabel } from "./presentation.js";

export function mountWalkthrough(level, loadWalkthrough) {
  const trigger = document.querySelector("#show-walkthrough");
  const dialog = document.querySelector("#walkthrough-dialog");
  const status = dialog.querySelector("#walkthrough-status");
  const card = dialog.querySelector(".walkthrough-card");
  const count = dialog.querySelector("#walkthrough-count");
  const title = dialog.querySelector("#walkthrough-step-title");
  const text = dialog.querySelector("#walkthrough-text");
  const details = dialog.querySelector("#walkthrough-details");
  const plan = dialog.querySelector(".walkthrough-plan");
  const navigation = dialog.querySelector(".walkthrough-navigation");
  const previous = dialog.querySelector("#walkthrough-previous");
  const next = dialog.querySelector("#walkthrough-next");
  const rooms = new Map(level.rooms.map(room => [room.id, room]));
  const people = new Map(level.participants.map(person => [person.initial, person]));
  let steps;
  let loading = false;
  let index = 0;
  const planCells = [];
  const columnHeaders = [];
  const size = level.size;
  plan.style.setProperty("--plan-size", size);
  for (let row = -1; row < size; row++) {
    for (let column = -1; column < size; column++) {
      const cell = document.createElement("span");
      if (row === -1 || column === -1) {
        if (column >= 0) {
          cell.textContent = columnLabel(column);
          columnHeaders.push(cell);
        }
        else if (row >= 0) cell.textContent = row + 1;
        cell.className = "walkthrough-axis";
      } else {
        const roomId = level.room_map[row][column];
        const room = rooms.get(roomId);
        cell.className = "walkthrough-cell";
        const tile = level.tiles[row][column];
        if (tile === "~") applyFloor(cell, "agua");
        else applyFloor(cell, room.floor, room.color);
        cell.classList.toggle("is-blocked", tile === "#");
        cell.classList.toggle("room-edge-right", roomId !== level.room_map[row][column + 1]);
        cell.classList.toggle("room-edge-bottom", roomId !== level.room_map[row + 1]?.[column]);
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
      badge.title = person.name;
      badge.textContent = person.initial;
      reference.append(badge);
      content.append(reference);
    }
    target.replaceChildren(content);
  }

  function render() {
    const step = steps[index];
    count.textContent = `Paso ${index + 1} de ${steps.length}`;
    renderLine(title, step.title);
    const person = people.get(step.person);
    const clues = person?.clues
      .filter(clue => !Object.hasOwn(clue, "person"))
      .map(clue => clueText(clue, rooms, people, level.room_types)
        .replace(/^Estaba /, "").replace(/\.$/, "")) ?? [];
    const evidence = clues.length ? `[[${person.initial}]] estaba ${clues.join(" y ")}. Por eso, ` : "";
    renderLine(text, evidence + step.text);
    const positions = step.positions ?? {};
    const preceding = steps[index - 1]?.positions ?? {};
    const occupants = new Map(Object.entries(positions).map(([initial, cell]) => [cell, initial]));
    const occupiedColumns = new Map(Object.entries(positions).map(([initial, cell]) => [cell % size, initial]));
    columnHeaders.forEach((header, column) => {
      const initial = occupiedColumns.get(column);
      header.classList.toggle("is-filled", Boolean(initial));
      if (initial) header.style.setProperty("--person-color", people.get(initial).color);
      else header.style.removeProperty("--person-color");
    });
    planCells.forEach((cell, number) => {
      const initial = occupants.get(number);
      cell.textContent = initial ?? "";
      cell.classList.toggle("is-confirmed", Boolean(initial));
      cell.classList.toggle("is-new", Boolean(initial) && !Object.hasOwn(preceding, initial));
      if (initial) cell.style.setProperty("--person-color", people.get(initial).color);
      else cell.style.removeProperty("--person-color");
    });
    const items = step.details.map(line => {
      const item = document.createElement("li");
      renderLine(item, line);
      return item;
    });
    details.replaceChildren(...items);
    details.hidden = !items.length;
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
    if (loading) return;
    status.hidden = false;
    status.textContent = "Cargando solución…";
    loading = true;
    try {
      steps ??= await loadWalkthrough();
      if (!steps.length) throw new Error("La solución no contiene pasos.");
      if (dialog.open) render();
    } catch (error) {
      console.error("No se pudo mostrar la solución.", error);
      steps = undefined;
      index = 0;
      card.hidden = true;
      navigation.hidden = true;
      status.hidden = false;
      status.textContent = "No se pudo cargar la solución. Cierra el diálogo y vuelve a intentarlo.";
    } finally {
      loading = false;
    }
  });
  previous.addEventListener("click", () => { index--; render(); });
  next.addEventListener("click", () => { index++; render(); });
  dialog.addEventListener("close", () => trigger.focus());
}
