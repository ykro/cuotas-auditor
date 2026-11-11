import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditCreditOffer,
  computeNPV,
  solveMonthlyIRR,
  monthlyToEffectiveAnnualRate,
  weeklyToEffectiveAnnualRate,
  computeBreakEvenWeeks,
  buildWeeklyTermMatrix,
  roundCents,
  CreditOfferInput,
} from '../src/engine/creditAudit.ts';
import {
  GUATEMALA_PRESET_CASES,
  REAL_GUATEMALA_ECOMMERCE_CASES,
} from '../src/data/guatemalaCases.ts';

test('1. VPN en la TIR calculada es 0.00 con tolerancia < 1e-6 para los 4 casos base y los casos reales Elektra/MAX', () => {
  for (const preset of [...GUATEMALA_PRESET_CASES, ...REAL_GUATEMALA_ECOMMERCE_CASES]) {
    const result = auditCreditOffer(preset.input);
    const npvAtIrr = computeNPV(result.cashFlows, result.tirPeriodica);
    assert.ok(
      Math.abs(npvAtIrr) < 1e-6,
      `El VPN en TIR para ${preset.id} debe ser < 1e-6, obtenido: ${npvAtIrr}`
    );
    assert.ok(Math.abs(result.vpnEnTir) < 1e-6);
  }
});

test('2. Cuando no hay recargos ni diferencia entre contado y lista (Caso 4), TEA === 0 y sobrecosto === 0', () => {
  const caso4 = GUATEMALA_PRESET_CASES[3].input;
  const result = auditCreditOffer(caso4);

  assert.strictEqual(result.tirMensual, 0);
  assert.strictEqual(result.teaEfectivaAnual, 0);
  assert.strictEqual(result.teaEfectivaAnualPct, 0);
  assert.strictEqual(result.desgloseSobrecosto.sobrecostoTotal, 0);
  assert.strictEqual(result.totalPagadoReal, 7200.0);
  assert.strictEqual(result.capitalEfectivoRecibido, 7200.0);
  assert.strictEqual(result.veredicto.codigo, 'TOMAR_CUOTAS_INVERTIR_LIQUIDEZ');
  assert.ok(
    result.analisisLiquidez.beneficioNetoTomarCuotas > 0,
    'Con rendimiento de liquidez > 5% anual y TEA 0%, tomar cuotas genera beneficio neto positivo'
  );
});

test('3. Caso 1 ("18 cuotas precio de contado" Q12,499 vs Q10,499 efectivo + Q35/mes) destapa TEA efectiva > 33% anual aunque anuncia 0%', () => {
  const caso1 = GUATEMALA_PRESET_CASES[0].input;
  const result = auditCreditOffer(caso1);

  assert.strictEqual(result.capitalEfectivoRecibido, 10499.0);
  assert.strictEqual(result.desgloseSobrecosto.descuentoContadoPerdido, 2000.0);
  assert.strictEqual(result.desgloseSobrecosto.comisionesMasIva, 630.0);
  assert.strictEqual(result.desgloseSobrecosto.sobrecostoTotal, 2630.0);
  assert.ok(
    result.teaEfectivaAnualPct > 33.5,
    `Se esperaba TEA > 33.5% anual en Caso 1, obtenido: ${result.teaEfectivaAnualPct}%`
  );
  assert.strictEqual(result.veredicto.codigo, 'PAGAR_CONTADO_ALERTA_RECARGO');
});

test('4. La comision de desembolso descontada en t=0 incrementa la TEA exactamente segun la identidad financiera', () => {
  const baseOffer: CreditOfferInput = {
    titulo: 'Prestamo Base Sin Comision',
    comercioOEntidad: 'Banco Test',
    tipoOferta: 'extrafinanciamiento_bancario',
    moneda: 'GTQ',
    precioListaNominal: 25000,
    precioContadoEfectivo: 25000,
    plazoMeses: 36,
    tasaNominalMensualAnunciadaPct: 1.5,
    recargoCuotasPct: 0,
    comisionDesembolsoPct: 0,
    comisionDesembolsoFija: 0,
    cobroAdministrativoMensual: 0,
    seguroMensualFijo: 0,
    seguroSaldoDeudorMensualPct: 0,
    aplicaIvaSobreInteresesYComisiones: false,
    tasaIvaPct: 12,
    tasaRendimientoLiquidezAnualPct: 6.0,
  };

  const withCommissionOffer: CreditOfferInput = {
    ...baseOffer,
    comisionDesembolsoPct: 4.0,
  };

  const resSinComision = auditCreditOffer(baseOffer);
  const resConComision = auditCreditOffer(withCommissionOffer);

  assert.strictEqual(resSinComision.capitalEfectivoRecibido, 25000);
  assert.strictEqual(resConComision.capitalEfectivoRecibido, 24000);
  assert.deepStrictEqual(resSinComision.cashFlows.slice(1), resConComision.cashFlows.slice(1));

  const pvAtConIrr = resConComision.cashFlows
    .slice(1)
    .reduce(
      (acc, cf, idx) => acc + Math.abs(cf) / Math.pow(1 + resConComision.tirMensual, idx + 1),
      0
    );

  assert.ok(Math.abs(pvAtConIrr - 24000) < 1e-6);
  assert.ok(resConComision.teaEfectivaAnual > resSinComision.teaEfectivaAnual);

  const expectedTea = monthlyToEffectiveAnnualRate(resConComision.tirMensual);
  assert.ok(Math.abs(resConComision.teaEfectivaAnual - expectedTea) < 1e-12);
});

test('5. La suma de componentes del sobrecosto cuadra exactamente al centavo (totalPagado - capitalEfectivoRecibido)', () => {
  for (const preset of [...GUATEMALA_PRESET_CASES, ...REAL_GUATEMALA_ECOMMERCE_CASES]) {
    const result = auditCreditOffer(preset.input);
    const {
      interesExplicito,
      descuentoContadoPerdido,
      segurosAcumulados,
      comisionesMasIva,
      sobrecostoTotal,
    } = result.desgloseSobrecosto;

    const sumaComponentes = roundCents(
      interesExplicito + descuentoContadoPerdido + segurosAcumulados + comisionesMasIva
    );
    const diferenciaContable = roundCents(result.totalPagadoReal - result.capitalEfectivoRecibido);

    assert.strictEqual(
      sumaComponentes,
      diferenciaContable,
      `Descuadre en ${preset.id}: sumaComponentes=${sumaComponentes} vs diferencia=${diferenciaContable}`
    );
    assert.strictEqual(sobrecostoTotal, diferenciaContable);
  }
});

test('6. Caso 2 (Extrafinanciamiento 36m Q25,000 con 4% comision, 0.35% seguro sobre saldo inicial e IVA 12%) calcula flujos exactos', () => {
  const caso2 = GUATEMALA_PRESET_CASES[1].input;
  const result = auditCreditOffer(caso2);

  assert.strictEqual(result.capitalEfectivoRecibido, 24000.0);
  assert.strictEqual(result.comisionInicialDescontada, 1000.0);
  assert.strictEqual(result.desgloseSobrecosto.segurosAcumulados, 3150.0);
  assert.ok(result.desgloseSobrecosto.interesExplicito > 7500.0);
  assert.ok(result.desgloseSobrecosto.comisionesMasIva > 2000.0);
  assert.ok(result.teaEfectivaAnualPct > 30.0);
});

test('7. Caso 3 (12 Visacuotas con recargo 10% sobre Q8,200 + seguro obligatorio Q49/mes) audita sobrecosto de Q1,408.00', () => {
  const caso3 = GUATEMALA_PRESET_CASES[2].input;
  const result = auditCreditOffer(caso3);

  assert.strictEqual(result.capitalEfectivoRecibido, 8200.0);
  assert.strictEqual(result.precioFinanciadoBase, 9020.0);
  assert.strictEqual(result.desgloseSobrecosto.descuentoContadoPerdido, 820.0);
  assert.strictEqual(result.desgloseSobrecosto.segurosAcumulados, 588.0);
  assert.strictEqual(result.desgloseSobrecosto.sobrecostoTotal, 1408.0);
  assert.strictEqual(result.totalPagadoReal, 9608.0);
  assert.ok(result.teaEfectivaAnualPct > 34.0);
});

test('8. El saldo de capital real restante en la tabla de amortizacion llega exactamente a 0.00 en el ultimo periodo', () => {
  for (const preset of [...GUATEMALA_PRESET_CASES, ...REAL_GUATEMALA_ECOMMERCE_CASES]) {
    const result = auditCreditOffer(preset.input);
    const ultimaFila = result.tablaAmortizacion[result.tablaAmortizacion.length - 1];
    assert.strictEqual(result.tablaAmortizacion.length, result.numeroPeriodos);
    assert.strictEqual(ultimaFila.saldoCapitalRealRestante, 0);

    const sumaCapitalRealTabla = roundCents(
      result.tablaAmortizacion.reduce((acc, r) => acc + r.abonoCapitalReal, 0)
    );
    assert.strictEqual(sumaCapitalRealTabla, roundCents(preset.input.precioContadoEfectivo));
  }
});

test('9. Solver semanal Elektra / Banco Azteca (Smart TV LG 65" Q4,195 contado vs Q71/sem) calcula semanas de equilibrio y matriz 52..154 semanas', () => {
  const elektraTv = REAL_GUATEMALA_ECOMMERCE_CASES[0].input;
  const result = auditCreditOffer(elektraTv);

  assert.strictEqual(result.frecuenciaEfectiva, 'semanal');
  assert.strictEqual(computeBreakEvenWeeks(4195, 71), 59.08);
  assert.strictEqual(result.analisisSemanalElektra.semanasEquilibrioCapital, 59.08);

  const matriz = buildWeeklyTermMatrix({
    precioContadoEfectivo: 4195,
    abonoSemanalBase: 71,
  });

  const p104 = matriz.find((m) => m.plazoSemanas === 104)!;
  const p128 = matriz.find((m) => m.plazoSemanas === 128)!;
  const p154 = matriz.find((m) => m.plazoSemanas === 154)!;

  assert.strictEqual(p104.totalPagado, 7384.0);
  assert.strictEqual(p128.totalPagado, 9088.0);
  assert.strictEqual(p154.totalPagado, 10934.0);

  // Verificar que TEA semanal = (1 + r_w)^52 - 1 y VPN(r_w) == 0
  for (const row of matriz) {
    assert.ok(Math.abs(row.vpnEnTir) < 1e-6);
    assert.strictEqual(
      roundCents(weeklyToEffectiveAnnualRate(row.tirSemanal) * 100),
      row.teaEfectivaAnualPct
    );
  }
  assert.ok(p104.teaEfectivaAnualPct > 70);
  assert.ok(p154.teaEfectivaAnualPct > 95);
});

test('10. Caso real Tiendas MAX (Samsung A37 5G: Regular Q3,695 vs Oferta Q2,996 + Seguro Facil Q35/mes) destapa sobrecosto de Q1,119.00', () => {
  const maxCase = REAL_GUATEMALA_ECOMMERCE_CASES[2].input;
  const result = auditCreditOffer(maxCase);

  assert.strictEqual(result.capitalEfectivoRecibido, 2996.0);
  assert.strictEqual(result.desgloseSobrecosto.descuentoContadoPerdido, 699.0);
  assert.strictEqual(result.desgloseSobrecosto.segurosAcumulados, 420.0);
  assert.strictEqual(result.desgloseSobrecosto.sobrecostoTotal, 1119.0);
  assert.ok(result.teaEfectivaAnualPct > 70.0);
});

test('11. Solver TIR converge con precision < 1e-9 tanto en tasas bajas como en tasas extremas (>150% anual)', () => {
  const flujosExtremos = [1000, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180];
  const irr = solveMonthlyIRR(flujosExtremos);
  const npv = computeNPV(flujosExtremos, irr);
  assert.ok(Math.abs(npv) < 1e-9);
  assert.ok(irr > 0.12);
});

test('rounded retail installments do not persist a cash alert', () => {
  const input = { ...GUATEMALA_PRESET_CASES[3].input, precioListaNominal: 8596.08, precioContadoEfectivo: 8596, plazoMeses: 18, cuotaAnunciadaVendedor: 477.56 };
  const result = auditCreditOffer(input);
  assert.equal(result.veredicto.codigo, 'NEUTRAL_SEGUN_LIQUIDEZ');
  assert.equal(result.totalPagadoReal, 8596.08);
});
