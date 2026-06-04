import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

export async function POST(req) {
  try {
    const { groupId, teams } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are the most respected international football analyst in the world, preparing a pre-tournament read for the 2026 FIFA World Cup. Kickoff is June 11, 2026. Current data beats reputation.

GROUP ${groupId}. Use these EXACT team names: ${teams.join(', ')}.

STEP 1 — RESEARCH FIRST (use web search before writing):
- Latest 2026 FIFA World Ranking for each team
- 2026 qualifying record and goal difference
- Last 5-6 results, including June 2026 warm-up friendlies
- Final 26-man squads (confirmed June 2, 2026) and key injuries or absences
- 2025-26 club form of each team's most important player
- Manager, tactical system, and any venue factor (altitude, heat)

STEP 2 — OUTPUT:
After researching, output ONLY a JSON object. No markdown fences, no text before or after it. Exact shape:
{
  "summary": "one sharp sentence on the group's overall shape or difficulty",
  "teams": [
    { "name": "<exact team name>", "rank": 1, "note": "max 20 words: current form + key player + one differentiator, grounded in June 2026 reality" }
  ],
  "advance": ["<team>", "<team>"],
  "thirdPlaceShot": "short note on whether the 3rd-place team can grab a best-third wildcard, or an empty string",
  "upset": "one short sentence naming the most likely upset",
  "confidence": "High"
}

Rules:
- Be search-efficient: use at most 3 searches total. Batch queries to cover the whole group at once rather than one search per team.
- Include all four teams in "teams", ranked 1 through 4 by predicted finish.
- "confidence" must be exactly "High", "Medium", or "Low" (your confidence in the top-two call).
- Every note must be tight, specific, and cite real current form. No filler, no hedging.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
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

    try {
      const result = JSON.parse(raw.slice(start, end + 1));
      return Response.json({ result });
    } catch {
      return Response.json({ result: { summary: raw.slice(0, 600), teams: [] } });
    }
  } catch (err) {
    return Response.json({ result: { summary: `Analysis failed: ${err.message}`, teams: [] } });
  }
}
