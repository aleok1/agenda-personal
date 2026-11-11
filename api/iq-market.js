// API en Tiempo Real para Consejero Táctico IQ Option (US 500, US 100 y Divisas)
// Basado en: Medias Móviles, RSI, Bandas de Bollinger, Soportes y Resistencias y Acción de Precio + Análisis Fundamental

const IQ_OPTION_ASSETS = {
  // ÍNDICES PRINCIPALES QUE OPERA ALEJANDRO
  'US 500': {
    iqName: 'US 500',
    subtitle: 'S&P 500 Index (Wall Street)',
    category: 'Índices',
    primarySymbol: 'ES=F',     // Futuros continuos S&P 500 (mismo feed 24h que IQ Option)
    fallbackSymbol: '^GSPC',   // Índice contado S&P 500
    newsQuery: 'SPY S&P 500 stock market FED',
    tvSymbol: 'FOREXCOM:SPXUSD',
    decimals: 2,
    macroDrivers: 'Decisiones de tasas de la FED, inflación CPI/PPI de EE.UU., balances de las 7 Magníficas y datos de empleo NFP.'
  },
  'US 100': {
    iqName: 'US 100',
    subtitle: 'Nasdaq 100 Tecnológico (Wall Street)',
    category: 'Índices',
    primarySymbol: 'NQ=F',     // Futuros continuos Nasdaq 100
    fallbackSymbol: '^NDX',    // Índice contado Nasdaq
    newsQuery: 'QQQ Nasdaq 100 tech stocks Nvidia',
    tvSymbol: 'FOREXCOM:NSXUSD',
    decimals: 2,
    macroDrivers: 'Sector tecnológico e IA (Nvidia, Apple, Microsoft), rendimientos de los bonos del Tesoro de EE.UU. a 10 años y liquidez bancaria.'
  },

  // DIVISAS (FOREX / BINARIAS / DIGITALES DE IQ OPTION)
  'EUR/USD': {
    iqName: 'EUR/USD',
    subtitle: 'Euro vs Dólar Estadounidense',
    category: 'Divisas',
    primarySymbol: 'EURUSD=X',
    fallbackSymbol: 'EURUSD=X',
    newsQuery: 'EURUSD Euro Dollar Forex BCE FED',
    tvSymbol: 'FX:EURUSD',
    decimals: 5,
    macroDrivers: 'Diferencial de tasas de interés FED vs BCE, IPC de la Eurozona, nóminas no agrícolas de EE.UU. y balanza comercial europea.'
  },
  'GBP/USD': {
    iqName: 'GBP/USD',
    subtitle: 'Libra Esterlina vs Dólar Estadounidense',
    category: 'Divisas',
    primarySymbol: 'GBPUSD=X',
    fallbackSymbol: 'GBPUSD=X',
    newsQuery: 'GBPUSD Pound Dollar Forex Bank of England',
    tvSymbol: 'FX:GBPUSD',
    decimals: 5,
    macroDrivers: 'Decisiones del Banco de Inglaterra (BoE), inflación británica y fortaleza del dólar estadounidense (DXY).'
  },
  'USD/JPY': {
    iqName: 'USD/JPY',
    subtitle: 'Dólar Estadounidense vs Yen Japonés',
    category: 'Divisas',
    primarySymbol: 'JPY=X',
    fallbackSymbol: 'JPY=X',
    newsQuery: 'USDJPY Yen Dollar Forex Bank of Japan',
    tvSymbol: 'FX:USDJPY',
    decimals: 3,
    macroDrivers: 'Rendimiento de los bonos del Tesoro de EE.UU. a 10 años, intervenciones cambiarias del Banco de Japón (BoJ) y diferenciales de tasas.'
  },
  'EUR/JPY': {
    iqName: 'EUR/JPY',
    subtitle: 'Euro vs Yen Japonés',
    category: 'Divisas',
    primarySymbol: 'EURJPY=X',
    fallbackSymbol: 'EURJPY=X',
    newsQuery: 'EURJPY Euro Yen Forex',
    tvSymbol: 'FX:EURJPY',
    decimals: 3,
    macroDrivers: 'Sentimiento de apetito de riesgo global, política monetaria del BCE frente al sesgo acomodaticio de Japón.'
  },
  'AUD/USD': {
    iqName: 'AUD/USD',
    subtitle: 'Dólar Australiano vs Dólar Estadounidense',
    category: 'Divisas',
    primarySymbol: 'AUDUSD=X',
    fallbackSymbol: 'AUDUSD=X',
    newsQuery: 'AUDUSD Australian Dollar Forex RBA China',
    tvSymbol: 'FX:AUDUSD',
    decimals: 5,
    macroDrivers: 'Demanda de commodities en China, precios del mineral de hierro y oro, y política del Banco de la Reserva de Australia (RBA).'
  },
  'GBP/JPY': {
    iqName: 'GBP/JPY',
    subtitle: 'Libra Esterlina vs Yen Japonés (El Dragón)',
    category: 'Divisas',
    primarySymbol: 'GBPJPY=X',
    fallbackSymbol: 'GBPJPY=X',
    newsQuery: 'GBPJPY Forex volatile currency',
    tvSymbol: 'FX:GBPJPY',
    decimals: 3,
    macroDrivers: 'Par de alta volatilidad impulsado por noticias del Reino Unido, aversión al riesgo y compras de refugio en Yen.'
  },
  'EUR/GBP': {
    iqName: 'EUR/GBP',
    subtitle: 'Euro vs Libra Esterlina',
    category: 'Divisas',
    primarySymbol: 'EURGBP=X',
    fallbackSymbol: 'EURGBP=X',
    newsQuery: 'EURGBP Euro Pound Forex',
    tvSymbol: 'FX:EURGBP',
    decimals: 5,
    macroDrivers: 'Divergencia entre la economía de la Eurozona y el Reino Unido, anuncios del BCE vs BoE.'
  },
  'USD/CAD': {
    iqName: 'USD/CAD',
    subtitle: 'Dólar Estadounidense vs Dólar Canadiense',
    category: 'Divisas',
    primarySymbol: 'CAD=X',
    fallbackSymbol: 'CAD=X',
    newsQuery: 'USDCAD Canadian Dollar Oil Forex',
    tvSymbol: 'FX:USDCAD',
    decimals: 5,
    macroDrivers: 'Cotización internacional del petróleo (Canadá es gran exportador), Banco de Canadá (BoC) y datos de empleo.'
  },
  'USD/CHF': {
    iqName: 'USD/CHF',
    subtitle: 'Dólar Estadounidense vs Franco Suizo',
    category: 'Divisas',
    primarySymbol: 'CHF=X',
    fallbackSymbol: 'CHF=X',
    newsQuery: 'USDCHF Swiss Franc Forex SNB',
    tvSymbol: 'FX:USDCHF',
    decimals: 5,
    macroDrivers: 'Flujos de refugio hacia el Franco Suizo, Banco Nacional Suizo (SNB) y fortaleza del dólar.'
  }
};

// Medias Móviles (SMA y EMA)
function calcSMA(values, period) {
  if (!values || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

function calcEMASeries(values, period) {
  if (!values || values.length < period) return [];
  const k = 2 / (period + 1);
  const ema = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prevEma = sum / period;
  ema[period - 1] = prevEma;
  for (let i = period; i < values.length; i++) {
    prevEma = values[i] * k + prevEma * (1 - k);
    ema[i] = prevEma;
  }
  return ema;
}

// RSI (14 períodos de Wilder)
function calcRSI(closes, period = 14) {
  if (!closes || closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Bandas de Bollinger (20 períodos, desviación 2)
function calcBollingerBands(closes, period = 20, mult = 2) {
  if (!closes || closes.length < period) {
    const last = closes?.[closes.length - 1] || 0;
    return { upper: last, middle: last, lower: last, percentB: 50 };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = mean + mult * stdDev;
  const lower = mean - mult * stdDev;
  const last = closes[closes.length - 1];
  const range = upper - lower;
  const percentB = range > 0 ? ((last - lower) / range) * 100 : 50;
  return { upper, middle: mean, lower, percentB };
}

// Detección de Zonas de Soporte y Resistencia Clave
function calcSupportResistance(candles) {
  if (!candles || candles.length < 10) {
    const p = candles?.[candles.length - 1]?.close || 0;
    return { support1: p, support2: p, resistance1: p, resistance2: p, distToSup: '0%', distToRes: '0%' };
  }
  const lookback = candles.slice(-50);
  const lastPrice = lookback[lookback.length - 1].close;
  const highs = lookback.map(c => c.high);
  const lows = lookback.map(c => c.low);

  const swingHighs = [];
  const swingLows = [];
  for (let i = 2; i < lookback.length - 2; i++) {
    const c = lookback[i];
    if (c.high >= lookback[i - 1].high && c.high >= lookback[i - 2].high &&
        c.high >= lookback[i + 1].high && c.high >= lookback[i + 2].high) {
      swingHighs.push(c.high);
    }
    if (c.low <= lookback[i - 1].low && c.low <= lookback[i - 2].low &&
        c.low <= lookback[i + 1].low && c.low <= lookback[i + 2].low) {
      swingLows.push(c.low);
    }
  }

  const above = swingHighs.filter(h => h > lastPrice).sort((a, b) => a - b);
  const below = swingLows.filter(l => l < lastPrice).sort((a, b) => b - a);

  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);

  const resistance1 = above[0] ?? maxHigh;
  const resistance2 = above[1] ?? (maxHigh + (maxHigh - minLow) * 0.15);
  const support1 = below[0] ?? minLow;
  const support2 = below[1] ?? (minLow - (maxHigh - minLow) * 0.15);

  const distToRes = lastPrice > 0 ? (((resistance1 - lastPrice) / lastPrice) * 100).toFixed(2) + '%' : '0%';
  const distToSup = lastPrice > 0 ? (((lastPrice - support1) / lastPrice) * 100).toFixed(2) + '%' : '0%';

  return { support1, support2, resistance1, resistance2, distToSup, distToRes, periodHigh: maxHigh, periodLow: minLow };
}

// Acción del Precio (Lectura de Velas Japonesas y Mechas para IQ Option)
function detectPriceAction(candles) {
  if (!candles || candles.length < 2) {
    return { name: 'Vela Normal', bias: 'NEUTRAL', actionText: 'Vela en desarrollo dentro del rango.' };
  }
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const body = Math.abs(curr.close - curr.open);
  const prevBody = Math.abs(prev.close - prev.open);
  const range = Math.max(curr.high - curr.low, 0.000001);
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const isBull = curr.close >= curr.open;
  const isPrevBull = prev.close >= prev.open;

  // 1. Envolvente Alcista
  if (!isPrevBull && isBull && body > prevBody * 1.05 && curr.close >= prev.open && curr.open <= prev.close) {
    return {
      name: 'Envolvente Alcista (Bullish Engulfing)',
      bias: 'ALCISTA (CALL)',
      actionText: 'Fuerte entrada de compradores que absorben y envuelven la presión de venta previa.'
    };
  }
  // 2. Envolvente Bajista
  if (isPrevBull && !isBull && body > prevBody * 1.05 && curr.close <= prev.open && curr.open >= prev.close) {
    return {
      name: 'Envolvente Bajista (Bearish Engulfing)',
      bias: 'BAJISTA (PUT)',
      actionText: 'Fuerte presión de venta que envuelve por completo a los compradores de la vela anterior.'
    };
  }
  // 3. Martillo / Pinbar de Rechazo Inferior
  if (lowerWick > body * 2 && upperWick < body * 0.8) {
    return {
      name: 'Martillo / Rechazo Inferior (Pinbar)',
      bias: 'ALCISTA (CALL)',
      actionText: 'Mecha inferior larga: los vendedores empujaron hacia abajo pero los compradores recuperaron con fuerza.'
    };
  }
  // 4. Estrella Fugaz / Rechazo Superior
  if (upperWick > body * 2 && lowerWick < body * 0.8) {
    return {
      name: 'Estrella Fugaz / Rechazo Superior (Pinbar)',
      bias: 'BAJISTA (PUT)',
      actionText: 'Mecha superior larga: intento alcista rechazado por una zona de oferta / vendedores.'
    };
  }
  // 5. Doji
  if (body <= range * 0.12) {
    return {
      name: 'Vela Doji (Indecisión / Agotamiento)',
      bias: 'NEUTRAL',
      actionText: 'Empate entre oferta y demanda: posible pausa o giro de la tendencia inmediata.'
    };
  }
  // 6. Vela de Gran Impulso
  if (body >= range * 0.75) {
    return {
      name: isBull ? 'Vela de Fuerte Impulso Alcista' : 'Vela de Fuerte Impulso Bajista',
      bias: isBull ? 'ALCISTA (CALL)' : 'BAJISTA (PUT)',
      actionText: isBull ? 'Cuerpo verde dominante con mechas mínimas: fuerza compradora.' : 'Cuerpo rojo dominante con mechas mínimas: fuerza vendedora.'
    };
  }

  return {
    name: isBull ? 'Vela Verde Sostenida' : 'Vela Roja Sostenida',
    bias: isBull ? 'ALCISTA' : 'BAJISTA',
    actionText: 'Estructura continua en dirección de la vela actual.'
  };
}

// Descarga en vivo de velas (alineadas al horario real de IQ Option)
async function fetchCandles(primarySymbol, fallbackSymbol, interval) {
  const validIntervals = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '60m' };
  const yfInterval = validIntervals[interval] || '5m';
  const yfRange = yfInterval === '1m' ? '2d' : (yfInterval === '60m' ? '1mo' : '5d');

  const symbolsToTry = [primarySymbol];
  if (fallbackSymbol && fallbackSymbol !== primarySymbol) symbolsToTry.push(fallbackSymbol);

  let lastError = null;
  for (const sym of symbolsToTry) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${yfInterval}&range=${yfRange}&includePrePost=true`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result || !Array.isArray(result.timestamp)) continue;

      const timestamps = result.timestamp;
      const quote = result.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const volumes = quote.volume || [];

      const candles = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] !== null && closes[i] !== undefined &&
            opens[i] !== null && highs[i] !== null && lows[i] !== null) {
          candles.push({
            time: timestamps[i] * 1000,
            open: Number(opens[i]),
            high: Number(highs[i]),
            low: Number(lows[i]),
            close: Number(closes[i]),
            volume: Number(volumes[i] || 0)
          });
        }
      }

      if (candles.length >= 10) {
        return {
          usedSymbol: sym,
          candles: candles.slice(-180)
        };
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(lastError?.message || 'No se pudieron descargar velas en vivo.');
}

// Descarga de noticias financieras para el análisis fundamental
async function fetchNews(newsQuery) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(newsQuery)}&newsCount=4`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.news)) return [];
    return data.news.slice(0, 4).map(n => ({
      title: n.title || '',
      publisher: n.publisher || 'Mercado',
      link: n.link || '',
      publishedAt: n.providerPublishTime ? n.providerPublishTime * 1000 : Date.now()
    }));
  } catch (e) {
    return [];
  }
}

// Semáforo Operativo (Basado estrictamente en: Medias Móviles, RSI, Bandas de Bollinger, Soportes/Resistencias y Acción del Precio)
function computeSignal(ind, price, sr, pa, news) {
  let score = 0;
  const factors = [];

  // 1. Medias Móviles (EMA 9, EMA 21 y SMA 50)
  if (ind.ema9 > ind.ema21 && price > ind.ema9) {
    score += 25;
    factors.push({ name: 'Medias Móviles', type: 'bull', text: 'EMA 9 sobre EMA 21 con precio arriba (impulso comprador activo).' });
  } else if (ind.ema9 > ind.ema21) {
    score += 15;
    factors.push({ name: 'Medias Móviles', type: 'bull', text: 'EMA 9 sobre EMA 21 (estructura de tendencia alcista).' });
  } else if (ind.ema9 < ind.ema21 && price < ind.ema9) {
    score -= 25;
    factors.push({ name: 'Medias Móviles', type: 'bear', text: 'EMA 9 por debajo de EMA 21 con precio abajo (impulso vendedor activo).' });
  } else {
    score -= 15;
    factors.push({ name: 'Medias Móviles', type: 'bear', text: 'EMA 9 bajo EMA 21 (estructura de tendencia bajista).' });
  }

  if (ind.sma50 !== null) {
    if (price > ind.sma50) score += 10;
    else score -= 10;
  }

  // 2. RSI (14)
  if (ind.rsi <= 30) {
    score += 25;
    factors.push({ name: 'RSI (14)', type: 'bull', text: `RSI en ${ind.rsi.toFixed(1)} (Sobreventa: zona de rebote alcista CALL).` });
  } else if (ind.rsi >= 70) {
    score -= 25;
    factors.push({ name: 'RSI (14)', type: 'bear', text: `RSI en ${ind.rsi.toFixed(1)} (Sobrecompra: zona de rechazo bajista PUT).` });
  } else if (ind.rsi >= 52) {
    score += 8;
    factors.push({ name: 'RSI (14)', type: 'bull', text: `RSI en ${ind.rsi.toFixed(1)} con fuerza compradora saludable.` });
  } else {
    score -= 8;
    factors.push({ name: 'RSI (14)', type: 'bear', text: `RSI en ${ind.rsi.toFixed(1)} con dominio de presión vendedora.` });
  }

  // 3. Bandas de Bollinger (20, 2)
  if (ind.bollinger.percentB <= 12) {
    score += 20;
    factors.push({ name: 'Bandas Bollinger', type: 'bull', text: 'Precio testeando la Banda Inferior (piso estadístico de volatilidad).' });
  } else if (ind.bollinger.percentB >= 88) {
    score -= 20;
    factors.push({ name: 'Bandas Bollinger', type: 'bear', text: 'Precio testeando la Banda Superior (techo estadístico de volatilidad).' });
  }

  // 4. Zonas de Soporte y Resistencia
  const distResNum = parseFloat(sr.distToRes);
  const distSupNum = parseFloat(sr.distToSup);
  if (distSupNum <= 0.18) {
    score += 20;
    factors.push({ name: 'Soporte y Resistencia', type: 'bull', text: `Precio testeando el Soporte S1 (${sr.support1?.toFixed(2)}): zona clave para compras CALL.` });
  } else if (distResNum <= 0.18) {
    score -= 20;
    factors.push({ name: 'Soporte y Resistencia', type: 'bear', text: `Precio testeando la Resistencia R1 (${sr.resistance1?.toFixed(2)}): zona clave para ventas PUT.` });
  }

  // 5. Acción del Precio (Patrón de Vela)
  if (pa.bias.includes('CALL')) {
    score += 20;
    factors.push({ name: 'Acción del Precio', type: 'bull', text: `${pa.name}: ${pa.actionText}` });
  } else if (pa.bias.includes('PUT')) {
    score -= 20;
    factors.push({ name: 'Acción del Precio', type: 'bear', text: `${pa.name}: ${pa.actionText}` });
  } else {
    factors.push({ name: 'Acción del Precio', type: 'neutral', text: `${pa.name}: ${pa.actionText}` });
  }

  score = Math.max(-100, Math.min(100, Math.round(score)));

  let action = 'ESPERAR (ZONA NEUTRAL ⚪)';
  let color = '#94a3b8';
  let direction = 'NEUTRAL';
  let confidence = Math.min(95, Math.max(50, 50 + Math.round(Math.abs(score) * 0.45)));

  if (score >= 40) {
    action = 'COMPRA FUERTE · SUBE (CALL 🟢)';
    direction = 'CALL';
    color = '#10b981';
  } else if (score >= 18) {
    action = 'COMPRA · SUBE (CALL 🟢)';
    direction = 'CALL';
    color = '#34d399';
  } else if (score <= -40) {
    action = 'VENTA FUERTE · BAJA (PUT 🔴)';
    direction = 'PUT';
    color = '#ef4444';
  } else if (score <= -18) {
    action = 'VENTA · BAJA (PUT 🔴)';
    direction = 'PUT';
    color = '#f87171';
  }

  return { score, action, direction, color, confidence, factors };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const isPost = req.method === 'POST';
    const body = isPost ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})) : {};
    const action = body.action || req.query?.action || 'quote';

    // 1. Catálogo simplificado
    if (action === 'catalog') {
      return res.status(200).json({ assets: IQ_OPTION_ASSETS });
    }

    // 2. CONSEJERO IA TÁCTICO PARA OPERAR EN IQ OPTION
    if (action === 'ai-advice') {
      const assetKey = body.asset || 'US 500';
      const timeframe = body.timeframe || '1h';
      const techSummary = body.techSummary || '';
      const fundSummary = body.fundSummary || '';

      const geminiKey = process.env.GEMINI_API_KEY;
      const systemPrompt = `Sos el Consejero Táctico de Trading en IQ Option de Alejandro.
Tu único trabajo es aconsejarlo sobre CÓMO OPERAR "${assetKey}" en la temporalidad de vela "${timeframe}" que él eligió.
Basate estrictamente en los 5 pilares técnicos clave:
1. Medias Móviles (EMA 9, EMA 21 y SMA 50)
2. RSI (14)
3. Bandas de Bollinger (20, 2)
4. Zonas de Soporte y Resistencia Clave
5. Acción del Precio (patrones de vela y mechas)
Combiná estos datos técnicos con el Contexto y Análisis Fundamental actual.

Respondé en español rioplatense claro, directo, estructurado con emojis y al grano:
- 🎯 **Veredicto IQ Option**: Qué hacer exactamente (CALL 🟢, PUT 🔴, o ESPERAR ⚪) y tiempo de expiración recomendado.
- 📐 **Lectura de los 5 Pilares Técnicos**: Breve resumen de lo que dicen las Medias, RSI, Bollinger, Soportes/Resistencias y las velas.
- 🌍 **Impacto Fundamental**: Si hay noticias o contexto macro de fondo afectando el activo ahora mismo.
- ⚡ **Gatillo de Entrada (Cuándo apretar el botón)**: En qué precio exacto o condición de vela conviene disparar la operación en IQ Option para no quedar atrapado.`;

      const userPrompt = `Activo: ${assetKey} | Vela seleccionada: ${timeframe}
Datos Técnicos en Vivo:
${techSummary}

Contexto Fundamental y Noticias:
${fundSummary}

Dame tu consejo táctico definitivo para operar en IQ Option ahora mismo.`;

      if (geminiKey) {
        try {
          const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
            })
          });
          if (gemRes.ok) {
            const gemJson = await gemRes.json();
            const txt = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (txt) return res.status(200).json({ advice: txt });
          }
        } catch (e) {}
      }

      // Respaldo gratuito si no hay clave
      const aiRes = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const rep = aiData?.choices?.[0]?.message?.content;
        if (rep) return res.status(200).json({ advice: rep });
      }

      return res.status(200).json({
        advice: 'No se pudo contactar al motor de IA en este segundo, pero tu semáforo técnico y los niveles clave están calculados en vivo arriba.'
      });
    }

    // 3. Acción 'quote': datos en tiempo real
    const assetKey = String(body.asset || req.query?.asset || 'US 500').trim();
    const interval = String(body.interval || req.query?.interval || '1h').trim();

    const assetConfig = IQ_OPTION_ASSETS[assetKey] || IQ_OPTION_ASSETS['US 500'];

    const [candleData, liveNews] = await Promise.all([
      fetchCandles(assetConfig.primarySymbol, assetConfig.fallbackSymbol, interval),
      fetchNews(assetConfig.newsQuery)
    ]);

    const candles = candleData.candles;
    const closes = candles.map(c => c.close);
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2] || lastCandle;
    const firstCandleOfDay = candles[Math.max(0, candles.length - 40)] || candles[0];

    const currentPrice = lastCandle.close;
    const changeAbs = currentPrice - firstCandleOfDay.open;
    const changePct = firstCandleOfDay.open ? (changeAbs / firstCandleOfDay.open) * 100 : 0;

    // Cálculo de los 5 pilares técnicos
    const ema9Series = calcEMASeries(closes, 9);
    const ema21Series = calcEMASeries(closes, 21);
    const ema9 = ema9Series[ema9Series.length - 1] ?? currentPrice;
    const ema21 = ema21Series[ema21Series.length - 1] ?? currentPrice;
    const sma50 = calcSMA(closes, 50) ?? calcSMA(closes, Math.min(closes.length, 25));
    const rsi = calcRSI(closes, 14);
    const bollinger = calcBollingerBands(closes, 20, 2);
    const sr = calcSupportResistance(candles);
    const priceAction = detectPriceAction(candles);

    const indicators = { ema9, ema21, sma50, rsi, bollinger };
    const signal = computeSignal(indicators, currentPrice, sr, priceAction, liveNews);

    // Preparar últimas 60 velas para el gráfico
    const chartCandles = candles.slice(-60).map((c, i, arr) => {
      const realIdx = candles.length - arr.length + i;
      return {
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        ema9: ema9Series[realIdx] ?? null,
        ema21: ema21Series[realIdx] ?? null
      };
    });

    const expirationMap = {
      '1m': '1 a 3 minutos (1 a 3 velas)',
      '5m': '5 a 15 minutos (1 a 3 velas)',
      '15m': '15 a 45 minutos (1 a 3 velas)',
      '1h': '1 a 3 horas (cierre de vela)'
    };

    return res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      asset: assetConfig,
      interval,
      expirationSuggested: expirationMap[interval] || '1 a 3 velas',
      price: {
        current: currentPrice,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        prevClose: prevCandle.close,
        changeAbs,
        changePct
      },
      indicators,
      supportResistance: sr,
      priceAction,
      signal,
      fundamental: {
        macroDrivers: assetConfig.macroDrivers,
        news: liveNews
      },
      chartCandles
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
