const SUPPORTED = ['New Delhi', 'Mumbai', 'Hyderabad', 'Bengaluru', 'Chennai', 'Kolkata', 'Vijayawada'];
const MAX_PRICE_AGE_MS = 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const CACHE_CONTROL = 's-maxage=120, stale-while-revalidate=60';
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  newdelhi: ['newdelhi', 'delhi'],
  bengaluru: ['bengaluru', 'bangalore'],
  mumbai: ['mumbai', 'bombay'],
  kolkata: ['kolkata', 'calcutta'],
  chennai: ['chennai', 'madras']
};

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return parseTimestamp(numeric);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function isFreshTimestamp(value, now = Date.now()) {
  const ms = parseTimestamp(value);
  return ms !== null && ms <= now + FUTURE_TOLERANCE_MS && now - ms <= MAX_PRICE_AGE_MS;
}
function rows(body) {
  if (Array.isArray(body)) return body;
  for (const key of ['data', 'results', 'prices', 'result']) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchJsonWithRetry(url, key, fuelType, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'x-api-key': key, accept: 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        if (!data || typeof data !== 'object') throw new Error('Invalid provider response');
        return data;
      }
      lastError = new Error(`Provider HTTP ${response.status}`);
      console.error('RatePulse fuel provider HTTP error:', JSON.stringify({ provider: 'indianapi', fuelType, status: response.status, attempt: attempt + 1 }));
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === attempts - 1) throw lastError;
    } catch (error) {
      lastError = error;
      console.error('RatePulse fuel provider request error:', JSON.stringify({ provider: 'indianapi', fuelType, attempt: attempt + 1, errorName: error?.name || 'Error', errorMessage: String(error?.message || 'unknown error').slice(0, 180) }));
      const retryable = error?.name === 'AbortError' || error instanceof TypeError ||
        error.message === 'Invalid provider response' ||
        /Provider HTTP (429|5\d\d)/.test(error.message || '');
      if (!retryable || attempt === attempts - 1) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
    await delay(250 * (attempt + 1));
  }
  throw lastError || new Error('Provider unavailable');
}
async function fetchFuel(type, key) {
  const url = new URL('https://fuel.indianapi.in/live_fuel_price');
  url.searchParams.set('fuel_type', type);
  url.searchParams.set('location_type', 'city');
  return rows(await fetchJsonWithRetry(url, key, type));
}
function getRate(list, city) {
  const names = aliases[normalize(city)] || [normalize(city)];
  const row = list.find(item => names.includes(normalize(item?.city ?? item?.name ?? item?.location)));
  const value = typeof row?.price === 'number'
    ? row.price
    : Number(String(row?.price ?? '').replace(/,/g, ''));
  const timestamp = row?.updated_at ?? row?.updatedAt ?? row?.timestamp ?? row?.last_updated;
  if (!row || !Number.isFinite(value) || value <= 0 || !isFreshTimestamp(timestamp)) return null;
  return { price: value, updatedAt: new Date(parseTimestamp(timestamp)).toISOString() };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', CACHE_CONTROL);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const requestedCity = typeof req.query?.city === 'string' && req.query.city.trim()
    ? req.query.city
    : 'Hyderabad';
  const city = SUPPORTED.find(value => normalize(value) === normalize(requestedCity));
  if (!city) {
    return res.status(400).json({ status: 'error', message: 'Unsupported city.' });
  }

  const key = process.env.FUEL_API_KEY;
  if (!key) {
    return res.status(503).json({
      status: 'not_configured',
      city,
      message: 'Live fuel prices are temporarily unavailable.',
      petrol: null,
      diesel: null,
      updatedAt: null
    });
  }

  try {
    const [petrolRows, dieselRows] = await Promise.all([
      fetchFuel('petrol', key),
      fetchFuel('diesel', key)
    ]);
    const petrol = getRate(petrolRows, city);
    const diesel = getRate(dieselRows, city);
    if (!petrol || !diesel) {
      return res.status(502).json({
        status: 'unavailable',
        city,
        message: 'The provider did not return fresh, verifiable prices for this city.',
        petrol: null,
        diesel: null,
        updatedAt: null
      });
    }

    return res.status(200).json({
      status: 'live',
      freshness: 'verified',
      source: 'Indian API',
      city,
      petrol: petrol.price,
      diesel: diesel.price,
      unit: 'INR per litre',
      updatedAt: [petrol.updatedAt, diesel.updatedAt].sort()[0]
    });
  } catch (error) {
    console.error('RatePulse fuel rates unavailable:', JSON.stringify({ city, errorName: error?.name || 'Error', errorMessage: String(error?.message || 'unknown error').slice(0, 180) }));
    return res.status(502).json({
      status: 'unavailable',
      city,
      message: 'Live fuel prices could not be verified. Please try again shortly.',
      petrol: null,
      diesel: null,
      updatedAt: null
    });
  }
}
