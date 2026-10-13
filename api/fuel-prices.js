const SUPPORTED = ['New Delhi', 'Mumbai', 'Hyderabad', 'Bengaluru', 'Chennai', 'Kolkata', 'Vijayawada'];
const CACHE_CONTROL = 's-maxage=60, stale-while-revalidate=30';
const PROVIDER_URL = 'https://zylalabs.com/api/13701/get+fuel+prices+in+india+api/31187/latest';
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  newdelhi: ['newdelhi', 'delhi'],
  bengaluru: ['bengaluru', 'bangalore'],
  mumbai: ['mumbai', 'bombay'],
  kolkata: ['kolkata', 'calcutta'],
  chennai: ['chennai', 'madras']
};

function indiaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function validPrice(value) {
  const price = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function fetchLatest(city, key) {
  const url = new URL(PROVIDER_URL);
  url.searchParams.set('city', city);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
    });
    if (!response.ok) {
      console.error('RatePulse fuel provider HTTP error:', JSON.stringify({
        provider: 'zylalabs', status: response.status
      }));
      throw new Error(`Fuel provider HTTP ${response.status}`);
    }
    const body = await response.json();
    if (!body || body.success !== true || !body.data || typeof body.data !== 'object') {
      throw new Error('Invalid fuel provider response');
    }
    return body.data;
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

  const key = process.env.ZYLALABS_API_KEY;
  if (!key) {
    return res.status(503).json({
      status: 'not_configured',
      city,
      message: 'Live fuel prices are temporarily unavailable.',
      petrol: null,
      diesel: null,
      priceDate: null
    });
  }

  try {
    const data = await fetchLatest(city, key);
    const returnedCity = normalize(data.city);
    const cityNames = aliases[normalize(city)] || [normalize(city)];
    const petrol = validPrice(data.fuels?.petrol?.price);
    const diesel = validPrice(data.fuels?.diesel?.price);
    const priceDate = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      ? data.date
      : null;

    // The provider gives a date, not an intraday timestamp. Only call it current
    // when the source explicitly dates the snapshot to today's date in India.
    if (!cityNames.includes(returnedCity) || !priceDate || priceDate !== indiaDate() || !petrol || !diesel) {
      return res.status(502).json({
        status: 'unavailable',
        city,
        message: 'The provider did not return verifiable prices dated today. Please try again later.',
        petrol: null,
        diesel: null,
        priceDate
      });
    }

    return res.status(200).json({
      status: 'live',
      freshness: 'dated-today',
      source: data.source || 'Zyla Labs fuel data',
      city,
      petrol,
      diesel,
      unit: 'INR per litre',
      priceDate
    });
  } catch (error) {
    console.error('RatePulse fuel rates unavailable:', JSON.stringify({
      provider: 'zylalabs',
      city,
      errorName: error?.name || 'Error',
      errorMessage: String(error?.message || 'unknown error').slice(0, 160)
    }));
    return res.status(502).json({
      status: 'unavailable',
      city,
      message: 'Live fuel prices could not be verified. Please try again shortly.',
      petrol: null,
      diesel: null,
      priceDate: null
    });
  }
}
