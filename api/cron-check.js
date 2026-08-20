const webpush = require('web-push');
const { supabase } = require('./_supabase');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// India runs on one timezone, no DST — Asia/Kolkata is always UTC+5:30.
function nowInIST() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const map = {};
  for (const p of parts) map[p.type] = p.value;

  const dayNames = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = map.hour === '24' ? 0 : parseInt(map.hour, 10);
  return {
    dayOfWeek: dayNames[map.weekday],
    minutesSinceMidnight: hour * 60 + parseInt(map.minute, 10),
    isoDate: `${map.year}-${map.month}-${map.day}`,
  };
}

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

module.exports = async (req, res) => {
  // Shared secret so random people can't hit this endpoint and drain your push quota.
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { dayOfWeek, minutesSinceMidnight, isoDate } = nowInIST();

  const { data: courses, error } = await supabase
    .from('courses')
    .select('*, subscriptions(*)')
    .eq('day_of_week', dayOfWeek);

  if (error) return res.status(500).json({ error: error.message });

  const TOLERANCE_MINUTES = 10; // matches the cron interval, so no class gets skipped or double-pinged
  const results = [];

  for (const course of courses || []) {
    const targetMinutes = toMinutes(course.start_time) - course.reminder_minutes;
    const due =
      targetMinutes <= minutesSinceMidnight &&
      minutesSinceMidnight - targetMinutes <= TOLERANCE_MINUTES;
    const alreadySent = course.last_notified_on === isoDate;

    if (!due || alreadySent || !course.subscriptions) continue;

    const sub = course.subscriptions;
    const payload = JSON.stringify({
      title: `Starts in ${course.reminder_minutes} min — ${course.name}`,
      body: `Class begins at ${course.start_time.slice(0, 5)} IST. Tap to join.`,
      url: course.join_link,
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      await supabase.from('courses').update({ last_notified_on: isoDate }).eq('id', course.id);
      results.push({ course: course.name, sent: true });
    } catch (err) {
      // 410/404 means the browser unsubscribed or the install was removed — clean it up.
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('subscriptions').delete().eq('id', sub.id);
      }
      results.push({ course: course.name, sent: false, error: err.message });
    }
  }

  res.status(200).json({ checkedAt: `${isoDate} ${minutesSinceMidnight}min-IST`, results });
};
