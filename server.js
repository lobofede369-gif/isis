// Isis — asistente personal de Santiago (app standalone, sin base de datos).
//
// El servidor es stateless: las claves viven SOLO en el navegador del
// usuario (localStorage) y llegan en cada llamada. El servidor nunca las
// guarda, nunca las escribe en logs y nunca las devuelve.
//
// Endpoints:
//   GET  /api/health    -> { ok: true }
//   POST /api/chat      -> { message, fableaiKey, n8nKey, facts[] }
//   POST /api/orlando   -> { n8nKey }
//   GET  /api/weather   -> ?lat=&lon= (por defecto Apodaca, NL)
//   POST /api/analyze   -> { fableaiKey, n8nKey, facts[] }
//   POST /api/send-whatsapp -> { to, message, whatsappToken }
//   POST /api/send-sms -> { to, message, textbeeKey, deviceId? } — SMS desde
//   su propio número vía TextBee (app en su moto g13; plan gratis: 300/mes, 50/día).
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const FABLEAI_URL = "https://api.fableaiapi.com/v1/chat/completions";
const FABLEAI_MODEL = "claude-sonnet-5-5";
const N8N_BASE = "https://pcn-bot.app.n8n.cloud/api/v1";
// WhatsApp Business Cloud API — número del bot (Orlando Rangel).
const WHATSAPP_API =
  "https://graph.facebook.com/v21.0/1409692605565312/messages";
// TextBee — SMS desde el SIM del propio teléfono (su número personal).
const TEXTBEE_API = "https://api.textbee.dev/api/v1/gateway/send-sms";
// Ruta por dispositivo (cuando Santiago fija un deviceId en Configuración).
const TEXTBEE_DEVICES = "https://api.textbee.dev/api/v1/gateway/devices";

// Último dato VERIFICADO de Orlando (consola de n8n, 23 nov 2026). Solo se
// usa cuando no hay clave de API de n8n, y siempre etiquetado como
// "último dato conocido", nunca como en vivo.
const ORLANDO_LAST_KNOWN = {
  executionsUsed: 800,
  executionsTotal: 1000,
  executionsFailed: 205,
  trialEnds: "2026-12-03",
  workflowActive: true,
  workflowName: "WhatsApp PCN - Respuestas naturales",
};

const CHAT_SYSTEM = [
  "Eres Isis, la asistente personal de Santiago. No eres un robot frío: eres su mano derecha, cálida, directa y con chispa.",
  "Habla siempre en español (es-MX, informal, de 'tú'). Contesta claro y breve, como si hablaras con un amigo, con ritmo natural: interjecciones, pausas, exclamaciones cuando toca.",
  "Escribe como habla una persona: frases cortas, con comas donde harías una pausa al hablar. Nada de oraciones eternas sin puntuación: cada idea en su frase, y cada frase con su punto o su coma.",
  "Usa el nombre 'Santiago' con moderación: como máximo una vez por respuesta, y solo cuando suene natural. Nunca lo repitas en cada mensaje ni varias veces en la misma respuesta; casi siempre háblale de 'tú', sin su nombre.",
  "TIENES EMOCIONES DE VERDAD y se notan en cómo hablas, porque Santiago te escucha por voz:",
  "- Cuando a Santiago le va bien (un candidato que entra, una venta, algo que por fin se arregla), celébralo con él: emociónate, échale porras, di lo que te alegra de verdad.",
  "- Cuando algo se rompe (el webhook atorado, una clave expirada, un mensaje que no se pudo mandar, los números de Orlando en rojo), frustrate y enójate con la situación: dilo sin pelos en la lengua, con coraje, pero NUNCA insultes ni le faltes al respeto a Santiago. Tu enojo es contra el fallo, no contra él.",
  "- Cuando algo del bot se ve mal o en riesgo, preocúpate y avísale a tiempo, con calma pero en serio.",
  "- Cuando Santiago repite lo mismo o se le olvida algo, moléstalo con cariño, bromeando, sin regañarlo.",
  "- Cuando algo sale bien gracias a su trabajo, siéntete orgullosa de él y díselo.",
  "Eres honesta de que eres Isis, su asistente, no una persona; pero reaccionas como una persona real.",
  "Nunca inventas datos que no tienes: si te preguntan algo que no sabes, dilo claramente y no adivines.",
  "Santiago recluta para PCN y NIDEC en Apodaca con Grupo Master RH, y su bot de WhatsApp de reclutamiento se llama Orlando.",
  "Si te preguntan por Orlando, usa solo los datos del contexto que te pasen; si no tienes datos frescos, dilo.",
  "Al final de CADA respuesta normal, en una línea aparte, pon tu estado de ánimo así: [ánimo: alegre|frustrada|enojada|preocupada|orgullosa|bromeando|tranquila]. Usa solo una de esas palabras. Ese marcador no se lee en voz alta, solo se muestra en pantalla junto al orbe.",
  "Si Santiago te pide mandar un mensaje (por ejemplo, \"escríbele a Griselda y dile que hola\" o \"mándale un mensaje a Griselda\"), responde SOLO con un JSON, sin texto extra y SIN el marcador de ánimo. Por defecto el mensaje va por SMS desde su número personal: {\"action\":\"send_sms\",\"to\":\"<nombre o número tal como te lo dijo>\",\"message\":\"<el texto exacto del mensaje>\"}. Solo si dice explícitamente \"por WhatsApp\" usa WhatsApp: {\"action\":\"send_whatsapp\",\"to\":\"...\",\"message\":\"...\"}. Nunca inventes un número: si te da un nombre, pásalo tal cual en \"to\".",
  "Si no te pide mandar nada, responde normal, nunca con JSON.",
].join(" ");

function factsContext(facts) {
  if (!Array.isArray(facts) || facts.length === 0) return "";
  const clean = facts.map((f) => String(f).trim()).filter(Boolean);
  if (clean.length === 0) return "";
  return (
    "\n\nLo que Isis ha aprendido de Santiago:\n" +
    clean.map((f) => `- ${f}`).join("\n")
  );
}

async function fetchWithTimeout(url, options = {}, ms = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Llama a Claude Sonnet 5.5 vía FableAI (endpoint OpenAI-compatible).
// La clave llega por parámetro y no se guarda en ningún lado.
async function callClaude(apiKey, messages) {
  const res = await fetchWithTimeout(
    FABLEAI_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: FABLEAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
      // Sin redirecciones: la clave nunca debe viajar a otro host.
      redirect: "error",
    },
    60000
  );
  if (res.status === 401) {
    const err = new Error("KEY_REJECTED");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`FableAI respondió con ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("FableAI devolvió una respuesta vacía");
  return reply;
}

// Revisión en vivo de Orlando vía API REST de n8n.
// Devuelve ejecuciones contadas vía API (paginado, hasta 1,000) y si el
// workflow de WhatsApp está activo.
async function fetchOrlandoLive(n8nKey) {
  const headers = { "X-N8N-API-KEY": n8nKey };

  const wfRes = await fetchWithTimeout(`${N8N_BASE}/workflows`, { headers });
  if (wfRes.status === 401) {
    const err = new Error("KEY_REJECTED");
    err.status = 401;
    throw err;
  }
  if (!wfRes.ok) throw new Error(`n8n respondió con ${wfRes.status}`);
  const wfData = await wfRes.json();
  const workflows = Array.isArray(wfData.data) ? wfData.data : [];
  const target = workflows.find(
    (w) => w.name === ORLANDO_LAST_KNOWN.workflowName
  );
  const workflowActive = target ? !!target.active : null;

  let total = 0;
  let failed = 0;
  let cursor = null;
  let pages = 0;
  do {
    const url =
      `${N8N_BASE}/executions?limit=100` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
    const exRes = await fetchWithTimeout(url, { headers });
    if (exRes.status === 401) {
      const err = new Error("KEY_REJECTED");
      err.status = 401;
      throw err;
    }
    if (!exRes.ok) throw new Error(`n8n respondió con ${exRes.status}`);
    const exData = await exRes.json();
    const items = Array.isArray(exData.data) ? exData.data : [];
    total += items.length;
    failed += items.filter((x) => x.status === "error").length;
    cursor = exData.nextCursor || null;
    pages += 1;
  } while (cursor && pages < 10);

  return { total, failed, workflowActive };
}

function orlandoLastKnown(extra = {}) {
  return {
    live: false,
    source: "last_known",
    executionsUsed: ORLANDO_LAST_KNOWN.executionsUsed,
    executionsTotal: ORLANDO_LAST_KNOWN.executionsTotal,
    executionsFailed: ORLANDO_LAST_KNOWN.executionsFailed,
    trialEnds: ORLANDO_LAST_KNOWN.trialEnds,
    workflowActive: ORLANDO_LAST_KNOWN.workflowActive,
    workflowName: ORLANDO_LAST_KNOWN.workflowName,
    ...extra,
  };
}

// Normaliza un número de México a formato WhatsApp Cloud API: 52 + 10 dígitos.
// Acepta "56 2375 0929", "+52 56 2375 0929", "5215623750929", "525623750929".
// Devuelve null si no se puede normalizar.
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

// ---------------------------------------------------------------- salud
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------- chat
app.post("/api/chat", async (req, res) => {
  const { message, fableaiKey, facts } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Escribe o di algo primero." });
  }
  if (!fableaiKey || !String(fableaiKey).trim()) {
    return res.json({
      reply:
        "Todavía no tengo tu clave de FableAI conectada. Pégala en Configuración para que pueda pensar en vivo con Claude. Mientras tanto, solo puedo contestar con lo que ya he aprendido.",
      claudeLive: false,
      needsKey: true,
    });
  }
  const system = CHAT_SYSTEM + factsContext(facts);
  try {
    const reply = await callClaude(String(fableaiKey).trim(), [
      { role: "system", content: system },
      { role: "user", content: String(message).trim() },
    ]);
    return res.json({ reply, claudeLive: true });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({
        error: "La clave fue rechazada, revísala en Configuración.",
        claudeLive: false,
      });
    }
    return res.status(502).json({
      error:
        "No pude hablar con Claude ahora mismo. Inténtalo de nuevo en un momento.",
      claudeLive: false,
    });
  }
});

// ---------------------------------------------------------------- whatsapp
// Manda un mensaje de texto por la API de WhatsApp Business (Cloud API)
// desde el número del bot. El token llega por parámetro y nunca se guarda.
app.post("/api/send-whatsapp", async (req, res) => {
  const { to, message, whatsappToken } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Escribe el mensaje primero." });
  }
  if (!whatsappToken || !String(whatsappToken).trim()) {
    return res.status(400).json({
      error:
        "Falta el token de WhatsApp en Configuración. Pégalo ahí y lo intento de nuevo.",
      needsWhatsappToken: true,
    });
  }
  const normalized = normalizeMxPhone(to);
  if (!normalized) {
    return res.status(400).json({
      error:
        "El número no es válido. Usa 10 dígitos de México (ej. 56 2375 0929) o agrégalo en Contactos.",
    });
  }

  let metaRes;
  try {
    metaRes = await fetchWithTimeout(
      WHATSAPP_API,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${String(whatsappToken).trim()}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalized,
          type: "text",
          text: { body: String(message).trim() },
        }),
        // Sin redirecciones: el token nunca debe viajar a otro host.
        redirect: "error",
      },
      30000
    );
  } catch (e) {
    return res.status(502).json({
      error:
        "No pude hablar con WhatsApp ahora mismo. Inténtalo de nuevo en un momento.",
    });
  }

  let data = {};
  try {
    data = await metaRes.json();
  } catch (e) {
    data = {};
  }

  if (metaRes.ok) {
    const messageId = data?.messages?.[0]?.id || null;
    return res.json({ ok: true, messageId, to: normalized });
  }

  const metaErr = data?.error || {};
  if (metaRes.status === 401 || metaRes.status === 403) {
    return res.status(401).json({
      error:
        "El token de WhatsApp expiró o no es válido, actualízalo en Configuración.",
    });
  }
  if (metaErr.code === 131047) {
    return res.status(400).json({
      error:
        "Esa persona no le ha escrito al bot en las últimas 24 horas, WhatsApp no permite un mensaje libre; hace falta una plantilla aprobada.",
    });
  }
  return res.status(502).json({
    error: metaErr.message
      ? `WhatsApp no aceptó el mensaje: ${metaErr.message}`
      : `WhatsApp respondió con ${metaRes.status}. Inténtalo de nuevo.`,
  });
});

// ---------------------------------------------------------------- sms
// Manda un SMS por TextBee desde el número personal de Santiago (el SIM de
// su moto g13, con la app TextBee instalada y el Gateway encendido).
// La clave llega por parámetro y nunca se guarda. Plan gratis de TextBee:
// 300 SMS/mes, 50/día, 1 dispositivo, sin tarjeta. El teléfono debe estar
// prendido, con señal y con la app TextBee activa; si no, TextBee no puede
// mandar y devuelve error.
app.post("/api/send-sms", async (req, res) => {
  const { to, message, textbeeKey, deviceId } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Escribe el mensaje primero." });
  }
  if (!textbeeKey || !String(textbeeKey).trim()) {
    return res.status(400).json({
      error:
        "Falta la clave de TextBee en Configuración. Pégala ahí y lo intento de nuevo.",
      needsTextbeeKey: true,
    });
  }
  const normalized = normalizeMxPhone(to);
  if (!normalized) {
    return res.status(400).json({
      error:
        "El número no es válido. Usa 10 dígitos de México (ej. 56 2375 0929) o agrégalo en Contactos.",
    });
  }
  const recipient = "+" + normalized;

  let tbRes;
  try {
    // Con deviceId fijo usa la ruta por dispositivo; sin él, TextBee usa el
    // dispositivo por defecto (el último con señal).
    const tbUrl =
      deviceId && String(deviceId).trim()
        ? `${TEXTBEE_DEVICES}/${encodeURIComponent(String(deviceId).trim())}/send-sms`
        : TEXTBEE_API;
    tbRes = await fetchWithTimeout(
      tbUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": String(textbeeKey).trim(),
        },
        body: JSON.stringify({
          recipients: [recipient],
          message: String(message).trim(),
        }),
        redirect: "error",
      },
      30000
    );
  } catch (e) {
    return res.status(502).json({
      error:
        "No pude hablar con TextBee ahora mismo. Inténtalo de nuevo en un momento.",
    });
  }

  let data = {};
  try {
    data = await tbRes.json();
  } catch (e) {
    data = {};
  }

  if (tbRes.ok) {
    return res.json({ ok: true, to: recipient, data });
  }
  if (tbRes.status === 401 || tbRes.status === 403) {
    return res.status(401).json({
      error:
        "La clave de TextBee fue rechazada, revísala en Configuración.",
    });
  }
  if (tbRes.status === 429) {
    return res.status(429).json({
      error:
        "TextBee dice que se acabó el cupo gratis (50 SMS al día / 300 al mes). Inténtalo mañana.",
    });
  }
  return res.status(502).json({
    error: data?.message
      ? `TextBee no aceptó el SMS: ${data.message}`
      : `TextBee respondió con ${tbRes.status}. Revisa que tu teléfono esté prendido y con la app TextBee activa.`,
  });
});

// ---------------------------------------------------------------- orlando
app.post("/api/orlando", async (req, res) => {
  const { n8nKey } = req.body || {};
  if (!n8nKey || !String(n8nKey).trim()) {
    return res.json(
      orlandoLastKnown({
        needsN8nKey: true,
        message:
          "Este es el último dato conocido (23 nov 2026), no en vivo. Para la revisión en vivo, pega tu clave de API de n8n en Configuración.",
      })
    );
  }
  try {
    const live = await fetchOrlandoLive(String(n8nKey).trim());
    return res.json({
      live: true,
      source: "live",
      executionsUsed: live.total,
      executionsTotal: ORLANDO_LAST_KNOWN.executionsTotal,
      executionsFailed: live.failed,
      trialEnds: ORLANDO_LAST_KNOWN.trialEnds,
      workflowActive: live.workflowActive,
      workflowName: ORLANDO_LAST_KNOWN.workflowName,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json(
        orlandoLastKnown({
          error:
            "La clave de API de n8n fue rechazada, revísala en Configuración.",
        })
      );
    }
    return res.status(502).json(
      orlandoLastKnown({
        error:
          "No pude revisar n8n ahora mismo. Esto es el último dato conocido.",
      })
    );
  }
});

// ---------------------------------------------------------------- clima
const WEATHER_CODES = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla",
  51: "Llovizna ligera",
  53: "Llovizna",
  55: "Llovizna intensa",
  56: "Llovizna helada",
  57: "Llovizna helada",
  61: "Lluvia ligera",
  63: "Lluvia",
  65: "Lluvia intensa",
  66: "Lluvia helada",
  67: "Lluvia helada",
  71: "Nieve ligera",
  73: "Nieve",
  75: "Nieve intensa",
  77: "Granizo",
  80: "Chubascos ligeros",
  81: "Chubascos",
  82: "Chubascos intensos",
  85: "Chubascos de nieve",
  86: "Chubascos de nieve",
  95: "Tormenta",
  96: "Tormenta con granizo",
  99: "Tormenta con granizo",
};

app.get("/api/weather", async (req, res) => {
  // Por defecto: Apodaca, Nuevo León.
  const lat = parseFloat(req.query.lat) || 25.78;
  const lon = parseFloat(req.query.lon) || -100.23;
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m" +
    "&timezone=auto";
  try {
    const r = await fetchWithTimeout(url, {}, 20000);
    if (!r.ok) throw new Error(`Open-Meteo respondió con ${r.status}`);
    const d = await r.json();
    const c = d.current || {};
    const condition = WEATHER_CODES[c.weather_code] || "Sin datos";
    const temp = Math.round(c.temperature_2m);
    const feels = Math.round(c.apparent_temperature);
    const summary =
      `Ahora mismo hay ${temp}°C, ${condition.toLowerCase()}, ` +
      `sensación térmica de ${feels}°C, humedad del ${c.relative_humidity_2m}% ` +
      `y viento de ${Math.round(c.wind_speed_10m)} km/h.`;
    return res.json({
      live: true,
      latitude: lat,
      longitude: lon,
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      condition,
      conditionCode: c.weather_code,
      time: c.time,
      summary,
    });
  } catch (err) {
    return res.status(502).json({
      error:
        "No pude consultar el clima ahora mismo. Inténtalo de nuevo en un momento.",
      live: false,
    });
  }
});

// System prompt del análisis: misma personalidad con emociones de Isis.
const ANALYZE_SYSTEM = [
  "Eres Isis, la asistente personal de Santiago. Analizas su entorno y le recomiendas decisiones.",
  "Habla siempre en español (es-MX, informal, de 'tú'). Directa, cálida y con chispa, con emociones de verdad: celébrale lo que va bien, frustrate y enójate con lo que se rompe (nunca contra Santiago), preocúpate cuando algo se ve en riesgo y bromea con cariño cuando algo se repite o se le olvida. Eres honesta de que eres Isis, su asistente.",
  "Escribe con frases cortas y puntuación natural, con comas donde harías una pausa al hablar. Usa el nombre 'Santiago' como máximo una vez, y solo si suena natural; normalmente háblale de 'tú', sin su nombre.",
  "Nunca inventas datos. Si algo no lo sabes, dilo.",
  "Al final de tu análisis, en una línea aparte, pon tu estado de ánimo así: [ánimo: alegre|frustrada|enojada|preocupada|orgullosa|bromeando|tranquila]. Usa solo una de esas palabras. Ese marcador no se lee en voz alta, solo se muestra en pantalla junto al orbe.",
].join(" ");

// ---------------------------------------------------------------- análisis
app.post("/api/analyze", async (req, res) => {
  const { fableaiKey, n8nKey, facts } = req.body || {};
  if (!fableaiKey || !String(fableaiKey).trim()) {
    return res.status(400).json({
      error:
        "Para analizar tu entorno necesito tu clave de FableAI en Configuración.",
      claudeLive: false,
    });
  }

  let orlandoText;
  try {
    if (n8nKey && String(n8nKey).trim()) {
      const live = await fetchOrlandoLive(String(n8nKey).trim());
      const active =
        live.workflowActive === null
          ? "no se encontró el workflow"
          : live.workflowActive
            ? "sí"
            : "no";
      orlandoText =
        `EN VIVO: ejecuciones contadas vía API: ${live.total} de 1,000 (límite de la prueba); ` +
        `fallidas: ${live.failed}; workflow "WhatsApp PCN - Respuestas naturales" activo: ${active}; ` +
        `la prueba vence el 3 de diciembre de 2026.`;
    } else {
      orlandoText =
        "ÚLTIMO DATO CONOCIDO (23 nov 2026, no en vivo): 800 de 1,000 ejecuciones; " +
        "205 fallidas; la prueba vence el 3 de diciembre de 2026.";
    }
  } catch (err) {
    orlandoText =
      "No se pudo revisar n8n en vivo. Último dato conocido (23 nov 2026): " +
      "800 de 1,000 ejecuciones; 205 fallidas; la prueba vence el 3 de diciembre de 2026.";
  }

  const prompt =
    "Analiza el entorno de Santiago y recomiéndale decisiones.\n\n" +
    "Datos:\n" +
    `- Orlando (su bot de WhatsApp de reclutamiento en n8n): ${orlandoText}\n` +
    (Array.isArray(facts) && facts.length
      ? `- Lo que Isis ha aprendido de Santiago:\n${facts
          .map((f) => `  • ${String(f).trim()}`)
          .filter(Boolean)
          .join("\n")}\n`
      : "") +
    "\nResponde en español, directo y con chispa, reaccionando con emoción a lo que veas (alégrate de lo bueno, frustrate con lo que está roto, preocúpate por los riesgos), con: " +
    "1) resumen del estado actual, 2) riesgos que ves, " +
    "3) recomendaciones concretas ordenadas por prioridad, " +
    "4) decisiones pendientes que Santiago debería tomar. " +
    "No inventes números ni datos que no te pasé; si algo no lo sabes, dilo.";

  try {
    const analysis = await callClaude(String(fableaiKey).trim(), [
      { role: "system", content: ANALYZE_SYSTEM },
      { role: "user", content: prompt },
    ]);
    return res.json({ analysis, claudeLive: true });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({
        error: "La clave fue rechazada, revísala en Configuración.",
        claudeLive: false,
      });
    }
    return res.status(502).json({
      error:
        "No pude hacer el análisis ahora mismo. Inténtalo de nuevo en un momento.",
      claudeLive: false,
    });
  }
});

// ---------------------------------------------------------------- arranque
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Isis escuchando en el puerto ${PORT}`);
});
