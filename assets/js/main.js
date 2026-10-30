import { animate, createTimeline, stagger, utils, onScroll, splitText, createDraggable } from "./anime.esm.min.js";
import { IT, UI } from "./i18n.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const AG = { cc: ["CC", "Claude Code"], cx: ["CX", "Codex"], gm: ["GM", "Gemini CLI"], oc: ["OC", "OpenCode"] };
const PROMPT = '<span class="p">›</span> ';

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
  try { localStorage.setItem("bashestra.lang", l); } catch (e) {}
  setLangUI();
  langHooks.forEach(fn => fn());
  if (fromUser && !reduce) {
    const h1 = $(".hero-title");
    const split = splitText(h1, { words: { wrap: "clip" } });
    animate(split.words, { y: ["100%", "0%"], duration: 700, delay: stagger(40), ease: "out(4)" });
    animate($$(".sec-head h2, .lede, .sec-head p"), { opacity: [0.2, 1], duration: 500, ease: "out(2)" });
  }
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

/* =================================================================== HERO */
const hero = (() => {
  const board = $("#hero-board"); if (!board) return {};
  const svg = $(".wires", board);
  const N = { L: $("#h-leader"), C: $("#h-coder"), R: $("#h-reviewer") };
  const T = { L: new Term($("pre", N.L), 3), C: new Term($("pre", N.C), 3), R: new Term($("pre", N.R), 3) };
  const mk = () => { const p = document.createElementNS(NS, "path"); svg.appendChild(p); return p; };
  const P = { LC: mk(), LR: mk(), CR: mk() };
  const cursor = $(".cursor", board);

  const box = el => { const b = board.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, b: r.bottom - b.top, cx: r.left - b.left + r.width / 2, cy: r.top - b.top + r.height / 2 }; };
  const curve = (a, c) => {
    // connect the closest sides
    if (c.l > a.r + 10) { const dx = Math.max(24, (c.l - a.r) / 2); return `M${a.r} ${a.cy} C ${a.r + dx} ${a.cy}, ${c.l - dx} ${c.cy}, ${c.l} ${c.cy}`; }
    if (a.l > c.r + 10) { const dx = Math.max(24, (a.l - c.r) / 2); return `M${a.l} ${a.cy} C ${a.l - dx} ${a.cy}, ${c.r + dx} ${c.cy}, ${c.r} ${c.cy}`; }
    if (c.t > a.b) { const dy = Math.max(20, (c.t - a.b) / 2); return `M${a.cx} ${a.b} C ${a.cx} ${a.b + dy}, ${c.cx} ${c.t - dy}, ${c.cx} ${c.t}`; }
    const dy = Math.max(20, (a.t - c.b) / 2); return `M${a.cx} ${a.t} C ${a.cx} ${a.t - dy}, ${c.cx} ${c.b + dy}, ${c.cx} ${c.b}`;
  };
  const draw = () => {
    const L = box(N.L), C = box(N.C), R = box(N.R);
    P.LC.setAttribute("d", curve(L, C)); P.LR.setAttribute("d", curve(L, R)); P.CR.setAttribute("d", curve(C, R));
  };
  new ResizeObserver(draw).observe(board);
  document.fonts && document.fonts.ready.then(draw);

  // drag the nodes around, wires follow
  let zTop = 3;
  Object.values(N).forEach(n => createDraggable(n, { container: board, containerPadding: 6, onGrab: () => { n.style.zIndex = ++zTop; }, onUpdate: draw, onDrag: draw, onSettle: draw, releaseStiffness: 120 }));

  let visible = true, wake = null;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && wake) { wake(); wake = null; } }).observe(board);
  const gate = () => visible ? Promise.resolve() : new Promise(r => (wake = r));
  const step = async ms => { await wait(ms); await gate(); };

  const travel = (path, back = false, dur = 900) => {
    const c = document.createElementNS(NS, "circle"); c.setAttribute("r", 4.5); c.setAttribute("class", "pkt"); svg.appendChild(c);
    path.classList.add("hot");
    const o = { p: 0 };
    return animate(o, { p: 1, duration: dur, ease: "inOut(2)",
      onUpdate: () => { const len = path.getTotalLength(), pt = path.getPointAtLength((back ? 1 - o.p : o.p) * len); c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); },
      onComplete: () => { c.remove(); path.classList.remove("hot"); } });
  };
  const type = (term, text, speed = 32) => {
    term.push(PROMPT); const o = { n: 0 };
    return animate(o, { n: text.length, duration: text.length * speed, ease: "linear",
      onUpdate: () => term.last(PROMPT + `<span class="k">${esc(text.slice(0, Math.round(o.n)))}</span>`) });
  };
  const pulse = el => animate(el, { scale: [1, 1.04, 1], duration: 500, ease: "out(3)" });

  const reset = () => {
    setState(N.L, "working"); setState(N.C, "waiting"); setState(N.R, "waiting");
    T.L.set([t("hdrPlanned"), `<span class="p">›</span> <span class="k">orch tasks</span>  ${t("tasks")}`]);
    T.C.set(["$ git switch orch/coder"]); T.R.set(["$ git switch orch/reviewer"]);
  };
  const finalState = () => {
    setState(N.L, "working"); setState(N.C, "waiting"); setState(N.R, "need");
    T.L.set([`${PROMPT}<span class="k">orch send coder</span>`, '  "Split the parser, add tests"']);
    T.C.set(['<span class="g">✓ 14 tests passed</span>', `${PROMPT}<span class="k">orch send reviewer</span> "Ready"`]);
    T.R.set(['Allow <span class="k">git diff</span>?', '<span class="btnrow"><span class="opt yes">1 Yes</span><span class="opt">2 Always</span><span class="opt">3 No</span></span>']);
  };

  async function loop() {
    for (;;) {
      reset();
      await step(900);
      await type(T.L, 'orch send coder "Split the parser, add tests"');
      await step(200);
      setState(N.L, "waiting");
      await travel(P.LC);
      setState(N.C, "working"); pulse(N.C);
      T.C.push('<span class="p">[orch]</span> leader: Split the parser…');
      await step(700); T.C.push("Running 14 tests…");
      await step(1100); T.C.last('<span class="g">✓ 14 tests passed</span>');
      await step(400);
      await type(T.C, 'orch send reviewer "Ready on orch/coder"');
      await step(200);
      setState(N.C, "waiting");
      await travel(P.CR);
      setState(N.R, "working"); pulse(N.R);
      T.R.push('<span class="p">[orch]</span> coder: Ready on orch/coder');
      await step(900);
      setState(N.R, "need"); pulse(N.R);
      T.R.set(['Allow <span class="k">git diff</span>?', '<span class="btnrow"><span class="opt yes">1 Yes</span><span class="opt">2 Always</span><span class="opt">3 No</span></span>']);
      await step(900);
      // the cursor approves
      const yes = $(".opt.yes", N.R); if (!yes) continue;
      const tb = box(yes), bw = board.clientWidth, bh = board.clientHeight;
      utils.set(cursor, { x: bw * 0.92, y: bh * 0.95, opacity: 0, scale: 1 });
      await animate(cursor, { opacity: 1, x: tb.cx - 4, y: tb.cy - 3, duration: 900, ease: "inOut(3)" });
      await animate(cursor, { scale: [1, 0.82, 1], duration: 260, ease: "out(2)" });
      const rp = document.createElement("i"); rp.className = "ripple"; rp.style.left = tb.cx + "px"; rp.style.top = tb.cy + "px"; board.appendChild(rp);
      animate(rp, { scale: [0.3, 1.6], opacity: [1, 0], duration: 600, ease: "out(3)", onComplete: () => rp.remove() });
      yes.style.background = "var(--accent-fill)";
      await step(250);
      animate(cursor, { opacity: 0, duration: 400, delay: 200 });
      setState(N.R, "working");
      T.R.set(['<span class="g">✓ Allowed</span>', "Reviewing diff…"]);
      await step(1000);
      await type(T.R, 'orch send leader "Approved"');
      setState(N.R, "waiting");
      await travel(P.LR, true);
      setState(N.L, "working"); pulse(N.L);
      T.L.push('<span class="g">✓ merged orch/coder · 3/3 done</span>');
      await step(2400);
    }
  }
  langHooks.push(() => Object.values(N).forEach(n => n.dataset.state && setState(n, n.dataset.state)));
  return { start: () => (reduce ? finalState() : loop()), finalState, nodes: Object.values(N), draw };
})();

/* ============================================================ DEMO PLAYER */
const player = (() => {
  const root = $("#player"); if (!root) return {};
  const stage = $("#stage"), wrap = $(".stage-wrap", root);
  const chaptersEl = $(".chapters", root), playBtn = $(".play", root), cap = $(".caption", root);
  let S = 1, cur = 0, tl = null, userPaused = false, inView = false, started = false;

  const fit = () => { S = wrap.clientWidth / 1000; stage.style.transform = `scale(${S})`; };
  new ResizeObserver(fit).observe(wrap); fit();

  // geometry helpers in stage coordinates
  const at = el => { const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - s.left) / S, y: (r.top - s.top) / S, w: r.width / S, h: r.height / S, cx: (r.left - s.left + r.width / 2) / S, cy: (r.top - s.top + r.height / 2) / S }; };

  // building blocks
  const node = (id, name, ag, x, y, st = "waiting", extra = "") =>
    `<div class="sn ${st}" id="${id}" data-state="${st}" style="left:${x}px;top:${y}px"><header><span class="ag ${ag}">${AG[ag][0]}</span><b>${name}</b><span class="rl">${AG[ag][1]}</span><span class="q">1</span><span class="st"><i></i><em>${label(st)}</em></span></header><pre></pre>${extra}</div>`;
  const chrome = (body, title = "my-app") =>
    `<div class="win"><div class="wt"><span class="tl"><i></i><i></i><i></i></span><span class="ttl">${title}<span class="pchip">P0 · main</span></span><span class="rt"></span></div><div class="wb">${body}</div>
     <div class="keys"></div><div class="toast"><i></i><span></span></div><div class="scur"><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19 5 3Z"/></svg></div><i class="sripple"></i></div>`;
  const sidebar = rows => `<aside class="side"><h6 class="needh">${t("needHead")} <span class="cnt"></span></h6><div class="needs"></div><h6>${t("sessions")}</h6><div class="rows">${
    rows.length ? rows.map(r => `<div class="srow" data-id="${r[0]}"><i class="d ${r[2] === "working" ? "w" : r[2] === "need" ? "n" : ""}"></i>${r[1]}<small>${AG[r[3]][0]}</small></div>`).join("") : `<div class="empty">${t("noSessions")}</div>`}</div></aside>`;
  const wires = list => `<svg class="sw" viewBox="0 0 790 562">${list.map(([id, d]) => `<path id="${id}" pathLength="1" d="${d}"/>`).join("")}</svg>`;

  // timeline helpers
  const keys = (tl, list, pos) => {
    const k = $(".keys", stage);
    k.innerHTML = list.map(x => `<kbd>${x}</kbd>`).join("");
    tl.add(k, { opacity: [0, 1], y: [24, 0], duration: 350, ease: "out(3)" }, pos)
      .add($$("kbd", k), { scale: [1, 0.86, 1], duration: 300, delay: stagger(90), ease: "inOut(2)" }, pos + 350)
      .add(k, { opacity: [1, 0], y: [0, 10], duration: 300 }, pos + 1000);
  };
  const typeTo = (tl, el, text, pos, speed = 34, prefix = "") => {
    const o = { n: 0 };
    tl.add(o, { n: text.length, duration: Math.max(1, text.length * speed), ease: "linear",
      onUpdate: () => { el.innerHTML = prefix + esc(text.slice(0, Math.round(o.n))); } }, pos);
    return pos + text.length * speed;
  };
  const typeCmd = (tl, term, text, pos, speed = 32) => {
    const o = { n: 0 };
    tl.call(() => term.push(PROMPT), pos)
      .add(o, { n: text.length, duration: text.length * speed, ease: "linear",
        onUpdate: () => term.last(PROMPT + `<span class="k">${esc(text.slice(0, Math.round(o.n)))}</span>`) }, pos);
    return pos + text.length * speed;
  };
  const packet = (tl, path, pos, dur = 850, back = false) => {
    const svg = path.ownerSVGElement, c = document.createElementNS(NS, "circle");
    c.setAttribute("r", 6); c.setAttribute("class", "pkt"); svg.appendChild(c);
    const o = { p: 0 }, len = path.getTotalLength();
    tl.call(() => path.classList.add("hot"), pos)
      .add(o, { p: 1, duration: dur, ease: "inOut(2)", onUpdate: () => {
        const pt = path.getPointAtLength((back ? 1 - o.p : o.p) * len);
        c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); c.style.opacity = o.p > 0 && o.p < 1 ? 1 : 0; } }, pos)
      .call(() => path.classList.remove("hot"), pos + dur);
  };
  const drawPaths = (tl, paths, pos, dur = 600, gap = 140) => {
    utils.set(paths, { strokeDasharray: "1", strokeDashoffset: 1 });
    tl.add(paths, { strokeDashoffset: [1, 0], duration: dur, delay: stagger(gap), ease: "inOut(2)" }, pos);
  };
  const pop = (tl, els, pos, gap = 140) => {
    utils.set(els, { opacity: 0, scale: 0.6 });
    tl.add(els, { opacity: [0, 1], scale: [0.6, 1], duration: 650, delay: stagger(gap), ease: "outBack(1.6)" }, pos);
  };
  const toast = (tl, text, pos, hold = 1600) => {
    const el = $(".toast", stage);
    tl.call(() => { $("span", el).textContent = text; }, pos)
      .add(el, { opacity: [0, 1], y: [-14, 0], duration: 350, ease: "out(3)" }, pos)
      .add(el, { opacity: [1, 0], y: [0, -8], duration: 300 }, pos + hold);
  };
  const click = (tl, x, y, pos, from) => {
    const c = $(".scur", stage), r = $(".sripple", stage);
    tl.set(c, { x: from ? from[0] : 900, y: from ? from[1] : 560, opacity: 0, scale: 1 }, pos)
      .add(c, { opacity: 1, x: x - 5, y: y - 3, duration: 800, ease: "inOut(3)" }, pos)
      .add(c, { scale: [1, 0.8, 1], duration: 260 }, pos + 800)
      .set(r, { left: x + "px", top: y + "px" }, pos + 900)
      .add(r, { scale: [0.3, 1.8], opacity: [1, 0], duration: 600, ease: "out(3)" }, pos + 900)
      .add(c, { opacity: [1, 0], duration: 300 }, pos + 1500);
    return pos + 900;
  };
  const press = (tl, el, pos) => tl.add(el, { scale: [1, 0.92, 1], duration: 260, ease: "inOut(2)" }, pos);
  const sideRow = (tl, id, st, pos) => tl.call(() => {
    const row = $(`.srow[data-id="${id}"] .d`, stage); if (row) row.className = "d " + (st === "working" ? "w" : st === "need" ? "n" : "");
  }, pos);
  const state = (tl, el, st, pos) => tl.call(() => setState(el, st), pos);

  /* -------- scenes -------- */
  const W = { L: [60, 200], C: [440, 60], R: [440, 330] };
  const LC = "M330 271 C 385 271, 385 131, 440 131", LR = "M330 271 C 385 271, 385 401, 440 401", CR = "M575 203 C 575 266, 575 266, 575 330";
  const squad = (st = {}) => node("nL", "leader", "cc", ...W.L, st.L || "waiting") + node("nC", "coder", "cx", ...W.C, st.C || "waiting", `<div class="foot">orch/coder</div>`) + node("nR", "reviewer", "cc", ...W.R, st.R || "waiting", `<div class="foot">orch/reviewer</div>`);
  const rows = st => [["nL", "leader", st.L || "waiting", "cc"], ["nC", "coder", st.C || "waiting", "cx"], ["nR", "reviewer", st.R || "waiting", "cc"]];
  const terms = () => ({ L: new Term($("#nL pre", stage)), C: new Term($("#nC pre", stage)), R: new Term($("#nR pre", stage)) });

  const scenes = [
    // 1 · launch a team
    tl => {
      stage.innerHTML = chrome(sidebar([]) + `<div class="cv paper"><div class="world">${wires([["pLC", LC], ["pLR", LR], ["pCR", CR]])}${squad({ L: "working" })}</div>
        <div class="sheet"><h5>${t("launch")}</h5><div class="opts"><i class="sel"></i>${UI[lang].teams.slice(0, 4).map(x => `<div class="opt">${x[0]}<small>${x[1]}</small></div>`).join("")}</div>
        <div class="field"><span class="ph">${t("taskPh")}</span></div><div class="go"><span>${t("launchBtn")}</span></div></div></div>`);
      const sheet = $(".sheet", stage), sel = $(".sel", stage), opts = $$(".sheet .opt", stage), field = $(".field", stage);
      const nodes = $$(".sn", stage), T = terms();
      utils.set(sheet, { y: "-105%" }); utils.set(sel, { y: opts[1].offsetTop });
      keys(tl, ["⇧", "⌘", "T"], 0);
      tl.add(sheet, { y: ["-105%", "0%"], duration: 520, ease: "out(4)" }, 700)
        .add(sel, { y: opts[0].offsetTop, duration: 380, ease: "inOut(3)" }, 1350);
      tl.call(() => { field.innerHTML = ""; }, 1800);
      const end = typeTo(tl, field, t("task"), 1800, 38);
      press(tl, $(".go span", stage), end + 250);
      tl.add(sheet, { y: ["0%", "-105%"], duration: 450, ease: "in(3)" }, end + 600);
      pop(tl, nodes, end + 900);
      drawPaths(tl, $$(".sw path", stage), end + 1350);
      const side = end + 1300;
      tl.call(() => {
        $(".rows", stage).innerHTML = rows({ L: "working" }).map(r => `<div class="srow" data-id="${r[0]}"><i class="d ${r[2] === "working" ? "w" : ""}"></i>${r[1]}<small>${AG[r[3]][0]}</small></div>`).join("");
        animate($$(".srow", stage), { opacity: [0, 1], x: [-16, 0], duration: 450, delay: stagger(110), ease: "out(3)" });
      }, side);
      tl.call(() => T.L.push(`<span class="p">[task]</span> ${esc(t("task"))}`), end + 1700);
      tl.call(() => T.L.push(t("hdrPlanned")), end + 2300);
      tl.call(() => { T.C.push("$ git switch -c orch/coder"); T.R.push("$ git switch -c orch/reviewer"); }, end + 1900);
      toast(tl, `Feature squad · ${UI[lang].teams[0][1]}`, end + 2500);
      tl.call(() => {}, end + 4400);
    },
    // 2 · agents talk
    tl => {
      stage.innerHTML = chrome(sidebar(rows({ C: "working" })) + `<div class="cv paper"><div class="world">${wires([["pLC", LC], ["pLR", LR], ["pCR", CR]])}${squad({ C: "working" })}</div></div>`);
      const T = terms(), L = $("#nL", stage), C = $("#nC", stage), R = $("#nR", stage), q = $("#nC .q", stage);
      T.L.set([t("hdrPlanned")]); T.C.set(["Editing AuthService.swift…"]); T.R.set(["$ git switch -c orch/reviewer"]);
      state(tl, L, "working", 0); sideRow(tl, "nL", "working", 0);
      let p = typeCmd(tl, T.L, 'orch send coder "Auth view + tests"', 400);
      state(tl, L, "waiting", p + 150); sideRow(tl, "nL", "waiting", p + 150);
      packet(tl, $("#pLC", stage), p + 150);
      p += 1000;
      tl.call(() => { q.style.display = "inline-block"; T.L.push(`<span class="g">✓</span> ${t("queued")}: coder`); $("#nC .foot", stage).textContent = `orch/coder · 1 ${t("queued")}`; }, p)
        .add(q, { scale: [0, 1], duration: 450, ease: "outBack(2)" }, p);
      tl.call(() => T.C.push('<span class="g">✓ AuthService.swift saved</span>'), p + 900);
      state(tl, C, "waiting", p + 1400); sideRow(tl, "nC", "waiting", p + 1400);
      tl.add(q, { scale: [1, 0], duration: 300, ease: "in(2)" }, p + 1600)
        .call(() => { q.style.display = "none"; $("#nC .foot", stage).textContent = "orch/coder"; T.C.push('<span class="p">[orch]</span> leader: Auth view + tests'); }, p + 1900);
      state(tl, C, "working", p + 2000); sideRow(tl, "nC", "working", p + 2000);
      tl.call(() => T.C.push("Running 14 tests…"), p + 2500)
        .call(() => T.C.last('<span class="g">✓ 14 tests passed</span>'), p + 3300);
      p = typeCmd(tl, T.C, 'orch send reviewer "Ready on orch/coder"', p + 3700);
      state(tl, C, "waiting", p + 150); sideRow(tl, "nC", "waiting", p + 150);
      packet(tl, $("#pCR", stage), p + 150, 700);
      state(tl, R, "working", p + 900); sideRow(tl, "nR", "working", p + 900);
      tl.call(() => T.R.push('<span class="p">[orch]</span> coder: Ready on orch/coder'), p + 950);
      tl.add(R, { scale: [1, 1.04, 1], duration: 450 }, p + 900);
      tl.call(() => {}, p + 2600);
    },
    // 3 · needs you
    tl => {
      const tester = node("nT", "tester", "gm", 750, 200, "working", `<div class="foot">orch/tester</div>`);
      const actions = `<div class="actions" style="display:none"><span>${t("deny")}</span><span>${t("always")}</span><span class="allow">${t("allow")}</span></div>`;
      stage.innerHTML = chrome(sidebar([...rows({ L: "waiting", C: "working", R: "working" }), ["nT", "tester", "working", "gm"]]) + `<div class="cv paper"><div class="world">${wires([["pLC", LC], ["pLR", LR], ["pCR", CR], ["pCT", "M710 131 C 735 131, 725 271, 750 271"]])}${squad({ C: "working", R: "working" })}${tester}</div>
        <div class="notif"><img src="assets/icon.png" alt=""><div><b>${t("notifTitle")}</b><span>${t("notifBody")}</span></div></div></div>`);
      $("#nR", stage).insertAdjacentHTML("beforeend", actions);
      const world = $(".world", stage), R = $("#nR", stage), notif = $(".notif", stage), act = $(".actions", R);
      const T = terms(), TT = new Term($("#nT pre", stage));
      T.L.set([t("hdrPlanned")]); T.C.set(["Editing LoginView.swift…"]); T.R.set(["Reviewing orch/coder…"]); TT.set(["Writing AuthTests.swift…"]);
      const z0 = { scale: 0.72, x: 30, y: 60 }, z1 = { scale: 1.3, x: 395 - (440 + 135) * 1.3, y: 281 - (330 + 95) * 1.3 };
      // measure the Allow button at the zoomed-in framing
      utils.set(world, z1); act.style.display = "flex";
      const allow = at($(".allow", R));
      act.style.display = "none"; utils.set(world, z0); utils.set(notif, { x: 340, opacity: 0 });
      tl.call(() => {
        setState(R, "need"); act.style.display = "flex";
        T.R.set(["Bash: git push origin orch/reviewer", t("allowQ")]);
        const nd = $(".needs", stage); nd.innerHTML = `<div class="srow hl"><i class="d n"></i>reviewer<small>CC</small></div>`;
        $(".cnt", stage).textContent = "1";
        animate(nd.firstChild, { opacity: [0, 1], x: [-14, 0], duration: 400 });
        animate($(".cnt", stage), { scale: [0, 1], duration: 450, ease: "outBack(2)" });
      }, 700);
      sideRow(tl, "nR", "need", 700);
      tl.add(R, { scale: [1, 1.05, 1], duration: 500 }, 700)
        .add(notif, { x: [340, 0], opacity: [0, 1], duration: 550, ease: "out(4)" }, 1200);
      keys(tl, ["⌘", "J"], 2300);
      tl.add(notif, { x: [0, 340], opacity: [1, 0], duration: 400, ease: "in(2)" }, 2900)
        .add(world, { scale: [z0.scale, z1.scale], x: [z0.x, z1.x], y: [z0.y, z1.y], duration: 900, ease: "inOut(3)" }, 3000);
      const c = click(tl, allow.cx, allow.cy, 4000, [880, 540]);
      tl.call(() => {
        setState(R, "working"); act.style.display = "none"; T.R.push('<span class="g">✓ Allowed</span>');
        $(".needs", stage).innerHTML = ""; $(".cnt", stage).textContent = "";
      }, c + 150);
      sideRow(tl, "nR", "working", c + 150);
      toast(tl, t("approved"), c + 300, 1700);
      tl.call(() => T.R.push('<span class="g">✓ pushed orch/reviewer</span>'), c + 1000)
        .add(world, { scale: [z1.scale, z0.scale], x: [z1.x, z0.x], y: [z1.y, z0.y], duration: 900, ease: "inOut(3)" }, c + 1500)
        .call(() => {}, c + 3000);
    },
    // 4 · worktrees & git
    tl => {
      const lanes = [
        ["gM", "M40 10 V 470", "var(--text3)"],
        ["gC", "M40 60 C 40 100, 140 90, 140 130 V 350", "var(--cx)"],
        ["gR", "M40 130 C 40 170, 240 160, 240 200 V 300", "var(--cc)"],
        ["gT", "M40 200 C 40 240, 340 230, 340 270 V 330", "var(--gm)"],
        ["gX", "M140 350 C 140 395, 40 385, 40 430", "var(--cx)"],
      ];
      const dots = [[40, 30, "var(--text3)"], [40, 100, "var(--text3)"], [140, 170, "var(--cx)"], [140, 230, "var(--cx)"], [140, 300, "var(--cx)"], [240, 230, "var(--cc)"], [240, 280, "var(--cc)"], [340, 300, "var(--gm)"]];
      const labels = [[150, 135, "orch/coder", "var(--cx)"], [250, 205, "orch/reviewer", "var(--cc)"], [350, 275, "orch/tester", "var(--gm)"], [52, 22, "main", "var(--text2)"]];
      const files = [["AuthView.swift", 128, 4], ["AuthService.swift", 64, 12], ["AuthTests.swift", 92, 0]];
      stage.innerHTML = chrome(`<div class="git"><div class="gl"><h6>Git</h6><svg viewBox="0 0 520 480">${
        lanes.map(([id, d, c]) => `<path id="${id}" pathLength="1" d="${d}" stroke="${c}"/>`).join("")}${
        dots.map(([x, y, c]) => `<circle class="cm" cx="${x}" cy="${y}" r="8" fill="${c}"/>`).join("")}<circle class="mg" cx="40" cy="430" r="10" fill="var(--cx)"/>${
        labels.map(([x, y, s, c]) => `<text class="tag" x="${x}" y="${y}" fill="${c}">${s}</text>`).join("")}</svg></div>
        <div class="gr"><h6>${t("files")}</h6>${files.map(f => `<div class="file"><span class="fn">${f[0]}</span><span class="add">+<b data-n="${f[1]}">0</b></span><span class="del">−<b data-n="${f[2]}">0</b></span></div>`).join("")}
        <div class="diff"><div class="r">-  Button("Sign in") { login() }</div><div class="a">+  SignInWithAppleButton(.signIn) {</div><div class="a">+    $0.requestedScopes = [.email]</div><div class="a">+  } onCompletion: auth.handle</div><div class="a">+    .frame(height: 44)</div></div>
        <div class="commit"><div class="msg"></div><span class="b">${t("commit")}</span><span class="b push">${t("push")}</span></div></div></div>`, "my-app — Git");
      const paths = $$(".git path", stage);
      drawPaths(tl, paths.slice(0, 1), 100, 700);
      drawPaths(tl, paths.slice(1, 4), 500, 700, 250);
      utils.set(paths[4], { strokeDasharray: "1", strokeDashoffset: 1 });
      const cms = $$(".cm", stage), tags = $$(".tag", stage), mg = $(".mg", stage);
      utils.set([...cms, mg], { scale: 0, transformOrigin: "50% 50%", transformBox: "fill-box" });
      utils.set(tags, { opacity: 0 });
      tl.add(cms, { scale: [0, 1], duration: 450, delay: stagger(110), ease: "outBack(2)" }, 900)
        .add(tags, { opacity: [0, 1], duration: 400, delay: stagger(120) }, 1100);
      utils.set($$(".file, .diff div", stage), { opacity: 0 });
      tl.add($$(".file", stage), { opacity: [0, 1], x: [20, 0], duration: 400, delay: stagger(120) }, 600);
      $$(".file b", stage).forEach((b, i) => {
        const o = { v: 0 }, n = +b.dataset.n;
        tl.add(o, { v: n, duration: 900, ease: "out(3)", onUpdate: () => (b.textContent = Math.round(o.v)) }, 800 + i * 120);
      });
      tl.add($$(".diff div", stage), { opacity: [0, 1], x: [-10, 0], duration: 300, delay: stagger(90) }, 1500);
      const end = typeTo(tl, $(".msg", stage), t("commitMsg"), 2500, 36);
      const [bc, bp] = $$(".commit .b", stage);
      press(tl, bc, end + 200);
      tl.call(() => { bc.textContent = "✓ " + t("commit"); }, end + 450);
      press(tl, bp, end + 900);
      tl.add(paths[4], { strokeDashoffset: [1, 0], duration: 700, ease: "inOut(2)" }, end + 1100)
        .add(mg, { scale: [0, 1.25, 1], duration: 600, ease: "out(3)" }, end + 1700)
        .call(() => { bp.textContent = "✓ " + t("push"); }, end + 1100);
      toast(tl, t("pushed") + " · orch/coder", end + 1300, 1700);
      tl.call(() => {}, end + 3400);
    },
    // 5 · floors
    tl => {
      const mini = n => Array.from({ length: n }, (_, i) => `<i class="mini" style="left:${30 + (i % 3) * 96}px;top:${54 + Math.floor(i / 3) * 70}px"></i>`).join("");
      stage.innerHTML = chrome(`<div class="floors"><div class="fl3d"><div class="stack">
          <div class="plane" id="P0"><b>P0</b>${mini(5)}</div><div class="plane" id="P1"><b>P1</b>${mini(4)}</div><div class="plane" id="P2"><b>P2</b>${mini(5)}</div></div>
          <span class="bchip" id="ch1">floor/P2/orch/coder</span><span class="bchip" id="ch2">floor/P2/orch/tester</span></div>
        <div class="fr"><h6>${t("floors")}</h6>
          <div class="frow" data-f="0"><b>P0</b>main<small>${t("original")}</small></div>
          <div class="frow" data-f="1"><b>P1</b>try-swiftdata<small>2 ahead</small></div>
          <div class="frow" data-f="2" style="opacity:0"><b>P2</b>auth-v2<small>${t("cloned")}</small></div>
          <div class="commit" style="margin-top:auto"><span class="b push" style="flex:1;text-align:center">${t("newFloor")}</span><span class="b" style="flex:1;text-align:center">${t("bring")}</span></div></div></div>`, "my-app — Floors");
      const P = ["#P0", "#P1", "#P2"].map(s => $(s, stage)), rowsF = $$(".frow", stage);
      const zs = [0, 95, 190];
      // measure where P2 and P0 will sit once spread, for the flying branch chips
      utils.set(P, { z: (_, i) => zs[i], opacity: 1 });
      const fl = $(".fl3d", stage), base = at(fl), p2 = at(P[2]), p0 = at(P[0]);
      utils.set(P, { z: (_, i) => [0, 18, 420][i], opacity: (_, i) => (i === 2 ? 0 : 1) });
      keys(tl, ["⇧", "⌘", "F"], 0);
      tl.add(P.slice(0, 2), { z: (_, i) => zs[i], duration: 900, ease: "out(4)" }, 600);
      const [bNew, bBring] = $$(".fr .b", stage);
      press(tl, bNew, 1600);
      tl.add(P[2], { z: [420, zs[2]], opacity: [0, 1], duration: 900, ease: "outBack(1.2)" }, 1800)
        .add(rowsF[2], { opacity: [0, 1], x: [16, 0], duration: 400 }, 2300);
      [[0, 2900], [1, 3300], [2, 3700]].forEach(([i, at2]) => tl.call(() => { P.forEach((p, j) => p.classList.toggle("sel", j === i)); rowsF.forEach((r, j) => r.classList.toggle("on", j === i)); }, at2));
      tl.call(() => { $("small", rowsF[2]).textContent = t("ahead"); }, 4000);
      press(tl, bBring, 4400);
      const chips = [$("#ch1", stage), $("#ch2", stage)];
      chips.forEach((ch, i) => {
        tl.set(ch, { left: p2.cx - base.x - 70, top: p2.y - base.y + 40 + i * 26, opacity: 0, x: 0, y: 0 }, 4500)
          .add(ch, { opacity: [0, 1], duration: 250 }, 4600 + i * 150)
          .add(ch, { y: (p0.y - p2.y) + 70, x: (p0.cx - p2.cx), duration: 1000, ease: "inOut(3)" }, 4800 + i * 150);
      });
      tl.call(() => { P.forEach((p, j) => p.classList.toggle("sel", j === 0)); rowsF.forEach((r, j) => r.classList.toggle("on", j === 0)); }, 5800)
        .add(P[0], { scale: [1, 1.04, 1], duration: 500 }, 5800);
      toast(tl, `${t("bring")} · 2 branches`, 5900, 1500);
      tl.call(() => {}, 7600);
    },
    // 6 · point at the bug
    tl => {
      const portal = `<div class="portal" id="portal"><div class="bar"><span class="tl"><i></i><i></i><i></i></span><span class="url">localhost:3000/login</span></div>
        <div class="page"><h4>${t("signin")}</h4><p>${t("signinSub")}</p><div class="pbtn apple"> ${t("apple")}</div><div class="or">${t("or")}</div><div class="inp">${t("email")}</div><div class="pbtn mail">${t("cont")}</div>
        <div class="mark"><svg><rect x="1.5" y="1.5" rx="11" pathLength="1" fill="none" stroke="var(--accent-fill)" stroke-width="3"/></svg></div><span class="pin">1</span><div class="note"></div>
        <div class="anbar"><span>${t("element")}</span><span class="on">${t("box")}</span><span>${t("arrow")}</span><span>${t("pen")}</span><span>${t("text")}</span><span class="send">${t("send")}</span></div></div><div class="flash"></div></div>`;
      stage.innerHTML = chrome(`<div class="cv paper"><div class="world">${wires([["pPC", "M494 272 C 567 272, 567 231, 640 231"]])}${portal}${node("nC", "coder", "cx", 640, 160, "waiting", `<div class="foot">orch/coder</div>`)}</div></div>`);
      const page = $(".page", stage), apple = $(".apple", stage), mark = $(".mark", stage), rect = $(".mark rect", stage), pin = $(".pin", stage), note = $(".note", stage), bar = $(".anbar", stage), flash = $(".flash", stage);
      const C = $("#nC", stage), T = new Term($("#nC pre", stage));
      T.set(["$ git switch -c orch/coder", "Waiting for tasks…"]);
      $(".mark rect", stage).style.strokeDasharray = "1";
      // place the mark around the off-center button
      const ax = apple.offsetLeft, ay = apple.offsetTop, aw = apple.offsetWidth, ah = apple.offsetHeight;
      Object.assign(mark.style, { left: ax - 10 + "px", top: ay - 10 + "px", width: aw + 20 + "px", height: ah + 20 + "px", border: "0" });
      rect.setAttribute("width", aw + 20 - 3); rect.setAttribute("height", ah + 20 - 3);
      Object.assign(pin.style, { left: ax - 22 + "px", top: ay - 24 + "px" });
      Object.assign(note.style, { left: ax + 16 + "px", top: ay + ah + 18 + "px" });
      utils.set(rect, { strokeDashoffset: 1 });
      keys(tl, ["⌃", "⌘", "C"], 0);
      tl.add(flash, { opacity: [0, 0.85, 0], duration: 450, ease: "out(2)" }, 700)
        .add(bar, { opacity: [0, 1], y: [16, 0], duration: 400, ease: "out(3)" }, 1000)
        .add(rect, { strokeDashoffset: [1, 0], duration: 700, ease: "inOut(2)" }, 1500)
        .add(pin, { opacity: [0, 1], scale: [0, 1], duration: 450, ease: "outBack(2.4)" }, 2200)
        .add(note, { opacity: [0, 1], y: [-6, 0], duration: 300 }, 2500);
      const end = typeTo(tl, note, t("note"), 2650, 40, "1 · ");
      const send = at($(".anbar .send", stage));
      const c = click(tl, send.cx, send.cy, end + 200, [700, 520]);
      packet(tl, $("#pPC", stage), c + 150, 800);
      state(tl, C, "working", c + 950);
      tl.add(C, { scale: [1, 1.04, 1], duration: 450 }, c + 950)
        .call(() => { T.push(`<span class="p">[capture #1]</span> ${esc(t("note"))}`); T.push("attached capture-1.png · 1 mark"); }, c + 1000);
      toast(tl, t("sent"), c + 1100, 1700);
      tl.call(() => T.push("Fixing LoginView.swift…"), c + 1900)
        .call(() => {}, c + 3400);
    },
  ];

  // chapter tabs
  const renderTabs = () => {
    chaptersEl.innerHTML = UI[lang].chapters.map((c, i) => `<li><button type="button" role="tab" aria-selected="${i === cur}" data-i="${i}" class="${i < cur ? "done" : ""}"><span class="n">0${i + 1}</span><span class="t">${c[0]}</span><span class="bar"><i></i></span></button></li>`).join("");
    $$("button", chaptersEl).forEach(b => b.addEventListener("click", () => { userPaused = false; go(+b.dataset.i, true); }));
  };
  const caption = () => { const c = UI[lang].chapters[cur]; $("b", cap).textContent = c[0]; $("span", cap).textContent = c[1]; };
  const setPlaying = on => { playBtn.dataset.playing = String(on); playBtn.setAttribute("aria-label", on ? "Pause" : "Play"); };

  function go(i, play) {
    if (tl) { tl.pause(); tl.revert && tl.revert(); }
    cur = (i + scenes.length) % scenes.length;
    $$("button", chaptersEl).forEach((b, j) => { b.setAttribute("aria-selected", String(j === cur)); b.classList.toggle("done", j < cur); $(".bar i", b).style.transform = j < cur ? "scaleX(1)" : "scaleX(0)"; });
    caption();
    const bar = $(`button[data-i="${cur}"] .bar i`, chaptersEl);
    tl = createTimeline({ autoplay: false, onUpdate: self => { bar.style.transform = `scaleX(${self.progress})`; }, onComplete: () => { if (!reduce) go(cur + 1, true); else setPlaying(false); } });
    scenes[cur](tl);
    fit();
    const btn = $(`button[data-i="${cur}"]`, chaptersEl);
    if (btn && chaptersEl.scrollWidth > chaptersEl.clientWidth) chaptersEl.scrollTo({ left: btn.parentElement.offsetLeft - 16, behavior: reduce ? "auto" : "smooth" });
    if (play && inView && !userPaused) { tl.play(); setPlaying(true); }
    else setPlaying(false);
    if (!play && reduce) tl.seek(tl.duration);
  }

  playBtn.addEventListener("click", () => {
    if (!tl) return;
    if (playBtn.dataset.playing === "true") { userPaused = true; tl.pause(); setPlaying(false); }
    else { userPaused = false; if (tl.completed) go(cur, true); else { tl.play(); setPlaying(true); } }
  });
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (!tl) return;
    if (inView && !userPaused && !reduce) {
      if (!started) { started = true; go(cur, true); } else { tl.play(); setPlaying(true); }
    } else if (!inView) { tl.pause(); setPlaying(false); }
  }, { threshold: 0.35 }).observe(stage.parentElement);

  langHooks.push(() => { renderTabs(); go(cur, !userPaused && inView && !reduce); });
  renderTabs();
  go(0, false);
  if (reduce) userPaused = true;

  // feature cards jump to their chapter
  $$(".card[data-chapter] .watch").forEach(b => b.addEventListener("click", () => {
    const i = +b.closest(".card").dataset.chapter;
    $("#demo").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    userPaused = false; started = true; inView = true; go(i, true);
  }));
  return { go, get tl() { return tl; } };
})();
window.__bashestra = { player };

/* ================================================================= TEAMS */
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
    { n: [L("leader", "cc", 20, 50), L("+", "", 55, 25), L("+", "", 55, 75), L("+", "", 85, 50)], e: [[0, 1], [0, 2]], custom: true },
  ];
  let cur = 0, timer = null, interacted = false, visible = false, busy = null;

  const renderList = () => {
    list.innerHTML = UI[lang].teams.map((x, i) => `<button type="button" role="tab" aria-selected="${i === cur}" data-i="${i}" class="${i === 6 ? "custom" : ""}"><b>${x[0]}${x[1] ? `<small>${x[1]}</small>` : ""}</b><i class="tbar"></i></button>`).join("");
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
        `<div class="tp" style="left:${n.x}%;top:${n.y}%"><div class="tnode ${k === 0 ? "lead" : ""}"><span class="ag ${n.a}">${AG[n.a][0]}</span><b>${n.r}</b>${k === 0 ? `<span class="crown">${t("lead") === n.r ? "★" : "★ " + t("lead")}</span>` : `<small>${AG[n.a][1]}</small>`}</div></div>`).join("");
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
    timer = animate(b, { scaleX: [0, 1], duration: 3400, ease: "linear", onComplete: () => { b.style.transform = "scaleX(0)"; if (visible && !interacted) { show((cur + 1) % 6); tick(); } } });
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

/* ================================================================ REVEALS */
function revealAll() {
  if (reduce) { $$(".reveal, .hero-title").forEach(el => (el.style.opacity = 1)); return; }
  // hero first
  const h1 = $(".hero-title");
  h1.style.opacity = 1;
  const split = splitText(h1, { words: { wrap: "clip" } });
  animate(split.words, { y: ["110%", "0%"], duration: 1000, delay: stagger(70, { start: 100 }), ease: "out(4)" });
  animate($$(".hero .reveal"), { opacity: [0, 1], y: [26, 0], duration: 900, delay: stagger(110, { start: 350 }), ease: "out(3)" });
  if (hero.nodes) animate(hero.nodes, { opacity: [0, 1], scale: [0.7, 1], duration: 800, delay: stagger(160, { start: 800 }), ease: "outBack(1.5)", onUpdate: hero.draw });

  const io = new IntersectionObserver(entries => {
    const shown = entries.filter(e => e.isIntersecting).map(e => e.target);
    shown.forEach(el => io.unobserve(el));
    if (shown.length) animate(shown, { opacity: [0, 1], y: [30, 0], duration: 850, delay: stagger(90), ease: "out(3)" });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach(el => { if (!el.closest(".hero")) io.observe(el); });

  // feature cards: staggered grid entrance
  const cards = $$(".card");
  utils.set(cards, { opacity: 0, y: 40 });
  new IntersectionObserver(([e], ob) => { if (!e.isIntersecting) return; ob.disconnect();
    animate(cards, { opacity: [0, 1], y: [40, 0], duration: 800, delay: stagger(90, { grid: [3, 2], from: "first" }), ease: "out(3)" });
  }, { threshold: 0.1 }).observe($(".grid"));
}

/* ============================================================ SMALL TOUCHES */
function touches() {
  // scroll progress bar, synced to the page scroll
  if (!reduce) animate(".scrollbar i", { scaleX: [0, 1], ease: "linear", autoplay: onScroll({ target: document.body, enter: "top top", leave: "bottom bottom", sync: true }) });
  else $(".scrollbar").style.display = "none";

  // install steps: the line fills as you read
  const line = $(".how-line i");
  if (line && !reduce) animate(line, { scaleY: [0, 1], ease: "linear", autoplay: onScroll({ target: ".how-wrap", enter: "85% top", leave: "45% bottom", sync: 0.4 }) });
  else if (line) line.style.transform = "scaleY(1)";

  // marquee
  const row = $(".marquee-row");
  if (row && !reduce) animate(row, { x: ["0%", "-50%"], duration: 22000, ease: "linear", loop: true });

  // stats count up
  $$(".stat b[data-count]").forEach(b => {
    const n = +b.dataset.count; if (reduce || !n) return;
    b.textContent = "0";
    new IntersectionObserver(([e], ob) => { if (!e.isIntersecting) return; ob.disconnect();
      const o = { v: 0 }; animate(o, { v: n, duration: 1400, ease: "out(3)", onUpdate: () => (b.textContent = Math.round(o.v)) });
      animate(b, { scale: [0.8, 1], duration: 900, ease: "outBack(2)" });
    }, { threshold: 0.6 }).observe(b);
  });

  // card spotlight + icon wiggle
  $$(".card").forEach(c => {
    c.addEventListener("pointermove", e => { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); });
    if (!reduce) c.addEventListener("pointerenter", () => animate($(".ic", c), { rotate: [0, -10, 8, 0], scale: [1, 1.12, 1], duration: 600, ease: "out(3)" }));
  });

  // magnetic primary buttons
  if (!reduce && matchMedia("(pointer: fine)").matches) $$(".btn.big").forEach(b => {
    b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); animate(b, { x: (e.clientX - r.left - r.width / 2) * 0.12, y: (e.clientY - r.top - r.height / 2) * 0.25, duration: 300, ease: "out(3)" }); });
    b.addEventListener("pointerleave", () => animate(b, { x: 0, y: 0, duration: 600, ease: "outElastic(1, .5)" }));
  });

  // active nav link
  const links = $$(".links a[href^='#']");
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(a => { const s = $(a.getAttribute("href")); if (s) io.observe(s); });

  // final: icon float + drifting constellation of nodes
  if (!reduce) animate(".final-icon", { y: [-8, 8], rotate: [-3, 3], duration: 3200, alternate: true, loop: true, ease: "inOut(2)" });
  const svg = $(".constellation"); if (!svg) return;
  const W = 1200, H = 520; svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  const pts = [[90, 90], [230, 300], [120, 440], [360, 140], [300, 470], [880, 110], [1010, 300], [1120, 120], [940, 450], [1100, 470], [820, 290], [400, 330]];
  const edges = [[0, 3], [0, 1], [1, 2], [1, 11], [3, 11], [4, 11], [5, 7], [5, 10], [6, 7], [6, 10], [6, 9], [8, 10], [8, 9]];
  svg.innerHTML = edges.map(() => "<line/>").join("") + pts.map((p, i) => `<circle r="${i % 4 === 0 ? 7 : 5}" class="${i % 5 === 0 ? "o" : ""}"/>`).join("");
  const ls = $$("line", svg), cs = $$("circle", svg), P = pts.map(([x, y]) => ({ x, y }));
  const render = () => { cs.forEach((c, i) => { c.setAttribute("cx", P[i].x); c.setAttribute("cy", P[i].y); });
    ls.forEach((l, i) => { const [a, b] = edges[i]; l.setAttribute("x1", P[a].x); l.setAttribute("y1", P[a].y); l.setAttribute("x2", P[b].x); l.setAttribute("y2", P[b].y); }); };
  render();
  if (reduce) return;
  P.forEach((p, i) => animate(p, { x: p.x + utils.random(-40, 40), y: p.y + utils.random(-30, 30), duration: utils.random(4000, 7000), delay: i * 120, alternate: true, loop: true, ease: "inOut(2)", onUpdate: i === 0 ? render : undefined }));
}

/* ================================================================== BOOT */
revealAll();
touches();
if (hero.start) hero.start();
window.__siteReady = true;
