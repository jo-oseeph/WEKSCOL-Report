import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import loadConfig from "../../config/env.js";

// Render's disk is ephemeral, so files are re-downloaded after every deploy or restart.
const CACHE_DIR = path.join(os.tmpdir(), "wekscol-parquet");
// How long a downloaded file is trusted before GitHub is asked whether it changed.
const REFRESH_MS = 10 * 60 * 1000;
const cache = new Map();

const STATUS_HINTS = {
  401: "the data token was rejected (expired or revoked)",
  403: "access denied (token needs Contents: Read on the data repo, or it is rate limited)",
  404: "file not found in the data repo, or the token cannot see the repo",
};

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Download one file from the private repo, writing it atomically so DuckDB never reads a partial file.
async function download(entry, fileName, github) {
  const folder = github.folder ? `${github.folder}/` : "";
  const url =
    `https://api.github.com/repos/${github.repo}/contents/${folder}` +
    `${encodeURIComponent(fileName)}?ref=${encodeURIComponent(github.branch)}`;
  const headers = {
    Authorization: `Bearer ${github.token}`,
    Accept: "application/vnd.github.raw+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "wekscol-app",
  };
  // Conditional request: an unchanged file returns 304 and costs no download.
  if (entry.etag && (await exists(entry.localPath))) {
    headers["If-None-Match"] = entry.etag;
  }

  const response = await fetch(url, { headers });
  if (response.status === 304) return;
  if (!response.ok) {
    throw new Error(
      `GitHub ${response.status} for ${fileName}: ${STATUS_HINTS[response.status] || "unexpected response"}`,
    );
  }

  await fs.mkdir(CACHE_DIR, { recursive: true });
  const tempPath = `${entry.localPath}.${process.pid}.tmp`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
    await fs.rename(tempPath, entry.localPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
  entry.etag = response.headers.get("etag");
}

// Refresh a file, falling back to the cached copy when GitHub is unreachable.
async function sync(entry, fileName, github) {
  try {
    await download(entry, fileName, github);
  } catch (error) {
    if (!(await exists(entry.localPath))) {
      throw Object.assign(
        new Error(`Could not load ${fileName} from the data repository. ${error.message}`),
        { statusCode: 503 },
      );
    }
    console.warn(`[parquet] ${error.message}. Serving the cached copy of ${fileName}.`);
  }
  entry.checkedAt = Date.now();
}

// Map a configured Parquet path to a local, up-to-date copy of the same file name in the private repo.
// Without GITHUB_DATA_TOKEN and GITHUB_DATA_REPO the configured local path is used as before.
export async function resolveParquetFile(configuredPath) {
  const config = loadConfig();
  const github = {
    token: config.githubDataToken,
    repo: config.githubDataRepo,
    branch: config.githubDataBranch || "master",
    folder: config.githubDataFolder ?? "data",
  };
  if (!github.token || !github.repo) return configuredPath;

  const fileName = path.basename(configuredPath);
  let entry = cache.get(fileName);
  if (!entry) {
    entry = {
      localPath: path.join(CACHE_DIR, fileName),
      etag: null,
      checkedAt: 0,
      pending: null,
    };
    cache.set(fileName, entry);
  }

  const fresh = entry.checkedAt && Date.now() - entry.checkedAt < REFRESH_MS;
  if (fresh && (await exists(entry.localPath))) return entry.localPath;

  // Concurrent report requests share one download.
  entry.pending ??= sync(entry, fileName, github).finally(() => {
    entry.pending = null;
  });
  await entry.pending;
  return entry.localPath;
}