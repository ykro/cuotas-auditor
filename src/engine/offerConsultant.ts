import { roundCents } from './creditAudit.ts';

export type Country = 'GT' | 'CO' | 'PA';
export type OfferFrequency = 'mensual' | 'quincenal' | 'semanal';
export type InterestCondition = 'unknown' | 'advertised_zero' | 'included';
export const MARKETS = {
  GT: { name: 'Guatemala', currency: 'GTQ', unit: 'Q', locale: 'es-GT', minorUnit: 0.01 },
  CO: { name: 'Colombia', currency: 'COP', unit: 'COP', locale: 'es-CO', minorUnit: 1 },
  PA: { name: 'Panamá', currency: 'USD', unit: 'US$', locale: 'es-PA', minorUnit: 0.01 },
} as const;

export const MARKET_GUIDANCE = {
  GT: {
    text: 'Compara el precio de contado con la suma de todos los pagos. Un plan anunciado sin intereses puede tener seguros o comisiones adicionales.',
    sources: [] as { label: string; url: string }[],
  },
  CO: {
    text: 'Las cuotas no son automáticamente sin intereses. Depende de la tarjeta, el plazo y la promoción; algunas tarjetas cobran incluso a una sola cuota. Revisa también la cuota de manejo y los seguros.',
    sources: [
      { label: 'Bancolombia: cómo funciona la tarjeta', url: 'https://www.bancolombia.com/educacion-financiera/finanzas-personales/como-funciona-tarjeta-de-credito' },
      { label: 'Ejemplo de excepción: American Express Libre', url: 'https://www.bancolombia.com/personas/tarjetas-de-credito/american-express/libre/estacional-personas-tarjeta-credito-amex-tdc' },
    ],
  },
  PA: {
    text: 'BAC Tasa Cero no es la única opción: Banesco también ofrece compras al 0% en comercios afiliados. Las condiciones cambian según banco, tarjeta y comercio. Confirma los cargos vigentes; tasa cero no basta para conocer el costo total.',
    sources: [
      { label: 'BAC: condiciones de Tasa Cero', url: 'https://www.baccredomatic.com/sites/default/files/2026-05/Reglamento_Compra_a_Cuotas_052026.pdf' },
      { label: 'BAC: calculadora y cargos', url: 'https://content.baccredomatic.com/es-pa/aplicaciones/calculadoras/calcular-cuotas-min.html' },
      { label: 'Banesco: compras a cuotas', url: 'https://www.banesco.com.pa/tarjetas/compra-cuotas/' },
    ],
  },
};

export interface CommitmentInput {
  country: Country;
  cashPrice: number;
  payment: number;
  count: number;
  frequency: OfferFrequency;
  downPayment: number;
  upfrontFees: number;
  periodicFees: number;
  feesConfirmed: boolean;
  interest: InterestCondition;
}

export function formatMarketMoney(value: number, country: Country): string {
  const market = MARKETS[country];
  const cents = Math.abs(roundCents(value) - Math.round(value)) > 0.005;
  return `${market.unit} ${value.toLocaleString(market.locale, {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function analyzeCommitment(input: CommitmentInput) {
  const { cashPrice, payment, count, downPayment, upfrontFees, periodicFees } = input;
  const valid = Object.keys(validateCommitment(input)).length === 0;
  const initial = roundCents(downPayment + upfrontFees);
  const periodic = roundCents(payment + periodicFees);
  const total = roundCents(initial + periodic * count);
  const complete = valid && Number.isFinite(total);
  const difference = roundCents(total - cashPrice);
  const tolerance = count * MARKETS[input.country].minorUnit * 0.5;
  const kind = !complete ? 'incomplete' : difference === 0 ? 'equal'
    : Math.abs(difference) <= tolerance && upfrontFees === 0 && periodicFees === 0 ? 'rounding' : difference > 0 ? 'surcharge' : 'discount';
  const duration = `${count} ${input.frequency === 'mensual' ? 'meses' : input.frequency === 'semanal' ? 'semanas' : 'quincenas'}`;
  const conditionsComplete = input.feesConfirmed && input.interest !== 'unknown';
  const title = kind === 'incomplete' ? 'Completa los datos de la oferta'
    : kind === 'surcharge' ? `El compromiso suma ${formatMarketMoney(difference, input.country)} más`
    : kind === 'discount' ? 'El total indicado es menor al contado'
    : kind === 'rounding' ? 'Prácticamente el mismo precio' : 'Mismo precio con los datos indicados';
  let advice = !complete ? 'Necesitamos el precio de contado, el monto de cada pago y el número de pagos. Revisa que el anticipo sea menor al precio y que no haya montos negativos.'
    : kind === 'surcharge' ? 'El contado cuesta menos con estos datos. Para decidir si vale la pena financiar, compara ese costo extra con la ventaja de repartir los pagos.'
    : kind === 'discount' ? 'El total indicado favorece las cuotas. Revisa que ambos precios correspondan al mismo producto y que no falten un anticipo, un pago final o cargos.'
    : 'Por precio, repartir los pagos no agrega un costo relevante con estos datos. Aun así, adquieres una obligación en cada fecha de pago.';
  if (complete && !conditionsComplete) advice += ' Confirma las condiciones pendientes antes de aceptar: el total puede cambiar.';
  return { complete, kind, title, advice, initial, periodic, total, difference, duration, conditionsComplete,
    feesTotal: roundCents(upfrontFees + periodicFees * count),
    estimatedMonthly: roundCents(periodic * (input.frequency === 'mensual' ? 1 : input.frequency === 'quincenal' ? 2 : 52 / 12)),
  };
}

/** A payment floor, not an affordability verdict. The cushion is an explicit user-adjustable scenario. */
export function assessPaymentRoom(input: CommitmentInput, cushionPct = 25) {
  const result = analyzeCommitment(input);
  const safePct = Number.isFinite(cushionPct) ? Math.max(0, Math.min(100, cushionPct)) : 25;
  const ceilMoney = (n: number) => Math.ceil((n - 1e-9) * 100) / 100;
  const perPeriod = result.complete ? result.periodic : 0;
  const monthlyPeak = perPeriod * Math.min(input.count, input.frequency === 'semanal' ? 5 : input.frequency === 'quincenal' ? 2 : 1);
  return { complete: result.complete, minimumPerPeriod: perPeriod, monthlyAverage: result.estimatedMonthly,
    monthlyPeak: ceilMoney(monthlyPeak), cushionPct: safePct,
    cushionPerPeriod: ceilMoney(perPeriod * (1 + safePct / 100)),
    cushionMonthlyPeak: ceilMoney(monthlyPeak * (1 + safePct / 100)) };
}

/** Field-level errors shared by calculation and editing, without assuming unknown fees are zero. */
export function validateCommitment(input: CommitmentInput): Partial<Record<'cashPrice' | 'payment' | 'count' | 'downPayment' | 'upfrontFees' | 'periodicFees', string>> {
  const errors: ReturnType<typeof validateCommitment> = {};
  if (!Number.isFinite(input.cashPrice) || input.cashPrice <= 0) errors.cashPrice = 'Ingresa un precio de contado mayor que cero.';
  if (!Number.isFinite(input.payment) || input.payment <= 0) errors.payment = 'Ingresa un pago mayor que cero.';
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 520) errors.count = 'Ingresa un número entero de pagos entre 1 y 520.';
  if (!Number.isFinite(input.downPayment) || input.downPayment < 0) errors.downPayment = 'El anticipo debe ser cero o mayor.';
  else if (input.cashPrice > 0 && input.downPayment >= input.cashPrice) errors.downPayment = 'El anticipo debe ser menor que el precio de contado.';
  for (const key of ['upfrontFees', 'periodicFees'] as const) if (!Number.isFinite(input[key]) || input[key] < 0) errors[key] = 'El cargo debe ser cero o mayor.';
  return errors;
}
