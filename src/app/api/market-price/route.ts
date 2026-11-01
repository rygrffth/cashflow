import { NextResponse } from 'next/server';

// In-memory cache for market prices (60 seconds TTL)
const cache: { [key: string]: { data: any; expiry: number } } = {};
const CACHE_TTL_MS = 60 * 1000;

const CRYPTO_MAP: Record<string, string> = {
  BTC: 'BTC-USD',
  BITCOIN: 'BTC-USD',
  ETH: 'ETH-USD',
  ETHEREUM: 'ETH-USD',
  SOL: 'SOL-USD',
  SOLANA: 'SOL-USD',
  DOGE: 'DOGE-USD',
  DOGECOIN: 'DOGE-USD',
  USDT: 'USDT-USD',
  TETHER: 'USDT-USD',
  BNB: 'BNB-USD',
  XRP: 'XRP-USD',
  ADA: 'ADA-USD'
};

const INDEX_MAP: Record<string, { symbol: string; name: string }> = {
  IHSG: { symbol: '^JKSE', name: 'Indeks Harga Saham Gabungan (IHSG)' },
  JKSE: { symbol: '^JKSE', name: 'Indeks Harga Saham Gabungan (IHSG)' },
  LQ45: { symbol: '^JKLQ45', name: 'Indeks LQ45 Indonesia' },
  USDIDR: { symbol: 'USDIDR=X', name: 'Nilai Tukar USD / IDR' }
};

interface ChartPoint {
  date: string;
  price: number;
}

interface QuoteResult {
  symbol: string;
  category: string;
  name: string;
  price: number;
  change24h: number;
  currency: string;
  unit: string;
  chartData: ChartPoint[];
  updatedAt: string;
}

async function fetchYahooChart(
  symbol: string,
  range = '7d'
): Promise<{
  price: number;
  change24h: number;
  name: string;
  currency: string;
  chartData: ChartPoint[];
} | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        next: { revalidate: 60 }
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || meta.regularMarketPrice === undefined) return null;

    const currentPrice = Number(meta.regularMarketPrice) || 0;
    const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose) || currentPrice;
    const change24h = prevClose > 0 ? Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;

    const ts: number[] = result.timestamp || [];
    const quotes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

    const chartData: ChartPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const p = quotes[i];
      if (p !== null && p !== undefined && !isNaN(p)) {
        chartData.push({
          date: new Date(ts[i] * 1000).toISOString().split('T')[0],
          price: Number(p.toFixed(2))
        });
      }
    }

    return {
      price: currentPrice,
      change24h,
      name: meta.shortName || meta.symbol || symbol,
      currency: meta.currency || 'IDR',
      chartData
    };
  } catch (e) {
    console.warn(`Yahoo chart fetch failed for ${symbol}:`, e);
    return null;
  }
}

async function fetchGoldQuoteWithChart(range = '7d'): Promise<QuoteResult | null> {
  try {
    const [goldRes, rateRes] = await Promise.all([
      fetchYahooChart('GC=F', range), // Gold futures in USD / troy ounce
      fetchYahooChart('USDIDR=X', range) // USD to IDR exchange rate
    ]);

    if (!goldRes?.price || !rateRes?.price) return null;

    const usdRate = rateRes.price;
    const goldPerGramIDR = Math.round((goldRes.price / 31.1034768) * usdRate);

    // Map chart data to IDR per gram
    const rateMap: Record<string, number> = {};
    rateRes.chartData.forEach(r => {
      rateMap[r.date] = r.price;
    });

    const chartData: ChartPoint[] = goldRes.chartData.map(g => {
      const rateOnDay = rateMap[g.date] || usdRate;
      return {
        date: g.date,
        price: Math.round((g.price / 31.1034768) * rateOnDay)
      };
    });

    return {
      symbol: 'EMAS',
      category: 'Emas',
      name: 'Emas Logam Mulia (Spot IDR / Gram)',
      price: goldPerGramIDR,
      change24h: goldRes.change24h,
      currency: 'IDR',
      unit: 'per gram',
      chartData,
      updatedAt: new Date().toISOString()
    };
  } catch (e) {
    console.warn('Gold quote error:', e);
    return null;
  }
}

async function fetchCryptoWithUSDIDR(
  yahooCryptoSymbol: string,
  symbolLabel: string,
  range = '7d'
): Promise<QuoteResult | null> {
  try {
    const [cryptoRes, rateRes] = await Promise.all([
      fetchYahooChart(yahooCryptoSymbol, range),
      fetchYahooChart('USDIDR=X', range)
    ]);

    if (!cryptoRes?.price || !rateRes?.price) return null;

    const usdRate = rateRes.price;
    const priceIDR = Math.round(cryptoRes.price * usdRate);

    const rateMap: Record<string, number> = {};
    rateRes.chartData.forEach(r => {
      rateMap[r.date] = r.price;
    });

    const chartData: ChartPoint[] = cryptoRes.chartData.map(c => {
      const rateOnDay = rateMap[c.date] || usdRate;
      return {
        date: c.date,
        price: Math.round(c.price * rateOnDay)
      };
    });

    return {
      symbol: symbolLabel,
      category: 'Crypto',
      name: cryptoRes.name,
      price: priceIDR,
      change24h: cryptoRes.change24h,
      currency: 'IDR',
      unit: 'per koin',
      chartData,
      updatedAt: new Date().toISOString()
    };
  } catch (e) {
    console.warn(`Crypto USDIDR fetch failed for ${symbolLabel}:`, e);
    return null;
  }
}

// Handler for market overview endpoint (IHSG, Emas, BTC, USD/IDR)
async function getMarketOverview() {
  const [ihsg, gold, btc, usdidr] = await Promise.all([
    fetchYahooChart('^JKSE', '7d'),
    fetchGoldQuoteWithChart('7d'),
    fetchCryptoWithUSDIDR('BTC-USD', 'BTC', '7d'),
    fetchYahooChart('USDIDR=X', '7d')
  ]);

  return {
    success: true,
    ihsg: ihsg
      ? {
          name: 'IHSG (Indeks Saham)',
          symbol: '^JKSE',
          price: ihsg.price,
          change24h: ihsg.change24h,
          unit: 'poin',
          sparkline: ihsg.chartData.slice(-7)
        }
      : null,
    gold: gold
      ? {
          name: 'Emas Logam Mulia',
          symbol: 'EMAS',
          price: gold.price,
          change24h: gold.change24h,
          unit: 'per gram (IDR)',
          sparkline: gold.chartData.slice(-7)
        }
      : null,
    btc: btc
      ? {
          name: 'Bitcoin (BTC)',
          symbol: 'BTC',
          price: btc.price,
          change24h: btc.change24h,
          unit: 'IDR',
          sparkline: btc.chartData.slice(-7)
        }
      : null,
    usdidr: usdidr
      ? {
          name: 'Kurs USD / IDR',
          symbol: 'USDIDR',
          price: Math.round(usdidr.price),
          change24h: usdidr.change24h,
          unit: 'IDR',
          sparkline: usdidr.chartData.slice(-7)
        }
      : null,
    updatedAt: new Date().toISOString()
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isOverview = searchParams.get('overview') === 'true';
  const range = (searchParams.get('range') || '7d').trim();

  // 1. Market Overview Request
  if (isOverview) {
    const cacheKey = 'MARKET_OVERVIEW';
    const now = Date.now();
    if (cache[cacheKey] && cache[cacheKey].expiry > now) {
      return NextResponse.json(cache[cacheKey].data);
    }
    const overviewData = await getMarketOverview();
    cache[cacheKey] = { data: overviewData, expiry: now + CACHE_TTL_MS };
    return NextResponse.json(overviewData);
  }

  // 2. Specific Symbol Request
  const symbol = (searchParams.get('symbol') || searchParams.get('q') || '').trim();
  if (!symbol) {
    return NextResponse.json(
      { success: false, error: 'Parameter symbol/q atau overview=true wajib disertakan (contoh: ?symbol=IHSG, ?symbol=BBCA, ?symbol=EMAS)' },
      { status: 400 }
    );
  }

  const upper = symbol.toUpperCase();
  const cacheKey = `${upper}_${range}`;
  const now = Date.now();

  if (cache[cacheKey] && cache[cacheKey].expiry > now) {
    return NextResponse.json({
      success: true,
      cached: true,
      ...cache[cacheKey].data
    });
  }

  // A. Check if it's IHSG or Market Index
  const indexMatch = INDEX_MAP[upper];
  if (indexMatch) {
    const quote = await fetchYahooChart(indexMatch.symbol, range);
    if (quote) {
      const result: QuoteResult = {
        symbol: upper,
        category: 'Indeks Pasar',
        name: indexMatch.name,
        price: quote.price,
        change24h: quote.change24h,
        currency: quote.currency,
        unit: 'poin',
        chartData: quote.chartData,
        updatedAt: new Date().toISOString()
      };
      cache[cacheKey] = { data: result, expiry: now + CACHE_TTL_MS };
      return NextResponse.json({ success: true, ...result });
    }
  }

  // B. Check if it's Gold / Emas
  if (['EMAS', 'GOLD', 'ANTAM', 'XAU', 'LOGAMMULIA'].includes(upper)) {
    const gold = await fetchGoldQuoteWithChart(range);
    if (gold) {
      cache[cacheKey] = { data: gold, expiry: now + CACHE_TTL_MS };
      return NextResponse.json({ success: true, ...gold });
    }
  }

  // C. Check if it's Crypto
  const yahooCryptoSymbol = CRYPTO_MAP[upper];
  if (yahooCryptoSymbol) {
    const crypto = await fetchCryptoWithUSDIDR(yahooCryptoSymbol, upper, range);
    if (crypto) {
      cache[cacheKey] = { data: crypto, expiry: now + CACHE_TTL_MS };
      return NextResponse.json({ success: true, ...crypto });
    }
  }

  // D. Fallback to Stock / ETF via Yahoo Finance
  let querySymbol = upper;
  if (/^[A-Z]{4}$/.test(upper)) {
    querySymbol = `${upper}.JK`;
  }

  const stockQuote = await fetchYahooChart(querySymbol, range);
  if (stockQuote) {
    const isIDX = querySymbol.endsWith('.JK');
    const result: QuoteResult = {
      symbol: stockQuote.name || upper,
      category: isIDX ? 'Saham' : 'Global / Saham',
      name: stockQuote.name,
      price: stockQuote.price,
      change24h: stockQuote.change24h,
      currency: stockQuote.currency,
      unit: stockQuote.currency === 'IDR' ? 'per lembar' : 'per share',
      chartData: stockQuote.chartData,
      updatedAt: new Date().toISOString()
    };
    cache[cacheKey] = { data: result, expiry: now + CACHE_TTL_MS };
    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json(
    {
      success: false,
      error: `Simbol "${symbol}" tidak ditemukan. Contoh: IHSG, BBCA, BBRI, EMAS, BTC, ETH, AAPL`
    },
    { status: 404 }
  );
}
