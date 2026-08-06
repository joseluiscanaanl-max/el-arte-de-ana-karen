# El Arte de Ana Karen — MVP 0.1

Aplicación móvil instalable (PWA) para ayudar a Ana Karen a calcular precios, preparar cotizaciones, dar seguimiento a clientes y crear contenido promocional para Instagram y TikTok.

## Funciones incluidas

- Cálculo de materiales, mano de obra, gastos indirectos, empaque y envío.
- Ajustes por personas adicionales, mascotas, fondo detallado y trabajo urgente.
- Cálculo correcto del precio usando margen sobre venta.
- Anticipo y saldo automáticos.
- Cotizaciones listas para compartir por WhatsApp.
- Registro de clientes y sus preferencias.
- Seguimiento del estado de cada encargo.
- Generador de textos, ideas de video y hashtags.
- Respaldo de la información en formato JSON.
- Datos de ejemplo para probar el flujo.
- Funcionamiento sin conexión después de instalarse.
- Sin servidor ni cuenta de usuario en esta primera versión.

## Fórmula principal

```text
Costo total = materiales + mano de obra + empaque + envío + indirectos + complejidad + urgencia
Precio sugerido = costo total / (1 - margen deseado)
```

El resultado se redondea hacia arriba a múltiplos de $50 MXN.

## Probar en una computadora

Este proyecto no necesita instalar paquetes. Solo debe servirse mediante un servidor web local.

Con Python:

```bash
python3 -m http.server 4173
```

Después, abrir:

```text
http://localhost:4173
```

## Publicación

El proyecto ya incluye:

- `.github/workflows/pages.yml` para publicar automáticamente con GitHub Pages.
- `.nojekyll` para servir todos los archivos sin transformaciones.
- `vercel.json` para desplegarlo directamente en Vercel.

Al abrir la dirección HTTPS desde el teléfono, el navegador permitirá agregar la aplicación a la pantalla de inicio.

## Privacidad de esta versión

Los datos se guardan en `localStorage`, exclusivamente en el navegador del dispositivo. Para evitar pérdida de información, la aplicación incluye la opción **Descargar respaldo**.

## Archivos principales

- `index.html`: entrada de la aplicación.
- `app.js`: pantallas, clientes, pedidos, cotizaciones y promoción.
- `pricing.js`: motor de cálculo de precios.
- `styles.css`: diseño móvil.
- `manifest.webmanifest`: instalación como PWA.
- `sw.js`: funcionamiento sin conexión.
- `tests/pricing.test.js`: pruebas del motor de precios.

## Estado

MVP funcional 0.1 validado y preparado para publicación. La siguiente etapa es crear el repositorio remoto, activar GitHub Pages o conectarlo a Vercel, probarlo con Ana Karen y ajustar los valores predeterminados según sus materiales, tiempos reales y tipo de obra.

## Actualización 0.3: JoCe e identidad oficial

La aplicación integra el logotipo oficial de El Arte de Ana Karen y una paleta visual basada en púrpuras, rosas y magentas. JoCe aparece como ayudante en Inicio y Promover para mostrar frases motivacionales, recomendaciones según la etapa del encargo e ideas promocionales.

El seguimiento utiliza 16 estados en orden lógico: Borrador, Cotización enviada, Esperando aprobación de cotización, Esperando anticipo, Anticipo recibido, Boceto en proceso, Esperando aprobación del boceto, Boceto aprobado, Pintura en proceso, Obra terminada, Esperando saldo, Pago completo, Lista para entregar, Entregada, Seguimiento al cliente y Cancelada.
