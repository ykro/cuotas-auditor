import { analyzeCommitment, formatMarketMoney, MARKET_GUIDANCE, MARKETS, type CommitmentInput, type Country, validateCommitment } from '../engine/offerConsultant.ts';

export interface OfferTerms {
  downPayment: number;
  upfrontFees: number;
  periodicFees: number;
  feesConfirmed: boolean;
  interest: CommitmentInput['interest'];
  program: 'general' | 'bac' | 'banesco';
}
export const EMPTY_TERMS: OfferTerms = { downPayment: 0, upfrontFees: 0, periodicFees: 0, feesConfirmed: false, interest: 'unknown', program: 'general' };

export function CountryPicker({ country, onChange, disabled = false }: { country: Country; onChange: (value: Country) => void; disabled?: boolean }) {
  return <div className="market-picker" aria-label="País de la oferta">{(Object.keys(MARKETS) as Country[]).map(code =>
    <button type="button" key={code} disabled={disabled} aria-pressed={country === code} onClick={() => onChange(code)}>{MARKETS[code].name}<small>{MARKETS[code].currency}</small></button>
  )}</div>;
}

export function TermsFields({ country, terms, onChange, cashPrice }: { country: Country; terms: OfferTerms; cashPrice: number; onChange: (value: OfferTerms) => void }) {
  const errors = validateCommitment({ country, cashPrice, payment: 1, count: 1, frequency: 'mensual', ...terms });
  const amount = (key: 'downPayment' | 'upfrontFees' | 'periodicFees', label: string) => <div className="field-wrap" key={key}>
    <label htmlFor={`terms-${key}`}>{label} ({MARKETS[country].unit})</label>
    <input id={`terms-${key}`} className="clean-input" aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} type="number" min="0" step="0.01" inputMode="decimal" value={terms[key] || ''} placeholder="0" onChange={e => onChange({ ...terms, [key]: Number(e.target.value) })} />
    {errors[key] && <p className="field-error" id={`error-${key}`}>{errors[key]}</p>}
  </div>;
  return <div className="offer-terms">
    <h3>Completa las condiciones</h3>
    <p className="form-note">Agrega solo cargos que no estén incluidos en la cuota. Dejar un cargo en cero no confirma que no exista.</p>
    <div className="edit-grid edit-grid-four">
      {amount('downPayment', 'Anticipo o pago inicial')}
      {amount('upfrontFees', 'Otros cargos al inicio')}
      {amount('periodicFees', 'Cargo extra por cada pago')}
      <div className="field-wrap"><label htmlFor="terms-interest">Intereses de la oferta</label>
        <select className="clean-input" id="terms-interest" value={terms.interest} onChange={e => onChange({ ...terms, interest: e.target.value as OfferTerms['interest'] })}>
          <option value="unknown">Aún no lo sé</option><option value="advertised_zero">Anuncia 0% de interés</option><option value="included">La cuota ya incluye los intereses</option>
        </select>
      </div>
      {country === 'PA' && <div className="field-wrap"><label htmlFor="terms-program">Programa de la oferta</label><select className="clean-input" id="terms-program" value={terms.program} onChange={e => onChange({ ...terms, program: e.target.value as OfferTerms['program'] })}><option value="general">Otro / no lo sé</option><option value="bac">BAC Tasa Cero en comercio</option><option value="banesco">Banesco Compra a Cuotas</option></select></div>}
    </div>
    <label className="terms-confirm"><input id="terms-confirmed" type="checkbox" checked={terms.feesConfirmed} onChange={e => onChange({ ...terms, feesConfirmed: e.target.checked })} /><span>Confirmé el precio final de contado y cuotas, incluidos impuestos, seguros y manejo, o que no aplican.</span></label>
  </div>;
}

export function CommitmentExplanation({ input, terms }: { input: CommitmentInput; terms: OfferTerms }) {
  const result = analyzeCommitment(input);
  const money = (n: number) => formatMarketMoney(n, input.country);
  if (!result.complete) return null;
  return <details className="commitment-explanation contract-details"><summary>Desglose y condiciones del compromiso</summary>
    <dl className="commitment-rows">
      <div><dt>Al inicio</dt><dd>{money(result.initial)}<small>Anticipo y cargos iniciales indicados</small></dd></div>
      <div><dt>Después</dt><dd>{input.count} pagos de {money(result.periodic)}<small>{result.duration}, con los cargos extra indicados</small></dd></div>
      {input.frequency !== 'mensual' && <div><dt>Equivalente mensual</dt><dd>≈ {money(result.estimatedMonthly)}<small>Referencia promedio; confirma las fechas reales</small></dd></div>}
    </dl>
    <p className="commitment-status">{result.conditionsComplete ? 'Condiciones marcadas como confirmadas por ti.' : 'El total es provisional: todavía hay condiciones sin confirmar.'} No incluye cargos por atraso ni pagos extraordinarios no indicados.</p>
    <details className="contract-details"><summary>Antes de aceptar, pregunta esto</summary>
      <ul>
        {!input.feesConfirmed && <li>¿La cuota incluye todos los seguros, comisiones y manejo? ¿Hay un pago final diferente?</li>}
        {input.interest === 'unknown' && <li>¿La cuota ya incluye los intereses o se agregarán después? No deduzcas tasa cero por el país.</li>}
        {input.interest === 'advertised_zero' && <li>¿Qué debes pagar para conservar el 0%? Confirma si hay cargos aunque la tasa sea cero.</li>}
        <li>¿Cuándo vence el primer pago y cada cuánto vence el siguiente? No estamos fijando fechas por ti.</li>
        <li>¿Qué pasa si te atrasas o pagas solo el mínimo? ¿Cómo se cancela anticipadamente?</li>
        <li>Si usas tarjeta, ¿cuánto cupo ocupa la compra completa y cómo se libera?</li>
      </ul>
    </details>
    {input.country === 'PA' && terms.program === 'bac' && <div className="program-note"><strong>BAC Tasa Cero en comercio</strong><p>El reglamento vinculado exige pagar el mínimo más las cuotas facturadas para conservar el 0%. La compra ocupa el cupo completo y se libera con los pagos. La mora puede eliminar el beneficio; para cancelar anticipadamente, confirma el trámite con el banco.</p></div>}
    <details className="contract-details"><summary>Condiciones en {MARKETS[input.country].name}</summary><p>{MARKET_GUIDANCE[input.country].text}</p>
      {MARKET_GUIDANCE[input.country].sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
      <small>Fuentes consultadas el 3 de noviembre de 2026. Confirma la oferta y el tarifario vigentes.</small>
    </details>
  </details>;
}
