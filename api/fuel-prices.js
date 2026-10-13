const SUPPORTED = ['New Delhi', 'Mumbai', 'Hyderabad', 'Bengaluru', 'Chennai', 'Kolkata', 'Vijayawada'];
const MAX_DATA_AGE_MS = 36 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const CACHE_CONTROL = 's-maxage=60, stale-while-revalidate=30';
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  newdelhi: ['newdelhi', 'delhi'],
  bengaluru: ['bengaluru', 'bangalore'],
  mumbai: ['mumbai', 'bombay'],
  kolkata: ['kolkata', 'calcutta'],
  chennai: ['chennai', 'madras']
};

function parseTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validPrice(value) {
  const price = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(price) && price > 0 ? price : null;
}

function isFresh(value, now = Date.now()) {
  const ms = parseTimestamp(value);
  return ms !== null && ms <= now + FUTURE_TOLERANCE_MS && now - ms <= MAX_DATA_AGE_MS;
}

async function fetchCity(city) {
  const url = new URL('https://api.apimitra.in/fuel');
  url.searchParams.set('city', city);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      console.error('RatePulse fuel provider HTTP error:', JSON.stringify({
        provider: 'apimitra', status: response.status
      }));
      throw new Error(`Fuel provider HTTP ${response.status}`);
    }
    const body = await response.json();
    if (!body || body.status !== 'ok' || !body.price || typeof body.price !== 'object') {
      throw new Error('Invalid fuel provider response');
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
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

  try {
    const body = await fetchCity(city);
    const returnedCity = normalize(body.price.location ?? body.city);
    const acceptedNames = aliases[normalize(city)] || [normalize(city)];
    const petrol = validPrice(body.price.petrol?.price);
    const diesel = validPrice(body.price.diesel?.price);
    const updatedAt = body.price.updated_at ?? body.updated_at ?? body.fetched_at ?? body.updated;
    const timestamp = parseTimestamp(updatedAt);

    if (!acceptedNames.includes(returnedCity) || !petrol || !diesel || !isFresh(updatedAt)) {
      return res.status(502).json({
        status: 'unavailable',
        city,
        message: 'The free provider did not return fresh, verifiable prices for this city.',
        petrol: null,
        diesel: null,
        updatedAt: null
      });
    }

    return res.status(200).json({
      status: 'live',
      freshness: 'verified',
      source: 'API Mitra',
      city,
      petrol,
      diesel,
      unit: 'INR per litre',
      updatedAt: new Date(timestamp).toISOString()
    });
  } catch (error) {
    console.error('RatePulse fuel rates unavailable:', JSON.stringify({
      provider: 'apimitra',
      city,
      errorName: error?.name || 'Error',
      errorMessage: String(error?.message || 'unknown error').slice(0, 160)
    }));
    return res.status(502).json({
      status: 'unavailable',
      city,
      message: 'Fuel prices could not be verified. Please try again shortly.',
      petrol: null,
      diesel: null,
      updatedAt: null
    });
  }
}
