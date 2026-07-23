/**
 * Load / reset the embedded ontology from the committed snapshot.
 * Works on Vercel (read-only filesystem) and locally.
 */
import fs from "fs";
import path from "path";
import { getStore, type Snapshot } from "./types";

let ready: Promise<void> | null = null;
let baseSnapshot: Snapshot | null = null;

function snapshotPath() {
  return path.join(process.cwd(), "data", "snapshot.json");
}

export function readBaseSnapshot(): Snapshot {
  if (baseSnapshot) return baseSnapshot;
  const file = snapshotPath();
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing data/snapshot.json. Run: npm run seed`
    );
  }
  baseSnapshot = JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot;
  return baseSnapshot;
}

/** Ensure the in-memory store is loaded (idempotent). */
export async function ensureStore(): Promise<void> {
  if (!ready) {
    ready = Promise.resolve().then(() => {
      const store = getStore();
      if (store.nodes.size === 0) {
        store.loadSnapshot(readBaseSnapshot());
      }
    });
  }
  await ready;
}

/** Reset live graph to the clean committed snapshot (demo Reset button). */
export async function resetStore(): Promise<{ nodes: number; edges: number }> {
  baseSnapshot = null; // re-read from disk in case seed regenerated
  const snap = readBaseSnapshot();
  const store = getStore();
  store.loadSnapshot(snap);
  ready = Promise.resolve();
  return { nodes: store.nodes.size, edges: store.edges.size };
}

export function writeSnapshot(snap: Snapshot) {
  const file = snapshotPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snap));
  baseSnapshot = snap;
}
