/**
 * Golden Barbershop — puente entre el sitio web y Google Calendar.
 * Desplegar como Web App (ver SETUP-CALENDAR.md en la raíz del proyecto).
 *
 * GET  ?action=availability&date=YYYY-MM-DD  -> horarios ocupados ese día
 * POST { name, phone, email, service, serviceLabel, date, time, duration, barber, notes }
 *      -> crea el evento en el Google Calendar de quien despliega el script
 */

// IMPORTANTE: Para mayor seguridad, definí un token secreto aquí
// y pegalo también en el frontend (`main.js`) como `CALENDAR_SECRET`.
// Ejemplo: var SCRIPT_SECRET = 'mi-token-secreto-123';
var SCRIPT_SECRET = 'mi-token-secreto-1223';

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

    // Validación de token simple: evita que cualquier origen cree eventos
    if (!data || data.secret !== SCRIPT_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized: invalid secret' });
    }

    if (!data.name || !data.phone || !data.date || !data.time) {
      return jsonResponse({ ok: false, error: 'Faltan datos obligatorios.' });
    }

    var cal = CalendarApp.getDefaultCalendar();
    var start = new Date(data.date + 'T' + data.time + ':00');
    var durationMinutes = parseInt(data.duration, 10) || 30;
    var end = new Date(start.getTime() + durationMinutes * 60000);

    var title = 'Turno: ' + (data.serviceLabel || data.service) + ' — ' + data.name;
    var description = [
      'Cliente: ' + data.name,
      'Teléfono: ' + data.phone,
      'Email: ' + (data.email || '-'),
      'Servicio: ' + (data.serviceLabel || data.service),
      'Barbero: ' + (data.barber || 'Cualquiera'),
      'Comentarios: ' + (data.notes || '-')
    ].join('\n');

    var event = cal.createEvent(title, start, end, {
      description: description,
      location: 'Golden Barbershop'
    });

    return jsonResponse({ ok: true, eventId: event.getId() });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
