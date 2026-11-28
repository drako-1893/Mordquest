export function mountBoardZoom(viewport, cellButtons, size) {
  const controls = document.querySelector(".board-zoom");
  const workspace = viewport.closest(".workspace");
  const clue = controls.querySelector(".board-active-clue");
  const clueName = clue.querySelector("summary");
  const clueText = clue.querySelector("div");
  const zoomOut = controls.querySelector("[data-board-zoom-out]");
  const zoomIn = controls.querySelector("[data-board-zoom-in]");
  const fitButton = controls.querySelector("[data-board-fit]");
  const panButton = controls.querySelector("[data-board-pan]");
  const layout = viewport.querySelector(".board-layout");
  const compact = matchMedia("(max-width: 1000px)");
  const scales = [1, 1.25, 1.6, 2];
  let zoom = 0;
  let fit = false;
  let pan = false;
  let width = 0;
  let centre = { x: 0, y: 0 };
  let shownPerson;
  let drag;

  function active() {
    return size > 8 && compact.matches;
  }

  function rememberCentre() {
    if (!width || fit) return;
    centre = {
      x: (viewport.scrollLeft + viewport.clientWidth / 2) / width,
      y: (viewport.scrollTop + viewport.clientHeight / 2) / width,
    };
  }

  function update() {
    const enabled = active();
    workspace.classList.toggle("has-board-zoom", enabled);
    controls.hidden = !enabled;
    viewport.classList.toggle("is-board-fit", enabled && fit);
    viewport.classList.toggle("is-board-panning", enabled && pan && !fit);
    if (!enabled) {
      width = 0;
      layout.style.removeProperty("--zoomed-board-size");
      return;
    }

    const available = Math.min(viewport.clientWidth, viewport.clientHeight);
    if (!available) return;
    const playWidth = Math.max(size * 24 + 26, available);
    width = fit ? available : Math.ceil(playWidth * scales[zoom]);
    layout.style.setProperty("--zoomed-board-size", `${width}px`);
    viewport.scrollTo(fit ? 0 : centre.x * width - viewport.clientWidth / 2,
      fit ? 0 : centre.y * width - viewport.clientHeight / 2);
    zoomOut.disabled = !fit && zoom === 0;
    zoomIn.disabled = !fit && zoom === scales.length - 1;
    fitButton.setAttribute("aria-pressed", String(fit));
    panButton.setAttribute("aria-pressed", String(pan && !fit));
    panButton.disabled = fit;
  }

  function switchZoom(direction) {
    rememberCentre();
    if (fit) fit = false;
    else zoom = Math.max(0, Math.min(scales.length - 1, zoom + direction));
    update();
  }

  if (size > 8) {
    zoomOut.addEventListener("click", () => switchZoom(-1));
    zoomIn.addEventListener("click", () => switchZoom(1));
    fitButton.addEventListener("click", () => {
      rememberCentre();
      fit = !fit;
      update();
    });
    panButton.addEventListener("click", () => {
      rememberCentre();
      pan = !pan;
      update();
    });
    viewport.addEventListener("scroll", () => {
      layout.style.setProperty("--board-scroll-x", `${viewport.scrollLeft}px`);
      layout.style.setProperty("--board-scroll-y", `${viewport.scrollTop}px`);
      rememberCentre();
    });
    viewport.addEventListener("click", event => {
      if (!active() || !fit || event.detail === 0) return;
      const index = cellButtons.indexOf(event.target.closest(".cell"));
      if (index < 0) return;
      centre = { x: (index % size + .5) / size, y: (Math.floor(index / size) + .5) / size };
      fit = false;
      update();
    });
    viewport.addEventListener("pointerdown", event => {
      if (!active() || !pan || fit || event.pointerType === "touch" || event.button !== 0) return;
      drag = { id: event.pointerId, x: viewport.scrollLeft + event.clientX, y: viewport.scrollTop + event.clientY };
      viewport.setPointerCapture(drag.id);
      event.preventDefault();
    });
    viewport.addEventListener("pointermove", event => {
      if (drag?.id === event.pointerId) viewport.scrollTo(drag.x - event.clientX, drag.y - event.clientY);
    });
    viewport.addEventListener("lostpointercapture", () => { drag = undefined; });
    compact.addEventListener("change", update);
    new ResizeObserver(update).observe(viewport);
    update();
  }

  return {
    ignoresPointer() {
      return active() && (fit || pan);
    },
    reveal(cell) {
      if (active() && !fit) cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    showClues(person, clues) {
      if (size <= 8 || shownPerson === person) return;
      shownPerson = person;
      clueName.textContent = `${person.name} · Pistas`;
      clueText.replaceChildren(clues.cloneNode(true));
    },
  };
}
