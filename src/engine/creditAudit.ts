export type CurrencyCode = 'GTQ' | 'USD';

export type OfferType =
  | 'elektra_semanal'
  | 'retail_cuotas'
  | 'extrafinanciamiento_bancario';

export type PaymentFrequency = 'mensual' | 'semanal';

export type AuditVerdictCode =
  | 'PAGAR_CONTADO_ALERTA_RECARGO'
  | 'RECHAZAR_O_RENEGOCIAR_CREDITO'
  | 'TOMAR_CUOTAS_INVERTIR_LIQUIDEZ'
  | 'NEUTRAL_SEGUN_LIQUIDEZ';

export interface CreditOfferInput {
  id?: string;
  titulo: string;
  comercioOEntidad: string;
  tipoOferta: OfferType;
  frecuenciaPago?: PaymentFrequency;
  moneda: CurrencyCode;
  precioListaNominal: number;
  precioContadoEfectivo: number;
  plazoMeses: number;
  plazoSemanas?: number;
  abonoSemanalAnunciado?: number;
  garantiaExtendidaSemanal?: number;
  tasaNominalMensualAnunciadaPct: number;
  recargoCuotasPct: number;
  comisionDesembolsoPct: number;
  comisionDesembolsoFija: number;
  cobroAdministrativoMensual: number;
  seguroMensualFijo: number;
  seguroSaldoDeudorMensualPct: number;
  aplicaIvaSobreInteresesYComisiones: boolean;
  tasaIvaPct: number;
  tasaRendimientoLiquidezAnualPct: number;
  cuotaAnunciadaVendedor?: number;
}

export interface WeeklyTermProjection {
  plazoSemanas: number;
  equivalenteMesesAprox: number;
  abonoSemanalBase: number;
  garantiaSemanal: number;
  abonoSemanalTotal: number;
  totalPagado: number;
  sobrecostoMonto: number;
  sobrecostoPct: number;
  semanasParaCubrirContado: number;
  semanasSoloInteres: number;
  tirSemanal: number;
  tirSemanalPct: number;
  teaEfectivaAnual: number;
  teaEfectivaAnualPct: number;
  vpnEnTir: number;
  esPlazoSeleccionado: boolean;
}

export interface WeeklyElektraAnalysis {
  activo: boolean;
  abonoSemanalBase: number;
  garantiaSemanal: number;
  abonoSemanalTotal: number;
  plazoSemanasAuditado: number;
  semanasEquilibrioCapital: number;
  semanasTrabajandoParaInteres: number;
  descuentoFicticioListaVsContado: number;
  tirSemanal: number;
  tirSemanalPct: number;
  teaCompuesta52SemanasPct: number;
  matrizPlazosAzteca: WeeklyTermProjection[];
}

export interface MonthlyScheduleRow {
  mes: number;
  etiquetaPeriodo?: string;
  cuotaAnunciadaVendedor: number;
  abonoCapitalReal: number;
  interesExplicito: number;
  recargoContadoOculto: number;
  seguroMensual: number;
  comisionAdminMensual: number;
  ivaMensual: number;
  cuotaRealAuditada: number;
  saldoCapitalRealRestante: number;
}

export interface SurchargeBreakdown {
  interesExplicito: number;
  descuentoContadoPerdido: number;
  segurosAcumulados: number;
  comisionesMasIva: number;
  sobrecostoTotal: number;
}

export interface LiquidityAnalysis {
  tasaRendimientoAnualPct: number;
  tasaRendimientoMensualEfectiva: number;
  vpnFinanciamientoAlCostoOportunidad: number;
  rendimientoAcumuladoPorLiquidez: number;
  beneficioNetoTomarCuotas: number;
  descuentoMinimoContadoEquivalenteMonto: number;
  descuentoMinimoContadoEquivalentePct: number;
  precioMaximoContadoParaEmpatar: number;
}

export interface AuditVerdict {
  codigo: AuditVerdictCode;
  severidad: 'alerta' | 'precaucion' | 'optimo';
  titular: string;
  resumenEjecutivo: string;
  recomendacionAccionable: string;
  guionNegociacion: string;
}

export interface CreditAuditResult {
  input: CreditOfferInput;
  frecuenciaEfectiva: PaymentFrequency;
  numeroPeriodos: number;
  capitalEfectivoRecibido: number;
  comisionInicialDescontada: number;
  precioFinanciadoBase: number;
  cuotaMensualAnunciada: number;
  cuotaMensualRealPromedio: number;
  primeraCuotaReal: number;
  totalAnunciadoVendedor: number;
  totalPagadoReal: number;
  cashFlows: number[];
  tirMensual: number;
  tirMensualPct: number;
  tirPeriodica: number;
  tirPeriodicaPct: number;
  tasaNominalAnualAnunciadaPct: number;
  teaEfectivaAnual: number;
  teaEfectivaAnualPct: number;
  brechaOcultaPuntosPct: number;
  vpnEnTir: number;
  desgloseSobrecosto: SurchargeBreakdown;
  analisisLiquidez: LiquidityAnalysis;
  analisisSemanalElektra: WeeklyElektraAnalysis;
  tablaAmortizacion: MonthlyScheduleRow[];
  veredicto: AuditVerdict;
}

export const BANCO_AZTECA_STANDARD_WEEKS = [52, 78, 104, 128, 154] as const;

/**
 * Redondeo financiero determinista a 2 decimales (centavos).
 */
export function roundCents(value: number): number {
  const EPS = 1e-9;
  return Math.round((value + (value >= 0 ? EPS : -EPS)) * 100) / 100;
}

/**
 * Calcula el Valor Presente Neto (VPN / NPV) de un vector de flujos de caja [CF_0, CF_1, ..., CF_N]
 * descontados a la tasa periodica `rate`.
 */
export function computeNPV(cashFlows: readonly number[], rate: number): number {
  if (rate <= -1) {
    return Number.POSITIVE_INFINITY;
  }
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return npv;
}

/**
 * Calcula la derivada d(VPN)/dr respecto a la tasa periodica `rate`.
 */
export function computeNPVDerivative(cashFlows: readonly number[], rate: number): number {
  let dNpv = 0;
  for (let t = 1; t < cashFlows.length; t++) {
    dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
  }
  return dNpv;
}

/**
 * Solver determinista para la Tasa Interna de Retorno (TIR) periodica (mensual o semanal).
 * Utiliza Newton-Raphson de alta precision con salvaguarda automatica de biseccion en intervalo acotado.
 */
export function solveMonthlyIRR(
  cashFlows: readonly number[],
  tolerance = 1e-11,
  maxIterations = 200
): number {
  if (cashFlows.length < 2) {
    throw new Error('Se requieren al menos 2 flujos de caja (t=0 y t>=1).');
  }

  const cf0 = cashFlows[0];
  if (cf0 <= 0) {
    throw new Error('El flujo inicial en t=0 (capital efectivo recibido) debe ser mayor que 0.');
  }

  const totalOutflows = cashFlows.slice(1).reduce((acc, val) => acc + Math.abs(val), 0);
  if (Math.abs(totalOutflows - cf0) < 1e-7) {
    return 0;
  }

  const n = cashFlows.length - 1;
  const avgDuration = (n + 1) / 2;
  let guess = Math.max(-0.5, Math.min(2.0, (totalOutflows / cf0 - 1) / avgDuration));

  for (let iter = 0; iter < maxIterations; iter++) {
    const f = computeNPV(cashFlows, guess);
    if (Math.abs(f) < tolerance) {
      return Math.abs(guess) < 1e-12 ? 0 : guess;
    }

    const df = computeNPVDerivative(cashFlows, guess);
    if (Math.abs(df) < 1e-14) {
      break;
    }

    const nextGuess = guess - f / df;
    if (nextGuess <= -0.95 || nextGuess > 10 || Number.isNaN(nextGuess)) {
      break;
    }

    if (
      Math.abs(nextGuess - guess) < tolerance &&
      Math.abs(computeNPV(cashFlows, nextGuess)) < 1e-8
    ) {
      return Math.abs(nextGuess) < 1e-12 ? 0 : nextGuess;
    }
    guess = nextGuess;
  }

  let low = -0.9;
  let high = 5.0;
  let fLow = computeNPV(cashFlows, low);
  let fHigh = computeNPV(cashFlows, high);

  if (fLow * fHigh > 0) {
    high = 25.0;
    fHigh = computeNPV(cashFlows, high);
  }

  for (let iter = 0; iter < 300; iter++) {
    const mid = (low + high) / 2;
    const fMid = computeNPV(cashFlows, mid);
    if (Math.abs(fMid) < tolerance || (high - low) / 2 < tolerance) {
      return Math.abs(mid) < 1e-12 ? 0 : mid;
    }
    if (fLow * fMid <= 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  const finalRate = (low + high) / 2;
  return Math.abs(finalRate) < 1e-12 ? 0 : finalRate;
}

export const solvePeriodicIRR = solveMonthlyIRR;

/**
 * Convierte una TIR mensual (r_m) en Tasa Efectiva Anual (TEA = (1 + r_m)^12 - 1).
 */
export function monthlyToEffectiveAnnualRate(monthlyRate: number): number {
  if (Math.abs(monthlyRate) < 1e-12) {
    return 0;
  }
  return Math.pow(1 + monthlyRate, 12) - 1;
}

/**
 * Convierte una TIR semanal (r_w) en Tasa Efectiva Anual compuesta a 52 semanas (TEA = (1 + r_w)^52 - 1).
 */
export function weeklyToEffectiveAnnualRate(weeklyRate: number): number {
  if (Math.abs(weeklyRate) < 1e-12) {
    return 0;
  }
  return Math.pow(1 + weeklyRate, 52) - 1;
}

/**
 * Convierte una tasa efectiva anual en tasa efectiva mensual equivalente.
 */
export function annualToEffectiveMonthlyRate(annualRate: number): number {
  if (Math.abs(annualRate) < 1e-12) {
    return 0;
  }
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Convierte una tasa efectiva anual en tasa efectiva semanal equivalente (52 semanas/ano).
 */
export function annualToEffectiveWeeklyRate(annualRate: number): number {
  if (Math.abs(annualRate) < 1e-12) {
    return 0;
  }
  return Math.pow(1 + annualRate, 1 / 52) - 1;
}

/**
 * Calcula las semanas necesarias de abono semanal para cubrir exactamente el precio de contado a 0% de interes.
 */
export function computeBreakEvenWeeks(precioContado: number, abonoSemanal: number): number {
  if (abonoSemanal <= 0 || precioContado <= 0) {
    return 0;
  }
  return roundCents(precioContado / abonoSemanal);
}

/**
 * Proyecta la matriz de plazos semanales de Banco Azteca / Elektra (52, 78, 104, 128, 154 semanas)
 * dado un precio de contado efectivo y un abono semanal fijo.
 */
export function buildWeeklyTermMatrix(params: {
  precioContadoEfectivo: number;
  abonoSemanalBase: number;
  garantiaSemanal?: number;
  plazoSemanasSeleccionado?: number;
  plazosSemanas?: readonly number[];
}): WeeklyTermProjection[] {
  const precioContado = roundCents(params.precioContadoEfectivo);
  const abonoBase = roundCents(params.abonoSemanalBase);
  const garantia = roundCents(params.garantiaSemanal ?? 0);
  const abonoTotal = roundCents(abonoBase + garantia);
  const plazos = params.plazosSemanas ?? BANCO_AZTECA_STANDARD_WEEKS;
  const seleccionado = params.plazoSemanasSeleccionado ?? 104;

  const semanasEquilibrio = computeBreakEvenWeeks(precioContado, abonoTotal);

  return plazos.map((semanas) => {
    const totalPagado = roundCents(abonoTotal * semanas);
    const sobrecostoMonto = roundCents(totalPagado - precioContado);
    const sobrecostoPct =
      precioContado > 0 ? roundCents((sobrecostoMonto / precioContado) * 100) : 0;

    const flows: number[] = [precioContado];
    for (let w = 1; w <= semanas; w++) {
      flows.push(-abonoTotal);
    }

    const tirSemanal = solvePeriodicIRR(flows);
    const teaEfectivaAnual = weeklyToEffectiveAnnualRate(tirSemanal);
    const vpnEnTir = computeNPV(flows, tirSemanal);
    const semanasSoloInteres = roundCents(Math.max(0, semanas - semanasEquilibrio));

    return {
      plazoSemanas: semanas,
      equivalenteMesesAprox: roundCents(semanas / 4.3333),
      abonoSemanalBase: abonoBase,
      garantiaSemanal: garantia,
      abonoSemanalTotal: abonoTotal,
      totalPagado,
      sobrecostoMonto,
      sobrecostoPct,
      semanasParaCubrirContado: semanasEquilibrio,
      semanasSoloInteres,
      tirSemanal,
      tirSemanalPct: roundCents(tirSemanal * 10000) / 100,
      teaEfectivaAnual,
      teaEfectivaAnualPct: roundCents(teaEfectivaAnual * 100),
      vpnEnTir,
      esPlazoSeleccionado: semanas === seleccionado,
    };
  });
}

/**
 * Calcula la cuota nivelada francesa para un principal nominal, tasa mensual y plazo N.
 */
export function computeFrenchInstallment(
  principal: number,
  monthlyRate: number,
  months: number
): number {
  if (months <= 0) {
    throw new Error('El plazo en meses debe ser mayor que 0.');
  }
  if (Math.abs(monthlyRate) < 1e-12) {
    return principal / months;
  }
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

/**
 * Ejecuta la auditoria financiera completa sobre una oferta de compra a cuotas (semanal Elektra o mensual MAX/retail)
 * o extrafinanciamiento bancario.
 */
export function auditCreditOffer(input: CreditOfferInput): CreditAuditResult {
  const esSemanal =
    input.tipoOferta === 'elektra_semanal' || input.frecuenciaPago === 'semanal';

  const result = esSemanal ? auditWeeklyElektraOffer(input) : auditMonthlyOffer(input);
  const comparison = evaluatePaymentComparison(result.capitalEfectivoRecibido, result.totalPagadoReal / result.numeroPeriodos, result.numeroPeriodos);
  if (comparison.kind === 'rounding') {
    result.veredicto = {
      codigo: 'NEUTRAL_SEGUN_LIQUIDEZ', severidad: 'precaucion',
      titular: 'Prácticamente el mismo precio',
      resumenEjecutivo: 'La diferencia es compatible con el redondeo de cada cuota. Confirma el total final con la tienda.',
      recomendacionAccionable: comparison.recommendation,
      guionNegociacion: '¿Me confirma el total a pagar y si hay comisiones u otros cargos?',
    };
  }
  return result;
}

function auditWeeklyElektraOffer(input: CreditOfferInput): CreditAuditResult {
  const precioContado = roundCents(input.precioContadoEfectivo);
  if (precioContado <= 0) {
    throw new Error('El precio de contado efectivo debe ser mayor que 0.');
  }

  const plazoSemanas = Math.max(
    4,
    Math.round(input.plazoSemanas ?? Math.round(input.plazoMeses * 4.3333) ?? 104)
  );
  const abonoBase = roundCents(
    input.abonoSemanalAnunciado ??
      input.cuotaAnunciadaVendedor ??
      roundCents(precioContado / plazoSemanas)
  );
  const garantiaSemanal = roundCents(input.garantiaExtendidaSemanal ?? input.seguroMensualFijo ?? 0);
  const abonoSemanalTotal = roundCents(abonoBase + garantiaSemanal);

  const comisionInicialDescontada = roundCents(
    precioContado * (input.comisionDesembolsoPct / 100) + input.comisionDesembolsoFija
  );
  const capitalEfectivoRecibido = roundCents(precioContado - comisionInicialDescontada);
  if (capitalEfectivoRecibido <= 0) {
    throw new Error('El capital efectivo recibido debe ser positivo.');
  }

  const totalBaseSemanal = roundCents(abonoBase * plazoSemanas);
  const totalGarantiaSemanal = roundCents(garantiaSemanal * plazoSemanas);
  const totalPagadoReal = roundCents(abonoSemanalTotal * plazoSemanas);

  const diferencialContadoTotal = roundCents(Math.max(0, totalBaseSemanal - precioContado));

  const tablaAmortizacion: MonthlyScheduleRow[] = [];
  const cashFlows: number[] = [capitalEfectivoRecibido];

  const capitalSemanalBase = roundCents(precioContado / plazoSemanas);
  const recargoSemanalBase = roundCents(diferencialContadoTotal / plazoSemanas);

  let acumCapital = 0;
  let acumRecargo = 0;

  for (let sem = 1; sem <= plazoSemanas; sem++) {
    const esUltima = sem === plazoSemanas;
    const abonoCapitalReal = esUltima
      ? roundCents(precioContado - acumCapital)
      : capitalSemanalBase;
    const recargoOculto = esUltima
      ? roundCents(diferencialContadoTotal - acumRecargo)
      : recargoSemanalBase;

    acumCapital = roundCents(acumCapital + abonoCapitalReal);
    acumRecargo = roundCents(acumRecargo + recargoOculto);

    const cuotaRealAuditada = roundCents(abonoCapitalReal + recargoOculto + garantiaSemanal);
    const saldoCapitalRealRestante = roundCents(Math.max(0, precioContado - acumCapital));

    tablaAmortizacion.push({
      mes: sem,
      etiquetaPeriodo: `Sem ${sem}`,
      cuotaAnunciadaVendedor: abonoBase,
      abonoCapitalReal,
      interesExplicito: 0,
      recargoContadoOculto: recargoOculto,
      seguroMensual: garantiaSemanal,
      comisionAdminMensual: 0,
      ivaMensual: 0,
      cuotaRealAuditada,
      saldoCapitalRealRestante,
    });

    cashFlows.push(-cuotaRealAuditada);
  }

  const sobrecostoTotal = roundCents(totalPagadoReal - capitalEfectivoRecibido);
  const desgloseSobrecosto: SurchargeBreakdown = {
    interesExplicito: 0,
    descuentoContadoPerdido: diferencialContadoTotal,
    segurosAcumulados: totalGarantiaSemanal,
    comisionesMasIva: comisionInicialDescontada,
    sobrecostoTotal,
  };

  const tirSemanal = solvePeriodicIRR(cashFlows);
  const teaEfectivaAnual = weeklyToEffectiveAnnualRate(tirSemanal);
  const tirMensualEquivalente = annualToEffectiveMonthlyRate(teaEfectivaAnual);
  const vpnEnTir = computeNPV(cashFlows, tirSemanal);

  const teaEfectivaAnualPct = roundCents(teaEfectivaAnual * 100);
  const tirSemanalPct = roundCents(tirSemanal * 10000) / 100;
  const tirMensualPct = roundCents(tirMensualEquivalente * 10000) / 100;

  // Costo de oportunidad semanal
  const tasaRendimientoSemanal = annualToEffectiveWeeklyRate(
    input.tasaRendimientoLiquidezAnualPct / 100
  );
  let vpAbonosAlCostoOportunidad = 0;
  for (let t = 1; t < cashFlows.length; t++) {
    vpAbonosAlCostoOportunidad += Math.abs(cashFlows[t]) / Math.pow(1 + tasaRendimientoSemanal, t);
  }
  vpAbonosAlCostoOportunidad = roundCents(vpAbonosAlCostoOportunidad);

  const vpnFinanciamientoAlCostoOportunidad = roundCents(
    computeNPV(cashFlows, tasaRendimientoSemanal)
  );
  const descuentoMinimoContadoEquivalenteMonto = roundCents(
    Math.max(0, totalBaseSemanal - vpAbonosAlCostoOportunidad)
  );
  const descuentoMinimoContadoEquivalentePct =
    totalBaseSemanal > 0
      ? roundCents((descuentoMinimoContadoEquivalenteMonto / totalBaseSemanal) * 100)
      : 0;

  const plazosBase = BANCO_AZTECA_STANDARD_WEEKS.includes(plazoSemanas as 52)
    ? [...BANCO_AZTECA_STANDARD_WEEKS]
    : [...BANCO_AZTECA_STANDARD_WEEKS, plazoSemanas].sort((a, b) => a - b);

  const matrizPlazosAzteca = buildWeeklyTermMatrix({
    precioContadoEfectivo: precioContado,
    abonoSemanalBase: abonoBase,
    garantiaSemanal,
    plazoSemanasSeleccionado: plazoSemanas,
    plazosSemanas: plazosBase,
  });

  const semanasEquilibrioCapital = computeBreakEvenWeeks(precioContado, abonoSemanalTotal);
  const semanasTrabajandoParaInteres = roundCents(
    Math.max(0, plazoSemanas - semanasEquilibrioCapital)
  );

  const analisisSemanalElektra: WeeklyElektraAnalysis = {
    activo: true,
    abonoSemanalBase: abonoBase,
    garantiaSemanal,
    abonoSemanalTotal,
    plazoSemanasAuditado: plazoSemanas,
    semanasEquilibrioCapital,
    semanasTrabajandoParaInteres,
    descuentoFicticioListaVsContado: roundCents(
      Math.max(0, input.precioListaNominal - precioContado)
    ),
    tirSemanal,
    tirSemanalPct,
    teaCompuesta52SemanasPct: teaEfectivaAnualPct,
    matrizPlazosAzteca,
  };

  const monedaSimbolo = input.moneda === 'GTQ' ? 'Q' : 'USD ';
  const fmt = (nVal: number) =>
    `${monedaSimbolo}${nVal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const veredicto: AuditVerdict = {
    codigo: sobrecostoTotal > 0 ? 'PAGAR_CONTADO_ALERTA_RECARGO' : 'TOMAR_CUOTAS_INVERTIR_LIQUIDEZ',
    severidad: sobrecostoTotal > 0 ? 'alerta' : 'optimo',
    titular:
      sobrecostoTotal > 0
        ? `ABONO SEMANAL OCULTA ${teaEfectivaAnualPct.toFixed(
            2
          )}% TEA — TRABAJAS ${semanasTrabajandoParaInteres.toFixed(
            1
          )} SEMANAS SOLO PARA INTERESES`
        : 'ABONO SEMANAL A 0.00% TEA — SIN SOBRECOSTO RESPECTO AL CONTADO',
    resumenEjecutivo: `Con abonos de ${fmt(
      abonoSemanalTotal
    )}/semana cubres el precio real de oferta (${fmt(
      precioContado
    )}) en la semana ${semanasEquilibrioCapital.toFixed(
      1
    )}. En un plan de ${plazoSemanas} semanas terminas pagando ${fmt(
      totalPagadoReal
    )} (${fmt(sobrecostoTotal)} de sobrecosto, +${(
      (sobrecostoTotal / precioContado) *
      100
    ).toFixed(1)}%), equivalente a una Tasa Efectiva Anual de ${teaEfectivaAnualPct.toFixed(
      2
    )}% compuesta a 52 semanas.`,
    recomendacionAccionable: `No comprometas tu DPI ni OTP sin exigir el plazo por escrito. Si compras el articulo, pagalo al precio de oferta de contado (${fmt(
      precioContado
    )}) o usa Visacuotas bancarias genuinas sobre el precio de oferta sin Garantia Extendida Milenia.`,
    guionNegociacion: `"El precio de oferta en linea es ${fmt(
      precioContado
    )}. Con abonos semanales de ${fmt(
      abonoSemanalTotal
    )} durante ${plazoSemanas} semanas el total sube a ${fmt(
      totalPagadoReal
    )} (+${fmt(
      sobrecostoTotal
    )}, ${teaEfectivaAnualPct.toFixed(
      2
    )}% TEA anual). Llevo el equipo hoy mismo pagando los ${fmt(
      precioContado
    )} de contado o en cuotas bancarias sin recargo sobre ${fmt(
      precioContado
    )} y sin poliza Milenia."`,
  };

  return {
    input,
    frecuenciaEfectiva: 'semanal',
    numeroPeriodos: plazoSemanas,
    capitalEfectivoRecibido,
    comisionInicialDescontada,
    precioFinanciadoBase: totalBaseSemanal,
    cuotaMensualAnunciada: abonoBase,
    cuotaMensualRealPromedio: abonoSemanalTotal,
    primeraCuotaReal: abonoSemanalTotal,
    totalAnunciadoVendedor: totalBaseSemanal,
    totalPagadoReal,
    cashFlows,
    tirMensual: tirMensualEquivalente,
    tirMensualPct,
    tirPeriodica: tirSemanal,
    tirPeriodicaPct: tirSemanalPct,
    tasaNominalAnualAnunciadaPct: 0,
    teaEfectivaAnual,
    teaEfectivaAnualPct,
    brechaOcultaPuntosPct: teaEfectivaAnualPct,
    vpnEnTir,
    desgloseSobrecosto,
    analisisLiquidez: {
      tasaRendimientoAnualPct: input.tasaRendimientoLiquidezAnualPct,
      tasaRendimientoMensualEfectiva: annualToEffectiveMonthlyRate(
        input.tasaRendimientoLiquidezAnualPct / 100
      ),
      vpnFinanciamientoAlCostoOportunidad,
      rendimientoAcumuladoPorLiquidez: roundCents(
        Math.max(0, totalPagadoReal - vpAbonosAlCostoOportunidad)
      ),
      beneficioNetoTomarCuotas: vpnFinanciamientoAlCostoOportunidad,
      descuentoMinimoContadoEquivalenteMonto,
      descuentoMinimoContadoEquivalentePct,
      precioMaximoContadoParaEmpatar: vpAbonosAlCostoOportunidad,
    },
    analisisSemanalElektra,
    tablaAmortizacion,
    veredicto,
  };
}

function auditMonthlyOffer(input: CreditOfferInput): CreditAuditResult {
  const n = Math.max(1, Math.round(input.plazoMeses));

  const precioContado = roundCents(input.precioContadoEfectivo);
  const precioFinanciadoBase =
    input.recargoCuotasPct > 0 &&
    Math.abs(input.precioListaNominal - input.precioContadoEfectivo) < 0.01
      ? roundCents(precioContado * (1 + input.recargoCuotasPct / 100))
      : roundCents(input.precioListaNominal);

  const diferencialContadoTotal = roundCents(Math.max(0, precioFinanciadoBase - precioContado));

  const comisionInicialDescontada = roundCents(
    precioFinanciadoBase * (input.comisionDesembolsoPct / 100) + input.comisionDesembolsoFija
  );

  const capitalEfectivoRecibido = roundCents(precioContado - comisionInicialDescontada);
  if (capitalEfectivoRecibido <= 0) {
    throw new Error('El capital efectivo recibido despues de comisiones iniciales debe ser positivo.');
  }

  const tasaNominalMensual = input.tasaNominalMensualAnunciadaPct / 100;
  const cuotaNiveladaNominal = computeFrenchInstallment(
    precioFinanciadoBase,
    tasaNominalMensual,
    n
  );

  const seguroPorSaldoDeudor = roundCents(
    precioFinanciadoBase * (input.seguroSaldoDeudorMensualPct / 100)
  );
  const seguroMensualConstante = roundCents(input.seguroMensualFijo + seguroPorSaldoDeudor);
  const adminMensualConstante = roundCents(input.cobroAdministrativoMensual);

  const tablaAmortizacion: MonthlyScheduleRow[] = [];
  const cashFlows: number[] = [capitalEfectivoRecibido];

  let saldoNominalRestante = precioFinanciadoBase;
  let acumuladoCapitalReal = 0;
  let acumuladoRecargoOculto = 0;

  const capitalRealMensualBase = roundCents(precioContado / n);
  const recargoOcultoMensualBase = roundCents(diferencialContadoTotal / n);

  for (let mes = 1; mes <= n; mes++) {
    const esUltimoMes = mes === n;

    let interesExplicitoMes = 0;
    let abonoCapitalNominalMes = 0;

    if (tasaNominalMensual > 0) {
      interesExplicitoMes = roundCents(saldoNominalRestante * tasaNominalMensual);
      if (esUltimoMes) {
        abonoCapitalNominalMes = roundCents(saldoNominalRestante);
      } else {
        abonoCapitalNominalMes = roundCents(
          roundCents(cuotaNiveladaNominal) - interesExplicitoMes
        );
      }
      saldoNominalRestante = roundCents(Math.max(0, saldoNominalRestante - abonoCapitalNominalMes));
    } else {
      abonoCapitalNominalMes = esUltimoMes
        ? roundCents(saldoNominalRestante)
        : roundCents(precioFinanciadoBase / n);
      saldoNominalRestante = roundCents(Math.max(0, saldoNominalRestante - abonoCapitalNominalMes));
    }

    let abonoCapitalRealMes: number;
    let recargoOcultoMes: number;

    if (diferencialContadoTotal === 0 && tasaNominalMensual > 0) {
      abonoCapitalRealMes = abonoCapitalNominalMes;
      recargoOcultoMes = 0;
    } else {
      abonoCapitalRealMes = esUltimoMes
        ? roundCents(precioContado - acumuladoCapitalReal)
        : capitalRealMensualBase;
      recargoOcultoMes = esUltimoMes
        ? roundCents(diferencialContadoTotal - acumuladoRecargoOculto)
        : recargoOcultoMensualBase;
    }

    acumuladoCapitalReal = roundCents(acumuladoCapitalReal + abonoCapitalRealMes);
    acumuladoRecargoOculto = roundCents(acumuladoRecargoOculto + recargoOcultoMes);

    const ivaComisionInicialMes =
      input.aplicaIvaSobreInteresesYComisiones && mes === 1
        ? roundCents(comisionInicialDescontada * (input.tasaIvaPct / 100))
        : 0;

    const ivaMensual = input.aplicaIvaSobreInteresesYComisiones
      ? roundCents(
          (interesExplicitoMes + adminMensualConstante) * (input.tasaIvaPct / 100) +
            ivaComisionInicialMes
        )
      : 0;

    const cuotaRealAuditada = roundCents(
      abonoCapitalRealMes +
        recargoOcultoMes +
        interesExplicitoMes +
        seguroMensualConstante +
        adminMensualConstante +
        ivaMensual
    );

    const cuotaAnunciadaVendedor =
      input.cuotaAnunciadaVendedor !== undefined
        ? roundCents(input.cuotaAnunciadaVendedor)
        : roundCents(abonoCapitalRealMes + recargoOcultoMes + interesExplicitoMes);

    const saldoCapitalRealRestante = roundCents(Math.max(0, precioContado - acumuladoCapitalReal));

    tablaAmortizacion.push({
      mes,
      etiquetaPeriodo: `Mes ${mes}`,
      cuotaAnunciadaVendedor,
      abonoCapitalReal: abonoCapitalRealMes,
      interesExplicito: interesExplicitoMes,
      recargoContadoOculto: recargoOcultoMes,
      seguroMensual: seguroMensualConstante,
      comisionAdminMensual: adminMensualConstante,
      ivaMensual,
      cuotaRealAuditada,
      saldoCapitalRealRestante,
    });

    cashFlows.push(-cuotaRealAuditada);
  }

  const totalPagadoReal = roundCents(
    tablaAmortizacion.reduce((acc, row) => acc + row.cuotaRealAuditada, 0)
  );
  const totalAnunciadoVendedor = roundCents(
    tablaAmortizacion.reduce((acc, row) => acc + row.cuotaAnunciadaVendedor, 0)
  );

  const interesExplicitoTotal = roundCents(
    tablaAmortizacion.reduce((acc, row) => acc + row.interesExplicito, 0)
  );
  const descuentoContadoPerdidoTotal = roundCents(
    tablaAmortizacion.reduce((acc, row) => acc + row.recargoContadoOculto, 0)
  );
  const segurosAcumuladosTotal = roundCents(
    tablaAmortizacion.reduce((acc, row) => acc + row.seguroMensual, 0)
  );
  const adminMasIvaTotal = roundCents(
    tablaAmortizacion.reduce((acc, row) => acc + row.comisionAdminMensual + row.ivaMensual, 0)
  );
  const comisionesMasIvaTotal = roundCents(comisionInicialDescontada + adminMasIvaTotal);

  const sobrecostoTotal = roundCents(totalPagadoReal - capitalEfectivoRecibido);

  const desgloseSobrecosto: SurchargeBreakdown = {
    interesExplicito: interesExplicitoTotal,
    descuentoContadoPerdido: descuentoContadoPerdidoTotal,
    segurosAcumulados: segurosAcumuladosTotal,
    comisionesMasIva: comisionesMasIvaTotal,
    sobrecostoTotal,
  };

  const tirMensual = solveMonthlyIRR(cashFlows);
  const teaEfectivaAnual = monthlyToEffectiveAnnualRate(tirMensual);
  const vpnEnTir = computeNPV(cashFlows, tirMensual);

  const tasaNominalAnualAnunciadaPct = roundCents(input.tasaNominalMensualAnunciadaPct * 12);
  const teaEfectivaAnualPct = roundCents(teaEfectivaAnual * 100);
  const tirMensualPct = roundCents(tirMensual * 10000) / 100;
  const brechaOcultaPuntosPct = roundCents(teaEfectivaAnualPct - tasaNominalAnualAnunciadaPct);

  const tasaRendimientoMensualEfectiva = annualToEffectiveMonthlyRate(
    input.tasaRendimientoLiquidezAnualPct / 100
  );

  let vpCuotasAlCostoOportunidad = 0;
  for (let t = 1; t < cashFlows.length; t++) {
    vpCuotasAlCostoOportunidad +=
      Math.abs(cashFlows[t]) / Math.pow(1 + tasaRendimientoMensualEfectiva, t);
  }
  vpCuotasAlCostoOportunidad = roundCents(vpCuotasAlCostoOportunidad);

  const vpnFinanciamientoAlCostoOportunidad = roundCents(
    computeNPV(cashFlows, tasaRendimientoMensualEfectiva)
  );

  const descuentoMinimoContadoEquivalenteMonto = roundCents(
    Math.max(0, precioFinanciadoBase - vpCuotasAlCostoOportunidad)
  );
  const descuentoMinimoContadoEquivalentePct =
    precioFinanciadoBase > 0
      ? roundCents((descuentoMinimoContadoEquivalenteMonto / precioFinanciadoBase) * 100)
      : 0;

  const rendimientoAcumuladoPorLiquidez = roundCents(
    Math.max(0, totalPagadoReal - vpCuotasAlCostoOportunidad)
  );

  const analisisLiquidez: LiquidityAnalysis = {
    tasaRendimientoAnualPct: input.tasaRendimientoLiquidezAnualPct,
    tasaRendimientoMensualEfectiva,
    vpnFinanciamientoAlCostoOportunidad,
    rendimientoAcumuladoPorLiquidez,
    beneficioNetoTomarCuotas: vpnFinanciamientoAlCostoOportunidad,
    descuentoMinimoContadoEquivalenteMonto,
    descuentoMinimoContadoEquivalentePct,
    precioMaximoContadoParaEmpatar: vpCuotasAlCostoOportunidad,
  };

  const monedaSimbolo = input.moneda === 'GTQ' ? 'Q' : 'USD ';
  const fmt = (nVal: number) =>
    `${monedaSimbolo}${nVal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const primeraCuotaReal = tablaAmortizacion[0]?.cuotaRealAuditada ?? 0;
  const cuotaMensualRealPromedio = roundCents(totalPagadoReal / n);
  const cuotaMensualAnunciada = tablaAmortizacion[0]?.cuotaAnunciadaVendedor ?? 0;

  let veredicto: AuditVerdict;

  if (sobrecostoTotal <= 0.01 && teaEfectivaAnualPct === 0) {
    veredicto = {
      codigo: 'TOMAR_CUOTAS_INVERTIR_LIQUIDEZ',
      severidad: 'optimo',
      titular: 'FINANCIAMIENTO GENUINO 0.00% TEA — CONSERVAR LIQUIDEZ Y TOMAR LAS CUOTAS',
      resumenEjecutivo: `No existe sobreprecio encubierto entre contado (${fmt(
        precioContado
      )}) y cuotas (${fmt(
        totalPagadoReal
      )}), ni cobros administrativos o seguros forzosos. Al mantener tu capital invertido al ${input.tasaRendimientoLiquidezAnualPct.toFixed(
        1
      )}% anual mientras pagas las ${n} cuotas de ${fmt(
        primeraCuotaReal
      )}, obtienes una ventaja financiera neta en valor presente de ${fmt(
        vpnFinanciamientoAlCostoOportunidad
      )}.`,
      recomendacionAccionable: `Toma las ${n} cuotas de ${fmt(
        primeraCuotaReal
      )}, conserva los ${fmt(
        capitalEfectivoRecibido
      )} en cuenta remunerada o certificado a plazo (${input.tasaRendimientoLiquidezAnualPct.toFixed(
        1
      )}% anual) y programa debito automatico para evitar intereses moratorios.`,
      guionNegociacion: `"Confirmo la compra en ${n} cuotas de ${fmt(
        primeraCuotaReal
      )} unicamente bajo constancia escrita en factura de precio total ${fmt(
        precioFinanciadoBase
      )}, cero recargo de emisor, cero seguro mensual adjudicado y cero membresia administrativa. Si existe descuento por transferencia inmediata superior al ${descuentoMinimoContadoEquivalentePct.toFixed(
        2
      )}% (${fmt(
        descuentoMinimoContadoEquivalenteMonto
      )}, dejando el equipo en ${fmt(
        vpCuotasAlCostoOportunidad
      )} o menos), liquido de contado hoy mismo."`,
    };
  } else if (
    input.tasaNominalMensualAnunciadaPct === 0 &&
    (descuentoContadoPerdidoTotal > 0 || segurosAcumuladosTotal > 0 || comisionesMasIvaTotal > 0)
  ) {
    veredicto = {
      codigo: 'PAGAR_CONTADO_ALERTA_RECARGO',
      severidad: 'alerta',
      titular: `FALSO "0% INTERES" DETECTADO — COSTO REAL ${teaEfectivaAnualPct.toFixed(
        2
      )}% TEA (${fmt(sobrecostoTotal)} DE SOBRECOSTO)`,
      resumenEjecutivo: `Aunque la promocion anuncia "0% interes", renunciar al precio de oferta/contado (${fmt(
        precioContado
      )}) y asumir cargos anexos eleva el desembolso total a ${fmt(
        totalPagadoReal
      )}. El sobrecosto real de ${fmt(
        sobrecostoTotal
      )} equivale a un financiamiento bancario al ${teaEfectivaAnualPct.toFixed(
        2
      )}% efectivo anual (${tirMensualPct.toFixed(2)}% mensual sobre saldo).`,
      recomendacionAccionable: `Rechaza las cuotas sobre precio de lista y paga al precio de oferta/contado (${fmt(
        precioContado
      )}) para ahorrar de inmediato ${fmt(
        sobrecostoTotal
      )}. Exige que las Visacuotas se dividan exactamente sobre ${fmt(
        precioContado
      )} sin seguro mensual.`,
      guionNegociacion: `"El plan de ${n} cuotas anunciado como 0% interes tiene un recargo implicito de ${fmt(
        sobrecostoTotal
      )} (${teaEfectivaAnualPct.toFixed(
        2
      )}% TEA efectiva) entre la perdida del precio de oferta (${fmt(
        descuentoContadoPerdidoTotal
      )}) y cargos mensuales (${fmt(
        roundCents(segurosAcumuladosTotal + comisionesMasIvaTotal)
      )}). Compro hoy mismo si aplican las ${n} cuotas sobre el precio de oferta de ${fmt(
        precioContado
      )} (${fmt(roundCents(precioContado / n))}/mes) sin Seguro Facil ni recargo."`,
    };
  } else if (teaEfectivaAnualPct > input.tasaRendimientoLiquidezAnualPct + 6) {
    veredicto = {
      codigo: 'RECHAZAR_O_RENEGOCIAR_CREDITO',
      severidad: 'alerta',
      titular: `COSTO EFECTIVO ELEVADO (${teaEfectivaAnualPct.toFixed(
        2
      )}% TEA VS ${tasaNominalAnualAnunciadaPct.toFixed(2)}% NOMINAL ANUNCIADO)`,
      resumenEjecutivo: `Recibes ${fmt(
        capitalEfectivoRecibido
      )} netos en el dia 0 pero terminas desembolsando ${fmt(
        totalPagadoReal
      )} en ${n} meses (${fmt(
        sobrecostoTotal
      )} en intereses, comision inicial, seguro de saldo deudor e IVA). La comision inicial y cargos mensuales agregan +${brechaOcultaPuntosPct.toFixed(
        2
      )} puntos porcentuales sobre la tasa nominal anunciada.`,
      recomendacionAccionable: `No aceptes el extrafinanciamiento con comision de desembolso del ${input.comisionDesembolsoPct.toFixed(
        1
      )}% ni seguro mensual sobre saldo inicial. Solicita exoneracion de comision de apertura y seguro sobre saldo insoluto, o utiliza liquidez propia / cooperativa (<14% TEA).`,
      guionNegociacion: `"Al descontar ${fmt(
        comisionInicialDescontada
      )} de comision inicial y cobrar ${fmt(
        seguroMensualConstante
      )}/mes de seguro sobre el saldo inicial mas IVA, la tasa efectiva anual sube de ${tasaNominalAnualAnunciadaPct.toFixed(
        2
      )}% a ${teaEfectivaAnualPct.toFixed(
        2
      )}% TEA (sobrecosto total de ${fmt(
        sobrecostoTotal
      )}). Acepto la operacion unicamente si exoneran el ${input.comisionDesembolsoPct.toFixed(
        1
      )}% de comision de desembolso y calculan el seguro sobre saldo insoluto decreciente."`,
    };
  } else {
    veredicto = {
      codigo: 'NEUTRAL_SEGUN_LIQUIDEZ',
      severidad: 'precaucion',
      titular: `COSTO MODERADO (${teaEfectivaAnualPct.toFixed(2)}% TEA) — EVALUAR SEGUN TU LIQUIDEZ`,
      resumenEjecutivo: `El financiamiento tiene un sobrecosto total de ${fmt(
        sobrecostoTotal
      )} (${teaEfectivaAnualPct.toFixed(
        2
      )}% TEA). Comparado con tu rendimiento de liquidez (${input.tasaRendimientoLiquidezAnualPct.toFixed(
        1
      )}% anual), el costo neto en valor presente es de ${fmt(
        Math.abs(vpnFinanciamientoAlCostoOportunidad)
      )}.`,
      recomendacionAccionable: `Si dispones de liquidez sin descapitalizar tu fondo de emergencia, paga al contado (${fmt(
        precioContado
      )}) o negocia eliminar los cargos fijos mensuales.`,
      guionNegociacion: `"Para cerrar la compra hoy al contado necesito un precio final de ${fmt(
        precioContado
      )} libre de recargos de emisor y seguros adicionales."`,
    };
  }

  return {
    input,
    frecuenciaEfectiva: 'mensual',
    numeroPeriodos: n,
    capitalEfectivoRecibido,
    comisionInicialDescontada,
    precioFinanciadoBase,
    cuotaMensualAnunciada,
    cuotaMensualRealPromedio,
    primeraCuotaReal,
    totalAnunciadoVendedor,
    totalPagadoReal,
    cashFlows,
    tirMensual,
    tirMensualPct,
    tirPeriodica: tirMensual,
    tirPeriodicaPct: tirMensualPct,
    tasaNominalAnualAnunciadaPct,
    teaEfectivaAnual,
    teaEfectivaAnualPct,
    brechaOcultaPuntosPct,
    vpnEnTir,
    desgloseSobrecosto,
    analisisLiquidez,
    analisisSemanalElektra: {
      activo: false,
      abonoSemanalBase: 0,
      garantiaSemanal: 0,
      abonoSemanalTotal: 0,
      plazoSemanasAuditado: 0,
      semanasEquilibrioCapital: 0,
      semanasTrabajandoParaInteres: 0,
      descuentoFicticioListaVsContado: diferencialContadoTotal,
      tirSemanal: 0,
      tirSemanalPct: 0,
      teaCompuesta52SemanasPct: 0,
      matrizPlazosAzteca: [],
    },
    tablaAmortizacion,
    veredicto,
  };
}


/** Compare actual totals with only the maximum half-cent rounding per payment as tolerance. */
export function evaluatePaymentComparison(cashPrice: number, payment: number, count: number) {
  const valid = [cashPrice, payment, count].every(Number.isFinite) && cashPrice > 0 && payment > 0 && Number.isInteger(count) && count > 0;
  const total = valid ? roundCents(payment * count) : 0;
  const difference = valid ? roundCents(total - cashPrice) : 0;
  const roundingTolerance = count * 0.005;
  const kind = !valid ? 'incomplete' : difference === 0 ? 'equal'
    : Math.abs(difference) <= roundingTolerance ? 'rounding'
    : difference < 0 ? 'discount' : 'surcharge';
  const recommendation = kind === 'incomplete'
    ? 'Completa el precio de contado, el monto de cada cuota y el número de pagos para comparar.'
    : kind === 'surcharge'
      ? 'El contado cuesta menos. Elígelo si puedes pagarlo sin afectar tus gastos esenciales ni tu fondo de emergencia. Si no, compara otro plazo o espera antes de comprar.'
      : 'Las cuotas pueden ayudarte a conservar dinero disponible si cada pago cabe en tu presupuesto. Confirma el total, las comisiones y los cargos por atraso antes de aceptar.';
  return { kind, total, difference, roundingTolerance, recommendation };
}
