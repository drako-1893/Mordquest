"use strict";

async function loadGame() {
  const status = document.querySelector("#level-load-status");
  const id = new URLSearchParams(location.search).get("nivel") ?? "turno-de-cierre";
  try {
    const response = await fetch("/api/levels/" + encodeURIComponent(id));
    if (response.status === 404) {
      status.textContent = "Este nivel no existe. Elige otro desde la selección de niveles.";
      return;
    }
    if (!response.ok) throw new Error("Error al cargar el nivel.");
    const level = await response.json();
    await gameProgress.ready;
    startGame(level);
    document.querySelector("#case-content").hidden = false;
    status.hidden = true;
  } catch {
    status.textContent = "No se pudo cargar el nivel. Recarga la página para volver a intentarlo.";
  }
}

function startGame(level) {
  const { size, participants } = level;
  const holdTime = 550;
  const objects = {
    S: { id: "silla", label: "una silla" },
    A: { id: "alfombra", label: "una alfombra" },
    B: { id: "banco", label: "un banco" },
    P: { id: "puf", label: "un puf" },
    "#": { label: "un obstáculo" },
  };
  const directions = { north: "norte", south: "sur", east: "este", west: "oeste" };
  const rooms = new Map(level.rooms.map(room => [room.id, room]));
  const layout = level.tiles.flatMap((row, y) => Array.from(row).flatMap((symbol, x) => {
    const room = rooms.get(level.room_map[y][x]);
    const id = symbol === "#" ? room.obstacle_asset : symbol === "A" ? room.rug_asset : objects[symbol]?.id;
    return id ? [[id, x, y]] : [];
  }));
  const sceneryTiles = makeScenery(layout, size, size);

  document.title = "Archivo Nocturno · " + level.title;
  document.querySelector("#case-number").textContent = "Archivo Nocturno · Nivel " + level.order;
  document.querySelector("#case-title").textContent = level.title;
  document.querySelector("#case-description").textContent = level.description;
  document.querySelector("#board-size").textContent = size + " × " + size;
  const layoutElement = document.querySelector(".board-layout");
  layoutElement.style.setProperty("--board-size", size);
  layoutElement.classList.toggle("large-board", size > 8);
  document.querySelector(".case").classList.toggle("case-wide", size > 8);
  document.querySelector(".board").setAttribute("aria-label", "Tablero de " + size + " filas y " + size + " columnas");
  for (const axis of document.querySelectorAll(".column-labels, .row-labels")) {
    for (let number = 1; number <= size; number++) {
      const label = document.createElement("span");
      label.textContent = number;
      axis.append(label);
    }
  }
  const roomLegend = document.querySelector("#room-legend");
  const roomLabels = document.querySelector("#room-labels");
  for (const room of level.rooms) {
    const label = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = "room-swatch";
    swatch.style.backgroundColor = room.color;
    swatch.setAttribute("aria-hidden", "true");
    label.append(swatch, room.name);
    roomLegend.append(label);

    const row = level.room_map.findLastIndex(line => line.includes(room.id));
    const runs = [...level.room_map[row].matchAll(new RegExp(room.id + "+", "g"))];
    const bottom = runs.reduce((widest, run) => run[0].length > widest[0].length ? run : widest);
    const boardLabel = document.createElement("span");
    boardLabel.className = "room-label";
    boardLabel.textContent = room.name;
    boardLabel.style.gridRow = row + 1;
    boardLabel.style.gridColumn = `${bottom.index + 1} / span ${bottom[0].length}`;
    boardLabel.style.setProperty("--label-color", room.color);
    roomLabels.append(boardLabel);
  }

  const peopleByInitial = new Map(participants.map(person => [person.initial, person]));
  const board = document.querySelector("#cells");
  const boardViewport = document.querySelector(".board-viewport");
  const scrollHint = document.querySelector("#board-scroll-hint");
  const helpButton = document.querySelector("#board-help");
  const helpDialog = document.querySelector("#help-dialog");
  const roster = document.querySelector("#people");
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
  const feedback = document.querySelector("#feedback");
  const count = document.querySelector("#count");
  const history = [];
  const personButtons = new Map();
  const cellButtons = [];
  const firstPerson = participants.find(person => person.clues).initial;
  const draftNotice = document.querySelector("#draft-notice");
  let state;
  let selected = firstPerson;
  let mode = "person";
  let gesture;
  let focusIndex = 0;
  let draftProfile = gameProgress.username;

  function draftKey() {
    const profile = draftProfile ? "account:" + draftProfile : "guest";
    return "archivo-nocturno:draft:" + profile + ":" + level.id;
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        size,
        selected,
        mode,
        positions: [...state.positions],
        notes: [...state.notes].map(([index, initials]) => [index, [...initials]]),
        crosses: [...state.crosses],
        hiddenCrosses: [...state.hiddenCrosses],
      }));
      draftNotice.hidden = true;
    } catch {
      draftNotice.hidden = false;
    }
  }

  function restoreDraft() {
    state = { positions: new Map(), notes: new Map(), crosses: new Set(), hiddenCrosses: new Set() };
    selected = firstPerson;
    mode = "person";
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(draftKey()));
    } catch {
      return false;
    }
    if (saved?.size !== size) return false;

    const entries = value => Array.isArray(value) ? value : [];
    const validCell = index => Number.isInteger(index) && index >= 0 && index < size ** 2
      && sceneryAt(index)?.role !== "obstacle";
    for (const pair of entries(saved.positions)) {
      if (!Array.isArray(pair)) continue;
      const [initial, index] = pair;
      if (peopleByInitial.has(initial) && validCell(index) && !isLocked(index)) {
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
    if (peopleByInitial.has(saved.selected)) selected = saved.selected;
    if (["person", "cross", "erase"].includes(saved.mode)) mode = saved.mode;
    return Boolean(state.positions.size || state.notes.size || state.crosses.size);
  }

  function rowOf(index) {
    return Math.floor(index / size);
  }

  function columnOf(index) {
    return index % size;
  }

  function roomOf(index) {
    return rooms.get(level.room_map[rowOf(index)][columnOf(index)]);
  }

  function sceneryAt(index) {
    return sceneryTiles.get(index)?.asset;
  }

  function occupantAt(index) {
    for (const [initial, position] of state.positions) {
      if (position === index) return initial;
    }
  }

  function isLocked(index, except) {
    for (const [initial, position] of state.positions) {
      if (initial === except) continue;
      if (rowOf(index) === rowOf(position) || columnOf(index) === columnOf(position)) return true;
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

  function clueText(clue) {
    switch (clue.kind) {
      case "row": return `Estaba en la fila ${clue.number}.`;
      case "column": return `Estaba en la columna ${clue.number}.`;
      case "on": return `Estaba sobre ${objects[clue.object].label}.`;
      case "next_to": return `Estaba al lado de ${objects[clue.object].label}.`;
      case "room": return `Estaba en la sala «${rooms.get(clue.room).name}».`;
      default: return `Estaba al ${directions[clue.kind]} de ${peopleByInitial.get(clue.person).name}.`;
    }
  }

  function ruleText(rule) {
    if (rule.count === 0) return "Nadie estaba sentado.";
    if (rule.count === 1) return "Solo una persona estaba sentada.";
    return `Había exactamente ${rule.count} personas sentadas.`;
  }

  const ruleList = document.querySelector("#general-rules-list");
  for (const rule of level.rules) {
    const item = document.createElement("li");
    item.textContent = ruleText(rule);
    ruleList.append(item);
  }
  document.querySelector("#general-rules").hidden = level.rules.length === 0;

  async function checkCase() {
    if (state.positions.size !== participants.length || resultDialog.open) return;

    resultTitle.textContent = "Comprobando…";
    resultMessage.textContent = "";
    resultDetails.open = false;
    resultDetails.hidden = true;
    resultList.replaceChildren();
    resultClose.disabled = true;
    resultDialog.showModal();

    try {
      const response = await fetch("/api/levels/" + encodeURIComponent(level.id) + "/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Game-Request": "1" },
        body: JSON.stringify({ positions: Object.fromEntries(state.positions) }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("No se pudo comprobar el caso.");
      const { misplaced, culprit } = await response.json();
      if (misplaced.length) {
        resultTitle.textContent = "Hay errores";
        resultMessage.textContent = misplaced.length === 1
          ? "Hay una persona mal ubicada."
          : "Hay " + misplaced.length + " personas mal ubicadas.";
        for (const initial of misplaced) {
          const item = document.createElement("li");
          item.textContent = peopleByInitial.get(initial).name;
          resultList.append(item);
        }
        resultDetails.hidden = false;
        return;
      }

      resultTitle.textContent = "Caso resuelto";
      const victim = participants.find(person => !person.clues);
      const message = peopleByInitial.get(culprit).name + " estaba a solas con " + victim.name + ".";
      resultMessage.textContent = message;
      announce("Caso resuelto. " + message, "solved");
      const notice = document.querySelector("#progress-notice");
      gameProgress.complete(level.id).then(
        () => { notice.hidden = true; },
        () => { notice.hidden = false; },
      );
    } catch {
      resultTitle.textContent = "No se pudo comprobar";
      resultMessage.textContent = "Cierra esta ventana e inténtalo otra vez.";
    } finally {
      resultClose.disabled = false;
      resultClose.focus();
    }
  }

  function saveChange(update, message) {
    history.push({
      positions: new Map(state.positions),
      notes: new Map(state.notes),
      crosses: new Set(state.crosses),
      hiddenCrosses: new Set(state.hiddenCrosses),
    });
    update();
    saveDraft();
    render();
    announce(message);
  }

  function removePlacement(initial) {
    saveChange(() => {
      state.positions.delete(initial);
      refreshHiddenCrosses();
    }, `Ficha de ${peopleByInitial.get(initial).name} retirada.`);
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
    const cross = crossAt(index);
    saveChange(() => {
      if (cross) removeCross(index);
      else if (isLocked(index)) state.hiddenCrosses.delete(index);
      else state.crosses.add(index);
    }, cross ? "X retirada." : "X marcada.");
  }

  function clearAnnotations() {
    if (!state.notes.size && !state.crosses.size) {
      announce("No hay anotaciones que borrar.");
      return;
    }
    saveChange(() => {
      state.notes.clear();
      state.crosses.clear();
    }, "Todas las anotaciones manuales se borraron.");
  }

  function act(index, held) {
    if (sceneryAt(index)?.role === "obstacle") {
      announce("Esta casilla está bloqueada por un objeto del plano.");
      return;
    }
    const occupant = occupantAt(index);
    if (mode === "erase") {
      if (occupant) {
        removePlacement(occupant);
      } else if (state.notes.has(index) || crossAt(index)) {
        saveChange(() => {
          state.notes.delete(index);
          removeCross(index);
        }, "Casilla borrada.");
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
      if (!person.clues && state.positions.size - Number(state.positions.has(selected)) !== participants.length - 1) {
        announce("Ubica a los demás participantes antes de colocar a la víctima.");
        return;
      }
      if (isLocked(index, selected)) {
        announce("Otra persona ya ocupa esta fila o columna.");
        return;
      }
      saveChange(() => {
        state.positions.set(selected, index);
        state.crosses.delete(index);
        refreshHiddenCrosses();
      }, `${person.name} se ubicó en la fila ${rowOf(index) + 1}, columna ${columnOf(index) + 1}.`);
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
    const notes = new Set(state.notes.get(index));
    const marked = notes.has(selected);
    if (marked) notes.delete(selected);
    else notes.add(selected);
    saveChange(() => {
      if (notes.size) state.notes.set(index, notes);
      else state.notes.delete(index);
    }, marked ? `Inicial ${selected} retirada.` : `Inicial ${selected} anotada.`);
  }

  function selectMode(nextMode, initial = selected) {
    cancelGesture();
    mode = nextMode;
    selected = initial;
    saveDraft();
    render();
    if (mode === "person") announce(`${peopleByInitial.get(initial).name} es la ficha activa.`);
    if (mode === "cross") announce("Marca X activa. Elige una casilla.");
    if (mode === "erase") announce("Borrar activo. Elige una casilla.");
  }

  function renderControls() {
    crossButton.setAttribute("aria-pressed", String(mode === "cross"));
    eraseButton.setAttribute("aria-pressed", String(mode === "erase"));
    undoButton.disabled = history.length === 0;
    checkButton.disabled = state.positions.size !== participants.length;
    count.textContent = `${state.positions.size} / ${participants.length}`;
    for (const [initial, { button, indicator }] of personButtons) {
      const placed = state.positions.has(initial);
      button.setAttribute("aria-pressed", String(mode === "person" && selected === initial));
      button.classList.toggle("is-placed", placed);
      indicator.hidden = !placed;
    }
  }

  function renderCell(cell, index) {
    const occupant = occupantAt(index);
    const scenery = sceneryAt(index);
    const blocked = scenery?.role === "obstacle";
    const locked = !occupant && !blocked && isLocked(index);
    const placementLocked = mode === "person" && locked && isLocked(index, selected);
    const unavailable = blocked || placementLocked || (Boolean(occupant) && mode !== "erase");
    const cross = !occupant && !blocked && crossAt(index, locked);
    const notes = occupant || blocked || cross ? [] : [...(state.notes.get(index) ?? [])]
      .filter(initial => !state.positions.has(initial))
      .sort();
    const activeNote = mode === "person" && notes.includes(selected);
    const tokens = cell.querySelector(".tokens");
    const parts = [
      `Fila ${rowOf(index) + 1}, columna ${columnOf(index) + 1}`,
      roomOf(index).name,
    ];
    if (scenery) parts.push(scenery.name);
    if (blocked) parts.push("Obstáculo fijo");

    tokens.replaceChildren();
    if (occupant) {
      const person = peopleByInitial.get(occupant);
      addToken(tokens, "token", person);
      parts.push(`${person.name} en esta casilla`);
    } else if (cross) {
      const mark = document.createElement("span");
      mark.className = "cell-mark";
      mark.textContent = "×";
      tokens.append(mark);
      parts.push(`X ${cross}`);
    } else if (notes.length) {
      for (const initial of notes) {
        const className = activeNote && initial === selected ? "note note-active" : "note";
        addToken(tokens, className, peopleByInitial.get(initial));
      }
      parts.push(`Anotaciones ${notes.join(", ")}`);
    }

    cell.classList.toggle("is-occupied", Boolean(occupant));
    cell.classList.toggle("is-obstacle", blocked);
    cell.classList.toggle("is-unavailable", unavailable);
    if (blocked) cell.setAttribute("aria-disabled", "true");
    cell.classList.toggle("has-cross", Boolean(cross));
    cell.classList.toggle("has-active-note", activeNote);
    cell.setAttribute("aria-label", parts.join(". "));
  }

  function addToken(container, className, person) {
    const token = document.createElement("span");
    token.className = className;
    token.textContent = person.initial;
    token.style.setProperty("--person-color", person.color);
    container.append(token);
  }

  function render() {
    renderControls();
    cellButtons.forEach(renderCell);
  }

  function cancelGesture() {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    gesture.control.classList.remove("is-holding");
    gesture = undefined;
  }

  function focusCell(index) {
    cellButtons[focusIndex].tabIndex = -1;
    focusIndex = index;
    const cell = cellButtons[index];
    cell.tabIndex = 0;
    cell.focus({ preventScroll: true });
    const viewport = boardViewport.getBoundingClientRect();
    const bounds = cell.getBoundingClientRect();
    const scroll = Math.min(0, bounds.left - viewport.left) + Math.max(0, bounds.right - viewport.right);
    if (scroll) boardViewport.scrollLeft += scroll;
  }

  function bindPress(control, action, focus, canHold = true) {
    control.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      cancelGesture();
      focus?.();
      control.setPointerCapture(event.pointerId);
      if (canHold) control.classList.add("is-holding");
      const press = { control, id: event.pointerId, startedAt: event.timeStamp, completed: false };
      gesture = press;
      if (!canHold) return;
      press.timer = setTimeout(() => {
        if (gesture !== press) return;
        press.completed = true;
        control.classList.remove("is-holding");
        action(true);
      }, holdTime);
    });

    control.addEventListener("pointermove", event => {
      if (gesture?.control !== control || gesture.id !== event.pointerId) return;
      if (!gesture.completed && !isInside(control, event)) cancelGesture();
    });

    control.addEventListener("pointerup", event => {
      if (gesture?.control !== control || gesture.id !== event.pointerId) return;
      const { completed, startedAt } = gesture;
      cancelGesture();
      if (!completed && isInside(control, event)) {
        action(event.timeStamp - startedAt >= holdTime);
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

  function bindCell(cell, index) {
    bindPress(cell, held => act(index, held), () => focusCell(index), sceneryAt(index)?.role !== "obstacle");
    cell.addEventListener("contextmenu", event => {
      event.preventDefault();
      if (event.button !== 2 || event.pointerType === "touch") return;
      cancelGesture();
      const occupant = occupantAt(index);
      if (occupant) removePlacement(occupant);
      else toggleCross(index);
    });
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "person";
    button.style.setProperty("--person-color", person.color);
    button.innerHTML = `
      <span class="portrait" aria-hidden="true"></span>
      <span>
        <span class="person-name"><span class="person-name-text"></span></span>
        <span class="placed-indicator" hidden>✓ Ubicado</span>
        <span class="clues"></span>
      </span>`;
    button.querySelector(".portrait").textContent = person.initial;
    button.querySelector(".person-name-text").textContent = person.name;
    const clues = button.querySelector(".clues");
    for (const text of person.clues?.map(clueText) ?? ["Víctima"]) {
      const clue = document.createElement("span");
      clue.className = "clue";
      clue.textContent = text;
      clues.append(clue);
    }
    personButtons.set(person.initial, { button, indicator: button.querySelector(".placed-indicator") });
    button.addEventListener("click", () => selectMode("person", person.initial));
    roster.append(button);
  }

  document.documentElement.style.setProperty("--hold-time", `${holdTime}ms`);
  for (let index = 0; index < size ** 2; index++) {
    const cell = document.createElement("button");
    cell.type = "button";
    const room = roomOf(index);
    cell.className = "cell";
    cell.style.setProperty("--room-color", room.color);
    cell.dataset.floor = room.floor;
    cell.dataset.room = room.id;
    cell.classList.toggle("room-edge-right", columnOf(index) < size - 1 && room !== roomOf(index + 1));
    cell.classList.toggle("room-edge-bottom", rowOf(index) < size - 1 && room !== roomOf(index + size));
    cell.tabIndex = index === 0 ? 0 : -1;
    const tile = sceneryTiles.get(index);
    cell.title = tile ? `${room.name} · ${tile.asset.name}` : room.name;
    if (tile) {
      const art = sceneryTile(tile);
      art.classList.add("cell-object");
      cell.append(art);
    }
    const tokens = document.createElement("span");
    tokens.className = "tokens";
    tokens.setAttribute("aria-hidden", "true");
    cell.append(tokens);
    cellButtons.push(cell);
    board.append(cell);
    bindCell(cell, index);
  }

  let highlightedRoom;
  function highlightRoom(id) {
    if (id === highlightedRoom) return;
    highlightedRoom = id;
    for (const cell of cellButtons) {
      cell.classList.toggle("room-highlight", cell.dataset.room === id);
    }
  }
  board.addEventListener("pointerover", event => {
    if (event.pointerType === "mouse") highlightRoom(event.target.closest(".cell")?.dataset.room);
  });
  board.addEventListener("pointerleave", () => highlightRoom());

  window.addEventListener("blur", cancelGesture);
  const boardResize = new ResizeObserver(() => {
    scrollHint.hidden = boardViewport.scrollWidth <= boardViewport.clientWidth;
  });
  boardResize.observe(boardViewport);
  helpButton.addEventListener("click", () => helpDialog.showModal());
  crossButton.addEventListener("click", () => selectMode(mode === "cross" ? "person" : "cross"));
  bindPress(eraseButton, held => {
    if (held) clearAnnotations();
    else selectMode(mode === "erase" ? "person" : "erase");
  });
  eraseButton.addEventListener("contextmenu", event => event.preventDefault());
  eraseButton.addEventListener("keydown", event => {
    if (!event.shiftKey || event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) clearAnnotations();
  });
  checkButton.addEventListener("click", checkCase);
  resultDialog.addEventListener("cancel", event => {
    if (resultClose.disabled) event.preventDefault();
  });
  resultDialog.addEventListener("close", () => checkButton.focus());
  undoButton.addEventListener("click", () => {
    cancelGesture();
    if (!history.length) return;
    state = history.pop();
    saveDraft();
    const undoDisabled = history.length === 0 && document.activeElement === undoButton;
    render();
    if (undoDisabled) {
      const activeTool = mode === "cross" ? crossButton : eraseButton;
      const activeControl = mode === "person" ? personButtons.get(selected).button : activeTool;
      activeControl.focus();
    }
    announce("Último cambio deshecho.");
  });

  const resumed = restoreDraft();
  render();
  if (resumed) announce("Partida recuperada.");
  document.addEventListener("gameprogress", () => {
    if (draftProfile === gameProgress.username) return;
    cancelGesture();
    draftProfile = gameProgress.username;
    draftNotice.hidden = true;
    history.length = 0;
    const recovered = restoreDraft();
    render();
    announce(recovered ? "Partida recuperada." : "");
  });
}

loadGame();
