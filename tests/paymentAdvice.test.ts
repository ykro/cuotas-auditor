import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/engine/creditAudit.ts';

test('18 rounded installments preserve the eight-cent difference without a cash warning', () => {
  const advice = engine.evaluatePaymentComparison(8596, 477.56, 18);
  assert.equal(advice.difference, 0.08);
  assert.equal(advice.kind, 'rounding');
  assert.match(advice.recommendation, /presupuesto/);
});
test('small real charges and discounts remain visible', () => {
  assert.equal(engine.evaluatePaymentComparison(100, 10.01, 10).kind, 'surcharge');
  assert.equal(engine.evaluatePaymentComparison(100, 9, 10).kind, 'discount');
  assert.equal(engine.evaluatePaymentComparison(100, 10, 10).kind, 'equal');
});
test('invalid amounts never produce financial advice', () => {
  for (const args of [[0, 10, 10], [100, NaN, 10], [100, 10, 1.5], [100, -1, 10]]) {
    assert.equal(engine.evaluatePaymentComparison(args[0], args[1], args[2]).kind, 'incomplete');
  }
});

test('two cents below cash is rounding, not an assertion of exact equality', () => {
  const result = engine.evaluatePaymentComparison(3296, 183.11, 18);
  assert.equal(result.kind, 'rounding');
  assert.equal(result.difference, -0.02);
});
