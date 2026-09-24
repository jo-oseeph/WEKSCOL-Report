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

// Strips the ipython-sql "%%sql <capture_var> <<" header some cells use
// (e.g. "%%sql base_result <<") in addition to the plain "%%sql" header,
// since that variable-capture syntax is not valid T-SQL on its own.
function cleanCapturingSqlCell(source) {
  return source.replace(/^\s*%%sql\s+\S+\s*<<\s*/i, "").replace(/^\s*%%sql\s*/i, "").trim().replace(/;\s*$/, "");
}

// Loads and concatenates a contiguous range of SQL cells (inclusive) into a
// single multi-statement batch, separated by semicolons. Used for reports
// whose source query spans several notebook cells building temp tables step
// by step (e.g. the Investment/Overdue report's #FERT -> #BASE -> #PGI
// pipeline), which must run together in one session for the temp tables to
// remain visible across statements.
export async function loadCellRange(startIndex, endIndex) {
  const notebook = await loadNotebook();
  const statements = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const cell = notebook.cells?.[index];
    const source = Array.isArray(cell?.source) ? cell.source.join("") : "";
    if (!source || cell.cell_type !== "code") continue;
    const cleaned = cleanCapturingSqlCell(source);
    if (cleaned) statements.push(cleaned);
  }
  if (!statements.length) {
    throw createError(`Harvesting notebook cells ${startIndex}-${endIndex} contain no SQL.`);
  }
  return statements.join(";\n\n");
}