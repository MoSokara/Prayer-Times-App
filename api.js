/**
 * api.js — Pure API layer
 *
 * ✅ FIX #3: Removed axios entirely. All requests now use the native
 *    fetch() API, which is universally available in modern browsers
 *    and requires zero external dependencies.
 *
 * ✅ NEW ARCHITECTURE: This module exports pure async functions with
 *    zero DOM knowledge. app.js is the sole entry point and orchestrator.
 *    Eliminates the previous circular-import smell (api.js importing
 *    getDataToDOM from app.js, and app.js being loaded separately).
 */

const GEO_API = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const IP_API = "https://ipapi.co/json/";
const PRAYER_API = "https://api.aladhan.com/v1/timingsByCity";

// ─────────────────────────────────────────────────────────────────────────────
// Geolocation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ✅ FIX: Added { timeout, maximumAge } options to getCurrentPosition.
 *    Without a timeout the promise can hang indefinitely when the browser
 *    never resolves the position (common on desktop with no GPS).
 */
export function requestGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation API not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10_000, // give up after 10 s
      maximumAge: 300_000, // accept a cached fix up to 5 min old
      enableHighAccuracy: false,
    });
  });
}

/**
 * Convert GPS coordinates → city + country via BigDataCloud.
 */
export async function getLocationFromCoords(lat, lon) {
  const url = `${GEO_API}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Reverse-geocode failed: ${res.status}`);
  const d = await res.json();
  return {
    city: d.city || d.locality || d.principalSubdivision || "Unknown",
    country: d.countryName || "Unknown",
  };
}

/**
 * ✅ NEW: IP-based geolocation fallback.
 *    The README described this feature but it was never implemented.
 *    Used automatically when the user denies GPS permission.
 */
export async function getLocationFromIP() {
  const res = await fetch(IP_API);
  if (!res.ok) throw new Error(`IP geolocation failed: ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(`IP geolocation error: ${d.reason}`);
  return {
    city: d.city || "Unknown",
    country: d.country_name || "Unknown",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prayer Times
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch today's prayer times from AlAdhan v1 API.
 *
 * ✅ FIX: City and country are now URI-encoded (encodeURIComponent) to
 *    handle city names with spaces or special characters (e.g. "New York",
 *    "Côte d'Ivoire") that would otherwise produce a malformed URL and
 *    cause a 400 / 404 from the API.
 *
 * method=5 = Egyptian General Authority of Survey (widely used in Egypt).
 * Remove or change to suit a different default if needed.
 */
export async function fetchPrayerTimes(city, country) {
  const url =
    `${PRAYER_API}` +
    `?city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}` +
    `&method=5`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Prayer-times API failed: ${res.status}`);
  const json = await res.json();

  // AlAdhan returns { code: 200, data: { timings, date, … } }
  if (json.code !== 200) throw new Error(`AlAdhan error: ${json.status}`);
  return json.data;
}
