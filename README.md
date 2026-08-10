# El Arte de Ana Karen — V2.0

Aplicación móvil instalable (PWA) para administrar el trabajo artístico de Ana Karen desde la cotización hasta la entrega y el seguimiento posterior, con control de precios, clientes, encargos, pagos reales y respaldo local.

## Funciones principales

- Cálculo de materiales, mano de obra, gastos indirectos, empaque y envío.
- Ajustes por complejidad, personas o mascotas adicionales, fondo detallado y urgencia.
- Precio sugerido calculado con margen sobre venta y redondeo comercial.
- Registro de clientes y datos de contacto.
- Cotizaciones y encargos con flujo de 16 estados, desde Borrador hasta Seguimiento al cliente o Cancelada.
- Cotizaciones listas para compartir por WhatsApp.
- Registro de pagos reales mediante ledger independiente del estado del pedido.
- Anticipos, abonos, pago final, saldo pendiente y resumen financiero calculados desde movimientos reales.
- Correcciones de pagos mediante movimientos reversos, sin borrar el historial original.
- Validaciones financieras que impiden avanzar a producción sin anticipo suficiente o marcar Pago completo sin liquidación real.
- Protección contra eliminación de pedidos con historial y contra edición retroactiva de cotizaciones que ya tienen pagos.
- Pedidos cancelados conservan su historial y no admiten pagos nuevos.
- Fechas de pagos y correcciones limitadas al día actual o fechas anteriores.
- Seguimiento de clientes y promoción para Instagram, TikTok y WhatsApp.
- JoCe como ayudante contextual para fotografía de referencia, lienzo y preparación de la obra.
- Respaldo V2 y restauración con validación, vista previa, copia de seguridad previa y rollback si una escritura falla.
- Funcionamiento offline mediante Service Worker y caché propia `ana-karen-v25`.
- Instalación como PWA en teléfono, incluida configuración para iPhone/iPad.

## Flujo de trabajo

Los estados del encargo son:

1. Borrador
2. Cotización enviada
3. Esperando aprobación de cotización
4. Esperando anticipo
5. Anticipo recibido
6. Boceto en proceso
7. Esperando aprobación del boceto
8. Boceto aprobado
9. Pintura en proceso
10. Obra terminada
11. Esperando saldo
12. Pago completo
13. Lista para entregar
14. Entregada
15. Seguimiento al cliente
16. Cancelada

El estado del pedido no se utiliza como sustituto del dinero recibido. Los controles financieros consultan el ledger real de pagos.

## Fórmula principal de precio

```text
Costo total = materiales + mano de obra + empaque + envío + indirectos + complejidad + urgencia
Precio sugerido = costo total / (1 - margen deseado)
```

El precio sugerido se redondea hacia arriba a múltiplos de $50 MXN.

## Pagos e integridad financiera

Los pagos se guardan en `ak-payments-ledger-v1` como movimientos independientes. Un pago registrado nunca se elimina físicamente para corregirlo: se agrega un movimiento reverso que conserva trazabilidad.

Una cotización que ya tiene movimientos financieros no puede editarse retroactivamente. Si cambian las condiciones comerciales después de recibir dinero, debe conservarse el pedido original y generar una nueva cotización cuando corresponda.

## Respaldo y privacidad

Esta versión no utiliza servidor de aplicación ni cuenta de usuario. Los datos operativos se almacenan en `localStorage` del navegador del dispositivo.

El respaldo V2 exporta de forma explícita los valores persistentes de:

- `ak-settings-v1`
- `ak-clients-v1`
- `ak-quotes-v1`
- `ak-promotions-v1`
- `ak-followups-v1`
- `ak-payments-ledger-v1`

La restauración valida formato y versión, muestra una vista previa, solicita confirmación, crea un respaldo de seguridad y revierte todas las escrituras si alguna falla. Los datos temporales de sesión no se incluyen.

Aunque la aplicación funciona offline, conviene descargar respaldos periódicos porque borrar los datos del navegador o perder el dispositivo puede eliminar la información local.

## Instalación y funcionamiento offline

La aplicación está preparada como PWA con `manifest.webmanifest`, Service Worker y metadatos para iPhone/iPad. Después de una carga correcta por HTTPS puede agregarse a la pantalla de inicio y continuar operando sin conexión con los recursos precacheados.

## Validación automática

GitHub Actions valida cada cambio de V2 antes de incorporarlo a la rama de desarrollo. La batería incluye:

- sintaxis de todo JavaScript;
- integridad de recursos de release y caché offline;
- pruebas del motor de precios;
- pruebas del dominio y persistencia de pagos;
- pruebas E2E de clientes, pedidos, workflow, finanzas, respaldo/restauración y offline;
- ejecución móvil en Chromium;
- ejecución móvil en WebKit con perfil de iPhone.

La publicación desde `main` ejecuta nuevamente la misma validación. El job de despliegue depende del resultado de las pruebas, por lo que GitHub Pages no se actualiza si la validación falla.

## Desarrollo local

Requiere Node.js 20 o superior para las pruebas automatizadas. Para servir la aplicación localmente:

```bash
python3 -m http.server 4173
```

Para instalar dependencias y ejecutar validaciones:

```bash
npm ci
npm run check
npm run test:release
npm run test:e2e
```

## Publicación

Producción se publica desde `main` mediante `.github/workflows/publicar-sitio.yml`. El despliegue solo se ejecuta después de que la validación previa termine correctamente.

La rama `v2-desarrollo` se utiliza para integrar y validar V2 antes de promover una candidata de producción.
