const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_PUBLIC_ANON_KEY = process.env.SUPABASE_PUBLIC_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL');
}

if (!SUPABASE_PUBLIC_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase keys: set SUPABASE_PUBLIC_ANON_KEY (preferred) or SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY');
}

if (!SUPABASE_PUBLIC_ANON_KEY) {
  throw new Error('Missing SUPABASE_PUBLIC_ANON_KEY or SUPABASE_ANON_KEY');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'X-Client-Info': 'interview-agent-server' } },
};

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientOptions);
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY, clientOptions);

module.exports = { supabase: supabaseAdmin, supabaseAdmin, supabaseAnon };
