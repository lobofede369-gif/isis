# Isis — asistente personal por voz

Isis es la asistente de Santiago: habla por voz (español), contesta con
Claude Sonnet 5.5 vía FableAI, revisa a Orlando (su bot de WhatsApp de
reclutamiento en n8n), consulta el clima en vivo y aprende de lo que le
enseñan.

## Interfaz (estilo JARVIS, minimalista)

La pantalla principal es solo cuatro cosas: el orbe JARVIS (una imagen
de núcleo brillante azul con anillos HUD, `public/isis-orb.jpg`, 768 px,
~150 KB), una sola línea de estado, la conversación colapsada en una
línea y un dock mínimo abajo (escribir + enviar + micrófono). Todo lo
demás vive en el **botón hamburguesa ☰** (arriba a la izquierda), que
abre un menú lateral con todos los módulos: **Configuración** (claves),
**Voz de Isis** (voz del teléfono, voz de Kokoro, descarga de Kokoro,
"Probar voz" y escucha continua), **Memoria** (lo aprendido, resumen y
respaldo), **Contactos**, **Orlando · Bot PCN** y **Análisis**. Elegir
un módulo cierra el menú y lo abre en pantalla completa; "← Volver" (o
la tecla Escape) lo cierra y vuelve a la pantalla principal. Tocar
fuera del menú también lo cierra.

El orbe refleja el estado de Isis aunque la imagen sea estática: un
anillo luminoso gira alrededor de la imagen (más rápido al pensar o
hablar), el brillo cambia de color e intensidad según su ánimo (el
sistema de ánimo ya existía y se reutiliza) y la imagen pulsa al ritmo
de la voz mientras habla. Nada se eliminó: todo lo que antes estaba en
la pantalla principal se reubicó dentro del menú.

## Qué hace

- **Voz**: toca el círculo y habla; Isis contesta por voz. Habla con
  Kokoro-82M, un modelo de voz gratis y de código abierto que corre
  directo en el teléfono (kokoro-js + ONNX): sin clave, sin servidor y
  sin costo por uso. No se descarga solo al abrir la app: se baja
  cuando Santiago toca "Descargar voz de Isis" en el menú ☰ → Voz de
  Isis (~88 MB, una sola vez) y luego queda guardado en el navegador;
  mientras tanto, o si Kokoro falla, Isis usa la voz del teléfono
  (Web Speech API), así nunca se queda muda. En el menú ☰ → **Voz de
  Isis** se elige su voz de Kokoro: solo hay 3 en
  español — Dora (femenina, por defecto), Alex y Santa (masculinas) —
  con botón "Probar voz"; y también se elige la voz del teléfono (lista
  de voces en español del teléfono: por defecto toma la más femenina y
  natural disponible, en orden es-MX, es-US, es-419, es-ES, prefiriendo
  las voces femeninas "Natural"/"Neural" del motor del teléfono). Con la voz del
  teléfono, Isis habla con el tono y la velocidad de su ánimo (alegre
  suena más aguda y rápida; preocupada, más baja y lenta; enojada o
  frustrada, grave y pausada) y respeta la puntuación: divide cada
  respuesta en oraciones y hace una pausa que depende de cómo termina
  cada una (más larga tras "!" o "?", corta tras ".", con una variación
  pequeña para no sonar metronómica), para que las comas y los puntos
  suenen naturales. Con Kokoro la emoción la da la propia voz (habla
  oración por oración, generando la siguiente mientras suena la actual,
  para no esperar todo el texto en un teléfono lento). Isis usa el nombre "Santiago" como máximo una vez por respuesta,
  y solo cuando suena natural. Las voces del teléfono son las del propio
  teléfono (el motor de texto a voz de Android): para la más natural, descarga una
  voz de alta calidad en español en los ajustes de texto a voz del
  teléfono.
- **Escucha continua ("Isis")**: con la página abierta, di "Isis" y se
  activa sin tocar nada ("Isis, ¿cómo va Orlando?" se procesa todo junto;
  si solo dices "Isis", espera tu siguiente frase). Se enciende con tu
  primer toque al orbe o con el botón "Activar escucha" y sigue sola; el
  interruptor "Escucha continua" la prende y la apaga. Solo escucha
  mientras la página está abierta y activa: si cierras la app o el
  navegador la pausa, no escucha.
- **Chat con Claude**: cada mensaje llama a FableAI (`claude-sonnet-5-5`).
  El panel de conversación es plegable y viene colapsado por defecto:
  solo muestra la última respuesta de Isis en una línea; al tocar la
  cabecera "Conversación" se expande y se ve el chat completo. El dock
  mínimo (escribir + enviar + micrófono) queda siempre visible; todo
  lo demás vive en el botón hamburguesa ☰ (ver **Interfaz**).
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
  el servidor del restaurante). Ante un error transitorio del
  restaurante (429/502/503), el proxy reintenta hasta 3 veces con
  backoff (inmediato, +1 s, +2 s) y si persiste avisa en español claro.

## Voz de Kokoro (gratis, en el navegador)

Isis habla con Kokoro-82M, un modelo de texto a voz de 82 millones de
parámetros, gratis para siempre y de código abierto (Apache 2.0), que
corre 100% en el navegador del teléfono con la librería oficial
kokoro-js (v1.2.1, desde jsDelivr) y ONNX Runtime Web. Nada de claves,
nada de servidores, nada de costo por uso: el audio no sale del
teléfono.

1. Al abrir Isis NO se descarga nada: la app arranca ligera. La voz se
   descarga solo cuando Santiago toca **"Descargar voz de Isis"** en
   el menú ☰ → Voz de Isis (primera vez ~88 MB: el modelo cuantizado q8 desde
   Hugging Face, `onnx-community/Kokoro-82M-v1.0-ONNX`); luego queda
   guardada en la caché del navegador y ya no se descarga. Mientras
   descarga, Isis muestra "Descargando la voz de Isis por primera
   vez…" y sigue hablando con la voz del teléfono; el chat no se
   bloquea. Si Kokoro aún no está descargada, Isis habla con la voz
   del teléfono de inmediato y deja una nota breve junto al orbe
   ("La voz de Isis aún no está descargada — descárgala en el menú ☰,
   en Voz de Isis").
2. En el menú ☰ → **Voz de Isis** se elige la voz:
   solo hay 3 en español — `ef_dora` (Dora, femenina, por defecto),
   `em_alex` (Alex, masculina) y `em_santa` (Santa, masculina,
   navideña). La elección se guarda en el navegador
   (`isis_kokoro_voice`). El botón "Probar voz" también empieza la
   descarga si aún no está lista y prueba la voz de inmediato con la
   voz del teléfono (cuando la descarga termina, la siguiente prueba
   ya usa Kokoro).
3. La síntesis corre en el teléfono (WASM): en un teléfono modesto
   puede tardar unos segundos por respuesta, por eso Isis habla
   oración por oración, generando la siguiente mientras suena la
   actual. Si una oración tarda más de 60 s o algo falla, Isis sigue
   con la voz del teléfono desde ahí; nunca se queda muda.

**Por qué q8 y no q4**: el archivo `model_q4.onnx` del mismo repo pesa
~291 MB (medido en Hugging Face: 305 215 966 bytes), más del triple
que el q8 (~88 MB: `model_quantized.onnx` = 92 361 116 bytes). Cambiar
a q4 haría la descarga más pesada y lenta, no más ligera, así que se
quedó el q8.

**Limitación honesta**: la calidad de las voces en español de Kokoro
es buena pero no tan expresiva como las voces de paga, y la primera
descarga (~88 MB) pesa; además, en el teléfono la síntesis es más
lenta que en una computadora. Si algún día se quiere otra voz, el
cambio es solo el nombre de la voz en Configuración (o el modelo, en
`KOKORO_MODEL_ID` de `public/app.js`).

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
  lo más importante). Se ve en el menú ☰ → **Memoria**.
- **Historial**: los últimos 12 intercambios se guardan y al recargar la
  página la conversación se ve continuar, como burbujas. Las respuestas
  que son acciones (mandar un SMS, operar El Mitote) no se guardan como
  JSON: solo el texto final que Isis le muestra y le dice a Santiago.

**Dónde vive**: solo en el navegador de Santiago (localStorage), como las
claves. El servidor no guarda nada y en Render Free no hay disco
persistente. **Límites**: 60 hechos (si se pasa, se borra el más viejo),
12 intercambios, resumen de ~800 caracteres, 250 caracteres por lado de
cada intercambio.

**Respaldo**: en el menú ☰ → **Memoria** hay tres botones — **Exportar
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

Dentro de la app, en el menú ☰ → **Configuración**, Santiago pega una sola vez:

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
| POST | `/api/mitote` | `{ action, params }` — proxy a El Mitote Comandas (lista blanca; lo destructivo exige `params.confirmed: true`; reintenta hasta 3 veces ante 429/502/503) |

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
de fallar en silencio. Ante un error transitorio (429/502/503) reintenta
hasta 3 veces con backoff (inmediato, +1 s, +2 s); si persiste, responde
en español claro ("El Mitote está ocupado ahora mismo").

## Reglas

- Sin clave de FableAI, Isis lo dice claro y no inventa respuestas de Claude.
- Si la clave es rechazada (401), responde "la clave fue rechazada,
  revísala en Configuración".
- Si algo no se puede saber en vivo, Isis lo dice; no inventa datos.
- Para mandar un WhatsApp fuera de la ventana de 24 horas, Meta no permite
  mensaje libre (error 131047): Isis lo dice claro y pide una plantilla.
