import test from 'node:test';
import assert from 'node:assert/strict';
import marketHandler from '../api/market-rates.js';
import fuelHandler from '../api/fuel-prices.js';

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
async function invoke(handler, req = { method: 'GET', query: {} }) {
  const res = responseMock();
  await handler(req, res);
  return res;
}
function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
const originalFetch = globalThis.fetch;
const originalGoldKey = process.env.GOLDAPI_KEY;
const originalFuelKey = process.env.FUEL_API_KEY;
function resetEnv() {
  if (originalGoldKey === undefined) delete process.env.GOLDAPI_KEY;
  else process.env.GOLDAPI_KEY = originalGoldKey;
  if (originalFuelKey === undefined) delete process.env.FUEL_API_KEY;
  else process.env.FUEL_API_KEY = originalFuelKey;
}
test.after(() => { globalThis.fetch = originalFetch; resetEnv(); });

test('market endpoint rejects non-GET methods', async () => {
  const res = await invoke(marketHandler, { method: 'POST', query: {} });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});

test('market endpoint reports missing key without exposing secrets', async () => {
  delete process.env.GOLDAPI_KEY;
  const res = await invoke(marketHandler);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, 'not_configured');
  assert.equal(res.body.metals, null);
});

test('market endpoint returns validated current prices', async () => {
  process.env.GOLDAPI_KEY = 'test-secret';
  const timestamp = Math.floor(Date.now() / 1000);
  globalThis.fetch = async url => {
    assert.match(String(url), /goldapi\.io/);
    if (String(url).includes('/XAU/')) return jsonResponse({ price: 2500, price_gram_24k: 80, price_gram_22k: 73, timestamp });
    return jsonResponse({ price: 30, timestamp });
  };
  const res = await invoke(marketHandler);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'live');
  assert.equal(res.body.metals.gold24k.per10g, 800);
  assert.ok(Number.isFinite(Date.parse(res.body.updatedAt)));
});

test('market endpoint rejects stale provider data', async () => {
  process.env.GOLDAPI_KEY = 'test-secret';
  const stale = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000);
  globalThis.fetch = async url => jsonResponse({ price: String(url).includes('/XAU/') ? 2500 : 30, timestamp: stale });
  const res = await invoke(marketHandler);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.status, 'unavailable');
  assert.equal(res.body.metals, null);
});

test('market endpoint handles provider failures with safe response', async () => {
  process.env.GOLDAPI_KEY = 'test-secret';
  globalThis.fetch = async () => jsonResponse({ message: 'internal secret details' }, 401);
  const res = await invoke(marketHandler);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(res.body), /internal secret details|test-secret/);
});

test('fuel endpoint rejects unsupported cities', async () => {
  const res = await invoke(fuelHandler, { method: 'GET', query: { city: 'Atlantis' } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.status, 'error');
});

test('fuel endpoint reports missing key without prices', async () => {
  delete process.env.FUEL_API_KEY;
  const res = await invoke(fuelHandler, { method: 'GET', query: { city: 'Hyderabad' } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, 'not_configured');
  assert.equal(res.body.petrol, null);
  assert.equal(res.body.diesel, null);
});

test('fuel endpoint returns current city prices', async () => {
  process.env.FUEL_API_KEY = 'test-secret';
  const timestamp = new Date().toISOString();
  globalThis.fetch = async url => {
    const type = new URL(String(url)).searchParams.get('fuel_type');
    return jsonResponse([{ city: 'Hyderabad', price: type === 'petrol' ? 105.5 : 92.2, updated_at: timestamp }]);
  };
  const res = await invoke(fuelHandler, { method: 'GET', query: { city: 'Hyderabad' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'live');
  assert.equal(res.body.petrol, 105.5);
  assert.equal(res.body.diesel, 92.2);
  assert.equal(res.body.city, 'Hyderabad');
});

test('fuel endpoint rejects missing or stale timestamps', async () => {
  process.env.FUEL_API_KEY = 'test-secret';
  const stale = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  globalThis.fetch = async url => {
    const type = new URL(String(url)).searchParams.get('fuel_type');
    return jsonResponse([{ city: 'Hyderabad', price: type === 'petrol' ? 105.5 : 92.2, updated_at: stale }]);
  };
  const res = await invoke(fuelHandler, { method: 'GET', query: { city: 'Hyderabad' } });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.status, 'unavailable');
  assert.equal(res.body.petrol, null);
});
