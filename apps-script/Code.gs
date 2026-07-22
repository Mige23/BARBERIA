/**
 * Golden Barbershop — puente entre el sitio web, Google Calendar y Mercado Pago.
 * Desplegar como Web App (ver SETUP-CALENDAR.md y SETUP-MERCADOPAGO.md en la raíz del proyecto).
 *
 * GET  ?action=availability&date=YYYY-MM-DD  -> horarios ocupados ese día
 * POST (sin action, o action=create_booking) { name, phone, email, service, serviceLabel,
 *      quantity, date, time, duration, barber, notes } -> crea el evento en el Google Calendar
 * POST action=create_preference { title, amount, name, email, date, time, service, returnUrl }
 *      -> crea una preferencia de pago en Mercado Pago y devuelve el link de checkout
 */

// Minutos antes del turno en los que Google Calendar te manda el mail de
// recordatorio (a la cuenta dueña de este calendario). 60 = 1 hora antes.
var REMINDER_MINUTES_BEFORE = 60;

// IMPORTANTE: Para mayor seguridad, definí un token secreto aquí
// y pegalo también en el frontend (`main.js`) como `CALENDAR_SECRET`.
// Ejemplo: var SCRIPT_SECRET = 'mi-token-secreto-123';
var SCRIPT_SECRET = 'mi-token-secreto-1223';

// El Access Token de Mercado Pago NUNCA se hardcodea acá (es mucho más sensible
// que SCRIPT_SECRET: permite crear cobros y ver ventas). Se configura en
// Configuración del proyecto -> Propiedades de secuencia de comandos -> MP_ACCESS_TOKEN.
// Ver SETUP-MERCADOPAGO.md.
function getMpAccessToken() {
  return PropertiesService.getScriptProperties().getProperty('MP_ACCESS_TOKEN');
}

function doGet(e) {
  var params = e.parameter || {};

  if (params.action === 'availability' && params.date) {
    var cal = CalendarApp.getDefaultCalendar();
    var dayStart = new Date(params.date + 'T00:00:00');
    var dayEnd = new Date(params.date + 'T23:59:59');
    var events = cal.getEvents(dayStart, dayEnd);

    var busy = events.map(function (ev) {
      return {
        start: ev.getStartTime().toISOString(),
        end: ev.getEndTime().toISOString()
      };
    });

    return jsonResponse({ ok: true, busy: busy });
  }

  return jsonResponse({ ok: true, message: 'Golden Barbershop booking endpoint' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Validación de token simple: evita que cualquier origen use el endpoint
    if (!data || data.secret !== SCRIPT_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized: invalid secret' });
    }

    if (data.action === 'create_preference') {
      return createPaymentPreference(data);
    }
    return createBooking(data);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function createBooking(data) {
  if (!data.name || !data.phone || !data.date || !data.time) {
    return jsonResponse({ ok: false, error: 'Faltan datos obligatorios.' });
  }

  var cal = CalendarApp.getDefaultCalendar();
  var start = new Date(data.date + 'T' + data.time + ':00');
  var durationMinutes = parseInt(data.duration, 10) || 30;
  var end = new Date(start.getTime() + durationMinutes * 60000);

  var quantity = parseInt(data.quantity, 10) || 1;
  var serviceText = (data.serviceLabel || data.service) + (quantity > 1 ? ' x' + quantity : '');

  var title = 'Turno: ' + serviceText + ' — ' + data.name;
  var description = [
    'Cliente: ' + data.name,
    'Teléfono: ' + data.phone,
    'Email: ' + (data.email || '-'),
    'Servicio: ' + serviceText,
    'Barbero: ' + (data.barber || 'Cualquiera'),
    'Comentarios: ' + (data.notes || '-')
  ].join('\n');

  var event = cal.createEvent(title, start, end, {
    description: description,
    location: 'Golden Barbershop'
  });

  // Recordatorio por mail para el dueño del calendario (además del popup por defecto).
  event.addEmailReminder(REMINDER_MINUTES_BEFORE);

  return jsonResponse({ ok: true, eventId: event.getId() });
}

function createPaymentPreference(data) {
  var token = getMpAccessToken();
  if (!token) {
    return jsonResponse({ ok: false, error: 'Mercado Pago no está configurado (falta MP_ACCESS_TOKEN en Propiedades del script).' });
  }

  var amount = Number(data.amount);
  if (!data.title || !amount || amount <= 0) {
    return jsonResponse({ ok: false, error: 'Faltan datos del pago.' });
  }
  if (!data.returnUrl) {
    return jsonResponse({ ok: false, error: 'Falta returnUrl.' });
  }

  var externalRef = [data.date, data.time, data.service].filter(function (v) { return !!v; }).join('|') + '|' + Utilities.getUuid();

  var body = {
    items: [{
      title: data.title,
      quantity: 1,
      unit_price: amount,
      currency_id: 'ARS'
    }],
    back_urls: {
      success: data.returnUrl + '?pago=success',
      failure: data.returnUrl + '?pago=failure',
      pending: data.returnUrl + '?pago=pending'
    },
    auto_return: 'approved',
    external_reference: externalRef,
    statement_descriptor: 'GOLDEN BARBERSHOP'
  };

  if (data.name || data.email) {
    body.payer = {};
    if (data.name) body.payer.name = data.name;
    if (data.email) body.payer.email = data.email;
  }

  var resp = UrlFetchApp.fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var result = JSON.parse(resp.getContentText());

  if (resp.getResponseCode() >= 300) {
    return jsonResponse({ ok: false, error: (result && result.message) || 'Error creando el pago en Mercado Pago.' });
  }

  return jsonResponse({
    ok: true,
    initPoint: result.init_point,
    sandboxInitPoint: result.sandbox_init_point,
    preferenceId: result.id
  });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
