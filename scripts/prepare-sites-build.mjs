#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const builtHosting = path.join(dist, ".openai", "hosting.json");

for (const file of [index, worker]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));

// A private Sites checkout can provide hosting metadata when it needs it.
if (existsSync(hosting)) {
  mkdirSync(path.dirname(builtHosting), { recursive: true });
  copyFileSync(hosting, builtHosting);
} else {
  rmSync(builtHosting, { force: true });
}
