import { makeScenery, sceneryTile } from "../shared/scenery.js";
import { objects } from "./presentation.js";

export function mountBoard(level) {
  const { size } = level;
  const rooms = new Map(level.rooms.map(room => [room.id, room]));
  const layout = level.tiles.flatMap((row, y) => Array.from(row).flatMap((symbol, x) => {
    const room = rooms.get(level.room_map[y][x]);
    const id = symbol === "#" ? room.obstacle_asset : symbol === "A" ? room.rug_asset : objects[symbol]?.id;
    return id ? [[id, x, y]] : [];
  }));
  const sceneryTiles = makeScenery(layout, size, size);

  const board = document.querySelector("#cells");
  const boardViewport = document.querySelector(".board-viewport");
  const scrollHint = document.querySelector("#board-scroll-hint");

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

  const boardResize = new ResizeObserver(() => {
    scrollHint.hidden = boardViewport.scrollWidth <= boardViewport.clientWidth;
  });
  boardResize.observe(boardViewport);

  return { rooms, boardViewport, cellButtons, rowOf, columnOf, roomOf, sceneryAt };
}
