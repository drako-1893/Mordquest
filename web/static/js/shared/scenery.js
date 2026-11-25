import { assetFamily, assetsById } from "./assets.js";

const svgNamespace = "http://www.w3.org/2000/svg";
const modularColors = {
  mesa: ["#c98e66", "#59404d", "#e5b890"],
  mostrador: ["#e5b890", "#59404d", "#f0d6af"],
  jardinera: ["#668970", "#a96e57", "#9db78e"],
  "vitrina-museo": ["#8eadbf", "#506378", "#e8efea"],
};

function modularOutline(shape) {
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
      const inset = 3;
      const radius = 2;
      const cornerX = x * 32 - (inY + outY) * inset;
      const cornerY = y * 32 + (inX + outX) * inset;
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
    const asset = assetsById.get(id);
    if (!asset || (customShape && !asset.modular)) {
      throw new Error(`Recurso inválido para el plano: ${id}`);
    }
    const [assetWidth, assetHeight] = asset.size ?? [1, 1];
    const shape = customShape ?? asset.shape ?? Array(assetHeight).fill("#".repeat(assetWidth));
    const width = Math.max(...shape.map(line => line.length));
    const height = shape.length;
    const outline = asset.modular && assetFamily(asset) !== "alfombra" ? modularOutline(shape) : null;

    for (const [y, line] of shape.entries()) {
      for (let x = 0; x < line.length; x++) {
        if (line[x] !== "#") continue;
        const tileColumn = column + x;
        const tileRow = row + y;
        const index = tileRow * columns + tileColumn;
        if (tileColumn < 0 || tileColumn >= columns || tileRow < 0 || tileRow >= rows || tiles.has(index)) {
          throw new Error(`El recurso ${id} se superpone o sale del plano.`);
        }
        tiles.set(index, { asset, width, height, x, y, outline, shape });
      }
    }
  }
  return tiles;
}

function sceneryTile(tile, continuous = false) {
  const { asset, width, height, x, y, outline, shape } = tile;
  const frame = document.createElement("span");
  frame.className = "scenery-tile";
  frame.setAttribute("aria-hidden", "true");

  const isRug = assetFamily(asset) === "alfombra";
  if (isRug || (outline && !continuous && (asset.id === "mesa" || asset.id === "mostrador"))) {
    const surface = document.createElement("span");
    surface.className = `modular-surface modular-${assetFamily(asset)}`;
    if (isRug) {
      surface.dataset.pattern = asset.id;
      surface.style.backgroundImage = `url("/Resources/${asset.id}.svg")`;
    }
    const neighbors = { top: [x, y - 1], right: [x + 1, y], bottom: [x, y + 1], left: [x - 1, y] };
    for (const [side, [column, row]] of Object.entries(neighbors)) {
      if (shape[row]?.[column] === "#") surface.classList.add(`joins-${side}`);
    }
    frame.append(surface);
  } else if (outline) {
    const surface = document.createElementNS(svgNamespace, "svg");
    surface.setAttribute("viewBox", `${x * 32} ${y * 32} 32 32`);
    const [top, edge, detail] = modularColors[asset.id];
    for (const [fill, stroke, offset] of [[edge, edge, 1.5], [top, edge, 0]]) {
      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("d", outline);
      path.setAttribute("fill", fill);
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("stroke", stroke);
      path.setAttribute("stroke-width", "1.4");
      path.setAttribute("transform", `translate(0 ${offset})`);
      surface.append(path);
    }
    if (asset.id === "jardinera") {
      const leaves = document.createElementNS(svgNamespace, "path");
      leaves.setAttribute("d", `M${x * 32 + 8} ${y * 32 + 13}q2-5 7-4-1 5-7 4zm10 8q2-5 7-4-1 5-7 4z`);
      leaves.setAttribute("fill", detail);
      surface.append(leaves);
    }
    if (asset.id === "vitrina-museo") {
      const glass = document.createElementNS(svgNamespace, "path");
      glass.setAttribute("d", `M${x * 32 + 9} ${y * 32 + 18}l9-9m-4 13 8-8`);
      glass.setAttribute("fill", "none");
      glass.setAttribute("stroke", detail);
      glass.setAttribute("stroke-width", "1.4");
      glass.setAttribute("stroke-linecap", "round");
      surface.append(glass);
    }
    frame.append(surface);
  } else {
    const art = document.createElement("img");
    art.src = `/Resources/${asset.id}.svg`;
    art.alt = "";
    art.style.width = `${width * 100}%`;
    art.style.height = `${height * 100}%`;
    art.style.left = `${x * -100}%`;
    art.style.top = `${y * -100}%`;
    frame.append(art);
  }
  return frame;
}

export { makeScenery, sceneryTile };
