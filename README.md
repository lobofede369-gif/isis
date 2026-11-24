# Isis — asistente personal por voz

Isis es la asistente de Santiago: habla por voz (español), contesta con
Claude Sonnet 5.5 vía FableAI, revisa a Orlando (su bot de WhatsApp de
reclutamiento en n8n), consulta el clima en vivo y aprende de lo que le
enseñan.

## Qué hace

- **Voz**: toca el círculo y habla; Isis contesta por voz (Web Speech API).
- **Chat con Claude**: cada mensaje llama a FableAI (`claude-sonnet-5-5`).
- **Orlando**: revisa en vivo las ejecuciones de n8n y si el workflow
  "WhatsApp PCN - Respuestas naturales" está activo. Sin clave de n8n,
  muestra el último dato conocido, etiquetado como tal.
- **Clima**: preguntas de clima usan Open-Meteo (sin clave) para Apodaca,
  NL por defecto. Nunca culpan a la clave de Claude.
- **Análisis**: analiza el entorno (Orlando, reclutadores, decisiones
  pendientes) y recomienda qué hacer.
- **Aprendizaje**: "Lo que Isis ha aprendido" guarda hechos en el navegador;
  se le puede enseñar y hacer que olvide cualquiera.

## Correrlo local

```bash
npm install
npm start
```

Abre http://localhost:3000

## Desplegarlo en Render (plan Free)

1. Sube este repositorio a GitHub.
2. En Render: New → Web Service → elige el repo.
3. **Build Command**: `npm install`
4. **Start Command**: `node server.js`
5. Plan **Free**. Render fija el puerto solo con la variable `PORT`
   (el servidor ya la usa).

Para que no se duerma el servicio gratuito, apúntalo con un monitor
gratuito (por ejemplo UptimeRobot) a `https://TU-SERVICIO.onrender.com/api/health`
cada 5 minutos.

## Dónde van las claves

Dentro de la app, en **Configuración**, Santiago pega una sola vez:

- **Clave de FableAI** (Claude): se crea en el panel de FableAI → API Keys.
- **Clave de API de n8n**: se crea en n8n → Settings → n8n API.

Las claves viven **solo en el localStorage del navegador**. Nunca se
guardan en el servidor, nunca van a ningún archivo del repo y nunca se
muestran en pantalla (solo se ve "Guardada"). El servidor las recibe en
cada llamada y las usa solo para hablar con FableAI / n8n.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | `{ ok: true }` |
| POST | `/api/chat` | `{ message, fableaiKey, n8nKey, facts[] }` |
| POST | `/api/orlando` | `{ n8nKey }` — estado de Orlando |
| GET | `/api/weather?lat=&lon=` | Clima actual (Open-Meteo) |
| POST | `/api/analyze` | `{ fableaiKey, n8nKey, facts[] }` |

## Reglas

- Sin clave de FableAI, Isis lo dice claro y no inventa respuestas de Claude.
- Si la clave es rechazada (401), responde "la clave fue rechazada,
  revísala en Configuración".
- Si algo no se puede saber en vivo, Isis lo dice; no inventa datos.
