const svgNamespace = "http://www.w3.org/2000/svg";

export function portraitLayerUrl(sex, layer, number) {
  return `/Resources/personajes/${sex}-${layer}-${number}.svg`;
}

function portraitLayers(sex, base, clothes, hair) {
  return [portraitLayerUrl(sex, "base", base), portraitLayerUrl(sex, "clothes", clothes), portraitLayerUrl(sex, "hair", hair)];
}

export function createPortrait(sex, base, clothes, hair) {
  const portrait = document.createElementNS(svgNamespace, "svg");
  portrait.setAttribute("class", "character-portrait");
  portrait.setAttribute("viewBox", "0 0 120 140");
  portrait.setAttribute("width", "120");
  portrait.setAttribute("height", "140");
  portrait.setAttribute("aria-hidden", "true");

  for (const url of portraitLayers(sex, base, clothes, hair)) {
    const image = document.createElementNS(svgNamespace, "image");
    image.setAttribute("href", url);
    image.setAttribute("width", "120");
    image.setAttribute("height", "140");
    portrait.append(image);
  }
  return portrait;
}

export function participantPortrait(levelId, person) {
  let hash = 0;
  for (const character of `${levelId}:${person.initial}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  // The odd multiplier keeps the 256 variant numbers distinct for unique initials.
  const variant = hash & 255;
  const sex = person.sex ?? (hash & 256 ? "female" : "male");
  const portrait = document.createElementNS(svgNamespace, "svg");
  portrait.setAttribute("class", "character-portrait");
  portrait.setAttribute("viewBox", "0 10 120 120");
  portrait.setAttribute("aria-hidden", "true");
  const layers = [["base", (variant >> 6) + 1], ["clothes", ((variant >> 3) & 7) + 1], ["hair", (variant & 7) + 1]];
  for (const [layer, number] of layers) {
    const id = `portrait-${sex}-${layer}-${number}`;
    const embedded = document.getElementById(id);
    const artwork = document.createElementNS(svgNamespace, embedded ? "use" : "image");
    artwork.setAttribute("href", embedded ? `#${id}` : portraitLayerUrl(sex, layer, number));
    if (!embedded) {
      artwork.setAttribute("width", "120");
      artwork.setAttribute("height", "140");
    }
    portrait.append(artwork);
  }
  return portrait;
}
