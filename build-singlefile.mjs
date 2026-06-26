// Inlines config.js + twin-voice.js + app.js into one self-contained index.html
// (single <script type="module">), for hosts with SPA catch-all rewrites where
// only index.html is reliably served. No bundler: just strips the inter-module
// import/export lines and concatenates. Usage: node build-singlefile.mjs <out>
import { readFileSync, writeFileSync } from "node:fs";

const out = process.argv[2] || "./dist-index.html";
const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

const cdnImport = `import { Room, RoomEvent, Track } from "https://esm.sh/livekit-client@2.17.3";`;

const config = read("./config.js").replace(/^export\s+const\s+CONFIG/m, "const CONFIG");
const twin = read("./twin-voice.js")
  .replace(/^import .*livekit-client.*$/m, "")     // drop its CDN import (added once below)
  .replace(/^export\s+class\s+TwinVoice/m, "class TwinVoice");
const app = read("./app.js")
  .replace(/^import \{ CONFIG \} from "\.\/config\.js";$/m, "")
  .replace(/^import \{ TwinVoice \} from "\.\/twin-voice\.js";$/m, "");

const module = [cdnImport, "", config, "", twin, "", app].join("\n");

const html = read("./index.html").replace(
  /<script type="module" src="\.\/app\.js"><\/script>/,
  `<script type="module">\n${module}\n</script>`
);

writeFileSync(out, html);
console.log("wrote", out, `(${html.length} bytes)`);
