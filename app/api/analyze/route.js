import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

export async function POST(req) {
  try {
    const { groupId, teams } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are the most respected international football analyst in the world, writing a pre-tournament briefing for the 2026 FIFA World Cup. Kickoff is June 11, 2026. Today is early June 2026.

GROUP ${groupId}. Teams: ${teams.join(', ')}.

SEARCH STRATEGY — follow this order exactly:

1. FIRST search: "${teams.join(', ')} June 2026 match results"
   This is your most critical search. You must find the most recent match result for each of these four teams, including any June 2026 warm-up friendlies played in the last 7 days. A result from last week beats any data from March.

2. SECOND search: "${teams.join(', ')} World Cup 2026 squad injuries"
   Find the confirmed 26-man squads (announced June 2, 2026) and any significant injuries, absences, or late call-ups.

3. THIRD search: "${teams.join(', ')} 2026 World Cup qualifying record FIFA ranking"
   Get qualifying records, goal differences, and current FIFA rankings.

4. FOURTH search (if needed): dig deeper on any surprising recent result from search 1 that changes your assessment.

ANALYSIS RULES:
- Any result from June 2026 overrides older form data. If a team just lost to a supposed minnow, say so directly.
- Be specific: cite actual scorelines, goalscorers if known, and dates.
- Injured or missing key players must be flagged by name.
- Be decisive and opinionated. No hedging.

Use these EXACT team names: ${teams.join(', ')}.

OUTPUT: After all searches, output ONLY a JSON object (no markdown fences, no text before or after):
{
  "summary": "one sharp sentence on the group's overall shape, referencing the most recent notable result",
  "teams": [
    { "name": "<exact team name>", "rank": 1, "note": "max 22 words: most recent result + key player status + one decisive differentiator" }
  ],
  "advance": ["<team>", "<team>"],
  "thirdPlaceShot": "short note on the 3rd team's best-third wildcard chances, or empty string",
  "upset": "one short sentence naming the most likely upset, grounded in recent evidence",
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
