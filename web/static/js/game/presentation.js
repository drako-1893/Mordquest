import { assetsById } from "../shared/assets.js";

export function columnLabel(index) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index];
}

export const objects = {
  S: { id: "silla", label: "una silla" },
  A: { id: "alfombra", label: "una alfombra" },
  B: { id: "banco", label: "un banco" },
  P: { id: "puf", label: "un puf" },
  T: { id: "sillon", label: "un sillón" },
  C: { id: "cama", label: "una cama" },
};
const directions = {
  north: "norte", south: "sur", east: "este", west: "oeste",
  northeast: "noreste", northwest: "noroeste", southeast: "sureste", southwest: "suroeste",
};
const cluePalette = [
  "#ff9191", "#ffc180", "#ffea80", "#d3f785", "#90eea0", "#81ebcd",
  "#80e8f9", "#9bc6ff", "#aeb0ff", "#d9acff", "#f6a2f0", "#f5d4e0",
];

function describedReference(prefix, label) {
  const article = label.match(/^(?:un|una|unos|unas|el|la|los|las) /i)?.[0] ?? "";
  return [prefix + article, label.slice(article.length), "."];
}

export function clueReferenceKey(clue) {
  switch (clue.kind) {
    case "row": return `row:${clue.number}`;
    case "column": return `column:${clue.number}`;
    case "room": return `room:${clue.room}`;
    case "room_type": return `room_type:${clue.room_type}`;
    case "room_corner": return "room_corner";
    case "on":
    case "next_to": return `object:${clue.asset ?? clue.object}`;
    default: return `person:${clue.person}`;
  }
}

function colorDistance(first, second) {
  const a = Number.parseInt(first.slice(1), 16);
  const b = Number.parseInt(second.slice(1), 16);
  return [16, 8, 0].reduce((sum, shift) => {
    const difference = ((a >> shift) & 255) - ((b >> shift) & 255);
    return sum + difference ** 2;
  }, 0);
}

function chooseClueColor(used) {
  const available = cluePalette.filter(color => !used.has(color));
  if (!available.length) {
    let color;
    do {
      const channels = Array.from({ length: 3 }, () => (175 + Math.floor(Math.random() * 81)).toString(16));
      color = `#${channels.join("")}`;
    } while (used.has(color));
    return color;
  }

  // Vary the choice while favoring colors far from the ones already in use.
  let bestColor;
  let bestScore = -1;
  for (const color of available) {
    const distance = Math.min(3 * 255 ** 2, ...[...used].map(other => colorDistance(color, other)));
    const score = distance * (0.8 + 0.2 * Math.random());
    if (score > bestScore) {
      bestColor = color;
      bestScore = score;
    }
  }
  return bestColor;
}

export function clueHighlights(clues, peopleByInitial) {
  const highlights = new Map();
  const used = new Set();
  for (const clue of clues ?? []) {
    if (!clue.person) continue;
    const color = peopleByInitial.get(clue.person).color;
    highlights.set(clueReferenceKey(clue), { clue, color });
    used.add(color.toLowerCase());
  }
  for (const clue of clues ?? []) {
    const key = clueReferenceKey(clue);
    if (highlights.has(key)) continue;
    const color = chooseClueColor(used);
    highlights.set(key, { clue, color });
    used.add(color);
  }
  return highlights;
}

export function clueParts(clue, rooms, peopleByInitial, roomTypes = []) {
  // Odd-indexed parts are emphasized in the roster.
  const personName = peopleByInitial.get(clue.person)?.name;
  switch (clue.kind) {
    case "row": return ["Estaba en la ", `fila ${clue.number}`, "."];
    case "column": return ["Estaba en la ", `columna ${columnLabel(clue.number - 1)}`, "."];
    case "on":
    case "next_to": {
      const label = assetsById.get(clue.asset)?.clueLabel ?? objects[clue.object]?.label;
      if (!label && clue.object === "~") return ["Estaba al lado del ", "agua", "."];
      return describedReference(clue.kind === "on" ? "Estaba sobre " : "Estaba al lado de ", label);
    }
    case "room": return ["Estaba en la sala «", rooms.get(clue.room).name, "»."];
    case "room_type": return describedReference("Estaba en ", roomTypes.find(type => type.id === clue.room_type).label);
    case "room_corner": return ["Estaba en una ", "esquina de su sala", "."];
    case "column_distance": {
      const distance = clue.distance === 1 ? "una columna" : clue.distance === 2 ? "dos columnas" : clue.distance + " columnas";
      return ["Estaba ", `a ${distance} de`, " ", personName, "."];
    }
    case "same_room": return ["Estaba en la misma sala que ", personName, "."];
    case "alone_with": return ["Estaba a solas con ", personName, "."];
    default: return ["Estaba al ", directions[clue.kind], " de ", personName, "."];
  }
}

export function clueText(clue, rooms, peopleByInitial, roomTypes) {
  return clueParts(clue, rooms, peopleByInitial, roomTypes).join("");
}

export function ruleText(rule, rooms) {
  if (rule.kind === "room_exactly") {
    const room = rooms.get(rule.room).name;
    if (rule.count === 0) return `La sala «${room}» estaba vacía.`;
    if (rule.count === 1) return `En «${room}» había una sola persona.`;
    return `En «${room}» había exactamente ${rule.count} personas.`;
  }
  if (rule.kind === "empty_rooms_exactly") {
    if (rule.count === 0) return "Todas las salas estaban ocupadas.";
    if (rule.count === 1) return "Había exactamente una sala vacía.";
    return `Había exactamente ${rule.count} salas vacías.`;
  }
  if (rule.kind === "room_access") {
    return `Solo el grupo «${rule.group}» podía estar en «${rooms.get(rule.room).name}».`;
  }
  if (rule.kind === "everyone_accompanied") {
    return "Toda persona compartía su sala con al menos otra.";
  }
  if (rule.count === 0) return "Nadie estaba sentado.";
  if (rule.count === 1) return "Solo una persona estaba sentada.";
  return `Había exactamente ${rule.count} personas sentadas.`;
}
