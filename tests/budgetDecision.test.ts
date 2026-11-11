import test from 'node:test';
import assert from 'node:assert/strict';
import { assessBudgetDecision } from '../src/engine/budgetDecision.ts';
import type { CommitmentInput } from '../src/engine/offerConsultant.ts';
const offer: CommitmentInput = { country: 'GT', cashPrice: 1200, payment: 100, count: 12, frequency: 'mensual', downPayment: 0, upfrontFees: 0, periodicFees: 0, feesConfirmed: true, interest: 'included' };
const budget = { income: 2000, expenses: 1000, otherDebt: 100 };
test('without all three budget amounts, salary is illustrative and no personal recommendation exists', () => {
  const result = assessBudgetDecision(offer);
  assert.equal(result.status, 'budget-missing');
  assert.equal(result.referenceIncome, 333.34);
  assert.equal(result.expenseCap, null);
  assert.equal(assessBudgetDecision(offer, { ...budget, expenses: null }).status, 'budget-missing');
});
test('income references honor every valid partial budget field without granting approval', () => {
  const weekly = { ...offer, payment: 48, count: 104, frequency: 'semanal' as const };
  const partialDebt = assessBudgetDecision(weekly, { income: 800, expenses: null, otherDebt: 100 });
  assert.equal(partialDebt.status, 'budget-missing');
  assert.equal(partialDebt.referenceIncome, 1133.34);
  const partialExpenses = assessBudgetDecision(weekly, { income: null, expenses: 1000, otherDebt: 100 });
  assert.equal(partialExpenses.status, 'budget-missing');
  assert.equal(partialExpenses.referenceIncome, 1400);
  assert.equal(assessBudgetDecision(weekly, { income: 800, expenses: 500, otherDebt: 0 }).status, 'fits');
  assert.equal(assessBudgetDecision(weekly, { income: 800, expenses: 501, otherDebt: 0 }).status, 'does-not-fit');
});
test('residual cash blocks a purchase even when debt percentage is low', () => {
  const result = assessBudgetDecision(offer, { income: 2000, expenses: 1950, otherDebt: 0 });
  assert.equal(result.debtShare, .05);
  assert.equal(result.status, 'does-not-fit');
  assert.equal(result.headroom, -75);
  assert.equal(result.referenceIncome, 2075);
  assert.equal(result.expenseCap, 1875);
});
test('weekly peak budgets five payments capped by the actual term; quincenas use two', () => {
  assert.equal(assessBudgetDecision({ ...offer, frequency: 'semanal' }).monthlyCommitment, 500);
  assert.equal(assessBudgetDecision({ ...offer, frequency: 'semanal', count: 2 }).monthlyCommitment, 200);
  assert.equal(assessBudgetDecision({ ...offer, frequency: 'quincenal' }).monthlyCommitment, 200);
});
test('a weekly commitment yields a conservative spending envelope from income and other debt', () => {
  const result = assessBudgetDecision({ ...offer, payment: 48, count: 50, frequency: 'semanal' }, { income: 800, expenses: 0, otherDebt: 0 });
  assert.equal(result.monthlyCommitment, 240);
  assert.equal(result.reserve, 60);
  assert.equal(result.referenceIncome, 800);
  assert.equal(result.expenseCap, 500);
  assert.equal(result.weeklyExpenseCap, 100);
  const incomplete = assessBudgetDecision(offer, { income: 800, expenses: null, otherDebt: 0 });
  assert.equal(incomplete.status, 'budget-missing');
  assert.notEqual(incomplete.expenseCap, null);
  assert.equal(assessBudgetDecision(offer, { income: 800, expenses: null, otherDebt: null }).expenseCap, null);
});
test('budget fit requires confirmed terms and separately funded initial payment', () => {
  assert.equal(assessBudgetDecision(offer, budget).status, 'fits');
  assert.equal(assessBudgetDecision({ ...offer, feesConfirmed: false }, budget).status, 'conditions-pending');
  assert.equal(assessBudgetDecision({ ...offer, downPayment: 50 }, budget).status, 'initial-pending');
  assert.equal(assessBudgetDecision({ ...offer, downPayment: 50 }, budget, { initialFunded: true }).status, 'fits');
});
test('invalid budgets and offers never produce approval; reference cap and reserve change constraints', () => {
  assert.equal(assessBudgetDecision(offer, { ...budget, income: 0 }).status, 'budget-missing');
  assert.equal(assessBudgetDecision(offer, { ...budget, otherDebt: -1 }).status, 'budget-missing');
  assert.equal(assessBudgetDecision({ ...offer, count: 0 }, budget).status, 'invalid-offer');
  const result = assessBudgetDecision(offer, budget, { debtCap: .2, reservePct: 50 });
  assert.equal(result.referenceIncome, 1250);
  assert.equal(result.expenseCap, 1750);
  assert.equal(assessBudgetDecision(offer, { income: 500, expenses: 0, otherDebt: 100 }).status, 'does-not-fit');
});
test('monthly guidance distinguishes reference net income from money reserved for the payment', () => {
  const result = assessBudgetDecision({ ...offer, cashPrice: 4546, payment: 252.56, count: 18, feesConfirmed: false, interest: 'unknown' });
  assert.equal(result.referenceIncome, 841.87);
  assert.equal(result.monthlyCommitment, 252.56);
  assert.equal(result.reserve, 63.14);
  assert.equal(result.status, 'budget-missing');
});
