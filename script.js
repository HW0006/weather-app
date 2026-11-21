const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Light snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

const STORAGE_KEY = "weather-app-locations";

const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const statusEl = document.getElementById("status");
const locationsEl = document.getElementById("locations");
const emptyState = document.getElementById("empty-state");
const cardTemplate = document.getElementById("location-card-template");

let locations = loadLocations();
renderAll();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (!city) return;

  statusEl.textContent = "Searching...";

  try {
    const place = await geocode(city);
    if (!place) {
      statusEl.textContent = `No location found for "${city}".`;
      return;
    }

    if (locations.some((l) => l.latitude === place.latitude && l.longitude === place.longitude)) {
      statusEl.textContent = `${place.name} is already in your list.`;
      return;
    }

    locations.push(place);
    saveLocations();
    renderAll();
    input.value = "";
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = "Something went wrong. Please try again.";
    console.error(err);
  }
});

function loadLocations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
}

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  const r = data.results[0];
  return {
    name: r.name,
    region: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

async function getForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Forecast request failed");
  return res.json();
}

function renderAll() {
  emptyState.classList.toggle("hidden", locations.length > 0);
  locationsEl.innerHTML = "";
  locations.forEach((place, index) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    locationsEl.appendChild(card);

    card.querySelector(".location-name").textContent = [place.name, place.region, place.country]
      .filter(Boolean)
      .join(", ");

    card.querySelector(".remove-btn").addEventListener("click", () => {
      locations.splice(index, 1);
      saveLocations();
      renderAll();
    });

    getForecast(place.latitude, place.longitude)
      .then((weather) => fillCard(card, weather))
      .catch((err) => {
        card.querySelector(".current-desc").textContent = "Failed to load weather.";
        console.error(err);
      });
  });
}

function fillCard(card, weather) {
  const current = weather.current;
  card.querySelector(".current-temp").textContent = `${Math.round(current.temperature_2m)}°C`;
  card.querySelector(".current-desc").textContent = WEATHER_CODES[current.weather_code] || "Unknown";
  card.querySelector(".feels-like").textContent = `${Math.round(current.apparent_temperature)}°C`;
  card.querySelector(".wind-speed").textContent = Math.round(current.wind_speed_10m);
  card.querySelector(".humidity").textContent = Math.round(current.relative_humidity_2m);

  const forecastEl = card.querySelector(".forecast");
  forecastEl.innerHTML = "";
  const daily = weather.daily;
  for (let i = 0; i < Math.min(5, daily.time.length); i++) {
    const date = new Date(daily.time[i]);
    const dayName = date.toLocaleDateString(undefined, { weekday: "short" });
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);

    const dayEl = document.createElement("div");
    dayEl.className = "forecast-day";
    dayEl.innerHTML = `
      <div class="day-name">${i === 0 ? "Today" : dayName}</div>
      <div class="day-temp">${max}° / ${min}°</div>
    `;
    forecastEl.appendChild(dayEl);
  }
}
