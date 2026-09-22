import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const notebookPath = path.resolve(serviceDirectory, "../../../../reports/reports.ipynb");

// Creates a standardized notebook-loading error with an HTTP status code.
function createError(message, statusCode = 500) {
  return Object.assign(new Error(message), { statusCode });
}

export function cleanSqlCell(source) {
  return source.replace(/^\s*%%sql\s*/i, "").trim().replace(/;\s*$/, "");
}

export function extractPythonSql(source) {
  const match = source.match(/sql\s*=\s*"""([\s\S]*?)"""/i);
  if (!match) throw createError("The notebook monthly SQL cell does not contain an executable SQL string.");
  return match[1].trim();
}

export async function loadNotebook() {
  try {
    return JSON.parse(await fs.readFile(notebookPath, "utf8"));
  } catch (error) {
    throw createError(`The harvesting notebook could not be loaded: ${error.message}`);
  }
}

export async function loadCell(cellIndex, type = "sql") {
  const notebook = await loadNotebook();
  const cell = notebook.cells?.[cellIndex];
  const source = Array.isArray(cell?.source) ? cell.source.join("") : "";
  if (!source) throw createError(`Harvesting notebook cell ${cellIndex} is missing.`);
  return type === "python-sql" ? extractPythonSql(source) : cleanSqlCell(source);
}