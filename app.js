// Theme Toggle
const themeToggle = document.getElementById("themeToggle");

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  if (document.body.classList.contains("dark")) {
    themeToggle.innerHTML = `<i class="fa-solid fa-moon"></i>`;
  } else {
    themeToggle.innerHTML = `<i class="fa-regular fa-sun"></i>`;
  }
});

// Get HTML Elements
const cityEle = document.getElementById("city");
const countryEle = document.getElementById("country");
const gregorianDate = document.getElementById("gregorianDate");
const hijriDate = document.getElementById("hijriDate");

const fajrEle = document.getElementById("fajr");
const dhuhrEle = document.getElementById("dhuhr");
const asrEle = document.getElementById("asr");
const maghribEle = document.getElementById("maghrib");
const ishaEle = document.getElementById("isha");

const nextPrayerName = document.getElementById("nextPrayerName");
const countdown = document.getElementById("countdown");

const prayerItems = document.querySelectorAll(".prayer-item");

export function getDataToDOM(data, city, country) {
  cityEle.textContent = city;
  countryEle.textContent = country;

  function formatTo12Hour(time24) {
    let [hours, minutes] = time24.split(":");

    hours = parseInt(hours);

    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 → 12

    return `${hours}:${minutes} ${ampm}`;
  }

  // Prayer Times Vars
  let fajrTime = formatTo12Hour(data.timings.Fajr);
  let dhuhrTime = formatTo12Hour(data.timings.Dhuhr);
  let asrTime = formatTo12Hour(data.timings.Asr);
  let maghribTime = formatTo12Hour(data.timings.Maghrib);
  let ishaTime = formatTo12Hour(data.timings.Isha);

  // Gregorian
  const GDay = data.date.gregorian.day;
  const GWeek = data.date.gregorian.weekday.en;
  const GMonth = data.date.gregorian.month.en;
  const GYear = data.date.gregorian.year;

  gregorianDate.textContent = gregorianDate.textContent.replace(
    "weekVar",
    GWeek,
  );
  gregorianDate.textContent = gregorianDate.textContent.replace("dayVar", GDay);
  gregorianDate.textContent = gregorianDate.textContent.replace(
    "monthVar",
    GMonth,
  );
  gregorianDate.textContent = gregorianDate.textContent.replace(
    "yearVar",
    GYear,
  );

  // Hijri
  const HDay = data.date.hijri.day;
  const HMonth = data.date.hijri.month.en;
  const HYear = data.date.hijri.year;

  hijriDate.textContent = hijriDate.textContent.replace("dayVar", HDay);
  hijriDate.textContent = hijriDate.textContent.replace("monthVar", HMonth);
  hijriDate.textContent = hijriDate.textContent.replace("yearVar", HYear);

  // Prayer Times
  fajrEle.textContent = fajrTime;
  dhuhrEle.textContent = dhuhrTime;
  asrEle.textContent = asrTime;
  maghribEle.textContent = maghribTime;
  ishaEle.textContent = ishaTime;

  const Prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  function getNextPrayer(timings) {
    const now = new Date();
    for (let prayer in timings) {
      const [hours, minutes] = timings[prayer].split(":");
      const prayerTime = new Date();
      prayerTime.setHours(hours, minutes, 0);
      if (prayerTime > now && Prayers.includes(prayer)) {
        return { name: prayer, time: prayerTime };
      }
    }
    const [hours, minutes] = timings["Fajr"].split(":");
    const fajr = new Date();
    fajr.setDate(fajr.getDate() + 1);
    fajr.setHours(hours, minutes, 0);

    return { name: "Fajr", time: fajr };
  }

  function getTimeRemaining(targetTime) {
    const now = new Date();
    const diff = targetTime - now;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { hours, minutes, seconds };
  }

  function startCountdown(timings) {
    setInterval(() => {
      const nextPrayer = getNextPrayer(timings);

      prayerItems.forEach((prayer) => {
        prayer.classList.remove("active");
      });
      prayerItems.forEach((prayer) => {
        if (prayer.dataset.prayer === nextPrayer.name) {
          prayer.classList.add("active");
        }
      });

      const remaining = getTimeRemaining(nextPrayer.time);

      nextPrayerName.innerText = nextPrayer.name;

      countdown.innerText = `${format(remaining.hours)}:${format(remaining.minutes)}:${format(remaining.seconds)}`;
    }, 1000);
  }

  function format(num) {
    return num.toString().padStart(2, "0");
  }

  startCountdown(data.timings);
}
