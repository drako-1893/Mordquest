const vehicles = [
  { id: "auto", name: "Auto coral", role: "obstacle", size: [1, 2] },
  { id: "auto-azul", family: "auto", name: "Auto azul", role: "obstacle", size: [1, 2] },
  { id: "auto-verde", family: "auto", name: "Auto verde", role: "obstacle", size: [1, 2] },
  { id: "autobus", name: "Autobús de pasajeros", role: "obstacle", size: [1, 3] },
];
const rug = { id: "alfombra", name: "Alfombra · Rombos", role: "support", modular: true, shape: ["#"] };
const shrub = { id: "arbusto", name: "Arbusto", role: "decor" };

const assetRooms = {
  "Sala X · Generales": [
    {"id":"silla","name":"Silla","role":"support"},
    rug,
    { ...rug, id: "alfombra-ondas", family: rug.id, name: "Alfombra · Ondas" },
    { ...rug, id: "alfombra-cuadros", family: rug.id, name: "Alfombra · Cuadros" },
    {"id":"banco","name":"Banco","role":"support"},
    {"id":"puf","name":"Puf","role":"support"},
    {"id":"mesa","name":"Mesa modular","role":"obstacle","modular":true,"shape":["###","###"]},
    {"id":"sofa","name":"Sofá","role":"obstacle","size":[2,1]},
    {"id":"sillon","name":"Sillón azul","role":"support"},
    {"id":"basurero","name":"Papelera de oficina","role":"obstacle"},
    {"id":"maceta","name":"Planta de hojas largas","role":"obstacle"},
    {"id":"maceta-helecho","family":"maceta","name":"Helecho en maceta","role":"obstacle"},
    {"id":"maceta-suculenta","family":"maceta","name":"Suculenta en maceta","role":"obstacle"},
  ],
  "Recepción": [
    {"id":"mostrador","name":"Mostrador modular","role":"obstacle","modular":true,"shape":["##"]},
    {"id":"perchero","name":"Perchero","role":"obstacle"},
  ],
  "Lectura": [
    {"id":"estante","name":"Estante de libros","role":"obstacle","size":[2,1]},
    {"id":"atril","name":"Atril","role":"obstacle"},
    {"id":"globo","name":"Globo terráqueo","role":"obstacle"},
  ],
  "Depósito": [
    {"id":"caja","name":"Caja de cartón","role":"obstacle"},
    {"id":"barril","name":"Barril","role":"obstacle"},
  ],
  "Taller": [
    {"id":"banco-trabajo","name":"Banco de trabajo","role":"obstacle","size":[2,1]},
    {"id":"caja-herramientas","name":"Caja de herramientas","role":"obstacle"},
  ],
  "Dormitorio": [
    {"id":"cama","name":"Cama individual","role":"obstacle","size":[1,2]},
    {"id":"cama-doble","family":"cama","name":"Cama doble","role":"obstacle","size":[2,2]},
    {"id":"velador","name":"Velador","role":"obstacle"},
    {"id":"armario","name":"Armario","role":"obstacle","size":[2,1]},
  ],
  "Cocina": [
    {"id":"nevera","name":"Nevera","role":"obstacle"},
    {"id":"cocina","name":"Cocina con horno","role":"obstacle"},
    {"id":"lavadero","name":"Lavadero","role":"obstacle"},
  ],
  "Baño": [
    {"id":"banera","name":"Bañera","role":"obstacle","size":[1,2]},
    {"id":"inodoro","name":"Inodoro","role":"obstacle"},
    {"id":"cesto","name":"Cesto de ropa","role":"obstacle"},
  ],
  "Garaje": [
    ...vehicles,
    {"id":"neumaticos","name":"Pila de neumáticos","role":"obstacle"},
  ],
  "Patio": [
    {"id":"farol","name":"Farol","role":"obstacle"},
    {"id":"fuente","name":"Fuente","role":"obstacle","size":[2,2]},
    shrub,
  ],
  "Calle": [
    ...vehicles,
    {"id":"senal","name":"Señal de tránsito","role":"obstacle"},
    {"id":"paso-peatonal","name":"Paso peatonal","role":"decor","size":[2,1]},
  ],
  "Invernadero": [
    shrub,
    {"id":"jardinera","name":"Jardinera modular","role":"obstacle","modular":true,"shape":["##"]},
  ],
  "Museo": [
    {"id":"vitrina-museo","name":"Vitrina modular","role":"obstacle","modular":true,"shape":["##"]},
    {"id":"pedestal-busto","name":"Busto sobre pedestal","role":"obstacle"},
  ],
  "Sala de música": [
    {"id":"piano-cola","name":"Piano de cola","role":"obstacle","size":[2,2]},
    {"id":"bateria","name":"Batería","role":"obstacle","size":[2,1]},
    {"id":"atril-musical","name":"Atril musical","role":"obstacle"},
  ],
  "Lavandería": [
    {"id":"lavadora","name":"Lavadora","role":"obstacle"},
    {"id":"mesa-planchado","name":"Tabla de planchar","role":"obstacle","size":[2,1]},
  ],
  "Sala de juegos": [
    {"id":"billar","name":"Mesa de billar","role":"obstacle","size":[3,2]},
    {"id":"arcade","name":"Arcade · Naves","role":"obstacle"},
    {"id":"arcade-carreras","family":"arcade","name":"Arcade · Carreras","role":"obstacle"},
    {"id":"arcade-laberinto","family":"arcade","name":"Arcade · Laberinto","role":"obstacle"},
    {"id":"futbolin","name":"Futbolín","role":"obstacle","size":[2,1]},
  ],
  "Muelle": [
    {"id":"lancha","name":"Lancha","role":"obstacle","size":[3,1]},
    {"id":"salvavidas","name":"Salvavidas","role":"obstacle"},
  ],
};

const assetsById = new Map(Object.values(assetRooms).flat().map(asset => [asset.id, asset]));

function assetFamily(asset) {
  return asset?.family ?? asset?.id;
}

const floorTextures = [
  { id: "arena", name: "Arena" },
  { id: "piedra", name: "Piedra" },
  { id: "cesped", name: "Césped" },
  { id: "madera", name: "Madera" },
  { id: "baldosa", name: "Baldosa" },
  { id: "asfalto", name: "Asfalto" },
];

export { assetRooms, assetsById, assetFamily, floorTextures };
