import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOcrPrompt, normalizeOcrResult } from '../server.mjs';
const offer={isValidOfferImage:true,cashPrice:1200000,installmentAmount:100000,installmentsCount:12,currency:'COP',periodicity:'mensual'};
test('Colombian photo response preserves COP without GT relabeling',()=>{
 const r=normalizeOcrResult(offer,'CO');assert.equal(r.currency,'COP');assert.equal(r.cashPrice,1200000);assert.equal(r.isValidOfferImage,true);
});
test('mismatched or ambiguous photo currency rejects all partial amounts',()=>{
 for(const currency of ['GTQ','USD','UNKNOWN',undefined]){
  const r=normalizeOcrResult({...offer,currency},'CO');assert.equal(r.isValidOfferImage,false);assert.equal(r.cashPrice,0);
 }
});
test('backward-compatible Guatemala photo numbers still work',()=>{
 const r=normalizeOcrResult({isValidOfferImage:true,cashPriceQ:8596,installmentAmountQ:477.56,installmentsCount:18},'GT');
 assert.equal(r.cashPrice,8596);assert.equal(r.cashPriceQ,8596);assert.equal(r.currency,'GTQ');
});
test('Panama accepts USD and PAB at face value, without conversion',()=>{
 const r=normalizeOcrResult({...offer,currency:'PAB',cashPrice:1200,installmentAmount:100},'PA');
 assert.equal(r.isValidOfferImage,true);assert.equal(r.currency,'USD');assert.equal(r.cashPrice,1200);
});
test('photo prompt never treats interest-free payments as a country default',()=>{
 for(const country of ['GT','CO','PA']) {
  const prompt=buildOcrPrompt(country);assert.match(prompt,/currency/);assert.match(prompt,/No supongas/);
 }
 assert.match(buildOcrPrompt('CO'),/COP/);assert.match(buildOcrPrompt('PA'),/USD/);
});
test('invalid extracted values do not become valid offers',()=>{
 const r=normalizeOcrResult({...offer,cashPrice:'1.200.000',installmentsCount:12.5},'CO');
 assert.equal(r.isValidOfferImage,false);
});
test('automatic currency detection maps supported symbols and preserves ambiguous prices for one confirmation',()=>{
 for(const [currency,country] of [['GTQ','GT'],['COP','CO'],['USD','PA'],['PAB','PA']]) {
  const r=normalizeOcrResult({...offer,currency},'AUTO');assert.equal(r.country,country);assert.equal(r.isValidOfferImage,true);
 }
 const ambiguous=normalizeOcrResult({...offer,currency:'UNKNOWN'},'AUTO');
 assert.equal(ambiguous.isValidOfferImage,false);assert.equal(ambiguous.needsCurrencyConfirmation,true);assert.equal(ambiguous.cashPrice,1200000);assert.equal(ambiguous.country,null);
});

test('cash-only pressure cooker offer preserves the current Q996 price without creating a payment plan', () => {
 const r = normalizeOcrResult({ isOfferImage: true, isValidOfferImage: false, currency: 'GTQ', productName: 'Olla de presión digital Black+Decker', cashPrice: 996, installmentAmount: null, installmentsCount: null, rejectionReason: 'No hay un plan de cuotas.' });
 assert.equal(r.extractionStatus, 'partial');
 assert.equal(r.hasOfferData, true);
 assert.equal(r.isValidOfferImage, false);
 assert.equal(r.country, 'GT');
 assert.equal(r.cashPrice, 996);
 assert.equal(r.cashPriceQ, 996);
 assert.equal(r.installmentAmount, 0);
 assert.equal(r.installmentsCount, 0);
 assert.equal(r.interestCondition, 'unknown');
 assert.deepEqual(r.missingFields, ['installmentAmount', 'installmentsCount']);
 assert.match(r.rejectionReason, /monto de cada cuota y el número de pagos/);
});

test('automatic currency confirmation preserves partial prices without marking the offer complete', () => {
 const r = normalizeOcrResult({ isValidOfferImage: false, currency: 'UNKNOWN', cashPrice: 996 });
 assert.equal(r.needsCurrencyConfirmation, true);
 assert.equal(r.extractionStatus, 'partial');
 assert.equal(r.isValidOfferImage, false);
 assert.equal(r.cashPrice, 996);
 assert.equal(r.country, null);
 assert.deepEqual(r.missingFields, ['installmentAmount', 'installmentsCount']);
});

test('only a published integer count qualifies; a nonoffer does not promote surrounding UI amounts', () => {
 const count = normalizeOcrResult({ ...offer, installmentsCount: '12' });
 assert.equal(count.extractionStatus, 'partial');
 assert.equal(count.installmentsCount, 0);
 assert.deepEqual(count.missingFields, ['installmentsCount']);
 const nonoffer = normalizeOcrResult({ ...offer, isValidOfferImage: false, isOfferImage: false });
 assert.equal(nonoffer.extractionStatus, 'not-offer');
 assert.equal(nonoffer.hasOfferData, false);
 assert.equal(nonoffer.cashPrice, 0);
 assert.equal(nonoffer.installmentAmount, 0);
 assert.equal(nonoffer.installmentsCount, 0);
 assert.equal(nonoffer.needsCurrencyConfirmation, false);
});

test('the OCR prompt distinguishes current price, historical price and an explicitly printed installment plan', () => {
 const prompt = buildOcrPrompt();
 assert.match(prompt, /Antes.*precio anterior/);
 assert.match(prompt, /No deduzcas el número de pagos/);
 assert.match(prompt, /captura.*interfaz/);
 assert.match(prompt, /isOfferImage/);
});

test('an ambiguous optional charge alone cannot become a charge in the default market', () => {
  const result = normalizeOcrResult({ isOfferImage: true, currency: 'UNKNOWN', upfrontFees: 25 });
  assert.equal(result.needsCurrencyConfirmation, false);
  assert.equal(result.upfrontFees, null);
});
