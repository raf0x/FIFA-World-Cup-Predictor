import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;
const AUTH_LIMIT = 1;

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

    const prompt = `You are the most respected international football analyst in the world, writing a pre-tournament briefing for the 2026 FIFA World Cup.

TODAY'S DATE: ${today}.

═══════════════════════════════════════════
ANTI-HALLUCINATION RULES — ABSOLUTE:
═══════════════════════════════════════════
1. A result is CONFIRMED only if your search returned the exact score AND exact date.
2. NEVER invent, estimate, or assume a score. Not found = not reported.
3. NEVER report a future fixture as a result. If the match date is after ${today}, it has NOT been played.
4. If you cannot confirm a result via search, write exactly: "Last result unverified"
5. Do NOT write "reportedly" or "believed to have" — confirmed facts only.
6. When in doubt, leave it out.

═══════════════════════════════════════════
GROUP ${groupId} — Teams: ${teams.join(', ')}
═══════════════════════════════════════════

SEARCH STRATEGY — search each team INDIVIDUALLY. This is mandatory:

${teams.map((t, i) => `SEARCH ${i + 1}: "${t} last match result score ${today}" → Find the single most recent confirmed scoreline for ${t}, including exact opponent, score, and date.`).join('\n')}

SEARCH ${teams.length + 1}: "${teams.join(' ')} World Cup 2026 squad injuries suspensions" → Key absences for the tournament.

SEARCH ${teams.length + 2}: "Group ${groupId} 2026 World Cup correct score odds ${teams[0]} ${teams[1]} ${teams[2]} ${teams[3]} Kalshi Polymarket Hard Rock Bet" → Find betting market odds for correct scores in this group's matches.

SEARCH ${teams.length + 3}: "FIFA World Cup 2026 Group ${groupId} match score predictions DraftKings FanDuel betting" → Additional correct score market data.

SEARCH ${teams.length + 4} (if needed): Follow up on any surprising result from the individual searches above.

═══════════════════════════════════════════
ANALYSIS REQUIREMENTS:
═══════════════════════════════════════════
- lastMatch: REQUIRED for every team. Use confirmed search result. If not found after searching, write "Last result unverified" — never fabricate.
- note: reference the confirmed last result by name. Max 22 words.
- suggestedScores: for each of the 6 group matches below, provide the most likely correct score based on betting market data found in searches. Only include a match if you found actual odds/prediction data — never invent scores.
- Be decisive. No hedging.
- Use EXACT team names: ${teams.join(', ')}.

THE 6 GROUP MATCHES (use these exact matchIdx values):
0: ${teams[0]} vs ${teams[1]}
1: ${teams[0]} vs ${teams[2]}
2: ${teams[0]} vs ${teams[3]}
3: ${teams[1]} vs ${teams[2]}
4: ${teams[1]} vs ${teams[3]}
5: ${teams[2]} vs ${teams[3]}

OUTPUT: Respond with ONLY a valid JSON object. No markdown fences, no explanation, no text before or after the JSON:
{
  "summary": "one sharp sentence on the group's shape, citing the most decisive confirmed recent result",
  "teams": [
    {
      "name": "<exact team name from the list above>",
      "rank": 1,
      "lastMatch": "vs [Opponent] · [WON/DREW/LOST] [TeamScore]-[OpponentScore] ([DD Mon YYYY])",
      "note": "max 22 words referencing confirmed last match and one key differentiator"
    }
  ],
  "advance": ["<team>", "<team>"],
  "thirdPlaceShot": "short note on 3rd place wildcard, or empty string",
  "upset": "one sentence on the most likely upset backed by confirmed recent evidence",
  "confidence": "High",
  "suggestedScores": [
    { "matchIdx": 0, "homeScore": 2, "awayScore": 1, "source": "Polymarket" }
  ]
}

Include all ${teams.length} teams ranked 1 to ${teams.length}. "confidence" must be exactly: High, Medium, or Low.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2400,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    // Robust JSON extraction: find outermost { } by tracking brace depth
    let result;
    try {
      let depth = 0, jsonStart = -1, jsonEnd = -1;
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '{') {
          if (depth === 0) jsonStart = i;
          depth++;
        } else if (raw[i] === '}') {
          depth--;
          if (depth === 0 && jsonStart !== -1) { jsonEnd = i; break; }
        }
      }
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');
      result = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    } catch {
      result = { summary: 'Could not parse the analysis. Try again.', teams: [] };
    }

    // Only increment count if analysis actually returned useful data
    if (userId && result?.teams?.length > 0) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { ai_count: currentCount + 1 },
      });
    }

    return Response.json({ result });
  } catch (err) {
    return Response.json({ result: { summary: `Analysis failed: ${err.message}`, teams: [] } });
  }
}
