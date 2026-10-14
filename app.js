(() => {
"use strict";

// Chave fixa para as gravações do js-dos: o bundle é criado como blob: (URL diferente em
// cada visita), por isso mapeamos sempre para a mesma chave e as gravações sobrevivem.
// Cada campeonato tem as suas próprias gravações.
const SAVE_KEYS = { BR: "elifoot2-v121-br", PT: "elifoot2-v121-save", custom: "elifoot2-v121-custom" };
// Jogos incluídos no site, por campeonato (o primeiro ficheiro que existir é usado).
const LEAGUES = {
  BR: ["Elifoot_II_v1.21_BR.jsdos", "game/Elifoot_II_v1.21_BR.jsdos"],
  PT: ["Elifoot_II_v1.21.jsdos", "game/Elifoot_II_v1.21.jsdos", "game/elifoot2.zip"],
};
const EXEC_RE = /\.(exe|com|bat)$/i;

const $ = (id) => document.getElementById(id);
const state = { zip: null, source: "", league: "BR", ci: null, props: null, running: false };
window.elifoot = state; // útil para depurar na consola

// ---------- IndexedDB (guarda o zip do jogo neste browser) ----------
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("elifoot-web", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbOp(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction("files", mode).objectStore("files"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const dbGet = (k) => dbOp("readonly", (s) => s.get(k)).catch(() => undefined);
const dbSet = (k, v) => dbOp("readwrite", (s) => s.put(v, k)).catch(() => undefined);
const dbDel = (k) => dbOp("readwrite", (s) => s.delete(k)).catch(() => undefined);

// ---------- UI do ecrã de início ----------
function setStatus(msg, isErr = false) {
  $("status").textContent = msg;
  $("status").classList.toggle("err", isErr);
}

function rankExe(path) {
  const name = path.split("/").pop().toLowerCase();
  if (/^(install|setup|instalar|uninst)/.test(name)) return 0;
  if (/^elifoot2?\.exe$/.test(name)) return 100;
  if (/^elif.*\.(exe|com)$/.test(name)) return 80;
  if (/^elif.*\.bat$/.test(name)) return 60;
  if (/\.(exe|com)$/.test(name)) return 20;
  return 10;
}

async function useZip(bytes, source, preferredExe) {
  setStatus("A ler o ficheiro…");
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("Isto não parece um ficheiro .zip válido.");
  }
  const isBundle = !!zip.file(".jsdos/dosbox.conf");
  const exes = Object.keys(zip.files)
    .filter((p) => !zip.files[p].dir && EXEC_RE.test(p) && !p.startsWith(".jsdos/"))
    .sort((a, b) => rankExe(b) - rankExe(a));
  if (!isBundle && exes.length === 0) {
    throw new Error("Não encontrei nenhum .EXE/.COM/.BAT dentro do zip.");
  }

  state.zip = { bytes, zip, isBundle };
  state.source = source;

  const sel = $("exe");
  sel.innerHTML = "";
  for (const p of exes) sel.add(new Option(p, p));
  if (preferredExe && exes.includes(preferredExe)) sel.value = preferredExe;
  $("exeRow").hidden = isBundle || exes.length < 2;

  $("play").disabled = false;
  $("forget").hidden = source !== "browser";
  $("dropText").innerHTML = "Jogo carregado ✔<br>Queres trocar? Arrasta outro zip ou";
  setStatus("Pronto a jogar!");
}

async function onFile(file) {
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await useZip(bytes, "browser");
    await dbSet("zip", bytes);
    await dbSet("exe", $("exe").value);
  } catch (e) {
    setStatus(e.message, true);
  }
}

$("file").addEventListener("change", (e) => onFile(e.target.files[0]));
$("exe").addEventListener("change", () => state.source === "browser" && dbSet("exe", $("exe").value));
$("forget").addEventListener("click", async () => {
  await dbDel("zip");
  await dbDel("exe");
  location.reload();
});

const drop = $("drop");
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => {
  e.preventDefault();
  drop.classList.add("over");
}));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  onFile(e.dataTransfer.files[0]);
});

// ---------- Construção do bundle js-dos ----------
function dosboxConf(exe) {
  return [
    "[sdl]", "autolock=false", "",
    "[dosbox]", "machine=svga_s3", "memsize=16", "",
    "[cpu]", "core=auto", "cputype=auto", "cycles=auto", "",
    "[render]", "aspect=false", "",
    "[mixer]", "rate=44100", "",
    "[autoexec]", "@echo off", "mount c .", "c:", exe, "",
  ].join("\r\n");
}

// Arranque limpo: no autoexec do pacote tira o texto do js-dos e o eco dos comandos,
// e limpa o ecrã antes de abrir o jogo (só muda o dosbox.conf; os ficheiros do jogo ficam iguais).
async function quietBundle(zip, bytes) {
  const conf = await zip.file(".jsdos/dosbox.conf").async("string");
  const i = conf.toLowerCase().indexOf("[autoexec]");
  if (i < 0) return bytes;
  const lines = conf.slice(i + 10).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .filter((l) => !/^(echo|type)\b/i.test(l) && !/^@?echo (on|off)$/i.test(l));
  const exe = lines.pop();
  const auto = ["@echo off", ...lines, "cls", exe].join("\r\n");
  zip.file(".jsdos/dosbox.conf", conf.slice(0, i) + "[autoexec]\r\n" + auto + "\r\n");
  return zip.generateAsync({ type: "uint8array", compression: "STORE" });
}

async function buildBundle() {
  const { bytes, zip, isBundle } = state.zip;
  if (isBundle) return quietBundle(zip, bytes);

  // Os ficheiros que estão na pasta do executável passam para a raiz de C:,
  // assim não há problemas com nomes de pasta longos ou com espaços.
  const exePath = $("exe").value;
  const dir = exePath.includes("/") ? exePath.slice(0, exePath.lastIndexOf("/") + 1) : "";
  const out = new JSZip();
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = dir && path.startsWith(dir) ? path.slice(dir.length) : path;
    out.file(target, await entry.async("uint8array"));
  }
  out.file(".jsdos/dosbox.conf", dosboxConf(exePath.slice(dir.length).toUpperCase()));
  return out.generateAsync({ type: "uint8array", compression: "STORE" });
}

// ---------- Arranque do emulador ----------
$("play").addEventListener("click", async () => {
  $("play").disabled = true;
  setStatus("A preparar o jogo…");
  let bundle;
  try {
    bundle = await buildBundle();
  } catch (e) {
    setStatus("Erro a preparar o jogo: " + e.message, true);
    $("play").disabled = false;
    return;
  }
  const url = URL.createObjectURL(new Blob([bundle], { type: "application/zip" }));

  $("start").hidden = true;
  $("game").hidden = false;
  $("kbToggle").hidden = false;
  state.running = true;
  if (matchMedia("(pointer: coarse)").matches) showKeys(true);

  state.props = Dos($("dos"), {
    url,
    autoStart: true,
    autoSave: true,
    theme: "dark",
    lang: "en",
    noCursor: false,
    mouseCapture: false,
    imageRendering: "pixelated",
    renderAspect: "4/3",
    fsChanges: { local: true, urlToKey: async () => SAVE_KEYS[state.source === "browser" ? "custom" : state.league] },
    onEvent: (event, arg) => {
      if (event === "ci-ready") state.ci = arg;
    },
  });
  state.props.setNoCloud?.(true);
});

// Avisa antes de fechar a página por engano (ex.: Ctrl+W, que o browser não deixa bloquear).
window.addEventListener("beforeunload", (e) => {
  if (!state.running) return;
  state.props?.save?.();
  e.preventDefault();
  e.returnValue = "";
});

// Impede que o browser roube teclas que o jogo usa (F1–F12, Ctrl+letra, Alt, Tab…).
// O evento continua a chegar ao emulador; só a ação por defeito do browser é cancelada.
function shouldBlock(e) {
  if (/^F([1-9]|1[0-2])$/.test(e.key)) return true;
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  return ["Tab", "Backspace", "Alt", "Control", "ContextMenu", " ", "ArrowUp", "ArrowDown",
    "PageUp", "PageDown", "Home", "End", "Escape"].includes(e.key);
}
["keydown", "keyup"].forEach((t) => window.addEventListener(t, (e) => {
  if (state.running && shouldBlock(e)) e.preventDefault();
}, { capture: true }));

// ---------- Barra de teclas (mobile e desktop) ----------
const mods = new Map(); // keyCode -> "latched" | "locked"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function showKeys(show) {
  $("keys").hidden = !show;
  $("kbToggle").hidden = show || !state.running;
  document.body.classList.toggle("keys-open", show);
  document.body.style.setProperty("--keys-h", show ? $("keys").offsetHeight + "px" : "0px");
  window.dispatchEvent(new Event("resize"));
}

function refreshMods() {
  document.querySelectorAll("[data-mod]").forEach((b) => {
    const m = mods.get(+b.dataset.mod);
    b.classList.toggle("latched", m === "latched");
    b.classList.toggle("locked", m === "locked");
  });
}

// Carrega modificadores + tecla, solta a tecla e depois os modificadores, com pequenas
// pausas para o DOS registar a combinação (essencial para Alt+F4 e afins).
async function sendKeys(keyCodes) {
  const ci = state.ci;
  if (!ci) return;
  const held = [...new Set([...mods.keys(), ...keyCodes])];
  for (const k of held) { ci.sendKeyEvent(k, true); await sleep(30); }
  await sleep(60);
  for (const k of held.reverse()) { ci.sendKeyEvent(k, false); await sleep(20); }
  for (const [k, m] of mods) if (m === "latched") mods.delete(k);
  refreshMods();
}

$("keys").addEventListener("pointerdown", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  e.preventDefault(); // não tira o foco do emulador nem faz zoom
  b.classList.add("down");
  setTimeout(() => b.classList.remove("down"), 120);

  if (b.dataset.mod) {
    const k = +b.dataset.mod;
    const m = mods.get(k);
    if (!m) mods.set(k, "latched");
    else if (m === "latched") mods.set(k, "locked");
    else mods.delete(k);
    refreshMods();
  } else if (b.dataset.key) {
    sendKeys([+b.dataset.key]);
  } else if (b.dataset.combo) {
    sendKeys(b.dataset.combo.split("+").map(Number));
  } else if (b.dataset.action === "combos") {
    $("combos").hidden = !$("combos").hidden;
    showKeys(true);
  } else if (b.dataset.action === "abc") {
    $("abc").hidden = !$("abc").hidden;
    showKeys(true);
  } else if (b.dataset.action === "league") {
    switchLeague();
  } else if (b.dataset.action === "save") {
    saveNow();
  } else if (b.dataset.action === "hide") {
    showKeys(false);
  }
});
$("kbToggle").addEventListener("click", () => showKeys(true));

// Letras e números para combinações Alt/Ctrl/Shift + tecla no telemóvel.
for (const ch of "1234567890QWERTYUIOPASDFGHJKLZXCVBNM") {
  const b = document.createElement("button");
  b.textContent = ch;
  b.dataset.key = ch.charCodeAt(0); // os códigos do js-dos para A–Z e 0–9 são o próprio ASCII
  $("abc").append(b);
}

async function saveNow() {
  const btn = document.querySelector('[data-action="save"]');
  btn.textContent = "⏳";
  let ok = false;
  try { ok = await state.props?.save(); } catch { ok = false; }
  btn.textContent = ok ? "✔" : "✖";
  setTimeout(() => (btn.textContent = "💾"), 1500);
}

// ---------- Carregamento inicial ----------
// O jogo arranca direto, sem ecrã de início. O ecrã só aparece se não houver jogo
// disponível ou se o endereço tiver ?menu (para escolher outro zip, por exemplo).
(async () => {
  const showMenu = new URLSearchParams(location.search).has("menu");
  const ready = await (async () => {
    const saved = await dbGet("zip");
    if (saved) {
      try { await useZip(saved, "browser", await dbGet("exe")); return true; } catch { await dbDel("zip"); }
    }
    let league = "BR";
    try { league = localStorage.getItem("elifoot-league") || "BR"; } catch { /* sem storage */ }
    return (await loadLeague(league)) || (league !== "BR" && (await loadLeague("BR")));
  })();
  if (ready && !showMenu) { $("play").click(); return; }
  $("start").hidden = false;
  if (!ready) setStatus("");
})();

// Troca Brasil ⇄ Portugal: grava o jogo atual e recarrega a página com o outro campeonato.
async function switchLeague() {
  const next = state.league === "PT" ? "BR" : "PT";
  const name = next === "BR" ? "Brasil 2026" : "Portugal 1998/99";
  if (!confirm(`Trocar para o campeonato ${name}? O jogo atual é gravado antes.`)) return;
  try { await state.props?.save(); } catch { /* segue mesmo assim */ }
  try { localStorage.setItem("elifoot-league", next); } catch { /* sem storage */ }
  state.running = false; // sem aviso de "sair da página"
  location.reload();
}

async function loadLeague(league) {
  for (const url of LEAGUES[league] || []) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) continue;
      state.league = league;
      $("league").value = league;
      $("leagueRow").hidden = false;
      await useZip(new Uint8Array(await res.arrayBuffer()), "server");
      return true;
    } catch { /* não existe: tenta o seguinte */ }
  }
  return false;
}

$("league").addEventListener("change", async () => {
  const league = $("league").value;
  try { localStorage.setItem("elifoot-league", league); } catch { /* sem storage */ }
  $("play").disabled = true;
  if (!(await loadLeague(league))) setStatus("Este campeonato não está disponível.", true);
});
})();
