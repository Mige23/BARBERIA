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
  CALENDAR_ENDPOINT: 'https://script.google.com/macros/s/AKfycbzSUo5l6sTN1X0o58KMw5kFmlWX9U1vEYjvtpc6BbIlfYi2GThoo4c_fzu0M79nCz1sRA/exec', // ej: 'https://script.google.com/macros/s/AKfycb.../exec'
  CALENDAR_SECRET: '', // pega aquí el mismo token que en Code.gs
  OPEN_HOUR: 9,
  CLOSE_HOUR: 20,
  SATURDAY_CLOSE_HOUR: 18,
  SLOT_MINUTES: 30
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

  var today = new Date();
  var todayStr = today.toISOString().slice(0, 10);
  dateInput.min = todayStr;

  function pad(n) { return String(n).padStart(2, '0'); }

  function buildSlots(dateStr) {
    var slots = [];
    var d = new Date(dateStr + 'T00:00:00');
    var day = d.getDay(); // 0 = domingo, 6 = sábado
    if (day === 0) return slots; // cerrado domingos
    var closeHour = (day === 6) ? CFG.SATURDAY_CLOSE_HOUR : CFG.CLOSE_HOUR;
    var cursor = CFG.OPEN_HOUR * 60;
    var end = closeHour * 60;
    while (cursor + CFG.SLOT_MINUTES <= end) {
      var h = Math.floor(cursor / 60);
      var m = cursor % 60;
      slots.push(pad(h) + ':' + pad(m));
      cursor += CFG.SLOT_MINUTES;
    }
    return slots;
  }

  function renderSlots(slots, busySet) {
    timeSelect.innerHTML = '';
    if (!slots.length) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Cerrado ese día';
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
    var slots = buildSlots(dateStr);

    if (!CFG.CALENDAR_ENDPOINT) {
      renderSlots(slots, null);
      return;
    }

    renderSlots(slots, null);
    timeSelect.disabled = true;

    var url = CFG.CALENDAR_ENDPOINT + '?action=availability&date=' + encodeURIComponent(dateStr);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var busySet = data && data.busy ? slotsFromBusyRanges(dateStr, data.busy) : new Set();
        renderSlots(slots, busySet);
      })
      .catch(function () {
        renderSlots(slots, null); // si falla la consulta, dejamos todos los horarios habilitados
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
      text: 'Turno en Golden Barbershop — ' + payload.serviceLabel,
      dates: toGCalDate(startDate) + '/' + toGCalDate(endDate),
      details: 'Servicio: ' + payload.serviceLabel + '\nBarbero: ' + payload.barber + (payload.notes ? '\nComentarios: ' + payload.notes : ''),
      location: 'Av. Principal 123, Ciudad'
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var serviceOpt = serviceSelect.options[serviceSelect.selectedIndex];
    var duration = serviceOpt ? parseInt(serviceOpt.getAttribute('data-duration'), 10) || 30 : 30;

    var dateStr = data.get('date');
    var timeStr = data.get('time');
    if (!dateStr || !timeStr) {
      setStatus('Elegí fecha y horario para continuar.', 'error');
      return;
    }

    var start = new Date(dateStr + 'T' + timeStr + ':00');
    var end = new Date(start.getTime() + duration * 60000);

    var payload = {
      name: data.get('name'),
      phone: data.get('phone'),
      email: data.get('email') || '',
      service: data.get('service'),
      serviceLabel: serviceOpt ? serviceOpt.textContent : data.get('service'),
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

    var addToCalUrl = googleCalendarLink(payload, start, end);

    if (!CFG.CALENDAR_ENDPOINT) {
      setTimeout(function () {
        setStatus(
          '¡Listo! Turno registrado en modo demostración (falta vincular Google Calendar — ver SETUP-CALENDAR.md). Te contactamos para confirmar.',
          'success'
        );
        submitBtn.disabled = false;
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
