import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;
const AUTH_LIMIT = 3;

export async function POST(req) {
  // Lazy init — env vars only available at runtime, not build time
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  try {
    const { groupId, teams } = await req.json();

    // ── Auth + usage check ───────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    let userId = null;
    let currentCount = 0;

    if (token) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
        // Admin account: unlimited, no counter
        if (user.email === 'rlemor@gmail.com') {
          userId = null; // skip limit check and counter increment
        } else {
          currentCount = user.user_metadata?.ai_count || 0;
          if (currentCount >= AUTH_LIMIT) {
            return Response.json({ error: 'limit_reached' }, { status: 429 });
          }
        }
      }
    }

    // ── Claude call (unchanged) ──────────────────────────────────────────
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are the most respected international football analyst in the world, writing a pre-tournament briefing for the 2026 FIFA World Cup. Kickoff is June 11, 2026.

TODAY'S DATE: ${today}. This is the only date that matters for determining what has already happened.

CRITICAL RULE — READ BEFORE SEARCHING:
Only cite match results where the date of the match is on or before ${today}.
Any match dated AFTER ${today} has NOT been played. It is a future scheduled fixture.
Do NOT report a future fixture as a result under any circumstances.
If you are uncertain whether a match was played or is upcoming, do not cite it. Skip it entirely.
Always double-check the date of every result before including it.

GROUP ${groupId}. Teams: ${teams.join(', ')}.

SEARCH STRATEGY — follow this order:

1. FIRST search: "${teams.join(', ')} match results June 2026"
   Find only matches already played on or before ${today}. Ignore any fixtures scheduled after today.

2. SECOND search: "${teams.join(', ')} World Cup 2026 squad injuries"
   Confirmed 26-man squads and any injuries or absences.

3. THIRD search: "${teams.join(', ')} 2026 World Cup qualifying FIFA ranking"
   Qualifying records and current FIFA rankings.

4. FOURTH search (optional): follow up on any surprising recent result that changes your assessment.

ANALYSIS RULES:
- Cite actual past scorelines with confirmed dates. If you cannot confirm a result was played before ${today}, omit it.
- Injured or missing key players must be flagged by name.
- Be decisive and opinionated. No hedging.

Use these EXACT team names: ${teams.join(', ')}.

OUTPUT: After all searches, output ONLY a JSON object (no markdown fences, no text before or after):
{
  "summary": "one sharp sentence on the group's overall shape, referencing the most notable confirmed recent result",
  "teams": [
    { "name": "<exact team name>", "rank": 1, "note": "max 22 words: most recent confirmed result + key player status + one decisive differentiator" }
  ],
  "advance": ["<team>", "<team>"],
  "thirdPlaceShot": "short note on the 3rd team's best-third wildcard chances, or empty string",
  "upset": "one short sentence naming the most likely upset, grounded in confirmed recent evidence",
  "confidence": "High"
}

Include all four teams ranked 1-4. "confidence" must be exactly High, Medium, or Low.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return Response.json({ result: { summary: 'Could not parse the analysis. Try again.', teams: [] } });
    }

    let result;
    try {
      result = JSON.parse(raw.slice(start, end + 1));
    } catch {
      result = { summary: raw.slice(0, 600), teams: [] };
    }

    // ── Increment count after successful call ────────────────────────────
    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { ai_count: currentCount + 1 },
      });
    }

    return Response.json({ result });
  } catch (err) {
    return Response.json({ result: { summary: `Analysis failed: ${err.message}`, teams: [] } });
  }
}
