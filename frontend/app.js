// URL de l'API : en Docker, Nginx redirige /api/* vers le service "backend".
const API = window.API_URL || "/api";

const FEATURES = ["sepal_length", "sepal_width", "petal_length", "petal_width"];
const PRESETS = {
  setosa: [5.1, 3.5, 1.4, 0.2],
  versicolor: [6.0, 2.9, 4.5, 1.5],
  virginica: [6.7, 3.0, 5.2, 2.3],
};

const $ = (id) => document.getElementById(id);

// Synchronisation slider <-> champ numérique
FEATURES.forEach((f) => {
  $(f + "_r").addEventListener("input", (e) => ($(f).value = e.target.value));
  $(f).addEventListener("input", (e) => ($(f + "_r").value = e.target.value));
});

document.querySelectorAll("[data-preset]").forEach((btn) =>
  btn.addEventListener("click", () => {
    PRESETS[btn.dataset.preset].forEach((v, i) => {
      $(FEATURES[i]).value = v;
      $(FEATURES[i] + "_r").value = v;
    });
    predict();
  })
);

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  predict();
});

async function predict() {
  const payload = Object.fromEntries(FEATURES.map((f) => [f, parseFloat($(f).value)]));
  $("result").className = "result muted";
  $("result").textContent = "Prédiction en cours…";
  try {
    const r = await fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data.detail));
    renderResult(data);
  } catch (err) {
    $("result").className = "result error";
    $("result").textContent = "Erreur : " + err.message;
    $("probas").innerHTML = "";
  }
}

function renderResult(data) {
  $("result").className = "result ok";
  $("result").innerHTML = `Espèce prédite : <strong>${data.species}</strong>
    <small>(modèle v${data.model_version})</small>`;
  $("probas").innerHTML = Object.entries(data.probabilities)
    .map(([name, p]) => `
      <div class="bar-row ${name === data.species ? "top" : ""}">
        <span class="bar-label">${name}</span>
        <div class="bar"><div class="fill" style="width:${(p * 100).toFixed(1)}%"></div></div>
        <span class="bar-val">${(p * 100).toFixed(1)} %</span>
      </div>`)
    .join("");
}

async function loadStatus() {
  try {
    const h = await (await fetch(`${API}/health`)).json();
    $("status").textContent = h.model_loaded ? "API OK · modèle chargé" : "API OK · modèle absent";
    $("status").className = "status " + (h.model_loaded ? "up" : "warn");
    if (!h.model_loaded) return;
    const m = await (await fetch(`${API}/model/info`)).json();
    $("model-info").className = "info";
    $("model-info").innerHTML = `
      <dt>Version</dt><dd>${m.model_version}</dd>
      <dt>Algorithme</dt><dd>${m.algorithm}</dd>
      <dt>Accuracy (test)</dt><dd>${(m.metrics.accuracy * 100).toFixed(1)} %</dd>
      <dt>F1 macro</dt><dd>${m.metrics.f1_macro}</dd>
      <dt>Commit Git</dt><dd><code>${m.git_commit}</code></dd>
      <dt>Entraîné le</dt><dd>${new Date(m.trained_at).toLocaleString("fr-FR")}</dd>`;
  } catch {
    $("status").textContent = "API injoignable";
    $("status").className = "status down";
  }
}

loadStatus();
