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

// Logo intro (splash): bars rise, wordmark slides in, overlay fades out.
// Once per browser session; shorter and static with prefers-reduced-motion.
const WORDMARK_FONT = urlFor["fa4aabac-4a2b-4f66-ae3f-38c7956b12fb"];
const SPLASH_HEAD = `
<link rel="preload" href="${WORDMARK_FONT}" as="font" type="font/woff2" crossorigin>
<script>try{if(sessionStorage.getItem('cm-intro'))document.documentElement.classList.add('cm-intro-seen')}catch(e){}</script>
<style>
#cm-intro{position:fixed;inset:0;z-index:2147483000;background:#071E2B;display:flex;align-items:center;justify-content:center;transition:opacity .55s ease,visibility .55s ease}
#cm-intro.cm-out{opacity:0;visibility:hidden}
.cm-intro-seen #cm-intro{display:none}
#cm-intro .cm-logo{display:flex;align-items:center;gap:20px;color:#FFFFFF}
#cm-intro svg{width:88px;height:68px;overflow:visible}
#cm-intro rect{transform-box:fill-box;transform-origin:50% 100%;animation:cmBar .55s cubic-bezier(.2,.8,.2,1) both}
#cm-intro rect:nth-child(2){animation-delay:.12s}
#cm-intro rect:nth-child(3){animation-delay:.24s}
#cm-intro rect:nth-child(4){animation-delay:.36s}
#cm-intro .cm-words{display:flex;flex-direction:column;line-height:1;animation:cmWord .6s .5s cubic-bezier(.2,.8,.2,1) both}
#cm-intro .cm-name{font-family:'Barlow Semi Condensed',system-ui,sans-serif;font-weight:700;font-size:50px;letter-spacing:-.4px}
#cm-intro .cm-tag{font:600 16px/1 system-ui,sans-serif;color:#A1D747;margin-top:8px;letter-spacing:.8px}
#cm-intro .cm-line{position:absolute;left:50%;bottom:22%;width:120px;height:3px;margin-left:-60px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
#cm-intro .cm-line::after{content:'';position:absolute;inset:0;background:#82D83D;transform-origin:0 50%;animation:cmLoad 1.3s .1s ease-in-out both}
@keyframes cmBar{from{transform:scaleY(0);opacity:0}to{transform:none;opacity:1}}
@keyframes cmWord{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes cmLoad{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (max-width:480px){#cm-intro svg{width:56px;height:43px}#cm-intro .cm-name{font-size:32px}#cm-intro .cm-tag{font-size:13px;margin-top:6px}#cm-intro .cm-logo{gap:14px}}
@media (prefers-reduced-motion:reduce){#cm-intro *,#cm-intro *::after{animation:none !important}#cm-intro{transition:opacity .2s ease,visibility .2s ease}}
</style>`;
const SPLASH_BODY = `
<div id="cm-intro" aria-hidden="true">
<div class="cm-logo">
<svg viewBox="0 0 44 34"><rect x="0" y="20" width="8" height="14" rx="1.5" fill="#82D83D"></rect><rect x="12" y="13" width="8" height="21" rx="1.5" fill="#6CC036"></rect><rect x="24" y="5" width="8" height="29" rx="1.5" fill="#82D83D"></rect><rect x="36" y="0" width="8" height="34" rx="1.5" fill="#A1D747"></rect></svg>
<span class="cm-words"><span class="cm-name">Contabilidade Mais</span><span class="cm-tag">Contábil</span></span>
</div>
<div class="cm-line"></div>
</div>
<script>(function(){
var el=document.getElementById('cm-intro');if(!el)return;
var seen=document.documentElement.classList.contains('cm-intro-seen');
if(seen){el.remove();return}
try{sessionStorage.setItem('cm-intro','1')}catch(e){}
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var start=Date.now(),MIN=reduce?300:1500,MAX=3500,done=false;
function hide(){if(done)return;done=true;el.classList.add('cm-out');setTimeout(function(){el.remove()},700)}
function ready(){setTimeout(hide,Math.max(0,MIN-(Date.now()-start)))}
if(document.readyState==='complete')ready();else window.addEventListener('load',ready);
setTimeout(hide,MAX);
})();</script>`;
html = html.replace(/<\/head>/i, SPLASH_HEAD + "\n</head>");
html = html.replace(/<body[^>]*>/i, (b) => b + SPLASH_BODY);

fs.writeFileSync(path.join(out, "index.html"), html);
console.log("index.html", html.length, "bytes;", Object.keys(urlFor).length, "assets +", k, "inline photos");
console.log("resources:", resources);
