export const revalidate = 0;

export async function GET() {
  try {
    const start = new Date('2026-06-11');
    const today = new Date();
    const days = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
    }

    // Find the most recent completed match's event ID
    let foundEventId = null;
    let foundLabel = null;
    for (const date of days.slice().reverse()) {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}&limit=20`,
        { cache: 'no-store' }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const event of (data.events || [])) {
        const comp = event.competitions?.[0];
        if (comp?.status?.type?.completed) {
          const competitors = comp.competitors || [];
          const h = competitors.find(c => c.homeAway === 'home');
          const a = competitors.find(c => c.homeAway === 'away');
          foundEventId = event.id;
          foundLabel = `${h?.team?.displayName} vs ${a?.team?.displayName}`;
        }
      }
      if (foundEventId) break;
    }

    if (!foundEventId) {
      return Response.json({ error: 'No completed match found in range' });
    }

    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${foundEventId}`,
      { cache: 'no-store' }
    );
    const data = await res.json();

    // Pull out only the goal-scoring keyEvents, with FULL unmodified participant data,
    // so we can see exactly what ESPN sends (including any assist-related fields).
    const goalEvents = (data.keyEvents || [])
      .filter(evt => evt.scoringPlay && (evt.type?.text || '').toLowerCase().includes('goal'))
      .map(evt => ({
        typeText: evt.type?.text,
        clock: evt.clock?.displayValue,
        teamId: evt.team?.id,
        participants: evt.participants, // raw, unfiltered — this is what we need to see
      }));

    // Inventory of every top-level key ESPN returns for this match, so we know what's
    // actually available (lineups/roster data, if present, would show up as a key here).
    const topLevelKeys = Object.keys(data);

    // If a roster/lineup section exists under any of the common ESPN naming conventions,
    // surface a trimmed sample so we can identify the goalkeeper field shape without
    // guessing — full roster dumps are huge, so we cap depth/length defensively.
    const rosterSample = {};
    for (const key of ['rosters', 'boxscore', 'lineups']) {
      if (data[key]) {
        try {
          rosterSample[key] = JSON.parse(JSON.stringify(data[key])).slice
            ? data[key].slice(0, 1) // if it's an array (e.g. one entry per team), just show team 1
            : data[key];
        } catch {
          rosterSample[key] = '[unserializable]';
        }
      }
    }

    return Response.json({ match: foundLabel, eventId: foundEventId, goalEvents, topLevelKeys, rosterSample });
  } catch (err) {
    return Response.json({ error: err.message });
  }
}
