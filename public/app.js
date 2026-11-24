// Isis — cliente web.
// Las claves viven SOLO en localStorage de este navegador. Nunca se
// escriben en archivos, nunca se guardan en el servidor, nunca se
// muestran en pantalla. Se mandan en el cuerpo de cada llamada al
// servidor, que las usa solo para llamar a FableAI / n8n y no las guarda.
(function () {
  "use strict";

  const LS_FABLEAI = "isis_fableai_key";
  const LS_N8N = "isis_n8n_key";
  const LS_WHATSAPP = "isis_whatsapp_token";
  const LS_TEXTBEE = "isis_textbee_key";
  const LS_TEXTBEE_DEVICE = "isis_textbee_device";
  const LS_FACTS = "isis_facts";
  const LS_HISTORY = "isis_history";
  const LS_SUMMARY = "isis_summary";
  const LS_CONTACTS = "isis_contacts";
  const LS_VOICE = "isis_voice";
  const LS_WAKE = "isis_wake_enabled";
  // Spotify: Client ID y Client Secret (Configuración) y tokens (solo
  // en este navegador; se mandan por petición, nunca se guardan en el
  // servidor). Recordatorios y conteos de dinero: también locales.
  const LS_SPOTIFY_ID = "isis_spotify_client_id";
  const LS_SPOTIFY_SECRET = "isis_spotify_client_secret";
  const LS_SPOTIFY_ACCESS = "isis_spotify_access";
  const LS_SPOTIFY_REFRESH = "isis_spotify_refresh";
  const LS_SPOTIFY_EXPIRES = "isis_spotify_expires_at";
  const LS_REMINDERS = "isis_reminders";
  const LS_MONEY = "isis_money_week";
  // Límites de la memoria: 60 hechos, 12 intercambios, resumen de ~800
  // caracteres, 250 caracteres por lado de cada intercambio.
  const MAX_FACTS = 60;
  const MAX_HISTORY = 12;
  const MAX_SUMMARY_CHARS = 800;
  const HISTORY_SIDE_CHARS = 250;

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
  const chatCard = $("chat-card");
  const chatToggle = $("chat-toggle");
  const chatBody = $("chat-body");
  const chatPreview = $("chat-preview");
  const factsList = $("facts-list");
  const factForm = $("fact-form");
  const factInput = $("fact-input");
  const drawer = $("drawer");
  const drawerBackdrop = $("drawer-backdrop");
  const panelsWrap = $("panels");
  const panelTitle = $("panel-title");
  const PANELS = [
    ["panel-config", "Configuración"],
    ["panel-voice", "Voz de Isis"],
    ["panel-memory", "Memoria"],
    ["panel-contacts", "Contactos"],
    ["panel-orlando", "Orlando · Bot PCN"],
    ["panel-analyze", "Análisis"],
    ["panel-scan", "Escanear"],
    ["panel-systems", "Sistemas"],
    ["panel-music", "Música"],
    ["panel-reminders", "Recordatorios"],
    ["panel-news", "Noticias"],
    ["panel-money", "Dinero"],
  ];

  // ---------------------------------------------------------- claves
  function getKeys() {
    return {
      fableaiKey: (localStorage.getItem(LS_FABLEAI) || "").trim(),
      n8nKey: (localStorage.getItem(LS_N8N) || "").trim(),
      whatsappToken: (localStorage.getItem(LS_WHATSAPP) || "").trim(),
      textbeeKey: (localStorage.getItem(LS_TEXTBEE) || "").trim(),
      textbeeDevice: (localStorage.getItem(LS_TEXTBEE_DEVICE) || "").trim(),
      spotifyId: (localStorage.getItem(LS_SPOTIFY_ID) || "").trim(),
      spotifySecret: (localStorage.getItem(LS_SPOTIFY_SECRET) || "").trim(),
    };
  }

  function refreshKeyUI() {
    const {
      fableaiKey,
      n8nKey,
      whatsappToken,
      textbeeKey,
      textbeeDevice,
      spotifyId,
      spotifySecret,
    } = getKeys();
    const fState = $("cfg-fableai-state");
    const nState = $("cfg-n8n-state");
    const wState = $("cfg-whatsapp-state");
    const tState = $("cfg-textbee-state");
    const dState = $("cfg-textbee-device-state");
    const sIdState = $("cfg-spotify-id-state");
    const sSecretState = $("cfg-spotify-secret-state");
    fState.textContent = fableaiKey ? "Guardada ✓" : "Sin guardar";
    fState.classList.toggle("ok", !!fableaiKey);
    nState.textContent = n8nKey ? "Guardada ✓" : "Sin guardar";
    nState.classList.toggle("ok", !!n8nKey);
    wState.textContent = whatsappToken ? "Guardado ✓" : "Sin guardar";
    wState.classList.toggle("ok", !!whatsappToken);
    if (tState) {
      tState.textContent = textbeeKey ? "Guardada ✓" : "Sin guardar";
      tState.classList.toggle("ok", !!textbeeKey);
    }
    if (dState) {
      dState.textContent = textbeeDevice
        ? "Guardado ✓"
        : "Sin guardar (opcional)";
      dState.classList.toggle("ok", !!textbeeDevice);
    }
    if (sIdState) {
      sIdState.textContent = spotifyId ? "Guardado ✓" : "Sin guardar";
      sIdState.classList.toggle("ok", !!spotifyId);
    }
    if (sSecretState) {
      sSecretState.textContent = spotifySecret ? "Guardado ✓" : "Sin guardar";
      sSecretState.classList.toggle("ok", !!spotifySecret);
    }
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
    // La lista tiene tope: si se pasa de 60, se borra el hecho más viejo.
    const capped = Array.isArray(facts) ? facts.slice(-MAX_FACTS) : [];
    localStorage.setItem(LS_FACTS, JSON.stringify(capped));
    renderFacts();
    renderMemory();
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

  // ---------------------------------------------------------- memoria
  // La memoria de Isis vive SOLO en este navegador (localStorage), como
  // las claves y los hechos: el servidor no guarda nada. Tres partes:
  // - hechos (isis_facts): lo que Claude aprende solo de la conversación
  //   con [memoria: ...], más lo que Santiago le enseña a mano;
  // - resumen (isis_summary): lo que Claude resume con [resumen: ...];
  // - historial (isis_history): los últimos 12 intercambios, para que la
  //   conversación se vea continuar al recargar la página.
  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (h) => h && typeof h.u === "string" && typeof h.i === "string"
      );
    } catch (e) {
      return [];
    }
  }
  function saveHistoryItem(userText, isisText) {
    const u = String(userText || "").trim();
    const i = String(isisText || "").trim();
    if (!u || !i) return;
    const items = loadHistory();
    items.push({
      u: u.slice(0, HISTORY_SIDE_CHARS),
      i: i.slice(0, HISTORY_SIDE_CHARS),
      t: new Date().toISOString(),
    });
    while (items.length > MAX_HISTORY) items.shift();
    localStorage.setItem(LS_HISTORY, JSON.stringify(items));
    renderMemory();
  }
  function loadSummary() {
    try {
      return (localStorage.getItem(LS_SUMMARY) || "").trim();
    } catch (e) {
      return "";
    }
  }
  function saveSummary(text) {
    const s = String(text || "").trim().slice(0, MAX_SUMMARY_CHARS);
    if (!s) return;
    localStorage.setItem(LS_SUMMARY, s);
    renderMemory();
  }
  // Agrega hechos nuevos sin duplicados exactos (el tope de 60 lo aplica
  // saveFacts: si se pasa, se borra el más viejo).
  function addFacts(newFacts) {
    if (!Array.isArray(newFacts) || newFacts.length === 0) return;
    const facts = loadFacts();
    let changed = false;
    for (const f of newFacts) {
      const clean = String(f || "").trim();
      if (!clean) continue;
      if (!facts.includes(clean)) {
        facts.push(clean);
        changed = true;
      }
    }
    if (changed) saveFacts(facts);
  }
  function renderMemory() {
    const summary = loadSummary();
    const sumEl = $("memory-summary");
    if (sumEl) sumEl.textContent = summary || "Todavía no hay resumen.";
    const countEl = $("memory-count");
    if (countEl) countEl.textContent = String(loadHistory().length);
  }
  // Al cargar la página, la conversación se ve continuar: los últimos
  // intercambios vuelven como burbujas. Devuelve true si restauró algo.
  function restoreHistory() {
    const items = loadHistory();
    if (items.length === 0) return false;
    for (const item of items) {
      addBubble("user", item.u);
      addBubble("isis", item.i, "Isis");
    }
    return true;
  }
  function showMemoryMsg(text) {
    const el = $("memory-msg");
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
  }
  const exportMemoryBtn = $("btn-export-memory");
  if (exportMemoryBtn) {
    exportMemoryBtn.addEventListener("click", () => {
      const data = {
        facts: loadFacts(),
        summary: loadSummary(),
        history: loadHistory(),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "isis-memoria.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showMemoryMsg("Memoria exportada.");
    });
  }
  const importMemoryBtn = $("btn-import-memory");
  const memoryFileInput = $("memory-file");
  if (importMemoryBtn && memoryFileInput) {
    importMemoryBtn.addEventListener("click", () => memoryFileInput.click());
    memoryFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("bad");
          }
          // Si no trae ninguna de las tres partes, no es un respaldo de Isis.
          if (!("facts" in data) && !("summary" in data) && !("history" in data)) {
            throw new Error("bad");
          }
          const facts = Array.isArray(data.facts)
            ? data.facts.filter((f) => typeof f === "string")
            : [];
          const summary =
            typeof data.summary === "string" ? data.summary : "";
          const history = Array.isArray(data.history)
            ? data.history
                .filter(
                  (h) => h && typeof h.u === "string" && typeof h.i === "string"
                )
                .map((h) => ({
                  u: h.u.slice(0, HISTORY_SIDE_CHARS),
                  i: h.i.slice(0, HISTORY_SIDE_CHARS),
                  t:
                    typeof h.t === "string"
                      ? h.t
                      : new Date().toISOString(),
                }))
            : [];
          localStorage.setItem(LS_FACTS, JSON.stringify(facts.slice(-MAX_FACTS)));
          if (summary.trim()) {
            localStorage.setItem(
              LS_SUMMARY,
              summary.trim().slice(0, MAX_SUMMARY_CHARS)
            );
          } else {
            localStorage.removeItem(LS_SUMMARY);
          }
          localStorage.setItem(
            LS_HISTORY,
            JSON.stringify(history.slice(-MAX_HISTORY))
          );
          renderFacts();
          renderMemory();
          showMemoryMsg("Memoria importada.");
        } catch (err) {
          showMemoryMsg(
            "Ese archivo no es un respaldo válido de Isis. No se borró nada."
          );
        }
      };
      reader.readAsText(file);
    });
  }
  const clearMemoryBtn = $("btn-clear-memory");
  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener("click", () => {
      if (
        !window.confirm(
          "¿Borrar la memoria de Isis? Se borran los hechos, el resumen y el historial. Tus claves, contactos y voz NO se tocan."
        )
      )
        return;
      localStorage.removeItem(LS_FACTS);
      localStorage.removeItem(LS_HISTORY);
      localStorage.removeItem(LS_SUMMARY);
      renderFacts();
      renderMemory();
      showMemoryMsg("Memoria borrada. Isis empieza de cero.");
    });
  }

  // ---------------------------------------------------------- contactos
  // Contactos de WhatsApp (nombre + número), solo en localStorage.
  function loadContacts() {
    try {
      const raw = localStorage.getItem(LS_CONTACTS);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (c) =>
          c &&
          typeof c.name === "string" &&
          typeof c.phone === "string" &&
          c.name.trim() &&
          c.phone.trim()
      );
    } catch (e) {
      return [];
    }
  }
  function saveContacts(contacts) {
    localStorage.setItem(LS_CONTACTS, JSON.stringify(contacts));
    renderContacts();
  }
  function renderContacts() {
    const list = $("contacts-list");
    const contacts = loadContacts();
    list.innerHTML = "";
    if (contacts.length === 0) {
      const li = document.createElement("li");
      li.innerHTML =
        "<span class='muted'>Sin contactos todavía. Agrega a quién le quieras escribir por SMS o por WhatsApp.</span>";
      list.appendChild(li);
      return;
    }
    contacts.forEach((contact, i) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = `${contact.name} · ${contact.phone}`;
      const btn = document.createElement("button");
      btn.textContent = "✕";
      btn.title = "Borrar contacto";
      btn.addEventListener("click", () => {
        const next = loadContacts().filter((_, j) => j !== i);
        saveContacts(next);
      });
      li.appendChild(span);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }
  $("contact-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("contact-name").value.trim();
    const phone = $("contact-phone").value.trim();
    if (!name || !phone) return;
    const contacts = loadContacts();
    const idx = contacts.findIndex(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (idx >= 0) contacts[idx].phone = phone;
    else contacts.push({ name, phone });
    saveContacts(contacts);
    $("contact-name").value = "";
    $("contact-phone").value = "";
    addBubble("isis", `Listo, guardé a ${name} en tus contactos.`);
  });

  // Normaliza un número de México a 52 + 10 dígitos. Devuelve null si no se puede.
  function normalizeMxPhone(input) {
    if (!input) return null;
    const digits = String(input).replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("521")) {
      return "52" + digits.slice(3);
    }
    if (digits.length === 12 && digits.startsWith("52")) return digits;
    if (digits.length === 10) return "52" + digits;
    return null;
  }
  // Resuelve a quién escribir: un nombre de contacto o un número directo.
  // Devuelve { name, number } o null si no se puede resolver.
  function resolveRecipient(to) {
    const raw = String(to || "").trim();
    if (!raw) return null;
    const byName = loadContacts().find(
      (c) => c.name.toLowerCase() === raw.toLowerCase()
    );
    if (byName) {
      const number = normalizeMxPhone(byName.phone);
      return number ? { name: byName.name, number } : null;
    }
    const number = normalizeMxPhone(raw);
    if (number) return { name: raw, number };
    return null;
  }

  // ---------------------------------------------------------- ánimo
  // El ánimo de Isis: Claude lo marca al final de sus respuestas con
  // [ánimo: ...]. El cliente lo quita del texto (no se lee en voz alta) y
  // lo muestra como una línea pequeña junto al orbe, con un leve cambio
  // de tono del orbe.
  const MOODS = {
    alegre: "Alegre",
    frustrada: "Frustrada",
    enojada: "Enojada",
    preocupada: "Preocupada",
    orgullosa: "Orgullosa",
    bromeando: "Bromeando",
    tranquila: "Tranquila",
  };
  const MOOD_CLASSES = Object.keys(MOODS).map((m) => "mood-" + m);
  const orbMood = $("orb-mood");
  // El ánimo actual de Isis: lo guarda setMood y la voz lo usa para
  // cambiar el tono y la velocidad según cómo se siente.
  let currentMood = null;
  function extractMood(text) {
    const raw = String(text || "");
    const matches = [...raw.matchAll(/\[ánimo:\s*([a-záéíóúñ]+)\s*\]/gi)];
    let mood = null;
    if (matches.length) {
      const last = matches[matches.length - 1][1].toLowerCase();
      if (Object.prototype.hasOwnProperty.call(MOODS, last)) mood = last;
    }
    const clean = raw
      .replace(/\[ánimo:\s*[a-záéíóúñ]+\s*\]/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { text: clean, mood };
  }
  function setMood(mood) {
    if (!mood || !MOODS[mood] || !orbMood) return;
    currentMood = mood;
    orbMood.hidden = false;
    orbMood.textContent = "· " + MOODS[mood] + " ·";
    orbMood.className = "orb-mood mood-" + mood;
    orb.classList.remove(...MOOD_CLASSES);
    orb.classList.add("mood-" + mood);
  }

  // Memoria que Claude devuelve en sus respuestas normales, en líneas
  // aparte antes del marcador de ánimo: [memoria: hecho 1 | hecho 2] y
  // [resumen: ...]. Se sacan del texto (nunca se muestran ni se hablan)
  // y se guardan: los hechos en isis_facts, el resumen en isis_summary.
  function extractMemory(text) {
    const raw = String(text || "");
    const facts = [];
    for (const m of raw.matchAll(/\[memoria:\s*([^\]]+)\]/gi)) {
      for (const part of m[1].split("|")) {
        const f = part.trim();
        if (f) facts.push(f);
      }
    }
    const sumMatch = raw.match(/\[resumen:\s*([\s\S]*?)\]/i);
    const summary = sumMatch ? sumMatch[1].trim() : null;
    const clean = raw
      .replace(/\[memoria:\s*[^\]]+\]/gi, "")
      .replace(/\[resumen:\s*[\s\S]*?\]/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { text: clean, facts, summary };
  }
  // Limpia una respuesta de Claude: guarda lo que aprendió ([memoria:] y
  // [resumen:]) y quita los tres marcadores ([memoria:], [resumen:] y
  // [ánimo:]). Devuelve el texto limpio y el ánimo.
  function processClaudeReply(raw) {
    const mem = extractMemory(raw);
    if (mem.facts.length) addFacts(mem.facts);
    if (mem.summary) saveSummary(mem.summary);
    const moodRes = extractMood(mem.text);
    return { text: moodRes.text, mood: moodRes.mood };
  }

  // ---------------------------------------------------------- voz
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let recognition = null;
  let listening = false;

  // --- selección de voz: la más natural y femenina en español que tenga
  // el teléfono. El idioma manda: es-MX, es-US, es-419, es-ES; dentro de
  // cada idioma, primero las voces femeninas, luego las "Natural"/"Neural"
  // del motor de voz del teléfono. En Android las voces llegan tarde, por
  // "voiceschanged" y se vuelve a leer la lista cuando están listas.
  let spanishVoices = [];
  let selectedVoice = null;

  function voiceId(v) {
    return (v.voiceURI || "") + "|" + (v.name || "") + "|" + (v.lang || "");
  }
  // Orden de idioma: es-MX, es-US, es-419, es-ES, otro español. El idioma
  // es el criterio principal, para que una voz femenina es-US no le gane
  // a una es-MX: dentro de un mismo idioma manda la calidad.
  function langRank(v) {
    const lang = (v.lang || "").toLowerCase();
    if (lang === "es-mx" || lang.startsWith("es-mx")) return 0;
    if (lang === "es-us" || lang.startsWith("es-us")) return 1;
    if (lang === "es-419" || lang.startsWith("es-419")) return 2;
    if (lang === "es-es" || lang.startsWith("es-es")) return 3;
    return 4;
  }
  // Calidad de la voz (dentro del mismo idioma): femenina +30, natural o
  // neural +25, motor de Google del teléfono +20. Solo se miran las
  // o "femenina" en el nombre de la voz; no se inventan nombres de
  // personas concretas.
  function scoreVoice(v) {
    const name = (v.name || "").toLowerCase();
    let score = 0;
    if (
      name.includes("female") ||
      name.includes("mujer") ||
      name.includes("femenina")
    )
      score += 30;
    if (name.includes("natural") || name.includes("neural")) score += 25;
    if (name.includes("google")) score += 20;
    return score;
  }
  function refreshVoices() {
    if (!("speechSynthesis" in window)) return;
    const all = window.speechSynthesis.getVoices();
    spanishVoices = all
      .filter((v) => (v.lang || "").toLowerCase().startsWith("es"))
      .sort((a, b) => langRank(a) - langRank(b) || scoreVoice(b) - scoreVoice(a));
    const saved = (localStorage.getItem(LS_VOICE) || "").trim();
    selectedVoice =
      spanishVoices.find((v) => voiceId(v) === saved) ||
      spanishVoices[0] ||
      null;
    populateVoiceSelect();
  }
  function pickSpanishVoice() {
    return selectedVoice;
  }
  function populateVoiceSelect() {
    const sel = $("voice-select");
    const state = $("voice-state");
    if (!sel) return;
    sel.innerHTML = "";
    if (!("speechSynthesis" in window)) {
      if (state) state.textContent = "Este navegador no tiene voces.";
      sel.disabled = true;
      return;
    }
    if (spanishVoices.length === 0) {
      if (state) state.textContent = "Todavía no hay voces en español cargadas…";
      sel.disabled = true;
      return;
    }
    spanishVoices.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = voiceId(v);
      opt.textContent = v.name + " (" + v.lang + ")";
      sel.appendChild(opt);
    });
    if (selectedVoice) sel.value = voiceId(selectedVoice);
    if (state) {
      state.textContent =
        spanishVoices.length + " voces en español disponibles.";
    }
    sel.disabled = false;
  }

  // --- voz de Kokoro (gratis, corre en el navegador, sin clave ni
  // servidor): kokoro-js (librería oficial de hexgrad, Apache 2.0) con
  // ONNX Runtime Web. El modelo Kokoro-82M (cuantizado q8, ~88 MB) se
  // descarga SOLO cuando Santiago toca "Descargar voz de Isis" (o
  // "Probar voz"), una sola vez desde Hugging Face, y queda en la caché
  // del navegador; la síntesis corre en el teléfono. Voces en español:
  // solo 3 (ef_dora femenina por defecto, em_alex y em_santa
  // masculinas). Si Kokoro no está descargada o falla, Isis usa la voz
  // del teléfono: nunca se queda muda.
  // Modelo: q8, no q4. El archivo q4 del mismo repo pesa ~291 MB
  // (medido en Hugging Face: model_q4.onnx = 305 215 966 bytes), más
  // del triple que el q8 (~88 MB: model_quantized.onnx =
  // 92 361 116 bytes), así que q4 haría la descarga más pesada y lenta,
  // no más ligera.
  const KOKORO_CDN_URL = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";
  const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
  const LS_KOKORO_VOICE = "isis_kokoro_voice";
  const KOKORO_DEFAULT_VOICE = "ef_dora";
  const KOKORO_VOICES = [
    { id: "ef_dora", label: "Dora · femenina" },
    { id: "em_alex", label: "Alex · masculina" },
    { id: "em_santa", label: "Santa · masculina (navideña)" },
  ];
  // Una oración puede tardar varios segundos en un teléfono modesto
  // (Helio G85, 4 GB): 60 s por oración antes de rendirse y pasar a la
  // voz del teléfono.
  const KOKORO_GENERATE_TIMEOUT_MS = 60000;
  // kokoroState: "idle" (aún no se intentó) | "loading" (descargando el
  // modelo) | "ready" (lista para hablar) | "failed" (no se pudo cargar).
  let kokoroState = "idle";
  let kokoroTTS = null;
  let kokoroLoadPromise = null;
  let selectedKokoroVoice =
    (localStorage.getItem(LS_KOKORO_VOICE) || "").trim() ||
    KOKORO_DEFAULT_VOICE;
  if (!KOKORO_VOICES.some((v) => v.id === selectedKokoroVoice)) {
    selectedKokoroVoice = KOKORO_DEFAULT_VOICE;
  }

  // La nota junto al orbe solo aparece cuando Isis ya habló con la voz
  // del teléfono porque Kokoro aún no está descargada: un recordatorio
  // breve, no un aviso permanente al abrir la app.
  let kokoroDownloadHint = false;
  // Estado visible de la voz de Kokoro: una línea pequeña junto al orbe
  // (mientras descarga, si falló, o la nota de que aún no está
  // descargada), el estado del selector y el botón de descarga en
  // Configuración.
  function updateKokoroStatus() {
    const status = $("kokoro-status");
    if (status) {
      if (kokoroState === "loading") {
        status.hidden = false;
        status.textContent = "Descargando la voz de Isis por primera vez…";
      } else if (kokoroState === "failed") {
        status.hidden = false;
        status.textContent =
          "La voz de Kokoro no se pudo cargar; Isis habla con la voz del teléfono.";
      } else if (kokoroState === "idle" && kokoroDownloadHint) {
        status.hidden = false;
        status.textContent =
          "La voz de Isis aún no está descargada — descárgala en el menú ☰, en Voz de Isis.";
      } else {
        status.hidden = true;
        status.textContent = "";
      }
    }
    const state = $("kokoro-voice-state");
    if (state) {
      if (kokoroState === "loading") {
        state.textContent =
          "Descargando el modelo de voz… (primera vez, ~88 MB; luego queda guardado en el teléfono)";
      } else if (kokoroState === "ready") {
        state.textContent =
          "Voz de Kokoro lista · corre en este teléfono, sin costo ni clave.";
      } else if (kokoroState === "failed") {
        state.textContent =
          "Kokoro no se pudo cargar. Isis usa la voz del teléfono; toca “Descargar voz de Isis” para reintentarlo.";
      } else {
        state.textContent =
          "Aún no descargada (~88 MB, una sola vez · mejor con Wi-Fi).";
      }
    }
    const dlBtn = $("btn-download-kokoro");
    if (dlBtn) {
      if (kokoroState === "loading") {
        dlBtn.disabled = true;
        dlBtn.textContent = "Descargando…";
      } else if (kokoroState === "ready") {
        dlBtn.disabled = true;
        dlBtn.textContent = "Voz descargada ✓";
      } else if (kokoroState === "failed") {
        dlBtn.disabled = false;
        dlBtn.textContent = "Reintentar descarga";
      } else {
        dlBtn.disabled = false;
        dlBtn.textContent = "Descargar voz de Isis";
      }
    }
  }

  // Carga kokoro-js desde el CDN y el modelo desde Hugging Face. No
  // bloquea nada: el chat y la voz del teléfono siguen funcionando
  // mientras descarga. SOLO se llama bajo demanda (botón "Descargar voz
  // de Isis" o "Probar voz"): al abrir la app no se descarga nada, para
  // que Isis arranque rápida y ligera. Si falló, se puede reintentar.
  function initKokoro() {
    if (kokoroState === "ready") return Promise.resolve(kokoroTTS);
    if (kokoroState === "loading") return kokoroLoadPromise;
    kokoroState = "loading";
    updateKokoroStatus();
    kokoroLoadPromise = (async () => {
      try {
        const mod = await import(KOKORO_CDN_URL);
        const tts = await mod.KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
          dtype: "q8",
          device: "wasm",
        });
        kokoroTTS = tts;
        kokoroState = "ready";
      } catch (e) {
        kokoroTTS = null;
        kokoroState = "failed";
      }
      updateKokoroStatus();
      return kokoroTTS;
    })();
    return kokoroLoadPromise;
  }

  // Llena el selector de Configuración con las 3 voces en español.
  function populateKokoroSelect() {
    const sel = $("kokoro-voice-select");
    if (!sel) return;
    sel.innerHTML = "";
    KOKORO_VOICES.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.label;
      sel.appendChild(opt);
    });
    sel.value = selectedKokoroVoice;
  }

  // --- hablar: se respeta la puntuación. Cada respuesta se divide en
  // oraciones (. ! ?) y se habla una por una, con una pausa que depende
  // de cómo termina la oración, para que las comas y los puntos suenen
  // naturales. La voz es la elegida en Configuración, con el tono y la
  // velocidad del ánimo actual de Isis (alegre, enojada, preocupada...),
  // para que las emociones se oigan como en una plática normal. El tono
  // base es 1.2 (antes 1.1) para sonar más femenina, sin atropellarse.
  let speakQueue = [];
  let speakGen = 0;
  let speakingNow = false;
  let thinkingNow = false;
  // Prosodia según el ánimo: pitch entre 1.0 y 1.35, rate entre 0.85 y
  // 1.05. Sin ánimo, el tono base es 1.2 con velocidad 0.95.
  const MOOD_PROSODY = {
    alegre: { pitch: 1.25, rate: 1.0 },
    bromeando: { pitch: 1.3, rate: 1.05 },
    orgullosa: { pitch: 1.2, rate: 0.95 },
    tranquila: { pitch: 1.15, rate: 0.9 },
    preocupada: { pitch: 1.05, rate: 0.9 },
    frustrada: { pitch: 1.0, rate: 0.95 },
    enojada: { pitch: 1.0, rate: 0.95 },
  };
  const DEFAULT_PROSODY = { pitch: 1.2, rate: 0.95 };
  let activeProsody = DEFAULT_PROSODY;
  function prosodyFor(mood) {
    return MOOD_PROSODY[mood] || DEFAULT_PROSODY;
  }
  // Variación pequeña por oración (±0.03) para que no suene metronómica.
  function jitteredRate(base) {
    const r = base + (Math.random() * 0.06 - 0.03);
    return Math.min(1.05, Math.max(0.85, r));
  }
  // Pausa después de cada oración, según cómo termina: más larga tras
  // exclamación, pregunta o puntos suspensivos; corta tras punto o coma.
  function pauseAfter(sentence) {
    const t = String(sentence || "").trim().replace(/["»”')\]]+$/, "");
    const last = t.slice(-1);
    if (last === "!" || last === "?" || last === "…") return 350;
    if (last === "." || last === ",") return 150;
    return 200;
  }
  function setThinking(on) {
    thinkingNow = !!on;
    orb.classList.toggle("thinking", thinkingNow);
  }
  function splitSentences(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const parts = clean.match(/[^.!?…]+[.!?…]["»”')]*|[^.!?…]+$/g) || [];
    return parts.map((s) => s.trim()).filter(Boolean);
  }
  // --- audio de Kokoro: un solo elemento <audio> reutilizado.
  let kokoroAudio = null;
  let kokoroAudioUrl = null;
  // Resuelve la reproducción en curso (para cortar el audio al hablar
  // algo nuevo: pause() no dispara "ended").
  let kokoroPlayResolve = null;
  function stopKokoroAudio() {
    speakGen += 1; // invalida la síntesis en curso (oraciones pendientes)
    if (kokoroPlayResolve) {
      const r = kokoroPlayResolve;
      kokoroPlayResolve = null;
      r(false);
    }
    if (kokoroAudio) {
      try {
        kokoroAudio.pause();
      } catch (e) {}
      kokoroAudio.src = "";
      kokoroAudio = null;
    }
    if (kokoroAudioUrl) {
      try {
        URL.revokeObjectURL(kokoroAudioUrl);
      } catch (e) {}
      kokoroAudioUrl = null;
    }
  }
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms)
      ),
    ]);
  }
  // Genera el audio de una oración con Kokoro. Devuelve el Blob (WAV,
  // 24 kHz) o null si falló, si tardó demasiado o si ya se cortó la
  // locución (nuevo mensaje).
  async function generateKokoroSentence(sentence, gen) {
    try {
      const audio = await withTimeout(
        kokoroTTS.generate(sentence, { voice: selectedKokoroVoice }),
        KOKORO_GENERATE_TIMEOUT_MS
      );
      if (gen !== speakGen) return null;
      if (!audio || typeof audio.toBlob !== "function") return null;
      return audio.toBlob();
    } catch (e) {
      return null;
    }
  }
  // Reproduce un Blob de audio de Kokoro. Devuelve true si sonó
  // completo, false si se cortó o falló.
  function playKokoroBlob(blob, gen) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        kokoroPlayResolve = null;
        if (kokoroAudioUrl) {
          try {
            URL.revokeObjectURL(kokoroAudioUrl);
          } catch (e) {}
          kokoroAudioUrl = null;
        }
        resolve(ok);
      };
      let url = null;
      try {
        url = URL.createObjectURL(blob);
      } catch (e) {
        done(false);
        return;
      }
      kokoroAudioUrl = url;
      const audio = new Audio(url);
      kokoroAudio = audio;
      kokoroPlayResolve = (ok) => done(ok);
      audio.onplay = () => {
        if (gen !== speakGen) {
          done(false);
          return;
        }
        speakingNow = true;
        orb.classList.add("speaking");
        orb.classList.remove("listening");
      };
      audio.onended = () => {
        kokoroAudio = null;
        done(true);
      };
      audio.onerror = () => {
        kokoroAudio = null;
        done(false);
      };
      audio.play().catch(() => {
        kokoroAudio = null;
        done(false);
      });
    });
  }
  // Habla un texto con Kokoro, oración por oración, generando la
  // siguiente mientras suena la actual (para no esperar todo el texto
  // en un teléfono lento). Devuelve "" si habló todo, o el texto que
  // quedó sin hablar (para que la voz del teléfono lo diga).
  async function speakKokoro(text, gen) {
    const sentences = splitSentences(text);
    if (sentences.length === 0) return text;
    let idx = 0;
    let pending = generateKokoroSentence(sentences[0], gen);
    while (idx < sentences.length) {
      if (gen !== speakGen) return "";
      const blob = await pending;
      if (!blob) return sentences.slice(idx).join(" ");
      const nextIdx = idx + 1;
      if (nextIdx < sentences.length) {
        pending = generateKokoroSentence(sentences[nextIdx], gen);
      }
      const played = await playKokoroBlob(blob, gen);
      idx++;
      if (!played) {
        if (gen !== speakGen) return "";
        return sentences.slice(idx).join(" ");
      }
    }
    finishSpeaking();
    return "";
  }
  // Limpieza al terminar de hablar (sirve para la voz del teléfono y
  // para Kokoro): se quita el estado "hablando" y vuelve la escucha.
  function finishSpeaking() {
    speakingNow = false;
    orb.classList.remove("speaking");
    orb.classList.remove("listening");
    setOrbStatus(idleStatus());
    setTimeout(maybeStartWake, 800);
  }
  // speak(text, moodOverride): con Kokoro lista usa esa voz; si Kokoro
  // no está lista o falla (a la mitad o al inicio), usa la voz del
  // teléfono con lo que falte. Isis nunca se queda muda. Con Kokoro la
  // emoción la da la propia voz (no se toca pitch ni rate del audio).
  async function speak(text, moodOverride) {
    // La voz nunca lee marcadores de markdown: **negritas** y demás se
    // quitan antes de hablar, aquí, en el único punto por el que pasa
    // TODO lo que Isis dice (chat, Mitote, análisis, decisiones,
    // visión, sistemas, música, recordatorios, noticias, dinero).
    const clean = stripMarkdown(String(text || "").trim());
    if (!clean) return;
    // Cortar lo que esté sonando (sea Kokoro o la voz del teléfono).
    stopKokoroAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speakGen += 1;
    const gen = speakGen;
    if (kokoroState === "ready" && kokoroTTS) {
      const remaining = await speakKokoro(clean, gen);
      if (!remaining) return; // Kokoro habló todo.
      // Kokoro falló a la mitad: el resto con la voz del teléfono.
      speakPhone(remaining, moodOverride);
      return;
    }
    // Sin Kokoro (aún no descargada): la voz del teléfono de inmediato,
    // sin intentar descargar nada ni esperar. Solo un aviso breve junto
    // al orbe para que sepa dónde descargarla.
    if (kokoroState === "idle") {
      kokoroDownloadHint = true;
      updateKokoroStatus();
    }
    speakPhone(clean, moodOverride);
  }
  // Voz del teléfono (speechSynthesis): habla el texto con la prosodia
  // del ánimo actual (o del ánimo que se le pase, como "alegre" para la
  // prueba de voz). La prosodia se fija por mensaje completo, no por oración.
  function speakPhone(text, moodOverride) {
    if (!("speechSynthesis" in window)) return;
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;
    const gen = speakGen;
    speakQueue = sentences;
    activeProsody = prosodyFor(moodOverride || currentMood);
    speakNext(gen);
  }
  function speakNext(gen) {
    if (gen !== speakGen) return;
    if (speakQueue.length === 0) {
      finishSpeaking();
      return;
    }
    const sentence = speakQueue.shift();
    const u = new SpeechSynthesisUtterance(sentence);
    u.lang = "es-MX";
    const voice = pickSpanishVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || "es-MX";
    }
    u.pitch = activeProsody.pitch;
    u.rate = jitteredRate(activeProsody.rate);
    u.onstart = () => {
      speakingNow = true;
      orb.classList.add("speaking");
      orb.classList.remove("listening");
    };
    u.onend = () => setTimeout(() => speakNext(gen), pauseAfter(sentence));
    u.onerror = () => setTimeout(() => speakNext(gen), pauseAfter(sentence));
    window.speechSynthesis.speak(u);
  }
  function setOrbStatus(text) {
    orbStatus.textContent = text;
  }
  // Estado "en reposo" del orbe: depende de si la escucha continua está prendida.
  function idleStatus() {
    return wakeArmed && wakeEnabled
      ? "Di “Isis” para activarme"
      : "Toca el círculo para hablar";
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
      setTimeout(maybeStartWake, 1500);
    };
  }
  function startListening() {
    if (!recognition) return;
    stopWake(); // no dos reconocimientos a la vez: la escucha continua se pausa
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
    else {
      startListening();
      armWake(); // el primer toque es el gesto que enciende el micrófono
    }
  });

  // ---------------------------------------------------------- escucha continua ("Isis")
  // Solo funciona mientras la página está abierta y activa: el navegador
  // no deja arrancar el micrófono sin un gesto del usuario, así que la
  // escucha continua se prende con el primer toque al orbe (o con el
  // botón "Activar escucha") y de ahí sigue sola, reiniciándose sola
  // cuando Chrome la detiene tras un silencio o un resultado.
  let wakeEnabled = (localStorage.getItem(LS_WAKE) || "1") === "1";
  let wakeArmed = false;
  let wakeRunning = false;
  let wakeRecognition = null;
  let wakeRestartTimer = null;
  let wakeIntentionalStop = false;
  let awaitingCommand = false;
  let awaitingTimer = null;

  const wakeRow = $("wake-row");
  const wakeToggle = $("wake-toggle");
  const wakeBtn = $("btn-wake");

  function updateWakeUI() {
    if (wakeRow) wakeRow.hidden = !SpeechRecognition;
    if (wakeToggle) wakeToggle.checked = wakeEnabled;
    if (wakeBtn) {
      wakeBtn.hidden = !wakeEnabled || wakeArmed || !SpeechRecognition;
    }
  }

  function armWake() {
    if (!wakeEnabled || !SpeechRecognition) return;
    wakeArmed = true;
    updateWakeUI();
  }

  function setAwaitingCommand(on) {
    awaitingCommand = on;
    if (awaitingTimer) {
      clearTimeout(awaitingTimer);
      awaitingTimer = null;
    }
    if (on) {
      awaitingTimer = setTimeout(() => {
        awaitingCommand = false;
        orb.classList.remove("listening");
        setOrbStatus(idleStatus());
      }, 10000);
    }
  }

  function createWakeRecognition() {
    const r = new SpeechRecognition();
    r.lang = "es-MX";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = (res[0] && res[0].transcript) || "";
        if (!transcript.trim()) continue;
        if (/\bisis\b/i.test(transcript)) {
          handleWakeDetected(transcript);
          return;
        }
        if (awaitingCommand && res.isFinal) {
          setAwaitingCommand(false);
          stopWake();
          orb.classList.add("listening");
          setOrbStatus("Escuchando…");
          sendMessage(transcript.trim());
          return;
        }
      }
    };
    r.onend = () => {
      wakeRunning = false;
      if (wakeIntentionalStop) {
        wakeIntentionalStop = false;
        return;
      }
      scheduleWakeRestart();
    };
    r.onerror = (event) => {
      wakeRunning = false;
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        wakeArmed = false;
        setOrbStatus("El micrófono está bloqueado: toca el círculo para hablar");
        updateWakeUI();
        return;
      }
      scheduleWakeRestart();
    };
    return r;
  }

  function handleWakeDetected(transcript) {
    const idx = transcript.search(/\bisis\b/i);
    const after = transcript
      .slice(idx + 4)
      .replace(/^[\s,:\-–—]+/, "")
      .trim();
    setAwaitingCommand(false);
    if (after) {
      // "Isis, ¿cómo va Orlando?" → se procesa todo junto.
      stopWake();
      orb.classList.add("listening");
      setOrbStatus("Escuchando…");
      sendMessage(after);
    } else {
      // Solo "Isis": espera la siguiente frase como comando.
      setAwaitingCommand(true);
      orb.classList.add("listening");
      setOrbStatus("Te escucho… dime");
    }
  }

  function startWake() {
    if (!wakeEnabled || !wakeArmed || wakeRunning) return;
    if (!SpeechRecognition) return;
    if (!wakeRecognition) wakeRecognition = createWakeRecognition();
    try {
      wakeRunning = true;
      wakeIntentionalStop = false;
      wakeRecognition.start();
      setOrbStatus(
        awaitingCommand ? "Te escucho… dime" : "Di “Isis” para activarme"
      );
      updateWakeUI();
    } catch (e) {
      wakeRunning = false;
    }
  }

  function stopWake() {
    if (wakeRestartTimer) {
      clearTimeout(wakeRestartTimer);
      wakeRestartTimer = null;
    }
    if (wakeRecognition && wakeRunning) {
      wakeIntentionalStop = true;
      try {
        wakeRecognition.stop();
      } catch (e) {}
    }
    wakeRunning = false;
  }

  function scheduleWakeRestart() {
    if (!wakeEnabled || !wakeArmed) return;
    if (document.hidden) return;
    if (wakeRestartTimer) clearTimeout(wakeRestartTimer);
    wakeRestartTimer = setTimeout(() => {
      wakeRestartTimer = null;
      maybeStartWake();
    }, 400);
  }

  function maybeStartWake() {
    if (!wakeEnabled || !wakeArmed) return;
    if (wakeRunning || listening) return;
    if (thinkingNow || speakingNow) return;
    if (window.speechSynthesis && window.speechSynthesis.speaking) return;
    if (document.hidden) return;
    startWake();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopWake();
    else maybeStartWake();
  });

  if (wakeToggle) {
    wakeToggle.addEventListener("change", () => {
      wakeEnabled = wakeToggle.checked;
      localStorage.setItem(LS_WAKE, wakeEnabled ? "1" : "0");
      if (!wakeEnabled) {
        wakeArmed = false;
        setAwaitingCommand(false);
        stopWake();
        orb.classList.remove("listening");
        setOrbStatus("Toca el círculo para hablar");
      }
      updateWakeUI();
    });
  }
  if (wakeBtn) {
    wakeBtn.addEventListener("click", () => {
      armWake();
      maybeStartWake();
    });
  }

  // ---------------------------------------------------------- chat
  // Conversación plegable: colapsada por defecto. Colapsada solo se ve
  // la última respuesta de Isis en una línea (vista previa); al tocar la
  // cabecera se expande y se ve el chat completo. El dock y el campo para
  // escribir quedan siempre visibles.
  function setChatCollapsed(collapsed) {
    if (!chatCard || !chatBody || !chatToggle) return;
    chatCard.classList.toggle("collapsed", collapsed);
    chatBody.hidden = collapsed;
    chatToggle.setAttribute("aria-expanded", String(!collapsed));
    if (chatPreview) {
      chatPreview.hidden =
        !collapsed || !chatPreview.textContent.trim();
    }
    if (!collapsed) chatBox.scrollTop = chatBox.scrollHeight;
  }
  function updateChatPreview(text) {
    if (!chatPreview) return;
    // La vista previa es texto plano de una línea: sin marcadores.
    const t = stripMarkdown(String(text || "").trim());
    if (!t) return;
    chatPreview.textContent = t;
    if (chatCard && chatCard.classList.contains("collapsed")) {
      chatPreview.hidden = false;
    }
  }
  function addBubble(who, text, tag) {
    const div = document.createElement("div");
    div.className = "bubble " + who;
    if (tag) {
      const t = document.createElement("span");
      t.className = "tag";
      t.textContent = tag;
      div.appendChild(t);
    }
    // El texto se muestra con su formato: **negritas** y *cursivas* se
    // ven como tales (markdownToHtml escapa el HTML primero, así que
    // nada de lo que escriba Claude se ejecuta como código).
    const content = document.createElement("span");
    content.className = "bubble-text";
    content.innerHTML = markdownToHtml(text);
    div.appendChild(content);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    // La vista previa del panel colapsado es siempre la última respuesta.
    if (who === "isis") updateChatPreview(text);
    return div;
  }

  // El último mensaje que escribió Santiago: lo usa el historial para
  // guardar cada intercambio (lo que él dijo + lo último que Isis le
  // mostró y le dijo). Se fija al inicio de sendMessage.
  let lastUserText = "";
  // Mensaje final de un turno: burbuja + voz + se guarda en el historial.
  function sayFinal(tag, msg) {
    addBubble("isis", msg, tag);
    speak(msg);
    recordExchange(msg);
  }
  // Anuncio sin historial: burbuja + voz. Para acciones que nacen de
  // un botón (no de un mensaje de Santiago), el historial guardaría el
  // intercambio con el mensaje anterior y quedaría mal. `record` en true
  // lo guarda (comandos por voz); en false, no.
  function announce(tag, msg, record) {
    addBubble("isis", msg, tag);
    speak(msg);
    if (record) recordExchange(msg);
  }
  function recordExchange(isisText) {
    if (!lastUserText || !String(isisText || "").trim()) return;
    saveHistoryItem(lastUserText, String(isisText).trim());
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
        sayFinal("Clima", msg);
        return;
      }
      sayFinal("Clima · en vivo", data.summary);
    } catch (e) {
      sayFinal("Clima", "No pude consultar el clima ahora mismo.");
    }
  }

  // La respuesta de Claude para mandar un mensaje es solo un JSON:
  // {"action":"send_whatsapp","to":"...","message":"..."} o
  // {"action":"send_sms","to":"...","message":"..."}. Pero Claude a veces
  // escribe texto antes del JSON ("Claro, le escribo..."), así que el
  // JSON se busca EN CUALQUIER PARTE de la respuesta, no solo al inicio:
  // se extrae el primer objeto {...} balanceado que sea una acción válida.
  // Encuentra el primer objeto JSON balanceado {...} a partir de `from`,
  // respetando cadenas "..." (con escapes). Devuelve { obj, json, start,
  // end } o null. Si el objeto no es JSON válido, se sigue buscando desde
  // el siguiente "{".
  function findJsonObject(text, from) {
    const s = String(text || "");
    for (let start = from || 0; start < s.length; start++) {
      if (s[start] !== "{") continue;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const json = s.slice(start, i + 1);
            try {
              return { obj: JSON.parse(json), json, start, end: i + 1 };
            } catch (e) {
              break; // no era JSON válido; probar desde el siguiente "{"
            }
          }
        }
      }
    }
    return null;
  }
  // Busca en el texto la primera acción válida (según isValid) dentro de
  // un objeto JSON, esté donde esté: al inicio, después de texto, o dentro
  // de un bloque ```json. Devuelve { action, json, start, end } o null.
  function findAction(text, isValid) {
    const s = String(text || "");
    let offset = 0;
    while (offset < s.length) {
      const found = findJsonObject(s, offset);
      if (!found) return null;
      if (isValid(found.obj)) {
        return {
          action: found.obj,
          json: found.json,
          start: found.start,
          end: found.end,
        };
      }
      offset = found.end;
    }
    return null;
  }
  // Quita el JSON de acción del texto que se muestra y se habla. Si tras
  // quitarlo no queda texto con sentido, devuelve "".
  function stripActionJson(text, found) {
    if (!found) return String(text || "").trim();
    const rest = (
      String(text).slice(0, found.start) + String(text).slice(found.end)
    )
      .replace(/```(?:json)?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return rest;
  }
  function hasMeaningfulText(t) {
    return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{2,}/.test(String(t || ""));
  }
  function parseSendAction(reply) {
    if (!reply) return null;
    const text = String(reply)
      .replace(/\[ánimo:\s*[a-záéíóúñ]+\s*\]/gi, "")
      .trim();
    return findAction(
      text,
      (o) =>
        o &&
        (o.action === "send_whatsapp" || o.action === "send_sms") &&
        typeof o.to === "string" &&
        typeof o.message === "string"
    );
  }

  // La respuesta de Claude para operar El Mitote es solo un JSON:
  // {"action":"mitote","mitote_action":"<nombre>","params":{...}} o
  // {"action":"mitote_confirm","summary":"...","mitote_action":"<nombre>","params":{...}}
  // Igual que con los mensajes: el JSON se busca en cualquier parte de la
  // respuesta, porque Claude a veces escribe texto antes.
  function parseMitoteAction(reply) {
    if (!reply) return null;
    const text = String(reply)
      .replace(/\[ánimo:\s*[a-záéíóúñ]+\s*\]/gi, "")
      .trim();
    return findAction(
      text,
      (o) =>
        o &&
        (o.action === "mitote" || o.action === "mitote_confirm") &&
        typeof o.mitote_action === "string" &&
        o.mitote_action.trim()
    );
  }

  // ¿Es la misma acción de El Mitote con los mismos datos? El flag
  // `confirmed` no cuenta: la acción confirmada y la sin confirmar son
  // la misma acción. Se usa para no re-ejecutar lo que ya se ejecutó.
  function sameMitoteParams(a, b) {
    const strip = (p) => {
      const o = { ...(p || {}) };
      delete o.confirmed;
      return JSON.stringify(o);
    };
    return strip(a) === strip(b);
  }

  async function handleSendSms(action) {
    const to = String(action.to || "").trim();
    const message = String(action.message || "").trim();
    if (!message) {
      sayFinal("SMS", "¿Qué le escribo por SMS? Dime el mensaje y lo mando.");
      return;
    }
    const recipient = resolveRecipient(to);
    if (!recipient) {
      sayFinal(
        "SMS",
        `No tengo el número de ${to || "esa persona"}. Dime su número o agrégalo en Contactos y lo intento de nuevo.`
      );
      return;
    }
    const { textbeeKey, textbeeDevice } = getKeys();
    if (!textbeeKey) {
      sayFinal(
        "SMS",
        "Falta la clave de TextBee en Configuración. Pégala ahí y lo intento de nuevo."
      );
      return;
    }
    setOrbStatus("Isis está escribiendo…");
    try {
      const { ok, data } = await postJSON("/api/send-sms", {
        to: recipient.number,
        message,
        textbeeKey,
        textbeeDevice: textbeeDevice || undefined,
      });
      if (ok && data.ok) {
        sayFinal(
          "SMS · enviado",
          `Listo, le mandé el SMS a ${recipient.name} desde tu número: ${message}`
        );
      } else {
        sayFinal("SMS", data.error || "No pude mandar el SMS.");
      }
    } catch (e) {
      sayFinal("SMS", "No pude hablar con el servidor ahora mismo.");
    }
    setOrbStatus(idleStatus());
  }

  async function handleSendWhatsapp(action) {
    const to = String(action.to || "").trim();
    const message = String(action.message || "").trim();
    if (!message) {
      sayFinal("WhatsApp", "¿Qué le escribo? Dime el mensaje y lo mando.");
      return;
    }
    const recipient = resolveRecipient(to);
    if (!recipient) {
      sayFinal(
        "WhatsApp",
        `No tengo el número de ${to || "esa persona"}. Dime su número o agrégalo en Contactos y lo intento de nuevo.`
      );
      return;
    }
    const { whatsappToken } = getKeys();
    if (!whatsappToken) {
      sayFinal(
        "WhatsApp",
        "Falta el token de WhatsApp en Configuración. Pégalo ahí y lo intento de nuevo."
      );
      return;
    }
    setOrbStatus("Isis está escribiendo…");
    try {
      const { ok, data } = await postJSON("/api/send-whatsapp", {
        to: recipient.number,
        message,
        whatsappToken,
      });
      if (ok && data.ok) {
        sayFinal(
          "WhatsApp · enviado",
          `Listo, le escribí a ${recipient.name}: ${message}`
        );
      } else {
        sayFinal("WhatsApp", data.error || "No pude mandar el mensaje.");
      }
    } catch (e) {
      sayFinal("WhatsApp", "No pude hablar con el servidor ahora mismo.");
    }
    setOrbStatus(idleStatus());
  }

  // ---------------------------------------------------------- el mitote
  // Operar El Mitote por voz: Claude responde con un JSON mitote (lectura
  // o bajo riesgo) o mitote_confirm (destructivo). El token de El Mitote
  // NUNCA sale del servidor: el cliente solo manda {action, params} al
  // proxy y el servidor pone el Bearer.
  // Confirmación en dos pasos para lo destructivo: la acción queda
  // pendiente (solo en memoria, nunca se guarda) hasta que Santiago diga
  // que sí en el siguiente turno. Solo un "sí" explícito la ejecuta; un
  // "no" o cualquier otra cosa la descarta.
  let pendingMitote = null;
  function normalizeAnswer(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function isAffirmative(text) {
    const t = normalizeAnswer(text);
    return /^(si|confirmo|confirmado|adelante|dale|va|ok|orale|hazlo|claro|de acuerdo|por supuesto)\b/.test(t);
  }
  function isNegative(text) {
    const t = normalizeAnswer(text);
    return /^(no|cancela|mejor no|olvidalo|no lo hagas|nel|nop)\b/.test(t);
  }

  function storeMitoteConfirm(action, fableaiKey, originalText) {
    pendingMitote = {
      mitote_action: action.mitote_action,
      params: action.params || {},
      summary: action.summary || "",
      actionLabel: action.actionLabel || "",
      originalText: originalText || null,
      fableaiKey: fableaiKey || null,
    };
    // La pregunta: con el resumen de Claude ("Voy a cerrar el turno…")
    // o, si la confirmación la exige el servidor (403), con la etiqueta
    // de la acción ("creación de producto").
    const ask = action.summary
      ? `Voy a ${action.summary}. ¿Confirmas?`
      : action.actionLabel
        ? `Esta acción (${action.actionLabel}) necesita tu confirmación. ¿Confirmas?`
        : "Esta acción necesita tu confirmación. ¿Confirmas?";
    const bubble = addBubble("isis", ask, "El Mitote · confirmar");
    // Confirmar por botón, además de por voz: los dos caminos resuelven
    // la MISMA pendiente (resolveMitoteConfirm), así que no hay forma
    // de que la confirmación se pierda por el camino elegido.
    const row = document.createElement("div");
    row.className = "confirm-row";
    const yesBtn = document.createElement("button");
    yesBtn.className = "small-btn";
    yesBtn.textContent = "✓ Sí, hazlo";
    yesBtn.addEventListener("click", () => resolveMitoteConfirm(true));
    const noBtn = document.createElement("button");
    noBtn.className = "small-btn danger";
    noBtn.textContent = "✕ No, mejor no";
    noBtn.addEventListener("click", () => resolveMitoteConfirm(false));
    row.appendChild(yesBtn);
    row.appendChild(noBtn);
    bubble.appendChild(row);
    speak(ask);
    recordExchange(ask);
    setOrbStatus("Te espero: ¿confirmas?");
  }

  // Resuelve la confirmación pendiente de El Mitote, venga por voz
  // ("sí"/"no") o por botón. La pendiente se consume UNA sola vez: el
  // segundo intento (doble toque, doble "sí") ya no encuentra nada que
  // resolver y no vuelve a ejecutar. Con "sí", la acción se manda con
  // confirmed: true y se ejecuta; con "no", se descarta.
  async function resolveMitoteConfirm(affirmative) {
    const pending = pendingMitote;
    pendingMitote = null;
    if (!pending) return;
    if (affirmative) {
      setThinking(true);
      const params = { ...(pending.params || {}), confirmed: true };
      await runMitoteChain(
        pending.fableaiKey,
        pending.originalText || "",
        pending.mitote_action,
        params,
        0
      );
      setThinking(false);
      if (!pendingMitote) setOrbStatus(idleStatus());
      setTimeout(maybeStartWake, 1200);
      return;
    }
    sayFinal("El Mitote", "Listo, no lo hago.");
    setOrbStatus(idleStatus());
    setTimeout(maybeStartWake, 1200);
  }

  async function callMitoteProxy(mitoteAction, params) {
    return postJSON("/api/mitote", { action: mitoteAction, params: params || {} });
  }

  // Ejecuta una acción de El Mitote y le devuelve el resultado a Claude
  // para que pida el siguiente paso o el resumen final (por ejemplo,
  // cobrar: leer cuenta → pedir cuenta → cobrar → cerrar). Máximo 6
  // pasos por cadena, para no entrar en bucle.
  async function runMitoteChain(fableaiKey, originalText, firstAction, firstParams, depth) {
    const step = depth || 0;
    if (step >= 6) {
      sayFinal(
        "El Mitote",
        "Ya hice varios pasos en El Mitote, mejor revisamos juntos qué falta."
      );
      return;
    }
    setOrbStatus("Isis está trabajando en El Mitote…");
    let result;
    try {
      result = await callMitoteProxy(firstAction, firstParams);
    } catch (e) {
      const msg = "No pude hablar con el servidor ahora mismo.";
      addBubble("isis", msg, "El Mitote");
      speak(msg);
      setOrbStatus(idleStatus());
      return;
    }
    const d = result.data || {};
    if (!result.ok) {
      // El servidor exige confirmación (403 con needsConfirmation):
      // ANTES aquí solo se mostraba el error y la pendiente nunca se
      // armaba, así que el "sí" de Santiago volvía al chat, Claude
      // mandaba la acción directa otra vez y el error se repetía en
      // bucle. AHORA se arma la confirmación pendiente con la acción y
      // sus datos, y el próximo "sí" (por voz o por botón) la ejecuta
      // con confirmed: true.
      if (d.needsConfirmation || /necesita confirmación/.test(d.error || "")) {
        storeMitoteConfirm(
          {
            mitote_action: firstAction,
            params: firstParams,
            summary: "",
            actionLabel: d.actionLabel || "",
          },
          fableaiKey,
          originalText
        );
        return;
      }
      sayFinal("El Mitote", d.error || "El Mitote no aceptó esa acción.");
      setOrbStatus(idleStatus());
      return;
    }
    const note = d.notice ? d.notice + " " : "";
    const summary = d.summary || "Listo.";
    // PDF (pre-cuenta, ticket, reporte): se abre para imprimirlo y se
    // deja también un enlace en el chat por si el navegador lo bloquea.
    if (d.pdfBase64) {
      try {
        const bin = atob(d.pdfBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: d.contentType || "application/pdf" });
        const url = URL.createObjectURL(blob);
        const bubble = addBubble("isis", note + summary + " Te dejé el PDF para imprimirlo.", "El Mitote");
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Abrir PDF para imprimir";
        a.style.display = "block";
        a.style.marginTop = "6px";
        bubble.appendChild(a);
        try { window.open(url, "_blank"); } catch (e) {}
      } catch (e) {
        addBubble("isis", note + summary, "El Mitote");
      }
    } else {
      addBubble("isis", note + summary, "El Mitote");
    }
    // Sin clave de Claude no hay cadena: se habla el resumen y listo.
    if (!fableaiKey) {
      speak(note + summary);
      recordExchange(note + summary);
      setOrbStatus(idleStatus());
      return;
    }
    try {
      const followUp =
        `Santiago te pidió: "${originalText || ""}". ` +
        `Ya ejecuté la acción de El Mitote "${firstAction}" y el restaurante respondió: ${JSON.stringify(d.data ?? d)}. ` +
        `Si falta un paso para completar lo que pidió, responde SOLO con el siguiente JSON (mitote o mitote_confirm). ` +
        `Si ya está completo, responde con el resumen final para Santiago, en español y breve, con el marcador de ánimo.`;
      const chatRes = await postJSON("/api/chat", {
        message: followUp,
        fableaiKey,
        facts: loadFacts(),
        history: loadHistory().map((h) => ({ u: h.u, i: h.i })),
        summary: loadSummary(),
      });
      if (!chatRes.ok || !chatRes.data.reply) {
        speak(note + summary);
        recordExchange(note + summary);
        setOrbStatus(idleStatus());
        return;
      }
      const { text: cleanReply, mood } = processClaudeReply(chatRes.data.reply);
      if (mood) setMood(mood);
      const nextFound = parseMitoteAction(cleanReply);
      if (nextFound) {
        const next = nextFound.action;
        // Guardia contra el bucle: si Claude pide OTRA VEZ la misma
        // acción con los mismos datos que se acaban de ejecutar, no se
        // re-ejecuta ni se vuelve a pedir confirmación: la cadena se
        // cierra con el resumen. Los pasos legítimos (cobrar: leer
        // cuenta → pedir cuenta → cobrar → cerrar) siempre usan
        // acciones DISTINTAS, así que repetir la misma es un error de
        // Claude, no un paso nuevo.
        if (
          next.mitote_action === firstAction &&
          sameMitoteParams(next.params, firstParams)
        ) {
          const rest = stripActionJson(cleanReply, nextFound);
          const finalText = hasMeaningfulText(rest)
            ? rest
            : note + summary;
          addBubble("isis", finalText, "Isis");
          speak(finalText);
          recordExchange(finalText);
          setOrbStatus(idleStatus());
          return;
        }
        // Claude escribió texto antes del JSON: se muestra el texto sin el
        // JSON y luego se ejecuta la acción.
        const rest = stripActionJson(cleanReply, nextFound);
        if (hasMeaningfulText(rest)) {
          addBubble("isis", rest, "Isis");
          speak(rest);
        }
        if (next.action === "mitote_confirm") {
          storeMitoteConfirm(next, fableaiKey, originalText);
        } else {
          await runMitoteChain(fableaiKey, originalText, next.mitote_action, next.params || {}, step + 1);
        }
      } else {
        addBubble("isis", cleanReply, "Isis");
        speak(cleanReply);
        recordExchange(cleanReply);
      }
    } catch (e) {
      speak(note + summary);
      recordExchange(note + summary);
    }
    if (!pendingMitote) setOrbStatus(idleStatus());
  }

  async function sendMessage(text) {
    lastUserText = text;
    addBubble("user", text);
    chatInput.value = "";

    // Confirmación pendiente de El Mitote: solo un "sí" explícito ejecuta.
    // Por voz o por botón es lo mismo: resolveMitoteConfirm. Cualquier
    // otra cosa la descarta y el mensaje sigue normal.
    if (pendingMitote) {
      if (isAffirmative(text)) {
        await resolveMitoteConfirm(true);
        return;
      }
      if (isNegative(text)) {
        await resolveMitoteConfirm(false);
        return;
      }
      pendingMitote = null;
      addBubble("isis", "De acuerdo, dejamos eso sin hacer.", "El Mitote");
    }

    // Clima: siempre por /api/weather, nunca culpar a la clave de Claude.
    if (isWeatherQuestion(text)) {
      await handleWeather();
      setTimeout(maybeStartWake, 1200);
      return;
    }
    // Funciones JARVIS: escaneo visual, reporte de sistemas y análisis
    // de decisiones. Se detectan aquí (voz o texto) y no pasan por el
    // chat normal.
    if (isVisionRequest(text)) {
      openPanel("panel-scan");
      setOrbStatus("Toma la foto y te digo qué veo");
      speak("Toma la foto y te digo qué veo.");
      triggerScanCamera();
      setTimeout(maybeStartWake, 1200);
      return;
    }
    if (isSystemsRequest(text)) {
      await runSystemsCheck(true, false);
      setTimeout(maybeStartWake, 1200);
      return;
    }
    const decisionText = extractDecision(text);
    if (decisionText !== null) {
      if (!decisionText) {
        sayFinal("Análisis", "¿Qué decisión quieres que analice? Dímela y la reviso.");
      } else {
        await runDecide(decisionText, true);
      }
      setTimeout(maybeStartWake, 1200);
      return;
    }
    // Funciones JARVIS, segunda tanda: recordatorios y temporizadores
    // (antes que música: "pon un temporizador" también empieza con "pon"),
    // música, noticias y dinero. Se detectan aquí y no pasan por el chat.
    const reminderCmd = extractReminder(text);
    if (reminderCmd) {
      await runReminderCommand(reminderCmd);
      setTimeout(maybeStartWake, 1200);
      return;
    }
    const musicCmd = extractMusic(text);
    if (musicCmd) {
      await runMusicCommand(musicCmd, true);
      setTimeout(maybeStartWake, 1200);
      return;
    }
    if (isNewsRequest(text)) {
      await runNews(true);
      setTimeout(maybeStartWake, 1200);
      return;
    }
    const moneyCounts = extractMoneyCounts(text);
    if (Object.keys(moneyCounts).length) {
      runMoneySet(moneyCounts);
      setTimeout(maybeStartWake, 1200);
      return;
    }
    if (isMoneyQuestion(text)) {
      await runMoneyQuestion(true);
      setTimeout(maybeStartWake, 1200);
      return;
    }
    setThinking(true);

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
        history: loadHistory().map((h) => ({ u: h.u, i: h.i })),
        summary: loadSummary(),
      });
      if (!ok && data.error) {
        addBubble("isis", data.error, "Isis");
        speak(data.error);
        recordExchange(data.error);
      } else if (data.reply) {
        // Los marcadores ([memoria:], [resumen:], [ánimo:]) no se muestran
        // en el chat ni se leen en voz alta; lo aprendido se guarda.
        const { text: cleanReply, mood } = processClaudeReply(data.reply);
        if (mood) setMood(mood);
        const sendFound = parseSendAction(cleanReply);
        if (sendFound) {
          // Claude escribió texto antes del JSON: se muestra el texto sin
          // el JSON y luego se ejecuta el envío.
          const rest = stripActionJson(cleanReply, sendFound);
          if (hasMeaningfulText(rest)) {
            addBubble("isis", rest, "Isis");
            speak(rest);
          }
          const action = sendFound.action;
          if (action.action === "send_sms") await handleSendSms(action);
          else await handleSendWhatsapp(action);
        } else {
          const mitoteFound = parseMitoteAction(cleanReply);
          if (mitoteFound) {
            const rest = stripActionJson(cleanReply, mitoteFound);
            if (hasMeaningfulText(rest)) {
              addBubble("isis", rest, "Isis");
              speak(rest);
            }
            const mitote = mitoteFound.action;
            if (mitote.action === "mitote_confirm") {
              storeMitoteConfirm(mitote, fableaiKey, text);
            } else {
              await runMitoteChain(fableaiKey, text, mitote.mitote_action, mitote.params || {}, 0);
            }
          } else {
            addBubble("isis", cleanReply, data.claudeLive ? "Isis · Claude en vivo" : "Isis");
            speak(cleanReply);
            recordExchange(cleanReply);
          }
        }
        if (data.needsKey) refreshKeyUI();
      } else {
        addBubble("isis", "No pude responder ahora mismo.", "Isis");
        recordExchange("No pude responder ahora mismo.");
      }
    } catch (e) {
      const msg = "No pude hablar con el servidor ahora mismo.";
      addBubble("isis", msg, "Isis");
      speak(msg);
      recordExchange(msg);
    }
    setThinking(false);
    orb.classList.remove("listening");
    // Si quedó una confirmación de El Mitote pendiente, el orbe sigue
    // diciendo "Te espero: ¿confirmas?" (lo puso storeMitoteConfirm);
    // si no, vuelve al estado normal.
    if (!pendingMitote) setOrbStatus(idleStatus());
    setTimeout(maybeStartWake, 1200);
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
      ${d.message ? `<p class="muted">${markdownToHtml(d.message)}</p>` : ""}
      ${d.error ? `<p class="muted">${markdownToHtml(d.error)}</p>` : ""}
    `;
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  // ---------------------------------------------------------- markdown
  // Claude responde con markdown (**negritas**, *cursivas*, `código`,
  // ## títulos). En pantalla eso debe VERSE como negritas/cursivas, no
  // como asteriscos crudos; y en voz no debe leerse ningún marcador.
  // markdownToHtml: escapa el HTML y convierte el markdown a HTML
  // seguro (para burbujas y paneles, con innerHTML). stripMarkdown:
  // quita TODOS los marcadores y deja texto plano (para la voz y la
  // vista previa de la conversación). Ninguna de las dos inventa nada:
  // solo formatea lo que Claude ya escribió.
  function markdownToHtml(text) {
    let html = escapeHtml(String(text || ""));
    // Bloques de código y código en línea: se queda el contenido.
    html = html.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""));
    html = html.replace(/`([^`\n]+)`/g, "$1");
    // Títulos: "## Título" -> "Título" (al inicio de cada línea).
    html = html.replace(/^#{1,6}\s+/gm, "");
    // Negritas **x** y __x__.
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    // Cursivas *x*: solo cuando el * abre tras inicio/espacio y cierra
    // antes de espacio o puntuación (para no tocar "5 * 3" ni "2x1").
    html = html.replace(
      /(^|[\s(>])\*([^*\n]+?)\*(?=$|[\s).,!?;:])/g,
      "$1<em>$2</em>"
    );
    return html;
  }
  function stripMarkdown(text) {
    let t = String(text || "");
    t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""));
    t = t.replace(/`([^`\n]+)`/g, "$1");
    t = t.replace(/^#{1,6}\s+/gm, "");
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
    t = t.replace(/__([^_]+)__/g, "$1");
    t = t.replace(/(^|[\s(>])\*([^*\n]+?)\*(?=$|[\s).,!?;:])/g, "$1$2");
    // Cualquier asterisco que quede (viñetas "* item", asteriscos
    // sueltos): fuera, para que la voz nunca diga "asterisco".
    t = t.replace(/\*/g, "");
    return t;
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
        summary: loadSummary(),
      });
      if (!ok && data.error) {
        analysisBox.innerHTML = `<p>${markdownToHtml(data.error)}</p>`;
        return;
      }
      // Por si Claude devuelve marcadores en el análisis, se quitan de
      // la pantalla (aquí no se guarda memoria: no es una conversación).
      const mem = extractMemory(data.analysis || "");
      const { text: cleanAnalysis, mood } = extractMood(mem.text);
      if (mood) setMood(mood);
      analysisBox.innerHTML = markdownToHtml(cleanAnalysis || "Sin análisis.");
    } catch (e) {
      analysisBox.innerHTML =
        "<p>No pude hacer el análisis ahora mismo.</p>";
    }
  });

  // ---------------------------------------------------------- funciones JARVIS
  // Escaneo visual, reporte de sistemas, alertas proactivas y análisis
  // de decisiones. Todo vive en el menú hamburguesa; la pantalla
  // principal sigue minimalista.
  function isVisionRequest(text) {
    return /¿?qu[eé] ves|escanea(r)?\b|qu[eé] hay (aqu[ií]|alrededor|en (la |esta )?foto)/i.test(text);
  }
  function isSystemsRequest(text) {
    return /reporte de sistemas|revisa(r)? (los )?sistemas|diagn[oó]stico (de )?sistemas|c[oó]mo van los sistemas|estado de los sistemas|todos los sistemas/i.test(text);
  }
  function isDecisionRequest(text) {
    return /anal[ií]zame (esta )?(decisi[oó]n|esto)|analiza (esta |mi )?decisi[oó]n|¿?me conviene|deber[ií]a|pros y contras|qu[eé] me recomiendas/i.test(text);
  }
  // Saca la decisión del mensaje: si solo dice "analízame esta decisión"
  // sin decir cuál, devuelve "" para preguntarle cuál es. Si no es una
  // petición de decisión, devuelve null.
  function extractDecision(text) {
    const t = String(text || "").trim().replace(/^isis[,\s:–—-]*/i, "");
    let m;
    m = t.match(/anal[ií]zame (?:esta )?(?:decisi[oó]n|esto)[\s:,\-–—]*/i);
    if (m) return t.slice(m[0].length).trim();
    m = t.match(/analiza (?:esta |mi )?decisi[oó]n[\s:,\-–—]*/i);
    if (m) return t.slice(m[0].length).trim();
    if (/¿?me conviene/i.test(t) || /deber[ií]a/i.test(t)) return t;
    m = t.match(/pros y contras (?:de )?(.+)/i);
    if (m) return m[1].trim();
    m = t.match(/qu[eé] me recomiendas (?:sobre |para )?(.+)/i);
    if (m) return m[2].trim();
    if (isDecisionRequest(t)) return "";
    return null;
  }

  // --- escaneo visual (cámara trasera, foto única) ---
  const scanFile = $("scan-file");
  const scanPreview = $("scan-preview");
  const scanQuestion = $("scan-question");
  const scanResult = $("scan-result");
  function triggerScanCamera() {
    if (scanFile) {
      try {
        scanFile.click();
      } catch (e) {}
    }
  }
  const btnScan = $("btn-scan");
  if (btnScan) btnScan.addEventListener("click", triggerScanCamera);
  // Reduce la foto a 1024 px (JPEG 0.82) antes de mandarla: una foto
  // de teléfono pesa varios MB y el servidor no necesita más. Si el
  // navegador no puede reducirla, se manda la original.
  function downscalePhoto(dataUrl) {
    return new Promise((resolve) => {
      try {
        if (typeof Image === "undefined") return resolve(dataUrl);
        const img = new Image();
        img.onload = () => {
          try {
            const max = 1024;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(dataUrl);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          } catch (e) {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch (e) {
        resolve(dataUrl);
      }
    });
  }
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
  }
  async function analyzePhoto(dataUrl) {
    const { fableaiKey } = getKeys();
    const question =
      (scanQuestion && scanQuestion.value.trim()) || "¿Qué ves en esta foto?";
    lastUserText = question;
    if (scanResult)
      scanResult.innerHTML = '<p class="loading">ESCANEANDO…</p>';
    setOrbStatus("Isis está mirando la foto…");
    setThinking(true);
    try {
      const { ok, data } = await postJSON("/api/vision", {
        image: dataUrl,
        question,
        fableaiKey,
      });
      setThinking(false);
      if (!ok || !data.analysis) {
        const msg =
          (data && data.error) || "No pude analizar la foto ahora mismo.";
        if (scanResult) scanResult.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
        sayFinal("Escaneo", msg);
        setOrbStatus(idleStatus());
        return;
      }
      const { text: cleanAnalysis, mood } = processClaudeReply(data.analysis);
      if (mood) setMood(mood);
      if (scanResult)
        scanResult.innerHTML = markdownToHtml(cleanAnalysis || "Sin análisis.");
      addBubble("isis", cleanAnalysis, "Escaneo");
      speak(cleanAnalysis);
      recordExchange(cleanAnalysis);
    } catch (e) {
      setThinking(false);
      const msg = "No pude analizar la foto ahora mismo.";
      if (scanResult) scanResult.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
      sayFinal("Escaneo", msg);
    }
    setOrbStatus(idleStatus());
  }
  if (scanFile) {
    scanFile.addEventListener("change", async () => {
      const file = scanFile.files && scanFile.files[0];
      scanFile.value = "";
      if (!file) return;
      try {
        const original = await readFileAsDataURL(file);
        if (scanPreview) {
          scanPreview.src = original;
          scanPreview.hidden = false;
        }
        const small = await downscalePhoto(original);
        await analyzePhoto(small);
      } catch (e) {
        const msg = "No pude leer esa foto. Tómala de nuevo.";
        if (scanResult) scanResult.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
        sayFinal("Escaneo", msg);
      }
    });
  }

  // --- reporte de sistemas (JARVIS) ---
  const systemsResult = $("systems-result");
  let systemsAutoChecked = false;
  function getBatteryInfo() {
    if (!navigator.getBattery) return Promise.resolve(null);
    return Promise.race([
      navigator
        .getBattery()
        .then((b) => ({ level: b.level, charging: !!b.charging }))
        .catch(() => null),
      new Promise((r) => setTimeout(() => r(null), 2000)),
    ]);
  }
  function renderSystemsReport(report) {
    if (!systemsResult) return;
    const checks = (report && report.checks) || {};
    const order = [
      ["isis", "Isis"],
      ["orlando", "Orlando · Bot PCN"],
      ["mitote", "El Mitote"],
      ["phone", "Teléfono"],
    ];
    const rows = order
      .map(([key, label]) => {
        const c = checks[key] || { status: "unknown", detail: "Sin datos." };
        const cls =
          c.status === "ok"
            ? "ok"
            : c.status === "warn"
              ? "warn"
              : c.status === "down"
                ? "down"
                : "unknown";
        const dot =
          c.status === "ok"
            ? "●"
            : c.status === "warn"
              ? "◐"
              : c.status === "down"
                ? "✕"
                : "○";
        return `<div class="sys-row ${cls}"><span class="sys-dot" aria-hidden="true">${dot}</span><span class="sys-label">${markdownToHtml(label)}</span><span class="sys-detail">${markdownToHtml(c.detail || "")}</span></div>`;
      })
      .join("");
    const alerts = Array.isArray(report.alerts) ? report.alerts : [];
    const alertsHtml = alerts.length
      ? `<div class="sys-alerts">${alerts
          .map(
            (a) =>
              `<p class="sys-alert"><strong>⚠ ${markdownToHtml(a.message)}</strong><br><span class="muted">${markdownToHtml(a.action || "")}</span></p>`
          )
          .join("")}</div>`
      : "";
    systemsResult.innerHTML = `
      <p class="sys-verdict">${markdownToHtml(report.verdict || "")}</p>
      ${rows}
      ${alertsHtml}
      <p class="muted small">Revisado ${report.checkedAt ? new Date(report.checkedAt).toLocaleString("es-MX") : "ahora mismo"}.</p>`;
  }
  function systemsSpokenSummary(report) {
    const alerts = Array.isArray(report.alerts) ? report.alerts : [];
    if (!alerts.length) return "Todos los sistemas operando.";
    if (alerts.length === 1)
      return `Ojo, Santiago: ${alerts[0].message} ${alerts[0].action || ""}`;
    return `Ojo, Santiago: hay ${alerts.length} alertas. ${alerts
      .map((a) => a.message)
      .join(" ")}`;
  }
  // Revisa los sistemas. speakIt: lo dice por voz (reporte pedido).
  // auto: revisión al abrir la app — solo avisa si hay alertas, y no
  // bloquea nada: en segundo plano, una sola vez por carga.
  async function runSystemsCheck(speakIt, auto) {
    const { n8nKey } = getKeys();
    if (systemsResult && !auto)
      systemsResult.innerHTML = '<p class="loading">REVISANDO SISTEMAS…</p>';
    if (!auto) setOrbStatus("Isis está revisando los sistemas…");
    let battery = null;
    try {
      battery = await getBatteryInfo();
    } catch (e) {}
    try {
      const { ok, data } = await postJSON("/api/systems", { n8nKey, battery });
      if (!ok || !data.checks) {
        const msg =
          (data && data.error) || "No pude revisar los sistemas ahora mismo.";
        if (!auto && systemsResult)
          systemsResult.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
        if (speakIt) sayFinal("Sistemas", msg);
        if (!auto) setOrbStatus(idleStatus());
        return null;
      }
      renderSystemsReport(data);
      const alerts = Array.isArray(data.alerts) ? data.alerts : [];
      if (speakIt) {
        const spoken = systemsSpokenSummary(data);
        addBubble("isis", spoken, "Sistemas");
        speak(spoken);
        recordExchange(spoken);
      } else if (auto && alerts.length) {
        // Al abrir: solo si hay algo mal — banner visible + se lo dice
        // (si no está hablando de otra cosa en ese momento).
        showAlerts(alerts);
        const spoken = systemsSpokenSummary(data);
        addBubble("isis", spoken, "Sistemas · alerta");
        if (!speakingNow && !thinkingNow) speak(spoken);
        recordExchange(spoken);
      } else if (auto) {
        hideAlerts();
      }
      if (!auto) setOrbStatus(idleStatus());
      return data;
    } catch (e) {
      const msg = "No pude revisar los sistemas ahora mismo.";
      if (!auto && systemsResult)
        systemsResult.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
      if (speakIt) sayFinal("Sistemas", msg);
      if (!auto) setOrbStatus(idleStatus());
      return null;
    }
  }
  const btnSystems = $("btn-systems");
  if (btnSystems)
    btnSystems.addEventListener("click", () => runSystemsCheck(true, false));

  // --- alertas proactivas (banner visible en la pantalla principal) ---
  const alertsBanner = $("alerts-banner");
  const alertsText = $("alerts-text");
  function showAlerts(alerts) {
    if (!alertsBanner || !alertsText) return;
    const list = Array.isArray(alerts) ? alerts : [];
    if (!list.length) {
      hideAlerts();
      return;
    }
    alertsText.textContent =
      list.length === 1
        ? `⚠ ${list[0].message}`
        : `⚠ Hay ${list.length} alertas: ${list[0].message}`;
    alertsBanner.hidden = false;
  }
  function hideAlerts() {
    if (alertsBanner) alertsBanner.hidden = true;
  }
  const alertsViewBtn = $("alerts-view");
  if (alertsViewBtn)
    alertsViewBtn.addEventListener("click", () => {
      hideAlerts();
      openPanel("panel-systems");
    });
  const alertsDismissBtn = $("alerts-dismiss");
  if (alertsDismissBtn)
    alertsDismissBtn.addEventListener("click", hideAlerts);

  // --- análisis de decisiones (modo del módulo Análisis) ---
  const decisionInput = $("decision-input");
  const decisionResult = $("decision-result");
  async function runDecide(decision, fromVoice) {
    const { fableaiKey } = getKeys();
    const d = String(decision || "").trim();
    if (!d) {
      if (decisionResult)
        decisionResult.innerHTML =
          "<p>Dime qué decisión quieres analizar.</p>";
      return null;
    }
    if (decisionResult)
      decisionResult.innerHTML = '<p class="loading">ANALIZANDO DECISIÓN…</p>';
    setOrbStatus("Isis está analizando la decisión…");
    setThinking(true);
    try {
      const { ok, data } = await postJSON("/api/decide", {
        decision: d,
        fableaiKey,
        facts: loadFacts(),
        summary: loadSummary(),
      });
      setThinking(false);
      if (!ok || !data) {
        const msg =
          (data && data.error) ||
          "No pude analizar la decisión ahora mismo.";
        if (decisionResult)
          decisionResult.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
        sayFinal("Análisis", msg);
        setOrbStatus(idleStatus());
        return null;
      }
      // Resultado estructurado: veredicto, pros, contras, recomendación.
      const pros = Array.isArray(data.pros) ? data.pros : [];
      const cons = Array.isArray(data.cons) ? data.cons : [];
      const verdict = String(data.verdict || "").trim();
      const rec = String(data.recommendation || "").trim();
      if (decisionResult) {
        decisionResult.innerHTML = `
          <p class="dec-verdict">${markdownToHtml(verdict || "Sin veredicto.")}</p>
          ${pros.length ? `<p class="dec-head">A favor</p><ul class="dec-list pros">${pros.map((p) => `<li>${markdownToHtml(p)}</li>`).join("")}</ul>` : ""}
          ${cons.length ? `<p class="dec-head">En contra</p><ul class="dec-list cons">${cons.map((c) => `<li>${markdownToHtml(c)}</li>`).join("")}</ul>` : ""}
          ${rec ? `<p class="dec-rec"><strong>Recomendación:</strong> ${markdownToHtml(rec)}</p>` : ""}`;
      }
      // Se habla solo lo corto: el veredicto y la recomendación.
      const spoken = rec
        ? `Mi veredicto: ${verdict} ${rec}`
        : verdict || "No tengo un veredicto claro.";
      addBubble("isis", spoken, "Análisis · decisión");
      speak(spoken);
      if (fromVoice) recordExchange(spoken);
      setOrbStatus(idleStatus());
      return data;
    } catch (e) {
      setThinking(false);
      const msg = "No pude analizar la decisión ahora mismo.";
      if (decisionResult)
        decisionResult.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
      sayFinal("Análisis", msg);
      setOrbStatus(idleStatus());
      return null;
    }
  }
  const btnDecide = $("btn-decide");
  if (btnDecide) {
    btnDecide.addEventListener("click", () => {
      const d = decisionInput ? decisionInput.value.trim() : "";
      if (!d) {
        if (decisionResult)
          decisionResult.innerHTML =
            "<p>Escribe la decisión arriba primero.</p>";
        return;
      }
      runDecide(d, false);
    });
  }

  // ---------------------------------------------------------- funciones JARVIS (2ª tanda)
  // Música (Spotify), recordatorios y temporizadores, noticias y
  // dinero. Todo vive en el menú hamburguesa; la pantalla principal
  // sigue minimalista.

  // --- música (Spotify) ---
  // Los tokens y el Client Secret viven SOLO en localStorage y se
  // mandan por petición al servidor, que solo hace de puente a Spotify.
  // La reproducción exige Premium (lo impone Spotify): sin Premium la
  // API responde 403 y el servidor lo traduce a un mensaje claro.
  function spotifyRedirectUri() {
    try {
      const origin =
        window.location && window.location.origin
          ? window.location.origin
          : "";
      return origin + "/";
    } catch (e) {
      return "";
    }
  }
  function getSpotifyCreds() {
    return {
      clientId: (localStorage.getItem(LS_SPOTIFY_ID) || "").trim(),
      clientSecret: (localStorage.getItem(LS_SPOTIFY_SECRET) || "").trim(),
      access: (localStorage.getItem(LS_SPOTIFY_ACCESS) || "").trim(),
      refresh: (localStorage.getItem(LS_SPOTIFY_REFRESH) || "").trim(),
      expiresAt: Number(localStorage.getItem(LS_SPOTIFY_EXPIRES) || "0") || 0,
    };
  }
  function spotifyConnected() {
    return !!getSpotifyCreds().refresh;
  }
  function saveSpotifyTokens(access, refresh, expiresIn) {
    if (access) localStorage.setItem(LS_SPOTIFY_ACCESS, access);
    if (refresh) localStorage.setItem(LS_SPOTIFY_REFRESH, refresh);
    if (expiresIn) {
      localStorage.setItem(
        LS_SPOTIFY_EXPIRES,
        String(Date.now() + Number(expiresIn) * 1000 - 60000)
      );
    }
  }
  function clearSpotifyTokens() {
    localStorage.removeItem(LS_SPOTIFY_ACCESS);
    localStorage.removeItem(LS_SPOTIFY_REFRESH);
    localStorage.removeItem(LS_SPOTIFY_EXPIRES);
  }
  async function spotifyRefreshAccess() {
    const { clientId, clientSecret, refresh } = getSpotifyCreds();
    if (!clientId || !clientSecret || !refresh) return null;
    try {
      const { ok, data } = await postJSON("/api/spotify/refresh", {
        refreshToken: refresh,
        clientId,
        clientSecret,
      });
      if (!ok || !data.access_token) return null;
      saveSpotifyTokens(data.access_token, data.refresh_token || null, data.expires_in);
      return data.access_token;
    } catch (e) {
      return null;
    }
  }
  async function spotifyAccessToken() {
    const creds = getSpotifyCreds();
    if (!creds.refresh) return null;
    if (creds.access && creds.expiresAt > Date.now()) return creds.access;
    return spotifyRefreshAccess();
  }
  // Llama a un endpoint de Spotify del servidor; si el token expiró
  // (401), lo renueva una vez y reintenta.
  async function callSpotify(endpoint, body) {
    let token = await spotifyAccessToken();
    if (!token) {
      return {
        ok: false,
        status: 401,
        data: { error: "Spotify no está conectado.", needsConnect: true },
      };
    }
    let res = await postJSON(endpoint, { ...(body || {}), accessToken: token });
    if (res.status === 401 && res.data && res.data.needsRefresh) {
      const fresh = await spotifyRefreshAccess();
      if (!fresh) return res;
      res = await postJSON(endpoint, { ...(body || {}), accessToken: fresh });
    }
    return res;
  }
  const musicStatus = $("music-status");
  const musicSearchInput = $("music-search-input");
  const musicResults = $("music-results");
  const musicNow = $("music-now");
  function renderMusicStatus() {
    const creds = getSpotifyCreds();
    if (musicStatus) {
      musicStatus.textContent = creds.refresh
        ? "Spotify conectado ✓ · la reproducción se controla desde aquí."
        : "Spotify sin conectar. Crea la app en developer.spotify.com y pega el Client ID y el Client Secret en Configuración.";
    }
    const connectBtn = $("btn-spotify-connect");
    if (connectBtn) {
      connectBtn.textContent = creds.refresh
        ? "Reconectar Spotify"
        : "Conectar Spotify";
    }
    const disconnectBtn = $("btn-spotify-disconnect");
    if (disconnectBtn) disconnectBtn.hidden = !creds.refresh;
    const redirectEl = $("spotify-redirect-uri");
    if (redirectEl) redirectEl.textContent = spotifyRedirectUri() || "la dirección de Isis";
  }
  function sayMusicNotConnected() {
    const msg =
      "Para poner música primero conecta Spotify en el menú ☰ → Música.";
    announce("Música", msg, true);
    openPanel("panel-music");
  }
  async function connectSpotify() {
    const { clientId } = getSpotifyCreds();
    const { clientSecret } = getSpotifyCreds();
    if (!clientId || !clientSecret) {
      const msg =
        "Primero pega el Client ID y el Client Secret de Spotify en Configuración (menú ☰ → Configuración).";
      if (musicStatus) musicStatus.textContent = msg;
      announce("Música", msg, false);
      openPanel("panel-config");
      return;
    }
    try {
      const { ok, data } = await postJSON("/api/spotify/auth-url", {
        clientId,
        redirectUri: spotifyRedirectUri(),
      });
      if (!ok || !data.url) {
        const msg =
          (data && data.error) || "No pude preparar la conexión con Spotify.";
        if (musicStatus) musicStatus.textContent = msg;
        announce("Música", msg, false);
        return;
      }
      try {
        window.location.href = data.url;
      } catch (e) {
        if (musicStatus) {
          musicStatus.textContent =
            "Abre esta URL para conectar Spotify: " + data.url;
        }
      }
    } catch (e) {
      const msg = "No pude hablar con el servidor ahora mismo.";
      if (musicStatus) musicStatus.textContent = msg;
      announce("Música", msg, false);
    }
  }
  // Spotify regresa a la app con ?code= (o ?error= si se canceló): se
  // intercambia el código por tokens y se limpia la URL para no
  // reintentarlo al recargar. Corre una sola vez al abrir la app.
  async function handleSpotifyCallback() {
    let search = "";
    try {
      search = (window.location && window.location.search) || "";
    } catch (e) {
      return;
    }
    if (!search) return;
    let params = null;
    try {
      params = new URLSearchParams(search);
    } catch (e) {
      return;
    }
    const code = params.get("code");
    const err = params.get("error");
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(
          {},
          "",
          (window.location && window.location.pathname) || "/"
        );
      }
    } catch (e) {}
    if (err) {
      addBubble("isis", "No se conectó Spotify: se canceló la autorización.", "Música");
      return;
    }
    if (!code) return;
    const { clientId, clientSecret } = getSpotifyCreds();
    if (!clientId || !clientSecret) {
      addBubble(
        "isis",
        "Spotify me devolvió el código, pero falta el Client ID o el Client Secret en Configuración. Pégalos y conéctalo de nuevo.",
        "Música"
      );
      return;
    }
    try {
      const { ok, data } = await postJSON("/api/spotify/token", {
        code,
        clientId,
        clientSecret,
        redirectUri: spotifyRedirectUri(),
      });
      if (ok && data.access_token) {
        saveSpotifyTokens(data.access_token, data.refresh_token, data.expires_in);
        renderMusicStatus();
        addBubble("isis", "Listo, Spotify conectado. Ya puedo ponerte música.", "Música");
        speak("Listo, Spotify conectado. Ya puedo ponerte música.");
      } else {
        addBubble(
          "isis",
          (data && data.error) || "No se pudo conectar Spotify.",
          "Música"
        );
      }
    } catch (e) {
      addBubble("isis", "No pude conectar Spotify ahora mismo.", "Música");
    }
  }
  async function refreshSpotifyNow() {
    if (!spotifyConnected()) return null;
    try {
      const { ok, data } = await callSpotify("/api/spotify/status", {});
      if (!ok || !data) return null;
      const label =
        data.playing && data.track
          ? `Sonando: ${data.track.name} — ${(data.track.artists || []).join(", ")}`
          : "Nada sonando en Spotify.";
      if (musicNow) musicNow.textContent = label;
      return data.playing && data.track
        ? `Está sonando ${data.track.name} de ${(data.track.artists || []).join(", ")}.`
        : null;
    } catch (e) {
      return null;
    }
  }
  function renderMusicResults(tracks) {
    if (!musicResults) return;
    musicResults.innerHTML = "";
    tracks.forEach((t) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "music-result-btn";
      btn.textContent = `${t.name} — ${(t.artists || []).join(", ")}`;
      btn.addEventListener("click", () =>
        runSpotifyPlay(
          t.uri,
          `${t.name} de ${(t.artists || []).join(", ")}`,
          false
        )
      );
      li.appendChild(btn);
      musicResults.appendChild(li);
    });
  }
  async function runSpotifySearch(query) {
    const q = String(query || "").trim();
    if (!q) {
      if (musicResults) {
        musicResults.innerHTML =
          "<li><span class='muted'>Escribe una canción o un artista.</span></li>";
      }
      return;
    }
    if (!spotifyConnected()) {
      sayMusicNotConnected();
      return;
    }
    if (musicResults) {
      musicResults.innerHTML = '<li><span class="loading">BUSCANDO…</span></li>';
    }
    try {
      const { ok, data } = await callSpotify("/api/spotify/search", { q });
      if (!ok || !Array.isArray(data.tracks)) {
        const msg =
          (data && data.error) || "No pude buscar en Spotify ahora mismo.";
        if (musicResults) {
          musicResults.innerHTML = `<li><span>${markdownToHtml(msg)}</span></li>`;
        }
        announce("Música", msg, false);
        return;
      }
      if (data.tracks.length === 0) {
        if (musicResults) {
          musicResults.innerHTML =
            "<li><span class='muted'>No encontré nada con ese nombre.</span></li>";
        }
        return;
      }
      renderMusicResults(data.tracks);
    } catch (e) {
      if (musicResults) {
        musicResults.innerHTML =
          "<li><span>No pude buscar en Spotify ahora mismo.</span></li>";
      }
    }
  }
  async function runSpotifyPlay(uri, label, fromVoice) {
    if (!spotifyConnected()) {
      sayMusicNotConnected();
      return false;
    }
    setOrbStatus("Isis está poniendo música…");
    try {
      const { ok, data } = await callSpotify(
        "/api/spotify/play",
        uri ? { uri } : {}
      );
      if (!ok) {
        const msg =
          (data && data.error) || "No pude poner la música ahora mismo.";
        announce("Música", msg, fromVoice);
        setOrbStatus(idleStatus());
        return false;
      }
      const spoken = label ? `Poniendo ${label}.` : "Poniendo música.";
      announce("Música", spoken, fromVoice);
      await refreshSpotifyNow();
      setOrbStatus(idleStatus());
      return true;
    } catch (e) {
      announce("Música", "No pude poner la música ahora mismo.", fromVoice);
      setOrbStatus(idleStatus());
      return false;
    }
  }
  async function runMusicCommand(cmd, fromVoice) {
    if (!spotifyConnected()) {
      sayMusicNotConnected();
      return;
    }
    if (cmd.kind === "pause") {
      const { ok, data } = await callSpotify("/api/spotify/pause", {});
      if (!ok) {
        announce("Música", (data && data.error) || "No pude pausar la música.", fromVoice);
        return;
      }
      announce("Música", "Pausé la música.", fromVoice);
      await refreshSpotifyNow();
      return;
    }
    if (cmd.kind === "next") {
      const { ok, data } = await callSpotify("/api/spotify/next", {});
      if (!ok) {
        announce("Música", (data && data.error) || "No pude cambiar de canción.", fromVoice);
        return;
      }
      await refreshSpotifyNow();
      announce("Música", "Siguiente canción.", fromVoice);
      return;
    }
    if (cmd.kind === "status") {
      const now = await refreshSpotifyNow();
      announce("Música", now || "No está sonando nada en Spotify.", fromVoice);
      return;
    }
    // play
    if (cmd.query) {
      const { ok, data } = await callSpotify("/api/spotify/search", {
        q: cmd.query,
      });
      if (!ok || !Array.isArray(data.tracks) || !data.tracks.length) {
        announce(
          "Música",
          (data && data.error) || `No encontré "${cmd.query}" en Spotify.`,
          fromVoice
        );
        return;
      }
      const t = data.tracks[0];
      await runSpotifyPlay(
        t.uri,
        `${t.name} de ${(t.artists || []).join(", ")}`,
        fromVoice
      );
      return;
    }
    await runSpotifyPlay(null, null, fromVoice);
  }
  // Saca el comando de música del mensaje: null si no es música.
  // "pon [canción/artista]" solo si no es temporizador, recordatorio ni
  // algo de El Mitote (eso se atiende en otro lado o por el chat).
  function extractMusic(text) {
    const t = String(text || "")
      .trim()
      .replace(/^isis[,\s:–—-]*/i, "");
    if (/pausa( la)? (la )?m[uú]sica|\bpausar\b/i.test(t)) return { kind: "pause" };
    if (/siguiente (canci[oó]n|tema)/i.test(t)) return { kind: "next" };
    if (/qu[eé] (est[aá] sonando|suena)/i.test(t)) return { kind: "status" };
    if (/pon (?:m[uú]sica|una canci[oó]n|algo de m[uú]sica)\b/i.test(t)) return { kind: "play" };
    if (/ponme (?:m[uú]sica|una canci[oó]n)\b/i.test(t)) return { kind: "play" };
    let m = t.match(/reproduce (.+)/i);
    if (m) return { kind: "play", query: m[1].trim() };
    m = t.match(/pon (.+)/i);
    if (m) {
      const q = m[1].trim();
      if (
        /temporizador|recordatorio|recu[eé]rdame|la mesa|la cuenta|el turno|el restaurante/i.test(
          q
        )
      )
        return null;
      return { kind: "play", query: q };
    }
    return null;
  }
  const btnSpotifyConnect = $("btn-spotify-connect");
  if (btnSpotifyConnect) {
    btnSpotifyConnect.addEventListener("click", connectSpotify);
  }
  const btnSpotifyDisconnect = $("btn-spotify-disconnect");
  if (btnSpotifyDisconnect) {
    btnSpotifyDisconnect.addEventListener("click", () => {
      clearSpotifyTokens();
      renderMusicStatus();
      if (musicNow) musicNow.textContent = "";
      if (musicResults) musicResults.innerHTML = "";
      announce("Música", "Spotify desconectado.", false);
    });
  }
  const btnMusicSearch = $("btn-music-search");
  if (btnMusicSearch) {
    btnMusicSearch.addEventListener("click", () =>
      runSpotifySearch(musicSearchInput ? musicSearchInput.value : "")
    );
  }
  const btnMusicPlay = $("btn-music-play");
  if (btnMusicPlay) {
    btnMusicPlay.addEventListener("click", () =>
      runSpotifyPlay(null, null, false)
    );
  }
  const btnMusicPause = $("btn-music-pause");
  if (btnMusicPause) {
    btnMusicPause.addEventListener("click", () =>
      runMusicCommand({ kind: "pause" }, false)
    );
  }
  const btnMusicNext = $("btn-music-next");
  if (btnMusicNext) {
    btnMusicNext.addEventListener("click", () =>
      runMusicCommand({ kind: "next" }, false)
    );
  }
  const btnMusicNow = $("btn-music-now");
  if (btnMusicNow) {
    btnMusicNow.addEventListener("click", () => refreshSpotifyNow());
  }

  // --- recordatorios y temporizadores ---
  // Solo en este navegador (localStorage) y solo con la app abierta:
  // en Render Free Isis se duerme y no hay servicio en segundo plano,
  // así que un recordatorio que vence con la app cerrada suena cuando
  // la vuelves a abrir ("Te debía recordar…").
  const reminderTimers = new Map(); // id -> timeout (solo en memoria)
  function loadReminders() {
    try {
      const raw = localStorage.getItem(LS_REMINDERS);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (r) => r && typeof r.text === "string" && typeof r.at === "number"
      );
    } catch (e) {
      return [];
    }
  }
  function saveReminders(items) {
    localStorage.setItem(LS_REMINDERS, JSON.stringify(items));
    renderReminders();
  }
  function reminderId() {
    return (
      "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    );
  }
  function addReminder(text, at, kind) {
    const items = loadReminders();
    const item = {
      id: reminderId(),
      kind: kind || "reminder",
      text: String(text).trim(),
      at,
      done: false,
      createdAt: Date.now(),
    };
    items.push(item);
    saveReminders(items);
    scheduleReminder(item);
    return item;
  }
  function scheduleReminder(item) {
    if (!item || item.done) return;
    const delay = item.at - Date.now();
    if (reminderTimers.has(item.id)) {
      clearTimeout(reminderTimers.get(item.id));
    }
    reminderTimers.set(
      item.id,
      setTimeout(() => fireReminder(item.id), Math.max(0, delay))
    );
  }
  function scheduleAllReminders() {
    loadReminders().forEach((item) => {
      if (!item.done) scheduleReminder(item);
    });
  }
  function markReminderDone(id) {
    const items = loadReminders();
    const it = items.find((r) => r.id === id);
    if (!it) return null;
    it.done = true;
    saveReminders(items);
    return it;
  }
  // Cuando suena: se marca cumplido, tarjeta visible en la pantalla
  // principal, burbuja, voz y un sonido de aviso (si el navegador lo
  // permite). Nunca se pierde: queda en la lista como cumplido.
  function fireReminder(id) {
    const it = markReminderDone(id);
    if (!it) return;
    reminderTimers.delete(id);
    const overdue = Date.now() - it.at > 60000;
    const msg =
      it.kind === "timer"
        ? `Ya pasaron los minutos: ${it.text}.`
        : overdue
          ? `Te debía recordar: ${it.text}.`
          : `Te recuerdo: ${it.text}.`;
    showReminderAlert(msg);
    addBubble("isis", msg, "Recordatorio");
    speak(msg);
    recordExchange(msg);
    playReminderBeep();
  }
  function playReminderBeep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      [0, 300, 600].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = i === 2 ? 1175 : 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = ctx.currentTime + delay / 1000;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        osc.start(t0);
        osc.stop(t0 + 0.3);
      });
    } catch (e) {}
  }
  const reminderAlert = $("reminder-alert");
  const reminderAlertText = $("reminder-alert-text");
  function showReminderAlert(msg) {
    if (!reminderAlert || !reminderAlertText) return;
    reminderAlertText.textContent = "⏰ " + msg;
    reminderAlert.hidden = false;
  }
  const reminderAlertDismiss = $("reminder-alert-dismiss");
  if (reminderAlertDismiss) {
    reminderAlertDismiss.addEventListener("click", () => {
      if (reminderAlert) reminderAlert.hidden = true;
    });
  }
  function renderReminders() {
    const list = $("reminders-list");
    if (!list) return;
    const items = loadReminders()
      .slice()
      .sort((a, b) => a.at - b.at);
    list.innerHTML = "";
    if (items.length === 0) {
      const li = document.createElement("li");
      li.innerHTML =
        "<span class='muted'>Sin recordatorios. Agrega uno arriba o dime “recuérdame…”.</span>";
      list.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      const when = new Date(item.at).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      });
      span.textContent = `${item.done ? "✓ " : "⏰ "}${item.text} · ${
        item.kind === "timer" ? "temporizador" : when
      }${item.done ? " · cumplido" : ""}`;
      const btn = document.createElement("button");
      btn.textContent = "✕";
      btn.title = "Borrar";
      btn.addEventListener("click", () => {
        if (reminderTimers.has(item.id)) {
          clearTimeout(reminderTimers.get(item.id));
          reminderTimers.delete(item.id);
        }
        saveReminders(loadReminders().filter((r) => r.id !== item.id));
      });
      li.appendChild(span);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }
  // "a las 15:30", "a las 3 de la tarde", "a las 8 de la noche", "a las
  // 9 de la mañana", "a las 7". Si la hora ya pasó hoy, es mañana.
  function parseReminderClock(text) {
    const m = String(text || "").match(
      /a las\s+(\d{1,2})(?::(\d{2}))?\s*(?:de la\s+(tarde|noche|mañana))?/i
    );
    if (!m) return null;
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const part = (m[3] || "").toLowerCase();
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    if (part === "tarde" || part === "noche") {
      if (h === 12) h = part === "noche" ? 0 : 12;
      else if (h < 12) h += 12;
    }
    const now = new Date();
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      h,
      min,
      0,
      0
    );
    if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
    return at.getTime();
  }
  // Saca el comando de recordatorio del mensaje: null si no es uno.
  function extractReminder(text) {
    const t = String(text || "")
      .trim()
      .replace(/^isis[,\s:–—-]*/i, "");
    if (/qu[eé] (me tienes|tengo) que recordar|mis recordatorios/i.test(t)) {
      return { kind: "list" };
    }
    let m = t.match(/pon(?:me)? (?:un )?temporizador de (\d+)\s*min/i);
    if (m) {
      return {
        kind: "timer",
        minutes: Number(m[1]),
        text: `Temporizador de ${m[1]} minutos`,
      };
    }
    m = t.match(/recu[eé]rdame\s+(.+?)\s+en\s+(\d+)\s*min/i);
    if (m) {
      return {
        kind: "reminder",
        text: m[1].trim().replace(/^que\s+/i, ""),
        minutes: Number(m[2]),
      };
    }
    m = t.match(/recu[eé]rdame\s+(.+?)\s+a las\s+/i);
    if (m) {
      return {
        kind: "reminder",
        text: m[1].trim().replace(/^que\s+/i, ""),
        at: parseReminderClock(t),
      };
    }
    if (/recu[eé]rdame\b/i.test(t)) {
      // "recuérdame llamar a Griselda" (sin hora): el texto SÍ se
      // guarda para preguntar a qué hora, no se pierde.
      const m2 = t.match(/recu[eé]rdame\s+(.+)/i);
      return {
        kind: "reminder",
        text: m2 ? m2[1].trim().replace(/^que\s+/i, "") : "",
        at: null,
      };
    }
    return null;
  }
  async function runReminderCommand(cmd) {
    if (cmd.kind === "list") {
      const pending = loadReminders().filter((r) => !r.done);
      if (!pending.length) {
        announce("Recordatorios", "No tienes nada pendiente que recordar.", true);
        openPanel("panel-reminders");
        return;
      }
      const spoken =
        "Tienes pendiente: " +
        pending
          .map(
            (r) =>
              `${r.text} a las ${new Date(r.at).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
          )
          .join("; ") +
        ".";
      announce("Recordatorios", spoken, true);
      openPanel("panel-reminders");
      return;
    }
    if (cmd.kind === "timer") {
      if (!cmd.minutes || cmd.minutes <= 0 || cmd.minutes > 600) {
        announce(
          "Recordatorios",
          "Dime de cuántos minutos: por ejemplo, pon un temporizador de 10 minutos.",
          true
        );
        return;
      }
      addReminder(cmd.text, Date.now() + cmd.minutes * 60000, "timer");
      announce(
        "Recordatorios",
        `Listo, temporizador de ${cmd.minutes} minutos. Te aviso cuando se acabe.`,
        true
      );
      return;
    }
    if (!cmd.text) {
      announce(
        "Recordatorios",
        "¿Qué te recuerdo? Dime qué y a qué hora: por ejemplo, recuérdame llamar a Griselda a las 5 de la tarde.",
        true
      );
      return;
    }
    if (cmd.minutes) {
      addReminder(cmd.text, Date.now() + cmd.minutes * 60000, "reminder");
      announce(
        "Recordatorios",
        `Listo, te recuerdo "${cmd.text}" en ${cmd.minutes} minutos.`,
        true
      );
      return;
    }
    if (!cmd.at) {
      announce(
        "Recordatorios",
        `¿A qué hora te recuerdo "${cmd.text}"? Dime la hora: por ejemplo, a las 5 de la tarde.`,
        true
      );
      return;
    }
    addReminder(cmd.text, cmd.at, "reminder");
    const hora = new Date(cmd.at).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
    announce(
      "Recordatorios",
      `Listo, te recuerdo "${cmd.text}" a las ${hora}.`,
      true
    );
  }
  const btnAddReminder = $("btn-add-reminder");
  if (btnAddReminder) {
    btnAddReminder.addEventListener("click", () => {
      const textEl = $("reminder-text");
      const timeEl = $("reminder-time");
      const text = textEl ? textEl.value.trim() : "";
      const time = timeEl ? timeEl.value.trim() : "";
      if (!text || !time) {
        announce("Recordatorios", "Escribe qué te recuerdo y a qué hora.", false);
        return;
      }
      const parts = time.split(":");
      const h = Number(parts[0]);
      const min = Number(parts[1] || "0");
      if (Number.isNaN(h) || h < 0 || h > 23 || Number.isNaN(min) || min < 0 || min > 59) {
        announce("Recordatorios", "Esa hora no es válida.", false);
        return;
      }
      const now = new Date();
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0, 0);
      if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
      addReminder(text, at.getTime(), "reminder");
      if (textEl) textEl.value = "";
      announce(
        "Recordatorios",
        `Listo, te recuerdo "${text}" a las ${at.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        })}.`,
        false
      );
    });
  }
  const btnAddTimer = $("btn-add-timer");
  if (btnAddTimer) {
    btnAddTimer.addEventListener("click", () => {
      const minEl = $("timer-minutes");
      const mins = minEl ? Number(minEl.value) : NaN;
      if (!mins || mins <= 0 || mins > 600) {
        announce("Recordatorios", "Pon cuántos minutos: de 1 a 600.", false);
        return;
      }
      addReminder(`Temporizador de ${mins} minutos`, Date.now() + mins * 60000, "timer");
      if (minEl) minEl.value = "";
      announce(
        "Recordatorios",
        `Listo, temporizador de ${mins} minutos. Te aviso cuando se acabe.`,
        false
      );
    });
  }

  // --- noticias ---
  async function runNews(fromVoice) {
    const { fableaiKey } = getKeys();
    const box = $("news-result");
    if (box) box.innerHTML = '<p class="loading">BUSCANDO NOTICIAS…</p>';
    setOrbStatus("Isis está buscando las noticias…");
    try {
      const { ok, data } = await postJSON("/api/news", { fableaiKey });
      if (!ok || !data.summary) {
        const msg =
          (data && data.error) || "No pude traer las noticias ahora mismo.";
        if (box) box.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
        announce("Noticias", msg, fromVoice);
        setOrbStatus(idleStatus());
        return;
      }
      const summary = String(data.summary).trim();
      if (box) box.innerHTML = markdownToHtml(summary);
      announce("Noticias", summary, fromVoice);
      setOrbStatus(idleStatus());
    } catch (e) {
      const msg = "No pude traer las noticias ahora mismo.";
      if (box) box.innerHTML = `<p>${markdownToHtml(msg)}</p>`;
      announce("Noticias", msg, fromVoice);
      setOrbStatus(idleStatus());
    }
  }
  function isNewsRequest(text) {
    return /qu[eé] hay de nuevo|dame las noticias|resumen de noticias|noticias (de )?hoy|las noticias/i.test(
      text
    );
  }
  const btnNews = $("btn-news");
  if (btnNews) {
    btnNews.addEventListener("click", () => runNews(false));
  }

  // --- dinero (comisiones) ---
  // Números CONFIRMADOS por Santiago (captura 23 nov 2026, págs. 3–5
  // de 28). RECIBE: PCN $900 (1–3) / $1,000 (4) / $1,200 (5–6) /
  // $1,400 (7); NIDEC $1,500 fijo; DALTILE $1,000 (1–2) / $1,100 (3) /
  // $1,150 (4) / $1,250 (5–6) / $1,400 (8), el de 7 sin confirmar.
  // PAGA a reclutadores: PCN $540 / $600 / $720 / $840; NIDEC $900.
  // La tasa del nivel aplica a TODOS los válidos de esa empresa/semana;
  // solo cuentan los que llegan al día 2; semana sáb–vie, pago viernes.
  // Bono mensual: $2,000 por cada 10 válidos (combinado). Estos números
  // son SOLO de Isis: el bot de Orlando enseña solo los de
  // reclutadores, y aquí no se tocan.
  function moneyTier(n, tiers) {
    if (!n || n <= 0) return 0;
    for (const [max, rate] of tiers) {
      if (n <= max) return rate;
    }
    return tiers[tiers.length - 1][1];
  }
  const MONEY_RATES = {
    pcn: {
      receive: [
        [3, 900],
        [4, 1000],
        [6, 1200],
        [Infinity, 1400],
      ],
      pay: [
        [3, 540],
        [4, 600],
        [6, 720],
        [Infinity, 840],
      ],
    },
    nidec: {
      receive: [[Infinity, 1500]],
      pay: [[Infinity, 900]],
    },
    daltile: {
      // El nivel de 7 no está confirmado: se calcula con $1,250 (como
      // 5–6) y se avisa en el resultado. De Daltile no hay pago a
      // reclutadores registrado: se cuenta en $0 y se avisa.
      receive: [
        [2, 1000],
        [3, 1100],
        [4, 1150],
        [6, 1250],
        [7, 1250],
        [Infinity, 1400],
      ],
      pay: [[Infinity, 0]],
    },
  };
  function computeMoney(counts) {
    const n = {
      pcn: Math.max(0, Math.floor(Number(counts.pcn) || 0)),
      nidec: Math.max(0, Math.floor(Number(counts.nidec) || 0)),
      daltile: Math.max(0, Math.floor(Number(counts.daltile) || 0)),
    };
    const incentive = Math.max(0, Math.floor(Number(counts.incentive) || 0));
    const monthValid = Math.max(0, Math.floor(Number(counts.monthValid) || 0));
    const per = {};
    for (const key of ["pcn", "nidec", "daltile"]) {
      const receive = n[key] * moneyTier(n[key], MONEY_RATES[key].receive);
      const pay = n[key] * moneyTier(n[key], MONEY_RATES[key].pay);
      per[key] = { n: n[key], receive, pay, keep: receive - pay };
    }
    const totalReceive =
      per.pcn.receive + per.nidec.receive + per.daltile.receive;
    const totalPay =
      per.pcn.pay + per.nidec.pay + per.daltile.pay + incentive;
    const bonus = Math.floor(monthValid / 10) * 2000;
    return {
      per,
      incentive,
      monthValid,
      totalReceive,
      totalPay,
      totalKeep: totalReceive - totalPay,
      bonus,
      grandReceive: totalReceive + bonus,
      daltile7: n.daltile === 7,
    };
  }
  function moneyFmt(v) {
    return "$" + Number(v || 0).toLocaleString("es-MX");
  }
  function moneySummaryText(m) {
    const parts = [];
    if (m.per.pcn.n) {
      parts.push(
        `PCN: ${m.per.pcn.n} válidos, recibes ${moneyFmt(m.per.pcn.receive)}`
      );
    }
    if (m.per.nidec.n) {
      parts.push(
        `NIDEC: ${m.per.nidec.n} válidos, recibes ${moneyFmt(m.per.nidec.receive)}`
      );
    }
    if (m.per.daltile.n) {
      parts.push(
        `Daltile: ${m.per.daltile.n} válidos, recibes ${moneyFmt(m.per.daltile.receive)}`
      );
    }
    if (!parts.length) return "";
    let s =
      "Esta semana llevas: " +
      parts.join("; ") +
      `. En total recibes ${moneyFmt(m.totalReceive)}, pagas ${moneyFmt(m.totalPay)} y te quedan ${moneyFmt(m.totalKeep)}.`;
    if (m.bonus) {
      s += ` Más tu bono mensual de ${moneyFmt(m.bonus)}.`;
    }
    return s;
  }
  function renderMoneyResult(m) {
    const box = $("money-result");
    if (!box) return;
    const row = (label, d) =>
      d.n
        ? `<div class="row"><span class="label">${label} · ${d.n} válidos</span><span class="value">Recibes ${moneyFmt(d.receive)} · Pagas ${moneyFmt(d.pay)} · Quedan ${moneyFmt(d.keep)}</span></div>`
        : "";
    box.innerHTML = `
    <div class="orlando-panel">
      ${row("PCN", m.per.pcn)}
      ${row("NIDEC", m.per.nidec)}
      ${row("Daltile", m.per.daltile)}
      <div class="row"><span class="label">Total a recibir</span><span class="value">${moneyFmt(m.totalReceive)}</span></div>
      <div class="row"><span class="label">Total a pagar${m.incentive ? ` (incluye incentivo ${moneyFmt(m.incentive)})` : ""}</span><span class="value">${moneyFmt(m.totalPay)}</span></div>
      ${m.bonus ? `<div class="row"><span class="label">Bono mensual (${m.monthValid} válidos este mes)</span><span class="value">${moneyFmt(m.bonus)}</span></div>` : ""}
      <div class="row"><span class="label">Te quedan</span><span class="value">${moneyFmt(m.totalKeep)}</span></div>
    </div>
    ${m.daltile7 ? `<p class="muted small">Ojo: el nivel de Daltile con 7 válidos no está confirmado; lo calculé con $1,250, como el de 5–6. Confírmalo con tu coordinador.</p>` : ""}
    ${m.per.daltile.n ? `<p class="muted small">De Daltile no tengo registrado cuánto pagas a reclutadores, así que lo conté en $0.</p>` : ""}
    <p class="muted small">Solo cuentan los válidos que llegan al día 2. Semana sábado a viernes, pago los viernes.</p>`;
  }
  function loadMoneyCounts() {
    try {
      const raw = localStorage.getItem(LS_MONEY);
      const o = raw ? JSON.parse(raw) : {};
      return {
        pcn: 0,
        nidec: 0,
        daltile: 0,
        incentive: 0,
        monthValid: 0,
        ...(o && typeof o === "object" ? o : {}),
      };
    } catch (e) {
      return { pcn: 0, nidec: 0, daltile: 0, incentive: 0, monthValid: 0 };
    }
  }
  function saveMoneyCounts(c) {
    localStorage.setItem(LS_MONEY, JSON.stringify(c));
  }
  function readMoneyForm() {
    const num = (id) => {
      const el = $(id);
      return el ? Number(el.value) || 0 : 0;
    };
    return {
      pcn: num("money-pcn"),
      nidec: num("money-nidec"),
      daltile: num("money-daltile"),
      incentive: num("money-incentive"),
      monthValid: num("money-month"),
    };
  }
  function fillMoneyForm(c) {
    const set = (id, v) => {
      const el = $(id);
      if (el) el.value = v ? String(v) : "";
    };
    set("money-pcn", c.pcn);
    set("money-nidec", c.nidec);
    set("money-daltile", c.daltile);
    set("money-incentive", c.incentive);
    set("money-month", c.monthValid);
  }
  const btnMoney = $("btn-money");
  if (btnMoney) {
    btnMoney.addEventListener("click", () => {
      const c = readMoneyForm();
      saveMoneyCounts(c);
      const m = computeMoney(c);
      renderMoneyResult(m);
      const spoken =
        moneySummaryText(m) ||
        "Todavía no me has dicho cuántos válidos llevas esta semana. Dime por empresa: PCN, NIDEC y Daltile.";
      announce("Dinero", spoken, false);
    });
  }
  // "llevo 4 de PCN", "llevo 2 de NIDEC y 1 de Daltile": guarda los
  // conteos y dice los totales de lo que ya lleva.
  function extractMoneyCounts(text) {
    const t = String(text || "").toLowerCase();
    const out = {};
    const re = /(\d+)\s+de\s+(pcn|nidec|daltile)/g;
    let m;
    while ((m = re.exec(t))) out[m[2]] = Number(m[1]);
    return out;
  }
  function isMoneyQuestion(text) {
    return /cu[aá]nto (llevo ganado|gano esta semana|llevo|he ganado)|cu[aá]nto (voy|llevo) esta semana|mis ganancias|cu[aá]nto dinero/i.test(
      text
    );
  }
  async function runMoneyQuestion(fromVoice) {
    const c = loadMoneyCounts();
    const m = computeMoney(c);
    const spoken = moneySummaryText(m);
    if (!spoken) {
      const msg =
        "Todavía no me has dicho cuántos válidos llevas esta semana. ¿Cuántos de PCN, cuántos de NIDEC y cuántos de Daltile?";
      announce("Dinero", msg, fromVoice);
      openPanel("panel-money");
      return;
    }
    fillMoneyForm(c);
    renderMoneyResult(m);
    announce("Dinero", spoken, fromVoice);
    openPanel("panel-money");
  }
  function runMoneySet(counts) {
    const c = loadMoneyCounts();
    const names = { pcn: "PCN", nidec: "NIDEC", daltile: "Daltile" };
    const setParts = [];
    for (const k of ["pcn", "nidec", "daltile"]) {
      if (typeof counts[k] === "number") {
        c[k] = counts[k];
        setParts.push(`${counts[k]} de ${names[k]}`);
      }
    }
    if (!setParts.length) return false;
    saveMoneyCounts(c);
    fillMoneyForm(c);
    const m = computeMoney(c);
    renderMoneyResult(m);
    const missing = ["pcn", "nidec", "daltile"]
      .filter((k) => !c[k])
      .map((k) => names[k]);
    let msg = `Anotado: ${setParts.join(", ")}.`;
    const totals = moneySummaryText(m);
    if (totals) msg += " " + totals;
    if (missing.length) {
      msg += ` Todavía no me has dicho ${missing.join(" ni ")}.`;
    }
    announce("Dinero", msg, true);
    return true;
  }

  // ---------------------------------------------------------- menú hamburguesa y paneles
  // La pantalla principal es solo orbe + estado + conversación colapsada
  // + dock mínimo. TODO lo demás vive en el menú hamburguesa: elegir un
  // módulo cierra el menú y abre ese módulo en pantalla completa; "Volver"
  // (o la tecla Escape) lo cierra y vuelve a la pantalla principal.
  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add("open");
    if (drawerBackdrop) drawerBackdrop.hidden = false;
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("open");
    if (drawerBackdrop) drawerBackdrop.hidden = true;
  }
  function openPanel(panelId) {
    const found = PANELS.find((p) => p[0] === panelId);
    if (!found || !panelsWrap) return;
    closeDrawer();
    PANELS.forEach(([id]) => {
      const el = $(id);
      if (el) el.hidden = id !== panelId;
    });
    if (panelTitle) panelTitle.textContent = found[1];
    panelsWrap.hidden = false;
    if (window.scrollTo) window.scrollTo(0, 0);
  }
  function closePanels() {
    if (!panelsWrap) return;
    panelsWrap.hidden = true;
    PANELS.forEach(([id]) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
  }
  const menuBtn = $("btn-menu");
  if (menuBtn) menuBtn.addEventListener("click", openDrawer);
  const closeDrawerBtn = $("btn-close-drawer");
  if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);
  const backPanelBtn = $("btn-back-panel");
  if (backPanelBtn) backPanelBtn.addEventListener("click", closePanels);
  const MENU_ITEMS = [
    ["menu-config", "panel-config"],
    ["menu-voice", "panel-voice"],
    ["menu-memory", "panel-memory"],
    ["menu-contacts", "panel-contacts"],
    ["menu-orlando", "panel-orlando"],
    ["menu-analyze", "panel-analyze"],
    ["menu-scan", "panel-scan"],
    ["menu-systems", "panel-systems"],
    ["menu-music", "panel-music"],
    ["menu-reminders", "panel-reminders"],
    ["menu-news", "panel-news"],
    ["menu-money", "panel-money"],
  ];
  MENU_ITEMS.forEach(([menuId, panelId]) => {
    const item = $(menuId);
    if (item) {
      item.addEventListener("click", () => openPanel(panelId));
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDrawer();
      closePanels();
    }
  });

  // ---------------------------------------------------------- config
  // Abrir Configuración = abrir su panel (cierra el menú si estaba abierto).
  function toggleConfig() {
    openPanel("panel-config");
  }
  const bannerConfigBtn = $("banner-config");
  if (bannerConfigBtn) bannerConfigBtn.addEventListener("click", toggleConfig);

  $("btn-save-config").addEventListener("click", () => {
    const f = $("cfg-fableai").value.trim();
    const n = $("cfg-n8n").value.trim();
    const w = $("cfg-whatsapp").value.trim();
    const t = $("cfg-textbee") ? $("cfg-textbee").value.trim() : "";
    const d = $("cfg-textbee-device")
      ? $("cfg-textbee-device").value.trim()
      : "";
    const sId = $("cfg-spotify-id") ? $("cfg-spotify-id").value.trim() : "";
    const sSecret = $("cfg-spotify-secret")
      ? $("cfg-spotify-secret").value.trim()
      : "";
    if (f) localStorage.setItem(LS_FABLEAI, f);
    if (n) localStorage.setItem(LS_N8N, n);
    if (w) localStorage.setItem(LS_WHATSAPP, w);
    if (t) localStorage.setItem(LS_TEXTBEE, t);
    if (d) localStorage.setItem(LS_TEXTBEE_DEVICE, d);
    if (sId) localStorage.setItem(LS_SPOTIFY_ID, sId);
    if (sSecret) localStorage.setItem(LS_SPOTIFY_SECRET, sSecret);
    $("cfg-fableai").value = "";
    $("cfg-n8n").value = "";
    $("cfg-whatsapp").value = "";
    if ($("cfg-textbee")) $("cfg-textbee").value = "";
    if ($("cfg-textbee-device")) $("cfg-textbee-device").value = "";
    if ($("cfg-spotify-id")) $("cfg-spotify-id").value = "";
    if ($("cfg-spotify-secret")) $("cfg-spotify-secret").value = "";
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves guardadas en este navegador.";
    refreshKeyUI();
    renderMusicStatus();
    loadOrlando();
  });
  $("btn-clear-config").addEventListener("click", () => {
    localStorage.removeItem(LS_FABLEAI);
    localStorage.removeItem(LS_N8N);
    localStorage.removeItem(LS_WHATSAPP);
    localStorage.removeItem(LS_TEXTBEE);
    localStorage.removeItem(LS_TEXTBEE_DEVICE);
    localStorage.removeItem(LS_SPOTIFY_ID);
    localStorage.removeItem(LS_SPOTIFY_SECRET);
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves borradas de este navegador.";
    refreshKeyUI();
    renderMusicStatus();
    loadOrlando();
  });

  // --- selector de voz (Configuración): la lista se llena cuando el
  // teléfono carga las voces (voiceschanged). Al elegir, se guarda.
  const voiceSelect = $("voice-select");
  if (voiceSelect) {
    voiceSelect.addEventListener("change", () => {
      const chosen =
        spanishVoices.find((v) => voiceId(v) === voiceSelect.value) || null;
      if (chosen) {
        selectedVoice = chosen;
        localStorage.setItem(LS_VOICE, voiceId(chosen));
      }
    });
  }
  // --- selector de voz de Kokoro (Configuración): las 3 voces en
  // español. Al elegir, se guarda.
  const kokoroVoiceSelect = $("kokoro-voice-select");
  if (kokoroVoiceSelect) {
    kokoroVoiceSelect.addEventListener("change", () => {
      if (!kokoroVoiceSelect.value) return;
      selectedKokoroVoice = kokoroVoiceSelect.value;
      localStorage.setItem(LS_KOKORO_VOICE, selectedKokoroVoice);
    });
  }
  const testVoiceBtn = $("btn-test-voice");
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener("click", () => {
      stopWake(); // que no se escuche a sí misma y se active sola
      // Si Kokoro aún no está descargada o falló, empieza (o reintenta)
      // la descarga; Isis habla de inmediato con la voz del teléfono y
      // no espera a que termine. Cuando la descarga termina, la
      // siguiente prueba ya usa Kokoro.
      if (kokoroState === "failed" || kokoroState === "idle") initKokoro();
      speak(
        "¡Hola, Santiago! Me da mucho gusto verte, ¿en qué te ayudo hoy?",
        "alegre"
      );
    });
  }
  // Botón "Descargar voz de Isis" (Configuración): empieza la descarga
  // bajo demanda. Mientras descarga, Isis sigue hablando con la voz del
  // teléfono; cuando termina, la siguiente respuesta ya usa Kokoro.
  const downloadKokoroBtn = $("btn-download-kokoro");
  if (downloadKokoroBtn) {
    downloadKokoroBtn.addEventListener("click", () => {
      initKokoro();
    });
  }

  // ---------------------------------------------------------- inicio
  refreshKeyUI();
  renderFacts();
  renderContacts();
  renderMemory();
  renderMusicStatus();
  renderReminders();
  scheduleAllReminders();
  fillMoneyForm(loadMoneyCounts());
  // Si Spotify regresó con ?code=, se intercambia por tokens.
  handleSpotifyCallback();
  loadOrlando();
  // Las voces del teléfono llegan tarde en Android: se escucha el evento.
  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  }
  refreshVoices();
  populateKokoroSelect();
  updateKokoroStatus();
  // Al abrir Isis NO se descarga nada pesado: Kokoro solo se baja cuando
  // Santiago toca "Descargar voz de Isis" o "Probar voz", para que la
  // app arranque rápida y ligera. Lo demás del inicio es ligero: claves,
  // hechos, contactos, memoria y la revisión de Orlando (la hace el
  // servidor); las voces del teléfono solo se listan, no se descargan.
  updateWakeUI();
  // Revisión proactiva de sistemas al abrir: en segundo plano, una
  // sola vez por carga, sin bloquear. Solo avisa si algo está mal (no
  // es un servicio en segundo plano: en Render Free Isis se duerme y
  // no puede vigilar sola).
  setTimeout(() => {
    if (!systemsAutoChecked) {
      systemsAutoChecked = true;
      runSystemsCheck(false, true);
    }
  }, 4000);
  // Conversación plegable: empieza colapsada (solo la vista previa).
  if (chatToggle) {
    chatToggle.addEventListener("click", () => {
      setChatCollapsed(!chatCard.classList.contains("collapsed"));
    });
  }
  setChatCollapsed(true);
  // Dock mínimo: el micrófono toca el orbe.
  const dockMic = $("dock-mic");
  if (dockMic) {
    dockMic.addEventListener("click", () => orb.click());
  }
  // Si hay conversación guardada, la conversación se ve continuar y no
  // se repite el saludo; si no hay nada, Isis se presenta como siempre.
  if (!restoreHistory()) {
    addBubble(
      "isis",
      "Hola, soy Isis. Tócame el círculo y háblame, o escríbeme abajo. Si me preguntas por Orlando, lo reviso; si me preguntas por el clima, lo consulto en vivo; si me pides que le escriba a alguien, lo mando por SMS desde tu número (o por WhatsApp si me lo pides así); y si me pides algo del restaurante, lo opero como dueña en El Mitote.",
      "Isis"
    );
  }
})();
