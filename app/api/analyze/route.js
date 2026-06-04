import Anthropic from '@anthropic-ai/sdk';

// Allow time for live web research (Vercel Hobby supports up to 60s)
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { groupId, teams } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are the most respected international football analyst in the world, writing a definitive pre-tournament briefing for the 2026 FIFA World Cup. Kickoff is June 11, 2026. The tournament is days away, so current data matters more than reputation.

GROUP ${groupId}: ${teams.join(', ')}

STEP 1 — RESEARCH (use web search first, before writing anything):
Search for the most current data on all four teams. Prioritize, in order:
- Latest 2026 FIFA World Ranking for each team
- Their 2026 World Cup qualifying record: results, goal difference, dominance or struggle
- Last 5-6 match results, including any June 2026 pre-tournament friendlies
- The final 26-man squads (confirmed June 2, 2026) and any significant injuries, absences, or late call-ups
- 2025-26 club-season form of each team's 2-3 most important players
- Current manager and primary tactical system
- Any venue factors that matter (altitude in Mexico City/Guadalajara, heat, travel)

STEP 2 — PER-TEAM BREAKDOWN:
For each of the four teams, write a tight paragraph covering:
- FIFA rank + one-line qualifying summary
- Current form verdict (hot / steady / struggling) backed by a SPECIFIC recent result
- Key player and their latest form
- One genuine strength and one exploitable weakness

STEP 3 — DEFINITIVE VERDICT:
- Predicted finishing order, 1st through 4th
- State clearly which two advance automatically, and whether the 3rd-place team has a realistic shot at a best-third wildcard spot
- Identify the single biggest threat to your prediction (the most likely upset)
- Give a confidence level for your top-two call: High, Medium, or Low

RULES:
- Be specific and quantitative. Cite real rankings and recent scorelines, not vague reputation.
- Be decisive. No hedging, no filler, no "it could go either way" cop-outs.
- Ground everything in the teams' actual situation as of June 2026.
- Around 400-450 words. Separate each team with a line break so it scans easily on a card.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 6,
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    // Web search responses interleave tool-use and text blocks; keep the text.
    const analysis = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return Response.json({ analysis: analysis || 'No analysis returned. Try again.' });
  } catch (err) {
    // Return 200 so the UI shows the reason instead of a generic failure
    return Response.json({ analysis: `Analysis failed: ${err.message}` });
  }
}
