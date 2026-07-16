# Cobrar una seña con Mercado Pago

El sitio funciona sin esto (no se ofrece pagar seña, solo se agenda el turno).
Para habilitarlo, seguí estos pasos una única vez. **Necesitás tener conectado
primero Google Calendar** (ver [`SETUP-CALENDAR.md`](SETUP-CALENDAR.md)), porque
el pago usa el mismo Web App de Apps Script como puente.

## 0. Antes de empezar: revisá los precios

Los precios que trae el sitio de ejemplo ($18, $25, $35, etc., en `index.html`)
son valores de plantilla en dólares. Antes de cobrar de verdad, reemplazalos por
precios reales en pesos argentinos:

- En cada `<option>` del selector de servicio (`data-price="18"` y el texto `$18`).
- En las tarjetas de servicio de la sección de precios, si querés mantenerlas
  coherentes con el formulario.

## 1. Crear tu cuenta en Mercado Pago Developers

1. Entrá a [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers/panel)
   con la cuenta de Mercado Pago **donde querés recibir los pagos**.
2. Si todavía no tenés cuenta de Mercado Pago, creála primero en
   [mercadopago.com.ar](https://www.mercadopago.com.ar).

## 2. Crear una aplicación

1. En el panel de developers, "Tus integraciones" → "Crear aplicación".
2. Ponele un nombre (ej. "Golden Barbershop Turnos").
3. Cuando te pregunte qué producto vas a integrar, elegí **Checkout Pro**.
4. No hace falta configurar nada más de código en este paso — nosotros ya
   dejamos el código listo en `apps-script/Code.gs`.

## 3. Obtener las credenciales de PRUEBA

1. Dentro de tu aplicación, andá a **"Credenciales de prueba"**.
2. Copiá el **Access Token de prueba** (empieza con `TEST-...`). Lo vas a
   necesitar en el paso siguiente. Guardalo en un lugar seguro por ahora.

No hace falta el "Public Key" para esta integración (el sitio no usa el SDK de
Mercado Pago en el navegador, solo redirige a la página de pago).

## 4. Guardar el Access Token en Apps Script (nunca en el código)

⚠️ **Importante**: a diferencia del token de Calendar (`SCRIPT_SECRET`), el
Access Token de Mercado Pago permite crear cobros y ver tus ventas. **No lo
pegues nunca en `Code.gs`** ni lo subas a GitHub. Va en un lugar separado,
pensado justamente para secretos:

1. Abrí tu proyecto de Apps Script (el mismo que ya usás para Calendar, en
   [script.google.com](https://script.google.com)).
2. Ícono de engranaje en el panel izquierdo: **"Configuración del proyecto"**.
3. Bajá hasta **"Propiedades de secuencia de comandos"** → **"Añadir propiedad
   de script"**.
4. Propiedad: `MP_ACCESS_TOKEN` — Valor: pegá el Access Token de prueba
   (`TEST-...`) que copiaste en el paso 3.
5. Guardar.

## 5. Actualizar el código de Code.gs

1. Volvé al editor del proyecto (ícono `< >`).
2. Reemplazá todo el contenido por el de [`apps-script/Code.gs`](apps-script/Code.gs)
   de este repositorio (ya incluye la lógica de Mercado Pago).
3. Guardá.

## 6. Volver a implementar el Web App

Igual que cuando actualizaste el código de Calendar:

**Implementar → Administrar implementaciones → lápiz (editar) → Nueva versión
→ Implementar.**

Si es la primera vez que hacés esto en este proyecto, seguí el punto 2 de
[`SETUP-CALENDAR.md`](SETUP-CALENDAR.md) para publicarlo como Web App por
primera vez.

## 7. Configurar el porcentaje de seña en main.js

1. Abrí [`main.js`](main.js).
2. Buscá `DEPOSIT_PERCENT: 30` dentro de `window.__BRAND__`.
3. Cambiá el `30` por el porcentaje que quieras cobrar como seña (por ejemplo,
   `50` para la mitad del servicio). Poné `0` para desactivar el cobro de seña
   sin desconectar Mercado Pago.

## 8. Probar en modo sandbox (sin plata real)

Con el Access Token de **prueba** (`TEST-...`) configurado, Mercado Pago te
deja simular pagos con tarjetas de prueba de Argentina:

- **Mastercard**: `5031 7557 3453 0604`, cualquier CVV, vencimiento futuro.
- **Visa**: `4509 9535 6623 3704`, cualquier CVV, vencimiento futuro.
- Nombre del titular: **`APRO`** para que el pago se apruebe, **`OTHE`** para
  simular un rechazo.
- DNI de prueba: `12345678`.

Flujo de prueba:
1. Agendá un turno de prueba en el sitio (fecha y hora futuras).
2. Debería aparecer una caja "Pagar seña con Mercado Pago" con el monto correcto.
3. Hacé clic, completá el checkout con los datos de prueba de arriba.
4. Con `APRO`: te tiene que volver al sitio con un mensaje verde de seña
   acreditada. Con `OTHE`: mensaje rojo de pago no completado.
5. Confirmá en tu Google Calendar que el turno se creó igual, independientemente
   del resultado del pago (así lo diseñamos: el pago es un paso aparte).

## 9. Pasar a producción (cobrar plata real)

1. En Mercado Pago, completá los datos fiscales/bancarios de tu cuenta si
   todavía no lo hiciste (te lo va a pedir la plataforma).
2. En "Credenciales de producción" de tu aplicación, copiá el Access Token
   real (empieza con `APP_USR-...`).
3. Repetí el paso 4: reemplazá el valor de la propiedad `MP_ACCESS_TOKEN` en
   Apps Script por este nuevo token.
4. Volvé a implementar (nueva versión), como en el paso 6.
5. Hacé una prueba real con un monto chico para confirmar que todo funciona
   antes de anunciarlo a tus clientes.

## Seguridad

- El Access Token de Mercado Pago **solo** va en Propiedades de secuencia de
  comandos de Apps Script. Nunca en `Code.gs`, nunca en `main.js`, nunca en
  GitHub.
- Si en algún momento sospechás que se filtró un token, andá a tu aplicación
  en Mercado Pago Developers y regenerá las credenciales — invalida el token
  viejo automáticamente.
