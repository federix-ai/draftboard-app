import { animate, createTimeline, stagger, utils, onScroll, splitText, createDraggable } from "./anime.esm.min.js?v=4.5.0";
import { IT, UI } from "./i18n.js?v=0.7.5";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const AG = { cc: ["CC", "Claude Code"], cx: ["CX", "Codex"], gm: ["GM", "Gemini CLI"], oc: ["OC", "OpenCode"] };
const PROMPT = '<span class="p">›</span> ';

/* ------------------------------------------------- the app's pointers (CursorKit "Ventaglio") */
// On a 32 grid, tip at (7, 4): the palest arrow turned 26°, the lighter one 13°, the violet one on top.
const ARROW = "M7 4v20.5l5-4.6 3.4 7.6 3.6-1.6-3.4-7.4h6.8z";
// The charge ring of the long press (CursorKit.hold): a white disc, a track, the violet arc that fills.
const HOLD = `<svg class="hold" viewBox="0 0 32 32" aria-hidden="true"><circle cx="24" cy="24.5" r="5" fill="#fff" stroke="#fff" stroke-width="5"/><circle cx="24" cy="24.5" r="5" fill="none" stroke="rgba(28,27,34,.22)" stroke-width="2.2"/><circle class="arc" cx="24" cy="24.5" r="5" fill="none" stroke="#6E4FF5" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" transform="rotate(-90 24 24.5)"/></svg>`;
const FAN = `<svg class="fan-arrow" viewBox="0 0 32 32"><path class="f2" d="${ARROW}" style="transform:rotate(26deg)"/><path class="f1" d="${ARROW}" style="transform:rotate(13deg)"/><path class="f0" d="${ARROW}"/></svg>`;
(() => {
  // Every shape is filled and stroked in white (3 pt), then filled in colour, under a 0,1,1.5 shadow.
  const r = (x, y, w, h, k, turn) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${k}"${turn ? ` transform="rotate(${turn})"` : ""}/>`;
  const shape = (body, color) => `<g fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round">${body}</g><g fill="${color}">${body}</g>`;
  const url = (inner, x, y, fallback) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="0.75" flood-opacity="0.35"/></filter><g filter="url(#s)">${inner}</g></svg>`)}") ${x} ${y}, ${fallback}`;
  const arrow = turn => `<path d="${ARROW}"${turn ? ` transform="rotate(${turn} 7 4)"` : ""}/>`;
  const C = {
    arrow: url(shape(arrow(26), "#DAD2FD") + shape(arrow(13), "#B5A6FA") + shape(arrow(), "#6E4FF5"), 7, 4, "default"),
    open: url(shape(r(11.4, 5, 3.4, 12, 1.7) + r(14.9, 3.5, 3.4, 13, 1.7) + r(18.4, 4.6, 3.4, 12, 1.7) + r(21.9, 7.4, 3, 10, 1.5) + r(11.4, 13, 13.5, 13.5, 4.5) + r(6.6, 11.5, 3.4, 10, 1.7, "-40 8.3 16.5"), "#6E4FF5"), 16, 16, "grab"),
    fist: url(shape(r(9.6, 10.5, 3.6, 8, 1.8) + r(13.2, 9.2, 3.6, 8, 1.8) + r(16.8, 9.2, 3.6, 8, 1.8) + r(20.4, 10.5, 3.4, 8, 1.7) + r(9.6, 13.5, 14.2, 13, 4.5), "#6E4FF5")
      + `<path d="M13.2 13v3.2M16.8 12v3.2M20.4 13v3.2" stroke="#fff" stroke-opacity=".55" stroke-linecap="round"/>`, 16, 16, "grabbing"),
  };
  const root = document.documentElement.style;
  root.setProperty("--cur-arrow", C.arrow); root.setProperty("--cur-open", C.open); root.setProperty("--cur-fist", C.fist);
  window.__cursors = C;
})();
const CUR = window.__cursors;
// The animated pointer arrives folded and opens its fan as it lands.
const fanIn = (tl, el, pos) => {
  const [f2, f1] = $$(".f2, .f1", el);
  const run = (a, b) => tl ? tl.add(a, b, pos) : animate(a, b);
  run([f2, f1], { rotate: (_, i) => [0, i ? 13 : 26], duration: 520, delay: stagger(40), ease: "outBack(2)" });
};

let lang = document.documentElement.lang === "it" ? "it" : "en";
const t = k => UI[lang][k];
const label = st => t(st === "need" ? "need" : st === "done" ? "done" : st);
const langHooks = [];

/* ------------------------------------------------------------------ i18n */
const EN = {};
$$("[data-i18n]").forEach(el => { const k = el.dataset.i18n; if (!(k in EN)) EN[k] = el.innerHTML; });

function setLangUI() {
  $$(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  const on = $(`.lang button[data-lang="${lang}"]`), pill = $(".lang-pill");
  if (on && pill) animate(pill, { x: on.offsetLeft - 3, width: on.offsetWidth, duration: reduce ? 0 : 450, ease: "out(4)" });
}
function applyLang(l, fromUser) {
  lang = l;
  document.documentElement.lang = l;
  $$("[data-i18n]").forEach(el => { const v = l === "it" ? IT[el.dataset.i18n] : EN[el.dataset.i18n]; if (v != null) el.innerHTML = v; });
  try { localStorage.setItem("draftboard.lang", l); } catch (e) {}
  setLangUI();
  langHooks.forEach(fn => fn());
  if (fromUser && !reduce) animate($$(".sec-head h2, .lede, .sec-head p, .chapters h3"), { opacity: [0.2, 1], duration: 500, ease: "out(2)" });
}
$$(".lang button").forEach(b => b.addEventListener("click", () => { if (b.dataset.lang !== lang) applyLang(b.dataset.lang, true); }));
if (lang === "it") applyLang("it"); else setLangUI();

/* --------------------------------------------------------------- terminal */
class Term {
  constructor(pre, max = 4) { this.pre = pre; this.max = max; this.lines = []; }
  render() { this.pre.innerHTML = this.lines.join("\n"); }
  push(html) { this.lines.push(html); while (this.lines.length > this.max) this.lines.shift(); this.render(); }
  last(html) { this.lines[this.lines.length - 1] = html; this.render(); }
  set(lines) { this.lines = lines.slice(-this.max); this.render(); }
}
function setState(node, st) {
  node.classList.remove("working", "waiting", "need", "done");
  node.classList.add(st);
  node.dataset.state = st;
  const em = node.querySelector(".st em"); if (em) em.textContent = label(st);
}


/* ================================================================ SCREENS */
// Real screens of the app, rendered from its UI design canvas ("Orchestrator — UI macOS") and saved as
// static markup in assets/screens/. They are fetched when needed and scaled into their frames.
const SCREENS_V = "0.7.5";
const screenCache = {};
const loadScreen = name => (screenCache[name] ??= fetch(`assets/screens/${name}.html?v=${SCREENS_V}`).then(r => (r.ok ? r.text() : "")));
const SIZES = {
  main: [1728, 1080], "main-git": [1728, 1080], overview: [1600, 1000], plan: [1728, 1080], output: [1728, 1080],
  launch: [760, 900], usage: [360, 1028], fasi: [360, 1028], model: [300, 520], cartelle: [1440, 900],
  "floor-live": [1200, 720], "floor-open": [1200, 720], "floor-hover": [1200, 720], "floor-enter": [1200, 720], "floor-arrived": [1200, 720],
  "cap-live": [480, 360], "cap-hover": [480, 360], "cap-flash": [480, 360], "cap-annotate": [480, 360], "cap-comment": [480, 360], "cap-fixed": [480, 360],
  "radial-open": [480, 320], "radial-pick": [480, 320],
};
// A screen in its own box, at its native size; the caller scales or moves the box.
async function screenEl(name) {
  const [w, h] = SIZES[name], el = document.createElement("div");
  el.className = "scr"; el.dataset.screen = name;
  el.style.width = w + "px"; el.style.height = h + "px";
  el.innerHTML = await loadScreen(name);
  return el;
}
// The absolutely placed block of a screen at (left, top), e.g. a node on the canvas.
const block = (scr, left, top) => [...scr.querySelectorAll("div")].find(d => d.style.left === left + "px" && d.style.top === top + "px");
// the innermost element whose text starts with `text`
const byText = (scr, sel, text) => [...scr.querySelectorAll(sel)].filter(e => e.textContent.trim().startsWith(text)).pop();
const rectIn = (el, frame, k) => { const a = frame.getBoundingClientRect(), b = el.getBoundingClientRect();
  return { x: (b.left - a.left) / k, y: (b.top - a.top) / k, w: b.width / k, h: b.height / k, cx: (b.left - a.left + b.width / 2) / k, cy: (b.top - a.top + b.height / 2) / k }; };
// Wrap every character of an element's text in a span so it can be typed in.
function charSpans(el) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
  while (walk.nextNode()) if (walk.currentNode.textContent.trim()) nodes.push(walk.currentNode);
  const chars = [];
  nodes.forEach(n => {
    const frag = document.createDocumentFragment();
    [...n.textContent].forEach(ch => { const s = document.createElement("span"); s.textContent = ch; frag.appendChild(s); chars.push(s); });
    n.replaceWith(frag);
  });
  return chars;
}
const ripple = (parent, x, y) => {
  const rp = document.createElement("i"); rp.className = "ripple"; rp.style.left = x + "px"; rp.style.top = y + "px"; parent.appendChild(rp);
  animate(rp, { scale: [0.3, 1.9], opacity: [1, 0], duration: 650, ease: "out(3)", onComplete: () => rp.remove() });
};
// The app's pointer flies to (x, y) in its parent, opens its fan, clicks.
function clickAt(tl, cursor, from, x, y, pos, onClick) {
  tl.set(cursor, { x: from[0], y: from[1], opacity: 0, scale: 1 }, pos)
    .set($$(".f2, .f1", cursor), { rotate: 0 }, pos)
    .add(cursor, { opacity: 1, x, y, duration: 900, ease: "inOut(3)" }, pos);
  fanIn(tl, cursor, pos + 650);
  tl.add(cursor, { scale: [1, 0.8, 1], duration: 240, ease: "out(2)" }, pos + 950)
    .call(() => { ripple(cursor.parentElement, x, y); onClick && onClick(); }, pos + 1050)
    .add(cursor, { opacity: 0, duration: 400 }, pos + 1700);
  return pos + 1050;
}

/* =================================================================== HERO */
// The icon's orchestra takes its seats, like the launch splash; then each terminal flies to its place in
// the real window (sidebar, nodes, toolbar, inspector) and the podium's prompt becomes the composer.
// Then the window lives: a message is typed to the coder, the pointer approves the tester's request.
const ICON = {
  seats: [[200, 530, -60], [332, 398, -30], [512, 350, 0], [692, 398, 30], [824, 530, 60], [364, 562, -45], [512, 500, 0], [660, 562, 45]],
  glyph: "M-30 -14 L-14 0 L-30 14 M-2 14 L22 14",
  arc: r => Array.from({ length: 49 }, (_, i) => { const a = (-165 + 150 * i / 48) * Math.PI / 180;
    return `${i ? "L" : "M"}${(512 + r * Math.cos(a)).toFixed(1)} ${(710 + r * Math.sin(a)).toFixed(1)}`; }).join(" "),
};

const hero = (() => {
  const root = $("#hero-stage"); if (!root) return {};
  const frame = $(".hw", root), icon = $(".hicon", root), cursor = $(".cursor", root), btn = $(".hplay"), toastEl = $(".htoast", root);
  cursor.innerHTML = FAN;
  let K = 1;
  const fit = () => { K = root.clientWidth / 1728; frame.style.transform = `scale(${K})`; };
  new ResizeObserver(fit).observe(root); fit();

  // Where each block of the window is (window coordinates), and which seat of the icon becomes it.
  const B = {
    sidebar: [0, 0, 288, 1080], leader: [312, 140, 280, 230], toolbar: [288, 0, 1440, 52], note: [1088, 140, 256, 252],
    inspector: [1368, 52, 360, 1028], tester: [312, 472, 400, 260], coder: [640, 140, 420, 300], portal: [740, 472, 520, 330],
  };
  const ORDER = ["sidebar", "leader", "toolbar", "note", "inspector", "tester", "coder", "portal"];
  const s = 0.74, tx = 828 - 512 * s, ty = 330 - 546 * s;
  icon.innerHTML = `<defs>${[360, 210].map((r, i) => `<mask id="hplan${i}" maskUnits="userSpaceOnUse"><path d="${ICON.arc(r)}" pathLength="1" fill="none" stroke="#fff" stroke-width="16" stroke-dasharray="1 1"/></mask>`).join("")}</defs>
    <g transform="translate(${tx} ${ty}) scale(${s})"><g class="plans">${[360, 210].map((r, i) => `<path class="plan" d="${ICON.arc(r)}" mask="url(#hplan${i})"/>`).join("")}</g>
    ${ICON.seats.map(([x, y, a]) => `<g class="seat"><g transform="translate(${x} ${y}) rotate(${a})"><rect x="-56" y="-42" width="112" height="84" rx="22"/><path d="${ICON.glyph}"/></g></g>`).join("")}
    <path class="prompt" pathLength="1" d="M448 680 L496 724 L448 768"/><rect class="podium-caret" x="520" y="692" width="36" height="66" rx="8"/></g>`;
  const seats = $$(".seat", icon), glyphs = $$(".seat path", icon), plans = $(".plans", icon), masks = $$("mask path", icon);
  const prompt = $(".prompt", icon), caret = $(".podium-caret", icon);

  let W = null, blocks = {}, composer = null, canvasRest = [], chars = [], marks = [], allow = null, needs = null, invia = null;
  const ready = screenEl("main").then(scr => {
    W = scr; frame.prepend(scr);
    const canvas = block(scr, 288, 52);
    blocks = { sidebar: block(scr, 0, 0), toolbar: block(scr, 288, 0), inspector: block(scr, 1368, 52),
      leader: block(canvas, 24, 88), coder: block(canvas, 352, 88), note: block(canvas, 800, 88), tester: block(canvas, 24, 420), portal: block(canvas, 452, 420) };
    composer = block(canvas, 260, 836);
    canvasRest = [...canvas.children].slice(1).filter(el => !Object.values(blocks).includes(el) && el !== composer);
    const msg = byText(composer, "div", "Perfetto.");
    chars = msg ? charSpans(msg) : [];
    // the @mentions are chips: each one appears with its first letter
    marks = msg ? [...msg.querySelectorAll("span")].filter(sp => sp.style.background && !chars.includes(sp)).map(sp => [sp, chars.indexOf(sp.querySelector("span"))]) : [];
    allow = byText(blocks.tester, "button, span", "Consenti");
    needs = byText(blocks.toolbar, "button", "tester ti aspetta");
    invia = byText(composer, "button", "Invia");
    return scr;
  });

  /* ---- the intro ---- */
  const prime = () => {
    utils.set(masks, { strokeDashoffset: 1 });
    utils.set(seats, { opacity: 0, translateY: -26, scale: 0.72 });
    utils.set(glyphs, { opacity: 0 });
    utils.set(prompt, { strokeDasharray: "1 1", strokeDashoffset: 1 });
    utils.set(caret, { opacity: 0 });
    utils.set([...Object.values(blocks), composer, ...canvasRest], { opacity: 0 });
  };
  const intro = () => {
    const tl = createTimeline({ autoplay: false, onComplete: () => startLoop() });
    tl.add(masks, { strokeDashoffset: [1, 0], duration: 450, ease: "inOut(3)" }, 100)
      .add(seats, { opacity: [0, 1], translateY: [-26, 0], scale: [0.72, 1], duration: 260, delay: stagger(75), ease: "out(3)" }, 380)
      .add(glyphs, { opacity: [0, 1], duration: 100, delay: stagger(30) }, 1000)
      .add(prompt, { strokeDashoffset: [1, 0], duration: 180, ease: "inOut(3)" }, 1180)
      .set(caret, { opacity: 1 }, 1380).set(caret, { opacity: 0 }, 1910).set(caret, { opacity: 1 }, 2440);
    // each terminal flies to its place and opens up into its part of the window
    const T0 = 2700;
    ORDER.forEach((key, i) => {
      const el = blocks[key], [bx, by, bw, bh] = B[key], [x, y, a] = ICON.seats[i];
      const cx = tx + x * s, cy = ty + y * s, d = Math.abs(i - 3.5) * 45;
      tl.add(el, { opacity: [0, 1], duration: 260, ease: "linear" }, T0 + d)
        .add(el, { translateX: [cx - (bx + bw / 2), 0], translateY: [cy - (by + bh / 2), 0], rotate: [a, 0],
          scaleX: [112 * s / bw, 1], scaleY: [84 * s / bh, 1], duration: 1100, ease: "inOut(4)" }, T0 + d)
        .add(seats[i], { opacity: [1, 0], duration: 200 }, T0 + d);
    });
    tl.add([plans, prompt, caret], { opacity: 0, duration: 300 }, T0)
      .add(composer, { opacity: [0, 1], translateX: [tx + 472 * s - (548 + 280), 0], translateY: [ty + 724 * s - (888 + 88), 0], scale: [0.12, 1], duration: 1000, ease: "inOut(4)" }, T0 + 150)
      .add(canvasRest, { opacity: [0, 1], duration: 600, delay: stagger(60) }, T0 + 1100);
    return tl;
  };

  /* ---- the window lives ---- */
  const loop = () => {
    const tl = createTimeline({ autoplay: false, onComplete: () => setTimeout(startLoop, 600) });
    utils.set(chars, { opacity: 0 }); utils.set(marks.map(m => m[0]), { opacity: 0 });
    tl.add(chars, { opacity: [0, 1], duration: 1, delay: stagger(22) }, 500);
    marks.forEach(([el, i]) => tl.add(el, { opacity: [0, 1], duration: 60 }, 500 + Math.max(0, i) * 22));
    let p = 500 + chars.length * 22 + 300;
    if (invia) tl.add(invia, { scale: [1, 0.9, 1], duration: 260, ease: "inOut(2)" }, p);
    tl.add(composer, { y: [0, -6, 0], duration: 420, ease: "out(3)" }, p);
    p += 900;
    if (needs) tl.add(needs, { scale: [1, 1.08, 1], duration: 500, ease: "out(3)" }, p);
    if (allow) {
      const r = rectIn(allow, frame, K);
      const hit = clickAt(tl, cursor, [1500, 1000], r.cx, r.cy, p + 300, () => {
        $("span", toastEl).textContent = UI[lang].hero.testerOk;
      });
      tl.add(blocks.tester, { scale: [1, 1.02, 1], duration: 360 }, hit)
        .add(toastEl, { opacity: [0, 1], y: [-10, 0], duration: 380, ease: "out(3)" }, hit + 100)
        .add(needs ? [needs] : [], { opacity: [1, 0.35], duration: 400 }, hit + 100)
        .add(toastEl, { opacity: 0, duration: 300 }, hit + 2400)
        .add(needs ? [needs] : [], { opacity: 1, duration: 400 }, hit + 3000);
      p = hit + 3600;
    }
    tl.call(() => {}, p);
    return tl;
  };

  /* ---- playback ---- */
  let cur = null, paused = false, visible = false, began = false;
  const run = tl => { cur = tl; if (!paused && visible) tl.play(); };
  function startLoop() { run(loop()); }
  const setBtn = on => { btn.dataset.playing = String(on); btn.setAttribute("aria-label", on ? "Pause the animation" : "Play the animation"); };
  btn.addEventListener("click", () => { paused = !paused; setBtn(!paused); if (!cur) return; if (paused) cur.pause(); else if (visible) cur.play(); });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!began && visible && !reduce) { began = true; ready.then(() => { prime(); fit(); setTimeout(() => run(intro()), 450); }); return; }
    if (!cur) return;
    if (visible && !paused) cur.play(); else cur.pause();
  }, { threshold: 0.12 }).observe(root);
  if (reduce) { utils.set([plans, prompt, caret, ...seats], { opacity: 0 }); btn.hidden = true; }
  else ready.then(() => { if (!began) prime(); });
  return { fit };
})();

/* ==================================================== TOUR (real screens) */
// The stage sticks while the chapters scroll past it: the chapter in the middle of the screen plays.
// Every chapter is a real screen of the app, filmed: the camera moves, the pointer clicks.
const player = (() => {
  const root = $("#player"); if (!root) return {};
  const stage = $("#stage"), wrap = $(".stage-wrap", root);
  const steps = $$(".chapters li", root), playBtn = $(".play", root);
  let S = 1, cur = 0, tl = null, userPaused = false, inView = false, replay = null, token = 0;
  const VW = 1728, VH = 1080;
  const fit = () => { S = wrap.clientWidth / VW; stage.style.transform = `scale(${S})`; };
  new ResizeObserver(fit).observe(wrap); fit();

  const camera = () => { const c = document.createElement("div"); c.className = "cam"; stage.appendChild(c); utils.set(c, { x: 0, y: 0, scale: 1 }); return c; };
  // place a screen of size w×h centred in the stage at scale k
  const place = (el, k) => { const [w, h] = SIZES[el.dataset.screen]; utils.set(el, { x: (VW - w * k) / 2, y: (VH - h * k) / 2, scale: k }); el.style.transformOrigin = "0 0"; };
  // the camera looks at a box of the screen (window coordinates) so that it fills the stage
  const look = (box, pad = 1) => { const k = Math.min(VW / box[2], VH / box[3]) * pad; return { scale: k, x: VW / 2 - (box[0] + box[2] / 2) * k, y: VH / 2 - (box[1] + box[3] / 2) * k }; };
  const pointer = () => { const c = document.createElement("div"); c.className = "cursor"; c.innerHTML = FAN; stage.appendChild(c); return c; };
  const toastIn = (tl, text, pos, hold = 1800) => {
    const el = document.createElement("div"); el.className = "htoast"; el.innerHTML = `<i></i><span>${esc(text)}</span>`; stage.appendChild(el);
    tl.add(el, { opacity: [0, 1], y: [-12, 0], duration: 380, ease: "out(3)" }, pos).add(el, { opacity: 0, duration: 300 }, pos + hold);
  };

  const scenes = [
    // 1 · launch a team: ⇧⌘T, the sheet, Lancia
    async tl => {
      const cam = camera(), win = await screenEl("main"), sheet = await screenEl("launch"), dim = document.createElement("div");
      dim.className = "dim"; cam.append(win, dim); stage.appendChild(sheet);
      sheet.classList.add("sheet-win"); utils.set(sheet, { x: (VW - 760) / 2, y: 52 });
      const canvas = block(win, 288, 52), nodes = [24, 352, 800, 24, 452].map((l, i) => block(canvas, l, i < 3 ? 88 : 420)).filter(Boolean);
      const go = byText(sheet, "button", "Lancia 3");
      const c = pointer();
      const gr = go ? rectIn(go, stage, S) : null;
      utils.set(nodes, { opacity: 0, scale: 0.8 }); utils.set(dim, { opacity: 0 });
      utils.set(sheet, { y: 52 - 960 });
      keysHud(tl, ["⇧", "⌘", "T"], 0);
      tl.add(dim, { opacity: [0, 1], duration: 400 }, 700)
        .add(sheet, { y: [52 - 960, 52], duration: 600, ease: "out(4)" }, 700);
      let hit = 2400;
      if (gr) hit = clickAt(tl, c, [1500, 1000], gr.cx, gr.cy, 1500);
      tl.add(sheet, { y: 52 - 980, duration: 480, ease: "in(3)" }, hit + 250)
        .add(dim, { opacity: 0, duration: 400 }, hit + 300)
        .add(nodes, { opacity: [0, 1], scale: [0.8, 1], duration: 650, delay: stagger(120), ease: "outBack(1.6)" }, hit + 600);
      toastIn(tl, UI[lang].hero.launched, hit + 1500);
      tl.call(() => {}, hit + 4200);
    },
    // 2 · agents talk: the overview of a busy workspace, the camera travels along the links
    async tl => {
      const cam = camera(), win = await screenEl("overview"); cam.appendChild(win);
      utils.set(win, { x: 64, y: 40 });
      utils.set(cam, look([0, 0, 1728, 1080], 1));
      const A = look([300, 150, 900, 560]);
      tl.add(cam, { ...A, duration: 2600, ease: "inOut(3)" }, 400);
      // long press on a node: the charge ring fills on the pointer, then the wheel opens around it
      const who = byText(win, "span", "reviewer");
      if (who) {
        const r = rectIn(who, win, S), px = A.x + (64 + r.cx) * A.scale, py = A.y + (40 + r.cy) * A.scale;
        const c = pointer(); c.insertAdjacentHTML("beforeend", HOLD);
        const arc = $(".hold .arc", c), badge = $(".hold", c);
        const [open, pick] = await Promise.all([screenEl("radial-open"), screenEl("radial-pick")]);
        const k = 1.35, wheel = [open, pick];
        wheel.forEach(el => { stage.appendChild(el); el.classList.add("wheel"); el.style.transformOrigin = "240px 160px"; utils.set(el, { x: px - 240, y: py - 160, opacity: 0, scale: 0.4 }); });
        utils.set(arc, { strokeDashoffset: 1 }); utils.set(badge, { opacity: 0 });
        tl.set(c, { x: 1600, y: 1050, opacity: 0, scale: 1 }, 3200).set($$(".f2, .f1", c), { rotate: 0 }, 3200)
          .add(c, { opacity: 1, x: px, y: py, duration: 900, ease: "inOut(3)" }, 3200);
        fanIn(tl, c, 3850);
        tl.add(badge, { opacity: [0, 1], duration: 150 }, 4150)
          .add(arc, { strokeDashoffset: [1, 0], duration: 800, ease: "linear" }, 4150)
          .add(open, { opacity: [0, 1], scale: [0.4, k], duration: 420, ease: "outBack(1.6)" }, 4950)
          .add(badge, { opacity: 0, duration: 150 }, 4950)
          .add(c, { x: px, y: py - 66 * k, duration: 600, ease: "inOut(3)" }, 5600)
          .set(pick, { opacity: 1, scale: k }, 6200).set(open, { opacity: 0 }, 6200)
          .add(c, { scale: [1, 0.8, 1], duration: 240 }, 6600)
          .add(pick, { opacity: 0, scale: k * 0.9, duration: 320, ease: "in(2)" }, 7000)
          .add(c, { opacity: 0, duration: 400 }, 7200);
        toastIn(tl, UI[lang].hero.wheel, 7000);
      }
      tl.add(cam, { ...look([760, 260, 900, 560]), duration: 2800, ease: "inOut(3)" }, 8600)
        .add(cam, { ...look([0, 0, 1728, 1080]), duration: 1600, ease: "inOut(3)" }, 11700);
      packets(tl, win, 600, 12900);
      tl.call(() => {}, 13700);
    },
    // 3 · needs you: the tester asks, the toolbar says so, one click
    async tl => {
      const cam = camera(), win = await screenEl("main"); cam.appendChild(win);
      const canvas = block(win, 288, 52), tester = block(canvas, 24, 420), needs = byText(win, "button", "tester ti aspetta"), allow = byText(tester, "button, span", "Consenti");
      const ring = document.createElement("i"); ring.className = "spot-ring"; cam.appendChild(ring);
      utils.set(ring, { x: 312 - 10, y: 472 - 10, width: 420, height: 280, opacity: 0 });
      tl.add(cam, { ...look([1300, 0, 428, 120], 0.55), duration: 1400, ease: "inOut(3)" }, 300);
      if (needs) tl.add(needs, { scale: [1, 1.1, 1], duration: 600, ease: "out(3)" }, 1500);
      keysHud(tl, ["⌘", "J"], 2000);
      tl.add(cam, { ...look([250, 430, 560, 360]), duration: 1300, ease: "inOut(3)" }, 2700)
        .add(ring, { opacity: [0, 1], duration: 500 }, 3600);
      let hit = 5200;
      if (allow) {
        const A = rectIn(allow, win, S), L = look([250, 430, 560, 360]);
        hit = clickAt(tl, pointer(), [1600, 1050], L.x + A.cx * L.scale, L.y + A.cy * L.scale, 4100);
      }
      tl.add(ring, { opacity: 0, duration: 400 }, hit + 200);
      toastIn(tl, UI[lang].hero.testerOk, hit + 200);
      tl.add(cam, { ...look([0, 0, 1728, 1080]), duration: 1300, ease: "inOut(3)" }, hit + 2200)
        .call(() => {}, hit + 3800);
    },
    // 4 · a worktree per agent: the Git tab of the inspector
    async tl => {
      const cam = camera(), win = await screenEl("main-git"); cam.appendChild(win);
      tl.add(cam, { ...look([1340, 52, 388, 560], 0.95), duration: 1600, ease: "inOut(3)" }, 500)
        .add(cam, { ...look([1340, 500, 388, 560], 0.95), duration: 2600, ease: "inOut(2)" }, 3000)
        .add(cam, { ...look([0, 0, 1728, 1080]), duration: 1500, ease: "inOut(3)" }, 6400)
        .call(() => {}, 8200);
    },
    // 5 · floors: the 3D stack opens, you pick a floor, you go in
    async tl => {
      await sequence(tl, ["floor-live", "floor-open", "floor-hover", "floor-enter", "floor-arrived"], 1.32, 1500);
    },
    // 6 · point at the bug: capture, annotate, comment, fixed
    async tl => {
      await sequence(tl, ["cap-live", "cap-hover", "cap-flash", "cap-annotate", "cap-comment", "cap-fixed"], 2.6, 1300);
    },
  ];
  // the keys you press, shown big at the bottom of the stage
  function keysHud(tl, list, pos) {
    const k = document.createElement("div"); k.className = "keys"; k.innerHTML = list.map(x => `<kbd>${x}</kbd>`).join(""); stage.appendChild(k);
    tl.add(k, { opacity: [0, 1], y: [24, 0], duration: 350, ease: "out(3)" }, pos)
      .add($$("kbd", k), { scale: [1, 0.86, 1], duration: 300, delay: stagger(90), ease: "inOut(2)" }, pos + 350)
      .add(k, { opacity: [1, 0], y: [0, 10], duration: 300 }, pos + 1100);
  }
  // white packets riding the links of a screen
  function packets(tl, scr, from, to) {
    const ps = [...scr.querySelectorAll("svg path")].filter(p => { const st = p.getAttribute("stroke") || ""; return st && st !== "none" && !p.getAttribute("stroke-dasharray") && p.getTotalLength() > 60; });
    ps.forEach((path, i) => {
      const svg = path.ownerSVGElement, c = document.createElementNS(NS, "circle"); c.setAttribute("r", 4.5); c.setAttribute("class", "pkt"); svg.appendChild(c);
      const len = path.getTotalLength(), o = { p: 0 };
      for (let t = from + i * 380; t < to - 900; t += 1700 + i * 90)
        tl.add(o, { p: [0, 1], duration: 900, ease: "inOut(2)", onUpdate: () => { const pt = path.getPointAtLength(o.p * len); c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); c.style.opacity = o.p > 0.02 && o.p < 0.98 ? 1 : 0; } }, t);
    });
  }
  // the phases of a feature, one screen after the other
  async function sequence(tl, names, k, hold) {
    const cam = camera(), els = await Promise.all(names.map(screenEl));
    els.forEach((el, i) => { cam.appendChild(el); place(el, k); utils.set(el, { opacity: i ? 0 : 1 }); });
    els.slice(1).forEach((el, i) => tl.add(el, { opacity: [0, 1], duration: 420, ease: "out(2)" }, 600 + i * hold).add(els[i], { opacity: 0, duration: 420 }, 600 + i * hold + 200));
    tl.add(cam, { ...look([0, 0, VW, VH], 1.05), duration: 600 + names.length * hold, ease: "linear" }, 0)
      .call(() => {}, 600 + (names.length - 1) * hold + 1600);
  }

  const setPlaying = on => { playBtn.dataset.playing = String(on); playBtn.setAttribute("aria-label", on ? "Pause" : "Play"); };
  const NEEDS = [["main", "launch"], ["overview", "radial-open", "radial-pick"], ["main"], ["main-git"],
    ["floor-live", "floor-open", "floor-hover", "floor-enter", "floor-arrived"], ["cap-live", "cap-hover", "cap-flash", "cap-annotate", "cap-comment", "cap-fixed"]];
  async function go(i, play) {
    clearTimeout(replay);
    const my = ++token;
    await Promise.all(NEEDS[i].map(loadScreen));       // once cached, the build below runs without yielding to events
    if (my !== token) return;
    if (tl) tl.pause();
    cur = i;
    steps.forEach((li, j) => { li.classList.toggle("on", j === cur); li.setAttribute("aria-current", j === cur ? "step" : "false"); $(".bar i", li).style.transform = "scaleY(0)"; });
    const bar = $(".bar i", steps[cur]);
    const next = createTimeline({ autoplay: false, onUpdate: self => { bar.style.transform = `scaleY(${self.progress})`; },
      onComplete: () => { if (!reduce) replay = setTimeout(() => { if (cur === i && inView && !userPaused) go(i, true); }, 1600); } });
    stage.innerHTML = "";
    fit();
    await scenes[cur](next);
    if (my !== token) { next.pause(); return; }
    animate(stage, { opacity: [0, 1], duration: 350 });
    tl = next;
    if (reduce) { tl.seek(tl.duration); setPlaying(false); return; }
    if (play && inView && !userPaused) { tl.play(); setPlaying(true); } else setPlaying(false);
  }

  playBtn.addEventListener("click", () => {
    if (!tl) return;
    if (playBtn.dataset.playing === "true") { userPaused = true; tl.pause(); setPlaying(false); }
    else { userPaused = false; if (tl.completed) go(cur, true); else { tl.play(); setPlaying(true); } }
  });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && +e.target.dataset.i !== cur) go(+e.target.dataset.i, true); }),
    { rootMargin: "-46% 0px -46% 0px" });
  steps.forEach(li => {
    io.observe(li);
    li.tabIndex = 0;
    const jump = () => { li.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); if (+li.dataset.i !== cur) go(+li.dataset.i, true); };
    li.addEventListener("click", jump);
    li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(); } });
  });
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (!tl || reduce) return;
    if (inView && !userPaused) { if (tl.completed) go(cur, true); else { tl.play(); setPlaying(true); } }
    else if (!inView) { tl.pause(); setPlaying(false); }
  }, { threshold: 0.25 }).observe(wrap);

  langHooks.push(() => go(cur, inView && !userPaused));
  go(0, false);
  if (reduce) userPaused = true;
  return { go, get tl() { return tl; } };
})();
window.__draftboard = { player };
/* ================================================================= TEAMS */
// Each role's icon and colour, as the app gives them (DS.role: SF Symbols drawn here on a 16 grid).
const ROLES = [
  [/maestro/, "#FCD34D", "M6.5 12a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0V2.5l7 1.8V10.5M13.5 10.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0"],
  [/lead|archit|capo/, "#C4B5FD", "M2.5 13.5 9.5 6.5M8.6 5.6l1.8 1.8M12 1.6v2.6M10.7 2.9h2.6M13.6 6.8v1.8M12.7 7.7h1.8M5.4 2v1.8M4.5 2.9h1.8"],
  [/review|revis/, "#67E8F9", "M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8zM8 6a2 2 0 1 1 0 4a2 2 0 1 1 0-4"],
  [/test|qa/, "#BEF264", "M6 2h4M6.8 2v4.2L3 13.2a.9.9 0 0 0 .8 1.3h8.4a.9.9 0 0 0 .8-1.3L9.2 6.2V2M4.6 10h6.8"],
  [/writ|doc|scritt/, "#CBD5E1", "M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3"],
  [/ricerc|research|spike/, "#A5B4FC", "M8 2a6 6 0 1 1 0 12A6 6 0 1 1 8 2M10.5 5.5L9 9 5.5 10.5 7 7z"],
  [/design|ux|grafic/, "#FDBA74", "M8 2a6 6 0 0 0 0 12c1 0 1.5-.6 1.5-1.3 0-.9-.8-1.2-.8-2 0-.7.6-1.2 1.4-1.2h1.5A2.5 2.5 0 0 0 14 7C14 4.2 11.3 2 8 2zM5 7.4h.01M7 4.8h.01M10.2 4.9h.01"],
  [/cod|dev|svilupp|eng/, "#F9A8D4", "M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3.5l-2 9"],
];
function roleIcon(name) {
  const r = ROLES.find(([re]) => re.test(name.toLowerCase()));
  const [color, d] = r ? [r[1], r[2]] : ["#A1A1A9", "M8 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M3 13.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"];
  return `<span class="role-ic" style="--rc:${color}" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="${d}"/></svg></span>`;
}
(() => {
  const list = $(".team-list"), view = $(".team-view"); if (!list || !view) return;
  const nodesEl = $(".team-nodes", view), svg = $(".team-wires", view), desc = $(".team-desc", view);
  // role, agent, x%, y%
  const L = (r, a, x, y) => ({ r, a, x, y });
  const layouts = [
    { n: [L("leader", "cc", 20, 50), L("coder", "cx", 62, 24), L("reviewer", "cc", 62, 76)], e: [[0, 1], [0, 2], [1, 2]] },
    { n: [L("coder", "cx", 28, 50), L("reviewer", "cc", 72, 50)], e: [[0, 1]] },
    { n: [L("leader", "cc", 20, 50), L("tester", "gm", 62, 24), L("coder", "cx", 62, 76)], e: [[0, 1], [0, 2], [1, 2]] },
    { n: [L("leader", "cc", 13, 50), L("coder-1", "cx", 47, 17), L("coder-2", "cx", 47, 50), L("coder-3", "oc", 47, 83), L("reviewer", "cc", 84, 50)], e: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [3, 4]] },
    { n: [L("leader", "cc", 20, 50), L("researcher", "gm", 62, 24), L("coder", "cx", 62, 76)], e: [[0, 1], [0, 2], [1, 2]] },
    { n: [L("leader", "cc", 13, 50), L("coder", "cx", 44, 22), L("reviewer", "cc", 80, 22), L("tester", "gm", 44, 78), L("writer", "oc", 80, 78)], e: [[0, 1], [0, 3], [1, 2], [3, 2], [2, 4]] },
    { n: [L("leader", "cc", 20, 50), L("designer", "cc", 62, 24), L("coder", "cx", 62, 76)], e: [[0, 1], [0, 2], [1, 2]] },
    { n: [L("leader", "cc", 20, 50), L("+", "", 55, 25), L("+", "", 55, 75), L("+", "", 85, 50)], e: [[0, 1], [0, 2]], custom: true },
  ];
  let cur = 0, timer = null, interacted = false, visible = false, busy = null;

  const renderList = () => {
    list.innerHTML = UI[lang].teams.map((x, i) => `<button type="button" role="tab" aria-selected="${i === cur}" data-i="${i}" class="${i === 7 ? "custom" : ""}"><b>${x[0]}${x[1] ? `<small>${x[1]}</small>` : ""}</b><i class="tbar"></i></button>`).join("");
    $$("button", list).forEach(b => b.addEventListener("click", () => { interacted = true; stop(); show(+b.dataset.i); }));
  };
  const path = (a, b) => { const w = nodesEl.clientWidth / 100, h = nodesEl.clientHeight / 100;
    const ax = a.x * w, ay = a.y * h, bx = b.x * w, by = b.y * h, dx = (bx - ax) / 2;
    return `M${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`; };
  const relayout = () => { svg.setAttribute("viewBox", `0 0 ${nodesEl.clientWidth} ${nodesEl.clientHeight}`);
    const lay = layouts[cur]; $$("path", svg).forEach((p, k) => lay.e[k] && p.setAttribute("d", path(lay.n[lay.e[k][0]], lay.n[lay.e[k][1]]))); };
  new ResizeObserver(relayout).observe(nodesEl);
  function show(i, first) {
    cur = i;
    $$("button", list).forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
    desc.textContent = UI[lang].teams[i][2];
    const lay = layouts[i];
    const old = $$(".tp", nodesEl), oldP = $$("path", svg);
    const build = () => {
      nodesEl.innerHTML = lay.n.map((n, k) => n.r === "+" ? `<div class="tp" style="left:${n.x}%;top:${n.y}%"><div class="tnode plus">+ ${lang === "it" ? "membro" : "member"}</div></div>` :
        `<div class="tp" style="left:${n.x}%;top:${n.y}%"><div class="tnode ${k === 0 ? "lead" : ""}">${roleIcon(n.r)}<b>${n.r}</b><small>${AG[n.a][1]}</small></div></div>`).join("");
      svg.setAttribute("viewBox", `0 0 ${nodesEl.clientWidth} ${nodesEl.clientHeight}`);
      svg.innerHTML = lay.e.map(([a, b]) => `<path pathLength="1" d="${path(lay.n[a], lay.n[b])}"/>`).join("");
      if (reduce) return;
      const tn = $$(".tnode", nodesEl), ps = $$("path", svg);
      utils.set(ps, { strokeDasharray: "1", strokeDashoffset: 1 });
      animate(tn, { opacity: [0, 1], scale: [0.5, 1], duration: 650, delay: stagger(90), ease: "outBack(1.7)" });
      animate(ps, { strokeDashoffset: [1, 0], duration: 600, delay: stagger(80, { start: 250 }), ease: "inOut(2)" });
    };
    if (first || reduce || !old.length) return build();
    if (busy) busy.cancel && busy.cancel();
    animate(oldP, { opacity: 0, duration: 200 });
    busy = animate($$(".tnode", nodesEl), { opacity: 0, scale: 0.7, duration: 220, delay: stagger(30), ease: "in(2)", onComplete: build });
  }
  function tick() {
    if (interacted || reduce) return;
    const b = $(`button[data-i="${cur}"] .tbar`, list);
    timer = animate(b, { scaleX: [0, 1], duration: 3400, ease: "linear", onComplete: () => { b.style.transform = "scaleX(0)"; if (visible && !interacted) { show((cur + 1) % 7); tick(); } } });
  }
  const stop = () => { if (timer) { timer.pause(); const b = $(`button[data-i="${cur}"] .tbar`, list); if (b) b.style.transform = "scaleX(0)"; } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !interacted) { if (!timer) tick(); else timer.play(); } else if (timer) timer.pause(); }, { threshold: 0.3 }).observe(view);
  langHooks.push(() => { stop(); timer = null; renderList(); show(cur, true); if (visible && !interacted) tick(); });
  renderList(); show(0, true);
})();

/* ============================================================ ORCH TERMINAL */
(() => {
  const pre = $("#orch-term"); if (!pre) return;
  let typed = false, run = 0;
  const lineHTML = ([k, s]) => k === "c" ? `<span class="c">${s}</span>` : k === "$" ? `<span class="p">$</span> ${esc(s)}` : s;
  const full = () => (pre.innerHTML = UI[lang].term.map(lineHTML).join("\n") + '\n<span class="p">$</span> <span class="caret"></span>');
  async function play() {
    const id = ++run, lines = UI[lang].term; let out = [];
    for (const ln of lines) {
      if (id !== run) return;
      if (ln[0] === "$") {
        const o = { n: 0 };
        await animate(o, { n: ln[1].length, duration: ln[1].length * 30, ease: "linear", onUpdate: () => { if (id === run) pre.innerHTML = [...out, `<span class="p">$</span> ${esc(ln[1].slice(0, Math.round(o.n)))}<span class="caret"></span>`].join("\n"); } });
        out.push(lineHTML(ln)); await wait(250);
      } else { out.push(lineHTML(ln)); pre.innerHTML = out.join("\n"); await wait(ln[0] === "c" ? 200 : 450); }
    }
    if (id === run) full();
  }
  if (reduce) { full(); langHooks.push(full); return; }
  pre.innerHTML = '<span class="p">$</span> <span class="caret"></span>';
  new IntersectionObserver(([e], ob) => { if (e.isIntersecting) { typed = true; ob.disconnect(); play(); } }, { threshold: 0.5 }).observe(pre);
  langHooks.push(() => { if (typed) { run++; full(); } });
})();


/* ================================================================= BENTO */
// Each tile has a small live picture of the feature. It is drawn in its final state, plays when the tile
// comes into view and pauses when it leaves; with reduced motion it stays still.
(() => {
  const V = () => UI[lang].viz;
  const bez = (p0, p1, p2, p3, k) => { const u = 1 - k; return u * u * u * p0 + 3 * u * u * k * p1 + 3 * u * k * k * p2 + k * k * k * p3; };
  // a packet (and an optional label) riding a cubic curve given in % of the picture
  const rider = (el, html = "") => { const m = document.createElement("div"); m.className = "vz-mover"; m.innerHTML = `<i class="vz-pkt"></i>${html}`; el.appendChild(m); return m; };
  const ride = (tl, el, mover, c, pos, dur = 800) => {
    const o = { k: 0 };
    tl.add(o, { k: [0, 1], duration: dur, ease: "inOut(2)", onUpdate: () => {
      const w = el.clientWidth, hgt = el.clientHeight;
      utils.set(mover, { x: bez(c[0], c[2], c[4], c[6], o.k) * w / 100, y: bez(c[1], c[3], c[5], c[7], o.k) * hgt / 100 });
    } }, pos)
      .add(mover, { opacity: [0, 1], duration: 120 }, pos)
      .add(mover, { opacity: [1, 0], duration: 160 }, pos + dur - 120);
  };
  const svgPath = c => `M${c[0]} ${c[1]} C ${c[2]} ${c[3]}, ${c[4]} ${c[5]}, ${c[6]} ${c[7]}`;
  // Curves are given in % of the picture; drawn in its real pixels so the strokes keep their width.
  const curves = (el, list) => `<svg class="vz-svg">${list.map(c => `<path pathLength="1" data-c="${c.join(" ")}"/>`).join("")}</svg>`;
  const fitCurves = el => {
    const svg = $(".vz-svg", el); if (!svg) return;
    const w = el.clientWidth, h = el.clientHeight;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    $$("path[data-c]", svg).forEach(p => { const c = p.dataset.c.split(" ").map(Number); p.setAttribute("d", svgPath(c.map((v, i) => v * (i % 2 ? h : w) / 100))); });
  };
  // A real panel of the app, scaled into the picture, that slowly scrolls while in view.
  const shot = (name, { k, left = null, top = 12, pan = 0 }) => ({
    build(el) {
      el.innerHTML = ""; el.classList.add("real");
      el._scr = screenEl(name).then(scr => {
        el.appendChild(scr); scr.style.transformOrigin = "0 0";
        const x = left == null ? (el.clientWidth - SIZES[name][0] * k) / 2 : -left * k;
        utils.set(scr, { x, y: top, scale: k }); el._y = top; return scr;
      });
    },
    play(el) {
      const o = { y: 0 };
      return animate(o, { y: [0, -pan], duration: 7000, delay: 600, loopDelay: 900, ease: "inOut(2)", loop: true, alternate: true,
        onUpdate: () => el._scr.then(scr => utils.set(scr, { y: el._y + o.y })) });
    },
  });
  const baton = `<span class="baton"><svg viewBox="0 0 24 24"><path d="M5 19 17 7M15 5l4 4"/></svg></span>`;

  const VIZ = {
    maestro: {
      build(el) {
        const v = V(), C = [[30, 50, 46, 50, 44, 20, 60, 20], [30, 50, 45, 50, 45, 50, 60, 50], [30, 50, 46, 50, 44, 80, 60, 80]];
        el.innerHTML = `${curves(el, C)}
          <span class="vz-chip maestro" style="left:6%;top:50%;translate:0 -50%">${baton}${v.maestro}<small>${v.reads}</small></span>
          ${[["cc", "leader", "opus"], ["cx", "coder", "sonnet"], ["cc", "reviewer", "opus"]].map(([a, n, m], i) => `<span class="vz-chip team" style="left:62%;top:${[20, 50, 80][i]}%;translate:0 -50%"><span class="ag ${a}">${AG[a][0]}</span>${n}<small>${m}</small></span>`).join("")}
          <span class="vz-allow" style="left:9%;top:74%">${v.allow}</span>`;
        el._c = C;
      },
      play(el) {
        const paths = $$("path", el), team = $$(".team", el), allow = $(".vz-allow", el);
        const movers = el._c.map(() => rider(el));
        utils.set(paths, { strokeDasharray: "1 1", strokeDashoffset: 1 });
        const tl = createTimeline({ loop: true, loopDelay: 1600 });
        tl.add(allow, { opacity: [0, 1], scale: [0.6, 1], duration: 400, ease: "outBack(2)" }, 0)
          .add(allow, { scale: [1, 0.88, 1], duration: 260 }, 700)
          .add(paths, { strokeDashoffset: [1, 0], duration: 600, delay: stagger(120), ease: "inOut(2)" }, 900);
        el._c.forEach((c, i) => ride(tl, el, movers[i], c, 1200 + i * 150, 700));
        tl.add(team, { opacity: [0, 1], scale: [0.6, 1], duration: 500, delay: stagger(150), ease: "outBack(1.8)" }, 1800)
          .add([...team, allow], { opacity: 0, duration: 300 }, 4600).add(paths, { strokeDashoffset: 1, duration: 300 }, 4600);
        return tl;
      },
    },
    roles: shot("model", { k: 0.92, pan: 220 }),
    review: shot("fasi", { k: 0.92, pan: 330 }),
    folders: shot("cartelle", { k: 0.6, left: 250, top: 40, pan: 150 }),
    usage: shot("usage", { k: 0.92, pan: 300 }),
    stop: {
      build(el) {
        el.innerHTML = `<div class="stopv"><div class="kk"><kbd>⌃</kbd><kbd>⌘</kbd><kbd>.</kbd></div><div class="dd">${"<i></i>".repeat(5)}</div><div class="msg">${V().paused}</div></div>`;
        utils.set($$(".dd i", el), { backgroundColor: "#5A5A63" });
      },
      play(el) {
        const v = V(), keys = $$("kbd", el), dots = $$(".dd i", el), msg = $(".msg", el);
        const tl = createTimeline({ loop: true, loopDelay: 1200 });
        tl.call(() => { msg.textContent = "…"; }, 0)
          .add(dots, { backgroundColor: ["#5A5A63", "#0A84FF"], duration: 300, delay: stagger(60) }, 0)
          .add(dots, { opacity: [1, 0.45, 1], duration: 900, delay: stagger(120), ease: "inOut(2)" }, 300)
          .add(keys, { scale: [1, 0.86, 1], y: [0, 2, 0], duration: 280, delay: stagger(110), ease: "inOut(2)" }, 1400)
          .add(dots, { backgroundColor: "#5A5A63", duration: 350, delay: stagger(50) }, 1800)
          .call(() => { msg.textContent = v.paused; }, 1900)
          .add(msg, { opacity: [0, 1], y: [6, 0], duration: 350 }, 1900);
        return tl;
      },
    },
    sound: {
      build(el) {
        const v = V(), cls = ["need", "ok", ""];
        el.innerHTML = `<div class="eq">${v.sound.map((n, i) => `<div class="s ${cls[i]}"><div class="b">${"<i></i>".repeat(5)}</div>${n}</div>`).join("")}</div>`;
      },
      play(el) {
        const groups = $$(".eq .b", el);
        const tl = createTimeline({ loop: true, loopDelay: 600 });
        groups.forEach((g, i) => $$("i", g).forEach((bar, j) => tl.add(bar, {
          scaleY: [0.15, utils.random(0.55, 1, 2), utils.random(0.2, 0.6, 2), utils.random(0.45, 0.95, 2), 0.15], duration: 900, ease: "inOut(2)" }, i * 1000 + Math.abs(j - 2) * 50)));
        return tl;
      },
    },
    local: {
      build(el) {
        const v = V();
        el.innerHTML = `<div class="localv"><svg class="lock" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
          <div class="mac">${v.local[0]}</div><div class="orbit">${v.local.slice(1).map(n => `<span>${n}</span>`).join("")}</div></div>`;
        this.place(el, 0);
      },
      place(el, a) {
        const rx = Math.min(150, el.clientWidth * 0.36), ry = 74;
        $$(".orbit span", el).forEach((s, i) => { const k = (a + i * 90) * Math.PI / 180; s.style.translate = `${Math.cos(k) * rx}px ${Math.sin(k) * ry}px`; s.style.zIndex = Math.sin(k) > 0 ? 2 : 0; });
      },
      play(el) { const o = { a: 0 }; return animate(o, { a: 360, duration: 26000, ease: "linear", loop: true, onUpdate: () => this.place(el, o.a) }); },
    },
  };

  $$(".tile[data-viz]").forEach(tile => {
    const kind = tile.dataset.viz, viz = VIZ[kind], el = $(".viz", tile); if (!viz) return;
    let anim = null, visible = false;
    viz.build(el); fitCurves(el);
    new ResizeObserver(() => fitCurves(el)).observe(el);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (reduce) return;
      if (visible && !anim) anim = viz.play.call(viz, el);
      else if (anim) visible ? anim.play() : anim.pause();
    }, { threshold: 0.35 }).observe(tile);
    langHooks.push(() => {
      if (anim) { anim.pause(); anim.revert && anim.revert(); anim = null; }
      $$(".vz-mover", el).forEach(m => m.remove());
      viz.build(el); fitCurves(el);
      if (visible && !reduce) anim = viz.play.call(viz, el);
    });
    // spotlight that follows the pointer
    tile.addEventListener("pointermove", e => { const r = tile.getBoundingClientRect(); tile.style.setProperty("--mx", e.clientX - r.left + "px"); tile.style.setProperty("--my", e.clientY - r.top + "px"); });
  });
})();

/* ============================================================ STATEMENT */
// The sentence lights up word by word as it crosses the screen.
const statement = (() => {
  const el = $(".big-words"); if (!el) return {};
  let words = [];
  const split = () => {
    const text = el.textContent.trim();
    el.innerHTML = text.split(/\s+/).map(w => `<span class="w">${esc(w)}</span>`).join(" ");
    words = $$(".w", el);
    update();
  };
  const update = () => {
    if (reduce) { words.forEach(w => (w.style.opacity = 1)); return; }
    const r = el.getBoundingClientRect(), vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.3)));
    const lit = p * (words.length + 2);
    words.forEach((w, i) => { w.style.opacity = 0.16 + 0.84 * Math.min(1, Math.max(0, lit - i)); });
  };
  let raf = 0;
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  langHooks.push(split);
  split();
  return { update };
})();

/* ================================================================ REVEALS */
function heroTitle(play) {
  const h1 = $(".hero-title");
  h1.style.opacity = 1;
  if (reduce || !play) { if (!$(".caret-end", h1)) h1.insertAdjacentHTML("beforeend", '<i class="caret-end" aria-hidden="true"></i>'); return; }
  const split = splitText(h1, { words: { wrap: "clip" } });
  h1.insertAdjacentHTML("beforeend", '<i class="caret-end" aria-hidden="true"></i>');
  animate(split.words, { y: ["110%", "0%"], duration: 1000, delay: stagger(60, { start: 80 }), ease: "out(4)" });
  animate($(".caret-end", h1), { opacity: [0, 1], scale: [0.4, 1], duration: 500, delay: 80 + split.words.length * 60 + 400, ease: "outBack(2)" });
}
langHooks.push(() => heroTitle(true));

function revealAll() {
  if (reduce) { $$(".reveal, .hero-title").forEach(el => (el.style.opacity = 1)); heroTitle(false); return; }
  heroTitle(true);
  animate($$(".hero .reveal"), { opacity: [0, 1], y: [22, 0], duration: 900, delay: stagger(100, { start: 300 }), ease: "out(3)" });
  animate(".showcase", { opacity: [0, 1], y: [60, 0], duration: 1200, delay: 350, ease: "out(4)" });

  const io = new IntersectionObserver(entries => {
    const shown = entries.filter(e => e.isIntersecting).map(e => e.target);
    shown.forEach(el => io.unobserve(el));
    if (shown.length) animate(shown, { opacity: [0, 1], y: [30, 0], duration: 850, delay: stagger(90), ease: "out(3)" });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach(el => { if (!el.closest(".hero")) io.observe(el); });

  // bento tiles: a staggered entrance
  const tiles = $$(".tile");
  utils.set(tiles, { opacity: 0, y: 40 });
  const tio = new IntersectionObserver(entries => {
    const shown = entries.filter(e => e.isIntersecting).map(e => e.target);
    shown.forEach(el => tio.unobserve(el));
    if (shown.length) animate(shown, { opacity: [0, 1], y: [40, 0], duration: 850, delay: stagger(110), ease: "out(3)" });
  }, { threshold: 0.12 });
  tiles.forEach(el => tio.observe(el));
}

/* ============================================================ SMALL TOUCHES */
function touches() {
  // scroll progress bar, synced to the page scroll
  if (!reduce) animate(".scrollbar i", { scaleX: [0, 1], ease: "linear", autoplay: onScroll({ target: document.body, enter: "top top", leave: "bottom bottom", sync: true }) });
  else $(".scrollbar").style.display = "none";

  // the app window lies back under the title and straightens as you scroll to it
  const tilt = $(".tilt"), sc = $("#showcase");
  if (tilt && !reduce) {
    let raf = 0;
    const upd = () => {
      raf = 0;
      const r = sc.getBoundingClientRect(), vh = innerHeight, start = vh * 0.95, end = vh * 0.12;
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end))), amp = innerWidth < 620 ? 10 : 18;
      tilt.style.transform = `rotateX(${(amp * (1 - p)).toFixed(2)}deg) scale(${(0.94 + 0.06 * p).toFixed(4)})`;
    };
    addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    addEventListener("resize", upd);
    upd();
  }

  // install steps: the line fills as you read
  const line = $(".how-line i");
  if (line && !reduce) animate(line, { scaleY: [0, 1], ease: "linear", autoplay: onScroll({ target: ".how-wrap", enter: "85% top", leave: "45% bottom", sync: 0.4 }) });
  else if (line) line.style.transform = "scaleY(1)";

  // marquee
  const row = $(".marquee-row");
  if (row && !reduce) animate(row, { x: ["0%", "-50%"], duration: 24000, ease: "linear", loop: true });

  // magnetic primary buttons
  if (!reduce && matchMedia("(pointer: fine)").matches) $$(".btn.big").forEach(b => {
    b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); animate(b, { x: (e.clientX - r.left - r.width / 2) * 0.12, y: (e.clientY - r.top - r.height / 2) * 0.25, duration: 300, ease: "out(3)" }); });
    b.addEventListener("pointerleave", () => animate(b, { x: 0, y: 0, duration: 600, ease: "outElastic(1, .5)" }));
  });

  // active nav link
  const links = $$(".links a[href^='#']");
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(a => { const s = $(a.getAttribute("href")); if (s) io.observe(s); });

  ensemble();
}
/* ========================================================== ENSEMBLE (final) */
// The app icon, seated like the launch splash (SplashWindow.swift): the dot grid sweeps in, the seating
// plan is traced, the eight terminals sit down one by one and light up, then your prompt and the
// violet cursor ("it's your turn"). Geometry from AppIcon.swift, on the icon's 1024 grid.
function ensemble() {
  const svg = $(".ensemble"), dots = $(".final .dots"); if (!svg) return;
  const PODIUM = [512, 710];
  const SEATS = [[200, 530, -60], [332, 398, -30], [512, 350, 0], [692, 398, 30], [824, 530, 60], [364, 562, -45], [512, 500, 0], [660, 562, 45]];
  const arc = r => Array.from({ length: 49 }, (_, i) => { const a = (-165 + 150 * i / 48) * Math.PI / 180;
    return `${i ? "L" : "M"}${(PODIUM[0] + r * Math.cos(a)).toFixed(1)} ${(PODIUM[1] + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const ROWS = [360, 210];
  svg.innerHTML = `<defs>${ROWS.map((r, i) => `<mask id="ens-plan${i}" maskUnits="userSpaceOnUse"><path d="${arc(r)}" pathLength="1" fill="none" stroke="#fff" stroke-width="14" stroke-dasharray="1 1"/></mask>`).join("")}</defs>
    <g class="plans">${ROWS.map((r, i) => `<path class="plan" d="${arc(r)}" mask="url(#ens-plan${i})"/>`).join("")}</g>
    ${SEATS.map(([x, y, a]) => `<g class="seat"><g transform="translate(${x} ${y}) rotate(${a})"><rect x="-56" y="-42" width="112" height="84" rx="22"/><path d="M-30 -14 L-14 0 L-30 14 M-2 14 L22 14"/></g></g>`).join("")}
    <path class="prompt" pathLength="1" d="M448 680 L496 724 L448 768"/>
    <rect class="caret" x="520" y="692" width="36" height="66" rx="8"/>`;
  const seats = $$(".seat", svg), glyphs = $$(".seat path", svg), plans = $(".plans", svg), masks = $$("mask path", svg);
  const prompt = $(".prompt", svg), caret = $(".caret", svg);
  if (reduce) { utils.set(plans, { opacity: 0 }); return; }

  utils.set(masks, { strokeDashoffset: 1 });
  utils.set(seats, { opacity: 0, translateY: -26, scale: 0.72 });
  utils.set(glyphs, { opacity: 0 });
  utils.set(prompt, { strokeDasharray: "1 1", strokeDashoffset: 1 });
  utils.set(caret, { opacity: 0 });
  if (dots) dots.style.setProperty("--sweep", "-25%");

  // Splash times (seconds from launch) × 1000 × K: a touch slower than the app, which is waiting to open.
  const K = 1300, at = s => s * K;
  const seat = () => {
    const tl = createTimeline({ autoplay: false });
    if (dots) tl.add(dots, { "--sweep": ["-25%", "100%"], duration: at(0.6), ease: "out(2)" }, at(0.02));
    tl.add(masks, { strokeDashoffset: [1, 0], duration: at(0.45), ease: "inOut(3)" }, at(0.10))
      .add(seats, { opacity: [0, 1], translateY: [-26, 0], scale: [0.72, 1], duration: at(0.24), delay: stagger(at(0.075)), ease: "out(3)" }, at(0.40))
      .add(glyphs, { opacity: [0, 1], duration: at(0.10), delay: stagger(at(0.03)), ease: "out(3)" }, at(1.08))
      .add(plans, { opacity: [1, 0], duration: at(0.40), ease: "linear" }, at(1.30))
      .add(prompt, { strokeDashoffset: [1, 0], duration: at(0.18), ease: "inOut(3)" }, at(1.30))
      .set(caret, { opacity: 1 }, at(1.50))
      .call(() => caret.classList.add("blink"), at(1.50));
    return tl;
  };
  const intro = seat();
  new IntersectionObserver(([e], ob) => { if (!e.isIntersecting) return; ob.disconnect(); intro.play(); }, { threshold: 0.45 }).observe(svg);

  // Conduct it: point at the orchestra and it plays a wave from the middle out, with the fan of the pointer.
  let playing = null;
  const wave = () => {
    if (!intro.completed || playing) return;
    playing = animate(seats, { translateY: [0, -18, 0], duration: 620, delay: stagger(55, { from: "center" }), ease: "inOut(2)", onComplete: () => (playing = null) });
    animate(caret, { scaleY: [1, 1.18, 1], transformOrigin: "50% 100%", duration: 420, delay: 280, ease: "out(3)" });
  };
  svg.addEventListener("pointerenter", wave);
  svg.addEventListener("click", wave);
}


/* ================================================================== BOOT */
revealAll();
touches();
window.__siteReady = true;
