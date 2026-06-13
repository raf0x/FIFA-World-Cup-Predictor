import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const svc = url && key ? createClient(url, key) : null;

// GET /api/predictions — fetch all users' predictions for leaderboard
export async function GET() {
  if (!svc) return Response.json({ predictions: [] });
  const { data, error } = await svc
    .from('predictions')
    .select('user_id, display_name, picks, third_place_picks, bracket_picks, bold_picks, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ predictions: data || [] });
}

// POST /api/predictions — upsert current user's prediction
export async function POST(req) {
  if (!svc) return Response.json({ error: 'Not configured' }, { status: 503 });
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: authErr } = await svc.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const { error } = await svc
    .from('predictions')
    .upsert({
      user_id:           user.id,
      display_name:      body.displayName || user.email?.split('@')[0] || 'Player',
      picks:             body.picks             || {},
      third_place_picks: body.thirdPlacePicks   || {},
      bracket_picks:     body.bracketPicks       || {},
      bold_picks:        body.boldPicks          || {},
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
