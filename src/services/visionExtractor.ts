import { CreditOfferInput } from '../engine/creditAudit.ts';
import { DocumentClausePin } from '../data/guatemalaCases.ts';

export interface VisionExtractionResult {
  origen: 'gemini-2.5-flash' | 'heuristica-local';
  confianzaPct: number;
  observaciones: string;
  inputExtraido: CreditOfferInput;
  pinsDetectados: DocumentClausePin[];
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve({
        base64,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Analiza una fotografia o captura de oferta a cuotas (Elektra semanal, MAX mensual o contrato bancario)
 * usando Gemini 2.5 Flash multimodal si se proporciona API Key, o parser heuristico local inmediato.
 */
export async function extractOfferFromImageOrText(options: {
  file?: File;
  rawText?: string;
  apiKey?: string;
  currentInput: CreditOfferInput;
}): Promise<VisionExtractionResult> {
  const { file, rawText, apiKey, currentInput } = options;
  const cleanKey = (apiKey || import.meta.env.VITE_GEMINI_API_KEY || '').trim();

  if (file && cleanKey) {
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const prompt = `Eres un auditor matematico financiero especializado en credito al consumo en Guatemala (Elektra / Banco Azteca abonos semanales, Tiendas MAX Visacuotas y extrafinanciamiento bancario).
Analiza la imagen del comprobante, captura de celular, etiqueta de precio o contrato y extrae un objeto JSON estricto.
Si detectas "semanales", "abono semanal" o "Prestamo Banco Azteca", usa "tipoOferta": "elektra_semanal", "frecuenciaPago": "semanal" y coloca el monto en "abonoSemanalAnunciado" (con "plazoSemanas": 104 si el plazo esta oculto).
Devuelve UNICAMENTE JSON valido con esta estructura exacta:
{
  "titulo": "string",
  "comercioOEntidad": "string",
  "tipoOferta": "elektra_semanal" | "retail_cuotas" | "extrafinanciamiento_bancario",
  "frecuenciaPago": "semanal" | "mensual",
  "moneda": "GTQ" | "USD",
  "precioListaNominal": number,
  "precioContadoEfectivo": number,
  "plazoMeses": number,
  "plazoSemanas": number,
  "abonoSemanalAnunciado": number,
  "garantiaExtendidaSemanal": number,
  "tasaNominalMensualAnunciadaPct": number,
  "recargoCuotasPct": number,
  "comisionDesembolsoPct": number,
  "comisionDesembolsoFija": number,
  "cobroAdministrativoMensual": number,
  "seguroMensualFijo": number,
  "seguroSaldoDeudorMensualPct": number,
  "aplicaIvaSobreInteresesYComisiones": boolean,
  "cuotaAnunciadaVendedor": number,
  "observaciones": "string explicando que recargos o clausulas detectaste"
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          cleanKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status} al consultar Gemini 2.5 Flash`);
      }

      const payload = await response.json();
      const rawJson = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawJson);

      const isWeekly =
        parsed.tipoOferta === 'elektra_semanal' || parsed.frecuenciaPago === 'semanal';

      const extracted: CreditOfferInput = {
        ...currentInput,
        titulo: parsed.titulo || `Documento Auditado (${file.name})`,
        comercioOEntidad: parsed.comercioOEntidad || 'Comercio / Emisor Detectado',
        tipoOferta: isWeekly
          ? 'elektra_semanal'
          : parsed.tipoOferta === 'extrafinanciamiento_bancario'
          ? 'extrafinanciamiento_bancario'
          : 'retail_cuotas',
        frecuenciaPago: isWeekly ? 'semanal' : 'mensual',
        moneda: parsed.moneda === 'USD' ? 'USD' : 'GTQ',
        precioListaNominal: Number(parsed.precioListaNominal) || currentInput.precioListaNominal,
        precioContadoEfectivo:
          Number(parsed.precioContadoEfectivo) ||
          Number(parsed.precioListaNominal) ||
          currentInput.precioContadoEfectivo,
        plazoMeses: Math.max(1, Math.round(Number(parsed.plazoMeses) || currentInput.plazoMeses)),
        plazoSemanas: Math.max(4, Math.round(Number(parsed.plazoSemanas) || 104)),
        abonoSemanalAnunciado: Number(parsed.abonoSemanalAnunciado) || undefined,
        garantiaExtendidaSemanal: Number(parsed.garantiaExtendidaSemanal) || 0,
        tasaNominalMensualAnunciadaPct: Number(parsed.tasaNominalMensualAnunciadaPct) || 0,
        recargoCuotasPct: Number(parsed.recargoCuotasPct) || 0,
        comisionDesembolsoPct: Number(parsed.comisionDesembolsoPct) || 0,
        comisionDesembolsoFija: Number(parsed.comisionDesembolsoFija) || 0,
        cobroAdministrativoMensual: Number(parsed.cobroAdministrativoMensual) || 0,
        seguroMensualFijo: Number(parsed.seguroMensualFijo) || 0,
        seguroSaldoDeudorMensualPct: Number(parsed.seguroSaldoDeudorMensualPct) || 0,
        aplicaIvaSobreInteresesYComisiones: Boolean(parsed.aplicaIvaSobreInteresesYComisiones),
        cuotaAnunciadaVendedor: parsed.cuotaAnunciadaVendedor
          ? Number(parsed.cuotaAnunciadaVendedor)
          : undefined,
      };

      return {
        origen: 'gemini-2.5-flash',
        confianzaPct: 94,
        observaciones:
          parsed.observaciones ||
          `Terminos extraidos mediante Gemini 2.5 Flash desde ${file.name}. Puedes ajustar cualquier cifra en el panel de parametros.`,
        inputExtraido: extracted,
        pinsDetectados: buildPinsFromExtractedInput(extracted),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      return runLocalHeuristicExtraction(
        rawText || file.name,
        currentInput,
        `Extraccion asistida local activada (${msg}). Revisa y ajusta los montos del comprobante.`
      );
    }
  }

  return runLocalHeuristicExtraction(
    rawText || (file ? file.name : ''),
    currentInput,
    file
      ? `Comprobante "${file.name}" cargado en el visor. Ajusta los montos directamente o ingresa tu Gemini API Key para lectura optica automatica.`
      : 'Texto de oferta procesado mediante parser financiero determinista.'
  );
}

function runLocalHeuristicExtraction(
  text: string,
  baseInput: CreditOfferInput,
  fallbackNote: string
): VisionExtractionResult {
  const normalized = text.replace(/,/g, '');
  const next: CreditOfferInput = { ...baseInput };

  const isSemanal = /semanal|semanas|elektra|azteca/i.test(normalized);
  if (isSemanal) {
    next.tipoOferta = 'elektra_semanal';
    next.frecuenciaPago = 'semanal';
    const semMatch = normalized.match(/(\d{2,3})\s*semanas/i);
    next.plazoSemanas = semMatch ? parseInt(semMatch[1], 10) : next.plazoSemanas || 104;

    const abonoMatch =
      normalized.match(/Q\s*(\d+(?:\.\d{1,2})?)\s*semanal/i) ||
      normalized.match(/abono\s*(?:semanal)?\s*(?:de)?\s*Q?\s*(\d+(?:\.\d{1,2})?)/i);
    if (abonoMatch) {
      next.abonoSemanalAnunciado = parseFloat(abonoMatch[1]);
      next.cuotaAnunciadaVendedor = next.abonoSemanalAnunciado;
    }
  } else {
    const plazoMatch = normalized.match(/(\d{1,2})\s*(cuotas|visacuotas|credicuotas|meses|pagos)/i);
    if (plazoMatch) {
      const m = parseInt(plazoMatch[1], 10);
      if (m >= 2 && m <= 72) {
        next.plazoMeses = m;
        next.frecuenciaPago = 'mensual';
        if (next.tipoOferta === 'elektra_semanal') {
          next.tipoOferta = 'retail_cuotas';
        }
      }
    }
  }

  const qMatches = Array.from(normalized.matchAll(/Q\s*(\d+(?:\.\d{1,2})?)/gi)).map((m) =>
    parseFloat(m[1])
  );
  if (qMatches.length >= 2) {
    const largeAmounts = [...qMatches].filter((v) => v > 1200).sort((a, b) => b - a);
    if (largeAmounts.length >= 2) {
      next.precioListaNominal = largeAmounts[0];
      next.precioContadoEfectivo = largeAmounts[1];
    } else if (largeAmounts.length === 1) {
      next.precioListaNominal = largeAmounts[0];
      next.precioContadoEfectivo = largeAmounts[0];
    }
    const smallFee = qMatches.find((v) => v >= 20 && v <= 450);
    if (smallFee) {
      if (isSemanal) {
        next.abonoSemanalAnunciado = smallFee;
      } else {
        next.cobroAdministrativoMensual = smallFee;
      }
    }
  }

  const pctMatch = normalized.match(/(\d+(?:\.\d+)?)\s*%\s*mensual/i);
  if (pctMatch) {
    next.tasaNominalMensualAnunciadaPct = parseFloat(pctMatch[1]);
  }

  return {
    origen: 'heuristica-local',
    confianzaPct: 88,
    observaciones: fallbackNote,
    inputExtraido: next,
    pinsDetectados: buildPinsFromExtractedInput(next),
  };
}

function buildPinsFromExtractedInput(input: CreditOfferInput): DocumentClausePin[] {
  if (input.tipoOferta === 'elektra_semanal' || input.frecuenciaPago === 'semanal') {
    const abono = input.abonoSemanalAnunciado ?? 71;
    const eqSemanas = input.precioContadoEfectivo > 0 ? input.precioContadoEfectivo / abono : 0;
    return [
      {
        id: 'ext-sem-1',
        numero: '01',
        etiqueta: `Abono Semanal Detectado (${input.moneda} ${abono.toFixed(2)}/sem)`,
        extractoLiteral: `Equilibrio de capital en ${eqSemanas.toFixed(1)} semanas sobre contado ${input.moneda} ${input.precioContadoEfectivo.toFixed(2)}`,
        impactoFinanciero:
          'El plazo total en semanas determina cuantas semanas adicionales pagas exclusivamente en intereses.',
        severidad: 'trampa',
        campoVinculado: 'abonoSemanalAnunciado',
        coordenadasPct: { top: 24, left: 5, width: 90, height: 20 },
      },
      {
        id: 'ext-sem-2',
        numero: '02',
        etiqueta: `Precio Contado / Oferta (${input.moneda} ${input.precioContadoEfectivo.toFixed(2)})`,
        extractoLiteral: `Precio lista tachado: ${input.moneda} ${input.precioListaNominal.toFixed(2)}`,
        impactoFinanciero:
          'El verdadero costo del financiamiento debe medirse contra el precio de oferta de contado, no contra el precio tachado.',
        severidad: 'transparente',
        campoVinculado: 'precioContadoEfectivo',
        coordenadasPct: { top: 50, left: 5, width: 90, height: 20 },
      },
    ];
  }

  const diffContado = Math.max(0, input.precioListaNominal - input.precioContadoEfectivo);
  return [
    {
      id: 'ext-pin-1',
      numero: '01',
      etiqueta: `Precio Financiado / Nominal (${input.moneda} ${input.precioListaNominal.toLocaleString('en-US', { minimumFractionDigits: 2 })})`,
      extractoLiteral: `Plazo: ${input.plazoMeses} meses | Tasa anunciada: ${input.tasaNominalMensualAnunciadaPct.toFixed(2)}% mensual`,
      impactoFinanciero:
        diffContado > 0
          ? `Incluye un sobreprecio de ${input.moneda} ${diffContado.toFixed(2)} frente al pago de contado.`
          : 'Base de calculo sobre la que el emisor estructura las cuotas.',
      severidad: diffContado > 0 ? 'trampa' : 'transparente',
      campoVinculado: 'precioListaNominal',
      coordenadasPct: { top: 24, left: 5, width: 90, height: 18 },
    },
    {
      id: 'ext-pin-2',
      numero: '02',
      etiqueta: `Valor Efectivo de Contado (${input.moneda} ${input.precioContadoEfectivo.toLocaleString('en-US', { minimumFractionDigits: 2 })})`,
      extractoLiteral: `Comision inicial: ${input.comisionDesembolsoPct.toFixed(1)}% | Recargo tarjeta: ${input.recargoCuotasPct.toFixed(1)}%`,
      impactoFinanciero:
        'Capital real recibido o ahorrado en el dia 0 para determinar la Tasa Efectiva Anual (TEA).',
      severidad:
        input.comisionDesembolsoPct > 0 || input.recargoCuotasPct > 0 ? 'trampa' : 'transparente',
      campoVinculado: 'precioContadoEfectivo',
      coordenadasPct: { top: 48, left: 5, width: 90, height: 18 },
    },
    {
      id: 'ext-pin-3',
      numero: '03',
      etiqueta: 'Cargos Recurrentes Mensuales (Seguros, Admin e IVA)',
      extractoLiteral: `Admin: ${input.moneda} ${input.cobroAdministrativoMensual.toFixed(2)}/mes | Seguro fijo: ${input.moneda} ${input.seguroMensualFijo.toFixed(2)}/mes | Seguro saldo: ${input.seguroSaldoDeudorMensualPct.toFixed(2)}%/mes`,
      impactoFinanciero:
        'Los cargos fijos mensuales actuan como interes adicional que se encarece conforme baja el saldo de capital.',
      severidad:
        input.cobroAdministrativoMensual > 0 ||
        input.seguroMensualFijo > 0 ||
        input.seguroSaldoDeudorMensualPct > 0
          ? 'trampa'
          : 'transparente',
      campoVinculado: 'cobroAdministrativoMensual',
      coordenadasPct: { top: 70, left: 5, width: 90, height: 22 },
    },
  ];
}
