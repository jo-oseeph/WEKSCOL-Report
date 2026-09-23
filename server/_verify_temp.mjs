import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(new URL("./config/env.js", import.meta.url)));
const projectDirectory = path.join(serverDirectory, "..");
console.log("serverDirectory:", serverDirectory);
console.log("projectDirectory:", projectDirectory);
console.log("envFilePath exists:", fs.existsSync(path.join(projectDirectory, ".env")));

import loadConfig from "./config/env.js";
import { getHarvestingFilters } from "./modules/agriculture/harvesting/harvestingReportService.js";

const config = loadConfig();
console.log("harvestingDatabase config:", JSON.stringify(config.harvestingDatabase));

const t0 = Date.now();
try {
  const r1 = await getHarvestingFilters();
  console.log("First call ms:", Date.now() - t0, "units:", r1.units);
} catch (e) {
  console.log("First call error:", e.message, "statusCode:", e.statusCode);
}

const t1 = Date.now();
try {
  const r2 = await getHarvestingFilters();
  console.log("Second call (should be cached, fast) ms:", Date.now() - t1);
} catch (e) {
  console.log("Second call error:", e.message, "statusCode:", e.statusCode);
}

process.exit(0);
