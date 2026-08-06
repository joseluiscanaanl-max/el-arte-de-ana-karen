# Validación del MVP 0.1

## Comprobaciones realizadas

- Sintaxis de `app.js`: aprobada con `node --check`.
- Sintaxis de `pricing.js`: aprobada con `node --check`.
- Pruebas del motor de precios: aprobadas.
- Ejemplo validado:
  - Materiales: $900
  - Mano de obra: $1,800
  - Empaque: $200
  - Gastos indirectos: 10%
  - Costo total: $3,190
  - Margen: 35%
  - Precio sugerido redondeado: $4,950
  - Anticipo redondeado: $2,500
  - Saldo: $2,450
- Prueba de incremento por urgencia: aprobada.
- Prueba de incremento por complejidad: aprobada.
- Disponibilidad de archivos mediante servidor HTTP local: aprobada.

## Nota

La captura automática con Chromium no pudo completarse por una limitación del navegador sin interfaz disponible en el entorno de ejecución. Esto no afectó las pruebas de sintaxis, lógica de precios ni disponibilidad de archivos.

## Actualización 0.3 — Identidad visual y JoCe

- Logotipo oficial incorporado en encabezado, inicio e icono instalable.
- Paleta púrpura, rosa y magenta aplicada conforme al logotipo.
- Lista de estados ordenada en 16 etapas lógicas, desde Borrador hasta Seguimiento o Cancelada.
- JoCe incorporado como ayudante con frases motivacionales.
- JoCe ofrece sugerencias relacionadas con la etapa actual del encargo.
- JoCe genera ideas promocionales y permite cambiar de sugerencia.
- Validación de sintaxis de app.js y sw.js aprobada.
- Pruebas del motor de precios aprobadas.
