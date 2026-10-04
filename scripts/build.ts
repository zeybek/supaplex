// dist/: the compiled package, and the .wasm file for runtimes that import
// the module as a file.
import { execFileSync } from "node:child_process";
import { copyFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
rmSync(join(root, "dist"), { recursive: true, force: true });
execFileSync("tsc", ["--project", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
});
copyFileSync(
  join(root, "src", "generated", "engine.wasm"),
  join(root, "dist", "generated", "engine.wasm"),
);
writeFileSync(
  join(root, "dist", "generated", "engine.wasm.d.ts"),
  "declare const module: WebAssembly.Module;\nexport default module;\n",
);
