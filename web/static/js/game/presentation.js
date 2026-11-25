export const objects = {
  S: { id: "silla", label: "una silla" },
  A: { id: "alfombra", label: "una alfombra" },
  B: { id: "banco", label: "un banco" },
  P: { id: "puf", label: "un puf" },
};
const obstacleLabels = {
  arcade: "una máquina arcade de naves",
  "arcade-carreras": "una máquina arcade de carreras",
  "arcade-laberinto": "una máquina arcade de laberinto",
  atril: "un atril",
  barril: "un barril",
  basurero: "una papelera",
  caja: "una caja",
  "caja-herramientas": "una caja de herramientas",
  farol: "un farol",
  globo: "un globo terráqueo",
  lavadero: "un lavadero",
  maceta: "una maceta con una planta de hojas largas",
  "maceta-helecho": "un helecho en maceta",
  "maceta-suculenta": "una suculenta en maceta",
  neumaticos: "una pila de neumáticos",
  "pedestal-busto": "un busto sobre pedestal",
  perchero: "un perchero",
};
const directions = { north: "norte", south: "sur", east: "este", west: "oeste" };

export function clueText(clue, rooms, peopleByInitial) {
  switch (clue.kind) {
    case "row": return `Estaba en la fila ${clue.number}.`;
    case "column": return `Estaba en la columna ${clue.number}.`;
    case "on": return `Estaba sobre ${objects[clue.object].label}.`;
    case "next_to": {
      const label = clue.object === "#" ? obstacleLabels[clue.asset] : objects[clue.object].label;
      return `Estaba al lado de ${label}.`;
    }
    case "room": return `Estaba en la sala «${rooms.get(clue.room).name}».`;
    default: return `Estaba al ${directions[clue.kind]} de ${peopleByInitial.get(clue.person).name}.`;
  }
}

export function ruleText(rule) {
  if (rule.count === 0) return "Nadie estaba sentado.";
  if (rule.count === 1) return "Solo una persona estaba sentada.";
  return `Había exactamente ${rule.count} personas sentadas.`;
}
