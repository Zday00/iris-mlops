// URL de l'API : en Docker, Nginx redirige /api/* vers le service "backend".
const API = window.API_URL || "/api";

const SPECIES = ["setosa", "versicolor", "virginica"];
const FEATURES = [
  { key: "sepal_length", label: "Longueur du sépale", min: 4, max: 8 },
  { key: "sepal_width", label: "Largeur du sépale", min: 2, max: 4.5 },
  { key: "petal_length", label: "Longueur du pétale", min: 1, max: 7 },
  { key: "petal_width", label: "Largeur du pétale", min: 0.1, max: 2.5 },
];
const PRESETS = {
  setosa: [5.1, 3.5, 1.4, 0.2],
  versicolor: [6.0, 2.9, 4.5, 1.5],
  virginica: [6.7, 3.0, 5.2, 2.3],
};
const TIPS = {
  version: "Date et heure de l'entraînement (UTC). Elle sert d'identifiant unique au modèle.",
  algo: "Une forêt aléatoire : plusieurs arbres de décision votent, l'espèce majoritaire l'emporte.",
  accuracy: "Part des 30 fleurs de test, jamais vues à l'entraînement, que le modèle classe correctement.",
  f1: "Moyenne sur les 3 espèces de l'équilibre entre précision et rappel. Baisse si une espèce est mal reconnue.",
  commit: "Version exacte du code qui a produit ce modèle : on peut toujours retrouver comment il a été entraîné.",
};

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 1) => Number(v).toFixed(d).replace(".", ",");
// Nombre sans décimale inutile : 0 -> "0", 4.5 -> "4,5"
const num = (v) => String(Math.round(Number(v) * 100) / 100).replace(".", ",");
const DATA = window.IRIS_DATA || [];

// ---------- Statistiques du jeu de données (plages et moyennes par espèce) ----------
const STATS = SPECIES.map((_, s) => {
  const rows = DATA.filter((r) => r[4] === s);
  return FEATURES.map((_, f) => {
    const vals = rows.map((r) => r[f]);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    };
  });
});

// ---------- Champs de saisie générés (curseur + nombre + bandes par espèce) ----------
function buildFields() {
  $("fields").innerHTML = FEATURES.map((f) => {
    const span = f.max - f.min;
    const bands = STATS.map((st, s) => {
      const lo = Math.max(st[FEATURES.indexOf(f)].min, f.min);
      const hi = Math.min(st[FEATURES.indexOf(f)].max, f.max);
      const left = ((lo - f.min) / span) * 100;
      const width = Math.max(((hi - lo) / span) * 100, 1);
      return `<span class="band s${s}" style="left:${left}%;width:${width}%"
        title="${SPECIES[s]} : ${fmt(st[FEATURES.indexOf(f)].min)} à ${fmt(st[FEATURES.indexOf(f)].max)} cm"></span>`;
    }).join("");
    return `
      <div class="field" data-dim="${f.key}">
        <label for="${f.key}">${f.label}</label>
        <div class="num">
          <input type="number" id="${f.key}" step="0.1" inputmode="decimal"
                 aria-describedby="${f.key}-err" />
          <span class="unit">cm</span>
        </div>
        <div class="track">
          <input type="range" id="${f.key}_r" min="${f.min}" max="${f.max}" step="0.1"
                 aria-label="${f.label} (curseur)" />
          <div class="bands" aria-hidden="true">${bands}</div>
        </div>
        <p class="field-err" id="${f.key}-err" hidden></p>
      </div>`;
  }).join("");

  FEATURES.forEach((f) => {
    const field = document.querySelector(`.field[data-dim="${f.key}"]`);
    $(f.key + "_r").addEventListener("input", (e) => { $(f.key).value = e.target.value; onChange(); });
    $(f.key).addEventListener("input", (e) => {
      if (e.target.value !== "") $(f.key + "_r").value = e.target.value;
      onChange();
    });
    // Survol / focus d'un champ : la cote correspondante s'allume sur le schéma
    ["mouseenter", "focusin"].forEach((ev) => field.addEventListener(ev, () => highlight(f.key)));
    ["mouseleave", "focusout"].forEach((ev) => field.addEventListener(ev, () => highlight(null)));
  });
}

function values() {
  return FEATURES.map((f) => parseFloat($(f.key).value));
}

function setValues(vals) {
  FEATURES.forEach((f, i) => {
    $(f.key).value = vals[i];
    $(f.key + "_r").value = vals[i];
  });
  onChange();
}

function highlight(key) {
  document.querySelectorAll("[data-dim]").forEach((el) => {
    if (el.closest("#fields")) return;
    el.classList.toggle("on", el.dataset.dim === key);
  });
}

// ---------- Schéma de la fleur, dessiné à l'échelle ----------
const K = 18; // pixels par cm
function leafPath(x, base, L, W) {
  const h = L * K, c = (W * K) / 1.8;
  return `M${x},${base} C${x + c * 1.3},${base - h * 0.2} ${x + c * 1.1},${base - h * 0.85} ${x},${base - h}
          C${x - c * 1.1},${base - h * 0.85} ${x - c * 1.3},${base - h * 0.2} ${x},${base} Z`;
}
function drawPart(prefix, x, L, W) {
  const base = 172;
  const l = clamp(L, 0.3, 9), w = clamp(W, 0.1, 5);
  const h = l * K, half = (w * K) / 2, wy = base - h * 0.52, lx = x + Math.max(half, 8) + 14;
  $(prefix + "-shape").setAttribute("d", leafPath(x, base, l, w));
  setLine(prefix + "-len-line", lx, base, lx, base - h);
  setLine(prefix + "-wid-line", x - half, wy, x + half, wy);
  setText(prefix + "-len-txt", lx + 6, base - h / 2 + 4, isFinite(L) ? fmt(L) + " cm" : "?");
  // Forme trop étroite : la largeur s'écrit à gauche du dessin plutôt que dessus
  const narrow = half < 14, wt = $(prefix + "-wid-txt");
  wt.setAttribute("text-anchor", narrow ? "end" : "middle");
  setText(prefix + "-wid-txt", narrow ? x - half - 6 : x, narrow ? wy + 4 : wy - 6, isFinite(W) ? fmt(W) : "?");
}
function setLine(id, x1, y1, x2, y2) {
  const el = $(id);
  Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => el.setAttribute(k, v));
}
function setText(id, x, y, txt) {
  const el = $(id);
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.textContent = txt;
}
const clamp = (v, lo, hi) => (isFinite(v) ? Math.min(Math.max(v, lo), hi) : lo);

function drawFlower() {
  const [sl, sw, pl, pw] = values();
  drawPart("sepal", 95, sl, sw);
  drawPart("petal", 245, pl, pw);
}

// ---------- Nuage de points (longueur x largeur du pétale) ----------
const P = { w: 420, h: 270, l: 44, r: 14, t: 14, b: 40, x0: 0.5, x1: 7.5, y0: 0, y1: 2.7 };
const px = (v) => P.l + ((v - P.x0) / (P.x1 - P.x0)) * (P.w - P.l - P.r);
const py = (v) => P.h - P.b - ((v - P.y0) / (P.y1 - P.y0)) * (P.h - P.t - P.b);

function buildPlot() {
  const svg = $("plot");
  let g = "";
  for (let x = 1; x <= 7; x++) {
    g += `<line class="grid" x1="${px(x)}" x2="${px(x)}" y1="${P.t}" y2="${P.h - P.b}"/>
          <text class="tick" x="${px(x)}" y="${P.h - P.b + 16}" text-anchor="middle">${x}</text>`;
  }
  for (let y = 0; y <= 2.5; y += 0.5) {
    g += `<line class="grid" x1="${P.l}" x2="${P.w - P.r}" y1="${py(y)}" y2="${py(y)}"/>
          <text class="tick" x="${P.l - 8}" y="${py(y) + 4}" text-anchor="end">${fmt(y)}</text>`;
  }
  g += `<text class="axis" x="${(P.l + P.w - P.r) / 2}" y="${P.h - 4}" text-anchor="middle">Longueur du pétale (cm)</text>
        <text class="axis" transform="translate(12 ${(P.t + P.h - P.b) / 2}) rotate(-90)" text-anchor="middle">Largeur du pétale (cm)</text>`;
  g += DATA.map((r, i) => `<circle class="pt s${r[4]}" data-i="${i}" cx="${px(r[2])}" cy="${py(r[3])}" r="3.6">
        <title>${SPECIES[r[4]]} : pétale ${fmt(r[2])} × ${fmt(r[3])} cm (cliquer pour charger)</title></circle>`).join("");
  g += `<g id="you-guides"><line id="you-gx" class="guide"/><line id="you-gy" class="guide"/></g>
        <g id="you" class="you-mark"><circle r="9" class="halo"/><circle r="5" class="core"/></g>`;
  svg.innerHTML = g;
  svg.addEventListener("click", (e) => {
    const pt = e.target.closest(".pt");
    if (pt) setValues(DATA[+pt.dataset.i].slice(0, 4));
  });
}

function drawYou() {
  const [, , pl, pw] = values();
  const x = px(clamp(pl, P.x0, P.x1)), y = py(clamp(pw, P.y0, P.y1));
  $("you").style.transform = `translate(${x}px, ${y}px)`;
  setLine("you-gx", P.l, y, x, y);
  setLine("you-gy", x, P.h - P.b, x, y);
}

// ---------- Prédiction en direct ----------
let timer = null, seq = 0, ctrl = null;
function onChange() {
  drawFlower();
  drawYou();
  clearTimeout(timer);
  timer = setTimeout(predict, 140);
}

async function predict() {
  const mine = ++seq;
  if (ctrl) ctrl.abort();
  ctrl = new AbortController();
  const vals = values();
  const payload = Object.fromEntries(FEATURES.map((f, i) => [f.key, isFinite(vals[i]) ? vals[i] : null]));
  document.querySelector(".result-panel").classList.add("busy");
  try {
    const r = await fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (mine !== seq) return;
    if (r.status === 422) return showValidation(data.detail, vals);
    if (r.status === 503) return showError("Aucun modèle chargé",
      "L'API tourne mais n'a pas trouvé de modèle. Lancez « make train » puis « docker compose restart backend ».");
    if (!r.ok) return showError(`L'API a répondu ${r.status}`, "Consultez les journaux : « docker compose logs backend ».");
    renderResult(data, vals);
  } catch (err) {
    if (err.name === "AbortError" || mine !== seq) return;
    showError("API injoignable", "Vérifiez que la stack tourne : « docker compose ps » doit montrer le backend en healthy.");
  } finally {
    if (mine === seq) document.querySelector(".result-panel").classList.remove("busy");
  }
}

function clearFieldErrors() {
  FEATURES.forEach((f) => {
    document.querySelector(`.field[data-dim="${f.key}"]`).classList.remove("invalid");
    $(f.key + "-err").hidden = true;
  });
}

// Traduit la réponse 422 de FastAPI/Pydantic en message lisible, champ par champ
function showValidation(detail, vals) {
  clearFieldErrors();
  const items = Array.isArray(detail) ? detail : [];
  const lines = items.map((d) => {
    const key = d.loc ? d.loc[d.loc.length - 1] : "";
    const i = FEATURES.findIndex((f) => f.key === key);
    const f = FEATURES[i];
    if (!f) return d.msg;
    let msg;
    if (d.type === "greater_than_equal" || d.type === "greater_than") msg = `trop petite : minimum ${num(d.ctx.ge ?? d.ctx.gt)} cm`;
    else if (d.type === "less_than_equal" || d.type === "less_than") msg = `trop grande : maximum ${num(d.ctx.le ?? d.ctx.lt)} cm`;
    else msg = "doit être un nombre, par exemple 4,5";
    document.querySelector(`.field[data-dim="${key}"]`).classList.add("invalid");
    const err = $(key + "-err");
    err.textContent = msg.charAt(0).toUpperCase() + msg.slice(1) + ".";
    err.hidden = false;
    const seen = isFinite(vals[i]) ? ` (vous avez saisi ${num(vals[i])})` : "";
    return `${f.label} ${msg}${seen}.`;
  });
  showError(items.length > 1 ? "Mesures invalides" : "Mesure invalide",
    lines.join(" ") + " L'API a refusé la requête (erreur 422) : corrigez la valeur pour relancer la prédiction.");
}

function showError(title, detail) {
  $("result").className = "result stale";
  document.querySelector(".result-panel").classList.add("stale");
  $("error-title").textContent = title;
  $("error-detail").textContent = detail;
  $("error").hidden = false;
  $("explain").textContent = "";
}

function renderResult(data, vals) {
  clearFieldErrors();
  $("error").hidden = true;
  document.querySelector(".result-panel").classList.remove("stale");
  const s = SPECIES.indexOf(data.species);
  const probs = SPECIES.map((name) => [name, data.probabilities[name] ?? 0]).sort((a, b) => b[1] - a[1]);
  const top = probs[0][1];

  $("result").className = "result ok";
  const sp = $("species");
  sp.textContent = data.species;
  sp.className = `species s${s}`;
  const level = top >= 0.9 ? "Très confiant" : top >= 0.7 ? "Plutôt confiant" : "Hésitant";
  $("confidence").textContent = `${level} · ${fmt(top * 100, 0)} % de probabilité · modèle v${data.model_version}`;

  $("probas").innerHTML = SPECIES.map((name, i) => {
    const p = data.probabilities[name] ?? 0;
    return `<div class="bar-row${name === data.species ? " top" : ""}">
        <span class="bar-label">${name}</span>
        <span class="bar"><span class="fill s${i}" style="width:${(p * 100).toFixed(1)}%"></span></span>
        <span class="bar-val">${fmt(p * 100, 1)} %</span>
      </div>`;
  }).join("");

  $("explain").textContent = explain(data.species, s, probs, vals);
}

// Explication en langage clair, construite à partir des mesures et du jeu de données
function explain(name, s, probs, vals) {
  const [, , pl, pw] = vals;
  const m = STATS[s];
  const parts = [];
  parts.push(`Pétale de ${fmt(pl)} × ${fmt(pw)} cm : proche des ${name} du jeu d'entraînement, dont le pétale mesure en moyenne ${fmt(m[2].mean)} × ${fmt(m[3].mean)} cm.`);

  const outside = FEATURES.filter((f, i) => {
    const lo = Math.min(...STATS.map((st) => st[i].min)), hi = Math.max(...STATS.map((st) => st[i].max));
    return vals[i] < lo - 0.3 || vals[i] > hi + 0.3;
  });
  if (outside.length) {
    parts.push(`Attention : ${outside.map((f) => f.label.toLowerCase()).join(" et ")} sort des valeurs vues à l'entraînement, la prédiction est donc moins fiable.`);
  } else if (probs[1][1] > 0.15 && probs[0][1] - probs[1][1] < 0.5) {
    parts.push(`Le modèle hésite avec ${probs[1][0]} : ces mesures tombent dans la zone où les deux espèces se chevauchent.`);
  } else if (name === "setosa") {
    parts.push("Les setosa ont des pétales bien plus petits que les deux autres espèces : elles forment un groupe isolé, facile à reconnaître.");
  } else {
    parts.push("Ce sont surtout les dimensions du pétale qui séparent versicolor et virginica.");
  }
  return parts.join(" ");
}

// ---------- État de l'API et carte du modèle ----------
function tip(label, text, id) {
  return `<span class="term">${label}<button type="button" class="tip-btn" aria-describedby="tip-${id}" aria-label="Qu'est-ce que « ${label} » ?">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.25"/><path d="M7.9 7.6a2.2 2.2 0 1 1 3.1 2c-.6.3-1 .8-1 1.5v.4M10 14v.3"/></svg>
    </button><span role="tooltip" id="tip-${id}" class="tip">${text}</span></span>`;
}

async function loadStatus() {
  const status = $("status");
  try {
    const h = await (await fetch(`${API}/health`)).json();
    $("status-text").textContent = h.model_loaded ? "API connectée · modèle chargé" : "API connectée · aucun modèle";
    status.className = "status " + (h.model_loaded ? "up" : "warn");
    if (!h.model_loaded) return;
    const m = await (await fetch(`${API}/model/info`)).json();
    const hp = m.hyperparameters || {};
    const commit = document.createElement("code");
    commit.textContent = m.git_commit;
    $("model-info").innerHTML = `
      <dt>${tip("Version", TIPS.version, "v")}</dt><dd class="mono">${m.model_version}</dd>
      <dt>${tip("Algorithme", TIPS.algo, "a")}</dt><dd>Forêt aléatoire<span class="sub">${hp.n_estimators ?? "?"} arbres · profondeur max ${hp.max_depth ?? "?"}</span></dd>
      <dt>${tip("Accuracy", TIPS.accuracy, "acc")}</dt><dd class="mono">${fmt(m.metrics.accuracy * 100, 1)} %</dd>
      <dt>${tip("F1 macro", TIPS.f1, "f1")}</dt><dd class="mono">${fmt(m.metrics.f1_macro, 3)}</dd>
      <dt>${tip("Commit Git", TIPS.commit, "c")}</dt><dd id="commit"></dd>
      <dt>Entraîné le</dt><dd>${new Date(m.trained_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}</dd>`;
    $("commit").append(commit);
  } catch {
    $("status-text").textContent = "API injoignable";
    status.className = "status down";
    $("model-info").innerHTML = "<dt>Indisponible</dt><dd>L'API ne répond pas.</dd>";
  }
}

// ---------- Démarrage ----------
document.querySelectorAll("[data-preset]").forEach((btn) =>
  btn.addEventListener("click", () => setValues(PRESETS[btn.dataset.preset]))
);
$("form").addEventListener("submit", (e) => { e.preventDefault(); predict(); });

buildFields();
buildPlot();
setValues(PRESETS.setosa);
loadStatus();
