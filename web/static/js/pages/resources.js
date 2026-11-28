import { assetRooms, assetsById, floorTextures, floorTextureUrl, resourceUrl } from "../shared/assets.js";
import { applyFloor, loadModularArtwork, makeScenery, sceneryTile } from "../shared/scenery.js";

const navigation = document.querySelector("#rooms");
const catalog = document.querySelector("#catalog");
const roleLabels = {
  obstacle: "Obstáculo fijo",
  support: "Admite fichas",
  decor: "Decoración transitable",
};
const surfaceFloors = {
  storage: "madera",
  work: "madera",
  counter: "madera",
  wet: "piedra",
  parking: "asfalto",
  service: "piedra",
  road: "asfalto",
  path: "piedra",
  planting: "arena",
  exhibit: "baldosa",
  stage: "madera",
  water: "agua",
};
const examples = {
  "Sala X · Generales": {
    size: [8, 4], floor: "madera", entry: 2, caption: "Mesas de 3 × 2 y 4 × 1 con sofá de 2 × 1.",
    layout: [
      ["mesa", 0, 1], ["mesa", 4, 1, ["####"]], ["sofa", 5, 3],
      ["silla", 1, 0], ["alfombra", 1, 3, ["##"]], ["banco", 4, 0], ["puf", 7, 3],
      ["alfombra-cuadros", 2, 0, ["##"]],
      ["basurero", 0, 3], ["sillon", 3, 3],
      ["maceta", 7, 0], ["maceta-helecho", 6, 0], ["maceta-suculenta", 5, 0],
    ],
  },
  "Recepción": {
    size: [6, 4], floor: "madera", entry: 4, caption: "Mostrador en L de cuatro casillas.",
    layout: [["mostrador", 1, 1, ["###", "#.."]], ["perchero", 5, 3]],
  },
  "Lectura": { size: [5, 3], floor: "madera", layout: [["estante", 0, 0], ["atril", 3, 1], ["globo", 4, 1]] },
  "Depósito": {
    size: [5, 3], floor: "piedra", entry: 2, surfaces: [["storage", 0, 0, 5, 1]],
    layout: [["caja", 0, 0], ["caja", 1, 0], ["barril", 3, 0], ["barril", 4, 0]],
  },
  "Taller": {
    size: [5, 3], floor: "piedra", surfaces: [["work", 0, 0, 3, 2]],
    layout: [["banco-trabajo", 0, 0], ["caja-herramientas", 2, 0]],
  },
  "Dormitorio": {
    size: [5, 3], floor: "madera", caption: "Con cama individual",
    layout: [["cama", 0, 0], ["velador", 1, 0], ["armario", 3, 0]],
    variants: [{
      size: [5, 3], floor: "madera", caption: "Con cama doble",
      layout: [["cama-doble", 0, 0], ["velador", 2, 0], ["armario", 3, 0]],
    }],
  },
  "Cocina": {
    size: [5, 3], floor: "baldosa", entry: 4, surfaces: [["counter", 1, 0, 3, 1]],
    layout: [["nevera", 0, 0], ["lavadero", 1, 0], ["cocina", 3, 0]],
  },
  "Baño": {
    size: [5, 3], floor: "baldosa", entry: 3, surfaces: [["wet", 0, 0, 3, 2]],
    layout: [["banera", 0, 0], ["inodoro", 2, 0], ["cesto", 4, 2]],
  },
  "Garaje": {
    size: [7, 4], floor: "piedra", entry: 3,
    surfaces: [["parking", 0, 0, 1, 2], ["parking", 1, 0, 1, 2], ["parking", 2, 0, 1, 2], ["service", 5, 0, 1, 3]],
    layout: [["auto", 0, 0], ["auto-azul", 1, 0], ["auto-verde", 2, 0], ["autobus", 5, 0], ["neumaticos", 6, 0]],
  },
  "Patio": {
    size: [6, 4], floor: "cesped", entry: 2,
    surfaces: [["path", 2, 3, 2, 1], ["path", 1, 2, 4, 1], ["planting", 4, 0, 2, 1]],
    layout: [["farol", 1, 3], ["fuente", 2, 1], ["arbusto", 4, 0], ["arbusto", 5, 0]],
  },
  "Calle": {
    size: [8, 5], floor: "piedra", openEdges: true, caption: "Autos de 1 × 2 y autobús de pasajeros de 1 × 3.",
    surfaces: [
      ["road", 4, 0, 2, 5], ["lane-vertical", 4, 0, 1, 1], ["lane-vertical", 4, 2, 1, 3],
      ["parking", 0, 2, 1, 2], ["parking", 1, 2, 1, 2], ["parking", 2, 2, 1, 2],
    ],
    layout: [["auto", 0, 2], ["auto-azul", 1, 2], ["auto-verde", 2, 2], ["autobus", 5, 2], ["senal", 6, 1], ["paso-peatonal", 4, 1]],
  },
  "Invernadero": {
    size: [8, 5], floor: "cesped", entry: 3,
    surfaces: [["planting", 0, 0, 3, 3], ["planting", 5, 0, 3, 3], ["path", 3, 0, 2, 5]],
    layout: [
      ["arbusto", 2, 0], ["arbusto", 5, 3],
      ["jardinera", 0, 1, ["###", "#.."]], ["jardinera", 5, 0, ["###"]],
    ],
  },
  "Museo": {
    size: [7, 4], floor: "piedra", caption: "Vitrinas en tramo recto y en esquina.",
    surfaces: [["exhibit", 0, 0, 3, 2], ["exhibit", 4, 0, 3, 2]],
    layout: [["vitrina-museo", 0, 0, ["###", "#.."]], ["vitrina-museo", 4, 0], ["pedestal-busto", 5, 1]],
  },
  "Sala de música": {
    size: [6, 4], floor: "piedra", surfaces: [["stage", 3, 0, 3, 2]],
    layout: [["piano-cola", 0, 0], ["bateria", 4, 0], ["atril-musical", 3, 1]],
  },
  "Lavandería": {
    size: [6, 3], floor: "baldosa", surfaces: [["service", 0, 0, 6, 1]],
    layout: [["lavadora", 0, 0], ["mesa-planchado", 2, 1]],
  },
  "Sala de juegos": {
    size: [8, 5], floor: "madera",
    layout: [["billar", 1, 1], ["arcade", 0, 0], ["arcade-carreras", 1, 0], ["arcade-laberinto", 2, 0], ["futbolin", 5, 2]],
  },
  "Muelle": {
    size: [8, 4], floor: "madera", openEdges: true, surfaces: [["water", 0, 2, 8, 2]],
    layout: [["lancha", 2, 2], ["salvavidas", 2, 1]],
  },
  "Estadio": {
    size: [7, 5], floor: "pista", openEdges: true,
    layout: [["lineas-cancha", 1, 1], ["porteria", 2, 0], ["balon-futbol", 4, 0],
      ["asiento-grada", 6, 0], ["tambor-hinchada", 6, 1]],
  },
  "Boda": {
    size: [6, 4], floor: "piedra",
    layout: [["arco-nupcial", 2, 0], ["ramo-de-flores", 1, 0], ["ramo-de-flores", 4, 0],
      ["tarta-nupcial", 5, 1], ["silla-ceremonia", 1, 2], ["silla-ceremonia", 4, 2]],
  },
  "Crucero y piscina": {
    size: [7, 4], floor: "madera", openEdges: true, surfaces: [["water", 0, 2, 7, 2]],
    layout: [["puesto-timon", 0, 0], ["bar-cocteles", 2, 1], ["sombrilla-piscina", 4, 0],
      ["tumbona", 4, 1], ["flotador-fiesta", 3, 2], ["boya-nado", 5, 3]],
  },
  "Aeropuerto": {
    size: [8, 5], floor: "asfalto", openEdges: true,
    layout: [["avion-embarque", 3, 0], ["asiento-terminal", 0, 0],
      ["cinta-equipaje", 0, 3], ["maleta-embarque", 2, 3]],
  },
  "Concierto": {
    size: [6, 4], floor: "madera",
    layout: [["microfono-pie", 2, 0], ["amplificador-concierto", 0, 0], ["consola-sonido", 3, 1],
      ["estuche-gira", 0, 3], ["espejo-camerino", 5, 2]],
  },
};

await loadModularArtwork(Object.values(examples).flatMap(example =>
  [example, ...(example.variants ?? [])].flatMap(({ layout }) =>
    layout.map(([asset, , , shape]) => ({ asset, shape })))));

function roomExample(room, example, cellsByAsset) {
  const { size: [columns, rows], floor, layout, caption, openEdges, entry = Math.floor(columns / 2), surfaces = [] } = example;
  const tiles = makeScenery(layout, columns, rows);
  const figure = document.createElement("figure");
  figure.className = "room-example";
  const grid = document.createElement("div");
  grid.className = "example-grid";
  grid.style.setProperty("--example-columns", columns);
  grid.setAttribute("role", "img");
  const objects = layout.map(([id]) => assetsById.get(id).name);
  grid.setAttribute("aria-label", [room, caption, [...new Set(objects)].join(", ")].filter(Boolean).join(". "));

  for (let index = 0; index < columns * rows; index++) {
    const cell = document.createElement("span");
    cell.className = "example-cell";
    const column = index % columns;
    const row = Math.floor(index / columns);
    let material = floor;
    if (!openEdges) {
      cell.classList.toggle("wall-top", row === 0);
      cell.classList.toggle("wall-left", column === 0);
      cell.classList.toggle("wall-right", column === columns - 1);
      cell.classList.toggle("wall-bottom", row === rows - 1 && column !== entry);
      cell.classList.toggle("example-entry", row === rows - 1 && column === entry);
    }
    for (const [surface, left, top, width, height] of surfaces) {
      if (column < left || column >= left + width || row < top || row >= top + height) continue;
      cell.classList.add(`example-${surface}`);
      material = surfaceFloors[surface] ?? material;
      if (surface === "parking" || surface === "service") {
        cell.classList.toggle("line-left", column === left);
        cell.classList.toggle("line-right", column === left + width - 1);
        cell.classList.toggle("line-top", row === top);
        cell.classList.toggle("line-bottom", row === top + height - 1);
      }
    }
    applyFloor(cell, material);
    const tile = tiles.get(index);
    if (tile) {
      const { id, name } = tile.asset;
      cell.title = name;
      if (!cellsByAsset.has(id)) cellsByAsset.set(id, []);
      cellsByAsset.get(id).push(cell);
      cell.append(sceneryTile(tile));
    }
    grid.append(cell);
  }
  figure.append(grid);
  if (caption) {
    const label = document.createElement("figcaption");
    label.textContent = caption;
    figure.append(label);
  }
  return figure;
}

function linkAssetToPlan(card, name, id, cellsByAsset, preview) {
  function update() {
    const next = preview.hovered ?? preview.focused;
    if (next === preview.active) return;
    for (const cell of cellsByAsset.get(preview.active) ?? []) cell.classList.remove("is-highlighted");
    for (const cell of cellsByAsset.get(next) ?? []) cell.classList.add("is-highlighted");
    preview.active = next;
  }
  card.addEventListener("pointerenter", () => {
    preview.hovered = id;
    update();
  });
  card.addEventListener("pointerleave", () => {
    preview.hovered = null;
    update();
  });
  name.addEventListener("focus", () => {
    preview.focused = id;
    update();
  });
  name.addEventListener("blur", () => {
    preview.focused = null;
    update();
  });
}

for (const [room, assets] of Object.entries(assetRooms)) {
  const id = room.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  const shortcut = document.createElement("a");
  shortcut.href = `#${id}`;
  shortcut.textContent = room;
  navigation.append(shortcut);

  const section = document.createElement("section");
  section.className = "catalog-room";
  section.id = id;
  const heading = document.createElement("h2");
  heading.textContent = room;
  const plans = document.createElement("div");
  plans.className = "room-plans";
  const example = examples[room];
  const cellsByAsset = new Map();
  const preview = {};
  for (const plan of [example, ...(example.variants ?? [])]) {
    plans.append(roomExample(room, plan, cellsByAsset));
  }
  const list = document.createElement("ul");
  list.className = "asset-grid";

  for (const asset of assets) {
    const url = resourceUrl(`${asset.id}.svg`);
    const card = document.createElement("li");
    card.className = "asset-card";
    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    const name = document.createElement("a");
    name.href = url;
    name.textContent = asset.name;
    const role = document.createElement("small");
    const [width, height] = asset.size ?? (asset.shape ? [Math.max(...asset.shape.map(row => row.length)), asset.shape.length] : [1, 1]);
    role.textContent = [roleLabels[asset.role], asset.modular ? `Base ${width} × ${height} · Modular` : `${width} × ${height}`].join(" · ");
    linkAssetToPlan(card, name, asset.id, cellsByAsset, preview);
    card.append(image, name, role);
    list.append(card);
  }
  section.append(heading, plans, list);
  catalog.append(section);
}

const textureLink = document.createElement("a");
textureLink.href = "#texturas";
textureLink.textContent = "Texturas";
navigation.append(textureLink);

const textureSection = document.createElement("section");
textureSection.id = "texturas";
textureSection.className = "texture-section";
const textureHeading = document.createElement("h2");
textureHeading.textContent = "Texturas de suelo";
const textureList = document.createElement("ul");
textureList.className = "asset-grid texture-grid";

for (const { id, name } of floorTextures) {
  const sample = document.createElement("li");
  sample.className = "asset-card";
  const pattern = document.createElement("div");
  pattern.className = "texture-pattern";
  applyFloor(pattern, id);
  pattern.setAttribute("role", "img");
  pattern.setAttribute("aria-label", `${name}, repetida en 3 × 3 casillas`);
  const link = document.createElement("a");
  link.href = floorTextureUrl(id);
  link.textContent = name;
  sample.append(pattern, link);
  textureList.append(sample);
}

textureSection.append(textureHeading, textureList);
catalog.append(textureSection);
