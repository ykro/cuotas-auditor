import test from 'node:test';
import assert from 'node:assert/strict';
import * as consultant from '../src/engine/offerConsultant.ts';
const base = { country: 'PA' as const, cashPrice: 1200, payment: 100, count: 12, frequency: 'mensual' as const, downPayment: 0, upfrontFees: 0, periodicFees: 0, feesConfirmed: false, interest: 'unknown' as const };
test('known totals never promise confirmed zero fees', () => {
 const r = consultant.analyzeCommitment(base);
 assert.equal(r.total,1200); assert.equal(r.complete,true);
 assert.equal(r.conditionsComplete,false); assert.match(r.advice,/confirm/i);
});
test('down payment and additional charges appear once in the commitment',()=>{
 const r=consultant.analyzeCommitment({...base,downPayment:200,upfrontFees:30,periodicFees:5,payment:90});
 assert.equal(r.initial,230);assert.equal(r.periodic,95);assert.equal(r.total,1370);assert.equal(r.difference,170);
});
test('advertised zero interest is not zero cost',()=>{
 const r=consultant.analyzeCommitment({...base,interest:'advertised_zero',periodicFees:3,feesConfirmed:true});
 assert.equal(r.kind,'surcharge');assert.equal(r.total,1236);
});
test('rounding uses local currency precision and retains the difference',()=>{
 assert.equal(consultant.analyzeCommitment({...base,country:'GT',cashPrice:8596,payment:477.56,count:18}).kind,'rounding');
 const cop=consultant.analyzeCommitment({...base,country:'CO',cashPrice:1000000,payment:83333,count:12});
 assert.equal(cop.kind,'rounding');assert.equal(cop.difference,-4);
});
test('invalid or partial offer values do not receive a recommendation',()=>{
 for(const patch of [{cashPrice:0},{payment:NaN},{count:2.5},{periodicFees:-1},{downPayment:2000}]){
  assert.equal(consultant.analyzeCommitment({...base,...patch}).complete,false);
 }
});
test('frequency is explicit and never silently becomes months',()=>{
 assert.match(consultant.analyzeCommitment({...base,frequency:'semanal'}).duration,/semanas/);
 assert.match(consultant.analyzeCommitment({...base,frequency:'quincenal'}).duration,/quincenas/);
});
test('country formats are distinct and never convert numeric amounts',()=>{
 assert.match(consultant.formatMarketMoney(1200,'GT'),/^Q /);
 assert.match(consultant.formatMarketMoney(1200,'CO'),/^COP /);
 assert.match(consultant.formatMarketMoney(1200,'PA'),/^US\$/);
});
test('budget floor and adjustable cushion explain the 18-month commitment',()=>{
 const result=consultant.assessPaymentRoom({...base,country:'GT',cashPrice:3296,payment:183.11,count:18},25);
 assert.equal(result.minimumPerPeriod,183.11);assert.equal(result.cushionPerPeriod,228.89);
 assert.equal(result.monthlyAverage,183.11);assert.equal(result.monthlyPeak,183.11);
});
test('weekly commitments show five-payment months, not only a misleading average',()=>{
 const result=consultant.assessPaymentRoom({...base,frequency:'semanal'},25);
 assert.equal(result.monthlyPeak,500);assert.equal(result.cushionMonthlyPeak,625);
});
test('explicit fees are never dismissed as installment rounding',()=>{
 assert.equal(consultant.analyzeCommitment({...base,cashPrice:1200,upfrontFees:.01}).kind,'surcharge');
});
test('short weekly plans never budget for payments beyond their term',()=>{
 assert.equal(consultant.assessPaymentRoom({...base,count:2,frequency:'semanal'}).monthlyPeak,200);
});
test('invalid edits explain every failing field and keep calculation disabled', () => {
 const invalid = { ...base, cashPrice: 100, payment: -10, count: 2.5, downPayment: 100, upfrontFees: -1, periodicFees: NaN };
 const errors = consultant.validateCommitment(invalid);
 assert.deepEqual(Object.keys(errors).sort(), ['payment','count','downPayment','upfrontFees','periodicFees'].sort());
 assert.match(errors.count!, /entero/);
 assert.match(errors.downPayment!, /menor/);
 assert.equal(consultant.analyzeCommitment(invalid).complete, false);
 assert.deepEqual(consultant.validateCommitment(base), {});
 assert.match(consultant.validateCommitment({ ...base, count: 521 }).count!, /520/);
});
