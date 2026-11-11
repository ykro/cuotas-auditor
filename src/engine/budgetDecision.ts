import { analyzeCommitment, assessPaymentRoom, type CommitmentInput } from './offerConsultant.ts';

export interface MonthlyBudget { income: number | null; expenses: number | null; otherDebt: number | null }
export interface BudgetScenario { debtCap?: number; reservePct?: number; initialFunded?: boolean }
export type DecisionStatus = 'invalid-offer' | 'budget-missing' | 'does-not-fit' | 'conditions-pending' | 'initial-pending' | 'fits';
const ceil = (value: number) => Math.ceil((value - 1e-9) * 100) / 100;
const cents = (value: number) => Math.round(value * 100) / 100;

/** Local planning scenario, never a lending approval. Budget inputs must not be persisted. */
export function assessBudgetDecision(input: CommitmentInput, budget?: MonthlyBudget, scenario: BudgetScenario = {}) {
  const offer = analyzeCommitment(input);
  const monthlyCommitment = assessPaymentRoom(input).monthlyPeak;
  const debtCap = [.2, .3].includes(scenario.debtCap ?? .3) ? scenario.debtCap ?? .3 : .3;
  const reservePct = [0, 10, 25, 50].includes(scenario.reservePct ?? 25) ? scenario.reservePct ?? 25 : 25;
  const reserve = ceil(monthlyCommitment * reservePct / 100);
  const hasBudget = !!budget && [budget.income, budget.expenses, budget.otherDebt].every(value => value !== null && Number.isFinite(value) && value >= 0) && budget.income! > 0;
  const hasIncomeAndDebt = !!budget && budget.income !== null && Number.isFinite(budget.income) && budget.income > 0 && budget.otherDebt !== null && Number.isFinite(budget.otherDebt) && budget.otherDebt >= 0;
  const income = hasBudget ? budget!.income! : 0;
  const expenses = budget?.expenses !== null && Number.isFinite(budget?.expenses) && budget!.expenses! >= 0 ? budget!.expenses! : 0;
  const otherDebt = budget?.otherDebt !== null && Number.isFinite(budget?.otherDebt) && budget!.otherDebt! >= 0 ? budget!.otherDebt! : 0;
  const totalDebt = cents(otherDebt + monthlyCommitment);
  const referenceIncome = offer.complete ? ceil(Math.max(totalDebt / debtCap, expenses + totalDebt + reserve)) : 0;
  const expenseCap = hasIncomeAndDebt ? cents(budget!.income! - budget!.otherDebt! - monthlyCommitment - reserve) : null;
  // Five equal weekly envelopes cannot exceed the monthly cap through rounding.
  const weeklyExpenseCap = expenseCap !== null ? Math.floor(expenseCap * 100 / 5) / 100 : null;
  const headroom = hasBudget ? cents(income - expenses - totalDebt - reserve) : null;
  const debtShare = hasBudget ? totalDebt / income : null;
  const status: DecisionStatus = !offer.complete ? 'invalid-offer' : !hasBudget ? 'budget-missing'
    : headroom! < 0 || debtShare! > debtCap ? 'does-not-fit'
    : !offer.conditionsComplete ? 'conditions-pending'
    : offer.initial > 0 && !scenario.initialFunded ? 'initial-pending' : 'fits';
  return { status, monthlyCommitment, reserve, reservePct, debtCap, referenceIncome, expenseCap, weeklyExpenseCap, headroom, debtShare };
}
