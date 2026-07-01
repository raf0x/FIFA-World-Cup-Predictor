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

// ── Goalscorer + card fetch (one call per completed match) ────────────────
// Card → conduct points per FIFA Annex C rules (computed per player, then summed):
//   Single yellow: -1 | Second yellow (= indirect red): -3 total | Direct red: -4 | Yellow + direct red: -5 total
async function fetchScorers(eventId, homeTeamId, awayTeamId) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`,
      { next: { revalidate: 86400 } } // completed match — never changes
    );
    if (!res.ok) return { homeScorers: [], awayScorers: [], homeScorerDetails: [], awayScorerDetails: [], homeCardPts: 0, awayCardPts: 0 };
    const data = await res.json();

    const homeScorers = [];
    const awayScorers = [];
    const homeScorerDetails = []; // { id, name, isOwnGoal } — for cross-match top-scorer aggregation
    const awayScorerDetails = [];
    // Per-player tally within this match: { team: 'home'|'away', yellows: n, directRed: bool }
    const players = {};

    for (const evt of (data.keyEvents || [])) {
      const typeText = (evt.type?.text || '').toLowerCase();

      // ── Goals ──
      if (evt.scoringPlay && typeText.includes('goal')) {
        const isOwnGoal = typeText.includes('own');
        const athlete = evt.participants?.[0]?.athlete;
        if (athlete) {
          const fullName = athlete.displayName || '';
          const parts = fullName.trim().split(' ');
          const shortName = parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : fullName;
          const minute = evt.clock?.displayValue || '';
          const label = `${shortName} ${minute}${isOwnGoal ? ' (OG)' : ''}`.trim();
          const isHome = String(evt.team?.id) === String(homeTeamId);
          const detail = { id: athlete.id || fullName, name: fullName, isOwnGoal };
          if (isHome) { homeScorers.push(label); homeScorerDetails.push(detail); }
          else { awayScorers.push(label); awayScorerDetails.push(detail); }
        }
        continue;
      }

      // ── Cards ── (accumulate raw events per player; convert to points after the loop)
      const isYellow = typeText.includes('yellow card') && !typeText.includes('second yellow');
      const isSecondYellow = typeText.includes('second yellow');
      const isDirectRed = typeText.includes('red card') && !isSecondYellow;
      if (!isYellow && !isSecondYellow && !isDirectRed) continue;

      const athlete = evt.participants?.[0]?.athlete;
      const athleteId = athlete?.id || `${evt.team?.id}-${athlete?.displayName}-${Math.random()}`;
      const isHome = String(evt.team?.id) === String(homeTeamId);

      if (!players[athleteId]) players[athleteId] = { team: isHome ? 'home' : 'away', yellows: 0, directRed: false };
      if (isYellow || isSecondYellow) players[athleteId].yellows += 1;
      if (isDirectRed) players[athleteId].directRed = true;
    }

    // Convert each player's card history into a single conduct-point total
    let homeCardPts = 0, awayCardPts = 0;
    for (const p of Object.values(players)) {
      let pts = 0;
      if (p.yellows >= 2) pts = -3;        // second yellow = indirect red
      else if (p.yellows === 1) pts = -1;  // single yellow
      if (p.directRed) pts -= 4;            // direct red always adds -4 (combines with yellow → -5 total)
      if (p.team === 'home') homeCardPts += pts; else awayCardPts += pts;
    }

    return { homeScorers, awayScorers, homeScorerDetails, awayScorerDetails, homeCardPts, awayCardPts };
  } catch {
    return { homeScorers: [], awayScorers: [], homeScorerDetails: [], awayScorerDetails: [], homeCardPts: 0, awayCardPts: 0 };
  }
}

// ── Map raw matches → groupScores + recentMatches + cardScores + topScorers ──
function processMatches(rawMatches) {
  const groupScores = {};
  const recentMatches = [];
  const cardScores = {}; // teamName -> cumulative conduct points across all group matches
  const scorerTally = {}; // athleteId -> { name, team, goals }
  let count = 0;

  for (const m of rawMatches) {
    const hRaw = normalize(m.homeTeam);
    const aRaw = normalize(m.awayTeam);

    // ── Scorer tally: run for EVERY completed match (group AND knockout) ──
    const rawHomeName = m.homeTeam;
    const rawAwayName = m.awayTeam;
    for (const d of (m.homeScorerDetails || [])) {
      if (d.isOwnGoal) continue;
      if (!scorerTally[d.id]) scorerTally[d.id] = { name: d.name, team: rawHomeName, goals: 0 };
      scorerTally[d.id].goals++;
    }
    for (const d of (m.awayScorerDetails || [])) {
      if (d.isOwnGoal) continue;
      if (!scorerTally[d.id]) scorerTally[d.id] = { name: d.name, team: rawAwayName, goals: 0 };
      scorerTally[d.id].goals++;
    }

    // ── Group-stage scoring: only applies to group matches ──
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

    const homeTeamName = group.teams[flipped ? ai : hi].name;
    const awayTeamName = group.teams[flipped ? hi : ai].name;
    const homeCardPts = flipped ? (m.awayCardPts || 0) : (m.homeCardPts || 0);
    const awayCardPts = flipped ? (m.homeCardPts || 0) : (m.awayCardPts || 0);

    cardScores[homeTeamName] = (cardScores[homeTeamName] || 0) + homeCardPts;
    cardScores[awayTeamName] = (cardScores[awayTeamName] || 0) + awayCardPts;

    recentMatches.push({
      group: group.id,
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      homeScore: flipped ? m.awayScore : m.homeScore,
      awayScore: flipped ? m.homeScore : m.awayScore,
      homeScorers: flipped ? (m.awayScorers || []) : (m.homeScorers || []),
      awayScorers: flipped ? (m.homeScorers || []) : (m.awayScorers || []),
    });

    count++;
  }

  const topScorers = Object.values(scorerTally)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);

  return { groupScores, recentMatches, cardScores, topScorers, count };
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
        // ESPN's `state` field is the reliable signal: 'pre' | 'in' | 'post'.
        // Matching on `state === 'in'` catches every in-progress variant
        // (first half, second half, halftime, stoppage, etc.) instead of only
        // the two specific status NAMEs we previously allowlisted — which is
        // what caused live matches to be missed for the first chunk of play
        // whenever ESPN reported a status name other than STATUS_IN_PROGRESS.
        const inProgress = !completed && statusType.state === 'in';

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
            homeWinner: homeC.winner === true,
            awayWinner: awayC.winner === true,
            homeTeamId: homeC.team?.id || null,
            awayTeamId: awayC.team?.id || null,
            eventId:    event.id || null,
            homeScorers: [],
            awayScorers: [],
            homeCardPts: 0,
            awayCardPts: 0,
          });
        } else if (inProgress) {
          // Parse clock: "90:00" → "90'", halftime → "HT"
          let clock = 'LIVE';
          const isHalftime = statusType.name === 'STATUS_HALFTIME' ||
            (statusType.shortDetail || '').toUpperCase().includes('HALFTIME');
          if (isHalftime) {
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

  // Step 2: fetch goalscorers + cards in parallel for all completed matches
  await Promise.all(rawMatches.map(async (m) => {
    if (!m.eventId) return;
    const { homeScorers, awayScorers, homeScorerDetails, awayScorerDetails, homeCardPts, awayCardPts } = await fetchScorers(m.eventId, m.homeTeamId, m.awayTeamId);
    m.homeScorers = homeScorers;
    m.awayScorers = awayScorers;
    m.homeScorerDetails = homeScorerDetails;
    m.awayScorerDetails = awayScorerDetails;
    m.homeCardPts = homeCardPts;
    m.awayCardPts = awayCardPts;
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
      homeCardPts: 0,
      awayCardPts: 0,
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

    // Process completed matches → groupScores + recentMatches + cardScores + topScorers
    const { groupScores, recentMatches, cardScores, topScorers, count } =
      rawMatches.length > 0
        ? processMatches(rawMatches)
        : { groupScores: {}, recentMatches: [], cardScores: {}, topScorers: [], count: 0 };

    // Completed knockout matches for carousel: non-group matches with full scorer data.
    // Round label is derived from how many knockout matches have been played so far.
    const KNOCKOUT_ROUNDS = ['Round of 32','Round of 32','Round of 32','Round of 32',
      'Round of 32','Round of 32','Round of 32','Round of 32','Round of 32','Round of 32',
      'Round of 32','Round of 32','Round of 32','Round of 32','Round of 32','Round of 32',
      'Round of 16','Round of 16','Round of 16','Round of 16',
      'Round of 16','Round of 16','Round of 16','Round of 16',
      'Quarterfinals','Quarterfinals','Quarterfinals','Quarterfinals',
      'Semifinals','Semifinals','3rd Place','Final'];
    const recentKnockout = [];
    const completedKnockout = [];
    for (const m of rawMatches) {
      const hNorm = normalize(m.homeTeam);
      const aNorm = normalize(m.awayTeam);
      const group = GROUPS.find(g =>
        findTeamIdx(g, hNorm) !== -1 && findTeamIdx(g, aNorm) !== -1
      );
      if (group) continue;
      let winner = null;
      if (m.homeWinner) winner = hNorm;
      else if (m.awayWinner) winner = aNorm;
      else if (m.homeScore > m.awayScore) winner = hNorm;
      else if (m.awayScore > m.homeScore) winner = aNorm;
      completedKnockout.push({
        homeTeam: hNorm, awayTeam: aNorm,
        homeScore: m.homeScore, awayScore: m.awayScore, winner,
      });
      recentKnockout.push({
        round: KNOCKOUT_ROUNDS[recentKnockout.length] || 'Knockout',
        homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeScore: m.homeScore, awayScore: m.awayScore,
        homeScorers: m.homeScorers || [], awayScorers: m.awayScorers || [],
      });
    }

    // Process live matches → normalize names, find group, resolve match slot for live standings
    const liveGroupScores = {};
    const liveKnockout = [];
    const liveMatches = liveRawMatches
      .map(m => {
        const hNorm = normalize(m.homeTeam);
        const aNorm = normalize(m.awayTeam);
        const group = GROUPS.find(g =>
          findTeamIdx(g, hNorm) !== -1 && findTeamIdx(g, aNorm) !== -1
        );
        if (!group) {
          // Not a group-stage pairing -> treat as a live knockout match.
          // The frontend maps it to the right bracket slot by team name.
          liveKnockout.push({
            homeTeam: hNorm,
            awayTeam: aNorm,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            clock: m.clock,
            period: m.period,
          });
          return null;
        }

        const hi = findTeamIdx(group, hNorm);
        const ai = findTeamIdx(group, aNorm);
        const matchIdx = MATCH_PAIRS.findIndex(([ph, pa]) =>
          (ph === hi && pa === ai) || (ph === ai && pa === hi)
        );
        if (matchIdx !== -1) {
          const [pairH] = MATCH_PAIRS[matchIdx];
          const flipped = pairH !== hi;
          // Provisional in-progress score, same key shape as completed groupScores —
          // lets the frontend merge this into live standings while the match is still running.
          liveGroupScores[`${group.id}_${matchIdx}`] = {
            home: String(flipped ? m.awayScore : m.homeScore),
            away: String(flipped ? m.homeScore : m.awayScore),
          };
        }

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

    const active = count > 0 || liveMatches.length > 0 || liveKnockout.length > 0;
    return Response.json({ groupScores, recentMatches, recentKnockout, liveMatches, liveKnockout, completedKnockout, liveGroupScores, cardScores, topScorers, count, active });
  } catch (err) {
    return Response.json({ groupScores: {}, recentMatches: [], recentKnockout: [], liveMatches: [], liveKnockout: [], completedKnockout: [], liveGroupScores: {}, cardScores: {}, topScorers: [], count: 0, active: false, error: err.message });
  }
}
