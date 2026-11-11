import { DecisionPanel } from './components/DecisionPanel.tsx';
import { AccessibleDialog } from './components/AccessibleDialog.tsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeCommitment, validateCommitment, formatMarketMoney, MARKETS, type Country, type CommitmentInput } from './engine/offerConsultant.ts';
import { TermsFields, CommitmentExplanation, EMPTY_TERMS, type OfferTerms } from './components/OfferConsultation.tsx';
import {
  STORE_OFFER_SAMPLES,
  StoreOfferSample,
} from './data/storeSamples';
type StepView = 'input' | 'result';
interface PhotoOffer { installmentNeedsConfirmation?: boolean; extractionStatus?: 'complete' | 'partial' | 'not-offer' | 'currency-mismatch' | 'unsupported-currency'; hasOfferData?: boolean; missingFields?: string[]; isValidOfferImage: boolean; needsCurrencyConfirmation?: boolean; country?: Country | null; currency?: string; cashPrice?: number; installmentAmount?: number; cashPriceQ?: number; installmentAmountQ?: number; installmentsCount: number; periodicity: PeriodicityUI; storeName?: string; productName?: string; rejectionReason?: string; downPayment?: number | null; upfrontFees?: number | null; periodicFees?: number | null; interestCondition?: CommitmentInput['interest']; imageDataUrl?: string; }
type PeriodicityUI = 'semanal' | 'quincenal' | 'mensual';

interface OcrRejectionState {
  imageDataUrl: string;
  reason: string;
  partialCashPriceQ?: number;
  partialInstallmentAmountQ?: number;
  partialInstallmentsCount?: number;
  partialPeriodicity?: PeriodicityUI;
  partialStoreName?: string;
  partialProductName?: string;
  partialCountry?: Country;
  partialTerms?: OfferTerms;
}

/** Prepare a small image without making optional cache or object URL support a requirement. */
function resizeImageForOcr(file: File, maxDimension = 1200, quality = 0.78): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let url: string | undefined;
    let reader: FileReader | undefined;
    const cleanup = () => {
      clearTimeout(timer); image.onload = null; image.onerror = null;
      if (url) URL.revokeObjectURL(url);
      if (reader) { reader.onload = null; reader.onerror = null; if (reader.readyState === FileReader.LOADING) reader.abort(); }
    };
    const fail = () => { cleanup(); reject(new Error('No se pudo abrir la foto.')); };
    const timer = setTimeout(fail, 10000);
    const decodeWithReader = () => {
      if (reader) { fail(); return; }
      reader = new FileReader();
      reader.onload = () => { if (typeof reader?.result === 'string') image.src = reader.result; else fail(); };
      reader.onerror = fail;
      try { reader.readAsDataURL(file); } catch { fail(); }
    };
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        cleanup(); resolve({ dataUrl, base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      } catch { fail(); }
    };
    image.onerror = decodeWithReader;
    try { url = URL.createObjectURL(file); image.src = url; } catch { decodeWithReader(); }
  });
}

export const App: React.FC = () => {
  const [country, setCountry] = useState<Country>('GT');
  const [terms, setTerms] = useState<OfferTerms>(EMPTY_TERMS);
  const [illustrative, setIllustrative] = useState(false);
  const [partialOffer, setPartialOffer] = useState<PhotoOffer | null>(null);
  const [pendingCurrency, setPendingCurrency] = useState<PhotoOffer | null>(null);
  const latestDraft = useRef('');
  const imageCache = useRef(new Map<string, PhotoOffer>());
  const analysisRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const formatQ = (value: number) => formatMarketMoney(value, country);
  const [step, setStepValue] = useState<StepView>('input');
  const setStep = (value: StepView) => {
    const current = window.location.hash === '#oferta' ? 'result' : 'input';
    if (current !== value) {
      if (value === 'result') window.history.pushState({ ...window.history.state, cuotasView: value }, '', '#oferta');
      else if (window.history.state?.cuotasView === 'result') window.history.back();
      else window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
    setStepValue(value);
  };
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const back = () => setStepValue(window.location.hash === '#oferta' ? 'result' : 'input');
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const [selectedSample, setSelectedSample] = useState<StoreOfferSample | null>(
    STORE_OFFER_SAMPLES[1]
  );
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [isUserUploadedOcr, setIsUserUploadedOcr] = useState<boolean>(false);
  const [isManualAdjustOpen, setIsManualAdjustOpen] = useState<boolean>(false);

  // Estado de carga y alerta de validacion OCR (Vertex AI)
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrRejection, setOcrRejection] = useState<OcrRejectionState | null>(null);

  // Datos activos del analisis
  const [tiendaNombre, setTiendaNombre] = useState<string>(STORE_OFFER_SAMPLES[1].tienda);
  const [productoNombre, setProductoNombre] = useState<string>(
    STORE_OFFER_SAMPLES[1].producto
  );
  const [precioContado, setPrecioContado] = useState<number>(
    STORE_OFFER_SAMPLES[1].precioContado
  );
  const [montoCuota, setMontoCuota] = useState<number>(STORE_OFFER_SAMPLES[1].montoCuota);
  const [numeroPagos, setNumeroPagos] = useState<number>(
    STORE_OFFER_SAMPLES[1].numeroPagos
  );
  const [frecuencia, setFrecuencia] = useState<PeriodicityUI>(
    STORE_OFFER_SAMPLES[1].frecuencia
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Guia interactiva (/?guia=1) y Modal de Feedback
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);

  // Auth & guardado

  const [authStatusMsg, setAuthStatusMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Instrumento de validacion (survey-research-designer)
  const [consentimientoAceptado, setConsentimientoAceptado] = useState<boolean>(false);
  const [claridadVeredicto, setClaridadVeredicto] = useState<number>(0);
  const [esfuerzoPercibido, setEsfuerzoPercibido] = useState<number>(0);
  const [intencionDeUso, setIntencionDeUso] = useState<string>('');
  const [sugerenciaAbierta, setSugerenciaAbierta] = useState<string>('');
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const [feedbackValidationError, setFeedbackValidationError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (ocrLoading) return;
    const heading = document.querySelector<HTMLElement>('main h1, main .ocr-rejection-title');
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, ocrLoading, pendingCurrency, ocrRejection]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('feedback') === '1') setShowFeedbackModal(true);
    if (params.get('guia') === '1') {
      setShowGuide(true);
    }

  }, []);

  useEffect(() => { if (feedbackValidationError) document.getElementById('feedback-error')?.focus(); }, [feedbackValidationError]);
  const downloadAnalysis = () => {
    const text = [productoNombre, `${MARKETS[country].currency} · ${tiendaNombre}`, comparison.title, `${numeroPagos} pagos de ${formatQ(comparison.periodic)} (${frecuencia})`, `Contado: ${formatQ(precioContado)}`, `Al inicio: ${formatQ(comparison.initial)} (anticipo ${formatQ(terms.downPayment)} + otros cargos ${formatQ(terms.upfrontFees)})`, `Cada pago: ${formatQ(montoCuota)} + cargos extra ${formatQ(terms.periodicFees)}`, `Intereses: ${terms.interest === 'unknown' ? 'sin confirmar' : terms.interest === 'advertised_zero' ? 'anuncia 0%; verificar condiciones' : 'incluidos en la cuota indicada'}`, `Cargos: ${terms.feesConfirmed ? 'confirmados por el usuario' : 'sin confirmar'}`, `Total indicado: ${formatQ(comparison.total)}`, `Diferencia: ${differenceLabel}`, comparison.conditionsComplete ? 'Condiciones confirmadas por el usuario.' : 'Total provisional: faltan condiciones por confirmar.', comparison.advice].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'analisis-cuotas.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const toggleGuide = () => {
    const next = !showGuide;
    setShowGuide(next);
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set('guia', '1');
    } else {
      url.searchParams.delete('guia');
    }
    window.history.replaceState({}, '', url.toString());
  };

  // Historical sample captures demonstrate the calculation, not a current quote.
  const handleSelectSample = (sample: StoreOfferSample) => {
    setPartialOffer(null);
    setCountry('GT');
    setTerms(EMPTY_TERMS);
    setIllustrative(true);
    setSelectedSample(sample);
    setCustomImageSrc(null);
    setIsUserUploadedOcr(false);
    setIsManualAdjustOpen(false);
    setOcrRejection(null);
    setTiendaNombre(sample.tienda);
    setProductoNombre(sample.producto);
    setPrecioContado(sample.precioContado);
    setMontoCuota(sample.montoCuota);
    setNumeroPagos(sample.numeroPagos);
    setFrecuencia(sample.frecuencia);
    setSaveSuccessMsg(null);
    setStep('result');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Opcion "Calcular sin foto" en 1 clic desde la pantalla inicial
  const handleCalculateWithoutPhoto = () => {
    setPartialOffer(null);
    setPendingCurrency(null);
    setSelectedSample(null);
    setTerms(EMPTY_TERMS);
    setIllustrative(false);
    setCustomImageSrc(null);
    setIsUserUploadedOcr(false);
    setIsManualAdjustOpen(true);
    setOcrRejection(null);
    setTiendaNombre('Cotizacion en tienda');
    setProductoNombre('Calculo rapido sin foto');
    setPrecioContado(0);
    setMontoCuota(0);
    setNumeroPagos(0);
    setFrecuencia('mensual');
    setSaveSuccessMsg(null);
    setStep('result');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const applyPhoto = useCallback((data: PhotoOffer, nextCountry: Country) => {
    setCountry(nextCountry); setPendingCurrency(null);
    setSelectedSample(null); setCustomImageSrc(data.imageDataUrl || null);
    setIsUserUploadedOcr(true); setIsManualAdjustOpen(!data.isValidOfferImage);
    setPartialOffer(data.isValidOfferImage ? null : data);
    setTiendaNombre(data.storeName || 'Tu oferta'); setProductoNombre(data.productName || 'Producto de tu oferta');
    setPrecioContado(Number(data.cashPrice ?? data.cashPriceQ) || 0);
    setMontoCuota(Number(data.installmentAmount ?? data.installmentAmountQ) || 0);
    setNumeroPagos(data.installmentsCount); setFrecuencia(data.periodicity || 'mensual');
    setTerms({ ...EMPTY_TERMS, downPayment: data.downPayment ?? 0, upfrontFees: data.upfrontFees ?? 0, periodicFees: data.periodicFees ?? 0, interest: data.interestCondition || 'unknown' });
    setStep('result'); window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleUploadUserImage = useCallback(async (file: File) => {
    analysisRequest.current?.abort();
    const controller = new AbortController(); analysisRequest.current = controller;
    const sequence = ++requestSequence.current;
    setTerms(EMPTY_TERMS); setIllustrative(false); setPendingCurrency(null); setPartialOffer(null);
    setOcrLoading(true); setOcrRejection(null); setSaveSuccessMsg(null);
    let imageDataUrl = '';
    const timeout = setTimeout(() => controller.abort(), 26000);
    try {
      const { dataUrl, base64, mimeType } = await resizeImageForOcr(file, 1200, 0.78);
      imageDataUrl = dataUrl;
      if (sequence !== requestSequence.current) return;
      const digest = await globalThis.crypto?.subtle?.digest('SHA-256', new TextEncoder().encode(base64)).catch(() => undefined);
      const cacheKey = digest ? Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('') : undefined;
      let data = cacheKey ? imageCache.current.get(cacheKey) : undefined;
      if (!data) {
        const response = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ imageBase64: base64, mimeType }) });
        data = await response.json() as PhotoOffer;
        if (!response.ok) throw new Error('No pudimos completar la revisión. Puedes ingresar los montos sin esperar.');
        if (imageCache.current.size >= 4) imageCache.current.clear();
        if (cacheKey && (data.isValidOfferImage || data.needsCurrencyConfirmation || data.hasOfferData)) imageCache.current.set(cacheKey, data);
      }
      if (sequence !== requestSequence.current) return;
      const offer = { ...data, imageDataUrl };
      if (data.needsCurrencyConfirmation) { setPendingCurrency(offer); return; }
      if (data.hasOfferData && data.country && data.extractionStatus === 'partial') { applyPhoto(offer, data.country); return; }
      if (!data.isValidOfferImage || !data.country) {
        setOcrRejection({ imageDataUrl, reason: data.rejectionReason || 'No pudimos leer una oferta completa. Ingresa los datos manualmente.', partialCashPriceQ: data.cashPrice || undefined, partialInstallmentAmountQ: data.installmentAmount || undefined, partialInstallmentsCount: data.installmentsCount || undefined, partialPeriodicity: data.periodicity, partialStoreName: data.storeName, partialProductName: data.productName, partialCountry: data.country || undefined, partialTerms: { ...EMPTY_TERMS, downPayment: data.downPayment ?? 0, upfrontFees: data.upfrontFees ?? 0, periodicFees: data.periodicFees ?? 0, interest: data.interestCondition || 'unknown' } });
        return;
      }
      applyPhoto(offer, data.country);
    } catch {
      if (sequence === requestSequence.current) setOcrRejection({ imageDataUrl, reason: !imageDataUrl ? 'No pudimos abrir el archivo. Vuelve a elegirlo o prueba una foto JPG o PNG.' : controller.signal.aborted ? 'La revisión tardó más de lo esperado. Puedes ingresar los montos ahora o probar otra foto.' : 'No pudimos revisar la foto. Prueba otra imagen o ingresa los montos.' });
    } finally {
      clearTimeout(timeout);
      if (sequence === requestSequence.current) setOcrLoading(false);
    }
  }, [applyPhoto]);

  // Soporte global para pegar captura desde el portapapeles (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'));
        if (imageFile) {
          e.preventDefault();
          void handleUploadUserImage(imageFile);
          return;
        }
      }
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              void handleUploadUserImage(blob);
              return;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleUploadUserImage]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    void handleUploadUserImage(file);
  };

  const handleManualEntryFromRejection = () => {
    if (!ocrRejection) return;
    if (ocrRejection.partialCountry) setCountry(ocrRejection.partialCountry);
    setTerms(ocrRejection.partialTerms || EMPTY_TERMS);
    setSelectedSample(null);
    setCustomImageSrc(ocrRejection.imageDataUrl || null);
    setIsUserUploadedOcr(false);
    setIsManualAdjustOpen(true);
    setTiendaNombre(ocrRejection.partialStoreName || 'Captura subida por ti');
    setProductoNombre(
      ocrRejection.partialProductName || 'Ingreso manual sobre tu captura'
    );
    setPrecioContado(ocrRejection.partialCashPriceQ || 0);
    setMontoCuota(ocrRejection.partialInstallmentAmountQ || 0);
    setNumeroPagos(ocrRejection.partialInstallmentsCount || 0);
    setFrecuencia(ocrRejection.partialPeriodicity || 'mensual');
    setOcrRejection(null);
    setStep('result');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const commitmentInput: CommitmentInput = { country, cashPrice: precioContado, payment: montoCuota, count: numeroPagos, frequency: frecuencia, ...terms };
  const draftKey = JSON.stringify({ commitmentInput, tiendaNombre, productoNombre });
  latestDraft.current = draftKey;
  useEffect(() => { setSaveSuccessMsg(null); setAuthStatusMsg(null); }, [draftKey]);
  const comparison = analyzeCommitment(commitmentInput);
  const fieldErrors = validateCommitment(commitmentInput);
  const additionalCost = comparison.complete ? Math.max(0, comparison.difference) : 0;
  const differenceLabel = comparison.complete ? `${comparison.difference > 0 ? '+' : comparison.difference < 0 ? '−' : ''}${formatQ(Math.abs(comparison.difference))}` : '—';
  const handleSaveAudit = async () => {
    if (savePending) return;
    setAuthStatusMsg(null); setSaveSuccessMsg(null);
    const savingDraft = draftKey;
    if (!comparison.complete) { setAuthStatusMsg('Completa los montos antes de guardar.'); return; }
    setSavePending(true);
    try {
      const { saveOfferConsultation } = await import('./services/firebaseClient.ts');
      await saveOfferConsultation(commitmentInput, { store: tiendaNombre, product: productoNombre, program: terms.program, illustrative });
      setSaveSuccessMsg(latestDraft.current === savingDraft ? 'Análisis guardado. También puedes descargar una copia.' : 'Se guardó la versión anterior. Guarda de nuevo para conservar tus últimos cambios.');
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      setAuthStatusMsg(code.includes('permission') ? 'No se pudo guardar con esta sesión. Descarga una copia o vuelve a intentarlo.' : 'No pudimos guardar el análisis. Revisa tu conexión y vuelve a intentarlo, o descarga una copia.');
    } finally { setSavePending(false); }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentimientoAceptado) {
      setFeedbackValidationError(
        'Confirma el consentimiento para registrar tus respuestas.'
      );
      return;
    }
    if (claridadVeredicto === 0 || esfuerzoPercibido === 0 || !intencionDeUso) {
      setFeedbackValidationError('Completa las 3 preguntas antes de enviar.');
      return;
    }
    if (feedbackPending) return;
    setFeedbackValidationError(null);
    setFeedbackPending(true);
    try {
    const { submitPrototypeFeedback } = await import('./services/firebaseClient.ts');
    await submitPrototypeFeedback({
      q1Rating: claridadVeredicto,
      q2Clarity: `reverse_effort_${esfuerzoPercibido}`,
      q3WouldUse: intencionDeUso,
      openSuggestion: sugerenciaAbierta.trim(),
      contextMeta: JSON.stringify({
        tiendaAnalizada: tiendaNombre,
        isUserUploadedOcr,
        country,
        sobreprecio: additionalCost,
      }),
    });
    setFeedbackSent(true);
    } catch { setFeedbackValidationError('No pudimos enviar tus respuestas. Las conservamos: revisa tu conexión y vuelve a intentarlo.'); }
    finally { setFeedbackPending(false); }
  };

  return (
    <div>
      {/* HEADER SUPERIOR ULTRA-LIMPIO: Solo marca + Guia + Opinar */}
      <header className={`minimal-header ${step === 'result' ? 'result-header' : ''}`}>
        <button
          type="button"
          className="brand-name"
          onClick={() => {
            requestSequence.current++; analysisRequest.current?.abort();
            setOcrLoading(false); setPendingCurrency(null); setOcrRejection(null);
            setStep('input');
          }}
        >
          Cuotas
        </button>
        <div className="header-links">
          <button type="button" className="text-link-btn" onClick={toggleGuide}>
            {showGuide ? 'Ocultar guia' : 'Guia'}
          </button>
          <button
            type="button"
            className="text-link-btn"
            onClick={() => setShowFeedbackModal(true)}
          >
            Opinar
          </button>
        </div>
      </header>

      <main className={`step-container ${step === 'result' ? 'result-container' : ''}`}>
        {/* BANNER DISCRETO DE GUIA (Solo visible con /?guia=1 o clic en Guia) */}
        {showGuide && (
          <section className="guide-card" aria-label="Guia rapida">
            <div className="guide-card-top">
              <span className="guide-card-title">
                Como usar esta calculadora en 2 pasos
              </span>
              <button type="button" className="text-link-btn" onClick={toggleGuide}>
                Cerrar
              </button>
            </div>
            <ul className="guide-list">
              <li>
                1. Sube una captura o foto de cualquier oferta, o abre “Probar con una oferta de ejemplo”.
              </li>
              <li>
                2. Revisa el costo total, el dinero libre mínimo por pago y el margen de respaldo para todo el plazo.
              </li>
            </ul>
          </section>
        )}

        {/* Input oculto compartido para subir imagen desde cualquier vista */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelection}
        />

        {/* ESTADO DE CARGA OCR (Vertex AI gemini-3.8-flash) */}
        {ocrLoading && (
          <section className="ocr-status-card" aria-live="polite">
            <div className="ocr-spinner" aria-hidden="true" />
            <p className="ocr-status-title">
              Revisando tu oferta…
            </p>
            <p className="ocr-status-subtitle">Esto puede tardar unos segundos.</p>
            <button type="button" className="text-link-btn" onClick={() => { requestSequence.current++; analysisRequest.current?.abort(); setOcrLoading(false); handleCalculateWithoutPhoto(); }}>Ingresar montos sin esperar</button>
          </section>
        )}

        {pendingCurrency && <section className="currency-confirmation"><h1 tabIndex={-1}>¿En qué moneda está la oferta?</h1><p>El símbolo no permite confirmarlo. Conservamos los precios leídos; elige la moneda para continuar.</p><div className="currency-choices">{(Object.keys(MARKETS) as Country[]).map(code => <button type="button" key={code} onClick={() => applyPhoto(pendingCurrency, code)}>{MARKETS[code].currency} · {MARKETS[code].name}</button>)}</div></section>}
        {/* TARJETA DE ALERTA CUANDO LA IMAGEN SUBIDA NO ES UNA OFERTA VALIDA */}
        {!ocrLoading && ocrRejection && (
          <section className="ocr-rejection-card" role="alert">
            <span className="verdict-badge badge-bad">
              NO PUDIMOS LEER UNA OFERTA COMPLETA
            </span>
            <h2 tabIndex={-1} className="ocr-rejection-title">
              Necesitamos confirmar algunos datos
            </h2>
            <p className="ocr-rejection-reason">{ocrRejection.reason}</p>

            {ocrRejection.imageDataUrl && (
              <div className="ocr-rejection-preview-wrap">
                <img
                  src={ocrRejection.imageDataUrl}
                  alt="Imagen subida para revision"
                  className="ocr-rejection-preview"
                />
              </div>
            )}

            <div className="ocr-rejection-actions">
              <button
                type="button"
                className="upload-primary-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Subir otra foto o captura
              </button>
              <button
                type="button"
                className="secondary-action-btn"
                onClick={handleManualEntryFromRejection}
              >
                Ingresar los datos manualmente
              </button>
            </div>
          </section>
        )}

        {step === 'input' && !ocrLoading && !ocrRejection && !pendingCurrency ? (
          /* =========================================================
             VISTA 1 (INPUT MINIMALISTA): Subir foto o elegir 1 de 3 ejemplos
             ========================================================= */
          <section aria-label="Seleccionar oferta a evaluar">
            <div className="hero-block">
              <h1 tabIndex={-1} className="hero-title">
                Entiende a qué te comprometes
              </h1>
              <p className="hero-subtitle">
                Compara el costo total y las condiciones antes de comprar a cuotas.
              </p>
            </div>
            <div className="upload-box">
              <button
                type="button"
                className="upload-primary-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Subir foto o captura de la oferta
              </button>
              <p className="upload-helper">
                También puedes pegar una captura con Ctrl+V / Cmd+V.
              </p>
              <button
                type="button"
                className="calculate-no-photo-btn"
                onClick={handleCalculateWithoutPhoto}
              >
                ¿Ya tienes los montos? Calcular sin foto
              </button>
            </div>

            <details className="example-disclosure"><summary>Probar con una oferta de ejemplo</summary>
              <div className="example-links">{STORE_OFFER_SAMPLES.map(sample => <button type="button" key={sample.id} onClick={() => handleSelectSample(sample)}>{sample.tienda}<span>{sample.producto}</span></button>)}
              <button type="button" onClick={() => { handleCalculateWithoutPhoto(); setCountry('CO'); setIllustrative(true); setPrecioContado(1200000); setMontoCuota(100000); setNumeroPagos(12); setIsManualAdjustOpen(false); }}>Colombia · ejemplo ilustrativo<span>12 pagos de COP 100.000</span></button>
              <button type="button" onClick={() => { handleCalculateWithoutPhoto(); setCountry('PA'); setIllustrative(true); setPrecioContado(1200); setMontoCuota(100); setNumeroPagos(12); setIsManualAdjustOpen(false); }}>Panamá · ejemplo ilustrativo<span>12 pagos de US$ 100</span></button></div>
            </details>

          </section>
        ) : null}

        {step === 'result' && !ocrLoading && !ocrRejection && !pendingCurrency ? (
          /* =========================================================
             VISTA 2 (RESULTADO LIMPIO): 2 Columnas en Desktop, Compacto en Movil
             ========================================================= */
          <section aria-label="Resultado del analisis">
            <div className="back-nav-row">
              <button
                type="button"
                className="back-btn"
                onClick={() => setStep('input')}
              >
                &larr; Evaluar otra oferta
              </button>


            </div>

            {(saveSuccessMsg || authStatusMsg) && (
              <p role="status"
                style={{
                  fontSize: '12.5px',
                  marginBottom: '10px',
                  color: saveSuccessMsg ? '#15803D' : '#B91C1C',
                  fontWeight: 600,
                }}
              >
                {saveSuccessMsg || authStatusMsg}
              </p>
            )}

            <div className="consultation-body">
              <div>
                <h1 tabIndex={-1} className="consultation-title">{comparison.complete ? 'Para asumir estas cuotas' : partialOffer ? 'Completa los datos que faltan' : 'Revisa los datos de la oferta'}</h1>
                <p className="offer-market">{country === 'PA' ? 'Referencia: Panamá' : MARKETS[country].name} · {MARKETS[country].currency}{illustrative ? ' · Ejemplo ilustrativo' : ''}</p>
                {!illustrative && productoNombre !== 'Calculo rapido sin foto' && comparison.complete && <p className="offer-context">{tiendaNombre} · {productoNombre}</p>}
                {partialOffer && !comparison.complete && <p className="partial-offer-note" role="status">{(partialOffer.cashPrice || 0) > 0 && <>Precio de contado leído: <strong>{formatQ(partialOffer.cashPrice!)}</strong>. </>}{(partialOffer.installmentAmount || 0) > 0 && <>Pago leído: <strong>{formatQ(partialOffer.installmentAmount!)}</strong>. </>}{partialOffer.installmentsCount > 0 && <>{partialOffer.installmentsCount} pagos leídos. </>}{partialOffer.installmentNeedsConfirmation ? partialOffer.rejectionReason : 'Completa solo los datos que faltan; no asumimos un plan de cuotas.'}</p>}
                <DecisionPanel key={country} input={commitmentInput} onReview={() => { setIsManualAdjustOpen(true); requestAnimationFrame(() => document.getElementById('edit-contado')?.focus()); }} />
                {/* 4. Acordeon discreto por si el usuario quiere editar algun monto */}
                <details
                  className="edit-accordion"
                  open={isManualAdjustOpen}
                  onToggle={(e) =>
                    setIsManualAdjustOpen((e.currentTarget as HTMLDetailsElement).open)
                  }
                >
                  <summary>Editar oferta</summary>
                  <div className="field-wrap currency-field"><label htmlFor="offer-currency">Moneda de los montos</label><select id="offer-currency" className="clean-input" value={country} onChange={e => { setCountry(e.target.value as Country); setSaveSuccessMsg(null); }}><option value="GT">GTQ · Guatemala</option><option value="CO">COP · Colombia</option><option value="PA">USD / B/. · Panamá</option></select><small className="form-note">Cambiar moneda no convierte los importes.</small></div>
                  <div className="edit-grid edit-grid-four">
                    <div className="field-wrap">
                      <label htmlFor="edit-contado">Precio de contado ({MARKETS[country].unit})</label>
                      <input
                        id="edit-contado" onBlur={() => setTouched(prev => ({ ...prev, cashPrice: true }))} aria-invalid={!!(touched.cashPrice && fieldErrors.cashPrice)} aria-describedby={touched.cashPrice && fieldErrors.cashPrice ? "error-cashPrice" : undefined}
                        type="number"
                        min={1}
                        step="0.01"
                        className="clean-input"
                        value={precioContado || ''}
                        onChange={(e) => setPrecioContado(Number(e.target.value) || 0)}
                      />{touched.cashPrice && fieldErrors.cashPrice && <p className="field-error" id="error-cashPrice">{fieldErrors.cashPrice}</p>}
                    </div>
                    <div className="field-wrap">
                      <label htmlFor="edit-cuota">Monto de cada pago ({MARKETS[country].unit})</label>
                      <input
                        id="edit-cuota" onBlur={() => setTouched(prev => ({ ...prev, payment: true }))} aria-invalid={!!(touched.payment && fieldErrors.payment)} aria-describedby={touched.payment && fieldErrors.payment ? "error-payment" : undefined}
                        type="number"
                        min={1}
                        step="0.01"
                        className="clean-input"
                        value={montoCuota || ''}
                        onChange={(e) => setMontoCuota(Number(e.target.value) || 0)}
                      />{touched.payment && fieldErrors.payment && <p className="field-error" id="error-payment">{fieldErrors.payment}</p>}
                    </div>
                    <div className="field-wrap">
                      <label htmlFor="edit-pagos">Numero de pagos</label>
                      <input
                        id="edit-pagos" onBlur={() => setTouched(prev => ({ ...prev, count: true }))} aria-invalid={!!(touched.count && fieldErrors.count)} aria-describedby={touched.count && fieldErrors.count ? "error-count" : undefined}
                        type="number"
                        min={1}
                        max={520}
                        className="clean-input"
                        value={numeroPagos || ''}
                        onChange={(e) => setNumeroPagos(Number(e.target.value) || 0)}
                      />{touched.count && fieldErrors.count && <p className="field-error" id="error-count">{fieldErrors.count}</p>}
                    </div>
                    <div className="field-wrap">
                      <label htmlFor="edit-frecuencia">Frecuencia</label>
                      <select
                        id="edit-frecuencia"
                        className="clean-input"
                        style={{ fontFamily: 'var(--font-ui)' }}
                        value={frecuencia}
                        onChange={(e) =>
                          setFrecuencia(e.target.value as PeriodicityUI)
                        }
                      >
                        <option value="mensual">Mensual</option>
                        <option value="quincenal">Quincenal</option>
                        <option value="semanal">Semanal</option>
                      </select>
                    </div>
                  </div>
                  <TermsFields cashPrice={precioContado} country={country} terms={terms} onChange={setTerms} />
                </details>

                <p className="sr-only" role="status">{comparison.complete ? `Total actualizado: ${formatQ(comparison.total)}. ${comparison.conditionsComplete ? 'Condiciones confirmadas.' : 'Total provisional.'}` : 'Completa o corrige los campos indicados para calcular el total.'}</p>
                <CommitmentExplanation input={commitmentInput} terms={terms} />
                {comparison.complete && <div className="result-actions"><button type="button" className="text-link-btn" onClick={downloadAnalysis}>Descargar copia</button><button type="button" className="text-link-btn" disabled={savePending} onClick={handleSaveAudit}>{savePending ? 'Guardando…' : 'Guardar análisis'}</button><button type="button" className="text-link-btn" onClick={() => setShowFeedbackModal(true)}>Opinar</button></div>}
                {(customImageSrc || selectedSample) && <details className="offer-photo"><summary>Ver foto de la oferta</summary><img src={customImageSrc || selectedSample?.imageSrc} alt="Oferta utilizada para el análisis" /></details>}
              </div>
            </div>

          </section>
        ) : null}
      </main>

      {/* MODAL DE FEEDBACK (Solo se abre cuando el usuario hace clic en "Opinar" o en el CTA de 1 toque) */}
      {showFeedbackModal && (
        <AccessibleDialog onClose={() => setShowFeedbackModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Tu opinion en 30 segundos</span>
              <button
                type="button"
                className="text-link-btn"
                onClick={() => setShowFeedbackModal(false)}
              >
                Cerrar
              </button>
            </div>

            <p className="survey-intro-note">
              No solicitamos tu nombre ni correo. Tus respuestas nos ayudan a mejorar esta calculadora.
            </p>

            {feedbackSent ? (
              <div style={{ padding: '12px 0' }}>
                <p style={{ fontWeight: 600, color: '#15803D', marginBottom: '10px' }}>
                  Gracias. Tu respuesta fue registrada.
                </p>
                <button
                  type="button"
                  className="upload-primary-btn"
                  onClick={() => {
                    setFeedbackSent(false);
                    setShowFeedbackModal(false);
                  }}
                >
                  Listo
                </button>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit}>
                <label className="consent-row">
                  <input
                    type="checkbox"
                    aria-describedby={feedbackValidationError ? 'feedback-error' : undefined}
                    checked={consentimientoAceptado}
                    onChange={(e) => setConsentimientoAceptado(e.target.checked)}
                  />
                  <span>
                    Soy mayor de 18 años y acepto responder de forma voluntaria.
                  </span>
                </label>

                <div className="likert-scale-legend">
                  Escala: 1 = Totalmente en desacuerdo · 5 = Totalmente de acuerdo
                </div>

                <fieldset className="q-block" aria-describedby={feedbackValidationError ? 'feedback-error' : undefined}>
                  <legend className="q-label">
                    1. El resultado deja claro de inmediato cuanto dinero pago de mas en cuotas frente al contado.
                  </legend>
                  <div className="rating-row">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className={`opt-btn ${claridadVeredicto === n ? 'selected' : ''}`}>
                        <input className="sr-only" type="radio" name="clarity" value={n} checked={claridadVeredicto === n} onChange={() => setClaridadVeredicto(n)} />
                        {n}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="q-block" aria-describedby={feedbackValidationError ? 'feedback-error' : undefined}>
                  <legend className="q-label">
                    2. Me resulto dificil encontrar el recargo real dentro de la pantalla.
                  </legend>
                  <div className="rating-row">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className={`opt-btn ${esfuerzoPercibido === n ? 'selected' : ''}`}>
                        <input className="sr-only" type="radio" name="effort" value={n} checked={esfuerzoPercibido === n} onChange={() => setEsfuerzoPercibido(n)} />
                        {n}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="q-block" aria-describedby={feedbackValidationError ? 'feedback-error' : undefined}>
                  <legend className="q-label">
                    3. Usarias esta calculadora antes de comprar un electrodomestico o celular a cuotas?
                  </legend>
                  <div className="choice-row">
                    {['Si, seguro', 'Tal vez', 'No la usaria'].map((val) => (
                      <label key={val} className={`opt-btn ${intencionDeUso === val ? 'selected' : ''}`}>
                        <input className="sr-only" type="radio" name="intention" value={val} checked={intencionDeUso === val} onChange={() => setIntencionDeUso(val)} />
                        {val}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="q-block">
                  <label className="q-label" htmlFor="sugerencia-modal">
                    4. Que le cambiarias para que sea mas clara? (opcional)
                  </label>
                  <input
                    id="sugerencia-modal"
                    type="text"
                    className="clean-input"
                    style={{ fontFamily: 'var(--font-ui)' }}
                    maxLength={2000}
                    placeholder="Tu comentario..."
                    value={sugerenciaAbierta}
                    onChange={(e) => setSugerenciaAbierta(e.target.value)}
                  />
                </div>

                {feedbackValidationError && (
                  <p id="feedback-error" role="alert" tabIndex={-1}
                    style={{
                      fontSize: '12.5px',
                      color: '#B91C1C',
                      marginBottom: '8px',
                    }}
                  >
                    {feedbackValidationError}
                  </p>
                )}

                <button type="submit" disabled={feedbackPending} className="upload-primary-btn">
                  {feedbackPending ? 'Enviando…' : 'Enviar respuesta'}
                </button>
              </form>
            )}
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
};
export default App;
