# Cuotas — Entiende tu compromiso de pago

Lee una oferta comercial en foto o recibe montos manuales para comparar el compromiso de pago en Guatemala, Colombia y Panamá. Muestra primero una referencia mensual orientativa con supuestos editables; no aprueba créditos ni garantiza capacidad de pago. Las condiciones ausentes quedan marcadas como pendientes de confirmar.

- [Aplicación en vivo](https://cuotas-auditor-gt.web.app/) · [Guía rápida](https://cuotas-auditor-gt.web.app/?guia=1) · [Dar opinión](https://cuotas-auditor-gt.web.app/?feedback=1)
- [Arquitectura técnica y modelo matemático](docs/ARCHITECTURE.md)

```mermaid
flowchart LR
  UI["Foto de oferta"] --> API["Servidor de lectura"]
  API --> MODEL["Gemini 3.8 Flash"]
  MODEL --> FACTS["Datos publicados o pendientes"]
  FACTS --> ENGINE["Comparación determinista"]
  ENGINE --> UI2["Referencia mensual y condiciones"]
```

```mermaid
flowchart LR
  INPUT["Foto o montos"] --> CURRENCY["Detectar o confirmar divisa"]
  CURRENCY --> CHECK["Validar datos del mismo plan"]
  CHECK --> PARTIAL["Completar solo lo que falta"]
  CHECK --> TOTAL["Sumar pagos y cargos confirmados"]
```

```mermaid
flowchart TD
  TOTAL["Compromiso total"] --> ROUND["Diferencia compatible con redondeo"]
  TOTAL --> EXTRA["Recargo de la oferta"]
  ROUND --> BUDGET["Ingreso orientativo y presupuesto opcional"]
  EXTRA --> BUDGET
  BUDGET --> CONFIRM["Confirmar condiciones antes de decidir"]
```

## Desarrollo y verificación

```sh
npm install
npm test
npm run build
npm run dev
```

La suite ejecuta pruebas unitarias del motor determinista (`src/engine/offerConsultant.ts`, `src/engine/budgetDecision.ts`, `src/engine/creditAudit.ts`) e integración HTTP con respuestas parciales y regionales.
