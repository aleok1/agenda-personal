// API en Tiempo Real para Operaciones Financieras (IQ Option Analyzer)
// Soporta activos con la nomenclatura exacta de IQ Option (ej: US 500, US 100, US 30, EUR/USD, XAU/USD, BTC/USD, etc.)

const IQ_OPTION_ASSETS = {
  // ÍNDICES (Nombres exactos en IQ Option)
  'US 500': {
    iqName: 'US 500',
    subtitle: 'S&P 500 Index (EE.UU.)',
    category: 'Índices',
    yahooSymbol: 'ES=F',
    fallbackSymbol: '^GSPC',
    newsQuery: 'SPY S&P 500 market',
    tvSymbol: 'FOREXCOM:SPXUSD',
    decimals: 2,
    macroDrivers: 'Tasas de la FED, inflación CPI de EE.UU., resultados trimestrales de Big Tech y datos de empleo NFP.'
  },
  'US 100': {
    iqName: 'US 100',
    subtitle: 'Nasdaq 100 Tecnológico (EE.UU.)',
    category: 'Índices',
    yahooSymbol: 'NQ=F',
    fallbackSymbol: '^NDX',
    newsQuery: 'QQQ Nasdaq 100 tech stocks',
    tvSymbol: 'FOREXCOM:NSXUSD',
    decimals: 2,
    macroDrivers: 'Sector tecnológico e IA (Nvidia, Apple, Microsoft), rendimientos de bonos del Tesoro de EE.UU. a 10 años y decisiones de la FED.'
  },
  'US 30': {
    iqName: 'US 30',
    subtitle: 'Dow Jones Industrial Average (EE.UU.)',
    category: 'Índices',
    yahooSymbol: 'YM=F',
    fallbackSymbol: '^DJI',
    newsQuery: 'Dow Jones Industrial Average DIA',
    tvSymbol: 'FOREXCOM:DJI',
    decimals: 2,
    macroDrivers: 'Industria pesada, banca de EE.UU., consumo interno, PBI estadounidense y política monetaria de la Reserva Federal.'
  },
  'US 2000': {
    iqName: 'US 2000',
    subtitle: 'Russell 2000 Small Caps (EE.UU.)',
    category: 'Índices',
    yahooSymbol: 'RTY=F',
    fallbackSymbol: '^RUT',
    newsQuery: 'Russell 2000 IWM small caps',
    tvSymbol: 'TVC:RUT',
    decimals: 2,
    macroDrivers: 'Empresas de pequeña capitalización de EE.UU., crédito bancario regional y expectativas de recortes de tasas de la FED.'
  },
  'GER 30': {
    iqName: 'GER 30',
    subtitle: 'DAX 30 / 40 (Alemania)',
    category: 'Índices',
    yahooSymbol: '^GDAXI',
    fallbackSymbol: 'EWG',
    newsQuery: 'DAX Germany stock market ECB',
    tvSymbol: 'XETR:DAX',
    decimals: 2,
    macroDrivers: 'Banco Central Europeo (BCE), industria automotriz y manufacturera alemana, costos de energía en Europa e inflación de la Eurozona.'
  },
  'UK 100': {
    iqName: 'UK 100',
    subtitle: 'FTSE 100 (Reino Unido)',
    category: 'Índices',
    yahooSymbol: '^FTSE',
    fallbackSymbol: 'EWU',
    newsQuery: 'FTSE 100 UK market Bank of England',
    tvSymbol: 'TVC:UKX',
    decimals: 2,
    macroDrivers: 'Banco de Inglaterra (BoE), precios de materias primas/energía, libra esterlina (GBP) y datos de inflación del Reino Unido.'
  },
  'JP 225': {
    iqName: 'JP 225',
    subtitle: 'Nikkei 225 (Japón)',
    category: 'Índices',
    yahooSymbol: 'NIY=F',
    fallbackSymbol: '^N225',
    newsQuery: 'Nikkei 225 Japan market Yen',
    tvSymbol: 'TVC:NI225',
    decimals: 2,
    macroDrivers: 'Banco de Japón (BoJ), cotización del Yen (USD/JPY) que impulsa exportadoras japonesas y tendencia de Wall Street.'
  },
  'FR 40': {
    iqName: 'FR 40',
    subtitle: 'CAC 40 (Francia)',
    category: 'Índices',
    yahooSymbol: '^FCHI',
    fallbackSymbol: 'EWQ',
    newsQuery: 'CAC 40 France European stocks',
    tvSymbol: 'EURONEXT:PX1',
    decimals: 2,
    macroDrivers: 'Política del BCE, sector de lujo europeo (LVMH), demanda de China y actividad económica de la Eurozona.'
  },
  'SP 35': {
    iqName: 'SP 35',
    subtitle: 'IBEX 35 (España)',
    category: 'Índices',
    yahooSymbol: '^IBEX',
    fallbackSymbol: 'EWP',
    newsQuery: 'IBEX 35 Spain market banks',
    tvSymbol: 'BME:IBC',
    decimals: 2,
    macroDrivers: 'Banca española (Santander, BBVA), turismo europeo y tasas de interés del Banco Central Europeo.'
  },
  'AUS 200': {
    iqName: 'AUS 200',
    subtitle: 'ASX 200 (Australia)',
    category: 'Índices',
    yahooSymbol: '^AXJO',
    fallbackSymbol: 'EWA',
    newsQuery: 'ASX 200 Australia market RBA',
    tvSymbol: 'ASX:XJO',
    decimals: 2,
    macroDrivers: 'Banco de la Reserva de Australia (RBA), exportación de minerales/materias primas y demanda industrial de China.'
  },

  // DIVISAS / FOREX / BINARIAS / DIGITALES
  'EUR/USD': {
    iqName: 'EUR/USD',
    subtitle: 'Euro vs Dólar Estadounidense',
    category: 'Divisas',
    yahooSymbol: 'EURUSD=X',
    fallbackSymbol: 'EURUSD=X',
    newsQuery: 'EURUSD Euro Dollar Forex',
    tvSymbol: 'FX:EURUSD',
    decimals: 5,
    macroDrivers: 'Diferencial de tasas entre la FED (EE.UU.) y el BCE (Europa), inflación IPC, nóminas no agrícolas (NFP) y PMI europeo.'
  },
  'GBP/USD': {
    iqName: 'GBP/USD',
    subtitle: 'Libra Esterlina vs Dólar Estadounidense',
    category: 'Divisas',
    yahooSymbol: 'GBPUSD=X',
    fallbackSymbol: 'GBPUSD=X',
    newsQuery: 'GBPUSD Pound Dollar Forex',
    tvSymbol: 'FX:GBPUSD',
    decimals: 5,
    macroDrivers: 'Decisiones del Banco de Inglaterra (BoE) vs Reserva Federal (FED), IPC británico y PBI del Reino Unido.'
  },
  'USD/JPY': {
    iqName: 'USD/JPY',
    subtitle: 'Dólar Estadounidense vs Yen Japonés',
    category: 'Divisas',
    yahooSymbol: 'JPY=X',
    fallbackSymbol: 'JPY=X',
    newsQuery: 'USDJPY Yen Dollar Forex',
    tvSymbol: 'FX:USDJPY',
    decimals: 3,
    macroDrivers: 'Rendimiento de los bonos del Tesoro de EE.UU. a 10 años, intervenciones del Banco de Japón (BoJ) y tasas de la FED.'
  },
  'EUR/JPY': {
    iqName: 'EUR/JPY',
    subtitle: 'Euro vs Yen Japonés',
    category: 'Divisas',
    yahooSymbol: 'EURJPY=X',
    fallbackSymbol: 'EURJPY=X',
    newsQuery: 'EURJPY Euro Yen Forex',
    tvSymbol: 'FX:EURJPY',
    decimals: 3,
    macroDrivers: 'Apetito global por el riesgo, política monetaria del BCE frente a las tasas bajas del Banco de Japón.'
  },
  'AUD/USD': {
    iqName: 'AUD/USD',
    subtitle: 'Dólar Australiano vs Dólar Estadounidense',
    category: 'Divisas',
    yahooSymbol: 'AUDUSD=X',
    fallbackSymbol: 'AUDUSD=X',
    newsQuery: 'AUDUSD Australian Dollar Forex',
    tvSymbol: 'FX:AUDUSD',
    decimals: 5,
    macroDrivers: 'Precios del oro y hierro, crecimiento económico de China, tasas del RBA y fortaleza general del Dólar (DXY).'
  },
  'EUR/GBP': {
    iqName: 'EUR/GBP',
    subtitle: 'Euro vs Libra Esterlina',
    category: 'Divisas',
    yahooSymbol: 'EURGBP=X',
    fallbackSymbol: 'EURGBP=X',
    newsQuery: 'EURGBP Euro Pound Forex',
    tvSymbol: 'FX:EURGBP',
    decimals: 5,
    macroDrivers: 'Divergencia económica entre la Eurozona y el Reino Unido, anuncios del BCE y del Banco de Inglaterra.'
  },
  'USD/CAD': {
    iqName: 'USD/CAD',
    subtitle: 'Dólar Estadounidense vs Dólar Canadiense',
    category: 'Divisas',
    yahooSymbol: 'CAD=X',
    fallbackSymbol: 'CAD=X',
    newsQuery: 'USDCAD Canadian Dollar Oil Forex',
    tvSymbol: 'FX:USDCAD',
    decimals: 5,
    macroDrivers: 'Precio internacional del petróleo WTI (Canadá es gran exportador), Banco de Canadá (BoC) y datos de empleo de EE.UU. y Canadá.'
  },
  'USD/CHF': {
    iqName: 'USD/CHF',
    subtitle: 'Dólar Estadounidense vs Franco Suizo',
    category: 'Divisas',
    yahooSymbol: 'CHF=X',
    fallbackSymbol: 'CHF=X',
    newsQuery: 'USDCHF Swiss Franc Forex',
    tvSymbol: 'FX:USDCHF',
    decimals: 5,
    macroDrivers: 'Flujos de refugio seguro hacia el Franco Suizo, Banco Nacional Suizo (SNB) e índice Dólar (DXY).'
  },
  'GBP/JPY': {
    iqName: 'GBP/JPY',
    subtitle: 'Libra Esterlina vs Yen Japonés',
    category: 'Divisas',
    yahooSymbol: 'GBPJPY=X',
    fallbackSymbol: 'GBPJPY=X',
    newsQuery: 'GBPJPY Forex',
    tvSymbol: 'FX:GBPJPY',
    decimals: 3,
    macroDrivers: 'Par de alta volatilidad ("El Dragón"): sensible al sentimiento de riesgo global, tasas del BoE y política del BoJ.'
  },
  'NZD/USD': {
    iqName: 'NZD/USD',
    subtitle: 'Dólar Neozelandés vs Dólar Estadounidense',
    category: 'Divisas',
    yahooSymbol: 'NZDUSD=X',
    fallbackSymbol: 'NZDUSD=X',
    newsQuery: 'NZDUSD Forex',
    tvSymbol: 'FX:NZDUSD',
    decimals: 5,
    macroDrivers: 'Banco de la Reserva de Nueva Zelanda (RBNZ), comercio Asia-Pacífico y fortaleza del dólar estadounidense.'
  },
  'USD/BRL': {
    iqName: 'USD/BRL',
    subtitle: 'Dólar Estadounidense vs Real Brasileño',
    category: 'Divisas',
    yahooSymbol: 'BRL=X',
    fallbackSymbol: 'BRL=X',
    newsQuery: 'USDBRL Real Brasil Dollar',
    tvSymbol: 'FX_IDC:USDBRL',
    decimals: 4,
    macroDrivers: 'Tasa Selic del Banco Central de Brasil, política fiscal brasileña, precios de commodities y fortaleza del USD.'
  },

  // MATERIAS PRIMAS (COMMODITIES IQ OPTION)
  'XAU/USD': {
    iqName: 'XAU/USD',
    subtitle: 'Oro / Gold vs Dólar',
    category: 'Materias Primas',
    yahooSymbol: 'GC=F',
    fallbackSymbol: 'GLD',
    newsQuery: 'Gold price XAUUSD inflation FED',
    tvSymbol: 'OANDA:XAUUSD',
    decimals: 2,
    macroDrivers: 'Refugio ante tensiones geopolíticas, inflación de EE.UU., tasas reales de la FED y debilidad o fortaleza del Dólar (DXY).'
  },
  'XAG/USD': {
    iqName: 'XAG/USD',
    subtitle: 'Plata / Silver vs Dólar',
    category: 'Materias Primas',
    yahooSymbol: 'SI=F',
    fallbackSymbol: 'SLV',
    newsQuery: 'Silver price XAGUSD',
    tvSymbol: 'OANDA:XAGUSD',
    decimals: 3,
    macroDrivers: 'Sigue la tendencia del Oro (XAU/USD) combinada con la demanda industrial de electrónica y energías renovables.'
  },
  'USO/USD': {
    iqName: 'USO/USD',
    subtitle: 'Petróleo Crudo WTI (EE.UU.)',
    category: 'Materias Primas',
    yahooSymbol: 'CL=F',
    fallbackSymbol: 'USO',
    newsQuery: 'WTI Crude Oil price OPEC inventory',
    tvSymbol: 'TVC:USOIL',
    decimals: 2,
    macroDrivers: 'Inventarios semanales de crudo de la EIA (miércoles), recortes de producción de la OPEP+, geopolítica en Medio Oriente y demanda global.'
  },
  'UKO/USD': {
    iqName: 'UKO/USD',
    subtitle: 'Petróleo Crudo Brent (Mar del Norte)',
    category: 'Materias Primas',
    yahooSymbol: 'BZ=F',
    fallbackSymbol: 'BNO',
    newsQuery: 'Brent Crude Oil price OPEC',
    tvSymbol: 'TVC:UKOIL',
    decimals: 2,
    macroDrivers: 'Cuotas de la OPEP+, transporte marítimo internacional, demanda europea/asiática y tensiones geopolíticas.'
  },

  // CRIPTOMONEDAS
  'BTC/USD': {
    iqName: 'BTC/USD',
    subtitle: 'Bitcoin vs Dólar',
    category: 'Cripto',
    yahooSymbol: 'BTC-USD',
    fallbackSymbol: 'BTC-USD',
    newsQuery: 'Bitcoin BTC crypto ETF',
    tvSymbol: 'BITSTAMP:BTCUSD',
    decimals: 2,
    macroDrivers: 'Flujos diarios en ETFs de Bitcoin Spot, liquidez global, regulación cripto y apetito de riesgo en Nasdaq (US 100).'
  },
  'ETH/USD': {
    iqName: 'ETH/USD',
    subtitle: 'Ethereum vs Dólar',
    category: 'Cripto',
    yahooSymbol: 'ETH-USD',
    fallbackSymbol: 'ETH-USD',
    newsQuery: 'Ethereum ETH crypto',
    tvSymbol: 'BITSTAMP:ETHUSD',
    decimals: 2,
    macroDrivers: 'Correlación directa con Bitcoin (BTC/USD), actividad en redes DeFi/Layer-2 y flujos institucionales en ETFs de Ethereum.'
  },
  'SOL/USD': {
    iqName: 'SOL/USD',
    subtitle: 'Solana vs Dólar',
    category: 'Cripto',
    yahooSymbol: 'SOL-USD',
    fallbackSymbol: 'SOL-USD',
    newsQuery: 'Solana SOL crypto',
    tvSymbol: 'COINBASE:SOLUSD',
    decimals: 2,
    macroDrivers: 'Volumen en DEX de Solana, adopción de ecosistema cripto y tendencia general marcada por BTC/USD.'
  },
  'XRP/USD': {
    iqName: 'XRP/USD',
    subtitle: 'Ripple vs Dólar',
    category: 'Cripto',
    yahooSymbol: 'XRP-USD',
    fallbackSymbol: 'XRP-USD',
    newsQuery: 'Ripple XRP crypto',
    tvSymbol: 'BITSTAMP:XRPUSD',
    decimals: 4,
    macroDrivers: 'Novedades regulatorias de Ripple/SEC, pagos transfronterizos y sentimiento general del mercado cripto.'
  },

  // ACCIONES (STOCKS IQ OPTION)
  'APPLE': {
    iqName: 'APPLE',
    subtitle: 'Apple Inc. (AAPL)',
    category: 'Acciones',
    yahooSymbol: 'AAPL',
    fallbackSymbol: 'AAPL',
    newsQuery: 'Apple AAPL stock iPhone',
    tvSymbol: 'NASDAQ:AAPL',
    decimals: 2,
    macroDrivers: 'Ventas globales de iPhone, servicios e IA de Apple, cadena de suministro en Asia y dirección general del índice US 100.'
  },
  'TESLA': {
    iqName: 'TESLA',
    subtitle: 'Tesla Inc. (TSLA)',
    category: 'Acciones',
    yahooSymbol: 'TSLA',
    fallbackSymbol: 'TSLA',
    newsQuery: 'Tesla TSLA stock EV',
    tvSymbol: 'NASDAQ:TSLA',
    decimals: 2,
    macroDrivers: 'Entregas trimestrales de vehículos eléctricos, márgenes operativos, avances en conducción autónoma/robotaxi y anuncios de Elon Musk.'
  },
  'NVIDIA': {
    iqName: 'NVIDIA',
    subtitle: 'NVIDIA Corp. (NVDA)',
    category: 'Acciones',
    yahooSymbol: 'NVDA',
    fallbackSymbol: 'NVDA',
    newsQuery: 'Nvidia NVDA AI chips stock',
    tvSymbol: 'NASDAQ:NVDA',
    decimals: 2,
    macroDrivers: 'Demanda global de chips para Inteligencia Artificial, gasto en centros de datos de grandes tecnológicas y guía de ingresos trimestral.'
  },
  'AMAZON': {
    iqName: 'AMAZON',
    subtitle: 'Amazon.com Inc. (AMZN)',
    category: 'Acciones',
    yahooSymbol: 'AMZN',
    fallbackSymbol: 'AMZN',
    newsQuery: 'Amazon AMZN AWS stock',
    tvSymbol: 'NASDAQ:AMZN',
    decimals: 2,
    macroDrivers: 'Crecimiento de la nube AWS, consumo minorista en EE.UU. y márgenes logísticos.'
  },
  'MICROSOFT': {
    iqName: 'MICROSOFT',
    subtitle: 'Microsoft Corp. (MSFT)',
    category: 'Acciones',
    yahooSymbol: 'MSFT',
    fallbackSymbol: 'MSFT',
    newsQuery: 'Microsoft MSFT Azure AI stock',
    tvSymbol: 'NASDAQ:MSFT',
    decimals: 2,
    macroDrivers: 'Crecimiento de Azure Cloud, monetización de Copilot/OpenAI y gasto tecnológico empresarial.'
  },
  'META': {
    iqName: 'META',
    subtitle: 'Meta Platforms (META)',
    category: 'Acciones',
    yahooSymbol: 'META',
    fallbackSymbol: 'META',
    newsQuery: 'Meta Platforms Facebook stock',
    tvSymbol: 'NASDAQ:META',
    decimals: 2,
    macroDrivers: 'Ingresos por publicidad digital en Instagram/Facebook/WhatsApp e inversiones en modelos de IA.'
  },
  'GOOGLE': {
    iqName: 'GOOGLE',
    subtitle: 'Alphabet Inc. (GOOGL)',
    category: 'Acciones',
    yahooSymbol: 'GOOGL',
    fallbackSymbol: 'GOOGL',
    newsQuery: 'Alphabet Google GOOGL stock',
    tvSymbol: 'NASDAQ:GOOGL',
    decimals: 2,
    macroDrivers: 'Publicidad en buscador y YouTube, crecimiento de Google Cloud y desarrollo de Gemini IA.'
  }
};

// Cálculo de Media Móvil Simple (SMA)
function calcSMA(values, period) {
  if (!values || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return sum / period;
}

// Cálculo de Serie de Media Móvil Exponencial (EMA)
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

// Cálculo de RSI (Wilder 14 períodos, idéntico al de IQ Option)
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

// Cálculo de MACD (12, 26, 9)
function calcMACD(closes) {
  if (!closes || closes.length < 35) {
    return { macd: 0, signal: 0, histogram: 0, prevHistogram: 0 };
  }
  const ema12 = calcEMASeries(closes, 12);
  const ema26 = calcEMASeries(closes, 26);
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine.push(ema12[i] - ema26[i]);
    }
  }
  const signalSeries = calcEMASeries(macdLine, 9);
  const lastMacd = macdLine[macdLine.length - 1] || 0;
  const prevMacd = macdLine[macdLine.length - 2] || 0;
  const lastSignal = signalSeries[signalSeries.length - 1] || 0;
  const prevSignal = signalSeries[signalSeries.length - 2] || 0;
  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
    prevHistogram: prevMacd - prevSignal
  };
}

// Cálculo de Bandas de Bollinger (20 períodos, desviación 2)
function calcBollingerBands(closes, period = 20, mult = 2) {
  if (!closes || closes.length < period) {
    const last = closes?.[closes.length - 1] || 0;
    return { upper: last, middle: last, lower: last, percentB: 50, bandwidth: 0 };
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
  const bandwidth = mean > 0 ? (range / mean) * 100 : 0;
  return { upper, middle: mean, lower, percentB, bandwidth };
}

// Cálculo de Oscilador Estocástico (14, 3)
function calcStochastic(candles, period = 14, smoothK = 3) {
  if (!candles || candles.length < period + smoothK) {
    return { k: 50, d: 50 };
  }
  const rawK = [];
  for (let i = period - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const denom = highest - lowest;
    const kVal = denom > 0 ? ((candles[i].close - lowest) / denom) * 100 : 50;
    rawK.push(kVal);
  }
  const kSeries = [];
  for (let i = smoothK - 1; i < rawK.length; i++) {
    let s = 0;
    for (let j = i - smoothK + 1; j <= i; j++) s += rawK[j];
    kSeries.push(s / smoothK);
  }
  const k = kSeries[kSeries.length - 1] ?? 50;
  const dSlice = kSeries.slice(-3);
  const d = dSlice.length > 0 ? dSlice.reduce((a, b) => a + b, 0) / dSlice.length : k;
  return { k, d };
}

// Cálculo de ATR (Average True Range 14) para medir volatilidad real de las velas
function calcATR(candles, period = 14) {
  if (!candles || candles.length <= period) return 0;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

// Detección de Soportes y Resistencias relevantes en las últimas velas
function calcSupportResistance(candles) {
  if (!candles || candles.length < 15) {
    const p = candles?.[candles.length - 1]?.close || 0;
    return { support1: p, support2: p, resistance1: p, resistance2: p };
  }
  const lookback = candles.slice(-60);
  const lastPrice = lookback[lookback.length - 1].close;
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

  const allHighs = lookback.map(c => c.high);
  const allLows = lookback.map(c => c.low);
  const maxHigh = Math.max(...allHighs);
  const minLow = Math.min(...allLows);

  const above = swingHighs.filter(h => h > lastPrice).sort((a, b) => a - b);
  const below = swingLows.filter(l => l < lastPrice).sort((a, b) => b - a);

  const resistance1 = above[0] ?? maxHigh;
  const resistance2 = above[1] ?? (maxHigh + (maxHigh - minLow) * 0.25);
  const support1 = below[0] ?? minLow;
  const support2 = below[1] ?? (minLow - (maxHigh - minLow) * 0.25);

  return { support1, support2, resistance1, resistance2, periodHigh: maxHigh, periodLow: minLow };
}

// Reconocimiento de Patrones de Velas Japonesas (Acción del Precio para IQ Option)
function detectCandlePattern(candles) {
  if (!candles || candles.length < 3) {
    return { name: 'Formación estándar', bias: 'NEUTRAL', desc: 'Sin patrón extremo en la última vela.' };
  }
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const body = Math.abs(curr.close - curr.open);
  const prevBody = Math.abs(prev.close - prev.open);
  const range = Math.max(curr.high - curr.low, 0.000001);
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const isBull = curr.close >= curr.open;
  const isPrevBull = prev.close >= prev.open;

  // 1. Envolvente Alcista (Bullish Engulfing)
  if (!isPrevBull && isBull && body > prevBody * 1.05 && curr.close >= prev.open && curr.open <= prev.close) {
    return {
      name: 'Envolvente Alcista (Bullish Engulfing)',
      bias: 'ALCISTA (CALL)',
      desc: 'La vela actual envuelve por completo la vela roja previa, mostrando fuerte entrada de compradores.'
    };
  }
  // 2. Envolvente Bajista (Bearish Engulfing)
  if (isPrevBull && !isBull && body > prevBody * 1.05 && curr.close <= prev.open && curr.open >= prev.close) {
    return {
      name: 'Envolvente Bajista (Bearish Engulfing)',
      bias: 'BAJISTA (PUT)',
      desc: 'La vela roja actual envuelve por completo la vela verde previa, indicando fuerte presión vendedora.'
    };
  }
  // 3. Martillo / Pinbar Alcista (Rechazo de precios bajos)
  if (lowerWick > body * 2.1 && upperWick < body * 0.9) {
    return {
      name: 'Martillo / Pinbar de Rechazo Inferior',
      bias: 'ALCISTA (CALL)',
      desc: 'Mecha inferior larga que muestra rechazo de zona baja y agotamiento vendedor.'
    };
  }
  // 4. Estrella Fugaz / Pinbar Bajista (Rechazo de precios altos)
  if (upperWick > body * 2.1 && lowerWick < body * 0.9) {
    return {
      name: 'Estrella Fugaz / Rechazo Superior',
      bias: 'BAJISTA (PUT)',
      desc: 'Mecha superior larga que indica rechazo en zona alta y entrada de vendedores.'
    };
  }
  // 5. Doji (Indecisión / posible giro)
  if (body <= range * 0.12) {
    return {
      name: 'Vela Doji (Equilibrio / Posible Giro)',
      bias: 'NEUTRAL',
      desc: 'Apertura y cierre casi iguales. Señala indecisión o agotamiento de la tendencia inmediata.'
    };
  }
  // 6. Tres soldados / Tres cuervos (Continuación de impulso)
  const isPrev2Bull = prev2.close >= prev2.open;
  if (isBull && isPrevBull && isPrev2Bull && curr.close > prev.close && prev.close > prev2.close) {
    return {
      name: 'Secuencia de 3 Velas Alcistas Consecutivas',
      bias: 'ALCISTA (CALL)',
      desc: 'Tres cierres alcistas seguidos confirmando impulso comprador sostenido.'
    };
  }
  if (!isBull && !isPrevBull && !isPrev2Bull && curr.close < prev.close && prev.close < prev2.close) {
    return {
      name: 'Secuencia de 3 Velas Bajistas Consecutivas',
      bias: 'BAJISTA (PUT)',
      desc: 'Tres cierres bajistas seguidos confirmando dominio vendedor en el corto plazo.'
    };
  }
  // 7. Vela de Gran Impulso (Marubozu)
  if (body >= range * 0.78) {
    return {
      name: isBull ? 'Vela de Impulso Alcista Fuerte' : 'Vela de Impulso Bajista Fuerte',
      bias: isBull ? 'ALCISTA (CALL)' : 'BAJISTA (PUT)',
      desc: isBull ? 'Cuerpo verde amplio con poca mecha, compradores al mando.' : 'Cuerpo rojo amplio con poca mecha, vendedores al mando.'
    };
  }

  return {
    name: isBull ? 'Vela Verde Estándar' : 'Vela Roja Estándar',
    bias: isBull ? 'ALCISTA LEVE' : 'BAJISTA LEVE',
    desc: 'Movimiento normal dentro del rango actual de volatilidad.'
  };
}

// Evaluación de Sesiones de Mercado Internacionales en vivo (según hora UTC)
function getActiveMarketSessions() {
  const now = new Date();
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const day = now.getUTCDay(); // 0 Dom, 6 Sáb
  const isWeekend = (day === 6) || (day === 0 && utcHour < 21) || (day === 5 && utcHour >= 22);

  const sessions = [
    { name: 'Nueva York (Wall Street)', open: utcHour >= 13 && utcHour < 22 && !isWeekend, hoursArg: '10:00 a 19:00 hs ARG' },
    { name: 'Londres (Europa)', open: utcHour >= 7 && utcHour < 16 && !isWeekend, hoursArg: '04:00 a 13:00 hs ARG' },
    { name: 'Tokio (Asia)', open: (utcHour >= 0 && utcHour < 9) && !isWeekend, hoursArg: '21:00 a 06:00 hs ARG' },
    { name: 'Sídney (Pacífico)', open: (utcHour >= 21 || utcHour < 6) && !isWeekend, hoursArg: '18:00 a 03:00 hs ARG' }
  ];

  const activeNames = sessions.filter(s => s.open).map(s => s.name);
  let liquidityNote = '';
  if (isWeekend) {
    liquidityNote = 'Fin de semana para mercados tradicionales: en IQ Option están activos los pares (OTC) y Criptomonedas 24/7.';
  } else if (utcHour >= 13 && utcHour < 16) {
    liquidityNote = '🔥 Superposición Londres + Nueva York activa: Es la franja de MAYOR volumen y mejores movimientos tendenciales para US 500, US 100, EUR/USD y Oro.';
  } else if (utcHour >= 13 && utcHour < 21) {
    liquidityNote = 'Sesión de Nueva York activa: Excelente volumen en índices estadounidenses (US 500, US 100, US 30), Acciones y Dólar.';
  } else if (utcHour >= 7 && utcHour < 13) {
    liquidityNote = 'Sesión Europea activa: Fuerte movimiento en EUR/USD, GBP/USD, GER 30 y UK 100.';
  } else {
    liquidityNote = 'Sesión Asiática / Nocturna: Menor volatilidad en índices de EE.UU., ideal para USD/JPY, AUD/USD o estrategias de rebote en soportes/resistencias.';
  }

  return { isWeekend, sessions, activeNames, liquidityNote };
}

// Descarga de velas OHLCV en tiempo real desde Yahoo Finance v8
async function fetchLiveCandles(yahooSymbol, fallbackSymbol, interval) {
  const validIntervals = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '60m' };
  const yfInterval = validIntervals[interval] || '5m';
  const yfRange = yfInterval === '1m' ? '2d' : (yfInterval === '60m' ? '1mo' : '5d');

  const symbolsToTry = [yahooSymbol];
  if (fallbackSymbol && fallbackSymbol !== yahooSymbol) symbolsToTry.push(fallbackSymbol);

  let lastError = null;
  for (const sym of symbolsToTry) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${yfInterval}&range=${yfRange}&includePrePost=true`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
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

      if (candles.length >= 15) {
        return {
          usedSymbol: sym,
          meta: result.meta || {},
          candles: candles.slice(-220)
        };
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(lastError?.message || 'No se pudieron obtener velas en vivo para este activo.');
}

// Descarga de noticias financieras en tiempo real para el Análisis Fundamental
async function fetchLiveNews(newsQuery) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(newsQuery)}&newsCount=6`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.news)) return [];
    return data.news.slice(0, 6).map(n => ({
      title: n.title || '',
      publisher: n.publisher || 'Mercado Internacional',
      link: n.link || '',
      publishedAt: n.providerPublishTime ? n.providerPublishTime * 1000 : Date.now()
    }));
  } catch (e) {
    return [];
  }
}

// Motor de puntuación de Confluencia Técnica + Fundamental (Señal IQ Option)
function buildSignalDecision(ind, price, sr, pattern, newsList) {
  let score = 0; // De -100 (Venta Fuerte / PUT) a +100 (Compra Fuerte / CALL)
  const reasons = [];

  // 1. Cruce y posición de EMA 9 vs EMA 21 (Tendencia inmediata en IQ Option)
  if (ind.ema9 !== null && ind.ema21 !== null) {
    if (ind.ema9 > ind.ema21 && price > ind.ema9) {
      score += 22;
      reasons.push({ type: 'bull', text: 'EMA 9 por encima de EMA 21 con el precio sobre ambas (impulso alcista activo).' });
    } else if (ind.ema9 > ind.ema21) {
      score += 12;
      reasons.push({ type: 'bull', text: 'EMA 9 sobre EMA 21 (estructura alcista de corto plazo).' });
    } else if (ind.ema9 < ind.ema21 && price < ind.ema9) {
      score -= 22;
      reasons.push({ type: 'bear', text: 'EMA 9 por debajo de EMA 21 con el precio bajo ambas (impulso bajista activo).' });
    } else {
      score -= 12;
      reasons.push({ type: 'bear', text: 'EMA 9 debajo de EMA 21 (estructura bajista de corto plazo).' });
    }
  }

  // 2. Tendencia de Fondo (SMA 50 y SMA 200)
  if (ind.sma50 !== null) {
    if (price > ind.sma50) {
      score += 12;
      reasons.push({ type: 'bull', text: 'Precio operando por encima de la Media Móvil de 50 períodos (SMA 50).' });
    } else {
      score -= 12;
      reasons.push({ type: 'bear', text: 'Precio operando por debajo de la Media Móvil de 50 períodos (SMA 50).' });
    }
  }
  if (ind.sma200 !== null) {
    if (price > ind.sma200) score += 8;
    else score -= 8;
  }

  // 3. RSI (14) - Rebotes de sobrecompra/sobreventa y fuerza
  if (ind.rsi <= 28) {
    score += 24;
    reasons.push({ type: 'bull', text: `RSI (14) en ${ind.rsi.toFixed(1)} (Sobreventa extrema: alta probabilidad de rebote alcista CALL).` });
  } else if (ind.rsi >= 72) {
    score -= 24;
    reasons.push({ type: 'bear', text: `RSI (14) en ${ind.rsi.toFixed(1)} (Sobrecompra extrema: alta probabilidad de corrección bajista PUT).` });
  } else if (ind.rsi >= 54 && ind.rsi < 68) {
    score += 10;
    reasons.push({ type: 'bull', text: `RSI (14) en ${ind.rsi.toFixed(1)} mostrando fuerza compradora saludable sin agotamiento.` });
  } else if (ind.rsi <= 46 && ind.rsi > 32) {
    score -= 10;
    reasons.push({ type: 'bear', text: `RSI (14) en ${ind.rsi.toFixed(1)} mostrando presión vendedora dominante.` });
  } else {
    reasons.push({ type: 'neutral', text: `RSI (14) en zona de equilibrio (${ind.rsi.toFixed(1)}).` });
  }

  // 4. MACD (12, 26, 9)
  if (ind.macd.histogram > 0) {
    const growing = ind.macd.histogram >= ind.macd.prevHistogram;
    score += growing ? 16 : 8;
    reasons.push({
      type: 'bull',
      text: growing ? 'Histograma MACD positivo y creciendo (aceleración alcista).' : 'MACD en terreno positivo.'
    });
  } else if (ind.macd.histogram < 0) {
    const falling = ind.macd.histogram <= ind.macd.prevHistogram;
    score -= falling ? 16 : 8;
    reasons.push({
      type: 'bear',
      text: falling ? 'Histograma MACD negativo y expandiéndose (aceleración bajista).' : 'MACD en terreno negativo.'
    });
  }

  // 5. Bandas de Bollinger (20, 2)
  if (ind.bollinger.percentB <= 8) {
    score += 15;
    reasons.push({ type: 'bull', text: 'Precio tocando/perforando la Banda Inferior de Bollinger (zona estadística de rebote alcista).' });
  } else if (ind.bollinger.percentB >= 92) {
    score -= 15;
    reasons.push({ type: 'bear', text: 'Precio tocando/perforando la Banda Superior de Bollinger (zona estadística de rechazo bajista).' });
  }

  // 6. Oscilador Estocástico (14, 3, 3)
  if (ind.stoch.k < 20 && ind.stoch.k >= ind.stoch.d) {
    score += 10;
    reasons.push({ type: 'bull', text: `Estocástico saliendo de sobreventa (${ind.stoch.k.toFixed(1)}) con cruce alcista.` });
  } else if (ind.stoch.k > 80 && ind.stoch.k <= ind.stoch.d) {
    score -= 10;
    reasons.push({ type: 'bear', text: `Estocástico en sobrecompra (${ind.stoch.k.toFixed(1)}) girando a la baja.` });
  }

  // 7. Acción del Precio (Patrón de Vela)
  if (pattern.bias.includes('ALCISTA')) {
    score += pattern.bias.includes('CALL') ? 12 : 5;
    reasons.push({ type: 'bull', text: `Patrón de vela: ${pattern.name}.` });
  } else if (pattern.bias.includes('BAJISTA')) {
    score -= pattern.bias.includes('PUT') ? 12 : 5;
    reasons.push({ type: 'bear', text: `Patrón de vela: ${pattern.name}.` });
  }

  // Limitar score entre -100 y +100
  score = Math.max(-100, Math.min(100, Math.round(score)));

  // Análisis rápido de sentimiento de titulares de noticias
  let newsSentiment = 'NEUTRAL';
  let newsBiasScore = 0;
  const bullWords = ['higher', 'surge', 'jump', 'gain', 'rally', 'record', 'beat', 'bull', 'buy', 'up', 'recover', 'growth', 'adds'];
  const bearWords = ['drop', 'fall', 'plunge', 'selloff', 'down', 'miss', 'bear', 'crash', 'fear', 'inflation', 'cut', 'loss', 'decline'];

  (newsList || []).forEach(n => {
    const t = String(n.title || '').toLowerCase();
    bullWords.forEach(w => { if (t.includes(w)) newsBiasScore += 1; });
    bearWords.forEach(w => { if (t.includes(w)) newsBiasScore -= 1; });
  });

  if (newsBiasScore >= 2) newsSentiment = 'ALCISTA (Positivo)';
  else if (newsBiasScore <= -2) newsSentiment = 'BAJISTA (Cautela)';

  let action = 'ESPERAR / NEUTRAL';
  let direction = 'NEUTRAL';
  let color = '#94a3b8';
  let confidence = Math.min(95, Math.max(50, 50 + Math.round(Math.abs(score) * 0.45)));

  if (score >= 42) {
    action = 'COMPRA FUERTE · SUBE (CALL 🟢)';
    direction = 'CALL';
    color = '#10b981';
  } else if (score >= 18) {
    action = 'COMPRA · SUBE (CALL 🟢)';
    direction = 'CALL';
    color = '#34d399';
  } else if (score <= -42) {
    action = 'VENTA FUERTE · BAJA (PUT 🔴)';
    direction = 'PUT';
    color = '#ef4444';
  } else if (score <= -18) {
    action = 'VENTA · BAJA (PUT 🔴)';
    direction = 'PUT';
    color = '#f87171';
  }

  return {
    score,
    action,
    direction,
    color,
    confidence,
    newsSentiment,
    reasons
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const isPost = req.method === 'POST';
    const body = isPost ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})) : {};
    const action = body.action || req.query?.action || 'quote';

    // 1. devolver catálogo si se solicita
    if (action === 'catalog') {
      return res.status(200).json({ assets: IQ_OPTION_ASSETS });
    }

    // 2. Análisis IA profundo (de datos en vivo o de una captura de gráfico de IQ Option)
    if (action === 'ai-analysis') {
      const assetKey = body.asset || 'US 500';
      const timeframe = body.timeframe || '5m';
      const imageBase64 = body.imageBase64 || null;
      const technicalSummary = body.technicalSummary || '';
      const fundamentalSummary = body.fundamentalSummary || '';

      const geminiKey = process.env.GEMINI_API_KEY;

      const systemPrompt = `Sos un analista cuantitativo y trader profesional especialista en la plataforma IQ Option (Opciones Binarias, Digitales, Forex, Índices como US 500 / US 100 / US 30, Cripto y Materias Primas).
Respondé siempre en español claro, directo y estructurado para Alejandro.
Tu objetivo es analizar el gráfico / indicadores de "${assetKey}" en temporalidad "${timeframe}" y entregar:
1. 🎯 **Veredicto Operativo IQ Option**: Señal clara (SUBE / CALL 🟢, BAJA / PUT 🔴, o ESPERAR ⚪) y tiempo de expiración recomendado de la vela.
2. 📊 **Lectura Técnica del Gráfico**: Qué están haciendo las velas, EMAs (9 y 21), RSI (14), MACD, Bandas de Bollinger y los niveles exactos de Soporte y Resistencia.
3. 🌍 **Lectura Fundamental y Horario**: Cómo influye el contexto de mercado actual y las noticias del activo.
4. 🛡️ **Punto Exacto de Entrada (Gatillo)**: En qué precio o condición de vela conviene ejecutar la operación para maximizar efectividad.`;

      // Si el usuario subió una captura de pantalla de IQ Option (ej. gráfico OTC o con sus indicadores)
      if (imageBase64 && geminiKey) {
        const cleanB64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

        const gemVisionRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: cleanB64 } },
                { text: `Analizá esta captura de pantalla de mi gráfico de IQ Option (${assetKey} · ${timeframe}). Leé las velas, mechas, tendencia, soportes/resistencias e indicadores visibles en la imagen, combinándolo con estos datos en vivo si aplican:\n${technicalSummary}\n${fundamentalSummary}` }
              ]
            }]
          })
        });

        if (gemVisionRes.ok) {
          const gemJson = await gemVisionRes.json();
          const txt = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) return res.status(200).json({ analysis: txt });
        }
      }

      const userPrompt = `Activo IQ Option: ${assetKey} (Temporalidad de vela: ${timeframe})
Datos Técnicos en Tiempo Real:
${technicalSummary}

Datos Fundamentales y Noticias en Vivo:
${fundamentalSummary}

Brindame el análisis táctico completo para operar este activo en IQ Option ahora mismo.`;

      if (geminiKey) {
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
          if (txt) return res.status(200).json({ analysis: txt });
        }
      }

      // Respaldo IA libre (Pollinations OpenAI)
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
        const reply = aiData?.choices?.[0]?.message?.content;
        if (reply) return res.status(200).json({ analysis: reply });
      }

      return res.status(200).json({
        analysis: 'No se pudo contactar al motor de IA en este instante, pero tenés todos los indicadores técnicos y el semáforo calculados en vivo arriba.'
      });
    }

    // 3. Acción por defecto: 'quote' -> Obtener velas en vivo + calcular todos los indicadores de IQ Option + noticias fundamentales
    const assetKey = String(body.asset || req.query?.asset || 'US 500').trim();
    const interval = String(body.interval || req.query?.interval || '5m').trim();

    const assetConfig = IQ_OPTION_ASSETS[assetKey] || {
      iqName: assetKey,
      subtitle: `Activo personalizado (${assetKey})`,
      category: 'Personalizado',
      yahooSymbol: assetKey,
      fallbackSymbol: assetKey,
      newsQuery: assetKey,
      tvSymbol: assetKey,
      decimals: 2,
      macroDrivers: 'Oferta y demanda institucional, volumen de sesión y noticias del sector.'
    };

    const [candleData, liveNews] = await Promise.all([
      fetchLiveCandles(assetConfig.yahooSymbol, assetConfig.fallbackSymbol, interval),
      fetchLiveNews(assetConfig.newsQuery)
    ]);

    const candles = candleData.candles;
    const closes = candles.map(c => c.close);
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2] || lastCandle;
    const firstCandleOfDay = candles[Math.max(0, candles.length - 75)] || candles[0];

    const currentPrice = lastCandle.close;
    const changeAbs = currentPrice - firstCandleOfDay.open;
    const changePct = firstCandleOfDay.open ? (changeAbs / firstCandleOfDay.open) * 100 : 0;

    // Calcular todos los indicadores técnicos usados en IQ Option
    const ema9Series = calcEMASeries(closes, 9);
    const ema21Series = calcEMASeries(closes, 21);
    const ema9 = ema9Series[ema9Series.length - 1] ?? currentPrice;
    const ema21 = ema21Series[ema21Series.length - 1] ?? currentPrice;
    const sma50 = calcSMA(closes, 50) ?? calcSMA(closes, Math.min(closes.length, 25));
    const sma200 = calcSMA(closes, 200) ?? calcSMA(closes, Math.min(closes.length, 100));
    const rsi = calcRSI(closes, 14);
    const macd = calcMACD(closes);
    const bollinger = calcBollingerBands(closes, 20, 2);
    const stoch = calcStochastic(candles, 14, 3);
    const atr = calcATR(candles, 14);
    const sr = calcSupportResistance(candles);
    const pattern = detectCandlePattern(candles);
    const sessions = getActiveMarketSessions();

    const indicators = {
      rsi,
      ema9,
      ema21,
      sma50,
      sma200,
      macd,
      bollinger,
      stoch,
      atr
    };

    const signal = buildSignalDecision(indicators, currentPrice, sr, pattern, liveNews);

    // Adjuntar EMA9 y EMA21 a las últimas 80 velas para que el gráfico de la app las dibuje igual que en IQ Option
    const chartCandlesCount = Math.min(80, candles.length);
    const startIdx = candles.length - chartCandlesCount;
    const chartCandles = [];
    for (let i = startIdx; i < candles.length; i++) {
      chartCandles.push({
        time: candles[i].time,
        open: candles[i].open,
        high: candles[i].high,
        low: candles[i].low,
        close: candles[i].close,
        volume: candles[i].volume,
        ema9: ema9Series[i] ?? null,
        ema21: ema21Series[i] ?? null
      });
    }

    // Recomendación de tiempo de expiración según temporalidad de vela en IQ Option
    const expirationMap = {
      '1m': '1 a 3 minutos (1 a 3 velas de 1m)',
      '5m': '5 a 15 minutos (1 a 3 velas de 5m)',
      '15m': '15 a 45 minutos (1 a 3 velas de 15m)',
      '1h': '1 a 3 horas (Cierre de vela horaria)'
    };

    return res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      asset: assetConfig,
      interval,
      expirationSuggested: expirationMap[interval] || '5 a 15 minutos',
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
      candlePattern: pattern,
      signal,
      fundamental: {
        macroDrivers: assetConfig.macroDrivers,
        newsSentiment: signal.newsSentiment,
        sessions,
        news: liveNews
      },
      chartCandles
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err.message || err)
    });
  }
}
