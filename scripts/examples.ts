// Runs every Node example against the built package, so a change that
// breaks one fails the checks. Run after `npm run build`.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "examples", "node");
const files = readdirSync(dir).filter((file) => file.endsWith(".js"));
for (const file of files.sort()) {
  execFileSync(process.execPath, [join(dir, file)], { stdio: "pipe" });
  console.log(`ok ${file}`);
}
