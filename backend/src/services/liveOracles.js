const env = require("../config/env");

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const https = require("https");
    https.get(url, { headers: { "User-Agent": "AgriShield3/1.0" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 180)}`));
        }
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`Invalid JSON from ${url}`)); }
      });
    }).on("error", reject);
  });
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round = (n, digits = 0) => Number(Number(n).toFixed(digits));

function riskVariables(precipMm, avgTempC, dryDays) {
  // Prototype normalization: rainfall deficit is measured against a configurable
  // expected precipitation for the observation window; temperature anomaly is
  // measured against a configurable agronomic baseline. These baselines are
  // explicit so they can later be replaced with crop/region climatology.
  const rainfallBaseline = Number(env.rainfallBaselineMm || 35);
  const tempBaseline = Number(env.temperatureBaselineC || 30);
  const deficitPct = rainfallBaseline <= 0 ? 0 : clamp(((rainfallBaseline - precipMm) / rainfallBaseline) * 100, 0, 100);
  const anomaly = Math.max(0, avgTempC - tempBaseline);
  return {
    rainfallDeficitBps: Math.round(deficitPct * 100),
    tempAnomalyTenths: Math.round(anomaly * 10),
    dryDayStreak: Math.max(0, Math.round(dryDays)),
  };
}

function extractDailyMetrics(daily) {
  const precip = (daily.precipitation_sum || []).map(Number);
  const temps = (daily.temperature_2m_mean || []).map(Number).filter(Number.isFinite);
  const dryThreshold = Number(env.dryDayRainThresholdMm || 1);
  let dryDays = 0;
  for (let i = precip.length - 1; i >= 0; i--) {
    if (precip[i] < dryThreshold) dryDays += 1;
    else break;
  }
  const recentRain = precip.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : Number(env.temperatureBaselineC || 30);
  return riskVariables(recentRain, avgTemp, dryDays);
}

async function fetchOpenWeather(lat, lon) {
  if (!env.openWeatherApiKey) throw new Error("OPENWEATHER_API_KEY is not configured");
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(env.openWeatherApiKey)}&units=metric`;
  const data = await httpGetJson(url);
  const rainMm = Number(data?.rain?.["3h"] ?? data?.rain?.["1h"] ?? 0);
  const tempC = Number(data?.main?.temp);
  if (!Number.isFinite(tempC)) throw new Error("OpenWeather returned no temperature");
  // OpenWeather's free current-weather endpoint does not expose a seven-day
  // observed rainfall history, so this node uses the current 1h/3h observation
  // and an explicitly configured short-window baseline.
  const hourlyBaseline = Number(env.openWeatherRainBaselineMm || 5);
  const deficitPct = clamp(((hourlyBaseline - rainMm) / hourlyBaseline) * 100, 0, 100);
  const anomaly = Math.max(0, tempC - Number(env.temperatureBaselineC || 30));
  return {
    nodeId: "openweather-node",
    source: "OpenWeather",
    observedAt: new Date().toISOString(),
    rainfallDeficitBps: Math.round(deficitPct * 100),
    tempAnomalyTenths: Math.round(anomaly * 10),
    dryDayStreak: 0,
    raw: { temperatureC: round(tempC, 2), rainfallMm: round(rainMm, 2) },
  };
}

async function fetchNasaPower(lat, lon) {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const params = "PRECTOTCORR,T2M";
  const url = `${env.nasaPowerBaseUrl}?parameters=${params}&community=AG&longitude=${encodeURIComponent(lon)}&latitude=${encodeURIComponent(lat)}&start=${fmt(start)}&end=${fmt(end)}&format=JSON`;
  const data = await httpGetJson(url);
  const p = data?.properties?.parameter?.PRECTOTCORR;
  const t = data?.properties?.parameter?.T2M;
  if (!p || !t) throw new Error("NASA POWER returned incomplete daily data");
  const dates = Object.keys(p).sort();
  const precip = dates.map((d) => Number(p[d])).filter(Number.isFinite);
  const temps = dates.map((d) => Number(t[d])).filter(Number.isFinite);
  return {
    nodeId: "nasa-power-node",
    source: "NASA POWER",
    observedAt: new Date().toISOString(),
    ...extractDailyMetrics({ precipitation_sum: precip, temperature_2m_mean: temps }),
    raw: { days: dates.length, precipitationMm: round(precip.reduce((a, b) => a + b, 0), 2), meanTemperatureC: round(temps.reduce((a, b) => a + b, 0) / Math.max(temps.length, 1), 2) },
  };
}

async function fetchOpenMeteo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&past_days=6&forecast_days=1&daily=precipitation_sum,temperature_2m_mean&timezone=auto`;
  const data = await httpGetJson(url);
  if (!data?.daily) throw new Error("Open-Meteo returned no daily data");
  return {
    nodeId: "backup-satellite-node",
    source: "Open-Meteo backup",
    observedAt: new Date().toISOString(),
    ...extractDailyMetrics(data.daily),
    raw: { days: data.daily.time?.length || 0 },
  };
}

async function fetchAllLive(lat, lon) {
  const jobs = [fetchOpenWeather(lat, lon), fetchNasaPower(lat, lon), fetchOpenMeteo(lat, lon)];
  const settled = await Promise.allSettled(jobs);
  const nodeReadings = [];
  const errors = [];
  settled.forEach((r) => r.status === "fulfilled" ? nodeReadings.push(r.value) : errors.push(r.reason?.message || "Oracle failed"));
  if (nodeReadings.length < 3) {
    throw new Error(`Live oracle quorum unavailable (${nodeReadings.length}/3). ${errors.join(" | ")}`);
  }
  return { nodeReadings, errors };
}

module.exports = { fetchAllLive, fetchOpenWeather, fetchNasaPower, fetchOpenMeteo };
