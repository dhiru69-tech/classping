// Public VAPID key — safe to expose in client code by design.
const VAPID_PUBLIC_KEY = 'BLlNlh4pCuTHPTEcqnQk5WahsFUoOuJ2SbkdcNvEczTn6aFo2-XwG2dq9MIeMeVghLhSjQo6R3uUTAvskhrw3Ms';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDeviceToken() {
  let token = localStorage.getItem('classping_device_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('classping_device_token', token);
  }
  return token;
}
const deviceToken = getDeviceToken();

const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const courseListEl = document.getElementById('courseList');
const emptyState = document.getElementById('emptyState');
const heroCourse = document.getElementById('heroCourse');
const heroSub = document.getElementById('heroSub');
const heroJoin = document.getElementById('heroJoin');
const countdownEl = document.getElementById('countdown');
const heroEl = document.getElementById('hero');

let courses = [];
let countdownTimer = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js');
}

function updateStatusPill() {
  const granted = Notification.permission === 'granted';
  statusPill.className = 'status-pill ' + (granted ? 'on' : 'off');
  statusText.textContent = granted ? 'reminders on' : 'tap to enable';
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    alert('Ye browser notifications support nahi karta.');
    return;
  }
  const permission = await Notification.requestPermission();
  updateStatusPill();
  if (permission !== 'granted') return;

  const reg = await registerServiceWorker();
  if (!reg) return;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceToken, subscription: sub.toJSON() }),
  });
}

statusPill.addEventListener('click', enableNotifications);

// ---------- Courses ----------

async function fetchCourses() {
  const res = await fetch(`/api/courses?deviceToken=${deviceToken}`);
  const data = await res.json();
  courses = data.courses || [];
  renderCourses();
  renderHero();
}

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function renderCourses() {
  courseListEl.querySelectorAll('.course-row').forEach((el) => el.remove());
  emptyState.style.display = courses.length ? 'none' : 'block';

  for (const c of courses) {
    const row = document.createElement('div');
    row.className = 'course-row';
    row.innerHTML = `
      <span class="day">${DAY_NAMES[c.day_of_week]}</span>
      <span class="time">${fmtTime(c.start_time.slice(0,5))}</span>
      <span class="name">${c.name}</span>
      <span class="reminder">-${c.reminder_minutes}m</span>
      <button class="del" data-id="${c.id}" aria-label="Delete">×</button>
    `;
    courseListEl.appendChild(row);
  }

  courseListEl.querySelectorAll('.del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/courses?id=${btn.dataset.id}`, { method: 'DELETE' });
      fetchCourses();
    });
  });
}

// ---------- Next-class countdown ----------

function minutesUntil(course, now) {
  const [h, m] = course.start_time.split(':').map(Number);
  const startTotal = h * 60 + m;
  const nowTotal = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  let dayDiff = course.day_of_week - now.getDay();
  if (dayDiff < 0 || (dayDiff === 0 && startTotal < nowTotal)) dayDiff += 7;
  return dayDiff * 24 * 60 + (startTotal - nowTotal);
}

function nextClass() {
  if (!courses.length) return null;
  const now = new Date();
  return courses
    .map((c) => ({ course: c, minsAway: minutesUntil(c, now) }))
    .sort((a, b) => a.minsAway - b.minsAway)[0];
}

function renderHero() {
  if (countdownTimer) clearInterval(countdownTimer);
  const upcoming = nextClass();

  if (!upcoming) {
    countdownEl.textContent = '--:--:--';
    heroCourse.textContent = 'No classes scheduled';
    heroSub.textContent = 'Add your timetable below to start getting reminders';
    heroJoin.style.display = 'none';
    return;
  }

  const { course } = upcoming;
  heroCourse.textContent = course.name;
  heroJoin.href = course.join_link;
  heroJoin.style.display = 'inline-flex';

  function tick() {
    const mins = minutesUntil(course, new Date());
    const totalSeconds = Math.max(0, Math.round(mins * 60));
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    countdownEl.textContent = `${hh}:${mm}:${ss}`;

    const urgent = mins <= 15;
    countdownEl.classList.toggle('urgent', urgent);
    heroJoin.classList.toggle('urgent', urgent);
    heroSub.textContent = urgent
      ? 'Starting soon — join whenever you\'re ready'
      : `${DAY_NAMES[course.day_of_week]} · ${fmtTime(course.start_time.slice(0,5))} IST`;

    if (totalSeconds <= 0) fetchCourses();
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ---------- Add-course sheet ----------

const sheetBackdrop = document.getElementById('sheetBackdrop');
const courseForm = document.getElementById('courseForm');

document.getElementById('openAdd').addEventListener('click', () => {
  sheetBackdrop.classList.add('open');
});
document.getElementById('closeAdd').addEventListener('click', () => {
  sheetBackdrop.classList.remove('open');
});
sheetBackdrop.addEventListener('click', (e) => {
  if (e.target === sheetBackdrop) sheetBackdrop.classList.remove('open');
});

courseForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (Notification.permission !== 'granted') {
    await enableNotifications();
    if (Notification.permission !== 'granted') {
      alert('Reminders ke liye notification permission zaroori hai.');
      return;
    }
  }

  const body = {
    deviceToken,
    name: document.getElementById('fName').value.trim(),
    day_of_week: Number(document.getElementById('fDay').value),
    start_time: document.getElementById('fTime').value,
    reminder_minutes: Number(document.getElementById('fReminder').value),
    join_link: document.getElementById('fLink').value.trim(),
  };

  const res = await fetch('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    alert('Save nahi hua: ' + (err.error || 'unknown error'));
    return;
  }

  courseForm.reset();
  sheetBackdrop.classList.remove('open');
  fetchCourses();
});

// ---------- Boot ----------

updateStatusPill();
registerServiceWorker();
fetchCourses();
