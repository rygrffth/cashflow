import { NextResponse } from 'next/server';

// In-memory cache for market prices (60 seconds TTL)
const cache: { [key: string]: { data: any; expiry: number } } = {};
const CACHE_TTL_MS = 60 * 1000;

const CRYPTO_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  BITCOIN: 'bitcoin',
  ETH: 'ethereum',
  ETHEREUM: 'ethereum',
  SOL: 'solana',
  SOLANA: 'solana',
  USDT: 'tether',
  TETHER: 'tether',
  BNB: 'binancecoin',
  DOGE: 'dogecoin',
  DOGECOIN: 'dogecoin',
  XRP: 'ripple',
  RIPPLE: 'ripple',
  ADA: 'cardano',
  CARDANO: 'cardano',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  POL: 'matic-network'
};

async function fetchCryptoPrice(coinId: string): Promise<{ price: number; change24h: number; name: string } | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=idr&include_24hr_change=true`,
      {
        headers: { 'User-Agent': 'WebKeuangan/1.0' },
        next: { revalidate: 60 }
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data[coinId]) {
      return {
        price: Math.round(Number(data[coinId].idr) || 0),
        change24h: Number(data[coinId].idr_24h_change?.toFixed(2)) || 0,
        name: coinId.toUpperCase()
      };
    }
  } catch (e) {
    console.warn(`Crypto price fetch failed for ${coinId}:`, e);
  }
  return null;
}

async function fetchYahooQuote(rawSymbol: string): Promise<{ price: number; change24h: number; name: string; currency: string } | null> {
  try {
    // If 4 uppercase letters without dot, treat as IDX stock (e.g. BBCA -> BBCA.JK)
    let symbol = rawSymbol.trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(symbol)) {
      symbol = `${symbol}.JK`;
    }

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        next: { revalidate: 60 }
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice === undefined) return null;

    const currentPrice = Number(meta.regularMarketPrice) || 0;
    const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose) || currentPrice;
    const change24h = prevClose > 0 ? Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;

    return {
      price: currentPrice,
      change24h,
      name: meta.shortName || meta.symbol || symbol,
      currency: meta.currency || 'IDR'
    };
  } catch (e) {
    console.warn(`Yahoo quote fetch failed for ${rawSymbol}:`, e);
  }
  return null;
}

async function fetchGoldPriceIDR(): Promise<{ price: number; change24h: number; name: string } | null> {
  try {
    const [goldRes, rateRes] = await Promise.all([
      fetchYahooQuote('GC=F'), // Gold futures (USD / troy ounce)
      fetchYahooQuote('USDIDR=X') // USD to IDR exchange rate
    ]);

    if (goldRes?.price && rateRes?.price) {
      // 1 Troy Ounce = 31.1034768 grams
      const goldPerGramUSD = goldRes.price / 31.1034768;
      const goldPerGramIDR = Math.round(goldPerGramUSD * rateRes.price);
      return {
        price: goldPerGramIDR,
        change24h: goldRes.change24h,
        name: 'Emas Logam Mulia (Spot IDR / Gram)'
      };
    }
  } catch (e) {
    console.warn('Gold price calculation error:', e);
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || searchParams.get('q') || '').trim();

  if (!symbol) {
    return NextResponse.json(
      { success: false, error: 'Parameter symbol/q wajib disertakan (contoh: ?symbol=BBCA atau ?symbol=BTC)' },
      { status: 400 }
    );
  }

  const cacheKey = symbol.toUpperCase();
  const now = Date.now();

  // Return from in-memory cache if fresh
  if (cache[cacheKey] && cache[cacheKey].expiry > now) {
    return NextResponse.json({
      success: true,
      cached: true,
      ...cache[cacheKey].data
    });
  }

  const upper = symbol.toUpperCase();

  // 1. Check if it's Gold / Emas
  if (['EMAS', 'GOLD', 'ANTAM', 'XAU', 'LOGAMMULIA'].includes(upper)) {
    const gold = await fetchGoldPriceIDR();
    if (gold) {
      const result = {
        symbol: 'EMAS',
        category: 'Emas',
        name: gold.name,
        price: gold.price,
        change24h: gold.change24h,
        currency: 'IDR',
        unit: 'per gram',
        updatedAt: new Date().toISOString()
      };
      cache[cacheKey] = { data: result, expiry: now + CACHE_TTL_MS };
      return NextResponse.json({ success: true, ...result });
    }
  }

  // 2. Check if it's Crypto
  const cryptoId = CRYPTO_MAP[upper];
  if (cryptoId) {
    const crypto = await fetchCryptoPrice(cryptoId);
    if (crypto) {
      const result = {
        symbol: upper,
        category: 'Crypto',
        name: crypto.name,
        price: crypto.price,
        change24h: crypto.change24h,
        currency: 'IDR',
        unit: 'per coin',
        updatedAt: new Date().toISOString()
      };
      cache[cacheKey] = { data: result, expiry: now + CACHE_TTL_MS };
      return NextResponse.json({ success: true, ...result });
    }
  }

  // 3. Fallback to Stock / ETF / Index Quote via Yahoo Finance
  const quote = await fetchYahooQuote(upper);
  if (quote) {
    const result = {
      symbol: quote.name || upper,
      category: upper.endsWith('.JK') || /^[A-Z]{4}$/.test(upper) ? 'Saham' : 'Global / Saham',
      name: quote.name,
      price: quote.price,
      change24h: quote.change24h,
      currency: quote.currency,
      unit: quote.currency === 'IDR' ? 'per lembar' : 'per share',
      updatedAt: new Date().toISOString()
    };
    cache[cacheKey] = { data: result, expiry: now + CACHE_TTL_MS };
    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json(
    {
      success: false,
      error: `Simbol "${symbol}" tidak ditemukan. Contoh format yang didukung: BBCA, BBRI, GOTO, BTC, ETH, SOL, EMAS, AAPL`
    },
    { status: 404 }
  );
}
