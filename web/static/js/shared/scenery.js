import { assetFamily, assetsById, floorTextures, floorTextureUrl, resourceUrl } from "./assets.js";

const svgNamespace = "http://www.w3.org/2000/svg";
const modularArtwork = new Map();
const floors = new Map(floorTextures.map(({ id, color }) => [id, {
  color,
  pattern: `url("${floorTextureUrl(id)}")`,
}]));

function applyFloor(element, id, roomColor) {
  const { color, pattern } = floors.get(id);
  element.classList.add("scenery-floor");
  element.dataset.floor = id;
  element.style.setProperty("--floor-base", roomColor ?? color);
  element.style.setProperty("--floor-pattern", pattern);
}

function usesCustomArtwork(asset, shape) {
  return asset?.modular && assetFamily(asset) !== "alfombra" && shape
    && (shape.length !== asset.shape.length || shape.some((row, y) => row !== asset.shape[y]));
}

async function loadModularArtwork(placements) {
  const ids = new Set(placements.filter(({ asset, shape }) =>
    usesCustomArtwork(assetsById.get(asset), shape)).map(({ asset }) => asset));
  await Promise.all([...ids].map(async id => {
    const url = resourceUrl(`${id}.svg`);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`No se pudo cargar el recurso ${id}.`);
    // The base SVG provides the layers and details for alternate footprints.
    const svg = new DOMParser().parseFromString(await response.text(), "image/svg+xml").documentElement;
    const inset = Number(svg.getAttribute("data-modular-inset"));
    const layers = [...svg.querySelectorAll("[data-modular-layer]")];
    if (!inset || !layers.length) throw new Error(`Falta el diseño modular de ${id}.`);
    const detail = svg.querySelector("#modular-cell, #modular-start");
    modularArtwork.set(id, { inset, layers, detail });
  }));
}

function modularOutline(shape, inset, unit = 32) {
  const edges = new Map();
  const occupied = (x, y) => shape[y]?.[x] === "#";
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  for (const [y, row] of shape.entries()) {
    for (const [x, tile] of [...row].entries()) {
      if (tile !== "#") continue;
      const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
      for (const [direction, [dx, dy]] of directions.entries()) {
        if (occupied(x + dy, y - dx)) continue;
        const start = corners[direction];
        const end = corners[(direction + 1) % 4];
        const key = start.join(",");
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push({ start, end, direction });
      }
    }
  }

  const paths = [];
  while (edges.size) {
    const first = edges.values().next().value[0];
    const loop = [];
    let edge = first;
    do {
      loop.push(edge);
      const key = edge.start.join(",");
      const choices = edges.get(key);
      choices.splice(choices.indexOf(edge), 1);
      if (!choices.length) edges.delete(key);
      if (edge.end.join(",") === first.start.join(",")) break;
      const next = edges.get(edge.end.join(","));
      edge = [1, 0, 3, 2].map(turn => next.find(candidate => candidate.direction === (edge.direction + turn) % 4)).find(Boolean);
    } while (edge);

    const corners = loop.map(({ start: [x, y], direction }, index) => {
      const [inX, inY] = directions[loop.at(index - 1).direction];
      const [outX, outY] = directions[direction];
      if (inX === outX && inY === outY) return null;
      const radius = unit / 16;
      const cornerX = x * unit - (inY + outY) * inset;
      const cornerY = y * unit + (inX + outX) * inset;
      return {
        before: [cornerX - inX * radius, cornerY - inY * radius],
        corner: [cornerX, cornerY],
        after: [cornerX + outX * radius, cornerY + outY * radius],
      };
    }).filter(Boolean);
    paths.push(`M${corners[0].before} ${corners.map(({ before, corner, after }) => `L${before}Q${corner} ${after}`).join(" ")}Z`);
  }
  return paths.join(" ");
}

function makeScenery(layout, columns, rows) {
  const tiles = new Map();
  for (const [id, column, row, customShape] of layout) {
    // A running server can still send the retired rug from its cached catalog.
    const asset = assetsById.get(id === "alfombra-ondas" ? "alfombra" : id);
    if (!asset || (customShape && !asset.modular)) {
      throw new Error(`Recurso inválido para el plano: ${id}`);
    }
    const [assetWidth, assetHeight] = asset.size ?? [1, 1];
    const shape = customShape ?? asset.shape ?? Array(assetHeight).fill("#".repeat(assetWidth));
    const width = Math.max(...shape.map(line => line.length));
    const height = shape.length;
    const customArtwork = usesCustomArtwork(asset, customShape);
    const artwork = customArtwork ? modularArtwork.get(asset.id) : null;
    if (customArtwork && !artwork) throw new Error(`Falta el diseño modular de ${id}.`);
    const outline = artwork ? modularOutline(shape, artwork.inset) : null;
    const firstRow = shape.findIndex(line => line.includes("#"));
    const firstColumn = shape[firstRow].indexOf("#");

    for (const [y, line] of shape.entries()) {
      for (let x = 0; x < line.length; x++) {
        if (line[x] !== "#") continue;
        const tileColumn = column + x;
        const tileRow = row + y;
        const index = tileRow * columns + tileColumn;
        if (tileColumn < 0 || tileColumn >= columns || tileRow < 0 || tileRow >= rows || tiles.has(index)) {
          throw new Error(`El recurso ${id} se superpone o sale del plano.`);
        }
        const first = y === firstRow && x === firstColumn;
        tiles.set(index, { asset, sourceId: id, width, height, x, y, artwork, outline, shape, first });
      }
    }
  }
  return tiles;
}

function sceneryTile(tile) {
  const { asset, width, height, x, y, artwork, outline, shape, first } = tile;
  const frame = document.createElement("span");
  frame.className = "scenery-tile";
  frame.setAttribute("aria-hidden", "true");

  if (assetFamily(asset) === "alfombra") {
    const surface = document.createElement("span");
    surface.className = "modular-surface modular-alfombra";
    frame.classList.add("scenery-rug");
    surface.dataset.pattern = asset.id;
    surface.style.backgroundImage = `url("${resourceUrl(`${asset.id}.svg`)}")`;
    const neighbors = { top: [x, y - 1], right: [x + 1, y], bottom: [x, y + 1], left: [x - 1, y] };
    for (const [side, [column, row]] of Object.entries(neighbors)) {
      if (shape[row]?.[column] === "#") surface.classList.add(`joins-${side}`);
    }
    frame.append(surface);
  } else if (artwork) {
    const surface = document.createElementNS(svgNamespace, "svg");
    surface.setAttribute("viewBox", `${x * 32} ${y * 32} 32 32`);
    for (const layer of artwork.layers) {
      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("d", outline);
      path.setAttribute("fill-rule", "evenodd");
      for (const attribute of ["fill", "stroke", "stroke-width", "stroke-linejoin", "opacity"]) {
        if (layer.hasAttribute(attribute)) path.setAttribute(attribute, layer.getAttribute(attribute));
      }
      path.setAttribute("transform", `translate(0 ${layer.getAttribute("data-modular-layer")})`);
      surface.append(path);
    }
    if (artwork.detail && (first || artwork.detail.id === "modular-cell")) {
      const detail = artwork.detail.cloneNode(true);
      detail.removeAttribute("id");
      const position = document.createElementNS(svgNamespace, "g");
      position.setAttribute("transform", `translate(${x * 32} ${y * 32})`);
      position.append(detail);
      surface.append(position);
    }
    frame.append(surface);
  } else {
    const art = document.createElement("img");
    art.src = resourceUrl(`${asset.id}.svg`);
    art.alt = "";
    art.style.width = `${width * 100}%`;
    art.style.height = `${height * 100}%`;
    art.style.left = `${x * -100}%`;
    art.style.top = `${y * -100}%`;
    frame.append(art);
  }
  return frame;
}

export { applyFloor, loadModularArtwork, makeScenery, modularOutline, sceneryTile };
