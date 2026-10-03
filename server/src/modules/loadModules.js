import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "agriculture");
let modulesPromise;

export async function loadModules() {
  if (!modulesPromise) modulesPromise = buildCatalog();
  return modulesPromise;
}

async function files(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const full = path.join(directory, entry.name);
        return entry.isDirectory() ? files(full) : full;
      }),
    )
  ).flat();
}

async function buildCatalog() {
  const modules = await files(root);
  const categories = new Map();
  const subcategories = new Map();
  const groups = new Map();
  const reports = new Map();

  for (const file of modules.filter((item) => /\.(category|subcategory|group|report)\.js$/.test(item))) {
    const definition = (await import(pathToFileURL(file))).default;
    if (file.includes(".category.")) {
      categories.set(definition.id, { ...definition, subcategories: [] });
    } else if (file.includes(".subcategory.")) {
      subcategories.set(definition.id, { ...definition, reports: [], groups: [] });
    } else if (file.includes(".group.")) {
      groups.set(definition.id, { ...definition, reports: [] });
    } else {
      reports.set(definition.id, definition);
    }
  }

  for (const group of groups.values()) {
    subcategories.get(group.subcategoryId)?.groups.push(group);
  }

  for (const subcategory of subcategories.values()) {
    categories.get(subcategory.categoryId)?.subcategories.push(subcategory);
  }

  for (const category of categories.values()) {
    category.subcategories.sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  for (const subcategory of subcategories.values()) {
    subcategory.groups.sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  for (const report of reports.values()) {
    const subcategory = subcategories.get(report.subcategoryId);
    if (!subcategory) continue;
    if (report.groupId && groups.has(report.groupId)) {
      groups.get(report.groupId).reports.push(report);
    } else {
      subcategory.reports.push(report);
    }
  }

  for (const group of groups.values()) {
    group.reports.sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  return { categories: [...categories.values()], reports };
}