# Validación V2.0 — El Arte de Ana Karen

## Regla de salida

Una versión no se considera candidata a producción mientras cualquier validación automática esté pendiente o falle. El workflow de publicación ejecuta nuevamente la batería antes de desplegar y el job `deploy` depende del job `validar`.

## Validaciones de código y release

- Sintaxis de todos los archivos JavaScript mediante `scripts/check-syntax.cjs`.
- Integridad de los recursos cargados por `index.html`.
- Existencia de todos los recursos declarados en `APP_SHELL`.
- Precache de módulos de pagos, resumen financiero, workflow e integridad de pedidos.
- Caché propia de la aplicación con prefijo `ana-karen-` y versión `ana-karen-v25`.
- Eliminación limitada a cachés antiguas de esta aplicación, sin borrar cachés ajenas del mismo origen.
- Manifest PWA con `id`, `start_url`, `scope`, modo standalone e idioma `es-MX`.
- Metadatos para instalación como web app en iPhone/iPad.
- Publicación automática limitada a `main`.

## Pruebas unitarias

- Motor de precios y redondeo.
- Dominio de pagos.
- Persistencia y validación del ledger.
- Protección de datos corruptos o esquemas incompatibles.

## Pruebas E2E

La batería Playwright cubre, entre otros, estos escenarios:

- inicio limpio y navegación móvil;
- creación de cliente;
- preparación de fotografía de referencia y cotización;
- persistencia de pedidos;
- registro de anticipo, abonos y pago final;
- corrección/reversión de pagos sin borrar el original;
- resumen financiero calculado desde movimientos reales;
- bloqueo de avances cuando no existe el pago exigido;
- flujo completo hasta Entregada y Seguimiento al cliente;
- respaldo V2, restauración, rollback y datos dañados;
- operación offline con clientes, pedidos, pagos, correcciones y resumen;
- actualización de caché PWA conservando cachés ajenas;
- protección contra eliminación de pedidos con historial;
- bloqueo de edición retroactiva cuando ya existen pagos;
- bloqueo de pagos nuevos en pedidos cancelados;
- fechas de pago/corrección no posteriores al día actual.

## Navegadores móviles

Las pruebas E2E se ejecutan en dos proyectos:

- Chromium móvil con perfil Pixel 5.
- WebKit móvil con perfil iPhone 13.

La prueba offline que depende del Service Worker debe mantenerse compatible con la capacidad del motor de pruebas; cualquier excepción específica de plataforma debe documentarse y no puede utilizarse para omitir el resto del flujo funcional en WebKit.

## Datos persistentes respaldados

El respaldo V2 protege exactamente estas claves:

- `ak-settings-v1`
- `ak-clients-v1`
- `ak-quotes-v1`
- `ak-promotions-v1`
- `ak-followups-v1`
- `ak-payments-ledger-v1`

La restauración exige formato y versión válidos, vista previa, confirmación y respaldo de seguridad previo. Si alguna escritura falla, se revierte el conjunto completo.

## Producción

GitHub Pages publica desde `main`. Antes de desplegar se instalan Chromium y WebKit y se ejecutan sintaxis, integridad de release, pruebas unitarias y Playwright completo. Si alguna validación falla, el despliegue no se ejecuta.

## Criterios para V2.0

Para promover V2.0 se requiere:

1. CI verde en la candidata final.
2. `main` sin divergencias inesperadas respecto de la base estable.
3. respaldo explícito de la versión estable anterior antes del cambio de `main`.
4. despliegue de GitHub Pages concluido correctamente.
5. comprobación posterior de que producción sirve la nueva versión por HTTPS.
