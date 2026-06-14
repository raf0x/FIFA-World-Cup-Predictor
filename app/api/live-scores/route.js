import { GROUPS } from '../../../lib/groups';

export const revalidate = 60; // 1-minute route cache — supports live match updates

const MATCH_PAIRS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

const NAME_MAP = {
  'South Korea':                  'Korea Republic',
  'Republic of Korea':            'Korea Republic',
  'Czech Republic':               'Czechia',
  "Côte d'Ivoire":                'Ivory Coast',
  "Cote d'Ivoire":                'Ivory Coast',
  'Turkey':                       'Türkiye',
  'United States of America':     'United States',
  'USA':                          'United States',
  'Bosnia & Herzegovina':         'Bosnia and Herzegovina',
  'Bosnia-Herzegovina':           'Bosnia and Herzegovina',
  'Bosnia and Herzeg.':           'Bosnia and Herzegovina',
  'Bosnia':                       'Bosnia and Herzegovina',
  'Curacao':                      'Curaçao',
  'Congo DR':                     'DR Congo',
  'Democratic Republic of Congo': 'DR Congo',
};

const strip = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function normalize(name) { return NAME_MAP[name] || name; }

function findTeamIdx(group, name) {
  let i = group.teams.findIndex(t => t.name === name);
  if (i !== -1) return i;
  const lo = name.toLowerCase();
  i = group.teams.findIndex(t => t.name.toLowerCase() === lo);
  if (i !== -1) return i;
  const s = strip(name);
  return group.teams.findIndex(t => strip(t.name) === s);
}

// ── Goalscorer fetch (one call per completed match) ───────────────────────
async function fetchScorers(eventId, homeTeamId, awayTeamId) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`,
      { next: { revalidate: 86400 } } // completed match — never changes
    );
    if (!res.ok) return { homeScorers: [], awayScorers: [] };
    const data = await res.json();

    const homeScorers = [];
    const awayScorers = [];

    for (const evt of (data.keyEvents || [])) {
      // Only process actual scoring plays
      if (!evt.scoringPlay) continue;
      const typeText = (evt.type?.text || '').toLowerCase();
      if (!typeText.includes('goal')) continue;

      const isOwnGoal = typeText.includes('own');

      // ESPN uses participants[0].athlete.displayName (not athletesInvolved)
      const athlete = evt.participants?.[0]?.athlete;
      if (!athlete) continue;

      const fullName = athlete.displayName || '';
      // "Julián Quiñones" → "J. Quiñones"
      const parts = fullName.trim().split(' ');
      const shortName = parts.length > 1
        ? `${parts[0][0]}. ${parts[parts.length - 1]}`
        : fullName;

      // Clock is already formatted as "9'" by ESPN
      const minute = evt.clock?.displayValue || '';
      const label = `${shortName} ${minute}${isOwnGoal ? ' (OG)' : ''}`.trim();

      // Match by team.id — no homeAway field on keyEvents
      const isHome = String(evt.team?.id) === String(homeTeamId);
      // Own goal benefits the OTHER team
      const creditHome = isOwnGoal ? !isHome : isHome;

      if (creditHome) homeScorers.push(label);
      else awayScorers.push(label);
    }

    return { homeScorers, awayScorers };
  } catch {
    return { homeScorers: [], awayScorers: [] };
  }
}

// ── Map raw matches → groupScores + recentMatches ────────────────────────
function processMatches(rawMatches) {
  const groupScores = {};
  const recentMatches = [];
  let count = 0;

  for (const m of rawMatches) {
    const hRaw = normalize(m.homeTeam);
    const aRaw = normalize(m.awayTeam);

    const group = GROUPS.find(g =>
      findTeamIdx(g, hRaw) !== -1 && findTeamIdx(g, aRaw) !== -1
    );
    if (!group) continue;

    const hi = findTeamIdx(group, hRaw);
    const ai = findTeamIdx(group, aRaw);
    if (hi === -1 || ai === -1) continue;

    const matchIdx = MATCH_PAIRS.findIndex(([ph, pa]) =>
      (ph === hi && pa === ai) || (ph === ai && pa === hi)
    );
    if (matchIdx === -1) continue;

    const [pairH] = MATCH_PAIRS[matchIdx];
    const flipped = pairH !== hi;

    groupScores[`${group.id}_${matchIdx}`] = {
      home: String(flipped ? m.awayScore : m.homeScore),
      away: String(flipped ? m.homeScore : m.awayScore),
    };

    recentMatches.push({
      group: group.id,
      homeTeam: group.teams[flipped ? ai : hi].name,
      awayTeam: group.teams[flipped ? hi : ai].name,
      homeScore: flipped ? m.awayScore : m.homeScore,
      awayScore: flipped ? m.homeScore : m.awayScore,
      homeScorers: flipped ? (m.awayScorers || []) : (m.homeScorers || []),
      awayScorers: flipped ? (m.homeScorers || []) : (m.awayScorers || []),
    });
    count++;
  }

  return { groupScores, recentMatches, count };
}

// ── ESPN scoreboard + summary ─────────────────────────────────────────────
async function fetchESPN() {
  const start = new Date('2026-06-11');
  const today = new Date();
  const days = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  const rawMatches = [];
  const liveRawMatches = [];

  // Step 1: fetch scoreboard for each day
  await Promise.all(days.map(async (date) => {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}&limit=20`,
        { cache: 'no-store' } // always fresh — route-level cache controls staleness
      );
      if (!res.ok) return;
      const data = await res.json();

      for (const event of (data.events || [])) {
        const comp = event.competitions?.[0];
        const statusType = comp?.status?.type || {};
        const completed = statusType.completed;
        const inProgress = !completed && (
          statusType.name === 'STATUS_IN_PROGRESS' ||
          statusType.name === 'STATUS_HALFTIME'
        );

        const competitors = comp?.competitors || [];
        if (competitors.length !== 2) continue;
        const homeC = competitors.find(c => c.homeAway === 'home') || competitors[0];
        const awayC = competitors.find(c => c.homeAway === 'away') || competitors[1];
        const hScore = parseInt(homeC.score);
        const aScore = parseInt(awayC.score);
        if (isNaN(hScore) || isNaN(aScore)) continue;

        if (completed) {
          rawMatches.push({
            homeTeam:   homeC.team?.displayName || homeC.team?.name || '',
            awayTeam:   awayC.team?.displayName || awayC.team?.name || '',
            homeScore:  hScore,
            awayScore:  aScore,
            homeTeamId: homeC.team?.id || null,
            awayTeamId: awayC.team?.id || null,
            eventId:    event.id || null,
            homeScorers: [],
            awayScorers: [],
          });
        } else if (inProgress) {
          // Parse clock: "90:00" → "90'", halftime → "HT"
          let clock = 'LIVE';
          if (statusType.name === 'STATUS_HALFTIME') {
            clock = 'HT';
          } else {
            const raw = comp.status?.displayClock || '';
            if (raw) {
              const mins = raw.split(':')[0];
              clock = `${mins}'`;
            }
          }
          liveRawMatches.push({
            homeTeam: homeC.team?.displayName || homeC.team?.name || '',
            awayTeam: awayC.team?.displayName || awayC.team?.name || '',
            homeScore: hScore,
            awayScore: aScore,
            clock,
            period: comp.status?.period || 1,
          });
        }
      }
    } catch {}
  }));

  // Step 2: fetch goalscorers in parallel for all completed matches
  await Promise.all(rawMatches.map(async (m) => {
    if (!m.eventId) return;
    const { homeScorers, awayScorers } = await fetchScorers(m.eventId, m.homeTeamId, m.awayTeamId);
    m.homeScorers = homeScorers;
    m.awayScorers = awayScorers;
  }));

  return { rawMatches, liveRawMatches };
}

// ── football-data.org fallback (no scorer data) ───────────────────────────
async function fetchFDO(apiKey) {
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
    { headers: { 'X-Auth-Token': apiKey }, next: { revalidate: 600 } }
  );
  if (!res.ok) throw new Error(`FDO ${res.status}`);
  const data = await res.json();

  return (data.matches || [])
    .filter(m => m.status === 'FINISHED')
    .map(m => ({
      homeTeam:    m.homeTeam.name || m.homeTeam.shortName,
      awayTeam:    m.awayTeam.name || m.awayTeam.shortName,
      homeScore:   m.score?.fullTime?.home,
      awayScore:   m.score?.fullTime?.away,
      homeScorers: [],
      awayScorers: [],
    }))
    .filter(m => m.homeScore !== null && m.awayScore !== null);
}
export async function GET() {
  try {
    const apiKey = process.env.FOOTBALL_API_KEY;
    let rawMatches = [];
    let liveRawMatches = [];

    try {
      const espn = await fetchESPN();
      rawMatches = espn.rawMatches;
      liveRawMatches = espn.liveRawMatches;
    } catch {}

    if (rawMatches.length === 0 && apiKey) {
      try { rawMatches = await fetchFDO(apiKey); } catch {}
    }

    // Process completed matches → groupScores + recentMatches
    const { groupScores, recentMatches, count } =
      rawMatches.length > 0
        ? processMatches(rawMatches)
        : { groupScores: {}, recentMatches: [], count: 0 };

    // Process live matches → normalize names and find group
    const liveMatches = liveRawMatches
      .map(m => {
        const hNorm = normalize(m.homeTeam);
        const aNorm = normalize(m.awayTeam);
        const group = GROUPS.find(g =>
          findTeamIdx(g, hNorm) !== -1 && findTeamIdx(g, aNorm) !== -1
        );
        if (!group) return null;
        return {
          group: group.id,
          homeTeam: hNorm,
          awayTeam: aNorm,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          clock: m.clock,
          period: m.period,
        };
      })
      .filter(Boolean);

    const active = count > 0 || liveMatches.length > 0;
    return Response.json({ groupScores, recentMatches, liveMatches, count, active });
  } catch (err) {
    return Response.json({ groupScores: {}, recentMatches: [], liveMatches: [], count: 0, active: false, error: err.message });
  }
}
