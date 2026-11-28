import { createPortrait, portraitLayerUrl } from "../shared/portraits.js";

const variantNumbers = (count) => Array.from({ length: count }, (_, index) => index + 1);
const layerGroups = [
  { key: "base", name: "Busto", variants: variantNumbers(4) },
  { key: "clothes", name: "Ropa", variants: variantNumbers(8) },
  { key: "hair", name: "Pelo", variants: variantNumbers(8) },
];

function layerImage(sex, layer, number) {
  const image = document.createElement("img");
  image.alt = "";
  image.width = 120;
  image.height = 140;
  image.loading = "lazy";
  image.decoding = "async";
  image.src = portraitLayerUrl(sex, layer, number);
  return image;
}

function layerSamples(sex) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Ver capas y abrir los SVG";
  details.append(summary);

  const list = document.createElement("ul");
  list.className = "character-grid";
  for (const { key, name, variants } of layerGroups) {
    for (const number of variants) {
      const sample = document.createElement("li");
      const link = document.createElement("a");
      link.href = portraitLayerUrl(sex, key, number);
      link.append(layerImage(sex, key, number), `${name} ${number}`);
      sample.append(link);
      list.append(sample);
    }
  }
  details.append(list);
  return details;
}

function combinations(sex, base) {
  const heading = document.createElement("h4");
  heading.textContent = `Busto ${base}`;
  const grid = document.createElement("ul");
  grid.className = "character-grid";

  for (const clothes of layerGroups[1].variants) {
    for (const hair of layerGroups[2].variants) {
      const item = document.createElement("li");
      item.append(createPortrait(sex, base, clothes, hair), `Ropa ${clothes} · Pelo ${hair}`);
      grid.append(item);
    }
  }
  return [heading, grid];
}

export function renderCharacterCatalog(container) {
  if (container.querySelector("svg.character-portrait")) return;
  container.replaceChildren();
  for (const [sex, label] of [["male", "Hombres"], ["female", "Mujeres"]]) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = label;
    section.append(heading, layerSamples(sex));
    for (const base of layerGroups[0].variants) {
      section.append(...combinations(sex, base));
    }
    container.append(section);
  }
}
