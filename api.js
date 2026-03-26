import { getDataToDOM } from "./app.js";

let lat, lon, city, country;

function getLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

async function getCityCountry(lat, lon) {
  const res = await axios.get(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  );

  const data = res.data;

  return {
    country: data.countryName,
    city: data.city || data.locality,
  };
}

async function getPrayerTimes(city, country) {
  const res = await axios.get(
    `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}`,
  );

  return res.data.data;
}

async function init() {
  try {
    const position = await getLocation();

    lat = position.coords.latitude;
    lon = position.coords.longitude;

    const locationData = await getCityCountry(lat, lon);

    city = locationData.city;
    country = locationData.country;

    console.log(city, country);

    const timings = await getPrayerTimes(city, country);

    getDataToDOM(timings, city, country);
  } catch (error) {
    console.error("Error:", error);
  }
}

init();
