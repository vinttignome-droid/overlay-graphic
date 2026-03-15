import { promises as fs } from "fs";
import path from "path";

export type ServerStorageMap = Record<string, string>;

const DATA_DIR = path.join(process.cwd(), "data");
const STORAGE_FILE = path.join(DATA_DIR, "server-storage.json");

let writeQueue: Promise<void> = Promise.resolve();

const ensureStorageFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORAGE_FILE);
  } catch {
    await fs.writeFile(STORAGE_FILE, "{}", "utf8");
  }
};

export const readServerStorage = async (): Promise<ServerStorageMap> => {
  await ensureStorageFile();
  try {
    const raw = await fs.readFile(STORAGE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
};

const writeServerStorageInternal = async (entries: ServerStorageMap) => {
  await ensureStorageFile();
  await fs.writeFile(STORAGE_FILE, JSON.stringify(entries, null, 2), "utf8");
};

export const writeServerStorage = async (entries: ServerStorageMap) => {
  writeQueue = writeQueue.then(() => writeServerStorageInternal(entries));
  await writeQueue;
};
