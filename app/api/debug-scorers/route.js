export const revalidate = 0; // never cache — this is for debugging only

export async function GET() {
  try {
    // Step 1: get first completed match from day 1
    const sbRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611&limit=20'
    );
    if (!sbRes.ok) return Response.json({ error: `scoreboard ${sbRes.status}` });
    const sbData = await sbRes.json();

    const events = sbData.events || [];
    const completed = events.filter(e => e.competitions?.[0]?.status?.type?.completed);

    if (!completed.length) return Response.json({ error: 'no completed events found', events: events.length });

    const firstEvent = completed[0];
    const eventId = firstEvent.id;
    const comp = firstEvent.competitions[0];
    const teams = comp.competitors.map(c => ({
      homeAway: c.homeAway,
      id: c.team?.id,
      name: c.team?.displayName,
      score: c.score,
    }));

    // Step 2: fetch summary for that event
    const sumRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`
    );
    if (!sumRes.ok) return Response.json({ error: `summary ${sumRes.status}`, eventId, teams });
    const sumData = await sumRes.json();

    return Response.json({
      eventId,
      eventName: firstEvent.name,
      teams,
      topLevelKeys: Object.keys(sumData),
      keyEventsCount: sumData.keyEvents?.length ?? 'missing',
      keyEventsSample: (sumData.keyEvents || []).slice(0, 5),
      scoringPlaysCount: sumData.scoringPlays?.length ?? 'missing',
      scoringPlaysSample: (sumData.scoringPlays || []).slice(0, 5),
    });
  } catch (err) {
    return Response.json({ error: err.message });
  }
}
