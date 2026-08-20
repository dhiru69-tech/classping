const { supabase } = require('./_supabase');

async function getSubscriptionId(deviceToken) {
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('device_token', deviceToken)
    .maybeSingle();
  return data?.id || null;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const deviceToken = req.query.deviceToken;
      if (!deviceToken) return res.status(400).json({ error: 'Missing deviceToken' });
      const subscriptionId = await getSubscriptionId(deviceToken);
      if (!subscriptionId) return res.status(200).json({ courses: [] });

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ courses: data });
    }

    if (req.method === 'POST') {
      const { deviceToken, name, day_of_week, start_time, join_link, reminder_minutes, color } = req.body || {};
      if (!deviceToken || !name || day_of_week === undefined || !start_time || !join_link) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const subscriptionId = await getSubscriptionId(deviceToken);
      if (!subscriptionId) {
        return res.status(400).json({ error: 'Enable notifications first, then add courses' });
      }

      const { data, error } = await supabase
        .from('courses')
        .insert({
          subscription_id: subscriptionId,
          name,
          day_of_week,
          start_time,
          join_link,
          reminder_minutes: reminder_minutes || 30,
          color: color || '#4FE3C1',
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ course: data });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
