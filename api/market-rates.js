const MAX_PRICE_AGE_MS = 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const CACHE_CONTROL = 's-maxage=120, stale-while-revalidate=60';

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Providers commonly return Unix seconds; tolerate milliseconds too.
    const ms = value > 1e12 ? value : value * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return parseTimestamp(numeric);
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function isFreshTimestamp(timestamp, now = Date.now()) {
  const ms = parseTimestamp(timestamp);
  return ms !== null && ms <= now + FUTURE_TOLERANCE_MS && now - ms <= MAX_PRICE_AGE_MS;
}

function validPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (response.ok) {
        const data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Invalid provider response');
        }
        return data;
      }
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`Provider HTTP ${response.status}`);
      if (!retryable || attempt === attempts - 1) throw lastError;
    } catch (error) {
      lastError = error;
      const retryable = error?.name === 'AbortError' ||
        error instanceof TypeError ||
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

async function getMetal(symbol, apiKey) {
  const data = await fetchJsonWithRetry(`https://www.goldapi.io/api/${symbol}/INR`, {
    headers: { 'x-access-token': apiKey, accept: 'application/json' }
  });
  if (!validPositiveNumber(data.price)) throw new Error('Invalid provider price');
  if (!isFreshTimestamp(data.timestamp)) throw new Error('Provider price timestamp missing or stale');
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', CACHE_CONTROL);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const apiKey = process.env.GOLDAPI_KEY;
  if (!apiKey) {
    return res.status(503).json({
      status: 'not_configured',
      message: 'Live metal prices are temporarily unavailable.',
      metals: null,
      updatedAt: null
    });
  }

  try {
    const [gold, silver] = await Promise.all([
      getMetal('XAU', apiKey),
      getMetal('XAG', apiKey)
    ]);
    const gold24PerGram = validPositiveNumber(gold.price_gram_24k)
      ? gold.price_gram_24k
      : gold.price / 31.1034768;
    const gold22PerGram = validPositiveNumber(gold.price_gram_22k)
      ? gold.price_gram_22k
      : gold24PerGram * (22 / 24);
    const silverPerKg = (silver.price / 31.1034768) * 1000;

    if (![gold24PerGram, gold22PerGram, silverPerKg].every(validPositiveNumber)) {
      throw new Error('Invalid calculated market price');
    }

    const goldTimestamp = parseTimestamp(gold.timestamp);
    const silverTimestamp = parseTimestamp(silver.timestamp);
    const updatedAt = Math.min(goldTimestamp, silverTimestamp);

    return res.status(200).json({
      status: 'live',
      freshness: 'verified',
      source: 'GoldAPI.io',
      updatedAt: new Date(updatedAt).toISOString(),
      metals: {
        gold24k: {
          per10g: Math.round(gold24PerGram * 10 * 100) / 100,
          unit: 'INR per 10 grams',
          market: 'spot-equivalent'
        },
        gold22k: {
          per10g: Math.round(gold22PerGram * 10 * 100) / 100,
          unit: 'INR per 10 grams',
          market: 'spot-equivalent'
        },
        silverPerKg: Math.round(silverPerKg * 100) / 100,
        silverUnit: 'INR per kilogram',
        market: 'spot-equivalent'
      }
    });
  } catch (error) {
    console.error('RatePulse market rates unavailable:', error?.message || 'unknown error');
    return res.status(502).json({
      status: 'unavailable',
      freshness: 'unverified',
      message: 'Live metal prices could not be verified. Please try again shortly.',
      metals: null,
      updatedAt: null
    });
  }
}
