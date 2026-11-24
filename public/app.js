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
  const LS_CONTACTS = "isis_contacts";

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
      whatsappToken: (localStorage.getItem(LS_WHATSAPP) || "").trim(),
      textbeeKey: (localStorage.getItem(LS_TEXTBEE) || "").trim(),
      textbeeDevice: (localStorage.getItem(LS_TEXTBEE_DEVICE) || "").trim(),
    };
  }

  function refreshKeyUI() {
    const { fableaiKey, n8nKey, whatsappToken, textbeeKey, textbeeDevice } =
      getKeys();
    const fState = $("cfg-fableai-state");
    const nState = $("cfg-n8n-state");
    const wState = $("cfg-whatsapp-state");
    const tState = $("cfg-textbee-state");
    const dState = $("cfg-textbee-device-state");
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
    orbMood.hidden = false;
    orbMood.textContent = "· " + MOODS[mood] + " ·";
    orbMood.className = "orb-mood mood-" + mood;
    orb.classList.remove(...MOOD_CLASSES);
    orb.classList.add("mood-" + mood);
  }

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

  // La respuesta de Claude para mandar un mensaje es solo un JSON:
  // {"action":"send_whatsapp","to":"...","message":"..."} o
  // {"action":"send_sms","to":"...","message":"..."}
  function parseSendAction(reply) {
    if (!reply) return null;
    let text = String(reply).trim();
    // Por si Claude le pegó el marcador de ánimo al JSON, se quita antes.
    text = text.replace(/\[ánimo:\s*[a-záéíóúñ]+\s*\]/gi, "").trim();
    // Por si Claude lo envuelve en un bloque de código.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) text = fenced[1].trim();
    if (!text.startsWith("{")) return null;
    try {
      const parsed = JSON.parse(text);
      if (
        parsed &&
        (parsed.action === "send_whatsapp" || parsed.action === "send_sms") &&
        typeof parsed.to === "string" &&
        typeof parsed.message === "string"
      ) {
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function handleSendSms(action) {
    const to = String(action.to || "").trim();
    const message = String(action.message || "").trim();
    if (!message) {
      const msg = "¿Qué le escribo por SMS? Dime el mensaje y lo mando.";
      addBubble("isis", msg, "SMS");
      speak(msg);
      return;
    }
    const recipient = resolveRecipient(to);
    if (!recipient) {
      const msg = `No tengo el número de ${to || "esa persona"}. Dime su número o agrégalo en Contactos y lo intento de nuevo.`;
      addBubble("isis", msg, "SMS");
      speak(msg);
      return;
    }
    const { textbeeKey, textbeeDevice } = getKeys();
    if (!textbeeKey) {
      const msg =
        "Falta la clave de TextBee en Configuración. Pégala ahí y lo intento de nuevo.";
      addBubble("isis", msg, "SMS");
      speak(msg);
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
        const msg = `Listo, le mandé el SMS a ${recipient.name} desde tu número: ${message}`;
        addBubble("isis", msg, "SMS · enviado");
        speak(msg);
      } else {
        const msg = data.error || "No pude mandar el SMS.";
        addBubble("isis", msg, "SMS");
        speak(msg);
      }
    } catch (e) {
      const msg = "No pude hablar con el servidor ahora mismo.";
      addBubble("isis", msg, "SMS");
      speak(msg);
    }
    setOrbStatus("Toca el círculo para hablar");
  }

  async function handleSendWhatsapp(action) {
    const to = String(action.to || "").trim();
    const message = String(action.message || "").trim();
    if (!message) {
      const msg = "¿Qué le escribo? Dime el mensaje y lo mando.";
      addBubble("isis", msg, "WhatsApp");
      speak(msg);
      return;
    }
    const recipient = resolveRecipient(to);
    if (!recipient) {
      const msg = `No tengo el número de ${to || "esa persona"}. Dime su número o agrégalo en Contactos y lo intento de nuevo.`;
      addBubble("isis", msg, "WhatsApp");
      speak(msg);
      return;
    }
    const { whatsappToken } = getKeys();
    if (!whatsappToken) {
      const msg =
        "Falta el token de WhatsApp en Configuración. Pégalo ahí y lo intento de nuevo.";
      addBubble("isis", msg, "WhatsApp");
      speak(msg);
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
        const msg = `Listo, le escribí a ${recipient.name}: ${message}`;
        addBubble("isis", msg, "WhatsApp · enviado");
        speak(msg);
      } else {
        const msg = data.error || "No pude mandar el mensaje.";
        addBubble("isis", msg, "WhatsApp");
        speak(msg);
      }
    } catch (e) {
      const msg = "No pude hablar con el servidor ahora mismo.";
      addBubble("isis", msg, "WhatsApp");
      speak(msg);
    }
    setOrbStatus("Toca el círculo para hablar");
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
        // El marcador de ánimo no se muestra en el chat ni se lee en voz alta.
        const { text: cleanReply, mood } = extractMood(data.reply);
        if (mood) setMood(mood);
        const action = parseSendAction(cleanReply);
        if (action) {
          // Claude pidió mandar un mensaje: se ejecuta, nunca se muestra el JSON.
          if (action.action === "send_sms") await handleSendSms(action);
          else await handleSendWhatsapp(action);
        } else {
          addBubble("isis", cleanReply, data.claudeLive ? "Isis · Claude en vivo" : "Isis");
          speak(cleanReply);
        }
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
      const { text: cleanAnalysis, mood } = extractMood(data.analysis || "");
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
    if (f) localStorage.setItem(LS_FABLEAI, f);
    if (n) localStorage.setItem(LS_N8N, n);
    if (w) localStorage.setItem(LS_WHATSAPP, w);
    if (t) localStorage.setItem(LS_TEXTBEE, t);
    if (d) localStorage.setItem(LS_TEXTBEE_DEVICE, d);
    $("cfg-fableai").value = "";
    $("cfg-n8n").value = "";
    $("cfg-whatsapp").value = "";
    if ($("cfg-textbee")) $("cfg-textbee").value = "";
    if ($("cfg-textbee-device")) $("cfg-textbee-device").value = "";
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves guardadas en este navegador.";
    refreshKeyUI();
    loadOrlando();
  });
  $("btn-clear-config").addEventListener("click", () => {
    localStorage.removeItem(LS_FABLEAI);
    localStorage.removeItem(LS_N8N);
    localStorage.removeItem(LS_WHATSAPP);
    localStorage.removeItem(LS_TEXTBEE);
    localStorage.removeItem(LS_TEXTBEE_DEVICE);
    const msg = $("config-msg");
    msg.hidden = false;
    msg.textContent = "Claves borradas de este navegador.";
    refreshKeyUI();
    loadOrlando();
  });

  // ---------------------------------------------------------- inicio
  refreshKeyUI();
  renderFacts();
  renderContacts();
  loadOrlando();
  addBubble(
    "isis",
    "Hola, soy Isis. Tócame el círculo y háblame, o escríbeme abajo. Si me preguntas por Orlando, lo reviso; si me preguntas por el clima, lo consulto en vivo; y si me pides que le escriba a alguien, lo mando por SMS desde tu número (o por WhatsApp si me lo pides así).",
    "Isis"
  );
})();
