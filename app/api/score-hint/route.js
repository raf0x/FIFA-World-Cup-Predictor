import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

export async function POST(req) {
  try {
    const { homeTeam, awayTeam } = await req.json();
    if (!homeTeam || !awayTeam) {
      return Response.json({ hint: null }, { status: 400 });
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are a sports betting analyst. Find the most popular "correct score" prediction for a potential 2026 FIFA World Cup Final between ${homeTeam} and ${awayTeam}.

TODAY: ${today}

SEARCH STRATEGY — search in this order:
1. "${homeTeam} ${awayTeam} World Cup 2026 correct score odds Polymarket Kalshi"
2. "${homeTeam} ${awayTeam} FIFA World Cup Final 2026 most likely score Hard Rock Bet"
3. "World Cup 2026 Final correct score prediction betting markets"

WHAT TO FIND:
- The single most likely correct score based on market probabilities or bookmaker odds
- Which platform (Kalshi, Polymarket, Hard Rock Bet, or other) has the clearest data
- The implied probability or percentage if available

ANTI-HALLUCINATION RULES:
- Only report scores you found via search with a named source
- Never invent a score or a probability
- If no data found after all searches, return null values

OUTPUT: ONLY a valid JSON object, no markdown, no text:
{
  "home": 2,
  "away": 1,
  "source": "Polymarket",
  "probability": "18%",
  "note": "one short sentence"
}

If no reliable data found: { "home": null, "away": null, "source": null, "probability": null, "note": "No odds data found" }`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    let hint;
    try {
      let depth = 0, jsonStart = -1, jsonEnd = -1;
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '{') { if (depth === 0) jsonStart = i; depth++; }
        else if (raw[i] === '}') { depth--; if (depth === 0 && jsonStart !== -1) { jsonEnd = i; break; } }
      }
      hint = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    } catch {
      hint = { home: null, away: null, source: null, probability: null, note: 'Could not parse' };
    }

    return Response.json({ hint });
  } catch (err) {
    return Response.json({ hint: null, error: err.message }, { status: 500 });
  }
}
