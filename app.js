import {
  requestGeolocation,
  getLocationFromCoords,
  getLocationFromIP,
  fetchPrayerTimes,
} from "./api.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** The five canonical prayers we display and track. */
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

/** localStorage key for today's cached API response. */
const CACHE_KEY = "prayerTimesCache";

// ─────────────────────────────────────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────────────────────────────────────

const themeToggle = document.getElementById("themeToggle");
const cityEl = document.getElementById("city");
const countryEl = document.getElementById("country");
const gregorianDateEl = document.getElementById("gregorianDate");
const hijriDateEl = document.getElementById("hijriDate");
const nextPrayerNameEl = document.getElementById("nextPrayerName");
const countdownEl = document.getElementById("countdown");
const loadingOverlay = document.getElementById("loadingOverlay");
const errorBanner = document.getElementById("errorBanner");
const errorMessage = document.getElementById("errorMessage");
const themeColorMeta = document.getElementById("themeColorMeta");

/** Map prayer name → time <span> element for O(1) lookup. */
const prayerTimeEls = {
  Fajr: document.getElementById("fajr"),
  Dhuhr: document.getElementById("dhuhr"),
  Asr: document.getElementById("asr"),
  Maghrib: document.getElementById("maghrib"),
  Isha: document.getElementById("isha"),
};

const prayerItems = document.querySelectorAll(".prayer-item");

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

let countdownInterval = null;

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────

function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);

  themeToggle.innerHTML = isDark
    ? '<i class="fa-solid fa-sun"  aria-hidden="true"></i>'
    : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';

  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode",
  );

  // Keep the browser tab / PWA chrome colour in sync.
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", isDark ? "#0f172a" : "#f9fafb");
  }

  // ✅ FIX #9: Persist theme choice across page loads.
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

// Restore saved preference; default to dark.
const savedTheme = localStorage.getItem("theme");
applyTheme(savedTheme !== "light");

themeToggle.addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function getCached(city, country) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { date, city: c, country: cn, data } = JSON.parse(raw);
    if (date === todayKey() && c === city && cn === country) return data;
  } catch {
    // Corrupt cache — silently ignore.
  }
  return null;
}

function setCache(city, country, data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ date: todayKey(), city, country, data }),
    );
  } catch {
    // Storage quota exceeded — non-fatal.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function parseTime(rawTime) {
  // Strip timezone annotation, e.g. "04:45 (EET)" → "04:45"
  const clean = rawTime.split(" ")[0];
  const [h, m] = clean.split(":").map(Number);
  return { h, m };
}

function formatTo12Hour(rawTime) {
  let { h, m } = parseTime(rawTime);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function padTwo(n) {
  return String(Math.max(0, n)).padStart(2, "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderLocation(city, country) {
  cityEl.textContent = city;
  countryEl.textContent = country;
}

function renderDates(data) {
  const { gregorian, hijri } = data.date;
  gregorianDateEl.textContent = `${gregorian.weekday.en}, ${gregorian.month.en} ${gregorian.day}, ${gregorian.year}`;
  hijriDateEl.textContent = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
}

function renderPrayerTimes(timings) {
  PRAYERS.forEach((name) => {
    const el = prayerTimeEls[name];
    if (el) el.textContent = formatTo12Hour(timings[name]);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Next Prayer & Countdown
// ─────────────────────────────────────────────────────────────────────────────

function getNextPrayer(timings) {
  const now = new Date();

  for (const name of PRAYERS) {
    const { h, m } = parseTime(timings[name]);
    const t = new Date();
    t.setHours(h, m, 0, 0);
    if (t > now) return { name, time: t };
  }

  // All prayers passed — return tomorrow's Fajr.
  const { h, m } = parseTime(timings["Fajr"]);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(h, m, 0, 0);
  return { name: "Fajr", time: tomorrow };
}

/** Toggle the .active class to the currently-upcoming prayer item. */
function highlightActivePrayer(name) {
  prayerItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.prayer === name);
  });
}

function startCountdown(timings) {
  if (countdownInterval) clearInterval(countdownInterval);

  const tick = () => {
    const next = getNextPrayer(timings);
    const diff = next.time - new Date(); // ms remaining
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);

    nextPrayerNameEl.textContent = next.name;
    countdownEl.textContent = `${padTwo(h)}:${padTwo(m)}:${padTwo(s)}`;
    highlightActivePrayer(next.name);
  };

  tick(); // immediate first render — no 1-second initial blank
  countdownInterval = setInterval(tick, 1_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Error UI
// ─────────────────────────────────────────────────────────────────────────────

function showLoading(visible) {
  if (loadingOverlay) loadingOverlay.hidden = !visible;
}

function showError(msg) {
  if (errorBanner && errorMessage) {
    errorMessage.textContent = msg;
    errorBanner.hidden = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  showLoading(true);

  try {
    let city, country;

    // ── Step 1: Resolve location ──────────────────────────────────────────
    try {
      // Attempt GPS geolocation first (most accurate).
      const pos = await requestGeolocation();
      const loc = await getLocationFromCoords(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      city = loc.city;
      country = loc.country;
    } catch {
      const loc = await getLocationFromIP();
      city = loc.city;
      country = loc.country;
    }

    renderLocation(city, country);

    // ── Step 2: Fetch prayer times (with cache) ───────────────────────────
    let data = getCached(city, country);

    if (!data) {
      data = await fetchPrayerTimes(city, country);
      setCache(city, country, data);
    }

    // ── Step 3: Render ────────────────────────────────────────────────────
    renderDates(data);
    renderPrayerTimes(data.timings);
    startCountdown(data.timings);
  } catch (err) {
    showError(
      "Could not load prayer times. Please check your connection and refresh.",
    );
    console.error("[PrayerTimesApp]", err);
  } finally {
    showLoading(false);
  }
}

init();
