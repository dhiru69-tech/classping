const { supabase } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { deviceToken, subscription } = req.body || {};
  if (!deviceToken || !subscription?.endpoint) {
    return res.status(400).json({ error: 'Missing deviceToken or subscription' });
  }

  const { endpoint, keys } = subscription;

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('device_token', deviceToken)
    .maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    row = data;
  } else {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({ device_token: deviceToken, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    row = data;
  }

  res.status(200).json({ ok: true, subscriptionId: row.id });
};
