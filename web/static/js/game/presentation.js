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
};
const directions = {
  north: "norte", south: "sur", east: "este", west: "oeste",
  northeast: "noreste", northwest: "noroeste", southeast: "sureste", southwest: "suroeste",
};

export function clueText(clue, rooms, peopleByInitial, roomTypes = []) {
  switch (clue.kind) {
    case "row": return `Estaba en la fila ${clue.number}.`;
    case "column": return `Estaba en la columna ${columnLabel(clue.number - 1)}.`;
    case "on": return `Estaba sobre ${objects[clue.object].label}.`;
    case "next_to": {
      if (clue.asset) return `Estaba al lado de ${assetsById.get(clue.asset).clueLabel}.`;
      if (clue.object === "~") return "Estaba al lado del agua.";
      const label = objects[clue.object].label;
      return `Estaba al lado de ${label}.`;
    }
    case "room": return `Estaba en la sala «${rooms.get(clue.room).name}».`;
    case "room_type": return `Estaba en ${roomTypes.find(type => type.id === clue.room_type).label}.`;
    case "column_distance": return `Estaba a ${clue.distance === 1 ? "una columna" : clue.distance === 2 ? "dos columnas" : clue.distance + " columnas"} de ${peopleByInitial.get(clue.person).name}.`;
    case "same_room": return `Estaba en la misma habitación que ${peopleByInitial.get(clue.person).name}.`;
    case "alone_with": return `Estaba a solas con ${peopleByInitial.get(clue.person).name}.`;
    default: return `Estaba al ${directions[clue.kind]} de ${peopleByInitial.get(clue.person).name}.`;
  }
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
