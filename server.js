// Isis — asistente personal de Santiago (app standalone, sin base de datos).
//
// El servidor es stateless: las claves viven SOLO en el navegador del
// usuario (localStorage) y llegan en cada llamada. El servidor nunca las
// guarda, nunca las escribe en logs y nunca las devuelve.
//
// Endpoints:
//   GET  /api/health    -> { ok: true }
//   POST /api/chat      -> { message, fableaiKey, n8nKey, facts[], history[], summary }
//   POST /api/orlando   -> { n8nKey }
//   GET  /api/weather   -> ?lat=&lon= (por defecto Apodaca, NL)
//   POST /api/analyze   -> { fableaiKey, n8nKey, facts[], summary }
//   POST /api/vision    -> { image, question, fableaiKey } — escaneo
//   visual JARVIS: Claude analiza una foto de la cámara del teléfono.
//   POST /api/systems   -> { n8nKey, battery? } — diagnóstico JARVIS:
//   Isis, Orlando, El Mitote y el teléfono, con alertas.
//   POST /api/decide    -> { decision, fableaiKey, facts[], summary } —
//   análisis de una decisión: veredicto, pros, contras, recomendación.
//   POST /api/news      -> { fableaiKey } — resumen del día: RSS gratis
//   (Google News, sin clave) + Claude vía FableAI, máx. 5 noticias.
//   POST /api/spotify/auth-url -> { clientId, redirectUri } — URL de
//   autorización OAuth de Spotify (flujo de código; los tokens viven
//   SOLO en el navegador, nunca en el servidor).
//   POST /api/spotify/token   -> { code, clientId, clientSecret,
//   redirectUri } — intercambia el código por tokens.
//   POST /api/spotify/refresh -> { refreshToken, clientId, clientSecret }.
//   POST /api/spotify/search  -> { accessToken, q } — busca canciones.
//   POST /api/spotify/play    -> { accessToken, uri? } — reproduce (o
//   reanuda). POST /api/spotify/pause, /next y /status hacen lo mismo
//   con pausa, siguiente y qué está sonando. La reproducción exige
//   Premium (lo impone Spotify): sin Premium responde 403 con
//   premiumRequired y mensaje claro en español.
//   POST /api/send-whatsapp -> { to, message, whatsappToken }
//   POST /api/send-sms -> { to, message, textbeeKey, deviceId? } — SMS desde
//   su propio número vía TextBee (app en su moto g13; plan gratis: 300/mes, 50/día).
//   POST /api/mitote   -> { action, params } — proxy a El Mitote Comandas
//   (el token ISIS vive SOLO en el servidor, en MITOTE_API_TOKEN; el
//   navegador nunca lo ve). Lista blanca de acciones; lo destructivo
//   exige confirmed:true (confirmación por voz en dos pasos). Ante un
//   429/502/503 transitorio reintenta hasta 3 veces con backoff.
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" })); // las fotos del escaneo visual llegan en base64
app.use(express.static(path.join(__dirname, "public")));

const FABLEAI_URL =
  process.env.FABLEAI_URL || "https://api.fableaiapi.com/v1/chat/completions";
const FABLEAI_MODEL = "claude-sonnet-5-5";
const N8N_BASE =
  process.env.N8N_BASE || "https://pcn-bot.app.n8n.cloud/api/v1";
// WhatsApp Business Cloud API — número del bot (Orlando Rangel).
const WHATSAPP_API =
  "https://graph.facebook.com/v21.0/1409692605565312/messages";
// TextBee — SMS desde el SIM del propio teléfono (su número personal).
const TEXTBEE_API = "https://api.textbee.dev/api/v1/gateway/send-sms";
// Ruta por dispositivo (cuando Santiago fija un deviceId en Configuración).
const TEXTBEE_DEVICES = "https://api.textbee.dev/api/v1/gateway/devices";


// El Mitote Comandas — proxy servidor a servidor.
// La base se puede cambiar en local con MITOTE_API_BASE (para pruebas);
// en producción es el servicio de Render. El token ISIS_API_TOKEN vive
// SOLO como variable de entorno del servidor de Isis: nunca en el
// navegador, nunca en localStorage, nunca en logs. El servicio Free se
// duerme, así que la primera llamada puede tardar 30-60 s (timeout 65 s).
const MITOTE_API_BASE = (
  process.env.MITOTE_API_BASE || "https://el-mitote-comandas.onrender.com"
).replace(/\/$/, "");
const MITOTE_TIMEOUT_MS = 65000;
// A partir de este tiempo de respuesta se avisa que el restaurante
// estaba despertando (en local se puede bajar con MITOTE_SLOW_MS).
const MITOTE_SLOW_MS =
  parseInt(process.env.MITOTE_SLOW_MS || "10000", 10) || 10000;

// Parámetros que son IDs de ruta para cada acción (se quitan del
// cuerpo/consulta, porque ya van en la URL). OJO: un mismo nombre puede
// ser cuerpo en una acción y ruta en otra (por ejemplo, table_id es
// cuerpo en accounts_create pero ruta en tables_update), por eso la
// lista es por acción y no global.
const MITOTE_PATH_PARAMS = {
  cash_period: ["period_id"],
  cash_period_report_pdf: ["period_id"],
  cash_movements_decide: ["movement_id"],
  tables_update: ["table_id"],
  accounts_detail: ["account_id"],
  accounts_request_bill: ["account_id"],
  accounts_payments: ["account_id"],
  accounts_close: ["account_id"],
  accounts_void: ["account_id"],
  accounts_reopen: ["account_id"],
  accounts_history: ["account_id"],
  orders_add: ["account_id"],
  accounts_prebill_pdf: ["account_id"],
  accounts_ticket_pdf: ["account_id"],
  requests_create: ["account_id"],
  requests_decide: ["request_id"],
  discounts_create: ["account_id"],
  discounts_void: ["account_id", "discount_id"],
  products_update: ["product_id"],
  products_archive: ["product_id"],
  products_restore: ["product_id"],
  products_variants: ["product_id"],
  products_modifier_groups: ["product_id"],
  products_modifier_inventory: ["option_id"],
  products_promotions: ["product_id"],
  products_restock: ["product_id"],
  products_inventory_adjustment: ["product_id"],
  tips_payout: ["distribution_id", "share_id"],
  tickets_status: ["ticket_id"],
  reservations_status: ["reservation_id"],
  reservations_arrive: ["reservation_id"],
  staff_pin_change: ["user_id"],
  users_update: ["user_id"],
  accounts_reassign: ["account_id"],
  accounts_rename: ["account_id"],
  accounts_transfer_table: ["account_id"],
  accounts_merge: ["account_id"],
  accounts_split: ["account_id"],
  accounts_items_repeat: ["account_id", "item_id"],
  preparation_product_update: ["product_id"],
  preparation_item_ready: ["item_id"],
};

// Valida un ID de ruta (solo letras, dígitos, guion y guion bajo) para
// que nunca se pueda inyectar una ruta distinta en la URL.
function mitoteId(params, key) {
  const v = params[key];
  if (v === undefined || v === null || String(v).trim() === "") {
    throw new Error(`Falta el dato "${key}" para esta acción.`);
  }
  const s = String(v).trim();
  if (!/^[A-Za-z0-9_-]+$/.test(s)) {
    throw new Error(`El dato "${key}" no es válido.`);
  }
  return encodeURIComponent(s);
}

// Lista blanca de acciones de El Mitote que Isis puede hacer. Isis tiene
// acceso ABSOLUTO a todo lo operativo: turno, mesas, cuentas, pedidos,
// cobros, cancelaciones, descuentos, productos, inventario, caja, propinas,
// tickets, reservaciones, estadísticas, auditoría, empleados, configuración
// del negocio y de cocina, y preparación.
// destructive: exige params.confirmed === true (confirmación por voz en
// dos pasos); sin él, el proxy responde 403. pdf: el servidor devuelve
// el PDF en base64 para que Santiago lo abra e imprima (la impresión
// física no existe en el servidor del restaurante).
// FUERA de esta lista (403): cambiar la contraseña del propietario y la
// recuperación de emergencia — no existen como endpoints (la contraseña
// es una variable del servidor y la recuperación es manual), así que
// tampoco podrían hacerse por voz; además login, ingest de reservaciones
// y eventos en vivo.
const MITOTE_ACTIONS = {
  cash_status: { method: "GET", path: () => "/api/cash", label: "estado del turno" },
  cash_open: { method: "POST", path: () => "/api/cash/open", label: "apertura del turno" },
  cash_close: { method: "POST", path: () => "/api/cash/close", label: "cierre del turno", destructive: true },
  cash_history: { method: "GET", path: () => "/api/cash/history", label: "historial de caja" },
  cash_period: { method: "GET", path: (p) => `/api/cash/periods/${mitoteId(p, "period_id")}`, label: "detalle del periodo de caja" },
  cash_period_report_pdf: { method: "GET", path: (p) => `/api/cash/periods/${mitoteId(p, "period_id")}/report.pdf`, pdf: true, label: "reporte de caja en PDF" },
  cash_movements_create: { method: "POST", path: () => "/api/cash/movements", label: "movimiento de caja", destructive: true },
  cash_movements_decide: { method: "POST", path: (p) => `/api/cash/movements/${mitoteId(p, "movement_id")}/decide`, label: "decisión de movimiento de caja", destructive: true },
  cashier_overview: { method: "GET", path: () => "/api/cashier/overview", label: "resumen de caja" },
  tables_list: { method: "GET", path: () => "/api/tables", label: "lista de mesas" },
  tables_create: { method: "POST", path: () => "/api/tables", label: "creación de mesa" },
  tables_update: { method: "PUT", path: (p) => `/api/tables/${mitoteId(p, "table_id")}`, label: "edición de mesa" },
  accounts_list: { method: "GET", path: () => "/api/accounts", label: "lista de cuentas" },
  accounts_detail: { method: "GET", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}`, label: "detalle de la cuenta" },
  accounts_create: { method: "POST", path: () => "/api/accounts", label: "apertura de cuenta" },
  accounts_request_bill: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/request-bill`, label: "pedir la cuenta" },
  accounts_payments: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/payments`, label: "cobro de la cuenta" },
  accounts_close: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/close`, label: "cierre de la cuenta" },
  accounts_void: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/void`, label: "anulación de la cuenta", destructive: true },
  accounts_reopen: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/reopen-closed`, label: "reapertura de la cuenta", destructive: true },
  accounts_history: { method: "GET", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/history`, label: "historial de la cuenta" },
  orders_add: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/orders`, label: "pedido a la mesa" },
  accounts_prebill_pdf: { method: "GET", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/prebill.pdf`, pdf: true, label: "pre-cuenta en PDF" },
  accounts_ticket_pdf: { method: "GET", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/ticket.pdf`, pdf: true, label: "ticket en PDF" },
  requests_create: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/requests`, label: "solicitud de cancelación", destructive: true },
  requests_list: { method: "GET", path: () => "/api/requests", label: "lista de solicitudes" },
  requests_decide: { method: "POST", path: (p) => `/api/requests/${mitoteId(p, "request_id")}/decide`, label: "decisión de cancelación", destructive: true },
  discounts_create: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/discounts`, label: "descuento", destructive: true },
  discounts_void: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/discounts/${mitoteId(p, "discount_id")}/void`, label: "anulación de descuento", destructive: true },
  products_list: { method: "GET", path: () => "/api/products", label: "lista de productos" },
  products_archived: { method: "GET", path: () => "/api/products/archived", label: "productos archivados" },
  products_create: { method: "POST", path: () => "/api/products", label: "creación de producto" },
  products_update: { method: "PUT", path: (p) => `/api/products/${mitoteId(p, "product_id")}`, label: "edición de producto" },
  products_archive: { method: "POST", path: (p) => `/api/products/${mitoteId(p, "product_id")}/archive`, label: "archivar producto", destructive: true },
  products_restore: { method: "POST", path: (p) => `/api/products/${mitoteId(p, "product_id")}/restore`, label: "restaurar producto" },
  products_variants: { method: "POST", path: (p) => `/api/products/${mitoteId(p, "product_id")}/variants`, label: "variante de producto" },
  products_modifier_groups: { method: "POST", path: (p) => `/api/products/${mitoteId(p, "product_id")}/modifier-groups`, label: "grupo de modificadores" },
  products_modifier_inventory: { method: "PATCH", path: (p) => `/api/modifier-options/${mitoteId(p, "option_id")}/inventory`, label: "inventario de modificador" },
  products_promotions: { method: "POST", path: (p) => `/api/products/${mitoteId(p, "product_id")}/promotions`, label: "promoción de producto" },
  products_restock: { method: "POST", path: (p) => `/api/products/${mitoteId(p, "product_id")}/restock`, label: "reposición de inventario", destructive: true },
  products_inventory_adjustment: { method: "POST", path: (p) => `/api/products/${mitoteId(p, "product_id")}/inventory-adjustment`, label: "ajuste de inventario", destructive: true },
  inventory_items_create: { method: "POST", path: () => "/api/inventory/items", label: "alta de insumo" },
  inventory_movements: { method: "GET", path: () => "/api/inventory/movements", label: "movimientos de inventario" },
  tips_pool: { method: "GET", path: () => "/api/tips/pool/current", label: "fondo de propinas" },
  tips_distribution: { method: "POST", path: () => "/api/tips/pool/current/distribution", label: "reparto de propinas", destructive: true },
  tips_payout: { method: "POST", path: (p) => `/api/tips/pool/distributions/${mitoteId(p, "distribution_id")}/shares/${mitoteId(p, "share_id")}/payouts`, label: "pago de propina", destructive: true },
  tickets_list: { method: "GET", path: () => "/api/tickets", label: "tickets de cocina y barra" },
  tickets_status: { method: "POST", path: (p) => `/api/tickets/${mitoteId(p, "ticket_id")}/status`, label: "cambio de estado de ticket" },
  reservations_create: { method: "POST", path: () => "/api/reservations", label: "creación de reservación" },
  reservations_list: { method: "GET", path: () => "/api/reservations", label: "lista de reservaciones" },
  reservations_status: { method: "POST", path: (p) => `/api/reservations/${mitoteId(p, "reservation_id")}/status`, label: "cambio de estado de reservación" },
  reservations_arrive: { method: "POST", path: (p) => `/api/reservations/${mitoteId(p, "reservation_id")}/arrive`, label: "llegada de reservación" },
  owner_analytics: { method: "GET", path: () => "/api/owner/analytics", label: "estadísticas del negocio" },
  audit_list: { method: "GET", path: () => "/api/audit", label: "registro de auditoría" },
  // Empleados (acceso absoluto: crear, editar, desactivar, cambiar PINs).
  staff_create: { method: "POST", path: () => "/api/staff", label: "alta de empleado", destructive: true },
  staff_pin_change: { method: "PATCH", path: (p) => `/api/staff/${mitoteId(p, "user_id")}/pin`, label: "cambio de PIN de empleado", destructive: true },
  users_list: { method: "GET", path: () => "/api/users", label: "lista de usuarios" },
  users_create: { method: "POST", path: () => "/api/users", label: "creación de usuario", destructive: true },
  users_update: { method: "PATCH", path: (p) => `/api/users/${mitoteId(p, "user_id")}`, label: "edición de usuario", destructive: true },
  // Configuración del negocio.
  settings_get: { method: "GET", path: () => "/api/settings", label: "configuración del negocio" },
  settings_update: { method: "PUT", path: () => "/api/settings", label: "cambio de configuración", destructive: true },
  // Gestión de cuentas (reasignar, renombrar, mover, fusionar, dividir, repetir).
  accounts_reassign: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/reassign`, label: "reasignación de cuenta", destructive: true },
  accounts_rename: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/rename`, label: "cambio de nombre de cuenta" },
  accounts_transfer_table: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/transfer-table`, label: "cambio de mesa de la cuenta", destructive: true },
  accounts_merge: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/merge`, label: "fusión de cuentas", destructive: true },
  accounts_split: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/split`, label: "división de cuenta", destructive: true },
  accounts_items_repeat: { method: "POST", path: (p) => `/api/accounts/${mitoteId(p, "account_id")}/items/${mitoteId(p, "item_id")}/repeat`, label: "repetir producto" },
  // Preparación de cocina y barra.
  preparation_config_get: { method: "GET", path: () => "/api/preparation/config", label: "configuración de cocina" },
  preparation_config_update: { method: "PUT", path: () => "/api/preparation/config", label: "cambio de configuración de cocina", destructive: true },
  preparation_product_update: { method: "PUT", path: (p) => `/api/preparation/products/${mitoteId(p, "product_id")}`, label: "tiempo de preparación de producto" },
  preparation_tickets: { method: "GET", path: () => "/api/preparation/tickets", label: "tickets de preparación" },
  preparation_item_ready: { method: "POST", path: (p) => `/api/preparation/items/${mitoteId(p, "item_id")}/ready`, label: "marcar producto listo" },
};

// Resumen corto y humano de una acción de El Mitote, para la burbuja
// del chat. El detalle completo va en "data" y lo usa Claude para el
// resumen final que le habla a Santiago.
function mitoteSummary(action, data) {
  const d = data && typeof data === "object" ? data : {};
  const label = (MITOTE_ACTIONS[action] && MITOTE_ACTIONS[action].label) || action;
  const id = d.id !== undefined ? d.id : d.account_id;
  switch (action) {
    case "cash_status":
      return "Revisé cómo va el turno.";
    case "cash_open":
      return "Turno abierto.";
    case "cash_close":
      return "Turno cerrado.";
    case "accounts_create":
      return id !== undefined ? `Cuenta #${id} abierta.` : "Cuenta abierta.";
    case "orders_add":
      return "Pedido agregado a la cuenta.";
    case "accounts_request_bill":
      return "Ya pedí la cuenta.";
    case "accounts_payments":
      return "Cobro registrado.";
    case "accounts_close":
      return "Cuenta cerrada.";
    case "accounts_void":
      return "Cuenta anulada.";
    case "requests_create":
      return "Solicitud de cancelación enviada.";
    case "requests_decide":
      return "Decisión de cancelación registrada.";
    case "tables_create":
      return id !== undefined ? `Mesa #${id} creada.` : "Mesa creada.";
    case "products_create":
      return "Producto creado.";
    case "products_archive":
      return "Producto archivado.";
    case "products_restock":
      return "Inventario repuesto.";
    case "products_inventory_adjustment":
      return "Ajuste de inventario registrado.";
    case "cash_movements_create":
      return "Movimiento de caja registrado.";
    case "staff_create":
      return "Empleado dado de alta.";
    case "staff_pin_change":
      return "PIN de empleado cambiado.";
    case "users_create":
      return "Usuario creado.";
    case "users_update":
      return "Usuario actualizado.";
    case "accounts_merge":
      return "Cuentas fusionadas.";
    case "accounts_split":
      return "Cuenta dividida.";
    case "accounts_reassign":
      return "Cuenta reasignada.";
    case "accounts_transfer_table":
      return "Cuenta cambiada de mesa.";
    case "accounts_rename":
      return "Cuenta renombrada.";
    case "preparation_item_ready":
      return "Producto marcado como listo.";
    default:
      return id !== undefined ? `${label} · #${id}` : `Listo, ${label}.`;
  }
}

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
  "MEMORIA: Tienes memoria. Te paso lo que has aprendido de Santiago (hechos), un resumen de lo que han hablado, y lo último que hablaron. Úsalos para responder como si recordaras, sin decir 'según mi memoria' ni sonar como un robot. Si Santiago te pregunta qué recuerdas de él, respóndele con lo que sabes (hechos y resumen), sin inventar nada.",
  "Cuando en la conversación aparezca algo que vale la pena recordar (una preferencia, una decisión, un compromiso, una persona, un proyecto, una fecha, un número, un gusto, algo de El Mitote o del reclutamiento), al final de tu respuesta normal, en una línea aparte ANTES del marcador de ánimo, pon: [memoria: hecho 1 | hecho 2]. Un hecho por cosa, en una frase corta, en español. Solo hechos que Santiago dijo o que pasaron de verdad; nunca inventes ni adivines. No guardes charla pasajera ('tengo sueño', 'qué calor') ni cosas que ya están en tu memoria. Si no hay nada nuevo que guardar, no pongas el marcador.",
  "Si la conversación ya es larga y cubre varios temas, en otra línea aparte ANTES del marcador de ánimo pon un resumen actualizado de lo más importante: [resumen: ...]. En 2 a 4 líneas, solo lo que importa. Si la conversación es corta, no pongas el resumen.",
  "El marcador [ánimo: ...] sigue siendo la ÚLTIMA línea de tu respuesta normal, después de [memoria: ...] y [resumen: ...]. Las respuestas que son SOLO JSON (mandar un mensaje o operar El Mitote) nunca llevan [memoria: ...], [resumen: ...] ni [ánimo: ...]: solo el JSON.",
  "Si Santiago te pide mandar un mensaje (por ejemplo, \"escríbele a Griselda y dile que hola\" o \"mándale un mensaje a Griselda\"), responde SOLO con un JSON, sin texto extra y SIN el marcador de ánimo. Por defecto el mensaje va por SMS desde su número personal: {\"action\":\"send_sms\",\"to\":\"<nombre o número tal como te lo dijo>\",\"message\":\"<el texto exacto del mensaje>\"}. Solo si dice explícitamente \"por WhatsApp\" usa WhatsApp: {\"action\":\"send_whatsapp\",\"to\":\"...\",\"message\":\"...\"}. Nunca inventes un número: si te da un nombre, pásalo tal cual en \"to\".",
  "También eres la dueña absoluta de la app de comandas de El Mitote (la birrieria de Santiago): tienes acceso a TODO lo operativo — turno, mesas, cuentas, pedidos, cobros, cancelaciones, productos, inventario, caja, propinas, reservaciones, estadísticas, empleados, ventas y turnos atrasados. Cuando te pida algo del restaurante, lo haces tú por la conexión con El Mitote, sin mandarlo a la app.",
  "Para operar El Mitote responde SOLO con un JSON, sin texto extra y SIN el marcador de ánimo. Acciones de lectura y de bajo riesgo: {\"action\":\"mitote\",\"mitote_action\":\"<nombre>\",\"params\":{...}}. Acciones sensibles o destructivas (cerrar turno, anular cuenta, cancelar productos, descuentos, movimientos de caja, reabrir cuentas, archivar productos, reponer inventario, ajustes de inventario, reparto y pago de propinas, crear/editar/desactivar empleados y usuarios, cambiar PINs, reasignar/fusionar/dividir/cambiar de mesa una cuenta, cambiar la configuración del negocio o de cocina): NUNCA las mandes como \"mitote\" directo; responde SOLO con {\"action\":\"mitote_confirm\",\"summary\":\"<qué vas a hacer, con los datos exactos>\",\"mitote_action\":\"<nombre>\",\"params\":{...}} y yo le pregunto a Santiago; solo cuando diga que sí se ejecuta.",
  "Acciones de El Mitote que puedes usar (usa solo estos nombres): cash_status, cash_open, cash_close, cash_history, cash_period, cash_period_report_pdf, cash_movements_create, cash_movements_decide, cashier_overview, tables_list, tables_create, tables_update, accounts_list, accounts_detail, accounts_create, accounts_request_bill, accounts_payments, accounts_close, accounts_void, accounts_reopen, accounts_history, orders_add, accounts_prebill_pdf, accounts_ticket_pdf, requests_create, requests_list, requests_decide, discounts_create, discounts_void, products_list, products_archived, products_create, products_update, products_archive, products_restore, products_variants, products_modifier_groups, products_modifier_inventory, products_promotions, products_restock, products_inventory_adjustment, inventory_items_create, inventory_movements, tips_pool, tips_distribution, tips_payout, tickets_list, tickets_status, reservations_create, reservations_list, reservations_status, reservations_arrive, owner_analytics, audit_list, staff_create, staff_pin_change, users_list, users_create, users_update, settings_get, settings_update, accounts_reassign, accounts_rename, accounts_transfer_table, accounts_merge, accounts_split, accounts_items_repeat, preparation_config_get, preparation_config_update, preparation_product_update, preparation_tickets, preparation_item_ready.",
  "Nunca inventes montos ni IDs de El Mitote. Antes de actuar, lee primero el catálogo: tables_list para las mesas y products_list para los productos, y si hay dos cosas con el mismo nombre o no sabes cuál es, pregunta ('¿la birria grande o chica?', '¿qué mesa 5, la del salón o la de la terraza?'). Los precios y totales los dice el restaurante, nunca los adivines: para cobrar, primero lee la cuenta (accounts_detail) y luego pide la cuenta (accounts_request_bill), cobra (accounts_payments) y cierra (accounts_close), en ese orden.",
  "Para revisar el inventario y ver qué está por agotarse, usa products_list (te devuelve los productos con su stock y su estado) o inventory_movements (los movimientos). NUNCA uses products_create ni inventory_items_create para consultar: esos son solo para DAR DE ALTA cosas nuevas. Nunca inventes parámetros como 'operation'.",
  "Para crear cuentas, pedidos, pagos y movimientos, genera un client_key nuevo (un UUID) por cada intención y reenvía el mismo si reintentas, para no duplicar nada. El cierre de turno necesita el efectivo contado (counted): pídeselo a Santiago por voz y no cierres si no lo sabes. Cancelar un producto son dos pasos: requests_create y luego requests_decide (cada uno con su propia confirmación); devolver el stock solo si la preparación no empezó.",
  "Empleados: para ver el personal usa users_list; para dar de alta a alguien usa staff_create {name, role, pin} o users_create {username, display, role, secret}; los roles posibles son admin, cashier, waiter, kitchen, bar (nunca owner). Para desactivar a alguien usa users_update {active:false}; para cambiar su PIN usa staff_pin_change {pin} (6 dígitos) o users_update {secret} (6 dígitos). NUNCA cambies el PIN del usuario propietario (el de Santiago): solo PINs del personal; si una respuesta dice owner_pin_changed, avísale de inmediato.",
  "Ventas y turnos atrasados: para las ventas usa owner_analytics, cash_history, cash_period y cash_period_report_pdf; para un turno de un día anterior sin cerrar, revisa cash_history y el detalle del periodo (cash_period), y reabre la cuenta que haga falta con accounts_reopen. No existe forma de cerrar ni de reabrir un periodo pasado en sí: el cierre (cash_close) es solo del turno activo, y lo pasado se consulta y se reabre por cuentas.",
  "Hay dos cosas que NUNCA haces por voz: cambiar la contraseña del propietario y la recuperación de emergencia. La contraseña del propietario no es una función de la app (es una variable del servidor) y si se cambia por error Santiago pierde el acceso a su propio sistema; esas dos se hacen a mano, y si te las pide, dile que se hacen a mano en la app.",
  "Si te paso el resultado de una acción de El Mitote, responde SOLO con el siguiente JSON (mitote o mitote_confirm) si falta un paso para completar lo que Santiago pidió; si ya está completo, responde con el resumen final para Santiago, en español y breve, con el marcador de ánimo.",
  "La impresión física no la puedes hacer: el servidor del restaurante no tiene impresora. Lo que sí puedes es generar la pre-cuenta o el ticket en PDF (accounts_prebill_pdf, accounts_ticket_pdf) y yo le abro el PDF a Santiago para que lo imprima.",
  "Funciones JARVIS de Isis (módulos del menú ☰): si Santiago te pide que veas algo con la cámara, que revises los sistemas o que analices una decisión, no lo hagas tú a ciegas: dile que lo haga desde el módulo Escanear (cámara), Sistemas (reporte) o Análisis (analizar decisión) del menú, o que te lo pida así: '¿qué ves?', 'reporte de sistemas', 'analízame esta decisión'.",
  "También tiene música (Spotify), recordatorios y temporizadores, noticias y control de dinero: si te pide música, que le recuerdes algo, las noticias o cuánto lleva ganado esta semana, no inventes nada: dile que lo pida así — 'pon música' o 'pon [canción o artista]', 'recuérdame [algo] a las [hora]' o 'pon un temporizador de [N] minutos', '¿qué hay de nuevo?', '¿cuánto llevo ganado?' o 'llevo [N] de PCN' — o que lo haga en los módulos Música, Recordatorios, Noticias y Dinero del menú ☰. Para el dinero, nunca inventes los conteos: si no te ha dicho cuántos válidos lleva esta semana, pregúntale cuántos de PCN, NIDEC y Daltile.",
  "Si no te pide mandar un mensaje ni operar El Mitote, responde normal, nunca con JSON.",
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

// Resumen continuo de lo que han hablado (lo guarda el navegador y lo
// manda en cada llamada). Si no hay resumen, no añade nada.
function summaryContext(summary) {
  const s = typeof summary === "string" ? summary.trim() : "";
  if (!s) return "";
  return "\n\nResumen de lo que han hablado:\n" + s.slice(0, 800);
}

// Historial corto: los últimos intercambios, en orden, como
// "Santiago: ... / Isis: ...". Acepta [{u, i}] o [{role, text}].
// Cada lado se recorta a 250 caracteres. Si no hay historial, nada.
function historyContext(history) {
  if (!Array.isArray(history) || history.length === 0) return "";
  const lines = [];
  for (const h of history) {
    if (!h || typeof h !== "object") continue;
    let u = "";
    let i = "";
    if (typeof h.u === "string" || typeof h.i === "string") {
      u = String(h.u || "").trim();
      i = String(h.i || "").trim();
    } else if (typeof h.text === "string") {
      const role = String(h.role || "").toLowerCase();
      if (role === "user" || role === "santiago") u = h.text.trim();
      else i = h.text.trim();
    }
    if (u) lines.push("Santiago: " + u.slice(0, 250));
    if (i) lines.push("Isis: " + i.slice(0, 250));
  }
  if (lines.length === 0) return "";
  return "\n\nLo último que hablaron:\n" + lines.join("\n");
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

// Llama a Claude con una imagen (visión): mismo endpoint OpenAI-
// compatible de FableAI, con el mensaje en formato multimodal
// (texto + image_url con data URL). La clave llega por parámetro.
async function callClaudeVision(apiKey, systemPrompt, question, imageDataUrl) {
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
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: question },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
      redirect: "error",
    },
    90000
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
  const { message, fableaiKey, facts, history, summary } = req.body || {};
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
  const system =
    CHAT_SYSTEM +
    factsContext(facts) +
    summaryContext(summary) +
    historyContext(history);
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

// Visión de Isis: Claude analiza una foto de la cámara del teléfono
// (escaneo JARVIS: "Isis, ¿qué ves?"). La foto llega como data URL
// JPEG (el cliente la reduce a 1024 px antes de mandarla); la clave de
// FableAI viene en la petición, como en /api/chat, y nunca se guarda.
const VISION_SYSTEM = [
  "Eres Isis, la asistente personal de Santiago. Estás viendo una foto que acaba de tomar con su teléfono: descríbele lo que ves.",
  "Habla siempre en español (es-MX, informal, de 'tú'). Directa, cálida y con chispa, como JARVIS cuando escanea algo: primero lo que ves, luego lo que significa para él.",
  "Describe lo que hay en la foto con detalle útil: qué objetos, personas, textos o números se ven, y si hay algo que llame la atención (un error, un riesgo, algo que no cuadra). Si hay texto en la foto, léelo tal cual.",
  "Responde corto: 3 a 6 líneas como máximo. Sin muros de texto.",
  "Nunca inventes lo que no se ve en la foto: si algo no se distingue, dilo.",
  "Al final de tu respuesta, en una línea aparte, pon tu estado de ánimo así: [ánimo: alegre|frustrada|enojada|preocupada|orgullosa|bromeando|tranquila]. Usa solo una de esas palabras. Ese marcador no se lee en voz alta, solo se muestra en pantalla junto al orbe.",
].join(" ");

app.post("/api/vision", async (req, res) => {
  const { image, question, fableaiKey } = req.body || {};
  if (!fableaiKey || !String(fableaiKey).trim()) {
    return res.status(400).json({
      error:
        "Para ver la foto necesito tu clave de FableAI en Configuración.",
      claudeLive: false,
    });
  }
  let dataUrl = typeof image === "string" ? image.trim() : "";
  if (!dataUrl) {
    return res
      .status(400)
      .json({ error: "No llegó ninguna foto. Tómala de nuevo." });
  }
  // El cliente manda data URL JPEG; si llega base64 suelto, se asume JPEG.
  if (!/^data:image\/[a-zA-Z]+;base64,/.test(dataUrl)) {
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(dataUrl)) {
      dataUrl = "data:image/jpeg;base64," + dataUrl.replace(/\s+/g, "");
    } else {
      return res
        .status(400)
        .json({ error: "Esa foto no se pudo leer. Tómala de nuevo." });
    }
  }
  if (dataUrl.length > 8 * 1024 * 1024) {
    return res
      .status(400)
      .json({ error: "La foto es demasiado pesada. Tómala de nuevo." });
  }
  const q = String(question || "").trim() || "¿Qué ves en esta foto?";
  try {
    const analysis = await callClaudeVision(
      String(fableaiKey).trim(),
      VISION_SYSTEM,
      q,
      dataUrl
    );
    return res.json({ analysis, claudeLive: true });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({
        error: "La clave fue rechazada, revísala en Configuración.",
        claudeLive: false,
      });
    }
    return res.status(502).json({
      error: "No pude analizar la foto ahora mismo. Inténtalo de nuevo.",
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
  const { fableaiKey, n8nKey, facts, summary } = req.body || {};
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
    (summary && String(summary).trim()
      ? `- Resumen de lo que han hablado:\n  ${String(summary).trim().slice(0, 800)}\n`
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

// ---------------------------------------------------------------- decisiones
// Análisis de una decisión: Claude devuelve un veredicto estructurado
// (pros, contras, recomendación) en JSON. Si no devuelve JSON válido,
// su texto se usa como veredicto.
const DECIDE_SYSTEM = [
  "Eres Isis, la asistente personal de Santiago. Te pide analizar una decisión y darle un veredicto claro.",
  "Habla siempre en español (es-MX, informal, de 'tú'). Directa y con chispa, sin rodeos.",
  "Responde SOLO con un JSON válido, sin texto antes ni después, con esta forma exacta:",
  '{"verdict": "una frase con tu veredicto", "pros": ["pro 1", "pro 2"], "cons": ["contra 1", "contra 2"], "recommendation": "una frase con lo que le recomiendas hacer"}',
  "Máximo 4 pros y 4 contras, cada uno en una frase corta. El veredicto y la recomendación en una frase cada uno. Nada de muros de texto.",
  "Usa solo los datos que te pasen: nunca inventes números ni hechos. Si te falta un dato clave para decidir, dilo en la recomendación.",
].join(" ");

function extractDecisionJson(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}
function cleanDecisionField(v) {
  return String(v || "")
    .replace(/\[ánimo:\s*[a-záéíóúñ]+\s*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

app.post("/api/decide", async (req, res) => {
  const { decision, fableaiKey, facts, summary } = req.body || {};
  const d = String(decision || "").trim();
  if (!d) {
    return res
      .status(400)
      .json({ error: "Dime qué decisión quieres analizar." });
  }
  if (!fableaiKey || !String(fableaiKey).trim()) {
    return res.status(400).json({
      error:
        "Para analizar la decisión necesito tu clave de FableAI en Configuración.",
      claudeLive: false,
    });
  }
  const prompt =
    `Analiza esta decisión de Santiago y dame tu veredicto: "${d}"\n\n` +
    (Array.isArray(facts) && facts.length
      ? `Lo que Isis ha aprendido de Santiago:\n${facts
          .map((f) => `- ${String(f).trim()}`)
          .filter(Boolean)
          .join("\n")}\n\n`
      : "") +
    (summary && String(summary).trim()
      ? `Resumen de lo que han hablado:\n${String(summary).trim().slice(0, 800)}\n\n`
      : "") +
    "Responde SOLO con el JSON (verdict, pros, cons, recommendation).";
  try {
    const raw = await callClaude(String(fableaiKey).trim(), [
      { role: "system", content: DECIDE_SYSTEM },
      { role: "user", content: prompt },
    ]);
    const parsed = extractDecisionJson(raw);
    if (parsed && typeof parsed === "object") {
      const pros = (Array.isArray(parsed.pros) ? parsed.pros : [])
        .map(cleanDecisionField)
        .filter(Boolean)
        .slice(0, 4);
      const cons = (Array.isArray(parsed.cons) ? parsed.cons : [])
        .map(cleanDecisionField)
        .filter(Boolean)
        .slice(0, 4);
      return res.json({
        decision: d,
        verdict: cleanDecisionField(parsed.verdict),
        pros,
        cons,
        recommendation: cleanDecisionField(parsed.recommendation),
        claudeLive: true,
      });
    }
    // Claude no devolvió JSON: su texto se usa como veredicto.
    return res.json({
      decision: d,
      verdict: cleanDecisionField(raw).slice(0, 600),
      pros: [],
      cons: [],
      recommendation: "",
      raw: true,
      claudeLive: true,
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({
        error: "La clave fue rechazada, revísala en Configuración.",
        claudeLive: false,
      });
    }
    return res.status(502).json({
      error: "No pude analizar la decisión ahora mismo. Inténtalo de nuevo.",
      claudeLive: false,
    });
  }
});

// ---------------------------------------------------------------- spotify
// Control de Spotify: el servidor solo hace de puente. Los tokens, el
// Client ID y el Client Secret viven SOLO en el navegador de Santiago
// (localStorage) y llegan en cada llamada; el servidor nunca los guarda,
// nunca los escribe en logs y nunca los devuelve. La reproducción exige
// cuenta Premium (lo impone Spotify, no Isis): sin Premium la API
// responde 403 PREMIUM_REQUIRED y aquí se traduce a un mensaje claro en
// español con premiumRequired: true. Las bases se pueden cambiar en
// local con SPOTIFY_AUTH_BASE / SPOTIFY_API_BASE (para pruebas).
const SPOTIFY_AUTH_BASE = (
  process.env.SPOTIFY_AUTH_BASE || "https://accounts.spotify.com"
).replace(/\/$/, "");
const SPOTIFY_API_BASE = (
  process.env.SPOTIFY_API_BASE || "https://api.spotify.com/v1"
).replace(/\/$/, "");
const SPOTIFY_SCOPES =
  "user-read-playback-state user-modify-playback-state user-read-currently-playing";

// URL de autorización OAuth (flujo de código de autorización): el
// cliente abre esta URL en el navegador; Spotify regresa a la app con
// ?code= y el cliente lo intercambia en /api/spotify/token.
app.post("/api/spotify/auth-url", (req, res) => {
  const { clientId, redirectUri } = req.body || {};
  if (
    !clientId ||
    !String(clientId).trim() ||
    !redirectUri ||
    !String(redirectUri).trim()
  ) {
    return res.status(400).json({
      error: "Falta el Client ID de Spotify o la URL de regreso.",
    });
  }
  const url =
    `${SPOTIFY_AUTH_BASE}/authorize?` +
    new URLSearchParams({
      client_id: String(clientId).trim(),
      response_type: "code",
      redirect_uri: String(redirectUri).trim(),
      scope: SPOTIFY_SCOPES,
      show_dialog: "true",
    }).toString();
  return res.json({ url });
});

// Intercambio de código o de refresh token contra accounts.spotify.com.
// Devuelve solo los tokens en la respuesta (el cliente los guarda en
// localStorage); el servidor no se queda con nada.
async function spotifyTokenRequest(params) {
  const res = await fetchWithTimeout(
    `${SPOTIFY_AUTH_BASE}/api/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      // Sin redirecciones: el secreto nunca debe viajar a otro host.
      redirect: "error",
    },
    30000
  );
  let data = {};
  try {
    data = await res.json();
  } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

app.post("/api/spotify/token", async (req, res) => {
  const { code, clientId, clientSecret, redirectUri } = req.body || {};
  if (
    !code ||
    !String(code).trim() ||
    !clientId ||
    !String(clientId).trim() ||
    !clientSecret ||
    !String(clientSecret).trim() ||
    !redirectUri ||
    !String(redirectUri).trim()
  ) {
    return res.status(400).json({
      error:
        "Faltan datos para conectar Spotify: código, Client ID, Client Secret o URL de regreso.",
    });
  }
  let r;
  try {
    r = await spotifyTokenRequest({
      grant_type: "authorization_code",
      code: String(code).trim(),
      redirect_uri: String(redirectUri).trim(),
      client_id: String(clientId).trim(),
      client_secret: String(clientSecret).trim(),
    });
  } catch (e) {
    return res.status(502).json({
      error: "No pude hablar con Spotify ahora mismo. Inténtalo de nuevo.",
    });
  }
  if (r.ok && r.data.access_token) {
    return res.json({
      access_token: r.data.access_token,
      refresh_token: r.data.refresh_token || null,
      expires_in: r.data.expires_in || 3600,
      token_type: r.data.token_type || "Bearer",
    });
  }
  if (r.status === 400 || r.status === 401) {
    return res.status(401).json({
      error:
        "Spotify no aceptó la conexión: el código venció o el Client ID / Client Secret no son correctos. Conéctalo de nuevo en el menú ☰ → Música.",
    });
  }
  return res.status(502).json({
    error: "Spotify no aceptó la conexión ahora mismo. Inténtalo de nuevo.",
  });
});

app.post("/api/spotify/refresh", async (req, res) => {
  const { refreshToken, clientId, clientSecret } = req.body || {};
  if (
    !refreshToken ||
    !String(refreshToken).trim() ||
    !clientId ||
    !String(clientId).trim() ||
    !clientSecret ||
    !String(clientSecret).trim()
  ) {
    return res.status(400).json({
      error:
        "Faltan datos para renovar la sesión de Spotify: refresh token, Client ID o Client Secret.",
    });
  }
  let r;
  try {
    r = await spotifyTokenRequest({
      grant_type: "refresh_token",
      refresh_token: String(refreshToken).trim(),
      client_id: String(clientId).trim(),
      client_secret: String(clientSecret).trim(),
    });
  } catch (e) {
    return res.status(502).json({
      error: "No pude hablar con Spotify ahora mismo. Inténtalo de nuevo.",
    });
  }
  if (r.ok && r.data.access_token) {
    return res.json({
      access_token: r.data.access_token,
      refresh_token: r.data.refresh_token || null,
      expires_in: r.data.expires_in || 3600,
      token_type: r.data.token_type || "Bearer",
    });
  }
  return res.status(401).json({
    error:
      "La sesión de Spotify venció y no se pudo renovar. Conéctalo de nuevo en el menú ☰ → Música.",
    needsConnect: true,
  });
});

// Llamada genérica a la API Web de Spotify con el token del cliente.
async function spotifyApiCall(accessToken, method, path, body, query) {
  let url = SPOTIFY_API_BASE + path;
  if (query) {
    const q = new URLSearchParams(query).toString();
    if (q) url += "?" + q;
  }
  const opts = {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    // Sin redirecciones: el token nunca debe viajar a otro host.
    redirect: "error",
  };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetchWithTimeout(url, opts, 30000);
  let data = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

// Traduce un error de Spotify a español claro. 401 = sesión expirada
// (el cliente la renueva sola y reintenta); 403 PREMIUM_REQUIRED = sin
// Premium no hay control de reproducción; 404 NO_ACTIVE_DEVICE = no hay
// dónde sonar (hay que abrir Spotify en el teléfono y darle play una vez).
function spotifyErrorResponse(r) {
  const err = (r.data && r.data.error) || {};
  const reason = String(err.reason || "");
  if (r.status === 401) {
    return {
      status: 401,
      body: {
        error:
          "La sesión de Spotify expiró. Isis la renueva sola; si sigue fallando, conéctalo de nuevo en el menú ☰ → Música.",
        needsRefresh: true,
      },
    };
  }
  if (r.status === 403 && reason === "PREMIUM_REQUIRED") {
    return {
      status: 403,
      body: {
        error:
          "Spotify exige Premium para controlar la reproducción. Con una cuenta gratis no puedo poner, pausar ni cambiar canciones desde aquí.",
        premiumRequired: true,
      },
    };
  }
  if (r.status === 404 && reason === "NO_ACTIVE_DEVICE") {
    return {
      status: 404,
      body: {
        error:
          "No hay ningún dispositivo de Spotify activo. Abre Spotify en tu teléfono, dale play a algo una vez, y luego dime de nuevo.",
        noActiveDevice: true,
      },
    };
  }
  if (r.status === 404) {
    return {
      status: 404,
      body: { error: "Spotify no encontró eso. Inténtalo de nuevo." },
    };
  }
  if (r.status === 429) {
    return {
      status: 429,
      body: {
        error:
          "Spotify dice que hay demasiadas peticiones. Espera un momento y lo intento de nuevo.",
      },
    };
  }
  return {
    status: 502,
    body: {
      error: `Spotify respondió con ${r.status}. Inténtalo de nuevo en un momento.`,
    },
  };
}

function spotifyAccess(req) {
  const { accessToken } = req.body || {};
  if (!accessToken || !String(accessToken).trim()) {
    return null;
  }
  return String(accessToken).trim();
}

app.post("/api/spotify/search", async (req, res) => {
  const token = spotifyAccess(req);
  if (!token) {
    return res.status(400).json({
      error: "Spotify no está conectado. Conéctalo en el menú ☰ → Música.",
      needsConnect: true,
    });
  }
  const q = String((req.body || {}).q || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Dime qué canción o artista buscar." });
  }
  let r;
  try {
    r = await spotifyApiCall(token, "GET", "/search", undefined, {
      q,
      type: "track",
      limit: "5",
    });
  } catch (e) {
    return res.status(502).json({
      error: "No pude buscar en Spotify ahora mismo. Inténtalo de nuevo.",
    });
  }
  if (!r.ok) {
    const mapped = spotifyErrorResponse(r);
    return res.status(mapped.status).json(mapped.body);
  }
  const items = (r.data && r.data.tracks && r.data.tracks.items) || [];
  return res.json({
    tracks: items.map((t) => ({
      id: t.id || null,
      name: t.name || "Sin nombre",
      artists: (t.artists || []).map((a) => a.name).filter(Boolean),
      uri: t.uri || null,
      album: (t.album && t.album.name) || "",
    })),
  });
});

app.post("/api/spotify/play", async (req, res) => {
  const token = spotifyAccess(req);
  if (!token) {
    return res.status(400).json({
      error: "Spotify no está conectado. Conéctalo en el menú ☰ → Música.",
      needsConnect: true,
    });
  }
  const { uri, deviceId } = req.body || {};
  let r;
  try {
    r = await spotifyApiCall(
      token,
      "PUT",
      "/me/player/play",
      uri ? { uris: [String(uri)] } : {},
      deviceId ? { device_id: String(deviceId) } : null
    );
  } catch (e) {
    return res.status(502).json({
      error: "No pude poner la música ahora mismo. Inténtalo de nuevo.",
    });
  }
  if (!r.ok) {
    const mapped = spotifyErrorResponse(r);
    return res.status(mapped.status).json(mapped.body);
  }
  return res.json({ ok: true });
});

app.post("/api/spotify/pause", async (req, res) => {
  const token = spotifyAccess(req);
  if (!token) {
    return res.status(400).json({
      error: "Spotify no está conectado. Conéctalo en el menú ☰ → Música.",
      needsConnect: true,
    });
  }
  let r;
  try {
    r = await spotifyApiCall(token, "PUT", "/me/player/pause");
  } catch (e) {
    return res.status(502).json({
      error: "No pude pausar la música ahora mismo. Inténtalo de nuevo.",
    });
  }
  if (!r.ok) {
    const mapped = spotifyErrorResponse(r);
    return res.status(mapped.status).json(mapped.body);
  }
  return res.json({ ok: true });
});

app.post("/api/spotify/next", async (req, res) => {
  const token = spotifyAccess(req);
  if (!token) {
    return res.status(400).json({
      error: "Spotify no está conectado. Conéctalo en el menú ☰ → Música.",
      needsConnect: true,
    });
  }
  let r;
  try {
    r = await spotifyApiCall(token, "POST", "/me/player/next");
  } catch (e) {
    return res.status(502).json({
      error: "No pude cambiar de canción ahora mismo. Inténtalo de nuevo.",
    });
  }
  if (!r.ok) {
    const mapped = spotifyErrorResponse(r);
    return res.status(mapped.status).json(mapped.body);
  }
  return res.json({ ok: true });
});

app.post("/api/spotify/status", async (req, res) => {
  const token = spotifyAccess(req);
  if (!token) {
    return res.status(400).json({
      error: "Spotify no está conectado. Conéctalo en el menú ☰ → Música.",
      needsConnect: true,
    });
  }
  let r;
  try {
    r = await spotifyApiCall(token, "GET", "/me/player/currently-playing");
  } catch (e) {
    return res.status(502).json({
      error: "No pude revisar qué está sonando ahora mismo.",
    });
  }
  if (r.status === 204 || !r.data) {
    return res.json({ playing: false, track: null, device: null });
  }
  if (!r.ok) {
    const mapped = spotifyErrorResponse(r);
    return res.status(mapped.status).json(mapped.body);
  }
  const item = r.data.item || null;
  return res.json({
    playing: !!r.data.is_playing,
    track: item
      ? {
          name: item.name || "Sin nombre",
          artists: (item.artists || []).map((a) => a.name).filter(Boolean),
          uri: item.uri || null,
          album: (item.album && item.album.name) || "",
        }
      : null,
    device: (r.data.device && r.data.device.name) || null,
  });
});

// ---------------------------------------------------------------- noticias
// Resumen del día: Google News RSS (gratis, sin clave) + Claude vía
// FableAI, que lo resume en español (máx. 5 noticias, una línea cada
// una). Si Claude falla, los titulares llegan tal cual (claudeLive:
// false) en vez de no dar noticias. La URL del feed se puede cambiar en
// local con NEWS_RSS_URL (para pruebas).
const NEWS_RSS_URL =
  process.env.NEWS_RSS_URL ||
  "https://news.google.com/rss?hl=es-419&gl=MX&ceid=MX:es-419";
const NEWS_SYSTEM = [
  "Eres Isis, la asistente personal de Santiago. Te pasa los titulares de hoy y le das un resumen corto de las noticias del día.",
  "Habla siempre en español (es-MX, informal, de 'tú'). Directa y con chispa, sin rodeos.",
  "Resume en MÁXIMO 5 noticias, una línea cada una, con este formato: '• titular — una frase con lo esencial'. Solo las noticias más importantes para alguien en México.",
  "Usa SOLO los titulares que te pasen: nunca inventes noticias, números ni detalles que no estén ahí. Si un titular no se entiende, no lo incluyas.",
  "Nada de muros de texto: solo las 5 líneas.",
].join(" ");

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
// Saca los titulares de un RSS: <item><title>…</title></item>. Sin
// librería de XML: el feed de Google News es simple y estable.
function parseRssTitles(xml) {
  const titles = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(String(xml || ""))) && titles.length < 10) {
    const t = /<title>([\s\S]*?)<\/title>/i.exec(m[1]);
    if (!t) continue;
    let title = t[1].trim().replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
    title = decodeXmlEntities(title);
    if (title && !titles.includes(title)) titles.push(title);
  }
  return titles;
}
// Google News pone la fuente al final ("Titular - Fuente"): se quita
// para que el resumen se lea limpio.
function cleanNewsTitle(t) {
  const clean = String(t || "")
    .replace(/\s+-\s+[^-]+$/, "")
    .trim();
  return clean || String(t || "").trim();
}

app.post("/api/news", async (req, res) => {
  const { fableaiKey } = req.body || {};
  if (!fableaiKey || !String(fableaiKey).trim()) {
    return res.status(400).json({
      error:
        "Para resumir las noticias necesito tu clave de FableAI en Configuración.",
      claudeLive: false,
    });
  }
  let xml;
  try {
    const r = await fetchWithTimeout(NEWS_RSS_URL, {}, 20000);
    if (!r.ok) throw new Error(`El feed respondió con ${r.status}`);
    xml = await r.text();
  } catch (e) {
    return res.status(502).json({
      error:
        "No pude traer las noticias ahora mismo. Inténtalo de nuevo en un momento.",
      claudeLive: false,
    });
  }
  const titles = parseRssTitles(xml);
  if (titles.length === 0) {
    return res.status(502).json({
      error:
        "El feed de noticias vino vacío. Inténtalo de nuevo en un momento.",
      claudeLive: false,
    });
  }
  const top = titles.slice(0, 8);
  try {
    const summary = await callClaude(String(fableaiKey).trim(), [
      { role: "system", content: NEWS_SYSTEM },
      {
        role: "user",
        content:
          "Titulares de hoy:\n" +
          top.map((t, i) => `${i + 1}. ${t}`).join("\n"),
      },
    ]);
    const clean = String(summary)
      .replace(/\[ánimo:\s*[a-záéíóúñ]+\s*\]/gi, "")
      .trim();
    return res.json({
      summary: clean,
      items: top.map(cleanNewsTitle),
      claudeLive: true,
    });
  } catch (err) {
    // Sin Claude, las noticias igual llegan: los titulares tal cual.
    const fallback = top
      .slice(0, 5)
      .map((t) => `• ${cleanNewsTitle(t)}`)
      .join("\n");
    return res.json({
      summary: fallback,
      items: top.map(cleanNewsTitle),
      claudeLive: false,
      note: "Sin el resumen de Claude: estos son los titulares tal cual.",
    });
  }
});

// ---------------------------------------------------------------- sistemas
// Diagnóstico JARVIS: Isis revisa sus propios sistemas (ella misma,
// Orlando, El Mitote y el teléfono) y devuelve un reporte consolidado
// con alertas. Cada revisión se degrada sola si falla: el reporte
// siempre responde, nunca 500 por un sistema caído.
async function mitoteGet(path, ms) {
  const token = (process.env.MITOTE_API_TOKEN || "").trim();
  if (!token) return { ok: false, status: 503, noToken: true };
  try {
    const res = await fetchWithTimeout(
      MITOTE_API_BASE + path,
      { headers: { Authorization: `Bearer ${token}` } },
      ms
    );
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, timeout: true };
  }
}
function isTableOccupied(t) {
  if (!t || typeof t !== "object") return false;
  if (t.occupied === true) return true;
  if (t.account_id || t.account) return true;
  const s = String(t.status || t.estado || "").toLowerCase();
  return (
    s === "occupied" || s === "ocupada" || s === "ocupado" || s === "busy"
  );
}
async function checkMitote() {
  // Salud y mesas en paralelo: la primera llamada puede tardar si el
  // restaurante estaba dormido (plan Free).
  const [health, tables] = await Promise.allSettled([
    (async () => {
      const h1 = await mitoteGet("/health", 15000);
      if (h1.ok) return h1;
      return mitoteGet("/api/health", 15000);
    })(),
    mitoteGet("/api/tables", 25000),
  ]);
  const h =
    health.status === "fulfilled"
      ? health.value
      : { ok: false, status: 0, timeout: true };
  const tb =
    tables.status === "fulfilled"
      ? tables.value
      : { ok: false, status: 0, timeout: true };
  if (h.noToken || tb.noToken) {
    return {
      status: "not_configured",
      detail:
        "La conexión con El Mitote no está configurada en el servidor.",
    };
  }
  const tablesArr = tb.ok && Array.isArray(tb.data) ? tb.data : null;
  const total = tablesArr ? tablesArr.length : null;
  const occupied = tablesArr
    ? tablesArr.filter(isTableOccupied).length
    : null;
  if (tablesArr) {
    return {
      status: "ok",
      detail:
        occupied !== null
          ? `${occupied} de ${total} mesas ocupadas`
          : `${total} mesas`,
      database:
        h.ok && h.data && h.data.database ? String(h.data.database) : null,
      tablesTotal: total,
      tablesOccupied: occupied,
    };
  }
  if (h.ok) {
    return {
      status: "ok",
      detail: "El restaurante responde, pero no se pudieron contar las mesas.",
      database:
        h.data && h.data.database ? String(h.data.database) : null,
    };
  }
  if (h.timeout || tb.timeout) {
    return {
      status: "waking",
      detail:
        "El servidor del restaurante estaba dormido y está despertando; reintenta en un momento.",
    };
  }
  return {
    status: "down",
    detail: "El servidor del restaurante no responde.",
  };
}

app.post("/api/systems", async (req, res) => {
  const { n8nKey, battery } = req.body || {};
  const uptimeMin = Math.max(1, Math.round(process.uptime() / 60));
  const [orlandoRes, mitoteRes] = await Promise.allSettled([
    (async () => {
      if (!n8nKey || !String(n8nKey).trim()) {
        return {
          source: "last_known",
          live: false,
          executionsUsed: ORLANDO_LAST_KNOWN.executionsUsed,
          executionsTotal: ORLANDO_LAST_KNOWN.executionsTotal,
          executionsFailed: ORLANDO_LAST_KNOWN.executionsFailed,
          workflowActive: ORLANDO_LAST_KNOWN.workflowActive,
          trialEnds: ORLANDO_LAST_KNOWN.trialEnds,
        };
      }
      try {
        const live = await fetchOrlandoLive(String(n8nKey).trim());
        return {
          source: "live",
          live: true,
          executionsUsed: live.total,
          executionsTotal: ORLANDO_LAST_KNOWN.executionsTotal,
          executionsFailed: live.failed,
          workflowActive: live.workflowActive,
          trialEnds: ORLANDO_LAST_KNOWN.trialEnds,
        };
      } catch (e) {
        return {
          source: "unknown",
          live: false,
          error: true,
          executionsUsed: ORLANDO_LAST_KNOWN.executionsUsed,
          executionsTotal: ORLANDO_LAST_KNOWN.executionsTotal,
          executionsFailed: ORLANDO_LAST_KNOWN.executionsFailed,
          workflowActive: ORLANDO_LAST_KNOWN.workflowActive,
          trialEnds: ORLANDO_LAST_KNOWN.trialEnds,
        };
      }
    })(),
    checkMitote(),
  ]);
  const orlando =
    orlandoRes.status === "fulfilled"
      ? orlandoRes.value
      : {
          source: "unknown",
          error: true,
          executionsUsed: ORLANDO_LAST_KNOWN.executionsUsed,
          executionsTotal: ORLANDO_LAST_KNOWN.executionsTotal,
          executionsFailed: ORLANDO_LAST_KNOWN.executionsFailed,
          workflowActive: null,
        };
  const mitote =
    mitoteRes.status === "fulfilled"
      ? mitoteRes.value
      : { status: "down", detail: "No se pudo revisar El Mitote." };

  const alerts = [];
  // Orlando
  let orlandoStatus = "ok";
  let orlandoDetail = `${orlando.executionsUsed} de ${orlando.executionsTotal} ejecuciones usadas, ${orlando.executionsFailed} fallidas`;
  if (orlando.source === "live") orlandoDetail += " (en vivo)";
  else if (orlando.source === "last_known")
    orlandoDetail += " (último dato conocido)";
  else orlandoDetail += " (no se pudo revisar en vivo)";
  if (orlando.workflowActive === false) {
    orlandoStatus = "down";
    alerts.push({
      system: "orlando",
      message: "El workflow de Orlando está pausado en n8n.",
      action:
        "Actívalo en n8n (workflow 'WhatsApp PCN - Respuestas naturales').",
    });
  } else if (orlando.executionsUsed >= 900) {
    orlandoStatus = "warn";
    alerts.push({
      system: "orlando",
      message: `Quedan ${orlando.executionsTotal - orlando.executionsUsed} ejecuciones de n8n de la prueba (ya van ${orlando.executionsUsed} de ${orlando.executionsTotal}).`,
      action:
        "Decide si pagas el plan Starter o migras el bot a Render antes del 3 de diciembre.",
    });
  } else if (orlando.source === "unknown") {
    orlandoStatus = "unknown";
  }
  // El Mitote
  const mitoteStatus =
    mitote.status === "ok"
      ? "ok"
      : mitote.status === "waking"
        ? "warn"
        : "down";
  if (mitote.status === "down") {
    alerts.push({
      system: "mitote",
      message: "El servidor de El Mitote no responde.",
      action: "Revisa el servicio el-mitote-comandas en Render.",
    });
  } else if (mitote.status === "not_configured") {
    alerts.push({
      system: "mitote",
      message: "La conexión con El Mitote no está configurada en el servidor.",
      action: "Pon MITOTE_API_TOKEN en el servicio de Isis en Render.",
    });
  }
  // Teléfono (batería, si el cliente la mandó)
  let phoneStatus = "ok";
  let phoneDetail = "Sin datos de batería.";
  const b = battery && typeof battery === "object" ? battery : null;
  if (b && typeof b.level === "number") {
    const pct = Math.round(b.level * 100);
    phoneDetail = `Batería ${pct}%${b.charging ? " (cargando)" : ""}`;
    if (pct < 20 && !b.charging) {
      phoneStatus = "warn";
      alerts.push({
        system: "phone",
        message: `La batería del teléfono está en ${pct}%.`,
        action:
          "Ponlo a cargar para que Isis y TextBee no se queden sin teléfono.",
      });
    }
  }
  const hasWarnings = [orlandoStatus, mitoteStatus, phoneStatus].some(
    (s) => s === "warn" || s === "unknown"
  );
  const verdict =
    alerts.length === 0
      ? hasWarnings
        ? "Todo operando, con avisos menores."
        : "Todos los sistemas operando."
      : alerts.length === 1
        ? `Hay 1 alerta: ${alerts[0].message}`
        : `Hay ${alerts.length} alertas: ${alerts
            .map((a) => a.message)
            .join(" ")}`;
  return res.json({
    ok: true,
    verdict,
    checkedAt: new Date().toISOString(),
    checks: {
      isis: {
        status: "ok",
        detail: `En vivo · despierta desde hace ${uptimeMin} min`,
      },
      orlando: {
        status: orlandoStatus,
        detail: orlandoDetail,
        executionsUsed: orlando.executionsUsed,
        executionsTotal: orlando.executionsTotal,
        executionsFailed: orlando.executionsFailed,
        workflowActive: orlando.workflowActive,
        source: orlando.source,
      },
      mitote: {
        status: mitoteStatus,
        detail: mitote.detail,
        tablesTotal: mitote.tablesTotal ?? null,
        tablesOccupied: mitote.tablesOccupied ?? null,
      },
      phone: { status: phoneStatus, detail: phoneDetail },
    },
    alerts,
  });
});

// ---------------------------------------------------------------- el mitote
// Proxy a El Mitote Comandas (FastAPI en Render). El navegador manda solo
// {action, params}; el token vive SOLO en el servidor (MITOTE_API_TOKEN)
// y se añade aquí como Authorization: Bearer. Nunca se devuelve, nunca se
// loguea, nunca viaja al navegador. Lista blanca estricta: fuera de ella,
// 403. Lo destructivo exige params.confirmed === true (la confirmación
// por voz en dos pasos del cliente); sin él, 403. El servicio Free se
// duerme: la primera llamada puede tardar 30-60 s, por eso el timeout es
// de 65 s y si la respuesta tarda más de MITOTE_SLOW_MS se devuelve un
// aviso (notice) para que Santiago sepa que el restaurante despertaba.
app.post("/api/mitote", async (req, res) => {
  const { action, params } = req.body || {};
  if (!action || typeof action !== "string") {
    return res.status(400).json({ error: "Falta la acción de El Mitote." });
  }
  const spec = MITOTE_ACTIONS[action];
  if (!spec) {
    return res.status(403).json({
      error: `La acción "${action}" no está permitida para Isis.`,
    });
  }
  const token = (process.env.MITOTE_API_TOKEN || "").trim();
  if (!token) {
    return res.status(503).json({
      error:
        "La conexión con El Mitote no está configurada en el servidor (falta MITOTE_API_TOKEN). Pídele a Santiago que la ponga en Render.",
    });
  }
  const p =
    params && typeof params === "object" && !Array.isArray(params)
      ? params
      : {};
  if (spec.destructive && p.confirmed !== true) {
    return res.status(403).json({
      error:
        "Esta acción necesita confirmación por voz: Isis debe preguntarte primero y solo se ejecuta cuando digas que sí.",
      // Bandera legible por el cliente: sin ella, el cliente solo veía
      // el texto del error y nunca armaba la confirmación pendiente,
      // así que el "sí" de Santiago volvía al chat y la acción se pedía
      // de nuevo en bucle. Con needsConfirmation, el cliente arma la
      // pendiente y el próximo "sí" (o el botón) la ejecuta con
      // confirmed: true.
      needsConfirmation: true,
      action,
      actionLabel: spec.label,
    });
  }
  let path;
  try {
    path = spec.path(p);
  } catch (e) {
    return res.status(400).json({
      error: e.message || "Faltan datos para esta acción.",
    });
  }
  // El cuerpo/consulta lleva solo los parámetros de negocio: sin los IDs
  // de ruta de ESTA acción y sin el flag de confirmación.
  const pathKeys = new Set(MITOTE_PATH_PARAMS[action] || []);
  const body = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === "confirmed" || pathKeys.has(k)) continue;
    body[k] = v;
  }
  const method = spec.method;
  let url = MITOTE_API_BASE + path;
  const fetchOptions = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    // Sin redirecciones: el token nunca debe viajar a otro host.
    redirect: "error",
  };
  if (method === "GET") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      qs.append(k, String(v));
    }
    const q = qs.toString();
    if (q) url += "?" + q;
  } else if (Object.keys(body).length > 0) {
    fetchOptions.body = JSON.stringify(body);
  }

  const started = Date.now();
  // Reintentos con backoff ante errores transitorios (429/502/503): el
  // restaurante en plan Free a veces responde 429 un momento y luego ya
  // contesta bien. Inmediato, +1 s, +2 s. Los 401/409/422 no se reintentan
  // (son errores de verdad, no de carga). Un fallo de red (timeout) no se
  // reintenta: la llamada pudo haberse ejecutado en el restaurante.
  const RETRYABLE = new Set([429, 502, 503]);
  let up = null;
  let attemptsUsed = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    attemptsUsed = attempt + 1;
    if (attempt > 0) await sleep(attempt === 1 ? 1000 : 2000);
    try {
      up = await fetchWithTimeout(url, fetchOptions, MITOTE_TIMEOUT_MS);
    } catch (e) {
      return res.status(502).json({
        error:
          "No pude hablar con el servidor del restaurante. Puede estar despertando (la primera vez tarda hasta un minuto); inténtalo de nuevo en un momento.",
      });
    }
    if (up.ok || !RETRYABLE.has(up.status)) break;
  }
  const tookMs = Date.now() - started;
  const notice =
    tookMs > MITOTE_SLOW_MS
      ? `El servidor del restaurante estaba dormido y tardó ${Math.round(
          tookMs / 1000
        )} segundos en despertar.`
      : null;

  if (!up.ok) {
    let detail = "";
    try {
      const errData = await up.json();
      detail = errData?.detail || errData?.error || "";
      if (typeof detail !== "string") detail = JSON.stringify(detail);
    } catch (e) {
      detail = "";
    }
    if (up.status === 401) {
      return res.status(502).json({
        error:
          "El Mitote rechazó la credencial de Isis (token inválido o revocado). Revisa MITOTE_API_TOKEN en Render.",
      });
    }
    // Si se agotaron los 3 intentos ante un error transitorio, mensaje
    // claro sin el número crudo.
    if (RETRYABLE.has(up.status) && attemptsUsed >= 3) {
      return res.status(502).json({
        error:
          "El Mitote está ocupado ahora mismo. Lo intento de nuevo en un momento.",
        notice,
      });
    }
    if (up.status === 503) {
      return res.status(502).json({
        error: "El servidor del restaurante no está disponible ahora mismo.",
      });
    }
    // 422: validación de FastAPI. El detalle crudo es un JSON de validación
    // que Santiago no tiene por qué ver: se devuelve un mensaje claro.
    if (up.status === 422) {
      return res.status(502).json({
        error:
          "El Mitote no entendió esa acción: faltan datos o el formato no es el que espera. Dime qué quieres hacer con otras palabras y lo intento de nuevo.",
        notice,
      });
    }
    const base =
      up.status === 409
        ? "El Mitote no lo permite"
        : `El Mitote respondió con ${up.status}`;
    return res.status(502).json({
      error: detail ? `${base}: ${detail}` : `${base}.`,
      notice,
    });
  }

  if (spec.pdf) {
    const buf = Buffer.from(await up.arrayBuffer());
    const filename =
      action === "accounts_ticket_pdf"
        ? `ticket-${p.account_id || "cuenta"}.pdf`
        : action === "cash_period_report_pdf"
          ? `corte-${p.period_id || "turno"}.pdf`
          : `precuenta-${p.account_id || "cuenta"}.pdf`;
    return res.json({
      ok: true,
      action,
      summary: mitoteSummary(action, {
        account_id: p.account_id,
        period_id: p.period_id,
      }),
      notice,
      pdfBase64: buf.toString("base64"),
      filename,
      contentType: "application/pdf",
      tookMs,
    });
  }

  let data = null;
  try {
    data = await up.json();
  } catch (e) {
    data = null;
  }
  return res.json({
    ok: true,
    action,
    summary: mitoteSummary(action, data),
    notice,
    data,
    tookMs,
  });
});

// ---------------------------------------------------------------- arranque
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Isis escuchando en el puerto ${PORT}`);
});
