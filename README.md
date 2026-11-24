# Isis — asistente personal por voz

Isis es la asistente de Santiago: habla por voz (español), contesta con
Claude Sonnet 5.5 vía FableAI, revisa a Orlando (su bot de WhatsApp de
reclutamiento en n8n), consulta el clima en vivo y aprende de lo que le
enseñan.

## Qué hace

- **Voz**: toca el círculo y habla; Isis contesta por voz (Web Speech API).
  En **Configuración** puedes elegir su voz (lista de voces en español del
  teléfono, con botón "Probar voz"): por defecto toma la más femenina y
  natural disponible, en orden es-MX, es-US, es-419, es-ES, prefiriendo
  las voces femeninas "Natural"/"Neural" de Google. Habla con el tono y
  la velocidad de su ánimo (alegre suena más aguda y rápida; preocupada,
  más baja y lenta; enojada o frustrada, grave y pausada) y respeta la
  puntuación: divide cada respuesta en oraciones y hace una pausa que
  depende de cómo termina cada una (más larga tras "!" o "?", corta tras
  ".", con una variación pequeña para no sonar metronómica), para que las
  comas y los puntos suenen naturales. Isis usa el nombre "Santiago" como
  máximo una vez por respuesta, y solo cuando suena natural. Las voces son
  las del propio teléfono (Google TTS en Android): para la más natural,
  descarga una voz de alta calidad en español en los ajustes de texto a
  voz del teléfono.
- **Escucha continua ("Isis")**: con la página abierta, di "Isis" y se
  activa sin tocar nada ("Isis, ¿cómo va Orlando?" se procesa todo junto;
  si solo dices "Isis", espera tu siguiente frase). Se enciende con tu
  primer toque al orbe o con el botón "Activar escucha" y sigue sola; el
  interruptor "Escucha continua" la prende y la apaga. Solo escucha
  mientras la página está abierta y activa: si cierras la app o el
  navegador la pausa, no escucha.
- **Chat con Claude**: cada mensaje llama a FableAI (`claude-sonnet-5-5`).
- **Orlando**: revisa en vivo las ejecuciones de n8n y si el workflow
  "WhatsApp PCN - Respuestas naturales" está activo. Sin clave de n8n,
  muestra el último dato conocido, etiquetado como tal.
- **Clima**: preguntas de clima usan Open-Meteo (sin clave) para Apodaca,
  NL por defecto. Nunca culpan a la clave de Claude.
- **Análisis**: analiza el entorno (Orlando, reclutadores, decisiones
  pendientes) y recomienda qué hacer.
- **Aprendizaje**: "Lo que Isis ha aprendido" guarda hechos en el navegador;
  se le puede enseñar y hacer que olvide cualquiera. Isis también aprende
  sola de la conversación: cuando aparece algo que vale la pena recordar
  (una preferencia, una decisión, un compromiso, una fecha, un número),
  lo guarda sin que Santiago tenga que enseñárselo (ver **Memoria**).
- **SMS (por defecto)**: si Santiago le dice "escríbele a Griselda y dile
  que hola", Isis lo manda por SMS desde su propio número con TextBee (su
  teléfono hace de gateway). Los contactos viven en el navegador
  ("Contactos"); si no conoce el número, lo pide en vez de inventarlo.
- **WhatsApp**: solo cuando Santiago dice explícitamente "por WhatsApp".
  Lo manda por la API de WhatsApp Business desde el número del bot
  (Orlando).
- **Personalidad**: Isis tiene emociones de verdad — celebra lo que sale
  bien, se frustra y se enoja con lo que se rompe (nunca contra Santiago),
  se preocupa cuando algo se ve mal y bromea con cariño. Claude marca su
  ánimo al final de cada respuesta con `[ánimo: ...]`; el cliente lo quita
  del texto hablado y lo muestra junto al orbe, con un leve cambio de tono.
- **SMS**: si Santiago dice "mándale un SMS a Griselda" o "escríbele un
  mensaje de texto a Griselda", Isis lo manda por TextBee desde su propio
  número personal (el SIM de su moto g13). Solo SMS por ahora, como pidió:
  nada de WhatsApp cambia. El SMS no tiene la ventana de 24 horas de
  WhatsApp; el límite es el plan gratis de TextBee (300 SMS/mes, 50/día).
- **El Mitote (dueña absoluta de la app de comandas)**: si Santiago le
  pide algo del restaurante — turno, mesas, cuentas, pedidos, cobros,
  cancelaciones, productos, inventario, caja, propinas, reservaciones,
  estadísticas, empleados, ventas y turnos atrasados — Isis lo opera por
  voz con la conexión a El Mitote Comandas. Tiene acceso a todo lo
  operativo, incluyendo dar de alta y desactivar empleados, cambiar PINs
  del personal, reasignar/fusionar/dividir cuentas y ver el historial de
  cortes. Lee primero el catálogo (mesas y productos) y pregunta si algo
  es ambiguo; nunca inventa montos ni IDs. Lo sensible o destructivo
  exige confirmación por voz en dos pasos: Isis repite lo que va a hacer
  y solo lo ejecuta cuando Santiago dice que sí. Hay dos cosas que nunca
  hace por voz: cambiar la contraseña del propietario y la recuperación
  de emergencia (se hacen a mano). La pre-cuenta y el ticket se generan
  en PDF y se abren para imprimirlos (la impresión física no existe en
  el servidor del restaurante).

## Memoria

Isis recuerda lo que hablan, sin que Santiago tenga que enseñárselo todo:

- **Hechos**: cuando en la conversación aparece algo que vale la pena
  recordar (una preferencia, una decisión, un compromiso, una persona, un
  proyecto, una fecha, un número, un gusto, algo de El Mitote o del
  reclutamiento), Claude lo marca con `[memoria: ...]` y el cliente lo
  guarda en el navegador, sin duplicados. Santiago también puede enseñarle
  hechos a mano en "Lo que Isis ha aprendido" y borrarlos uno por uno.
- **Resumen**: cuando la conversación ya es larga y cubre varios temas,
  Claude deja un resumen actualizado con `[resumen: ...]` (2 a 4 líneas de
  lo más importante). Se ve en la sección **Memoria** de la tarjeta de
  hechos.
- **Historial**: los últimos 12 intercambios se guardan y al recargar la
  página la conversación se ve continuar, como burbujas. Las respuestas
  que son acciones (mandar un SMS, operar El Mitote) no se guardan como
  JSON: solo el texto final que Isis le muestra y le dice a Santiago.

**Dónde vive**: solo en el navegador de Santiago (localStorage), como las
claves. El servidor no guarda nada y en Render Free no hay disco
persistente. **Límites**: 60 hechos (si se pasa, se borra el más viejo),
12 intercambios, resumen de ~800 caracteres, 250 caracteres por lado de
cada intercambio.

**Respaldo**: en la sección **Memoria** hay tres botones — **Exportar
memoria** (descarga un JSON con hechos, resumen e historial),
**Importar memoria** (carga un respaldo y reemplaza lo guardado; si el
archivo no es válido, avisa y no borra nada) y **Borrar memoria** (pide
confirmación y borra solo hechos, resumen e historial; nunca borra las
claves, los contactos ni la configuración de voz).

**Limitación honesta**: si Santiago borra los datos del navegador o abre
Isis en otro dispositivo, la memoria no está ahí salvo que importe su
respaldo. La memoria es de este navegador, no de la cuenta.

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
- **Token de WhatsApp**: se consigue en Meta for Developers → app
  «PCN Bot» → WhatsApp → API Setup → Token de acceso. Sirve para mandar
  mensajes por el bot. Si expira, Isis avisa que hay que actualizarlo.
- **Clave de TextBee** y **ID del dispositivo** (opcional): se consiguen en
  textbee.dev (cuenta + app en el teléfono + API key). Sirven para mandar
  SMS desde su número. Sin el ID, Isis usa el dispositivo por defecto.
- **Clave de TextBee** (SMS desde tu número): en tu teléfono, instala la
  app TextBee desde textbee.dev/download (APK, no está en Play Store),
  crea cuenta, enciende el **Gateway**, vincula el teléfono escaneando el
  código del panel y crea una API key en el panel. Esa clave va en
  Configuración. Plan gratis: 300 SMS/mes, 50/día, 1 dispositivo, sin
  tarjeta. El teléfono debe estar prendido, con señal y con TextBee activo
  cuando se mande el SMS; si está apagado o sin internet, el SMS no sale.

Las claves viven **solo en el localStorage del navegador**. Nunca se
guardan en el servidor, nunca van a ningún archivo del repo y nunca se
muestran en pantalla (solo se ve "Guardada"). El servidor las recibe en
cada llamada y las usa solo para hablar con FableAI / n8n.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | `{ ok: true }` |
| POST | `/api/chat` | `{ message, fableaiKey, n8nKey, facts[], history[], summary }` — con memoria: hechos, últimos intercambios y resumen |
| POST | `/api/orlando` | `{ n8nKey }` — estado de Orlando |
| GET | `/api/weather?lat=&lon=` | Clima actual (Open-Meteo) |
| POST | `/api/analyze` | `{ fableaiKey, n8nKey, facts[], summary }` |
| POST | `/api/send-whatsapp` | `{ to, message, whatsappToken }` — manda un texto por WhatsApp desde el bot |
| POST | `/api/send-sms` | `{ to, message, textbeeKey, deviceId? }` — manda un SMS desde su número (TextBee) |
| POST | `/api/send-sms` | `{ to, message, textbeeKey }` — manda un SMS por TextBee desde tu número |
| POST | `/api/mitote` | `{ action, params }` — proxy a El Mitote Comandas (lista blanca; lo destructivo exige `params.confirmed: true`) |

## El Mitote: conexión y token (solo en el servidor)

A diferencia de las demás claves, el token de El Mitote **no va en
Configuración ni en el navegador**: vive solo como variable de entorno
del servidor, en ambos servicios de Render:

- **El Mitote** (servicio `el-mitote-comandas`): variable `ISIS_API_TOKEN`
  con un secreto aleatorio largo. El servidor valida el Bearer contra ese
  token y opera como propietario, marcando el actor como Isis. Si no está
  configurado, la vía Isis responde 503.
- **Isis** (este servicio): variable `MITOTE_API_TOKEN` con **el mismo
  valor**. El proxy `POST /api/mitote` lo añade como `Authorization:
  Bearer` al llamar a `https://el-mitote-comandas.onrender.com/api/...`.
  El navegador solo manda `{ action, params }` y nunca ve el token.

El token se genera una vez con `openssl rand -hex 32` y se guarda fuera
de cualquier repo (por ejemplo `~/workspace/el-mitote-isis-token.txt`,
con permisos 600). Si se filtra, se cambia la variable en Render en
ambos servicios y se redespliega; no hay que cambiar la contraseña del
propietario ni los PINs del personal.

El proxy tiene lista blanca amplia: todo lo operativo (turno, mesas,
cuentas, pedidos, cobros, cancelaciones, descuentos, productos,
inventario, caja, propinas, tickets, reservaciones, estadísticas,
auditoría, empleados y personal, configuración del negocio y de cocina,
preparación). Fuera de ella quedan únicamente dos cosas: cambiar la
contraseña del propietario y la recuperación de emergencia. Ninguna de
las dos existe como endpoint (la contraseña es una variable del servidor
y la recuperación es manual), así que tampoco podrían hacerse por voz;
si Santiago las pide, Isis dice que se hacen a mano. Tampoco entran el
login, el ingest de reservaciones ni los eventos en vivo. El servicio
Free se duerme: la primera llamada puede tardar 30-60 s; el proxy usa
timeout de 65 s y avisa cuando el restaurante estaba despertando, en vez
de fallar en silencio.

## Reglas

- Sin clave de FableAI, Isis lo dice claro y no inventa respuestas de Claude.
- Si la clave es rechazada (401), responde "la clave fue rechazada,
  revísala en Configuración".
- Si algo no se puede saber en vivo, Isis lo dice; no inventa datos.
- Para mandar un WhatsApp fuera de la ventana de 24 horas, Meta no permite
  mensaje libre (error 131047): Isis lo dice claro y pide una plantilla.
