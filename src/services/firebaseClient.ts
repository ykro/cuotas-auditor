import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { analyzeCommitment, MARKETS } from '../engine/offerConsultant.ts';
import { CreditAuditResult } from '../engine/creditAudit.ts';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-cuotas-auditor',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000:web:00000000000000',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-cuotas-auditor.firebasestorage.app',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-cuotas-auditor.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export interface PrototypeFeedbackPayload {
  q1Rating: number;
  q2Clarity: string;
  q3WouldUse: string;
  openSuggestion: string;
  contextMeta: string;
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogleOrGuest(): Promise<{
  user: User | null;
  modo: 'google' | 'anonimo';
}> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return { user: cred.user, modo: 'google' };
  } catch {
    const anon = await signInAnonymously(auth);
    return { user: anon.user, modo: 'anonimo' };
  }
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function saveCreditAuditToFirestore(
  audit: CreditAuditResult
): Promise<{ docId: string; uid: string }> {
  let currentUser = auth.currentUser;
  if (!currentUser) {
    const anon = await signInAnonymously(auth);
    currentUser = anon.user;
  }

  const uid = currentUser.uid;
  const colRef = collection(db, 'users', uid, 'credit_audits');
  const docRef = await addDoc(colRef, {
    prototypeId: 'cuotas-auditor',
    titulo: audit.input.titulo,
    comercioOEntidad: audit.input.comercioOEntidad,
    tipoOferta: audit.input.tipoOferta,
    frecuenciaEfectiva: audit.frecuenciaEfectiva,
    moneda: audit.input.moneda,
    precioListaNominal: audit.input.precioListaNominal,
    precioContadoEfectivo: audit.input.precioContadoEfectivo,
    numeroPeriodos: audit.numeroPeriodos,
    capitalEfectivoRecibido: audit.capitalEfectivoRecibido,
    totalPagadoReal: audit.totalPagadoReal,
    sobrecostoTotal: audit.desgloseSobrecosto.sobrecostoTotal,
    teaEfectivaAnualPct: audit.teaEfectivaAnualPct,
    veredictoCodigo: audit.veredicto.codigo,
    createdAt: serverTimestamp(),
  });

  return { docId: docRef.id, uid };
}

export async function submitPrototypeFeedback(
  payload: PrototypeFeedbackPayload
): Promise<{ docId: string }> {
  await auth.authStateReady();
  const currentUser = auth.currentUser ?? (await signInAnonymously(auth)).user;

  const colRef = collection(db, 'prototype_feedback');
  const docRef = await addDoc(colRef, {
    prototypeId: 'cuotas-auditor',
    q1Rating: Number(payload.q1Rating),
    q2Clarity: String(payload.q2Clarity),
    q3WouldUse: String(payload.q3WouldUse),
    openSuggestion: payload.openSuggestion.trim().slice(0, 1500),
    testerUid: currentUser.uid,
    testerEmail: null,
    createdAt: serverTimestamp(),
    contextMeta: payload.contextMeta.slice(0, 500),
  });

  return { docId: docRef.id };
}

export async function saveOfferConsultation(
  input: import('../engine/offerConsultant.ts').CommitmentInput,
  context: { store: string; product: string; program: string; illustrative: boolean }
): Promise<void> {
  const analysis = analyzeCommitment(input);
  if (!analysis.complete) throw new Error('Completa la oferta antes de guardarla.');
  await auth.authStateReady();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  await addDoc(collection(db, 'users', user.uid, 'credit_audits'), {
    prototypeId: 'cuotas-auditor',
    analysisVersion: 2,
    country: input.country,
    moneda: MARKETS[input.country].currency,
    titulo: context.product.slice(0, 500),
    comercioOEntidad: context.store.slice(0, 200),
    program: context.program.slice(0, 100),
    illustrative: context.illustrative,
    offerFacts: {
      country: input.country,
      cashPrice: input.cashPrice,
      payment: input.payment,
      count: input.count,
      frequency: input.frequency,
      downPayment: input.downPayment,
      upfrontFees: input.upfrontFees,
      periodicFees: input.periodicFees,
      feesConfirmed: input.feesConfirmed,
      interest: input.interest,
    },
    totalPagadoReal: analysis.total,
    sobrecostoTotal: analysis.difference,
    numeroPeriodos: input.count,
    conditionsComplete: analysis.conditionsComplete,
    veredictoCodigo: analysis.kind,
    createdAt: serverTimestamp(),
  });
}
