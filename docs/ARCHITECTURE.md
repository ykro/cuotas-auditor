# Arquitectura Tecnica y Modelo Matematico — Cuotas Auditor GT

## 1. Hallazgos en el DOM Real de Comercio Electronico en Guatemala

### 1.1 Modo A: Elektra Guatemala (`elektra.com.gt`) y Prestamo Banco Azteca
En las fichas de producto de `elektra.com.gt` el comprador visualiza tres cifras:
1. **Precio Normal / Lista tachado** (ancla psicologica, ej. `Q8,999.00` en Smart TV LG 65" `65NU850BPSA` o `Q15,599.00` en iPhone 17 Pro Max 256GB).
2. **Precio Oferta / Contado** (`Q4,195.00` en la TV, `Q12,995.00` en el iPhone, `Q8,895.00` en el Samsung S25 Ultra).
3. **Abono Semanal fijo** (`Q71.00/semana` en la TV, `Q259.00/semana` en el iPhone, `Q155.00/semana` en el S25 Ultra) mas un checkbox opcional para **Garantia Extendida Milenia**.

El numero de semanas del contrato permanece oculto detras de un flujo que solicita DPI, numero celular y validacion OTP por SMS. Para resolver esta asimetria de informacion antes de entregar datos personales, `src/engine/creditAudit.ts` calcula:
- **Semanas de Equilibrio de Capital**:
  $$W_{\text{eq}} = \frac{P_{\text{contado}}}{A_{\text{semanal}}}$$
  En el caso de la TV LG 65" (`Q4,195 / Q71`), $W_{\text{eq}} = 59.08$ semanas. Cualquier semana pagada por encima de la semana 59.08 corresponde exclusivamente a intereses y recargos.
- **Matriz de Plazos Estandar de Banco Azteca (`52, 78, 104, 128, 154 semanas`)**:
  Para cada plazo $W \in \{52, 78, 104, 128, 154\}$, construye el vector de flujos $[+P_{\text{contado}}, -A_{\text{semanal}}, \dots, -A_{\text{semanal}}]$, resuelve la TIR semanal $r_w$ y compone a 52 semanas por ano:
  $$\text{TEA}_{\text{semanal}} = (1 + r_w)^{52} - 1$$

### 1.2 Modo B: Tiendas MAX (`max.com.gt`) — Precio Regular vs. Precio de Oferta
En `max.com.gt`, articulos como el Samsung Galaxy A37 5G muestran `Precio Regular` (`Q3,695.00`) frente a `Precio de Oferta` (`Q2,996.00`, `-19%`) y la opcion de agregar `Seguro Facil` (`Q35.00/mes`). Si el comercio aplica las 12 o 18 cuotas sobre el `Precio Regular` en lugar del `Precio de Oferta`, el comprador pierde `Q699.00` de descuento de contado inmediato, lo cual equivale matematicamente a un interes implicito que eleva la TEA por encima del 45% anual (y a 72.64% TEA al sumar el seguro mensual).

---

## 2. Solver Determinista Newton-Raphson con Salvaguarda de Biseccion

Dado el vector de flujos periodicos $\mathbf{CF} = [CF_0, CF_1, \dots, CF_N]$ con $CF_0 = P_{\text{contado}} - C_{\text{apertura}} > 0$ y $CF_t < 0$ para $t \ge 1$, la Tasa Interna de Retorno periodica $r_p$ satisface:

$$\text{VPN}(r_p) = \sum_{t=0}^{N} \frac{CF_t}{(1 + r_p)^t} = 0$$

El motor (`solveMonthlyIRR` / `solvePeriodicIRR`) itera mediante Newton-Raphson:

$$r_{k+1} = r_k - \frac{\text{VPN}(r_k)}{\text{VPN}'(r_k)}, \quad \text{VPN}'(r) = -\sum_{t=1}^{N} \frac{t \cdot CF_t}{(1 + r)^{t+1}}$$

con tolerancia $|\text{VPN}(r_p)| < 10^{-11}$ y fallback automatico al metodo de biseccion en $[-0.9, 25.0]$ si la derivada se acerca a cero o la iteracion sale del dominio.

---

## 3. Identidad Contable del Sobrecosto al Centavo

En todos los modos de auditoria se verifica por pruebas unitarias (`tests/creditAudit.test.ts`) la identidad exacta al centavo:

$$\text{TotalPagadoReal} - \text{CapitalEfectivoRecibido}_{t=0} = \text{InteresExplicito} + \text{DescuentoContadoPerdido} + \text{SegurosAcumulados} + \text{ComisionesMasIVA}$$

---

## 4. Modelo de Datos en Cloud Firestore

### 4.1 Coleccion `prototype_feedback`
Almacena la evaluacion de testers desde el recorrido guiado (`/?guia=1`) cumpliendo las reglas de seguridad del proyecto:
- `prototypeId`: `'cuotas-auditor'`
- `q1Rating`: `number` (escala `1..5`)
- `q2Clarity`: `'Muy claro' | 'Algo confuso' | 'No lo entendi'`
- `q3WouldUse`: `'Si, definitivo' | 'Tal vez' | 'No'`
- `openSuggestion`: `string`
- `testerUid`: `string`
- `testerEmail`: `string`
- `createdAt`: `Timestamp`
- `contextMeta`: `string`

### 4.2 Subcoleccion `users/{uid}/credit_audits/{auditId}`
Guarda las auditorias ejecutadas por cada usuario autenticado (Google Sign-In o sesion anonima de prueba rapida).


## Regional offer consultant (2026-11-03)

The active UI uses `src/engine/offerConsultant.ts`. It compares cash price to down payment + upfront extra fees + count × (quoted installment + extra periodic fees). Unknown charges remain explicitly unconfirmed. Explicit fees are not dismissed as rounding. The old `creditAudit.ts` engine remains for regression verification.

`assessPaymentRoom` derives a payment floor and an adjustable reserve scenario (default25%, not a statutory or bank affordability threshold). Q183.11 ×1.25 is rounded upward toQ228.89. A weekly plan shows five-payment months and never assumes more payments than its term. The optional budget is calculated in the browser; income, expenses and free-budget fields are not persisted in the saved offer or feedback payload. The primary reference uses budgetDecision.ts and never approves a loan.

`server.mjs` detects supported currencies and returns generic amount names and detected market. GTQ compatibility fields are retained during rollout. USD maps to Panama as a supported reference market, not a geographic assertion. UNKNOWN requires local confirmation without reprocessing the photo; unsupported or mismatched currencies are rejected. No currency conversion takes place.

Photo latency work: 1200px long-edge JPEG0.78, short extraction-only prompt, low thinking, 1400-token cap,22s provider deadline,26s UI deadline and manual fallback. Up to four extracted results are reused only in current component/session memory via a digest; no image is persisted by this cache. External auth/storage code is loaded only on save/feedback.

Country notes link to issuer documentation. Colombia one-installment grace periods have exceptions. Panama BAC Tasa Cero is not exclusive; Banesco also publishes a0% installment program. BAC's calculator and linked regulation differ on current administrative-fee language, so the app asks to confirm the current tariff instead of applying a guessed fee.
