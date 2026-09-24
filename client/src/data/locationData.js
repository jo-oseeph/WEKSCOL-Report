export const LOCATION_LEVELS = [
  "Plant",
  "Region",
  "Zone",
  "Section",
];

const nodeById = new Map();

function registerNode(node) {
  nodeById.set(node.id, node);
  return node;
}


function generateChildren(parentId, levels, childrenPerLevel = 2) {
  if (levels.length === 0) return undefined;

  const [levelLabel, ...remainingLevels] = levels;
  const children = [];

  for (let i = 1; i <= childrenPerLevel; i++) {
    const label = levelLabel === "Section" ? String.fromCharCode(64 + i) : i;
    const name = `${levelLabel} ${label}`;
    const id = `${parentId}-${levelLabel.toLowerCase()}-${label}`.toLowerCase();
    const node = registerNode({
      id,
      name,
      level: levelLabel,
      children: generateChildren(id, remainingLevels, childrenPerLevel),
    });
    children.push(node);
  }

  return children;
}

const deepLevels = ["Zone", "Section", "Sublocation", "Village"];

function makeRegion(plantId, regionName) {
  const id = `${plantId}-${regionName.toLowerCase().replace(/\s+/g, "-")}`;
  return registerNode({
    id,
    name: regionName,
    level: "Region",
    children: generateChildren(id, deepLevels),
  });
}

function makePlant(plantName, regionNames) {
  const id = plantName.toLowerCase();
  return registerNode({
    id,
    name: plantName,
    level: "Plant",
    children: regionNames.map((regionName) => makeRegion(id, regionName)),
  });
}

export const plants = [
  makePlant("Naitiri", ["Kitale", "Misikhu", "Naitiri"]),
  makePlant("Olepito", ["Busia"]),
  makePlant("Kabras", []),
];


export function getOptionsForLevel(levelIndex, parentId) {
  if (levelIndex === 0) {
    return plants.map(({ id, name }) => ({ id, name }));
  }
  if (!parentId || parentId === "all") {
    return [];
  }
  const parentNode = nodeById.get(parentId);
  if (!parentNode || !parentNode.children) {
    return [];
  }
  return parentNode.children.map(({ id, name }) => ({ id, name }));
}

export function getNodeName(id) {
  if (!id || id === "all") return "All";
  const node = nodeById.get(id);
  return node ? node.name : "All";
}
