/* Golden Barbershop — main.js
   IIFE modules, no build step, no ES imports. */

/* ============ CONFIG ============
   Pegá acá la URL de tu Google Apps Script Web App una vez desplegado
   (ver SETUP-CALENDAR.md). Mientras esté vacío, el formulario funciona
   en "modo demostración": valida y muestra confirmación, pero no crea
   el evento real en Google Calendar.

   Seguridad opcional: definí un token secreto y pegalo **tanto** en
   `apps-script/Code.gs` (variable SCRIPT_SECRET) como en
   `CALENDAR_SECRET` abajo. Esto evita que terceros creen eventos.
*/
window.__BRAND__ = {
  CALENDAR_ENDPOINT: 'https://script.google.com/macros/s/AKfycbziYN9m2rcAm66zYStSqtRyIzQ7SbjINWdYouMZ5wY7CcFjNkXPcCpgMwdQ5jmC-CCh/exec', // URL Web App (exec)
  CALENDAR_SECRET: 'mi-token-secreto-1223', // token secreto proporcionado por el usuario
  OPEN_HOUR: 9,
  CLOSE_HOUR: 20,
  SATURDAY_CLOSE_HOUR: 18,
  SLOT_MINUTES: 30,
  DEPOSIT_PERCENT: 10, // % del precio del servicio a cobrar como seña. 0 = deshabilitado.
  CURRENCY: 'ARS',
  MP_PAYMENT_LINK: 'https://link.mercadopago.com.ar/gidmp' // link de pago fijo de Mercado Pago
};

function safe(fn, name) {
  try { fn(); } catch (err) {
    console.error('[golden-barbershop] fallo en "' + name + '":', err);
  }
}

/* ============ Header scroll state ============ */
safe(function headerScroll() {
  var header = document.getElementById('site-header');
  if (!header) return;
  function onScroll() {
    if (window.scrollY > 12) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}, 'headerScroll');

/* ============ Mobile nav ============ */
safe(function mobileNav() {
  var toggle = document.getElementById('nav-toggle');
  var panel = document.getElementById('mobile-nav');
  if (!toggle || !panel) return;

  function close() {
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  function open() {
    panel.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  toggle.addEventListener('click', function () {
    var isOpen = panel.classList.contains('is-open');
    isOpen ? close() : open();
  });
  panel.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', close);
  });
}, 'mobileNav');

/* ============ Reveal on scroll ============ */
safe(function revealOnScroll() {
  var items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

  items.forEach(function (el) { observer.observe(el); });

  /* safety net: nothing stays hidden forever */
  setTimeout(function () {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  }, 6000);
}, 'revealOnScroll');

/* ============ Footer year ============ */
safe(function footerYear() {
  var el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}, 'footerYear');

/* ============ Service card -> booking form shortcuts ============ */
safe(function serviceShortcuts() {
  var buttons = document.querySelectorAll('[data-book]');
  var serviceSelect = document.getElementById('f-service');
  if (!buttons.length || !serviceSelect) return;

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-book');
      serviceSelect.value = value;
      serviceSelect.dispatchEvent(new Event('change'));
      var target = document.getElementById('agendar');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var nameField = document.getElementById('f-name');
      if (nameField) setTimeout(function () { nameField.focus(); }, 500);
    });
  });
}, 'serviceShortcuts');

/* ============ Retorno desde Mercado Pago (?pago=success|pending|failure) ============ */
safe(function depositReturnStatus() {
  var params = new URLSearchParams(location.search);
  var pago = params.get('pago');
  if (!pago) return;

  var status = document.getElementById('form-status');
  var messages = {
    success: ['¡Seña acreditada! Ya reservamos tu horario, te esperamos.', 'success'],
    pending: ['Tu pago está pendiente de acreditación. Te confirmamos apenas se procese.', 'loading'],
    failure: ['El pago no se completó. Podés reintentarlo desde el local o contactarnos.', 'error']
  };
  var msg = messages[pago];
  if (status && msg) {
    status.textContent = msg[0];
    status.setAttribute('data-state', msg[1]);
  }

  var target = document.getElementById('agendar');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  params.delete('pago');
  var qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}, 'depositReturnStatus');

/* ============ Booking form + Google Calendar link ============ */
safe(function bookingForm() {
  var CFG = window.__BRAND__;
  var form = document.getElementById('booking-form');
  if (!form) return;

  var dateInput = document.getElementById('f-date');
  var timeSelect = document.getElementById('f-time');
  var serviceSelect = document.getElementById('f-service');
  var status = document.getElementById('form-status');
  var submitBtn = document.getElementById('form-submit');
  var depositBox = document.getElementById('deposit-offer');

  function pad(n) { return String(n).padStart(2, '0'); }

  function localDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  var todayStr = localDateStr(new Date());
  dateInput.min = todayStr;

  function buildSlots(dateStr) {
    var slots = [];
    var d = new Date(dateStr + 'T00:00:00');
    var day = d.getDay(); // 0 = domingo, 6 = sábado
    if (day === 0) return slots; // cerrado domingos
    var closeHour = (day === 6) ? CFG.SATURDAY_CLOSE_HOUR : CFG.CLOSE_HOUR;
    var cursor = CFG.OPEN_HOUR * 60;
    var end = closeHour * 60;

    var now = new Date();
    var isToday = dateStr === localDateStr(now);
    var nowMinutes = now.getHours() * 60 + now.getMinutes();

    while (cursor + CFG.SLOT_MINUTES <= end) {
      if (!isToday || cursor > nowMinutes) {
        var h = Math.floor(cursor / 60);
        var m = cursor % 60;
        slots.push(pad(h) + ':' + pad(m));
      }
      cursor += CFG.SLOT_MINUTES;
    }
    return slots;
  }

  function renderSlots(slots, busySet, emptyMessage) {
    timeSelect.innerHTML = '';
    if (!slots.length) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = emptyMessage || 'Cerrado ese día';
      opt.disabled = true;
      opt.selected = true;
      timeSelect.appendChild(opt);
      timeSelect.disabled = true;
      return;
    }
    timeSelect.disabled = false;
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Elegí un horario';
    placeholder.disabled = true;
    placeholder.selected = true;
    timeSelect.appendChild(placeholder);

    slots.forEach(function (slot) {
      var o = document.createElement('option');
      o.value = slot;
      var taken = busySet && busySet.has(slot);
      o.textContent = taken ? slot + ' (ocupado)' : slot;
      o.disabled = !!taken;
      timeSelect.appendChild(o);
    });
  }

  function slotsFromBusyRanges(dateStr, busyRanges) {
    var busy = new Set();
    busyRanges.forEach(function (range) {
      var start = new Date(range.start);
      var end = new Date(range.end);
      var cursor = new Date(start);
      while (cursor < end) {
        busy.add(pad(cursor.getHours()) + ':' + pad(cursor.getMinutes()));
        cursor = new Date(cursor.getTime() + CFG.SLOT_MINUTES * 60000);
      }
    });
    return busy;
  }

  function refreshSlots() {
    var dateStr = dateInput.value;
    if (!dateStr) {
      renderSlots([]);
      return;
    }

    if (dateStr < todayStr) {
      renderSlots([], null, 'Elegí una fecha a partir de hoy');
      setStatus('Elegí una fecha a partir de hoy, no se pueden agendar turnos en el pasado.', 'error');
      return;
    }

    var slots = buildSlots(dateStr);
    var closedDay = new Date(dateStr + 'T00:00:00').getDay() === 0;
    var emptyMsg = closedDay ? 'Cerrado ese día' : 'No quedan horarios disponibles hoy';

    if (!CFG.CALENDAR_ENDPOINT) {
      renderSlots(slots, null, emptyMsg);
      return;
    }

    renderSlots(slots, null, emptyMsg);
    timeSelect.disabled = true;

    var url = CFG.CALENDAR_ENDPOINT + '?action=availability&date=' + encodeURIComponent(dateStr);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var busySet = data && data.busy ? slotsFromBusyRanges(dateStr, data.busy) : new Set();
        renderSlots(slots, busySet, emptyMsg);
      })
      .catch(function () {
        renderSlots(slots, null, emptyMsg); // si falla la consulta, dejamos todos los horarios habilitados
      });
  }

  dateInput.addEventListener('change', refreshSlots);

  function setStatus(text, state) {
    status.textContent = text || '';
    if (state) status.setAttribute('data-state', state);
    else status.removeAttribute('data-state');
  }

  function googleCalendarLink(payload, startDate, endDate) {
    function toGCalDate(d) {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
    var params = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Turno en Golden Barbershop — ' + payload.serviceLabel + (payload.quantity > 1 ? ' x' + payload.quantity : ''),
      dates: toGCalDate(startDate) + '/' + toGCalDate(endDate),
      details: 'Servicio: ' + payload.serviceLabel + (payload.quantity > 1 ? ' x' + payload.quantity : '') + '\nBarbero: ' + payload.barber + (payload.notes ? '\nComentarios: ' + payload.notes : ''),
      location: 'Av. Principal 123, Ciudad'
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  function computeDepositAmount(price) {
    if (!CFG.DEPOSIT_PERCENT || !price) return 0;
    return Math.round(price * CFG.DEPOSIT_PERCENT) / 100;
  }

  function renderDepositOffer(payload, price) {
    if (!depositBox) return;
    depositBox.innerHTML = '';

    var amount = computeDepositAmount(price);
    if (!amount) return;

    var box = document.createElement('div');
    box.className = 'deposit-offer__box';

    var text = document.createElement('p');
    text.textContent = 'Podés reservar tu horario pagando una seña de $' + amount + ' ' + CFG.CURRENCY +
      ' (' + CFG.DEPOSIT_PERCENT + '% del servicio) con Mercado Pago.';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--ghost btn--block';
    btn.textContent = 'Pagar seña con Mercado Pago';
    btn.addEventListener('click', function () { payDeposit(btn); });

    box.appendChild(text);
    box.appendChild(btn);
    depositBox.appendChild(box);
  }

  function payDeposit(btn) {
    btn.disabled = true;
    btn.textContent = 'Redirigiendo a Mercado Pago…';
    // Al ser un link de link.mercadopago.com.ar, el propio sistema operativo
    // abre la app de Mercado Pago si está instalada, o el navegador si no.
    window.location.href = CFG.MP_PAYMENT_LINK;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var serviceOpt = serviceSelect.options[serviceSelect.selectedIndex];
    var baseDuration = serviceOpt ? parseInt(serviceOpt.getAttribute('data-duration'), 10) || 30 : 30;
    var basePrice = serviceOpt ? parseFloat(serviceOpt.getAttribute('data-price')) || 0 : 0;
    var quantity = parseInt(data.get('quantity'), 10) || 1;
    var duration = baseDuration * quantity;
    var price = basePrice * quantity;

    var dateStr = data.get('date');
    var timeStr = data.get('time');
    if (!dateStr || !timeStr) {
      setStatus('Elegí fecha y horario para continuar.', 'error');
      return;
    }

    var start = new Date(dateStr + 'T' + timeStr + ':00');
    var end = new Date(start.getTime() + duration * 60000);

    if (start.getTime() <= Date.now()) {
      setStatus('Ese horario ya pasó. Elegí una fecha y hora posteriores al momento actual.', 'error');
      refreshSlots();
      return;
    }

    var payload = {
      name: data.get('name'),
      phone: data.get('phone'),
      email: data.get('email') || '',
      service: data.get('service'),
      serviceLabel: serviceOpt ? serviceOpt.textContent : data.get('service'),
      quantity: quantity,
      date: dateStr,
      time: timeStr,
      duration: duration,
      barber: data.get('barber') || 'Cualquiera',
      notes: data.get('notes') || ''
    };

    // incluir el secret configurado para que Apps Script lo valide
    if (CFG.CALENDAR_SECRET) payload.secret = CFG.CALENDAR_SECRET;

    submitBtn.disabled = true;
    setStatus('Confirmando turno…', 'loading');
    if (depositBox) depositBox.innerHTML = '';

    var addToCalUrl = googleCalendarLink(payload, start, end);

    if (!CFG.CALENDAR_ENDPOINT) {
      setTimeout(function () {
        setStatus(
          '¡Listo! Turno registrado en modo demostración (falta vincular Google Calendar — ver SETUP-CALENDAR.md). Te contactamos para confirmar.',
          'success'
        );
        submitBtn.disabled = false;
        renderDepositOffer(payload, price);
      }, 600);
      return;
    }

    /* Sin headers custom para evitar preflight CORS con Apps Script;
       el body llega como texto plano y se parsea igual en el backend. */
    fetch(CFG.CALENDAR_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (result && result.ok) {
          setStatus(
            '¡Turno confirmado para el ' + dateStr + ' a las ' + timeStr + '! ' +
            'Podés sumarlo también a tu calendario personal.',
            'success'
          );
          form.reset();
          renderSlots([]);
          renderDepositOffer(payload, price);
        } else {
          throw new Error('respuesta no ok');
        }
      })
      .catch(function () {
        setStatus(
          'No pudimos confirmar automáticamente. Escribinos por WhatsApp o llamanos, o ' +
          'guardá el turno en tu propio calendario mientras lo confirmamos.',
          'error'
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
        var link = document.createElement('a');
        link.href = addToCalUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = ' Añadir a mi calendario personal →';
        status.appendChild(link);
      });
  });
}, 'bookingForm');
