import { makeScenery, sceneryTile } from "../shared/scenery.js";
import { columnLabel, objects } from "./presentation.js";

const water = { name: "Agua", role: "obstacle" };

export function cellsBetween(start, end, size) {
  let x = start % size;
  let y = Math.floor(start / size);
  const endX = end % size;
  const endY = Math.floor(end / size);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const stepX = Math.sign(endX - x);
  const stepY = Math.sign(endY - y);
  let error = dx + dy;
  const cells = [];
  while (true) {
    cells.push(y * size + x);
    if (x === endX && y === endY) return cells;
    const step = 2 * error;
    if (step >= dy) {
      error += dy;
      x += stepX;
    }
    if (step <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

export function mountBoard(level) {
  const { size } = level;
  const rooms = new Map(level.rooms.map(room => [room.id, room]));
  const placements = (level.scenery ?? []).map(({ asset, column, row, shape }) => [asset, column - 1, row - 1, shape]);
  const sceneryTiles = makeScenery(placements, size, size);
  const layout = level.tiles.flatMap((row, y) => Array.from(row).flatMap((symbol, x) => {
    if (sceneryTiles.has(y * size + x)) return [];
    const room = rooms.get(level.room_map[y][x]);
    const id = symbol === "#" ? room.obstacle_asset : symbol === "A" ? room.rug_asset : objects[symbol]?.id;
    return id ? [[id, x, y]] : [];
  }));
  for (const [index, tile] of makeScenery(layout, size, size)) sceneryTiles.set(index, tile);

  const board = document.querySelector("#cells");
  const boardViewport = document.querySelector(".board-viewport");
  const scrollHint = document.querySelector("#board-scroll-hint");
  const cellButtons = [];

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
    const asset = sceneryTiles.get(index)?.asset;
    if (asset) return asset;
    if (level.tiles[rowOf(index)][columnOf(index)] === "~") return water;
  }

  const layoutElement = document.querySelector(".board-layout");
  layoutElement.style.setProperty("--board-size", size);
  layoutElement.classList.toggle("large-board", size > 8);
  document.querySelector(".case").classList.toggle("case-wide", size > 8);
  document.querySelector(".board").setAttribute("aria-label", "Tablero de " + size + " filas y " + size + " columnas");
  for (const axis of document.querySelectorAll(".column-labels, .row-labels")) {
    for (let number = 1; number <= size; number++) {
      const label = document.createElement("span");
      label.textContent = axis.classList.contains("column-labels") ? columnLabel(number - 1) : number;
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
    const terrain = sceneryAt(index);
    cell.title = terrain ? `${room.name} · ${terrain.name}` : room.name;
    if (level.tiles[rowOf(index)][columnOf(index)] === "~") {
      const surface = document.createElement("span");
      surface.className = tile ? "water-surface" : "cell-object water-surface";
      surface.setAttribute("aria-hidden", "true");
      cell.append(surface);
    }
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

  const rowLabels = document.querySelector(".row-labels").children;
  const columnLabels = document.querySelector(".column-labels").children;
  let activeClues = null;

  function highlightClues(clues) {
    if (clues === activeClues) return;
    activeClues = clues;
    const rows = new Set();
    const columns = new Set();
    const zones = new Set();
    const zoneTypes = new Set();
    const objects = new Set();
    const obstacles = new Set();
    for (const clue of clues ?? []) {
      switch (clue.kind) {
        case "row": rows.add(clue.number - 1); break;
        case "column": columns.add(clue.number - 1); break;
        case "room": zones.add(clue.room); break;
        case "room_type": zoneTypes.add(clue.room_type); break;
        case "on":
        case "next_to":
          if (clue.asset) obstacles.add(clue.asset);
          else objects.add(clue.object);
          break;
      }
    }
    for (let index = 0; index < size; index++) {
      rowLabels[index].classList.toggle("clue-axis", rows.has(index));
      columnLabels[index].classList.toggle("clue-axis", columns.has(index));
    }
    cellButtons.forEach((cell, index) => {
      const y = rowOf(index);
      const x = columnOf(index);
      const room = roomOf(index);
      const tile = level.tiles[y][x];
      cell.classList.toggle("clue-area", rows.has(y) || columns.has(x) || zones.has(room.id) || zoneTypes.has(room.room_type));
      cell.classList.toggle("clue-object", objects.has(tile) || obstacles.has(sceneryAt(index)?.id));
    });
  }

  const boardResize = new ResizeObserver(() => {
    scrollHint.hidden = boardViewport.scrollWidth <= boardViewport.clientWidth;
  });
  boardResize.observe(boardViewport);

  return { rooms, boardViewport, cellButtons, rowOf, columnOf, roomOf, sceneryAt, highlightClues };
}
