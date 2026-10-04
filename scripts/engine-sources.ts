import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// What the module is built from. A test fails when their hash no longer
// matches the one generate.ts recorded.
const SOURCES = [
  "rust-toolchain.toml",
  "Cargo.toml",
  "Cargo.lock",
  "crates/wasm/Cargo.toml",
  "crates/wasm/src",
  "crates/core/Cargo.toml",
  "crates/core/src",
];

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (path: string) => {
    if (statSync(join(root, path)).isDirectory()) {
      for (const name of readdirSync(join(root, path)).sort())
        walk(`${path}/${name}`);
    } else {
      files.push(path);
    }
  };
  for (const path of SOURCES) walk(path);
  return files;
}

export function engineSourceHash(root: string): string {
  const hash = createHash("sha256");
  for (const file of sourceFiles(root)) {
    hash.update(file);
    hash.update(readFileSync(join(root, file)));
  }
  return hash.digest("hex").slice(0, 16);
}
