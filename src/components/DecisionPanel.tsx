import { useState } from 'react';
import { assessBudgetDecision, type DecisionStatus, type MonthlyBudget } from '../engine/budgetDecision.ts';
import { analyzeCommitment, formatMarketMoney, MARKETS, type CommitmentInput } from '../engine/offerConsultant.ts';

const titles: Record<DecisionStatus, string> = {
  'invalid-offer': 'Revisa los montos',
  'budget-missing': 'Falta revisar tu presupuesto',
  'does-not-fit': 'Esta cuota no cabe en tu presupuesto',
  'conditions-pending': 'El presupuesto alcanza; faltan condiciones',
  'initial-pending': 'Falta cubrir el pago inicial',
  'fits': 'La cuota cabe con los datos que indicaste',
};

/** Budget lives only in this mounted panel; offer saving and downloads never receive it. */
export function DecisionPanel({ input, onReview }: { input: CommitmentInput; onReview: () => void }) {
  const [budget, setBudget] = useState<MonthlyBudget>({ income: null, expenses: null, otherDebt: null });
  const [debtCap, setDebtCap] = useState(.3);
  const [reservePct, setReservePct] = useState(25);
  const [fundedInitialAmount, setFundedInitialAmount] = useState<number | null>(null);
  const offer = analyzeCommitment(input);
  const initialFunded = fundedInitialAmount === offer.initial;
  const decision = assessBudgetDecision(input, budget, { debtCap, reservePct, initialFunded });
  const money = (amount: number) => formatMarketMoney(amount, input.country);
  const difference = `${offer.difference > 0 ? '+' : offer.difference < 0 ? '−' : ''}${money(Math.abs(offer.difference))}`;
  const hasBudget = decision.headroom !== null;
  const fitsButCostsMore = decision.status === 'fits' && offer.kind === 'surcharge';
  const fitsButVerifyDiscount = decision.status === 'fits' && offer.kind === 'discount';
  const field = (key: keyof MonthlyBudget, label: string) => {
    const value = budget[key];
    const invalid = value !== null && (!Number.isFinite(value) || value < 0 || (key === 'income' && value === 0));
    return <div className="field-wrap"><label htmlFor={`budget-${key}`}>{label} ({MARKETS[input.country].unit})</label><input id={`budget-${key}`} className="clean-input" type="number" min={key === 'income' ? .01 : 0} step="0.01" inputMode="decimal" value={value ?? ''} placeholder={key === 'income' ? 'Tu ingreso mensual' : '0 si no aplica'} aria-invalid={invalid} aria-describedby={invalid ? `budget-${key}-error` : undefined} onChange={event => setBudget(previous => ({ ...previous, [key]: event.target.value === '' ? null : Number(event.target.value) }))} />{invalid && <p id={`budget-${key}-error`} className="field-error">{key === 'income' ? 'Ingresa un ingreso mayor que cero.' : 'Ingresa cero o un monto mayor.'}</p>}</div>;
  };
  if (!offer.complete) return null;
  return <section className="decision-panel" aria-label="Decisión de compra">
    <div className="income-reference" aria-label="Sugerencia mensual">
      <h2>Ingreso mensual de referencia</h2>
      <p className="income-reference-amount">{money(decision.referenceIncome)}<span> / mes</span></p>
      <p className="income-reference-summary">{input.frequency === 'mensual' ? `Para asumir ${money(decision.monthlyCommitment)} al mes en cuotas.` : `Para asumir hasta ${money(decision.monthlyCommitment)} en un mes de más pagos.`}</p>
      <p className="income-reference-note">{hasBudget ? 'Estimación con tu presupuesto y el respaldo elegido.' : `Referencia con los datos indicados: cuotas hasta el ${Math.round(debtCap * 100)}% del ingreso neto. Ajusta gastos y deudas abajo.`}</p>
      {!offer.conditionsComplete && <p className="reference-provisional">Provisional: faltan condiciones por confirmar.</p>}
    </div>
    <details className="decision-details"><summary>Revisar oferta y presupuesto</summary>
    <dl className="decision-kpis">
      <div><dt>Total a pagar</dt><dd>{money(offer.total)}</dd><small>{offer.conditionsComplete ? 'Con los cargos indicados' : 'Provisional: faltan condiciones'}</small></div>
      <div><dt>Compromiso mensual</dt><dd>{money(decision.monthlyCommitment)}</dd><small>{input.frequency === 'mensual' ? `${input.count} pagos mensuales` : `Hasta ${Math.min(input.count, input.frequency === 'semanal' ? 5 : 2)} pagos en un mes`}</small></div>
      <div><dt>{offer.conditionsComplete ? 'Diferencia vs. contado' : 'Diferencia provisional'}</dt><dd>{difference}</dd><small>{offer.kind === 'rounding' ? 'Compatible con redondeo' : `Contado publicado: ${money(input.cashPrice)}`}</small></div>
    </dl>
    <p className="commitment-line">{input.count} pagos de <strong>{money(offer.periodic)}</strong> · {offer.duration}{offer.initial > 0 && <> · <strong>{money(offer.initial)} al inicio</strong></>}</p>
    <div className={`purchase-decision decision-${fitsButCostsMore ? 'extra-cost' : fitsButVerifyDiscount ? 'verify-discount' : decision.status}`} role="status">
      <h2>{fitsButCostsMore ? 'Cabe en tu presupuesto, pero cuesta más' : fitsButVerifyDiscount ? 'Cabe en tu presupuesto; verifica ambos precios' : titles[decision.status]}</h2>
      <p>{decision.status === 'does-not-fit' ? decision.headroom! < 0 ? `Faltan ${money(-decision.headroom!)} al mes para cubrir gastos, deudas y el respaldo elegido.` : `Tus pagos de deuda superan el ${Math.round(debtCap * 100)}% del ingreso neto elegido como límite.`
        : decision.status === 'fits' ? fitsButCostsMore ? `El contado ahorra ${money(offer.difference)}.` : fitsButVerifyDiscount ? 'El total indicado es menor: confirma que sean el mismo producto y presentación.' : 'Puedes considerar las cuotas sin usar el dinero de tus gastos y ahorro.'
        : decision.status === 'conditions-pending' ? 'Confirma que contado y cuotas incluyan los mismos impuestos y cargos antes de comprometerte.'
        : decision.status === 'initial-pending' ? `Separa ${money(offer.initial)} antes de comenzar, sin financiar ese pago con otra deuda.`
        : 'Agrega ingreso, gastos y otras deudas para ver si la cuota cabe.'}</p>
    </div>
    <p className="decision-qualification">{!offer.conditionsComplete && 'Confirma impuestos y cargos en ambos precios. '}Escenario orientativo; no es aprobación de crédito ni garantía de pago.</p>
    {!offer.conditionsComplete && <button type="button" className="confirm-offer-btn" onClick={onReview}>Confirmar montos y cargos</button>}
    <details className="budget-editor"><summary>{hasBudget ? 'Ajustar mi presupuesto' : 'Revisar mi presupuesto (opcional)'}</summary>
      <p className="budget-privacy">Solo en esta pantalla. No se guardan ni se descargan estos datos.</p>
      <div className="budget-grid">{field('income', 'Ingreso mensual neto')}{field('expenses', 'Gastos esenciales y ahorro al mes')}{field('otherDebt', 'Pagos mensuales de otras deudas')}</div>
      <p className="budget-helper">Separa gastos y deudas: no cuentes un mismo pago dos veces.</p>
      {offer.initial > 0 && <label className="terms-confirm"><input type="checkbox" checked={initialFunded} onChange={event => setFundedInitialAmount(event.target.checked ? offer.initial : null)} /><span>Tengo {money(offer.initial)} para el inicio, aparte del presupuesto mensual y sin pedir otra deuda.</span></label>}
      <button type="button" className="text-link-btn" onClick={() => { setBudget({ income: null, expenses: null, otherDebt: null }); setFundedInitialAmount(null); }}>Borrar mi presupuesto</button>
    </details>


    <div className="budget-targets">
      <p><span>{hasBudget ? 'Ingreso necesario en este escenario' : 'Ingreso de referencia · completa tu presupuesto'}</span><strong>Desde {money(decision.referenceIncome)} / mes</strong><span className="reference-assumption">Deudas ≤ {Math.round(debtCap * 100)}% del neto + respaldo del {reservePct}% de esta cuota.</span>{!hasBudget && <span className="reference-assumption">Incluye los gastos y otras deudas que ya ingresaste; los campos vacíos se estiman en cero.</span>}</p>
      {decision.expenseCap !== null && <p><span>Tope de gastos y ahorro con esta cuota</span><strong>{decision.expenseCap < 0 ? 'No queda margen para gastos' : `${money(decision.expenseCap)} / mes`}</strong>{input.frequency === 'semanal' && decision.weeklyExpenseCap! >= 0 && <span className="weekly-spending"><strong>{money(decision.weeklyExpenseCap!)} / semana</strong>Tope semanal · mes de 5 semanas</span>}</p>}
    </div>
    <details className="scenario-details"><summary>Supuestos y referencia del cálculo</summary>
      <div className="scenario-controls"><label>Límite de pagos de deuda<select value={debtCap} onChange={event => setDebtCap(Number(event.target.value))}><option value="0.3">30% del ingreso neto</option><option value="0.2">20% del ingreso neto</option></select></label><label>Respaldo extra sobre esta cuota<select value={reservePct} onChange={event => setReservePct(Number(event.target.value))}>{[0, 10, 25, 50].map(value => <option key={value} value={value}>{value}%</option>)}</select></label></div>
      <p>Usamos el mayor de dos requisitos: ingresos para mantener todas las deudas bajo el {Math.round(debtCap * 100)}%, e ingresos para pagar gastos, ahorro, deudas y {money(decision.reserve)} de respaldo mensual. El respaldo es ajustable; no es un cargo del banco.</p>
      <p>Semanas: hasta cinco pagos por mes; quincenas: hasta dos, sin exceder el plazo. El pago inicial se cubre aparte. Si tus ingresos cambian, usa un mes difícil.</p>
      <p>La <a href="https://www.condusef.gob.mx/?idc=2744&idcat=3&p=contenido" target="_blank" rel="noreferrer">CONDUSEF propone hasta 30% del ingreso neto para pagar deudas</a>. Es una referencia educativa de México, no una regla bancaria de {MARKETS[input.country].name}. Fuente consultada el 4 de noviembre de 2026.</p>
    </details>
    </details>
  </section>;
}
