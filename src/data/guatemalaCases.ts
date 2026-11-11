import { CreditOfferInput } from '../engine/creditAudit.ts';

export interface DocumentClausePin {
  id: string;
  numero: string;
  etiqueta: string;
  extractoLiteral: string;
  impactoFinanciero: string;
  severidad: 'trampa' | 'neutro' | 'transparente';
  campoVinculado: keyof CreditOfferInput;
  coordenadasPct: { top: number; left: number; width: number; height: number };
}

export interface GuatemalaPresetCase {
  id: string;
  numeroCaso: string;
  badgeTienda: string;
  nombreCorto: string;
  subtitulo: string;
  categoria: string;
  emisorDocumento: string;
  codigoReferenciaDoc: string;
  fechaEmisionDoc: string;
  tipoComprobante:
    | 'ELEKTRA_SEMANAL'
    | 'MAX_OFERTA_VS_REGULAR'
    | 'ETIQUETA_RETAIL'
    | 'CONTRATO_EXTRAFINANCIAMIENTO'
    | 'COTIZACION_TECNOLOGIA'
    | 'FACTURA_CERO_INTERES';
  LineasEncabezadoDoc: string[];
  cuerpoDocumento: {
    conceptoPrincipal: string;
    skuOModelo: string;
    bloquePromocional: string;
    bloqueCondicionesEfectivo: string;
    letraPequenaClausulas: string[];
  };
  pins: DocumentClausePin[];
  input: CreditOfferInput;
}

/**
 * Los 4 casos base requeridos por la suite determinista original (indices 0..3).
 */
export const GUATEMALA_PRESET_CASES: GuatemalaPresetCase[] = [
  {
    id: 'caso-1-retail-18-cuotas',
    numeroCaso: 'CASO 01',
    badgeTienda: 'RETAIL 18M',
    nombreCorto: '18 Cuotas "Precio de Contado" con Descuento Omitido',
    subtitulo:
      'Motocicleta / Linea Blanca en Cadena Retail GT — Q12,499 lista vs. Q10,499 efectivo + Q35/mes',
    categoria: 'Retail Electrodomesticos / Motos',
    emisorDocumento:
      'DISTRIBUIDORA CENTROAMERICANA DE ELECTRODOMESTICOS S.A. — SUCURSAL MAJADAS Z.11',
    codigoReferenciaDoc: 'COT-GT-2026-08914',
    fechaEmisionDoc: '31 OCT 2026',
    tipoComprobante: 'ETIQUETA_RETAIL',
    LineasEncabezadoDoc: [
      'ORDEN DE COTIZACION Y FINANCIAMIENTO EN TIENDA',
      'NIT EMISOR: 4829104-7 | MONEDA: QUETZALES (GTQ)',
      'PLAN COMERCIAL: "18 CUOTAS PRECIO DE CONTADO — 0% INTERES"',
    ],
    cuerpoDocumento: {
      conceptoPrincipal: 'Motocicleta Urbana 150cc Mod. 2026 / Refrigeradora French Door 22p3',
      skuOModelo: 'SKU-MOTO-150-GT / REF-FD22',
      bloquePromocional:
        'PRECIO DE LISTA EN 18 CUOTAS: Q12,499.00 — 18 PAGOS DE Q694.39 (0% INTERES NOMINAL)',
      bloqueCondicionesEfectivo:
        'PRECIO ESPECIAL PAGO UNICO EFECTIVO / TRANSFERENCIA ACH INMEDIATA: Q10,499.00 (Bonificacion directa de Q2,000.00 no aplicable en planes de cuotas ni tarjetas de credito).',
      letraPequenaClausulas: [
        'Clausula 4.1: El cliente acepta que el precio de lista para planes de cuotas sin intereses es de Q12,499.00.',
        'Clausula 4.2: Aplica cargo fijo mensual por administracion de cuenta, envio de estado digital y gestion de cobro por Q35.00 mensuales adicionales a la cuota base durante la vigencia del plan (18 meses).',
        'Clausula 4.3: Cuota total exigible en caja cada mes: Q729.39 (Q694.39 base + Q35.00 cargo administrativo).',
      ],
    },
    pins: [
      {
        id: 'c1-pin-1',
        numero: '01',
        etiqueta: 'Anuncio "0% Interes" sobre Precio Inflado',
        extractoLiteral: '18 PAGOS DE Q694.39 (0% INTERES NOMINAL) SOBRE LISTA Q12,499.00',
        impactoFinanciero:
          'El vendedor presenta Q694.39 como division exacta sin intereses, ocultando que parte de un precio inflado en Q2,000.00 respecto al valor real en efectivo.',
        severidad: 'trampa',
        campoVinculado: 'precioListaNominal',
        coordenadasPct: { top: 27, left: 4, width: 92, height: 17 },
      },
      {
        id: 'c1-pin-2',
        numero: '02',
        etiqueta: 'Descuento por Pago en Efectivo Omitido (Q2,000.00)',
        extractoLiteral: 'PRECIO ESPECIAL PAGO UNICO EFECTIVO / TRANSFERENCIA ACH: Q10,499.00',
        impactoFinanciero:
          'Renunciar a un descuento de contado de Q2,000.00 es matematicamente un costo financiero explicito del credito.',
        severidad: 'trampa',
        campoVinculado: 'precioContadoEfectivo',
        coordenadasPct: { top: 47, left: 4, width: 92, height: 18 },
      },
      {
        id: 'c1-pin-3',
        numero: '03',
        etiqueta: 'Cobro Administrativo Mensual (Q35.00/mes)',
        extractoLiteral:
          'Cargo fijo mensual por administracion de cuenta y gestion de cobro: Q35.00/mes',
        impactoFinanciero:
          'Agrega Q630.00 al plan y eleva la cuota real de Q694.39 a Q729.39/mes, disparando la TAE efectiva anual a 33.97%.',
        severidad: 'trampa',
        campoVinculado: 'cobroAdministrativoMensual',
        coordenadasPct: { top: 68, left: 4, width: 92, height: 26 },
      },
    ],
    input: {
      id: 'caso-1-retail-18-cuotas',
      titulo: 'Caso 1 — "18 Cuotas Precio de Contado" con Descuento Efectivo Omitido',
      comercioOEntidad: 'Cadena Retail Electrodomesticos / Motos GT',
      tipoOferta: 'retail_cuotas',
      frecuenciaPago: 'mensual',
      moneda: 'GTQ',
      precioListaNominal: 12499.0,
      precioContadoEfectivo: 10499.0,
      plazoMeses: 18,
      tasaNominalMensualAnunciadaPct: 0,
      recargoCuotasPct: 0,
      comisionDesembolsoPct: 0,
      comisionDesembolsoFija: 0,
      cobroAdministrativoMensual: 35.0,
      seguroMensualFijo: 0,
      seguroSaldoDeudorMensualPct: 0,
      aplicaIvaSobreInteresesYComisiones: false,
      tasaIvaPct: 12,
      tasaRendimientoLiquidezAnualPct: 6.5,
      cuotaAnunciadaVendedor: 694.39,
    },
  },
  {
    id: 'caso-2-extrafinanciamiento-36m',
    numeroCaso: 'CASO 02',
    badgeTienda: 'BANCO 36M',
    nombreCorto: 'Extrafinanciamiento Bancario 36 Meses en Tarjeta GT',
    subtitulo:
      'Capital Q25,000 al "1.5% mensual", comision inicial 4%, seguro 0.35% sobre saldo inicial + IVA 12%',
    categoria: 'Banca / Tarjeta de Credito GT',
    emisorDocumento: 'BANCO EMISOR CORPORATIVO DE GUATEMALA S.A. — DIVISION TARJETAS DE CREDITO',
    codigoReferenciaDoc: 'EXT-TC-2026-44109',
    fechaEmisionDoc: '31 OCT 2026',
    tipoComprobante: 'CONTRATO_EXTRAFINANCIAMIENTO',
    LineasEncabezadoDoc: [
      'HOJA DE LIQUIDACION Y CONTRATO DE EXTRAFINANCIAMIENTO EN EFECTIVO',
      'PROGRAMA: LIQUIDEZ INMEDIATA TARJETAHABIENTE PREFERENTE',
      'PLAZO: 36 MESES | TASA PROMOCIONAL ANUNCIADA: 1.50% MENSUAL',
    ],
    cuerpoDocumento: {
      conceptoPrincipal: 'Desembolso de Extrafinanciamiento en Efectivo a Cuenta Monetaria',
      skuOModelo: 'LINEA-EXT-36M-GTQ',
      bloquePromocional:
        'MONTO APROBADO EN CONTRATO: Q25,000.00 | TASA NOMINAL ANUNCIADA: 1.50% MENSUAL (CUOTA BASE: Q903.81)',
      bloqueCondicionesEfectivo:
        'LIQUIDACION EN t=0: Monto Nominal Q25,000.00 (-) Comision por Desembolso 4.00% (Q1,000.00) = EFECTIVO NETO ACREDITADO: Q24,000.00.',
      letraPequenaClausulas: [
        'Clausula 2.2 (Comision de Desembolso): Se deduce al momento del acreditamiento un 4.00% sobre el valor nominal aprobado (Q1,000.00). El calculo de amortizacion e intereses se realiza sobre los Q25,000.00 nominales.',
        'Clausula 5.1 (Seguro de Saldo Deudor): El tarjetahabiente pagara mensualmente una prima equivalente al 0.35% calculada de forma fija sobre el monto inicial concedido (Q87.50 cada mes durante los 36 meses).',
        'Clausula 6.4 (Impuestos): Conforme legislacion vigente en Guatemala, los intereses corrientes y recargos generan 12% de IVA mensual adicional.',
      ],
    },
    pins: [
      {
        id: 'c2-pin-1',
        numero: '01',
        etiqueta: 'Tasa Nominal Anunciada "1.5% Mensual" (Sin Cargos)',
        extractoLiteral:
          'TASA NOMINAL ANUNCIADA: 1.50% MENSUAL (18.00% ANUAL NOMINAL) — CUOTA BASE Q903.81',
        impactoFinanciero:
          'El ejecutivo telefonico cotiza la cuota base sin incluir la deduccion inicial de Q1,000.00, el seguro fijo ni el IVA mensual.',
        severidad: 'trampa',
        campoVinculado: 'tasaNominalMensualAnunciadaPct',
        coordenadasPct: { top: 26, left: 4, width: 92, height: 17 },
      },
      {
        id: 'c2-pin-2',
        numero: '02',
        etiqueta: 'Comision de Desembolso 4% Descontada en t=0 (Recibes Q24,000)',
        extractoLiteral:
          'Monto Nominal Q25,000.00 (-) Comision 4.00% (Q1,000.00) = Recibes Q24,000.00 pero pagas sobre Q25,000.00',
        impactoFinanciero:
          'Pagas intereses y capital sobre Q25,000.00 aunque el banco solo deposito Q24,000.00 en tu cuenta en el dia 0.',
        severidad: 'trampa',
        campoVinculado: 'comisionDesembolsoPct',
        coordenadasPct: { top: 46, left: 4, width: 92, height: 18 },
      },
      {
        id: 'c2-pin-3',
        numero: '03',
        etiqueta: 'Seguro 0.35%/mes sobre Saldo Inicial + IVA 12%',
        extractoLiteral:
          'Prima mensual 0.35% sobre monto original (Q87.50/mes fijos = Q3,150.00) + IVA 12% sobre intereses',
        impactoFinanciero:
          'Cobrar el seguro sobre el monto inicial de Q25,000 incluso cuando debes menos de Q5,000 en el ultimo ano agrega Q3,150.00 mas IVA.',
        severidad: 'trampa',
        campoVinculado: 'seguroSaldoDeudorMensualPct',
        coordenadasPct: { top: 67, left: 4, width: 92, height: 27 },
      },
    ],
    input: {
      id: 'caso-2-extrafinanciamiento-36m',
      titulo: 'Caso 2 — Extrafinanciamiento Bancario 36 Meses (Tarjeta GT)',
      comercioOEntidad: 'Emisor Bancario Tarjeta de Credito GT',
      tipoOferta: 'extrafinanciamiento_bancario',
      frecuenciaPago: 'mensual',
      moneda: 'GTQ',
      precioListaNominal: 25000.0,
      precioContadoEfectivo: 25000.0,
      plazoMeses: 36,
      tasaNominalMensualAnunciadaPct: 1.5,
      recargoCuotasPct: 0,
      comisionDesembolsoPct: 4.0,
      comisionDesembolsoFija: 0,
      cobroAdministrativoMensual: 0,
      seguroMensualFijo: 0,
      seguroSaldoDeudorMensualPct: 0.35,
      aplicaIvaSobreInteresesYComisiones: true,
      tasaIvaPct: 12,
      tasaRendimientoLiquidezAnualPct: 6.5,
      cuotaAnunciadaVendedor: 903.81,
    },
  },
  {
    id: 'caso-3-tecnologia-12-visacuotas',
    numeroCaso: 'CASO 03',
    badgeTienda: 'TECH 12M',
    nombreCorto: '12 Visacuotas con Recargo 10% + Seguro de Equipo Q49/mes',
    subtitulo:
      'Tienda de Tecnologia GT — Contado Q8,200 vs. 12 cuotas anunciadas de Q799.83 (Q800.67 reales)',
    categoria: 'Tienda de Tecnologia / Computo',
    emisorDocumento: 'TECNOLOGIA Y SISTEMAS DE GUATEMALA S.A. — ZONA PRADERA Z.10',
    codigoReferenciaDoc: 'PRO-TECH-2026-11208',
    fechaEmisionDoc: '31 OCT 2026',
    tipoComprobante: 'COTIZACION_TECNOLOGIA',
    LineasEncabezadoDoc: [
      'PROFORMA DE VENTA — DEPARTAMENTO DE COMPUTO Y MOVILIDAD',
      'PRECIOS INCLUYEN IVA | CONDICION DIFERENCIADA SEGUN MEDIO DE PAGO',
      'PLAN TARJETA: 12 VISACUOTAS CON COBERTURA DE EQUIPO OBLIGATORIA',
    ],
    cuerpoDocumento: {
      conceptoPrincipal: 'Workstation Portatil Pro 14" M-Series 16GB RAM / 512GB NVMe',
      skuOModelo: 'LAP-PRO14-512-GT',
      bloquePromocional:
        'PRECIO EN 12 CUOTAS: Q9,020.00 (Recargo tarjeta 10%) — CUOTA PUBLICITADA EN VALLA: Q799.83/MES*',
      bloqueCondicionesEfectivo:
        'PRECIO CONTADO (EFECTIVO, CHEQUE DE CAJA O TRANSFERENCIA BANCARIA): Q8,200.00 NETOS.',
      letraPequenaClausulas: [
        'Nota 1 (Nivelacion por medio de pago): El pago mediante 12 Visacuotas / Credicuotas aplica un recargo de nivelacion del 10.00% sobre el precio de efectivo (Q8,200.00 -> Q9,020.00, equivalente a Q751.67/mes de base).',
        'Nota 2 (Proteccion Obligatoria de Equipo): Toda venta en cuotas requiere la suscripcion de la poliza contra dano accidental y robo parcial por Q49.00 fijos mensuales durante 12 meses (Q588.00 acumulados).',
        'Nota 3: Desembolso mensual exacto auditado en estado de cuenta: Q751.67 + Q49.00 = Q800.67/mes (Q9,608.00 total).',
      ],
    },
    pins: [
      {
        id: 'c3-pin-1',
        numero: '01',
        etiqueta: 'Recargo del 10% por Pago en 12 Cuotas (+Q820.00)',
        extractoLiteral:
          'PRECIO EN 12 CUOTAS: Q9,020.00 (Recargo del 10% sobre precio de efectivo Q8,200.00)',
        impactoFinanciero:
          'Aunque los contratos de afiliacion prohiben trasladar comisiones de POS al consumidor, el comercio lo disfraza como "precio normal de lista Q9,020 vs descuento en efectivo Q8,200".',
        severidad: 'trampa',
        campoVinculado: 'recargoCuotasPct',
        coordenadasPct: { top: 26, left: 4, width: 92, height: 18 },
      },
      {
        id: 'c3-pin-2',
        numero: '02',
        etiqueta: 'Precio Real de Contado Q8,200.00',
        extractoLiteral: 'PRECIO CONTADO (EFECTIVO O TRANSFERENCIA BANCARIA): Q8,200.00 NETOS',
        impactoFinanciero:
          'Este es el verdadero valor de mercado del activo en el dia 0 sobre el cual debe medirse la Tasa Efectiva Anual.',
        severidad: 'transparente',
        campoVinculado: 'precioContadoEfectivo',
        coordenadasPct: { top: 47, left: 4, width: 92, height: 17 },
      },
      {
        id: 'c3-pin-3',
        numero: '03',
        etiqueta: 'Seguro Obligatorio de Equipo Q49.00/mes (+Q588.00)',
        extractoLiteral:
          'Poliza obligatoria en compras a cuotas: Q49.00/mes (lleva la cuota real a Q800.67/mes)',
        impactoFinanciero:
          'Sumado al 10% de recargo, el sobrecosto total alcanza Q1,408.00 sobre un equipo de Q8,200.00, generando una TEA efectiva del 34.23%.',
        severidad: 'trampa',
        campoVinculado: 'seguroMensualFijo',
        coordenadasPct: { top: 67, left: 4, width: 92, height: 27 },
      },
    ],
    input: {
      id: 'caso-3-tecnologia-12-visacuotas',
      titulo: 'Caso 3 — 12 Visacuotas con Recargo 10% + Seguro Obligatorio Q49/mes',
      comercioOEntidad: 'Tienda de Tecnologia Zona 10 GT',
      tipoOferta: 'retail_cuotas',
      frecuenciaPago: 'mensual',
      moneda: 'GTQ',
      precioListaNominal: 9020.0,
      precioContadoEfectivo: 8200.0,
      plazoMeses: 12,
      tasaNominalMensualAnunciadaPct: 0,
      recargoCuotasPct: 10.0,
      comisionDesembolsoPct: 0,
      comisionDesembolsoFija: 0,
      cobroAdministrativoMensual: 0,
      seguroMensualFijo: 49.0,
      seguroSaldoDeudorMensualPct: 0,
      aplicaIvaSobreInteresesYComisiones: false,
      tasaIvaPct: 12,
      tasaRendimientoLiquidezAnualPct: 6.5,
      cuotaAnunciadaVendedor: 799.83,
    },
  },
  {
    id: 'caso-4-cuotas-genuinas-0pct',
    numeroCaso: 'CASO 04',
    badgeTienda: '0% REAL',
    nombreCorto: '6 Cuotas Genuinas 0.00% TEA sin Recargo ni Descuento Oculto',
    subtitulo:
      'Precio unico Q7,200 en efectivo o 6 pagos exactos de Q1,200.00 — Conviene financiar e invertir liquidez',
    categoria: 'Comercio Transparente / Linea Profesional',
    emisorDocumento: 'IMPORTADORA MEDICA Y OPTICA DE GUATEMALA S.A. — FACTURA ELECTRONICA FEL',
    codigoReferenciaDoc: 'FEL-DTE-2026-90312',
    fechaEmisionDoc: '31 OCT 2026',
    tipoComprobante: 'FACTURA_CERO_INTERES',
    LineasEncabezadoDoc: [
      'PROPUESTA DE PAGO TRANSPARENTE — PRECIO UNICO GARANTIZADO',
      'CUMPLIMIENTO TOTAL: SIN RECARGO POR TARJETA NI COMISIONES OCULTAS',
      'MODALIDAD: 6 CUOTAS SIN INTERESES DE Q1,200.00',
    ],
    cuerpoDocumento: {
      conceptoPrincipal: 'Paquete de Equipamiento Ergonomico y Monitor Calibrado 4K 32"',
      skuOModelo: 'ERG-MON4K-32-GT',
      bloquePromocional:
        'PRECIO TOTAL EN 6 CUOTAS: Q7,200.00 — 6 PAGOS EXACTOS DE Q1,200.00 (0.00% TEA EFECTIVA)',
      bloqueCondicionesEfectivo:
        'PRECIO EN EFECTIVO, TRANSFERENCIA O TARJETA EN 1 PAGO: Q7,200.00 (Mismo precio garantizado sin diferenciacion por medio de pago).',
      letraPequenaClausulas: [
        'Garantia de Transparencia 1: El comercio absorbe integramente la comision bancaria del POS de cuotas sin trasladarla al comprador.',
        'Garantia de Transparencia 2: Cero cobro por administracion mensual, cero seguro obligatorio atado y cero comision de apertura.',
        'Ventaja de Liquidez: Al conservar los Q7,200.00 en un instrumento que rinda >5.0% anual (ej. 6.5% anual en cuenta remunerada o CDP en GT), el comprador gana intereses netos mientras paga las 6 cuotas.',
      ],
    },
    pins: [
      {
        id: 'c4-pin-1',
        numero: '01',
        etiqueta: 'Division Exacta: 6 x Q1,200.00 = Q7,200.00',
        extractoLiteral: 'PRECIO TOTAL EN 6 CUOTAS: Q7,200.00 — 6 PAGOS EXACTOS DE Q1,200.00',
        impactoFinanciero:
          'La suma de las 6 cuotas coincide al centavo con el precio de contado. La TIR mensual es 0.00% y la TEA efectiva anual es 0.00%.',
        severidad: 'transparente',
        campoVinculado: 'precioListaNominal',
        coordenadasPct: { top: 26, left: 4, width: 92, height: 18 },
      },
      {
        id: 'c4-pin-2',
        numero: '02',
        etiqueta: 'Sin Descuento Oculto en Efectivo (Mismo Precio Q7,200.00)',
        extractoLiteral:
          'PRECIO EN EFECTIVO O TRANSFERENCIA: Q7,200.00 (Cero diferencial contado vs. lista)',
        impactoFinanciero:
          'Al no existir precio inferior por pago en efectivo, no hay costo de oportunidad perdido al elegir las cuotas.',
        severidad: 'transparente',
        campoVinculado: 'precioContadoEfectivo',
        coordenadasPct: { top: 47, left: 4, width: 92, height: 18 },
      },
      {
        id: 'c4-pin-3',
        numero: '03',
        etiqueta: 'Arbitraje Positivo de Liquidez (>5% Anual)',
        extractoLiteral:
          'Cero seguros y cero comisiones: conservar Q7,200 rindiendo 6.5% anual genera ganancia neta',
        impactoFinanciero:
          'Tomar las 6 cuotas al 0.00% TEA y mantener el capital al 6.5% anual genera un beneficio financiero neto a favor del comprador.',
        severidad: 'transparente',
        campoVinculado: 'tasaRendimientoLiquidezAnualPct',
        coordenadasPct: { top: 68, left: 4, width: 92, height: 26 },
      },
    ],
    input: {
      id: 'caso-4-cuotas-genuinas-0pct',
      titulo: 'Caso 4 — 6 Cuotas Genuinas a 0% sin Recargo ni Descuento Oculto',
      comercioOEntidad: 'Importadora Profesional GT (Precio Unico)',
      tipoOferta: 'retail_cuotas',
      frecuenciaPago: 'mensual',
      moneda: 'GTQ',
      precioListaNominal: 7200.0,
      precioContadoEfectivo: 7200.0,
      plazoMeses: 6,
      tasaNominalMensualAnunciadaPct: 0,
      recargoCuotasPct: 0,
      comisionDesembolsoPct: 0,
      comisionDesembolsoFija: 0,
      cobroAdministrativoMensual: 0,
      seguroMensualFijo: 0,
      seguroSaldoDeudorMensualPct: 0,
      aplicaIvaSobreInteresesYComisiones: false,
      tasaIvaPct: 12,
      tasaRendimientoLiquidezAnualPct: 6.5,
      cuotaAnunciadaVendedor: 1200.0,
    },
  },
];

/**
 * Casos reales verificados en el DOM de elektra.com.gt y max.com.gt para auditoria mobile-first.
 */
export const REAL_GUATEMALA_ECOMMERCE_CASES: GuatemalaPresetCase[] = [
  {
    id: 'elektra-tv-lg-65',
    numeroCaso: 'ELEKTRA 01',
    badgeTienda: 'ELEKTRA SEMANAL',
    nombreCorto: 'Smart TV LG 65" 4K (65NU850BPSA) — Q71 Semanales vs. Q4,195 Contado',
    subtitulo:
      'elektra.com.gt: Precio tachado Q8,999 | Oferta contado Q4,195 | Abono Q71/sem (Plazo oculto tras DPI+OTP)',
    categoria: 'Elektra GT / Prestamo Banco Azteca',
    emisorDocumento: 'ELEKTRA DE GUATEMALA / BANCO AZTECA — CAPTURA DOM REAL ELEKTRA.COM.GT',
    codigoReferenciaDoc: 'ELK-GT-65NU850BPSA',
    fechaEmisionDoc: '01 NOV 2026',
    tipoComprobante: 'ELEKTRA_SEMANAL',
    LineasEncabezadoDoc: [
      'FICHA DE PRODUCTO VERIFICADA EN ELEKTRA.COM.GT',
      'MODELO: LG 65" UHD 4K 65NU850BPSA | FINANCIAMIENTO: PRESTAMO BANCO AZTECA',
      'ALERTA UX: NUMERO DE SEMANAS OCULTO DETRAS DE MURO DE DPI + CELULAR + OTP SMS',
    ],
    cuerpoDocumento: {
      conceptoPrincipal: 'Smart TV LG 65 Pulgadas 4K UHD AI ThinQ (Mod. 65NU850BPSA)',
      skuOModelo: '65NU850BPSA',
      bloquePromocional:
        'COMPRALO CON TU CREDITO DESDE: Q71.00 SEMANALES* (Precio normal tachado: Q8,999.00)',
      bloqueCondicionesEfectivo:
        'PRECIO OFERTA DE CONTADO EN LINEA: Q4,195.00 (Con Q71/semana necesitas 59.08 semanas solo para empatar el precio de contado a 0% interes).',
      letraPequenaClausulas: [
        'Hallazgo 1 (Plazo Oculto): La tarjeta web muestra Q71 semanales sin revelar si el contrato es a 104, 128 o 154 semanas hasta entregar DPI y validar codigo SMS.',
        'Hallazgo 2 (Proyeccion de Plazos Reales): En 104 semanas pagas Q7,384 (+76% sobrecosto, 77.7% TEA); en 128 semanas pagas Q9,088 (+117%, 92.2% TEA); en 154 semanas pagas Q10,934 (+161%, 100.3% TEA).',
        'Hallazgo 3 (Garantia Extendida Milenia): Checkbox opcional en carrito que agrega costo semanal adicional sobre el financiamiento.',
      ],
    },
    pins: [
      {
        id: 'elk1-pin-1',
        numero: '01',
        etiqueta: 'Abono Semanal Anunciado sin Plazo Visible (Q71/semana)',
        extractoLiteral: 'Compralo con Prestamo Banco Azteca desde Q71.00 semanales (Plazo omitido en ficha)',
        impactoFinanciero:
          'A Q71 por semana necesitas 59.1 semanas unicamente para cubrir el valor de contado (Q4,195). A partir de la semana 60 trabajas exclusivamente para pagar intereses.',
        severidad: 'trampa',
        campoVinculado: 'abonoSemanalAnunciado',
        coordenadasPct: { top: 25, left: 4, width: 92, height: 18 },
      },
      {
        id: 'elk1-pin-2',
        numero: '02',
        etiqueta: 'Precio Real de Oferta al Contado (Q4,195.00)',
        extractoLiteral: 'Precio Oferta en Linea: Q4,195.00 (Precio normal tachado ancla: Q8,999.00)',
        impactoFinanciero:
          'El precio tachado de Q8,999 sirve como ancla psicologica para que pagar Q7,384 (104 sem) o Q9,088 (128 sem) parezca razonable frente al verdadero precio de mercado de Q4,195.',
        severidad: 'transparente',
        campoVinculado: 'precioContadoEfectivo',
        coordenadasPct: { top: 47, left: 4, width: 92, height: 18 },
      },
      {
        id: 'elk1-pin-3',
        numero: '03',
        etiqueta: 'Matriz de Plazos Banco Azteca (104 / 128 / 154 Semanas)',
        extractoLiteral: '104 sem = Q7,384 (+Q3,189) | 128 sem = Q9,088 (+Q4,893) | 154 sem = Q10,934 (+Q6,739)',
        impactoFinanciero:
          'Compuesto a 52 semanas por ano, el costo financiero real oscila entre 77.7% y 100.3% de Tasa Efectiva Anual (TEA).',
        severidad: 'trampa',
        campoVinculado: 'plazoSemanas',
        coordenadasPct: { top: 68, left: 4, width: 92, height: 26 },
      },
    ],
    input: {
      id: 'elektra-tv-lg-65',
      titulo: 'Elektra GT — Smart TV LG 65" 4K (65NU850BPSA)',
      comercioOEntidad: 'Elektra Guatemala / Banco Azteca',
      tipoOferta: 'elektra_semanal',
      frecuenciaPago: 'semanal',
      moneda: 'GTQ',
      precioListaNominal: 8999.0,
      precioContadoEfectivo: 4195.0,
      plazoMeses: 24,
      plazoSemanas: 104,
      abonoSemanalAnunciado: 71.0,
      garantiaExtendidaSemanal: 0,
      tasaNominalMensualAnunciadaPct: 0,
      recargoCuotasPct: 0,
      comisionDesembolsoPct: 0,
      comisionDesembolsoFija: 0,
      cobroAdministrativoMensual: 0,
      seguroMensualFijo: 0,
      seguroSaldoDeudorMensualPct: 0,
      aplicaIvaSobreInteresesYComisiones: false,
      tasaIvaPct: 12,
      tasaRendimientoLiquidezAnualPct: 6.5,
      cuotaAnunciadaVendedor: 71.0,
    },
  },
  {
    id: 'elektra-iphone-17-pro-max',
    numeroCaso: 'ELEKTRA 02',
    badgeTienda: 'ELEKTRA IPHONE',
    nombreCorto: 'iPhone 17 Pro Max 256GB — Q259 Semanales vs. Q12,995 Contado',
    subtitulo:
      'elektra.com.gt: Lista Q15,599 | Oferta contado Q12,995 | Abono Q259/sem (Equilibrio en 50.2 semanas)',
    categoria: 'Elektra GT / telefonia Movil',
    emisorDocumento: 'ELEKTRA DE GUATEMALA / BANCO AZTECA — DEPARTAMENTO TELEFONIA',
    codigoReferenciaDoc: 'ELK-GT-IP17PM-256',
    fechaEmisionDoc: '01 NOV 2026',
    tipoComprobante: 'ELEKTRA_SEMANAL',
    LineasEncabezadoDoc: [
      'FICHA DE PRODUCTO VERIFICADA EN ELEKTRA.COM.GT',
      'MODELO: APPLE IPHONE 17 PRO MAX 256GB | MONEDA: QUETZALES (GTQ)',
      'MODALIDAD: ABONO SEMANAL CON CREDITO BANCO AZTECA',
    ],
    cuerpoDocumento: {
      conceptoPrincipal: 'Apple iPhone 17 Pro Max 256GB Desbloqueado',
      skuOModelo: 'IP17-PROMAX-256',
      bloquePromocional:
        'ABONO SEMANAL PUBLICITADO: Q259.00 SEMANALES* (Precio normal tachado: Q15,599.00)',
      bloqueCondicionesEfectivo:
        'PRECIO OFERTA DE CONTADO: Q12,995.00 (50.17 semanas de Q259 cubren el 100% del valor de contado).',
      letraPequenaClausulas: [
        'Proyeccion a 78 semanas (1.5 anos): Total pagado Q20,202.00 (+Q7,207.00 de sobrecosto sobre contado).',
        'Proyeccion a 104 semanas (2 anos): Total pagado Q26,936.00 (+Q13,941.00 de sobrecosto, pagas mas de dos iPhones).',
      ],
    },
    pins: [
      {
        id: 'elkip-pin-1',
        numero: '01',
        etiqueta: 'Abono Semanal Q259.00 (Equilibrio en Semana 50.2)',
        extractoLiteral: 'Q259.00 semanales — En 50.17 semanas ya cubriste los Q12,995.00 del equipo',
        impactoFinanciero:
          'Si el contrato se firma a 104 semanas, pagas 53.8 semanas adicionales (Q13,941.00) exclusivamente en intereses.',
        severidad: 'trampa',
        campoVinculado: 'abonoSemanalAnunciado',
        coordenadasPct: { top: 25, left: 4, width: 92, height: 18 },
      },
      {
        id: 'elkip-pin-2',
        numero: '02',
        etiqueta: 'Precio Efectivo de Oferta Q12,995.00',
        extractoLiteral: 'Precio Oferta Contado: Q12,995.00 vs. Lista Tachado Q15,599.00',
        impactoFinanciero:
          'Base real de comparacion para calcular la Tasa Efectiva Anual de 113.1% TEA (a 104 semanas).',
        severidad: 'transparente',
        campoVinculado: 'precioContadoEfectivo',
        coordenadasPct: { top: 50, left: 4, width: 92, height: 20 },
      },
    ],
    input: {
      id: 'elektra-iphone-17-pro-max',
      titulo: 'Elektra GT — iPhone 17 Pro Max 256GB (Q259 Semanales)',
      comercioOEntidad: 'Elektra Guatemala / Banco Azteca',
      tipoOferta: 'elektra_semanal',
      frecuenciaPago: 'semanal',
      moneda: 'GTQ',
      precioListaNominal: 15599.0,
      precioContadoEfectivo: 12995.0,
      plazoMeses: 24,
      plazoSemanas: 104,
      abonoSemanalAnunciado: 259.0,
      garantiaExtendidaSemanal: 0,
      tasaNominalMensualAnunciadaPct: 0,
      recargoCuotasPct: 0,
      comisionDesembolsoPct: 0,
      comisionDesembolsoFija: 0,
      cobroAdministrativoMensual: 0,
      seguroMensualFijo: 0,
      seguroSaldoDeudorMensualPct: 0,
      aplicaIvaSobreInteresesYComisiones: false,
      tasaIvaPct: 12,
      tasaRendimientoLiquidezAnualPct: 6.5,
      cuotaAnunciadaVendedor: 259.0,
    },
  },
  {
    id: 'max-samsung-a37-5g',
    numeroCaso: 'MAX GT 01',
    badgeTienda: 'MAX VISACUOTAS',
    nombreCorto: 'Tiendas MAX — Samsung Galaxy A37 5G (Precio Regular vs. Oferta -19%)',
    subtitulo:
      'max.com.gt: Precio Regular Q3,695 vs. Oferta Efectivo Q2,996 (-Q699) + Seguro Facil Q35/mes',
    categoria: 'Tiendas MAX Guatemala (max.com.gt)',
    emisorDocumento: 'DISTELSA S.A. / TIENDAS MAX GUATEMALA — FICHA DE PRODUCTO MAX.COM.GT',
    codigoReferenciaDoc: 'MAX-GT-SM-A376E',
    fechaEmisionDoc: '01 NOV 2026',
    tipoComprobante: 'MAX_OFERTA_VS_REGULAR',
    LineasEncabezadoDoc: [
      'COTIZACION VERIFICADA EN MAX.COM.GT — TELEFONIA DESBLOQUEADA',
      'PRECIO REGULAR DE LISTA: Q3,695.00 | PRECIO DE OFERTA (-19%): Q2,996.00',
      'OPCION ADICIONAL EN CARRITO: PROGRAMA SEGURO FACIL MAX',
    ],
    cuerpoDocumento: {
      conceptoPrincipal: 'Celular Samsung Galaxy A37 5G 256GB / 8GB RAM',
      skuOModelo: 'SM-A376EZKTGTO',
      bloquePromocional:
        '12 CUOTAS SOBRE PRECIO REGULAR DE LISTA (Q3,695.00): 12 PAGOS DE Q307.92 ("0% INTERES")',
      bloqueCondicionesEfectivo:
        'PRECIO DE OFERTA EN LINEA / CONTADO (-19%): Q2,996.00 (Si las cuotas se calculan sobre el Precio Regular pierdes Q699.00 de descuento inmediato).',
      letraPequenaClausulas: [
        'Clausula 1 (Diferencial Regular vs Oferta): Cuando un comercio condiciona las 12 Visacuotas al Precio Regular (Q3,695.00) en lugar del Precio de Oferta (Q2,996.00), el comprador asume Q699.00 de interes implicito.',
        'Clausula 2 (Seguro Facil): Agregar la cobertura mensual opcional de Q35.00/mes suma Q420.00 adicionales en el ano, llevando el sobrecosto total a Q1,119.00 (72.64% TEA).',
      ],
    },
    pins: [
      {
        id: 'max1-pin-1',
        numero: '01',
        etiqueta: 'Perdida del Descuento de Oferta (-19% = Q699.00)',
        extractoLiteral: 'Precio Regular Q3,695.00 vs. Precio de Oferta Q2,996.00 (Diferencia de Q699.00)',
        impactoFinanciero:
          'Financiar a 12 meses sobre Q3,695 cuando el telefono cuesta Q2,996 de contado equivale por si solo a una TEA del 45.2% anual.',
        severidad: 'trampa',
        campoVinculado: 'precioListaNominal',
        coordenadasPct: { top: 25, left: 4, width: 92, height: 18 },
      },
      {
        id: 'max1-pin-2',
        numero: '02',
        etiqueta: 'Seguro Facil Mensual Adicional (Q35.00/mes)',
        extractoLiteral: 'Cobertura Seguro Facil facturada mensualmente: Q35.00/mes (Q420.00 en 12 meses)',
        impactoFinanciero:
          'Sumado a los Q699.00 de diferencial de precio, eleva la cuota real a Q342.92/mes y la TEA efectiva anual a 72.64%.',
        severidad: 'trampa',
        campoVinculado: 'seguroMensualFijo',
        coordenadasPct: { top: 52, left: 4, width: 92, height: 20 },
      },
    ],
    input: {
      id: 'max-samsung-a37-5g',
      titulo: 'Tiendas MAX GT — Samsung Galaxy A37 5G (Regular Q3,695 vs Oferta Q2,996)',
      comercioOEntidad: 'Tiendas MAX Guatemala (max.com.gt)',
      tipoOferta: 'retail_cuotas',
      frecuenciaPago: 'mensual',
      moneda: 'GTQ',
      precioListaNominal: 3695.0,
      precioContadoEfectivo: 2996.0,
      plazoMeses: 12,
      tasaNominalMensualAnunciadaPct: 0,
      recargoCuotasPct: 0,
      comisionDesembolsoPct: 0,
      comisionDesembolsoFija: 0,
      cobroAdministrativoMensual: 0,
      seguroMensualFijo: 35.0,
      seguroSaldoDeudorMensualPct: 0,
      aplicaIvaSobreInteresesYComisiones: false,
      tasaIvaPct: 12,
      tasaRendimientoLiquidezAnualPct: 6.5,
      cuotaAnunciadaVendedor: 307.92,
    },
  },
];

export const ALL_UI_CASES: GuatemalaPresetCase[] = [
  ...REAL_GUATEMALA_ECOMMERCE_CASES,
  ...GUATEMALA_PRESET_CASES,
];
