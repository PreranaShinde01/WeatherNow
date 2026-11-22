/* ══════════════════════════════════════════════
   WeatherNow – app.js
   Live Weather Dashboard | Project 4
   ══════════════════════════════════════════════ */

"use strict";

// ── Weather-code map ─────────────────────────────────────────────────────────
// Source: Open-Meteo WMO Weather Code table
const WEATHER_CODES = {
  0:  { label: "Clear Sky",           emoji: "☀️"  },
  1:  { label: "Mainly Clear",        emoji: "🌤️" },
  2:  { label: "Partly Cloudy",       emoji: "⛅"  },
  3:  { label: "Overcast",            emoji: "☁️"  },
  45: { label: "Foggy",               emoji: "🌫️" },
  48: { label: "Icy Fog",             emoji: "🌫️" },
  51: { label: "Light Drizzle",       emoji: "🌦️" },
  53: { label: "Moderate Drizzle",    emoji: "🌦️" },
  55: { label: "Dense Drizzle",       emoji: "🌧️" },
  56: { label: "Freezing Drizzle",    emoji: "🌧️" },
  57: { label: "Heavy Freezing Drizzle", emoji: "🌧️" },
  61: { label: "Slight Rain",         emoji: "🌧️" },
  63: { label: "Moderate Rain",       emoji: "🌧️" },
  65: { label: "Heavy Rain",          emoji: "🌧️" },
  66: { label: "Freezing Rain",       emoji: "🌨️" },
  67: { label: "Heavy Freezing Rain", emoji: "🌨️" },
  71: { label: "Slight Snowfall",     emoji: "🌨️" },
  73: { label: "Moderate Snowfall",   emoji: "❄️"  },
  75: { label: "Heavy Snowfall",      emoji: "❄️"  },
  77: { label: "Snow Grains",         emoji: "🌨️" },
  80: { label: "Slight Showers",      emoji: "🌦️" },
  81: { label: "Moderate Showers",    emoji: "🌧️" },
  82: { label: "Violent Showers",     emoji: "⛈️"  },
  85: { label: "Slight Snow Showers", emoji: "🌨️" },
  86: { label: "Heavy Snow Showers",  emoji: "❄️"  },
  95: { label: "Thunderstorm",        emoji: "⛈️"  },
  96: { label: "Thunderstorm w/ Hail",emoji: "⛈️"  },
  99: { label: "Thunderstorm w/ Heavy Hail", emoji: "🌩️" },
};

/** Resolve a WMO code to its display info, with a sensible fallback. */
function resolveCode(code) {
  return WEATHER_CODES[code] ?? { label: "Unknown", emoji: "🌡️" };
}

// ── API helpers ───────────────────────────────────────────────────────────────
const GEO_API_BASE      = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_API_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Find a city by name using the Open-Meteo Geocoding API.
 * Returns { name, country, lat, lon } for the first match.
 * Throws a user-friendly Error on failure.
 */
async function findCity(name) {
  const url = GEO_API_BASE + "?count=1&name=" + encodeURIComponent(name);
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Network problem – check your internet connection.");
  }
  if (!res.ok) throw new Error("The search service is not responding. Try again shortly.");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("City not found. Check the spelling and try again.");
  }
  const c = data.results[0];
  return { name: c.name, country: c.country, lat: c.latitude, lon: c.longitude };
}

/**
 * Fetch current weather + 5-day min/max + wind + humidity for lat/lon.
 * Returns the full parsed JSON from the forecast API.
 * Throws a user-friendly Error on failure.
 */
async function getWeather(lat, lon) {
  const params = [
    "latitude="  + lat,
    "longitude=" + lon,
    "current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
    "daily=temperature_2m_max,temperature_2m_min,weather_code",
    "forecast_days=5",
    "timezone=auto",
  ].join("&");

  let res;
  try {
    res = await fetch(FORECAST_API_BASE + "?" + params);
  } catch {
    throw new Error("Network problem – could not reach the forecast service.");
  }
  if (!res.ok) throw new Error("Could not load the forecast. Try again shortly.");
  return res.json();
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form            = document.getElementById("form");
const cityInput       = document.getElementById("city");
const searchBtn       = document.getElementById("search-btn");
const statusEl        = document.getElementById("status");

const currentSection  = document.getElementById("current-section");
const forecastSection = document.getElementById("forecast-section");
const emptySection    = document.getElementById("empty-section");
const forecastGrid    = document.getElementById("forecast-grid");

const elCity          = document.getElementById("current-city");
const elCountry       = document.getElementById("current-country");
const elDate          = document.getElementById("current-date");
const elEmoji         = document.getElementById("current-emoji");
const elTemp          = document.getElementById("current-temp");
const elLabel         = document.getElementById("current-label");
const elWind          = document.getElementById("current-wind");
const elHumidity      = document.getElementById("current-humidity");

// ── State helpers ─────────────────────────────────────────────────────────────

function setLoading(on) {
  searchBtn.disabled = on;
  searchBtn.classList.toggle("loading", on);
}

/**
 * Show a status banner.
 * @param {string} message
 * @param {'error'|'warn'|'info'} type
 */
function showStatus(message, type = "error") {
  const icon = type === "error" ? "⚠️" : type === "warn" ? "ℹ️" : "⌛";
  statusEl.textContent = icon + "  " + message;
  statusEl.className = "status " + type;
  statusEl.classList.remove("hidden");
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status hidden";
}

function showWeather() {
  emptySection.classList.add("hidden");
  currentSection.classList.remove("hidden");
  forecastSection.classList.remove("hidden");
}

function hideWeather() {
  currentSection.classList.add("hidden");
  forecastSection.classList.add("hidden");
  emptySection.classList.remove("hidden");
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Render the current-weather card.
 * @param {{ name: string, country: string }} city
 * @param {object} weather  raw API response
 */
function renderCurrent(city, weather) {
  const cur   = weather.current;
  const info  = resolveCode(cur.weather_code);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  elCity.textContent     = city.name;
  elCountry.textContent  = city.country;
  elDate.textContent     = today;
  elEmoji.textContent    = info.emoji;
  elTemp.textContent     = Math.round(cur.temperature_2m) + "°C";
  elLabel.textContent    = info.label;
  elWind.textContent     = cur.wind_speed_10m + " km/h";
  elHumidity.textContent = cur.relative_humidity_2m + "%";
}

/**
 * Build and inject the 5 forecast day cards.
 * @param {object} weather  raw API response
 */
function renderForecast(weather) {
  const { daily } = weather;
  forecastGrid.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const date  = new Date(daily.time[i] + "T12:00:00"); // noon local
    const info  = resolveCode(daily.weather_code[i]);
    const max   = Math.round(daily.temperature_2m_max[i]);
    const min   = Math.round(daily.temperature_2m_min[i]);
    const label = i === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" });
    const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.setAttribute("role", "listitem");

    // Use textContent throughout – no innerHTML with user/API data
    const dayEl = document.createElement("div");
    dayEl.className = "forecast-day";
    dayEl.textContent = label;

    const dateEl = document.createElement("div");
    dateEl.className = "forecast-label";
    dateEl.style.fontSize = ".7rem";
    dateEl.textContent = dateStr;

    const emojiEl = document.createElement("div");
    emojiEl.className = "forecast-emoji";
    emojiEl.textContent = info.emoji;

    const condEl = document.createElement("div");
    condEl.className = "forecast-label";
    condEl.textContent = info.label;

    const tempsEl = document.createElement("div");
    tempsEl.className = "forecast-temps";

    const maxEl = document.createElement("span");
    maxEl.className = "forecast-max";
    maxEl.textContent = max + "°";

    const minEl = document.createElement("span");
    minEl.className = "forecast-min";
    minEl.textContent = min + "°";

    tempsEl.append(maxEl, minEl);
    card.append(dayEl, dateEl, emojiEl, condEl, tempsEl);
    forecastGrid.append(card);
  }
}

// ── Core search flow ──────────────────────────────────────────────────────────

async function handleSearch(rawInput) {
  const name = rawInput.trim();

  // ── Validate input
  if (!name) {
    showStatus("Please type a city name before searching.", "warn");
    return;
  }

  // ── Loading state
  clearStatus();
  setLoading(true);

  try {
    const city    = await findCity(name);
    const weather = await getWeather(city.lat, city.lon);

    renderCurrent(city, weather);
    renderForecast(weather);
    showWeather();

    // Remember last successful city
    try { localStorage.setItem("weathernow_last_city", city.name); } catch {}

  } catch (err) {
    hideWeather();
    showStatus(err.message, "error");
  } finally {
    setLoading(false);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

form.addEventListener("submit", function (e) {
  e.preventDefault();
  handleSearch(cityInput.value);
});

// Clear error banner once the user starts typing again
cityInput.addEventListener("input", function () {
  if (!statusEl.classList.contains("hidden")) {
    clearStatus();
  }
});

// ── Restore last city on load ─────────────────────────────────────────────────

(function restoreLastCity() {
  let last = "";
  try { last = localStorage.getItem("weathernow_last_city") || ""; } catch {}
  if (last) {
    cityInput.value = last;
    handleSearch(last);
  }
})();
