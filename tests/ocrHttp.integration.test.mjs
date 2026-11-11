import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer, handleOcrRequest } from '../server.mjs';

async function usingServer(provider, run) {
  const reports = [];
  const server = createAppServer({
    ocrHandler: body => handleOcrRequest(body, { accessToken: async () => 'integration-only', request: provider }),
    report: entry => reports.push(entry),
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`, reports); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const image = { imageBase64: 'aW50ZWdyYXRpb24=', mimeType: 'image/jpeg', country: 'AUTO' };
const providerResponse = value => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }));
const post = (base, body) => fetch(base + '/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('HTTP upload preserves Q996 from partial provider response and exposes no fabricated payment plan', async () => {
  let calls = 0;
  await usingServer(async (url, options) => {
    calls++;
    assert.match(url, /gemini-3\.8-flash:generateContent/);
    const request = JSON.parse(options.body);
    assert.equal(request.contents[0].parts[1].inlineData.data, image.imageBase64);
    return providerResponse({ isOfferImage: true, currency: 'GTQ', cashPrice: 996 });
  }, async (base, reports) => {
    const response = await post(base, image);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('server-timing'), /analysis;dur=/);
    const data = await response.json();
    assert.equal(data.extractionStatus, 'partial');
    assert.equal(data.cashPrice, 996);
    assert.equal(data.installmentAmount, 0);
    assert.equal(data.installmentsCount, 0);
    assert.equal(calls, 1);
    assert.equal(reports[0].extractionStatus, 'partial');
    assert.ok(!JSON.stringify(reports).includes(image.imageBase64));
    assert.ok(!JSON.stringify(reports).includes('996'));
  });
});

test('HTTP regional offer keeps COP and rejects missing input without calling the model', async () => {
  let calls = 0;
  await usingServer(async () => {
    calls++;
    return providerResponse({ isValidOfferImage: true, currency: 'COP', cashPrice: 1200000, installmentAmount: 100000, installmentQuoteType: 'exact', installmentEvidence: '12 cuotas de COP 100.000', installmentsCount: 12 });
  }, async base => {
    assert.equal((await post(base, {})).status, 400);
    assert.equal(calls, 0);
    const data = await (await post(base, image)).json();
    assert.equal(data.country, 'CO');
    assert.equal(data.currency, 'COP');
    assert.equal(data.cashPrice, 1200000);
    assert.equal(data.isValidOfferImage, true);
    assert.equal(calls, 1);
  });
});

test('HTTP indicative installment cannot become a complete offer even when the model labels its number exact', async () => {
  for (const quoteType of ['from', 'exact']) {
    await usingServer(async () => providerResponse({
      isValidOfferImage: true, currency: 'COP', cashPrice: 499900,
      installmentAmount: 41658, installmentsCount: 12, interestCondition: 'advertised_zero',
      installmentQuoteType: quoteType,
      installmentEvidence: 'Desde $ 41.658 en 12 cuotas sin intereses* o $ 499.900',
    }), async base => {
      const response = await post(base, image);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.cashPrice, 499900);
      assert.equal(data.installmentsCount, 12);
      assert.equal(data.installmentAmount, 0);
      assert.equal(data.quotedInstallmentAmount, 41658);
      assert.equal(data.installmentQuoteType, 'from');
      assert.equal(data.installmentNeedsConfirmation, true);
      assert.equal(data.extractionStatus, 'partial');
      assert.equal(data.isValidOfferImage, false);
      assert.deepEqual(data.missingFields, ['installmentAmount']);
      assert.match(data.rejectionReason, /cuota indicativa/);
    });
  }
});

test('HTTP installment numbers without evidence fail closed while cash and count remain usable', async () => {
  for (const evidence of [undefined, { installmentQuoteType: 'unknown', installmentEvidence: 'Cuotas disponibles' }, { installmentQuoteType: 'exact', installmentEvidence: '' }, { installmentQuoteType: 'exact', installmentEvidence: { text: '10 cuotas de Q319.60' } }]) {
    await usingServer(async () => providerResponse({
      isValidOfferImage: true, currency: 'GTQ', cashPrice: 3196,
      installmentAmount: 319.6, installmentsCount: 10, ...evidence,
    }), async base => {
      const data = await (await post(base, image)).json();
      assert.equal(data.cashPrice, 3196);
      assert.equal(data.installmentsCount, 10);
      assert.equal(data.installmentAmount, 0);
      assert.equal(data.installmentNeedsConfirmation, true);
      assert.equal(data.extractionStatus, 'partial');
    });
  }
});

test('HTTP provider failure is recoverable, human-readable and does not leak payloads', async () => {
  await usingServer(async () => new Response('private upstream message', { status: 429 }), async (base, reports) => {
    const response = await post(base, image);
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.match(data.error, /ingresa los montos/);
    assert.ok(!JSON.stringify(data).includes('private upstream'));
    assert.equal(reports[0].event, 'offer_review_failed');
    assert.ok(!JSON.stringify(reports).includes('private upstream'));
  });
});
