export const revalidate = 0;

export async function GET() {
  const start = new Date('2026-06-11');
  const today = new Date();
  const days = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  const allMatches = [];
  const errors = [];

  await Promise.all(days.map(async (date) => {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}&limit=20`
      );
      if (!res.ok) { errors.push(`${date}: HTTP ${res.status}`); return; }
      const data = await res.json();

      for (const event of (data.events || [])) {
        const comp = event.competitions?.[0];
        const completed = comp?.status?.type?.completed;
        const competitors = comp?.competitors || [];
        const homeC = competitors.find(c => c.homeAway === 'home') || competitors[0];
        const awayC = competitors.find(c => c.homeAway === 'away') || competitors[1];

        allMatches.push({
          date,
          completed,
          eventId: event.id,
          home: homeC?.team?.displayName,
          away: awayC?.team?.displayName,
          homeScore: homeC?.score,
          awayScore: awayC?.score,
        });
      }
    } catch (e) {
      errors.push(`${date}: ${e.message}`);
    }
  }));

  return Response.json({
    daysChecked: days,
    totalMatches: allMatches.length,
    completedMatches: allMatches.filter(m => m.completed),
    errors,
  });
}
