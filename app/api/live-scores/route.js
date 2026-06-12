import { GROUPS } from '../../../lib/groups';

export const revalidate = 600; // 10-min server cache — all users share one fetch

const MATCH_PAIRS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

// Map ESPN / football-data.org team names → our lib/groups.js names
const NAME_MAP = {
  // ESPN variations
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
  'DR Congo':                     'DR Congo',
  'Democratic Republic of Congo': 'DR Congo',
  'New Zealand':                  'New Zealand',
};

const strip = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function normalize(name) {
  return NAME_MAP[name] || name;
}

function findTeamIdx(group, name) {
  // 1. Direct match
  let i = group.teams.findIndex(t => t.name === name);
  if (i !== -1) return i;
  // 2. Case-insensitive
  const lo = name.toLowerCase();
  i = group.teams.findIndex(t => t.name.toLowerCase() === lo);
  if (i !== -1) return i;
  // 3. Strip accents
  const s = strip(name);
  return group.teams.findIndex(t => strip(t.name) === s);
}

function processMatches(rawMatches) {
  const groupScores = {};
  let count = 0;

  for (const m of rawMatches) {
    const hRaw = normalize(m.homeTeam);
    const aRaw = normalize(m.awayTeam);

    // Group-stage filter: both teams must be in the same group
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
    count++;
  }
  return { groupScores, count };
}

// ── ESPN unofficial API (no key) ─────────────────────────────────────────
async function fetchESPN() {
  // Fetch each day from tournament start to today
  const start = new Date('2026-06-11');
  const today = new Date();
  const matches = [];

  // Only iterate days that have passed or are today
  const days = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10).replace(/-/g, '')); // YYYYMMDD
  }

  await Promise.all(days.map(async (date) => {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}&limit=20`,
        { next: { revalidate: date === days[days.length - 1] ? 600 : 86400 } }
      );
      if (!res.ok) return;
      const data = await res.json();

      for (const event of (data.events || [])) {
        const comp = event.competitions?.[0];
        if (!comp?.status?.type?.completed) continue;

        const competitors = comp.competitors || [];
        if (competitors.length !== 2) continue;

        const homeC = competitors.find(c => c.homeAway === 'home') || competitors[0];
        const awayC = competitors.find(c => c.homeAway === 'away') || competitors[1];

        const hScore = parseInt(homeC.score);
        const aScore = parseInt(awayC.score);
        if (isNaN(hScore) || isNaN(aScore)) continue;

        matches.push({
          homeTeam: homeC.team?.displayName || homeC.team?.name || '',
          awayTeam: awayC.team?.displayName || awayC.team?.name || '',
          homeScore: hScore,
          awayScore: aScore,
        });
      }
    } catch {}
  }));

  return matches;
}

// ── football-data.org fallback (if API key set) ───────────────────────────
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
      homeTeam: m.homeTeam.name || m.homeTeam.shortName,
      awayTeam: m.awayTeam.name || m.awayTeam.shortName,
      homeScore: m.score?.fullTime?.home,
      awayScore: m.score?.fullTime?.away,
    }))
    .filter(m => m.homeScore !== null && m.awayScore !== null);
}

export async function GET() {
  try {
    const apiKey = process.env.FOOTBALL_API_KEY;
    let rawMatches = [];

    // Try ESPN first (no key needed)
    try {
      rawMatches = await fetchESPN();
    } catch {}

    // If ESPN returned nothing and FDO key is set, try FDO as fallback
    if (rawMatches.length === 0 && apiKey) {
      try { rawMatches = await fetchFDO(apiKey); } catch {}
    }

    if (rawMatches.length === 0) {
      return Response.json({ groupScores: {}, count: 0, active: false });
    }

    const { groupScores, count } = processMatches(rawMatches);
    return Response.json({ groupScores, count, active: count > 0 });
  } catch (err) {
    return Response.json({ groupScores: {}, count: 0, active: false, error: err.message });
  }
}
