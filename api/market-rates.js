const TROY_OUNCE_GRAMS = 31.1034768;

async function getMetal(symbol, apiKey) {
  const response = await fetch(`https://www.goldapi.io/api/${symbol}/INR`, {
    headers: {
      'x-access-token': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`GoldAPI request failed for ${symbol} (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (typeof data.price !== 'number' || !Number.isFinite(data.price)) {
    throw new Error(`GoldAPI returned no valid ${symbol} price`);
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const apiKey = process.env.GOLDAPI_KEY;
  if (!apiKey) {
    return res.status(200).json({
      status: 'not_configured',
      message: 'Add GOLDAPI_KEY in Vercel project environment variables.',
      metals: null,
      updatedAt: null
    });
  }

  try {
    const [gold, silver] = await Promise.all([
      getMetal('XAU', apiKey),
      getMetal('XAG', apiKey)
    ]);

    const gold24PerGram = typeof gold.price_gram_24k === 'number'
      ? gold.price_gram_24k
      : gold.price / TROY_OUNCE_GRAMS;
    const gold22PerGram = typeof gold.price_gram_22k === 'number'
      ? gold.price_gram_22k
      : gold24PerGram * (22 / 24);
    const silverPerKg = (silver.price / TROY_OUNCE_GRAMS) * 1000;

    return res.status(200).json({
      status: 'live',
      source: 'GoldAPI.io',
      updatedAt: new Date(Math.min(
        gold.timestamp || Date.now() / 1000,
        silver.timestamp || Date.now() / 1000
      ) * 1000).toISOString(),
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
    console.error('RatePulse market rates error:', error.message);
    return res.status(502).json({
      status: 'unavailable',
      message: 'The live metals provider could not return valid prices. Try again later.',
      metals: null,
      updatedAt: null
    });
  }
}