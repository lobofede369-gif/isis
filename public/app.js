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
  const LS_AZURE = "isis_azure_key";
  const LS_AZURE_REGION = "isis_azure_region";
  const LS_AZURE_VOICE = "isis_azure_voice";
  // Voz de Azure de por defecto: es-MX-DaliaNeural (femenina, español de
  // México, neural). Región de por defecto: eastus.
  const AZURE_DEFAULT_VOICE = "es-MX-DaliaNeural";
  const AZURE_DEFAULT_REGION = "eastus";
  const LS_FACTS = "isis_facts";
  const LS_HISTORY = "isis_history";
  const LS_SUMMARY = "isis_summary";
  const LS_CONTACTS = "isis_contacts";
  const LS_VOICE = "isis_voice";
  const LS_WAKE = "isis_wake_enabled";
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
  const configSection = $("config");

  // ---------------------------------------------------------- claves
  function getKeys() {
    return {
      fableaiKey: (localStorage.getItem(LS_FABLEAI) || "").trim(),
      n8nKey: (localStorage.getItem(LS_N8N) || "").trim(),
      whatsappToken: (localStorage.getItem(LS_WHATSAPP) || "").trim(),
      textbeeKey: (localStorage.getItem(LS_TEXTBEE) || "").trim(),
      textbeeDevice: (localStorage.getItem(LS_TEXTBEE_DEVICE) || "").trim(),
      azureKey: (localStorage.getItem(LS_AZURE) || "").trim(),
      azureRegion: (localStorage.getItem(LS_AZURE_REGION) || "").trim(),
    };
  }

  function refreshKeyUI() {
    const {
      fableaiKey,
      n8nKey,
      whatsappToken,
      textbeeKey,
      textbeeDevice,
      azureKey,
      azureRegion,
    } = getKeys();
    const fState = $("cfg-fableai-state");
    const nState = $("cfg-n8n-state");
    const wState = $("cfg-whatsapp-state");
    const tState = $("cfg-textbee-state");
    const dState = $("cfg-textbee-device-state");
    const aState = $("cfg-azure-state");
    const rState = $("cfg-azure-region-state");
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
    if (aState) {
      aState.textContent = azureKey ? "Guardada ✓" : "Sin guardar";
      aState.classList.toggle("ok", !!azureKey);
    }
    if (rState) {
      rState.textContent = azureRegion
        ? `Guardada ✓ (${azureRegion})`
        : "eastus (por defecto)";
      rState.classList.toggle("ok", !!azureRegion);
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

  // --- voces de Azure AI Speech (cuando hay clave y región): se listan
  // desde /api/voices, filtradas a español. Sin clave, el selector dice
  // que falta y Isis usa la voz del teléfono.
  let azureVoices = [];
  let selectedAzureVoice =
    (localStorage.getItem(LS_AZURE_VOICE) || "").trim() ||
    AZURE_DEFAULT_VOICE;
  function azureVoiceLabel(v) {
    const gender =
      v.ssmlGender === "Female"
        ? "femenina"
        : v.ssmlGender === "Male"
          ? "masculina"
          : "";
    const langs = Array.isArray(v.languageCodes)
      ? v.languageCodes.join(", ")
      : "";
    const bits = [langs, gender].filter(Boolean);
    return bits.length ? `${v.name} · ${bits.join(" · ")}` : v.name;
  }
  async function refreshAzureVoices() {
    const sel = $("azure-voice-select");
    const state = $("azure-voice-state");
    if (!sel) return;
    const key = (localStorage.getItem(LS_AZURE) || "").trim();
    const region =
      (localStorage.getItem(LS_AZURE_REGION) || "").trim() ||
      AZURE_DEFAULT_REGION;
    sel.innerHTML = "";
    if (!key) {
      azureVoices = [];
      if (state)
        state.textContent =
          "Sin clave de Azure: Isis usa la voz del teléfono.";
      sel.disabled = true;
      const opt = document.createElement("option");
      opt.textContent = "Falta la clave de Azure";
      sel.appendChild(opt);
      return;
    }
    if (state) state.textContent = "Cargando voces de Azure…";
    sel.disabled = true;
    try {
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azureKey: key, azureRegion: region }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.voices)) {
        throw new Error(data?.error || "no voices");
      }
      // Solo español: es-MX, es-US y es-ES (la API trae todos los idiomas).
      azureVoices = data.voices.filter(
        (v) =>
          v &&
          v.name &&
          Array.isArray(v.languageCodes) &&
          v.languageCodes.some((lc) =>
            ["es-mx", "es-us", "es-es"].includes(String(lc).toLowerCase())
          )
      );
      if (azureVoices.length === 0) throw new Error("empty");
      azureVoices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = azureVoiceLabel(v);
        sel.appendChild(opt);
      });
      const saved = (localStorage.getItem(LS_AZURE_VOICE) || "").trim();
      const pick =
        azureVoices.find((v) => v.name === saved) ||
        azureVoices.find((v) => v.name === AZURE_DEFAULT_VOICE) ||
        azureVoices[0];
      selectedAzureVoice = pick.name;
      sel.value = pick.name;
      sel.disabled = false;
      if (state)
        state.textContent = `${azureVoices.length} voces de Azure disponibles.`;
    } catch (e) {
      azureVoices = [];
      sel.innerHTML = "";
      const opt = document.createElement("option");
      opt.textContent = "No se pudieron cargar las voces";
      sel.appendChild(opt);
      if (state)
        state.textContent =
          "No pude cargar las voces de Azure. Isis usa la voz del teléfono.";
    }
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
  // --- audio de Azure AI Speech: un solo elemento <audio> reutilizado.
  let azureAudio = null;
  let azureGen = 0;
  function stopAzureAudio() {
    azureGen += 1;
    if (azureAudio) {
      try {
        azureAudio.pause();
      } catch (e) {}
      azureAudio.src = "";
      azureAudio = null;
    }
  }
  // Limpieza al terminar de hablar (sirve para la voz del teléfono y
  // para Azure): se quita el estado "hablando" y vuelve la escucha.
  function finishSpeaking() {
    speakingNow = false;
    orb.classList.remove("speaking");
    orb.classList.remove("listening");
    setOrbStatus(idleStatus());
    setTimeout(maybeStartWake, 800);
  }
  // speak(text, moodOverride): con clave de Azure usa esa voz
  // natural; si no hay clave o Azure falla, usa la voz del teléfono
  // como siempre. Isis nunca se queda muda. Para Azure la emoción
  // la da la propia voz (no se toca pitch ni rate del audio).
  async function speak(text, moodOverride) {
    const clean = String(text || "").trim();
    if (!clean) return;
    // Cortar lo que esté sonando (sea del teléfono o de Azure).
    stopAzureAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speakGen += 1;
    const key = (localStorage.getItem(LS_AZURE) || "").trim();
    const region =
      (localStorage.getItem(LS_AZURE_REGION) || "").trim() ||
      AZURE_DEFAULT_REGION;
    if (key) {
      const ok = await speakAzure(clean, key, region);
      if (ok) return;
      // Si Azure falló, se cae a la voz del teléfono.
    }
    speakPhone(clean, moodOverride);
  }
  async function speakAzure(text, key, region) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          azureKey: key,
          azureRegion: region,
          voiceName: selectedAzureVoice || AZURE_DEFAULT_VOICE,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.audioBase64) return false;
      const gen = azureGen;
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
      azureAudio = audio;
      audio.onplay = () => {
        if (gen !== azureGen) return;
        speakingNow = true;
        orb.classList.add("speaking");
        orb.classList.remove("listening");
      };
      const done = () => {
        if (gen !== azureGen) return;
        azureAudio = null;
        finishSpeaking();
      };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
      return true;
    } catch (e) {
      azureAudio = null;
      return false;
    }
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
    const t = String(text || "").trim();
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
    div.appendChild(document.createTextNode(text));
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
      originalText: originalText || null,
      fableaiKey: fableaiKey || null,
    };
    const ask = `Voy a ${action.summary || action.mitote_action}. ¿Confirmas?`;
    addBubble("isis", ask, "El Mitote · confirmar");
    speak(ask);
    recordExchange(ask);
    setOrbStatus("Te espero: ¿confirmas?");
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
        // Claude escribió texto antes del JSON: se muestra el texto sin el
        // JSON y luego se ejecuta la acción.
        const rest = stripActionJson(cleanReply, nextFound);
        if (hasMeaningfulText(rest)) {
          addBubble("isis", rest, "Isis");
          speak(rest);
        }
        const next = nextFound.action;
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
    if (pendingMitote) {
      const pending = pendingMitote;
      pendingMitote = null;
      if (isAffirmative(text)) {
        setThinking(true);
        const params = { ...(pending.params || {}), confirmed: true };
        await runMitoteChain(pending.fableaiKey, pending.originalText || text, pending.mitote_action, params, 0);
        setThinking(false);
        if (!pendingMitote) setOrbStatus(idleStatus());
        setTimeout(maybeStartWake, 1200);
        return;
      }
      if (isNegative(text)) {
        sayFinal("El Mitote", "Listo, no lo hago.");
        setOrbStatus(idleStatus());
        setTimeout(maybeStartWake, 1200);
        return;
      }
      // Otra cosa: se descarta la confirmación y el mensaje sigue normal.
      addBubble("isis", "De acuerdo, dejamos eso sin hacer.", "El Mitote");
    }

    // Clima: siempre por /api/weather, nunca culpar a la clave de Claude.
    if (isWeatherQuestion(text)) {
      await handleWeather();
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
    setOrbStatus(idleStatus());
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
        summary: loadSummary(),
      });
      if (!ok && data.error) {
        analysisBox.innerHTML = `<p>${escapeHtml(data.error)}</p>`;
        return;
      }
      // Por si Claude devuelve marcadores en el análisis, se quitan de
      // la pantalla (aquí no se guarda memoria: no es una conversación).
      const mem = extractMemory(data.analysis || "");
      const { text: cleanAnalysis, mood } = extractMood(mem.text);
      if (mood) setMood(mood);
      analysisBox.textContent = cleanAnalysis || "Sin análisis.";
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
    const w = $("cfg-whatsapp").value.trim();
    const t = $("cfg-textbee") ? $("cfg-textbee").value.trim() : "";
    const d = $("cfg-textbee-device")
      ? $("cfg-textbee-device").value.trim()
      : "";
    const a = $("cfg-azure") ? $("cfg-azure").value.trim() : "";
    const r = $("cfg-azure-region")
      ? $("cfg-azure-region").value.trim()
      : "";
    if (f) localStorage.setItem(LS_FABLEAI, f);
    if (n) localStorage.setItem(LS_N8N, n);
    if (w) localStorage.setItem(LS_WHATSAPP, w);
    if (t) localStorage.setItem(LS_TEXTBEE, t);
    if (d) localStorage.setItem(LS_TEXTBEE_DEVICE, d);
    if (a) localStorage.setItem(LS_AZURE, a);
    if (r) localStorage.setItem(LS_AZURE_REGION, r);
    $("cfg-fableai").value = "";
    $("cfg-n8n").value = "";
    $("cfg-whatsapp").value = "";
    if ($("cfg-textbee")) $("cfg-textbee").value = "";
    if ($("cfg-textbee-device")) $("cfg-textbee-device").value = "";
    if ($("cfg-azure")) $("cfg-azure").value = "";
    if ($("cfg-azure-region")) $("cfg-azure-region").value = "";
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves guardadas en este navegador.";
    refreshKeyUI();
    refreshAzureVoices();
    loadOrlando();
  });
  $("btn-clear-config").addEventListener("click", () => {
    localStorage.removeItem(LS_FABLEAI);
    localStorage.removeItem(LS_N8N);
    localStorage.removeItem(LS_WHATSAPP);
    localStorage.removeItem(LS_TEXTBEE);
    localStorage.removeItem(LS_TEXTBEE_DEVICE);
    localStorage.removeItem(LS_AZURE);
    localStorage.removeItem(LS_AZURE_REGION);
    localStorage.removeItem(LS_AZURE_VOICE);
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves borradas de este navegador.";
    refreshKeyUI();
    refreshAzureVoices();
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
  // --- selector de voz de Azure (Configuración): se llena desde
  // /api/voices cuando hay clave y región. Al elegir, se guarda la voz.
  const azureVoiceSelect = $("azure-voice-select");
  if (azureVoiceSelect) {
    azureVoiceSelect.addEventListener("change", () => {
      if (!azureVoiceSelect.value) return;
      selectedAzureVoice = azureVoiceSelect.value;
      localStorage.setItem(LS_AZURE_VOICE, selectedAzureVoice);
    });
  }
  const testVoiceBtn = $("btn-test-voice");
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener("click", () => {
      stopWake(); // que no se escuche a sí misma y se active sola
      speak(
        "¡Hola, Santiago! Me da mucho gusto verte, ¿en qué te ayudo hoy?",
        "alegre"
      );
    });
  }

  // ---------------------------------------------------------- inicio
  refreshKeyUI();
  renderFacts();
  renderContacts();
  renderMemory();
  loadOrlando();
  // Las voces del teléfono llegan tarde en Android: se escucha el evento.
  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  }
  refreshVoices();
  refreshAzureVoices();
  updateWakeUI();
  // Conversación plegable: empieza colapsada (solo la vista previa).
  if (chatToggle) {
    chatToggle.addEventListener("click", () => {
      setChatCollapsed(!chatCard.classList.contains("collapsed"));
    });
  }
  setChatCollapsed(true);
  // Dock estilo JARVIS: reutiliza los botones que ya existen.
  const dockOrlando = $("dock-orlando");
  if (dockOrlando) {
    dockOrlando.addEventListener("click", () => {
      $("btn-orlando").click();
      orlandoPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
  const dockAnalyze = $("dock-analyze");
  if (dockAnalyze) {
    dockAnalyze.addEventListener("click", () => $("btn-analyze").click());
  }
  const dockMic = $("dock-mic");
  if (dockMic) {
    dockMic.addEventListener("click", () => orb.click());
  }
  const dockVoice = $("dock-voice");
  if (dockVoice) {
    dockVoice.addEventListener("click", () => {
      const b = $("btn-test-voice");
      if (b) b.click();
    });
  }
  const dockConfig = $("dock-config");
  if (dockConfig) {
    dockConfig.addEventListener("click", () => toggleConfig());
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
