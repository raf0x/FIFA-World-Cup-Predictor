import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Real client when env vars are set (Vercel); no-op mock during local builds
export const supabase = (url && key)
  ? createClient(url, key)
  : {
      auth: {
        getSession:          async () => ({ data: { session: null } }),
        getUser:             async () => ({ data: { user: null } }),
        onAuthStateChange:   ()       => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp:              async () => ({ error: { message: 'Auth not configured' } }),
        signInWithPassword:  async () => ({ error: { message: 'Auth not configured' } }),
        signOut:             async () => {},
      },
    };
