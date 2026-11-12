// Turns the self-unpacking bundle into a plain static site:
//   <out>/index.html  (the template, rendering immediately)
//   <out>/assets/*    (images, fonts, scripts as real cacheable files)
// Usage: node unbundle.js <bundled.html> <outDir>
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const [src, out] = process.argv.slice(2);
const raw = fs.readFileSync(src, "utf8");
const L = raw.split("\n");
const manifest = JSON.parse(L[571]);
let html = JSON.parse(L[583]);
const ext = JSON.parse(raw.match(/<script type="__bundler\/ext_resources">\s*([\s\S]*?)\s*<\/script>/)[1]);
// Google Fonts OFL notice — must travel with the font files (now in assets/).
const license = raw.match(/<!--[\s\S]*?-->/)[0]
  .replace(/Some of the files packed into this page \([^)]*\) are/, "Some of the files in this site's assets/ folder (the .woff2 files) are");

const EXT = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png", "image/svg+xml": "svg",
  "text/javascript": "js", "font/woff2": "woff2" };
const NAMES = { // readable names for the known assets
  "e6740a44-a65d-404e-badf-2671255c418d": "react.production.min.js",
  "ccfeb8b3-dcac-48e8-97ee-7c7df92ed74d": "react-dom.production.min.js",
  "aafab412-720f-4b13-9380-8fe6a9aa45ca": "dc-runtime.js",
};

fs.rmSync(path.join(out, "assets"), { recursive: true, force: true });
fs.mkdirSync(path.join(out, "assets"), { recursive: true });

const urlFor = {};
for (const [uuid, e] of Object.entries(manifest)) {
  let bytes = Buffer.from(e.data, "base64");
  if (e.compressed) bytes = zlib.gunzipSync(bytes);
  const name = NAMES[uuid] || `${uuid.slice(0, 8)}.${EXT[e.mime] || "bin"}`;
  fs.writeFileSync(path.join(out, "assets", name), bytes);
  urlFor[uuid] = `assets/${name}`;
  html = html.split(uuid).join(urlFor[uuid]);
}

// Inline base64 photos inside the page's JS (team, testimonials) -> files too.
let k = 0;
html = html.replace(/data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]{2000,})/g, (m, t, b64) => {
  const name = `inline-${++k}.${t === "jpeg" ? "jpg" : t}`;
  fs.writeFileSync(path.join(out, "assets", name), Buffer.from(b64, "base64"));
  return `assets/${name}`;
});

// Map CDN ids to local files the way the unpacker did, so the runtime never refetches.
const resources = {};
for (const r of ext) if (urlFor[r.uuid]) resources[r.id] = urlFor[r.uuid];
const head = html.match(/<head[^>]*>/i);
const i = head.index + head[0].length;
html = html.slice(0, i) + "\n" + license + "\n<script>window.__resources = " +
  JSON.stringify(resources).replace(/<\//g, "<\\/") + ";</script>" + html.slice(i);

// Local files carry no SRI pin.
html = html.replace(/<[a-z][^>]*>/gi, (tag) => /\s(?:src|href)="assets\//i.test(tag)
  ? tag.replace(/\s+integrity="[^"]*"/gi, "").replace(/\s+crossorigin="[^"]*"/gi, "") : tag);

// Below-the-fold photos: let the browser defer them (hero stays eager).
const HERO = urlFor["ab1a14ff-3e6e-4dc8-a890-541eac104f84"];
html = html.replace(/<img (?![^>]*loading=)([^>]*src="(assets\/[^"]+)")/g,
  (m, attrs, url) => url === HERO ? `<img fetchpriority="high" ${attrs}` : `<img loading="lazy" decoding="async" ${attrs}`);

fs.writeFileSync(path.join(out, "index.html"), html);
console.log("index.html", html.length, "bytes;", Object.keys(urlFor).length, "assets +", k, "inline photos");
console.log("resources:", resources);
