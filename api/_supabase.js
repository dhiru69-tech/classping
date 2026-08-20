const { createClient } = require('@supabase/supabase-js');

// Service-role key never reaches the browser — it only lives here, on the server.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
