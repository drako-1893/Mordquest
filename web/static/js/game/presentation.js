export const objects = {
  S: { id: "silla", label: "una silla" },
  A: { id: "alfombra", label: "una alfombra" },
  B: { id: "banco", label: "un banco" },
  P: { id: "puf", label: "un puf" },
  "#": { label: "un obstáculo" },
};
const directions = { north: "norte", south: "sur", east: "este", west: "oeste" };

export function clueText(clue, rooms, peopleByInitial) {
  switch (clue.kind) {
    case "row": return `Estaba en la fila ${clue.number}.`;
    case "column": return `Estaba en la columna ${clue.number}.`;
    case "on": return `Estaba sobre ${objects[clue.object].label}.`;
    case "next_to": return `Estaba al lado de ${objects[clue.object].label}.`;
    case "room": return `Estaba en la sala «${rooms.get(clue.room).name}».`;
    default: return `Estaba al ${directions[clue.kind]} de ${peopleByInitial.get(clue.person).name}.`;
  }
}

export function ruleText(rule) {
  if (rule.count === 0) return "Nadie estaba sentado.";
  if (rule.count === 1) return "Solo una persona estaba sentada.";
  return `Había exactamente ${rule.count} personas sentadas.`;
}
