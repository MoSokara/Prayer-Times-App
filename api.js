const GEO_API = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const IP_API = "https://ipapi.co/json/";
const PRAYER_API = "https://api.aladhan.com/v1/timingsByCity";

// ─────────────────────────────────────────────────────────────────────────────
// Geolocation
// ─────────────────────────────────────────────────────────────────────────────

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
