import Anthropic from '@anthropic-ai/sdk';

export async function POST(req) {
  const { groupId, teams } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages: [
      {
        role: 'user',
        content: `You are a direct, opinionated football analyst covering the 2026 FIFA World Cup.

Analyze Group ${groupId}: ${teams.join(', ')}.

For each team give 1-2 punchy sentences on their knockout chances: squad quality, recent form, and one key player to watch. End with a bold prediction of who finishes 1st, 2nd, and 3rd. No filler. Max 220 words.`,
      },
    ],
  });

  return Response.json({ analysis: message.content[0].text });
}
