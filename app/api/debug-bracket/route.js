import { GROUPS } from '../../../lib/groups';

export const revalidate = 0;

const MATCH_PAIRS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

function calcStandings(group, scores) {
  const s = {};
  group.teams.forEach(t => { s[t.name] = { name:t.name, pts:0, gf:0, ga:0, gd:0, played:0 }; });
  MATCH_PAIRS.forEach(([hi, ai], idx) => {
    const sc = scores[`${group.id}_${idx}`];
    if (!sc || sc.home==='' || sc.away==='') return;
    const hg = Number(sc.home), ag = Number(sc.away);
    if (isNaN(hg) || isNaN(ag)) return;
    const hn = group.teams[hi].name, an = group.teams[ai].name;
    s[hn].gf+=hg; s[hn].ga+=ag; s[hn].gd+=(hg-ag); s[hn].played++;
    s[an].gf+=ag; s[an].ga+=hg; s[an].gd+=(ag-hg); s[an].played++;
    if (hg>ag) { s[hn].pts+=3; s[an].pts+=0; }
    else if (hg<ag) { s[an].pts+=3; }
    else { s[hn].pts++; s[an].pts++; }
  });
  return Object.values(s).sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
}

const NAME_FIX = {
  'South Korea': 'Korea Republic', 'Czech Republic': 'Czechia',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina', 'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'United States of America': 'United States', 'USA': 'United States',
  'Turkey': 'Türkiye', 'Curacao': 'Curaçao', 'Ivory Coast': 'Ivory Coast',
};
function findTeam(group, espnName) {
  const name = NAME_FIX[espnName] || espnName;
  return group.teams.findIndex(t => t.name === name || t.name.toLowerCase() === name.toLowerCase());
}

export async function GET() {
  try {
    // Fetch completed scores from ESPN
    const start = new Date('2026-06-11');
    const today = new Date();
    const days = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1))
      days.push(d.toISOString().slice(0,10).replace(/-/g,''));

    const groupScores = {};
    await Promise.all(days.map(async date => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}&limit=20`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        for (const event of (data.events || [])) {
          const comp = event.competitions?.[0];
          if (!comp?.status?.type?.completed) continue;
          const competitors = comp.competitors || [];
          if (competitors.length !== 2) continue;
          const homeC = competitors.find(c => c.homeAway === 'home') || competitors[0];
          const awayC = competitors.find(c => c.homeAway === 'away') || competitors[1];
          const hScore = parseInt(homeC.score), aScore = parseInt(awayC.score);
          if (isNaN(hScore) || isNaN(aScore)) continue;
          const hName = homeC.team?.displayName || '';
          const aName = awayC.team?.displayName || '';
          // Find group and match index
          const group = GROUPS.find(g => findTeam(g, hName) !== -1 && findTeam(g, aName) !== -1);
          if (!group) continue;
          const hi = findTeam(group, hName);
          const ai = findTeam(group, aName);
          const matchIdx = MATCH_PAIRS.findIndex(([ph,pa]) => (ph===hi&&pa===ai)||(ph===ai&&pa===hi));
          if (matchIdx === -1) continue;
          const [pairH] = MATCH_PAIRS[matchIdx];
          const flipped = pairH !== hi;
          groupScores[`${group.id}_${matchIdx}`] = {
            home: String(flipped ? aScore : hScore),
            away: String(flipped ? hScore : aScore)
          };
        }
      } catch {}
    }));

    // Build bracket positions per group
    const bracketPositions = {};
    const thirdPlace = [];
    for (const group of GROUPS) {
      const hasAny = MATCH_PAIRS.some((_, idx) => !!groupScores[`${group.id}_${idx}`]);
      if (!hasAny) { bracketPositions[group.id] = { status: 'no matches yet', teams: [] }; continue; }
      const standings = calcStandings(group, groupScores);
      bracketPositions[group.id] = {
        status: `${standings.filter(s=>s.played>0).length}/4 teams active`,
        teams: standings.map((s, i) => ({ rank: i+1, name: s.name, pts: s.pts, gd: s.gd, played: s.played }))
      };
      if (standings[2]) thirdPlace.push({ group: group.id, name: standings[2].name, pts: standings[2].pts, gd: standings[2].gd });
    }

    thirdPlace.sort((a,b) => b.pts-a.pts || b.gd-a.gd);
    return Response.json({ bracketPositions, best8ThirdPlace: thirdPlace.slice(0,8), totalScoresLocked: Object.keys(groupScores).length });
  } catch (err) {
    return Response.json({ error: err.message });
  }
}
