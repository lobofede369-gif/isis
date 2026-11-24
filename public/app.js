// Isis — cliente web.
// Las claves viven SOLO en localStorage de este navegador. Nunca se
// escriben en archivos, nunca se guardan en el servidor, nunca se
// muestran en pantalla. Se mandan en el cuerpo de cada llamada al
// servidor, que las usa solo para llamar a FableAI / n8n y no las guarda.
(function () {
  "use strict";

  const LS_FABLEAI = "isis_fableai_key";
  const LS_N8N = "isis_n8n_key";
  const LS_FACTS = "isis_facts";

  const $ = (id) => document.getElementById(id);
  const orb = $("orb");
  const orbStatus = $("orb-status");
  const voiceNote = $("voice-note");
  const chatBox = $("chat");
  const chatForm = $("chat-form");
  const chatInput = $("chat-input");
  const keyBanner = $("key-banner");
  const orlandoPanel = $("orlando-panel");
  const analysisBox = $("analysis");
  const factsList = $("facts-list");
  const factForm = $("fact-form");
  const factInput = $("fact-input");
  const configSection = $("config");

  // ---------------------------------------------------------- claves
  function getKeys() {
    return {
      fableaiKey: (localStorage.getItem(LS_FABLEAI) || "").trim(),
      n8nKey: (localStorage.getItem(LS_N8N) || "").trim(),
    };
  }

  function refreshKeyUI() {
    const { fableaiKey, n8nKey } = getKeys();
    const fState = $("cfg-fableai-state");
    const nState = $("cfg-n8n-state");
    fState.textContent = fableaiKey ? "Guardada ✓" : "Sin guardar";
    fState.classList.toggle("ok", !!fableaiKey);
    nState.textContent = n8nKey ? "Guardada ✓" : "Sin guardar";
    nState.classList.toggle("ok", !!n8nKey);
    keyBanner.hidden = !!fableaiKey;
  }

  // ---------------------------------------------------------- hechos
  function loadFacts() {
    try {
      const raw = localStorage.getItem(LS_FACTS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((f) => typeof f === "string") : [];
    } catch (e) {
      return [];
    }
  }
  function saveFacts(facts) {
    localStorage.setItem(LS_FACTS, JSON.stringify(facts));
    renderFacts();
  }
  function renderFacts() {
    const facts = loadFacts();
    factsList.innerHTML = "";
    if (facts.length === 0) {
      const li = document.createElement("li");
      li.innerHTML = "<span class='muted'>Isis todavía no ha aprendido nada. Enséñale algo abajo.</span>";
      factsList.appendChild(li);
      return;
    }
    facts.forEach((fact, i) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = fact;
      const btn = document.createElement("button");
      btn.textContent = "✕";
      btn.title = "Hacer que Isis olvide esto";
      btn.addEventListener("click", () => {
        const next = loadFacts().filter((_, j) => j !== i);
        saveFacts(next);
      });
      li.appendChild(span);
      li.appendChild(btn);
      factsList.appendChild(li);
    });
  }
  factForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = factInput.value.trim();
    if (!text) return;
    saveFacts([...loadFacts(), text]);
    factInput.value = "";
    addBubble("isis", "Anotado. Lo recordaré.");
  });

  // ---------------------------------------------------------- voz
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let recognition = null;
  let listening = false;

  function pickSpanishVoice() {
    const voices = window.speechSynthesis
      ? window.speechSynthesis.getVoices()
      : [];
    return (
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("es-mx")) ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("es")) ||
      null
    );
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-MX";
    const voice = pickSpanishVoice();
    if (voice) u.voice = voice;
    u.onstart = () => orb.classList.add("speaking");
    u.onend = () => {
      orb.classList.remove("speaking");
      setOrbStatus("Toca el círculo para hablar");
    };
    window.speechSynthesis.speak(u);
  }
  function setOrbStatus(text) {
    orbStatus.textContent = text;
  }

  if (!SpeechRecognition) {
    voiceNote.hidden = false;
    voiceNote.textContent =
      "Tu navegador no soporta dictado por voz. Puedes escribirle abajo; Isis te contesta por voz.";
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();
      stopListening();
      if (text) sendMessage(text);
    };
    recognition.onerror = () => {
      stopListening();
      setOrbStatus("No te escuché bien, inténtalo de nuevo");
    };
    recognition.onend = () => {
      if (listening) stopListening();
    };
  }
  function startListening() {
    if (!recognition) return;
    try {
      listening = true;
      orb.classList.add("listening");
      setOrbStatus("Escuchando…");
      recognition.start();
    } catch (e) {
      stopListening();
    }
  }
  function stopListening() {
    listening = false;
    orb.classList.remove("listening");
    try {
      recognition && recognition.stop();
    } catch (e) {}
  }
  orb.addEventListener("click", () => {
    if (listening) stopListening();
    else startListening();
  });

  // ---------------------------------------------------------- chat
  function addBubble(who, text, tag) {
    const div = document.createElement("div");
    div.className = "bubble " + who;
    if (tag) {
      const t = document.createElement("span");
      t.className = "tag";
      t.textContent = tag;
      div.appendChild(t);
    }
    div.appendChild(document.createTextNode(text));
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
  }

  function isWeatherQuestion(text) {
    return /clima|tiempo|temperatura|llover|lluvia|lloviendo|va a llover|hace (fr[ií]o|calor)|paraguas|nublado|soleado/i.test(
      text
    );
  }
  function mentionsOrlando(text) {
    return /orlando/i.test(text);
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function handleWeather() {
    addBubble("isis", "Revisando el clima en vivo…", "Clima");
    try {
      const res = await fetch("/api/weather");
      const data = await res.json();
      if (!res.ok || !data.live) {
        const msg =
          data.error || "No pude consultar el clima ahora mismo.";
        addBubble("isis", msg, "Clima");
        speak(msg);
        return;
      }
      const msg = data.summary;
      addBubble("isis", msg, "Clima · en vivo");
      speak(msg);
    } catch (e) {
      const msg = "No pude consultar el clima ahora mismo.";
      addBubble("isis", msg, "Clima");
      speak(msg);
    }
  }

  async function sendMessage(text) {
    addBubble("user", text);
    chatInput.value = "";

    // Clima: siempre por /api/weather, nunca culpar a la clave de Claude.
    if (isWeatherQuestion(text)) {
      await handleWeather();
      return;
    }

    const { fableaiKey, n8nKey } = getKeys();
    const facts = loadFacts();

    // Si pregunta por Orlando, primero la revisión y su resumen va como contexto.
    let extraFacts = [...facts];
    if (mentionsOrlando(text)) {
      try {
        const o = await postJSON("/api/orlando", { n8nKey });
        const d = o.data || {};
        const src = d.live ? "en vivo" : "último dato conocido";
        extraFacts.push(
          `Estado de Orlando (${src}): ${d.executionsUsed || "?"} de ${d.executionsTotal || "?"} ejecuciones de n8n usadas, ${d.executionsFailed || "?"} fallidas, prueba vence ${d.trialEnds || "3 dic 2026"}.`
        );
      } catch (e) {
        // Si la revisión falla, el chat sigue con lo que Isis ya sabe.
      }
    }

    setOrbStatus("Isis está pensando…");
    try {
      const { ok, data } = await postJSON("/api/chat", {
        message: text,
        fableaiKey,
        n8nKey,
        facts: extraFacts,
      });
      if (!ok && data.error) {
        addBubble("isis", data.error, "Isis");
        speak(data.error);
      } else if (data.reply) {
        addBubble("isis", data.reply, data.claudeLive ? "Isis · Claude en vivo" : "Isis");
        speak(data.reply);
        if (data.needsKey) refreshKeyUI();
      } else {
        addBubble("isis", "No pude responder ahora mismo.", "Isis");
      }
    } catch (e) {
      const msg = "No pude hablar con el servidor ahora mismo.";
      addBubble("isis", msg, "Isis");
      speak(msg);
    }
    setOrbStatus("Toca el círculo para hablar");
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) sendMessage(text);
  });

  // ---------------------------------------------------------- Orlando
  function renderOrlando(d) {
    const active =
      d.workflowActive === null
        ? "No se encontró el workflow"
        : d.workflowActive
          ? "Activo"
          : "Pausado";
    const badge = d.live
      ? '<span class="badge live">En vivo</span>'
      : '<span class="badge known">Último dato conocido</span>';
    const checked = d.checkedAt
      ? new Date(d.checkedAt).toLocaleString("es-MX")
      : "23 nov 2026";
    orlandoPanel.innerHTML = `
      <div class="row"><span class="label">Estado ${badge}</span><span class="value">${active}</span></div>
      <div class="row"><span class="label">Ejecuciones n8n</span><span class="value">${d.executionsUsed} / ${d.executionsTotal}</span></div>
      <div class="row"><span class="label">Fallidas</span><span class="value">${d.executionsFailed}</span></div>
      <div class="row"><span class="label">La prueba vence</span><span class="value">3 dic 2026</span></div>
      <div class="row"><span class="label">Revisado</span><span class="value">${checked}</span></div>
      ${d.message ? `<p class="muted">${escapeHtml(d.message)}</p>` : ""}
      ${d.error ? `<p class="muted">${escapeHtml(d.error)}</p>` : ""}
    `;
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  async function loadOrlando() {
    orlandoPanel.innerHTML = "<p class='muted'>Revisando a Orlando…</p>";
    const { n8nKey } = getKeys();
    try {
      const { data } = await postJSON("/api/orlando", { n8nKey });
      renderOrlando(data);
    } catch (e) {
      orlandoPanel.innerHTML =
        "<p class='muted'>No pude revisar a Orlando ahora mismo.</p>";
    }
  }
  $("btn-orlando").addEventListener("click", loadOrlando);

  // ---------------------------------------------------------- análisis
  $("btn-analyze").addEventListener("click", async () => {
    const { fableaiKey, n8nKey } = getKeys();
    analysisBox.innerHTML = '<p class="loading">ANALIZANDO…</p>';
    try {
      const { ok, data } = await postJSON("/api/analyze", {
        fableaiKey,
        n8nKey,
        facts: loadFacts(),
      });
      if (!ok && data.error) {
        analysisBox.innerHTML = `<p>${escapeHtml(data.error)}</p>`;
        return;
      }
      analysisBox.textContent = data.analysis || "Sin análisis.";
    } catch (e) {
      analysisBox.innerHTML =
        "<p>No pude hacer el análisis ahora mismo.</p>";
    }
  });

  // ---------------------------------------------------------- config
  function toggleConfig() {
    configSection.hidden = !configSection.hidden;
    if (!configSection.hidden) {
      configSection.scrollIntoView({ behavior: "smooth" });
    }
  }
  $("btn-config").addEventListener("click", toggleConfig);
  $("banner-config").addEventListener("click", toggleConfig);

  $("btn-save-config").addEventListener("click", () => {
    const f = $("cfg-fableai").value.trim();
    const n = $("cfg-n8n").value.trim();
    if (f) localStorage.setItem(LS_FABLEAI, f);
    if (n) localStorage.setItem(LS_N8N, n);
    $("cfg-fableai").value = "";
    $("cfg-n8n").value = "";
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves guardadas en este navegador.";
    refreshKeyUI();
    loadOrlando();
  });
  $("btn-clear-config").addEventListener("click", () => {
    localStorage.removeItem(LS_FABLEAI);
    localStorage.removeItem(LS_N8N);
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves borradas de este navegador.";
    refreshKeyUI();
    loadOrlando();
  });

  // ---------------------------------------------------------- inicio
  refreshKeyUI();
  renderFacts();
  loadOrlando();
  addBubble(
    "isis",
    "Hola, soy Isis. Tócame el círculo y háblame, o escríbeme abajo. Si me preguntas por Orlando, lo reviso; si me preguntas por el clima, lo consulto en vivo.",
    "Isis"
  );
})();
