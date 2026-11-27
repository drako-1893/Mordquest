import { cellsBetween, mountBoard } from "./board.js";
import { clueHighlights, clueParts, clueReferenceKey, columnLabel, ruleText } from "./presentation.js";
import { mountPuzzleTimer } from "./timer.js";
import { draftKey, readDraft } from "../shared/drafts.js";
import { gameProgress } from "../shared/progress.js";
import { pageLoadingFinished } from "../shared/loading.js";
import { participantPortrait } from "../shared/portraits.js";
import { resourceUrl } from "../shared/assets.js";

function mountPhoneLayout(title, clock, helpButton) {
  const phone = matchMedia("(pointer: coarse) and ((max-width: 520px) or ((max-width: 1000px) and (max-height: 500px) and (orientation: landscape)))");
  const workspace = title.closest(".workspace");
  const boardHeading = clock.parentElement;
  const boardActions = helpButton.parentElement;
  const solutionButton = document.querySelector("#show-walkthrough");

  function applyLayout() {
    const focused = document.activeElement === helpButton;
    workspace.classList.toggle("phone-game-layout", phone.matches);
    helpButton.classList.toggle("tool", phone.matches);
    if (phone.matches) {
      title.after(clock);
      solutionButton.after(helpButton);
    } else {
      boardHeading.append(clock);
      boardActions.append(helpButton);
    }
    if (focused) helpButton.focus({ preventScroll: true });
  }

  if (phone.matches) applyLayout();
  phone.addEventListener("change", applyLayout);
}

export function startGame(level, loadWalkthrough) {
  const { size } = level;
  const participants = [...level.participants].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const placementHoldTime = 480;
  const eraseHoldTime = 800;
  const holdRevealDelay = 150;
  const fullBarTime = 50;
  const touchDragSlop = 8;
  const boardMotion = matchMedia("(prefers-reduced-motion: no-preference)");
  const holdIndicator = document.createElement("span");
  holdIndicator.className = "hold-indicator";
  holdIndicator.setAttribute("aria-hidden", "true");
  const holdFill = document.createElement("span");
  holdFill.className = "hold-fill";
  holdIndicator.append(holdFill);
  document.querySelector("#case-number").textContent = "Assoku · Nivel " + level.order;
  const title = document.querySelector("#case-title");
  title.textContent = level.title;
  document.querySelector("#case-description").textContent = level.description;
  document.querySelector("#board-size").textContent = size + " × " + size;
  const { rooms, boardViewport, cellButtons, rowOf, columnOf, roomOf, sceneryAt, highlightClues } = mountBoard(level);
  const peopleByInitial = new Map(participants.map(person => [person.initial, person]));
  const portraitsByInitial = new Map(participants.map(person => [person.initial, participantPortrait(level.id, person)]));
  const helpButton = document.querySelector("#board-help");
  const helpDialog = document.querySelector("#help-dialog");
  const helpSteps = [...helpDialog.querySelectorAll(".tutorial-step")];
  const helpCount = helpDialog.querySelector("#help-step-count");
  const helpPrevious = helpDialog.querySelector("#help-previous");
  const helpNext = helpDialog.querySelector("#help-next");
  let helpIndex = 0;
  const roster = document.querySelector("#people");
  const personTemplate = document.querySelector("#person-template");
  const crossButton = document.querySelector("#cross");
  const eraseButton = document.querySelector("#erase");
  const undoButton = document.querySelector("#undo");
  const checkButton = document.querySelector("#check");
  const resultDialog = document.querySelector("#check-result");
  const resultTitle = document.querySelector("#check-title");
  const resultMessage = document.querySelector("#check-message");
  const resultDetails = document.querySelector("#check-details");
  const resultList = document.querySelector("#check-misplaced");
  const resultClose = document.querySelector("#check-close");
  const resultSymbol = document.querySelector("#check-symbol");
  const resultReveal = document.querySelector("#check-reveal");
  const resultCulprit = document.querySelector("#check-culprit");
  const resultVictim = document.querySelector("#check-victim");
  const resultScore = document.querySelector("#check-score");
  const resultScoreLabel = document.querySelector("#check-score-label");
  const resultMeter = document.querySelector("#check-meter");
  const resultLevels = document.querySelector("#check-levels");
  const resultNext = document.querySelector("#check-next");
  const replayButton = document.querySelector("#replay");
  const replayActions = document.querySelector("#replay-actions");
  const replayNext = document.querySelector("#replay-next");
  replayNext.hidden = !replayNext.getAttribute("href");
  const replayDialog = document.querySelector("#replay-dialog");
  const replayConfirm = document.querySelector("#replay-yes");
  const replayCancel = document.querySelector("#replay-no");
  const replayStatus = document.querySelector("#replay-status");
  const feedback = document.querySelector("#feedback");
  const count = document.querySelector("#count");
  const history = [];
  const personButtons = new Map();
  const firstPerson = participants.find(person => person.clues).initial;
  const draftNotice = document.querySelector("#draft-notice");
  let state;
  let selected = firstPerson;
  let mode = "person";
  let gesture;
  let focusIndex = 0;
  let draftProfile = gameProgress.username;
  let solved = false;
  let resetting = false;
  let revision = 0;
  const timeDisplay = document.querySelector("#puzzle-time");
  const timer = mountPuzzleTimer(timeDisplay, () => !solved);
  mountPhoneLayout(title, timeDisplay.closest(".puzzle-clock"), helpButton);

  function saveDraft() {
    try {
      localStorage.setItem(draftKey(draftProfile, level.id), JSON.stringify({
        size,
        selected,
        mode,
        positions: [...state.positions],
        notes: [...state.notes].map(([index, initials]) => [index, [...initials]]),
        crosses: [...state.crosses],
        hiddenCrosses: [...state.hiddenCrosses],
        verified: state.verified,
      }));
      draftNotice.hidden = true;
    } catch {
      draftNotice.hidden = false;
    }
  }

  function emptyDraft() {
    state = { positions: new Map(), notes: new Map(), crosses: new Set(), hiddenCrosses: new Set() };
    selected = firstPerson;
    mode = "person";
  }

  function restoreDraft() {
    emptyDraft();
    const saved = readDraft(draftKey(draftProfile, level.id));
    if (saved?.size !== size) return false;

    const entries = value => Array.isArray(value) ? value : [];
    const validCell = index => Number.isInteger(index) && index >= 0 && index < size ** 2
      && sceneryAt(index)?.role !== "obstacle";
    for (const pair of entries(saved.positions)) {
      if (!Array.isArray(pair)) continue;
      const [initial, index] = pair;
      if (peopleByInitial.has(initial) && validCell(index) && !occupantAt(index)) {
        state.positions.set(initial, index);
      }
    }
    for (const pair of entries(saved.notes)) {
      if (!Array.isArray(pair)) continue;
      const [index, initials] = pair;
      if (!validCell(index)) continue;
      const marks = entries(initials).filter(initial => peopleByInitial.has(initial));
      if (marks.length) state.notes.set(index, new Set(marks));
    }
    state.crosses = new Set(entries(saved.crosses).filter(index => validCell(index) && !occupantAt(index)));
    state.hiddenCrosses = new Set(entries(saved.hiddenCrosses).filter(index =>
      validCell(index) && !occupantAt(index) && isLocked(index),
    ));
    state.verified = saved.verified === true && state.positions.size === participants.length;
    if (peopleByInitial.has(saved.selected)) selected = saved.selected;
    if (["person", "cross", "erase"].includes(saved.mode)) mode = saved.mode;
    return Boolean(state.positions.size || state.notes.size || state.crosses.size);
  }

  function occupantAt(index) {
    for (const [initial, position] of state.positions) {
      if (position === index) return initial;
    }
  }

  function sharesRowOrColumn(first, second) {
    return rowOf(first) === rowOf(second) || columnOf(first) === columnOf(second);
  }

  function isLocked(index, except) {
    for (const [initial, position] of state.positions) {
      if (initial !== except && sharesRowOrColumn(index, position)) return true;
    }
    return false;
  }

  function crossAt(index, locked = isLocked(index)) {
    if (locked && !state.hiddenCrosses.has(index)) return "automática";
    return state.crosses.has(index) ? "manual" : "";
  }

  function removeCross(index) {
    state.crosses.delete(index);
    if (isLocked(index)) state.hiddenCrosses.add(index);
  }

  function refreshHiddenCrosses() {
    for (const index of state.hiddenCrosses) {
      if (occupantAt(index) || !isLocked(index)) state.hiddenCrosses.delete(index);
    }
  }

  function announce(message, status = "") {
    feedback.textContent = message;
    feedback.dataset.state = status;
  }

  const ruleList = document.querySelector("#case-rules-list");
  for (const rule of level.rules) {
    const item = document.createElement("li");
    item.textContent = ruleText(rule, rooms);
    ruleList.append(item);
  }
  document.querySelector("#seat-rule-help").hidden = !level.rules.some(rule => rule.kind === "seated_exactly");
  document.querySelector("#case-rules").hidden = level.rules.length === 0;

  function askReplay() {
    replayStatus.hidden = true;
    if (!replayDialog.open) replayDialog.showModal();
  }

  async function restoreProfile(ask) {
    const ticket = ++revision;
    const resumed = restoreDraft();
    solved = gameProgress.has(level.id) || (!draftProfile && state.verified);
    timer.load(`${draftKey(draftProfile, level.id)}:elapsed:${size}`);
    render();
    if (!solved) {
      announce(resumed ? "Partida recuperada." : "");
      return;
    }
    if (state.verified) {
      announce("Caso resuelto.", "solved");
      if (ask) void pageLoadingFinished.then(() => {
        if (ticket === revision) askReplay();
      });
      return;
    }
    announce("Cargando el tablero resuelto…");
    try {
      const steps = await loadWalkthrough();
      if (ticket !== revision) return;
      const positions = new Map(Object.entries(steps.at(-1).positions));
      if (positions.size !== participants.length) throw new Error("El tablero resuelto está incompleto.");
      state.positions = positions;
      for (const index of positions.values()) state.crosses.delete(index);
      refreshHiddenCrosses();
      state.verified = true;
      saveDraft();
      render();
      announce("Caso resuelto.", "solved");
    } catch {
      if (ticket !== revision) return;
      announce("Caso resuelto. No se pudo cargar el tablero completo.", "solved");
    }
    if (ask) void pageLoadingFinished.then(() => {
      if (ticket === revision) askReplay();
    });
  }

  async function replay() {
    if (resetting) return;
    resetting = true;
    replayConfirm.disabled = true;
    replayCancel.disabled = true;
    replayStatus.hidden = false;
    replayStatus.textContent = "Guardando el reinicio…";
    try {
      localStorage.removeItem(draftKey(draftProfile, level.id));
      await gameProgress.reset(level.id);
      revision++;
      solved = false;
      history.length = 0;
      emptyDraft();
      timer.reset();
      replayDialog.close();
      render();
      personButtons.get(firstPerson).button.focus();
      announce("Tablero reiniciado.");
    } catch (error) {
      replayStatus.textContent = error.message || "No se pudo guardar el reinicio.";
    } finally {
      resetting = false;
      replayConfirm.disabled = false;
      replayCancel.disabled = false;
    }
  }

  function setResultTone(tone, symbol) {
    resultDialog.dataset.tone = tone;
    resultSymbol.textContent = symbol;
  }

  function celebrateSolved() {
    if (!resultDialog.open || !matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

    const confetti = document.createElement("div");
    confetti.className = "check-confetti";
    confetti.setAttribute("aria-hidden", "true");
    resultDialog.append(confetti);

    const colors = ["#f1ca92", "#a2e1b9", "#ff9fbc", "#9acdf7", "#d6b5ff"];
    const width = resultDialog.clientWidth;
    const height = resultDialog.clientHeight;
    const animations = [];
    for (let index = 0; index < 48; index++) {
      const piece = document.createElement("span");
      const drift = (Math.random() - .5) * width;
      const lift = height * (.15 + Math.random() * .42);
      const spin = 180 + Math.random() * 720;
      piece.style.backgroundColor = colors[index % colors.length];
      confetti.append(piece);
      animations.push(piece.animate([
        { transform: "translate(0, 0) rotate(0deg)", opacity: 0 },
        { transform: "translate(" + drift * .65 + "px, -" + lift + "px) rotate(" + spin / 2 + "deg)", opacity: 1, offset: .28 },
        { transform: "translate(" + drift + "px, " + height * .65 + "px) rotate(" + spin + "deg)", opacity: 0 },
      ], { duration: 1000 + Math.random() * 650, delay: Math.random() * 140, easing: "cubic-bezier(.25,.6,.45,1)", fill: "both" }));
    }

    const clear = () => {
      resultDialog.removeEventListener("close", clear);
      confetti.remove();
      for (const animation of animations) animation.cancel();
    };
    resultDialog.addEventListener("close", clear, { once: true });
    void Promise.allSettled(animations.map(animation => animation.finished)).then(clear);
  }

  async function checkCase() {
    if (solved || state.positions.size !== participants.length || resultDialog.open) return;

    cancelGesture();
    const ticket = revision;
    const positions = new Map(state.positions);
    setResultTone("pending", "…");
    resultTitle.textContent = "Comprobando…";
    resultMessage.textContent = "";
    resultDetails.open = false;
    resultDetails.hidden = true;
    resultList.replaceChildren();
    resultReveal.hidden = true;
    resultScore.hidden = true;
    resultLevels.hidden = true;
    resultNext.hidden = true;
    resultClose.disabled = true;
    resultDialog.showModal();

    try {
      const response = await fetch("/api/levels/" + encodeURIComponent(level.id) + "/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Game-Request": "1" },
        body: JSON.stringify({ positions: Object.fromEntries(positions) }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("No se pudo comprobar el caso.");
      const { misplaced, culprit, progress, next_level: nextLevel } = await response.json();
      if (ticket !== revision) return;
      if (misplaced.length) {
        setResultTone("retry", "!");
        resultTitle.textContent = "Revisa las posiciones";
        resultMessage.textContent = misplaced.length === 1
          ? "Hay una persona mal ubicada."
          : "Hay " + misplaced.length + " personas mal ubicadas.";
        for (const person of participants.filter(person => misplaced.includes(person.initial))) {
          const item = document.createElement("li");
          const initial = document.createElement("span");
          initial.className = "check-initial";
          initial.setAttribute("aria-hidden", "true");
          initial.style.setProperty("--person-color", person.color);
          initial.textContent = person.initial;
          item.append(initial, person.name);
          resultList.append(item);
        }
        const correct = participants.length - misplaced.length;
        resultScoreLabel.textContent = `${correct} de ${participants.length} ubicaciones correctas`;
        resultMeter.max = participants.length;
        resultMeter.value = correct;
        resultScore.hidden = false;
        resultDetails.hidden = false;
        return;
      }

      setResultTone("solved", "✓");
      resultTitle.textContent = "Caso resuelto";
      const victim = participants.find(person => !person.clues);
      const culpritPerson = peopleByInitial.get(culprit);
      const message = culpritPerson.name + " estaba a solas con " + victim.name + ".";
      resultMessage.textContent = message;
      for (const [figure, person] of [[resultCulprit, culpritPerson], [resultVictim, victim]]) {
        figure.style.setProperty("--person-color", person.color);
        figure.querySelector(".check-portrait").replaceChildren(portraitsByInitial.get(person.initial).cloneNode(true));
        figure.querySelector("figcaption strong").textContent = person.name;
      }
      resultReveal.hidden = false;
      celebrateSolved();
      state.positions = positions;
      state.verified = true;
      solved = true;
      saveDraft();
      render();
      announce("Caso resuelto. " + message, "solved");
      if (nextLevel) {
        resultNext.href = `/level/${nextLevel.order}/`;
        resultNext.hidden = false;
      }
      const notice = document.querySelector("#progress-notice");
      await gameProgress.complete(level.id, progress).then(
        () => { notice.hidden = true; },
        () => { notice.hidden = false; },
      );
    } catch {
      setResultTone("retry", "!");
      resultTitle.textContent = "No se pudo comprobar";
      resultMessage.textContent = "Cierra esta ventana e inténtalo otra vez.";
    } finally {
      resultClose.disabled = false;
      resultLevels.hidden = false;
      if (resultDialog.open) (resultNext.hidden ? resultClose : resultNext).focus();
    }
  }

  function saveChange(update, message, recordUndo = true) {
    if (solved) return;
    if (recordUndo) {
      history.push({
        positions: new Map(state.positions),
        notes: new Map(state.notes),
        crosses: new Set(state.crosses),
        hiddenCrosses: new Set(state.hiddenCrosses),
      });
    }
    update();
    saveDraft();
    render({ animate: true });
    announce(message);
  }

  function removePlacement(initial) {
    saveChange(() => {
      state.positions.delete(initial);
      refreshHiddenCrosses();
    }, `Ficha de ${peopleByInitial.get(initial).name} retirada.`);
  }

  function canErase(index) {
    return Boolean(occupantAt(index) || state.notes.has(index) || crossAt(index));
  }

  function eraseCell(index) {
    const occupant = occupantAt(index);
    if (occupant) {
      state.positions.delete(occupant);
      refreshHiddenCrosses();
    } else {
      state.notes.delete(index);
      removeCross(index);
    }
  }

  function toggleCross(index) {
    if (sceneryAt(index)?.role === "obstacle") {
      announce("Esta casilla está bloqueada por un objeto del plano.");
      return;
    }
    if (occupantAt(index)) {
      announce("La casilla está ocupada.");
      return;
    }
    const marked = Boolean(crossAt(index));
    saveChange(() => setCross(index, !marked), marked ? "X retirada." : "X marcada.");
  }

  function setCross(index, marked) {
    if (!marked) removeCross(index);
    else if (isLocked(index)) state.hiddenCrosses.delete(index);
    else state.crosses.add(index);
  }

  function setNote(index, initial, marked) {
    const notes = new Set(state.notes.get(index));
    if (marked) notes.add(initial);
    else notes.delete(initial);
    if (notes.size) state.notes.set(index, notes);
    else state.notes.delete(index);
  }

  function resetBoard() {
    if (!state.positions.size && !state.notes.size && !state.crosses.size && !state.hiddenCrosses.size) {
      announce("El tablero ya está vacío.");
      return;
    }
    saveChange(() => {
      state.positions.clear();
      state.notes.clear();
      state.crosses.clear();
      state.hiddenCrosses.clear();
    }, "Tablero reiniciado.");
  }

  function act(index, held) {
    if (solved) return;
    if (sceneryAt(index)?.role === "obstacle") {
      announce("Esta casilla está bloqueada por un objeto del plano.");
      return;
    }
    const occupant = occupantAt(index);
    if (mode === "erase") {
      if (occupant) {
        removePlacement(occupant);
      } else if (canErase(index)) {
        saveChange(() => eraseCell(index), "Casilla borrada.");
      }
      return;
    }

    if (mode === "cross") {
      toggleCross(index);
      return;
    }

    const person = peopleByInitial.get(selected);
    if (held) {
      if (occupant === selected) return;
      if (occupant) {
        announce("La casilla está ocupada.");
        return;
      }
      saveChange(() => {
        state.positions.set(selected, index);
        state.crosses.delete(index);
        refreshHiddenCrosses();
      }, `${person.name} se ubicó en ${columnLabel(columnOf(index))}${rowOf(index) + 1}.`);
      shakePlacementConflict(index);
      return;
    }

    if (state.positions.has(selected)) {
      announce(`${person.name} ya está ubicado. Mantén pulsada otra casilla para mover la ficha.`);
      return;
    }
    if (occupant || crossAt(index)) {
      announce("La casilla está ocupada o marcada con X.");
      return;
    }
    const marked = Boolean(state.notes.get(index)?.has(selected));
    saveChange(() => setNote(index, selected, !marked),
      marked ? `Inicial ${selected} retirada.` : `Inicial ${selected} anotada.`);
  }

  function selectMode(nextMode, initial = selected) {
    if (solved) return;
    cancelGesture();
    mode = nextMode;
    selected = initial;
    saveDraft();
    render();
    if (mode === "person") announce(`${peopleByInitial.get(initial).name} es la ficha activa.`);
    if (mode === "cross") announce("Marca X activa. Pulsa una casilla o arrastra para marcar varias.");
    if (mode === "erase") announce("Borrar activo. Pulsa una casilla o arrastra para borrar varias.");
  }

  function renderControls() {
    crossButton.setAttribute("aria-pressed", String(mode === "cross"));
    eraseButton.setAttribute("aria-pressed", String(mode === "erase"));
    boardViewport.classList.toggle("is-solved", solved);
    crossButton.disabled = solved;
    eraseButton.disabled = solved;
    undoButton.disabled = solved || history.length === 0;
    checkButton.disabled = solved || state.positions.size !== participants.length;
    checkButton.hidden = solved;
    replayActions.hidden = !solved;
    count.textContent = `${state.positions.size} / ${participants.length}`;
    for (const [initial, { button, indicator }] of personButtons) {
      const placed = state.positions.has(initial);
      button.disabled = solved;
      button.setAttribute("aria-pressed", String(!solved && mode === "person" && selected === initial));
      button.classList.toggle("is-placed", placed);
      indicator.hidden = !placed;
    }
  }

  function showTokenExit(tokens, token) {
    const piece = token.classList.contains("token");
    token.className = piece ? "token-exit" : "cell-mark-exit";
    const exit = document.createElement("span");
    exit.className = "tokens-exit";
    exit.setAttribute("aria-hidden", "true");
    exit.append(token);
    tokens.before(exit);
    const animation = token.animate([
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: piece ? "translateY(-24%) scale(.78)" : "rotate(16deg) scale(.45)" },
    ], { duration: piece ? 170 : 130, easing: "ease-in" });
    animation.onfinish = animation.oncancel = () => exit.remove();
  }

  function shakePlacementConflict(index) {
    if (!boardMotion.matches) return;
    const otherPositions = [...state.positions.values()]
      .filter(position => position !== index && sharesRowOrColumn(index, position));
    if (!otherPositions.length) return;

    for (const position of [index, ...otherPositions]) {
      const token = cellButtons[position].querySelector(".tokens > .token");
      token.animate([
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ], { duration: 320 });
    }
  }

  function renderCellTokens(cell, { occupant, cross, notes, activeNote, scenery }, animate) {
    const tokens = cell.querySelector(".tokens");
    const signature = occupant ? `piece:${occupant}` : cross ? "cross"
      : `notes:${notes.join(",")}:${activeNote ? selected : ""}`;
    if (tokens.dataset.content === signature) return;
    tokens.dataset.content = signature;

    cell.querySelector(".tokens-exit")?.remove();
    const previous = tokens.firstElementChild;
    if (animate && previous?.matches(".token, .cell-mark")) showTokenExit(tokens, previous);
    const previousNotes = animate && notes.length
      ? new Set([...tokens.children].map(note => note.textContent))
      : null;
    tokens.replaceChildren();
    tokens.classList.toggle("has-notes", notes.length > 0);

    if (occupant) {
      const person = peopleByInitial.get(occupant);
      const token = document.createElement("span");
      token.className = "token";
      token.style.setProperty("--person-color", person.color);
      const initial = document.createElement("span");
      initial.className = "portrait-initial";
      initial.textContent = person.initial;
      token.append(portraitsByInitial.get(occupant).cloneNode(true), initial);
      if (scenery?.id) {
        const objectIcon = document.createElement("img");
        objectIcon.className = "token-object";
        objectIcon.src = resourceUrl(`${scenery.id}.svg`);
        objectIcon.alt = "";
        token.append(objectIcon);
      }
      tokens.append(token);
      if (animate) token.animate([
        { opacity: .35, transform: "translateY(-24%) scale(.88)" },
        { opacity: 1, transform: "translateY(3%) scale(1.05)", offset: .68 },
        { opacity: 1, transform: "none" },
      ], { duration: 220, easing: "ease-out" });
    } else if (cross) {
      const mark = document.createElement("span");
      mark.className = "cell-mark";
      mark.textContent = "×";
      tokens.append(mark);
      if (animate) mark.animate([
        { opacity: .2, transform: "rotate(-18deg) scale(.55)" },
        { opacity: 1, transform: "scale(1.1)", offset: .7 },
        { opacity: 1, transform: "none" },
      ], { duration: 160, easing: "ease-out" });
    } else if (notes.length) {
      tokens.style.setProperty("--note-columns", Math.ceil(Math.sqrt(notes.length)));
      for (const initial of notes) {
        const note = document.createElement("span");
        note.className = activeNote && initial === selected ? "note note-active" : "note";
        note.textContent = initial;
        note.style.setProperty("--person-color", peopleByInitial.get(initial).color);
        tokens.append(note);
        if (previousNotes && !previousNotes.has(initial)) note.animate([
          { opacity: .3, transform: "scale(.75)" },
          { opacity: 1, transform: "none" },
        ], { duration: 130, easing: "ease-out" });
      }
    }
  }

  function renderCell(cell, index, animate, highlights) {
    const occupant = occupantAt(index);
    const scenery = sceneryAt(index);
    const blocked = scenery?.role === "obstacle";
    const locked = !occupant && !blocked && isLocked(index);
    const conflict = Boolean(occupant) && isLocked(index, occupant);
    const unavailable = blocked || (Boolean(occupant) && mode !== "erase");
    const cross = !occupant && !blocked && crossAt(index, locked);
    const notes = solved || occupant || blocked || cross ? [] : [...(state.notes.get(index) ?? [])]
      .filter(initial => !state.positions.has(initial))
      .sort();
    const activeNote = mode === "person" && notes.includes(selected);
    renderCellTokens(cell, { occupant, cross, notes, activeNote, scenery }, animate);
    const parts = [
      `Fila ${rowOf(index) + 1}, columna ${columnLabel(columnOf(index))}`,
      roomOf(index).name,
    ];
    if (scenery) parts.push(scenery.name);
    if (blocked) parts.push("Obstáculo fijo");

    if (occupant) {
      parts.push(`${peopleByInitial.get(occupant).name} en esta casilla`);
      if (conflict) parts.push("Comparte fila o columna con otra ficha");
    } else if (cross) {
      parts.push(`X ${cross}`);
    } else if (notes.length) {
      parts.push(`Anotaciones ${notes.join(", ")}`);
    }

    cell.classList.toggle("is-occupied", Boolean(occupant));
    cell.classList.toggle("has-placement-conflict", conflict);
    cell.classList.toggle("clue-person", Boolean(occupant && highlights?.has(`person:${occupant}`)));
    cell.classList.toggle("is-obstacle", blocked);
    cell.classList.toggle("is-unavailable", unavailable);
    cell.disabled = solved;
    if (blocked || solved) cell.setAttribute("aria-disabled", "true");
    else cell.removeAttribute("aria-disabled");
    cell.classList.toggle("has-cross", Boolean(cross));
    cell.classList.toggle("has-active-note", activeNote);
    cell.setAttribute("aria-label", parts.join(". "));
  }

  function render({ animate = false } = {}) {
    renderControls();
    const highlights = !solved && mode === "person" ? personButtons.get(selected).highlights : null;
    highlightClues(highlights);
    const playAnimations = animate && boardMotion.matches;
    cellButtons.forEach((cell, index) => renderCell(cell, index, playAnimations, highlights));
  }

  function clearHold(press) {
    if (!press.animation) return;
    press.animation.onfinish = null;
    press.animation.cancel();
    press.revealAnimation.cancel();
    press.animation = undefined;
    holdIndicator.remove();
  }

  function cancelGesture() {
    const press = gesture;
    if (!press) return;
    gesture = undefined;
    clearHold(press);
  }

  function focusCell(index) {
    cellButtons[focusIndex].tabIndex = -1;
    focusIndex = index;
    const cell = cellButtons[index];
    cell.tabIndex = 0;
    cell.focus({ preventScroll: true });
  }

  function bindPress(control, action, { focus, holdTime = 0, canHold = () => true, startDrag, secondaryAction } = {}) {
    control.addEventListener("pointerdown", event => {
      const secondary = event.button === 2 && event.pointerType === "mouse";
      if (!event.isPrimary || (event.button !== 0 && !(secondary && secondaryAction))) return;
      cancelGesture();
      focus?.();
      control.setPointerCapture(event.pointerId);
      const drag = startDrag?.(secondary);
      const press = {
        control, id: event.pointerId, completed: false, drag,
        startX: event.clientX, startY: event.clientY, touchDrag: event.pointerType === "touch" && Boolean(drag),
        action: secondary ? secondaryAction : action,
      };
      gesture = press;
      if (secondary || !holdTime || !canHold()) return;
      control.append(holdIndicator);
      const duration = holdTime + fullBarTime;
      const startTime = performance.now();
      const revealAnimation = holdIndicator.animate([
        { visibility: "hidden" },
        { visibility: "visible" },
      ], { duration: holdRevealDelay, easing: "step-end", fill: "both" });
      const animation = holdFill.animate([
        { transform: "scaleX(0)" },
        { transform: "scaleX(0)", offset: holdRevealDelay / duration, easing: boardMotion.matches ? "linear" : "step-end" },
        { transform: "scaleX(1)", offset: holdTime / duration },
        { transform: "scaleX(1)" },
      ], { duration, fill: "both" });
      revealAnimation.startTime = startTime;
      animation.startTime = startTime;
      press.animation = animation;
      press.revealAnimation = revealAnimation;
      // Touch placement waits for release so a stationary hold can still turn into a drag.
      if (!press.touchDrag) {
        animation.onfinish = () => {
          if (gesture !== press) return;
          press.completed = true;
          clearHold(press);
          action(true);
        };
      }
    });

    control.addEventListener("pointermove", event => {
      const press = gesture;
      if (press?.control !== control || press.id !== event.pointerId || press.completed) return;
      if (!press.dragging) {
        if (press.touchDrag) {
          const movement = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
          if (movement < touchDragSlop) return;
        } else if (isInside(control, event)) {
          return;
        }
        if (!press.drag) {
          cancelGesture();
          return;
        }
        clearHold(press);
        press.dragging = true;
      }
      press.drag(event);
    });

    control.addEventListener("pointerup", event => {
      if (gesture?.control !== control || gesture.id !== event.pointerId) return;
      const { completed, animation, dragging, drag, action: release } = gesture;
      const held = animation?.currentTime >= holdTime;
      if (dragging) drag(event);
      cancelGesture();
      if (!completed && !dragging && isInside(control, event)) {
        release(held);
      }
    });

    for (const type of ["pointercancel", "lostpointercapture"]) {
      control.addEventListener(type, event => {
        if (gesture?.id === event.pointerId && gesture.control === control) cancelGesture();
      });
    }

    control.addEventListener("click", event => {
      if (event.detail === 0) action(false);
    });
  }

  function startStroke(index, secondary) {
    const crosses = secondary || mode === "cross";
    const erasing = !secondary && mode === "erase";
    if (!crosses && !erasing && state.positions.has(selected)) return;

    const initial = selected;
    const visited = new Set();
    let previous = index;
    let marking;
    let changed = false;
    return event => {
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell");
      const next = cellButtons.indexOf(hit);
      if (next < 0) {
        previous = null;
        return;
      }
      const path = cellsBetween(previous ?? next, next, size);
      previous = next;
      const changes = [];
      for (const cell of path) {
        if (visited.has(cell) || sceneryAt(cell)?.role === "obstacle") continue;
        if (erasing) {
          visited.add(cell);
          if (canErase(cell)) changes.push(cell);
          continue;
        }
        if (occupantAt(cell)) continue;
        const cross = crossAt(cell);
        if (!crosses && cross) continue;
        const marked = crosses ? Boolean(cross) : Boolean(state.notes.get(cell)?.has(initial));
        marking ??= !marked;
        visited.add(cell);
        if (marked !== marking) changes.push(cell);
      }
      if (!changes.length) return;
      const message = erasing ? "Casillas borradas."
        : crosses ? (marking ? "X marcadas." : "X retiradas.")
          : (marking ? `Inicial ${initial} anotada.` : `Inicial ${initial} retirada.`);
      saveChange(() => {
        for (const cell of changes) {
          if (erasing) eraseCell(cell);
          else if (crosses) setCross(cell, marking);
          else setNote(cell, initial, marking);
        }
      }, message, !changed);
      changed = true;
    };
  }

  function bindCell(cell, index) {
    bindPress(cell, held => act(index, held), {
      focus: () => focusCell(index),
      holdTime: placementHoldTime,
      canHold: () => mode === "person" && sceneryAt(index)?.role !== "obstacle",
      startDrag: secondary => startStroke(index, secondary),
      secondaryAction: () => {
        const occupant = occupantAt(index);
        if (occupant) removePlacement(occupant);
        else toggleCross(index);
      },
    });
    cell.addEventListener("contextmenu", event => event.preventDefault());
    cell.addEventListener("keydown", event => {
      if (event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) act(index, true);
        return;
      }
      const moves = {
        ArrowUp: rowOf(index) > 0 ? index - size : index,
        ArrowDown: rowOf(index) < size - 1 ? index + size : index,
        ArrowLeft: columnOf(index) > 0 ? index - 1 : index,
        ArrowRight: columnOf(index) < size - 1 ? index + 1 : index,
      };
      if (Object.hasOwn(moves, event.key)) {
        event.preventDefault();
        focusCell(moves[event.key]);
      }
    });
  }

  function isInside(control, event) {
    const { left, right, top, bottom } = control.getBoundingClientRect();
    return event.clientX >= left && event.clientX < right && event.clientY >= top && event.clientY < bottom;
  }

  for (const person of participants) {
    const button = personTemplate.content.firstElementChild.cloneNode(true);
    button.style.setProperty("--person-color", person.color);
    button.querySelector(".portrait").prepend(portraitsByInitial.get(person.initial));
    button.querySelector(".portrait-initial").textContent = person.initial;
    button.querySelector(".person-name-text").textContent = person.name;
    const sex = button.querySelector(".person-sex");
    if (person.sex === "male" || person.sex === "female") {
      const male = person.sex === "male";
      sex.dataset.sex = person.sex;
      sex.textContent = male ? "♂\uFE0E" : "♀\uFE0E";
      sex.setAttribute("aria-label", male ? "Hombre" : "Mujer");
      sex.hidden = false;
    }
    const group = button.querySelector(".person-group");
    group.hidden = !person.group;
    group.textContent = person.group ?? "";
    const clues = button.querySelector(".clues");
    const highlights = clueHighlights(person.clues, peopleByInitial);
    for (const data of person.clues ?? [null]) {
      const clue = document.createElement("span");
      clue.className = "clue";
      if (data) {
        const parts = clueParts(data, rooms, peopleByInitial, level.room_types);
        const { color } = highlights.get(clueReferenceKey(data));
        for (const [index, part] of parts.entries()) {
          if (index % 2 === 0) {
            clue.append(part);
            continue;
          }
          const highlight = document.createElement("strong");
          highlight.className = "clue-reference";
          highlight.textContent = part;
          if (index === parts.length - 2) {
            highlight.style.setProperty("--clue-color", color);
            if (data.person) highlight.classList.add("clue-person-reference");
          }
          clue.append(highlight);
        }
      } else {
        clue.textContent = "Estaba a solas con el asesino";
      }
      clues.append(clue);
    }
    personButtons.set(person.initial, { button, indicator: button.querySelector(".placed-indicator"), highlights });
    button.addEventListener("click", () => selectMode("person", person.initial));
    roster.append(button);
  }

  cellButtons.forEach(bindCell);

  window.addEventListener("blur", cancelGesture);
  function showHelpStep(index) {
    helpIndex = index;
    helpSteps.forEach((step, number) => { step.hidden = index !== number; });
    helpCount.textContent = `Paso ${index + 1} de ${helpSteps.length}`;
    helpPrevious.disabled = index === 0;
    helpNext.textContent = index === helpSteps.length - 1 ? "Terminar" : "Siguiente";
    helpSteps[index].querySelector("h3").focus();
  }
  function openTutorial() {
    helpDialog.showModal();
    showHelpStep(0);
  }
  helpButton.addEventListener("click", openTutorial);
  helpPrevious.addEventListener("click", () => showHelpStep(helpIndex - 1));
  helpNext.addEventListener("click", () => {
    if (helpIndex === helpSteps.length - 1) helpDialog.close();
    else showHelpStep(helpIndex + 1);
  });
  helpDialog.addEventListener("close", () => helpButton.focus());
  bindPress(crossButton, () => selectMode(mode === "cross" ? "person" : "cross"));
  bindPress(eraseButton, held => {
    if (held) resetBoard();
    else selectMode(mode === "erase" ? "person" : "erase");
  }, { holdTime: eraseHoldTime });
  eraseButton.addEventListener("contextmenu", event => event.preventDefault());
  eraseButton.addEventListener("keydown", event => {
    if (!event.shiftKey || event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) resetBoard();
  });
  checkButton.addEventListener("click", checkCase);
  resultDialog.addEventListener("cancel", event => {
    if (resultClose.disabled) event.preventDefault();
  });
  resultDialog.addEventListener("close", () => (solved ? replayButton : checkButton).focus());
  replayButton.addEventListener("click", askReplay);
  replayConfirm.addEventListener("click", replay);
  replayDialog.addEventListener("cancel", event => {
    if (resetting) event.preventDefault();
  });
  replayDialog.addEventListener("close", () => {
    if (solved) replayButton.focus();
  });
  bindPress(undoButton, () => {
    cancelGesture();
    if (!history.length) return;
    state = history.pop();
    saveDraft();
    const undoDisabled = history.length === 0 && document.activeElement === undoButton;
    render({ animate: true });
    if (undoDisabled) {
      const activeTool = mode === "cross" ? crossButton : eraseButton;
      const activeControl = mode === "person" ? personButtons.get(selected).button : activeTool;
      activeControl.focus();
    }
    announce("Último cambio deshecho.");
  });

  const restored = restoreProfile(true);
  document.addEventListener("gameprogress", () => {
    if (draftProfile === gameProgress.username && (resetting || solved || !gameProgress.has(level.id))) return;
    cancelGesture();
    draftProfile = gameProgress.username;
    draftNotice.hidden = true;
    history.length = 0;
    if (resultDialog.open) resultDialog.close();
    if (replayDialog.open) replayDialog.close();
    restoreProfile(true);
  });
  return { restored, openTutorial };
}
