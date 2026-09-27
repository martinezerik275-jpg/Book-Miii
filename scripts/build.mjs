// Stitches src/ back into one self-contained page: dist/studio-menu.html.
// CSS and JS files are concatenated in filename order (numeric prefixes set the order).
// JS files are fragments of ONE script scope (wrapped in an IIFE by src/index.html),
// so they share top-level names — they are not ES modules.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cat = dir => readdirSync(join(root, dir)).filter(f => !f.startsWith(".")).sort()
  .map(f => readFileSync(join(root, dir, f), "utf8")).join("");

const tpl = readFileSync(join(root, "src/index.html"), "utf8")
  .replace(/<!-- @include (\S+) -->\n/g, (_, f) => readFileSync(join(root, "src", f), "utf8"));
const out = tpl
  .replace("<!-- @css -->\n", () => cat("src/css"))
  .replace("<!-- @js -->\n", () => cat("src/js"));
if (out.includes("<!-- @css -->") || out.includes("<!-- @js -->")) throw new Error("unreplaced marker");

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/studio-menu.html"), out);
console.log(`dist/studio-menu.html  ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
