import { applyFloor, makeScenery, modularOutline, sceneryTile } from "../shared/scenery.js";
import { columnLabel, objects } from "./presentation.js";

const water = { name: "Agua", role: "obstacle" };
const svgNamespace = "http://www.w3.org/2000/svg";

function appendBoundaryEdges(edges, map, tile, x, y) {
  if (map[y - 1]?.[x] !== tile) edges.push(`M${x} ${y}h1`);
  if (map[y + 1]?.[x] !== tile) edges.push(`M${x} ${y + 1}h1`);
  if (map[y][x - 1] !== tile) edges.push(`M${x} ${y}v1`);
  if (map[y][x + 1] !== tile) edges.push(`M${x + 1} ${y}v1`);
}

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
  const architecture = new Map((level.architecture ?? []).map(({ row, column, side, kind }) =>
    [`${(row - 1) * size + column - 1}:${side}`, kind]
  ));
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
  const sceneryPlacements = [...sceneryTiles].filter(([, tile]) => tile.first);

  const board = document.querySelector("#cells");
  const boardViewport = document.querySelector(".board-viewport");
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
  document.querySelector(".board").setAttribute("aria-label", "Tablero de " + size + " filas y " + size + " columnas");
  for (const axis of document.querySelectorAll(".column-labels, .row-labels")) {
    const column = axis.classList.contains("column-labels");
    for (let number = 1; number <= size; number++) {
      const label = document.createElement("span");
      label.textContent = column ? columnLabel(number - 1) : number;
      axis.append(label);
    }
  }
  const roomLabels = document.querySelector("#room-labels");
  for (const room of level.rooms) {
    const roomRun = new RegExp(room.id + "+", "g");
    const row = level.room_map.findLastIndex(line => line.includes(room.id));
    const runs = [...level.room_map[row].matchAll(roomRun)];
    const bottom = runs.reduce((widest, run) => run[0].length > widest[0].length ? run : widest);
    const boardLabel = document.createElement("span");
    boardLabel.className = "room-label";
    boardLabel.textContent = room.name;
    boardLabel.style.setProperty("--label-row", row + 1);
    boardLabel.style.setProperty("--label-column", `${bottom.index + 1} / span ${bottom[0].length}`);
    boardLabel.style.setProperty("--label-color", room.color);
    if (room.room_type) {
      boardLabel.dataset.roomType = room.room_type;
      // A wider stretch gives type names room to wrap on a compact board.
      let widest = bottom;
      let widestRow = row;
      for (const [index, line] of level.room_map.entries()) {
        for (const run of line.matchAll(roomRun)) {
          if (run[0].length > widest[0].length || (run[0].length === widest[0].length && index > widestRow)) {
            widest = run;
            widestRow = index;
          }
        }
      }
      boardLabel.style.setProperty("--label-compact-row", widestRow + 1);
      boardLabel.style.setProperty("--label-compact-column", `${widest.index + 1} / span ${widest[0].length}`);
    }
    roomLabels.append(boardLabel);
  }

  const boundaries = document.createElement("div");
  boundaries.className = "board-boundaries";
  boundaries.setAttribute("aria-hidden", "true");
  const horizontalEnds = new Set();
  const verticalEnds = new Set();
  const roomEdges = new Map(level.rooms.map(room => [room.id, []]));
  const waterEdges = [];

  function placeBoundary(className, row, column) {
    const boundary = document.createElement("span");
    boundary.className = className;
    boundary.style.gridArea = `${row} / ${column}`;
    boundaries.append(boundary);
    return boundary;
  }

  for (let index = 0; index < size ** 2; index++) {
    const cell = document.createElement("button");
    cell.type = "button";
    const room = roomOf(index);
    cell.className = "cell";
    applyFloor(cell, room.floor, room.color);
    cell.dataset.room = room.id;
    const y = rowOf(index);
    const x = columnOf(index);
    const row = y + 1;
    const column = x + 1;
    appendBoundaryEdges(roomEdges.get(room.id), level.room_map, room.id, x, y);
    if (column < size && room !== roomOf(index + 1)) {
      const edge = placeBoundary("board-edge board-edge-east", row, column);
      edge.dataset.kind = architecture.get(`${index}:east`) ?? "wall";
      verticalEnds.add(`${row - 1}/${column}`);
      verticalEnds.add(`${row}/${column}`);
    }
    if (row < size && room !== roomOf(index + size)) {
      const edge = placeBoundary("board-edge board-edge-south", row, column);
      edge.dataset.kind = architecture.get(`${index}:south`) ?? "wall";
      horizontalEnds.add(`${row}/${column - 1}`);
      horizontalEnds.add(`${row}/${column}`);
    }
    cell.tabIndex = index === 0 ? 0 : -1;
    const tile = sceneryTiles.get(index);
    const terrain = sceneryAt(index);
    cell.title = terrain ? `${room.name} · ${terrain.name}` : room.name;
    if (level.tiles[y][x] === "~") {
      appendBoundaryEdges(waterEdges, level.tiles, "~", x, y);
      const surface = document.createElement("span");
      surface.className = "water-surface";
      applyFloor(surface, "agua");
      if (level.tiles[y][x + 1] === "~") cell.classList.add("water-joins-east");
      if (level.tiles[y + 1]?.[x] === "~") cell.classList.add("water-joins-south");
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
  for (const vertex of horizontalEnds) {
    if (!verticalEnds.has(vertex)) continue;
    const [row, column] = vertex.split("/");
    placeBoundary("board-edge-junction", row, column);
  }
  board.after(boundaries);

  const clueOutlines = document.createElementNS(svgNamespace, "svg");
  clueOutlines.classList.add("board-clue-outlines");
  clueOutlines.setAttribute("aria-hidden", "true");
  clueOutlines.setAttribute("viewBox", `0 0 ${size} ${size}`);
  clueOutlines.setAttribute("preserveAspectRatio", "none");
  boundaries.after(clueOutlines);

  function addClueOutline(color, shape, attributes) {
    const outline = document.createElementNS(svgNamespace, shape);
    outline.style.setProperty("--clue-color", color);
    for (const [name, value] of Object.entries(attributes)) outline.setAttribute(name, value);
    clueOutlines.append(outline);
    return outline;
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

  function highlightObject(clue, color, outlinedPlacements) {
    if (clue.object === "~") {
      if (waterEdges.length) addClueOutline(color, "path", { d: waterEdges.join(" ") });
      return;
    }
    for (const [index, tile] of sceneryPlacements) {
      const row = rowOf(index);
      const column = columnOf(index);
      const matches = clue.asset ? tile.sourceId === clue.asset : level.tiles[row][column] === clue.object;
      if (!matches) continue;
      const inset = outlinedPlacements.has(index) ? 0.23 : 0.14;
      outlinedPlacements.add(index);
      const outline = addClueOutline(color, "path", {
        d: modularOutline(tile.shape, inset, 1),
        transform: `translate(${column - tile.x} ${row - tile.y})`,
      });
      outline.classList.add("clue-object-outline");
    }
  }

  function highlightClues(clues) {
    if (clues === activeClues) return;
    activeClues = clues;
    for (const label of [...rowLabels, ...columnLabels]) {
      label.classList.remove("clue-axis");
      label.style.removeProperty("--clue-color");
    }
    clueOutlines.replaceChildren();
    const outlinedPlacements = new Set();
    // Inset the axis outlines so room edges remain visible where they coincide.
    const inset = 0.08;
    const band = 1 - 2 * inset;
    const span = size - 2 * inset;
    for (const { clue, color } of clues?.values() ?? []) {
      switch (clue.kind) {
        case "row":
        case "column": {
          const row = clue.kind === "row";
          const index = clue.number - 1;
          const label = (row ? rowLabels : columnLabels)[index];
          label.style.setProperty("--clue-color", color);
          label.classList.add("clue-axis");
          const attributes = row
            ? { x: inset, y: index + inset, width: span, height: band }
            : { x: index + inset, y: inset, width: band, height: span };
          addClueOutline(color, "rect", { ...attributes, rx: 0.12 });
          break;
        }
        case "room":
        case "room_type":
          for (const room of level.rooms) {
            const matches = clue.kind === "room" ? room.id === clue.room : room.room_type === clue.room_type;
            if (matches) addClueOutline(color, "path", { d: roomEdges.get(room.id).join(" ") });
          }
          break;
        case "on":
        case "next_to":
          highlightObject(clue, color, outlinedPlacements);
          break;
      }
    }
  }

  return { rooms, boardViewport, cellButtons, rowOf, columnOf, roomOf, sceneryAt, highlightClues };
}
