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
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const FABLEAI_URL = "https://api.fableaiapi.com/v1/chat/completions";
const FABLEAI_MODEL = "claude-sonnet-5-5";
const N8N_BASE = "https://pcn-bot.app.n8n.cloud/api/v1";

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
  "Eres Isis, la asistente personal de Santiago.",
  "Habla siempre en español. Eres directa, cálida y con chispa.",
  "Respondes de forma clara y breve, como si hablaras con un amigo.",
  "Nunca inventas datos que no tienes: si te preguntan algo que no sabes, dilo claramente y no adivines.",
  "Santiago recluta para PCN y NIDEC en Apodaca con Grupo Master RH, y su bot de WhatsApp de reclutamiento se llama Orlando.",
  "Si te preguntan por Orlando, usa solo los datos del contexto que te pasen; si no tienes datos frescos, dilo.",
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
    "\nResponde en español, directo y con chispa, con: " +
    "1) resumen del estado actual, 2) riesgos que ves, " +
    "3) recomendaciones concretas ordenadas por prioridad, " +
    "4) decisiones pendientes que Santiago debería tomar. " +
    "No inventes números ni datos que no te pasé; si algo no lo sabes, dilo.";

  try {
    const analysis = await callClaude(String(fableaiKey).trim(), [
      {
        role: "system",
        content:
          "Eres Isis, la asistente personal de Santiago. Analizas su entorno y le recomiendas decisiones. Siempre en español, directa, cálida y con chispa. Nunca inventas datos.",
      },
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
