import { GROUPS } from '../../../lib/groups';

// Cache server-side for 5 min — all users share one response, protects free API tier
export const revalidate = 300;

// Must match GROUP_MATCH_PAIRS in page.js exactly
const MATCH_PAIRS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

// Map football-data.org names → our lib/groups.js names
const NAME_MAP = {
  'South Korea':              'Korea Republic',
  'Czech Republic':           'Czechia',
  "Côte d'Ivoire":            'Ivory Coast',
  "Cote d'Ivoire":            'Ivory Coast',
  'Turkey':                   'Türkiye',
  'United States of America': 'United States',
  'USA':                      'United States',
  'Bosnia & Herzegovina':     'Bosnia and Herzegovina',
  'Bosnia-Herzegovina':       'Bosnia and Herzegovina',
  'Bosnia & Herzeg.':         'Bosnia and Herzegovina',
  'Curacao':                  'Curaçao',
  'DR Congo':                 'DR Congo',
  'Congo DR':                 'DR Congo',
  'Democratic Republic of Congo': 'DR Congo',
  'Republic of Korea':        'Korea Republic',
  'Türkiye':                  'Türkiye',
};

const strip = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function normalizeApiName(apiName) {
  return NAME_MAP[apiName] || apiName;
}

function findTeamIdx(group, name) {
  let i = group.teams.findIndex(t => t.name === name);
  if (i !== -1) return i;
  const lo = name.toLowerCase();
  i = group.teams.findIndex(t => t.name.toLowerCase() === lo);
  if (i !== -1) return i;
  const s = strip(name);
  return group.teams.findIndex(t => strip(t.name) === s);
}

export async function GET() {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return Response.json({ groupScores: {}, count: 0, active: false });
  }

  try {
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
      {
        headers: { 'X-Auth-Token': apiKey },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return Response.json({ groupScores: {}, count: 0, active: false, error: `API ${res.status}` });
    }

    const data = await res.json();
    const groupScores = {};
    let count = 0;

    const finished = (data.matches || []).filter(
      m => m.status === 'FINISHED' && m.stage === 'GROUP_STAGE'
    );

    for (const match of finished) {
      // Use full name first — shortName often truncates (e.g. "Bosnia" instead of "Bosnia and Herzegovina")
      const hRaw = normalizeApiName(match.homeTeam.name || match.homeTeam.shortName);
      const aRaw = normalizeApiName(match.awayTeam.name || match.awayTeam.shortName);
      const hGoals = match.score?.fullTime?.home;
      const aGoals = match.score?.fullTime?.away;
      if (hGoals === null || hGoals === undefined || aGoals === null || aGoals === undefined) continue;

      // Find which group both teams belong to
      const group = GROUPS.find(g =>
        findTeamIdx(g, hRaw) !== -1 && findTeamIdx(g, aRaw) !== -1
      );
      if (!group) continue;

      const hi = findTeamIdx(group, hRaw);
      const ai = findTeamIdx(group, aRaw);
      if (hi === -1 || ai === -1) continue;

      // Find match index in MATCH_PAIRS
      const matchIdx = MATCH_PAIRS.findIndex(([ph, pa]) =>
        (ph === hi && pa === ai) || (ph === ai && pa === hi)
      );
      if (matchIdx === -1) continue;

      // Orient scores to match MATCH_PAIRS team order
      const [pairHomeIdx] = MATCH_PAIRS[matchIdx];
      const flipped = pairHomeIdx !== hi;

      groupScores[`${group.id}_${matchIdx}`] = {
        home: String(flipped ? aGoals : hGoals),
        away: String(flipped ? hGoals : aGoals),
      };
      count++;
    }

    return Response.json({ groupScores, count, active: true });
  } catch (err) {
    return Response.json({ groupScores: {}, count: 0, active: false, error: err.message });
  }
}
