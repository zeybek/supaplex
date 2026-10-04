#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { main } from "./cli.ts";

process.exitCode = await main(process.argv.slice(2), {
  read: (path) => new Uint8Array(readFileSync(path)),
  write(path, bytes) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  },
  out: (line) => console.log(line),
});
