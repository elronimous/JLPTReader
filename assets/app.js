const state = { config: null, parts: [] };
function el(id){ return document.getElementById(id); }
function partFilename(id){ return `part-${String(id).padStart(4,"0")}.json`; }

async function tryFetchJson(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

async function loadConfig(){
  const cfg = await tryFetchJson("./site.json");
  return cfg || { storyTitle:"Story", storySubtitle:"", partsPath:"./parts", scan:{ startId:1, maxId:3000, stopAfterConsecutiveMissing:25 } };
}

async function scanParts(){
  const { partsPath, scan } = state.config;
  const startId = Number(scan?.startId ?? 1);
  const maxId = Number(scan?.maxId ?? 3000);
  const stopAfter = Number(scan?.stopAfterConsecutiveMissing ?? 25);

  const parts = [];
  let missing = 0;

  for (let id = startId; id <= maxId; id++){
    const url = `${partsPath}/${partFilename(id)}`;
    const data = await tryFetchJson(url);

    if (!data){
      missing++;
      if (missing >= stopAfter) break;
      continue;
    }
    missing = 0;
    data.id = Number(data.id ?? id);
    parts.push(data);
  }
  parts.sort((a,b) => a.id - b.id);
  return parts;
}

function clampRange(start, end, min, max){
  let s = Math.max(min, Math.min(max, start));
  let e = Math.max(min, Math.min(max, end));
  if (s > e) [s, e] = [e, s];
  return [s, e];
}

function setOptions(parts){
  const startSel = el("startSel");
  const endSel = el("endSel");
  startSel.innerHTML = "";
  endSel.innerHTML = "";

  for (const p of parts){
    const o1 = document.createElement("option");
    o1.value = p.id;
    o1.textContent = `${p.id}: ${p.title}`;
    startSel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = p.id;
    o2.textContent = `${p.id}: ${p.title}`;
    endSel.appendChild(o2);
  }
  startSel.value = parts[0].id;
  endSel.value = parts[parts.length - 1].id;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderRange(startId, endId){
  const parts = state.parts;
  if (!parts.length) return;

  const min = parts[0].id;
  const max = parts[parts.length - 1].id;
  const [s, e] = clampRange(Number(startId), Number(endId), min, max);

  el("startSel").value = String(s);
  el("endSel").value = String(e);

  const out = el("content");
  out.innerHTML = "";

  for (const p of parts){
    if (p.id < s || p.id > e) continue;

    const card = document.createElement("section");
    card.className = "card";

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("p");
    title.className = "part-title";
    title.textContent = p.title;

    meta.appendChild(title);

    const tgLine = document.createElement("p");
    tgLine.className = "grammar";
    tgLine.innerHTML = `Target grammar: <span class="tg">${escapeHtml(p.targetGrammar)}</span>`;

    const jp = document.createElement("p");
    jp.className = "jp";
    jp.innerHTML = p.html;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `Word list (10)`;
    details.appendChild(summary);

    const ul = document.createElement("ul");
    ul.className = "wordlist";
    for (const v of (p.vocab || [])){
      const li = document.createElement("li");
      const meaning = v.meaning ? `— ${escapeHtml(v.meaning)}` : "";
      li.innerHTML =
        `<span class="jpWord"><span class="w">${escapeHtml(v.surface)}</span><span class="kana">${escapeHtml(v.reading)}</span></span>` +
        `<span class="en">${meaning}</span>`;
      ul.appendChild(li);
    }
    details.appendChild(ul);

    card.appendChild(meta);
    card.appendChild(tgLine);
    card.appendChild(jp);
    card.appendChild(details);

    out.appendChild(card);
  }
}

function bindUI(){
  el("applyBtn").addEventListener("click", () => renderRange(el("startSel").value, el("endSel").value));
  el("startSel").addEventListener("change", () => renderRange(el("startSel").value, el("endSel").value));
  el("endSel").addEventListener("change", () => renderRange(el("startSel").value, el("endSel").value));
}

function showNotice(msg){
  const n = el("notice");
  n.style.display = "block";
  el("noticeText").textContent = msg;
}

async function main(){
  bindUI();
  try{
    state.config = await loadConfig();
    el("storyTitle").textContent = state.config.storyTitle || "Story";
    el("storySubtitle").textContent = state.config.storySubtitle || "";

    state.parts = await scanParts();
    if (!state.parts.length){
      showNotice("No parts found. Put files like parts/part-0001.json in the parts folder, then refresh.");
      return;
    }
    setOptions(state.parts);
    renderRange(el("startSel").value, el("endSel").value);
  }catch (err){
    showNotice("Couldn't auto-load parts. Serve this folder with a simple local server.");
  }
}

document.addEventListener("DOMContentLoaded", main);
