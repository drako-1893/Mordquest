import { clueText } from "./presentation.js";

export function mountWalkthrough(level) {
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
  const navigation = dialog.querySelector(".walkthrough-navigation");
  const previous = dialog.querySelector("#walkthrough-previous");
  const next = dialog.querySelector("#walkthrough-next");
  const rooms = new Map(level.rooms.map(room => [room.id, room]));
  const people = new Map(level.participants.map(person => [person.initial, person]));
  let steps;
  let loading;
  let index = 0;

  function render() {
    const step = steps[index];
    count.textContent = `Paso ${index + 1} de ${steps.length}`;
    title.textContent = step.title;
    text.textContent = step.text;
    const clues = people.get(step.person)?.clues
      .filter(clue => !Object.hasOwn(clue, "person"))
      .map(clue => clueText(clue, rooms, people)) ?? [];
    const lines = [...clues, ...step.details];
    const items = lines.map(line => {
      const item = document.createElement("li");
      item.textContent = line;
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
    loading ??= fetch("/api/levels/" + encodeURIComponent(level.id) + "/walkthrough")
      .then(response => {
        if (!response.ok) throw new Error("Error al cargar la solución.");
        return response.json();
      });
    try {
      steps = await loading;
      if (dialog.open) render();
    } catch {
      status.textContent = "No se pudo cargar la solución. Cierra el diálogo y vuelve a intentarlo.";
    } finally {
      loading = undefined;
    }
  });
  previous.addEventListener("click", () => { index--; render(); });
  next.addEventListener("click", () => { index++; render(); });
  dialog.addEventListener("close", () => trigger.focus());
}
