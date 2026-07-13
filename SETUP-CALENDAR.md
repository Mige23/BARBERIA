# Vincular el formulario de turnos con Google Calendar

El sitio ya funciona sin esto (modo demostración), pero para que cada turno
se cree automáticamente en tu Google Calendar real, seguí estos pasos una
única vez. No requiere tarjeta ni costo.

## 1. Crear el script

1. Entrá a [script.google.com](https://script.google.com) con la cuenta de
   Google **donde querés que aparezcan los turnos**.
2. "Proyecto nuevo".
3. Borrá el contenido del editor y pegá el contenido de
   [`apps-script/Code.gs`](apps-script/Code.gs).
4. Guardá el proyecto (por ejemplo, con el nombre "Golden Barbershop Turnos").

## 2. Publicarlo como Web App

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. "Ejecutar como": tu cuenta.
4. "Quién tiene acceso": **Cualquier usuario**.
5. Hacé clic en **Implementar** y autorizá los permisos que pide Google
   (acceso a tu Calendar). Es tu propio script, en tu propia cuenta.
6. Copiá la URL que termina en `/exec`.

## 3. Conectarlo con el sitio

1. Abrí [`main.js`](main.js).
2. Buscá esta línea cerca del principio del archivo:
   ```js
   CALENDAR_ENDPOINT: '',
   ```
3. Pegá tu URL entre las comillas:
   ```js
   CALENDAR_ENDPOINT: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
4. Guardá y volvé a subir el sitio (o refrescá si estás probando en local).

Listo. A partir de ahora:
- Cada turno confirmado crea un evento real en ese Google Calendar.
- Los horarios ya ocupados aparecen bloqueados en el selector de horario.

## 4. (Recomendado) Añadir un token secreto para seguridad

- Elegí un token manualmente (por ejemplo: `mi-token-secreto-1234`).
- En el archivo `apps-script/Code.gs`, reemplazá la variable `SCRIPT_SECRET`
   por ese token.
- En el archivo `main.js`, pegá el mismo token en `CALENDAR_SECRET` dentro
   de `window.__BRAND__`.

Con esto, el Web App rechazará POSTs que no incluyan el token correcto,
evitando que terceros creen eventos en tu calendario.

## Si necesitás volver a implementar (después de editar el código)

Cada vez que cambies `Code.gs`, tenés que hacer **Implementar → Administrar
implementaciones → editar (lápiz) → Nueva versión → Implementar** para que
los cambios se apliquen a la URL ya publicada.

## Barberos / horarios distintos

- Los horarios de atención se configuran en `main.js` (`OPEN_HOUR`,
  `CLOSE_HOUR`, `SATURDAY_CLOSE_HOUR`, `SLOT_MINUTES`).
- Si cada barbero tiene su propio Google Calendar, se puede extender
  `Code.gs` para recibir `data.barber` y elegir el calendario correspondiente
  con `CalendarApp.getCalendarById(...)` en vez de `getDefaultCalendar()`.
