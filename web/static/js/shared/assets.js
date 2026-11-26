const response = await fetch(new URL("../../data/scenery.json", import.meta.url), {
  signal: AbortSignal.timeout(10000),
});
if (!response.ok) throw new Error("No se pudo cargar el catálogo de Recursos.");
const { assetRooms, floorTextures } = await response.json();
const assetsById = new Map(Object.values(assetRooms).flat().map(asset => [asset.id, asset]));

function assetFamily(asset) {
  return asset?.family ?? asset?.id;
}

export { assetRooms, assetsById, assetFamily, floorTextures };
