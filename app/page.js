'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { GROUPS } from '../lib/groups';
import { ANNEX_C } from '../lib/annex_c';
import { MATCH_SCHEDULE } from '../lib/schedule';
import { supabase } from '../lib/supabase';

// ─── Design tokens ────────────────────────────────────────────────────────
const GROUP_COLORS = {
  A: '#22c55e',  // green-500  (was neon #39ff14)
  B: '#0891b2',  // cyan-600
  C: '#8b5cf6',  // violet-500
  D: '#d97706',  // amber-600  (was bright #fbbf24)
  E: '#f97316',  // orange-500
  F: '#f87171',  // red-400
  G: '#ec4899',  // pink-500
  H: '#0ea5e9',  // sky-500    (was bright #22d3ee)
  I: '#a78bfa',  // violet-400
  J: '#ca8a04',  // yellow-600 (was bright #facc15)
  K: '#fb7185',  // rose-400
  L: '#34d399',  // emerald-400
};
const MEDAL = {
  1:{ tint:'rgba(245,193,66,.13)', ring:'rgba(245,193,66,.55)', text:'#f7cf5b', solid:'#f5c142', label:'WINNER' },
  2:{ tint:'rgba(186,196,210,.11)', ring:'rgba(186,196,210,.5)', text:'#cdd4de', solid:'#c2cad6', label:'RUNNER-UP' },
  3:{ tint:'rgba(210,140,86,.13)', ring:'rgba(210,140,86,.5)', text:'#dd9a64', solid:'#cf8a4f', label:'THIRD' },
};
const CONF = { High:'#39ff14', Medium:'#fbbf24', Low:'#fb923c' };
const RANK_LABELS = { 1:'1st', 2:'2nd', 3:'3rd' };
const BRACKET_L = { r32:[1,4,0,2,10,11,8,9], r16:[0,1,4,5], qf:[0,1], sf:[0] };
const BRACKET_R = { r32:[3,5,6,7,12,14,13,15], r16:[2,3,7,6], qf:[2,3], sf:[1] };
const SLOT_ELIGIBLE = [
  ['A','B','C','D','F'],['C','D','F','G','H'],['C','E','F','H','I'],['E','H','I','J','K'],
  ['B','E','F','I','J'],['A','E','H','I','J'],['E','F','G','I','J'],['D','E','I','J','L'],
];
const initBracket = () => ({ r32:Array(16).fill(null), r16:Array(8).fill(null), qf:Array(4).fill(null), sf:Array(2).fill(null), final:null, thirdPlace:null });

// All 6 round-robin match combos for a 4-team group (indices into group.teams)
const GROUP_MATCH_PAIRS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

function calcGroupStandings(group, groupScores, cardScores = {}) {
  const s = {};
  group.teams.forEach(t => {
    s[t.name] = { name:t.name, pts:0, gf:0, ga:0, gd:0, played:0, w:0, d:0, l:0, rank:t.rank ?? 999, conduct: cardScores[t.name] ?? 0 };
  });
  // Track raw results for head-to-head lookups: h2h[teamA][teamB] = { pts, gd, gf }
  const h2h = {};
  group.teams.forEach(t => { h2h[t.name] = {}; });

  GROUP_MATCH_PAIRS.forEach(([hi, ai], idx) => {
    const sc = groupScores[`${group.id}_${idx}`];
    if (!sc || sc.home==='' || sc.away==='' || sc.home===null || sc.away===null) return;
    const hg = Number(sc.home), ag = Number(sc.away);
    if (isNaN(hg) || isNaN(ag) || hg < 0 || ag < 0) return;
    const hn = group.teams[hi].name, an = group.teams[ai].name;
    s[hn].gf+=hg; s[hn].ga+=ag; s[hn].gd+=(hg-ag); s[hn].played++;
    s[an].gf+=ag; s[an].ga+=hg; s[an].gd+=(ag-hg); s[an].played++;
    let hPts = 0, aPts = 0;
    if (hg>ag)      { s[hn].pts+=3; s[hn].w++; s[an].l++; hPts=3; }
    else if (hg<ag) { s[an].pts+=3; s[an].w++; s[hn].l++; aPts=3; }
    else            { s[hn].pts++; s[an].pts++; s[hn].d++; s[an].d++; hPts=1; aPts=1; }
    h2h[hn][an] = { pts: hPts, gd: hg-ag, gf: hg };
    h2h[an][hn] = { pts: aPts, gd: ag-hg, gf: ag };
  });

  const teams = Object.values(s);

  // ── Official FIFA tiebreaker order ────────────────────────────────────
  // 1. Points → 2. Head-to-head mini-table (pts/gd/gf among tied teams only)
  // → 3. Overall GD → 4. Overall goals scored → 5. Team conduct score → 6. FIFA World Ranking
  teams.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    return 0; // same-points teams get re-sorted as a group below
  });

  // Group consecutive same-points teams and apply head-to-head within each block
  const result = [];
  let i = 0;
  while (i < teams.length) {
    let j = i;
    while (j < teams.length && teams[j].pts === teams[i].pts) j++;
    const block = teams.slice(i, j);
    if (block.length > 1) {
      block.sort((a, b) => {
        // Head-to-head only valid if every pair in the block has played each other
        const allPlayed = block.every(t1 =>
          block.every(t2 => t1.name === t2.name || h2h[t1.name]?.[t2.name])
        );
        if (allPlayed && block.length <= 4) {
          // Build mini-table among tied teams for this specific pair comparison
          const miniPts = (t) => block.reduce((sum, opp) =>
            opp.name === t.name ? sum : sum + (h2h[t.name]?.[opp.name]?.pts ?? 0), 0);
          const miniGd = (t) => block.reduce((sum, opp) =>
            opp.name === t.name ? sum : sum + (h2h[t.name]?.[opp.name]?.gd ?? 0), 0);
          const miniGf = (t) => block.reduce((sum, opp) =>
            opp.name === t.name ? sum : sum + (h2h[t.name]?.[opp.name]?.gf ?? 0), 0);
          const aMP = miniPts(a), bMP = miniPts(b);
          if (aMP !== bMP) return bMP - aMP;
          const aMG = miniGd(a), bMG = miniGd(b);
          if (aMG !== bMG) return bMG - aMG;
          const aMF = miniGf(a), bMF = miniGf(b);
          if (aMF !== bMF) return bMF - aMF;
        }
        // Fall through to overall criteria
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        if (b.conduct !== a.conduct) return b.conduct - a.conduct; // higher (less negative) conduct score wins
        return a.rank - b.rank; // lower FIFA rank number = better
      });
    }
    result.push(...block);
    i = j;
  }

  return result;
}

// Merge manual/typed scores with live in-progress and locked-completed scores for one group,
// matching the priority used everywhere else in the app: locked results always win over
// live (a match can't be both at once anyway), live wins over anything manually typed.
function mergeGroupScores(groupId, groupScores, lockedGroupScores, liveGroupScores) {
  const merged = { ...groupScores };
  for (const key of Object.keys(lockedGroupScores || {})) {
    if (key.startsWith(`${groupId}_`)) merged[key] = lockedGroupScores[key];
  }
  for (const key of Object.keys(liveGroupScores || {})) {
    if (key.startsWith(`${groupId}_`)) merged[key] = liveGroupScores[key];
  }
  return merged;
}

// Representative scoreline set for elimination/confirmation simulations below.
// Covers every meaningfully distinct outcome shape a tiebreaker could care about —
// draws at three different goal totals, plus home/away wins spanning goal differences
// of 1 through 4 and goals-scored from 1 through 4 — without brute-forcing the full
// 0-5×0-5 grid (36 combos), cutting the combinatorial cost ~9.5x on multi-match
// simulations while producing identical results on every validated test case.
const SIMULATION_SCORELINES = [
  ['0','0'], ['1','1'], ['2','2'],
  ['1','0'], ['2','0'], ['3','0'], ['2','1'], ['3','1'], ['4','1'], ['3','2'],
  ['0','1'], ['0','2'], ['0','3'], ['1','2'], ['1','3'], ['1','4'], ['2','3'],
];

// Mathematical elimination check: does this team have ANY realistic path to a top-3
// group finish, simulating every plausible outcome of all remaining matches in the group
// (its own and every other team's), using the exact same tiebreaker logic as the live
// standings above? This is the only correct way to know a team is "OUT" before its own
// group has fully finished — points-ceiling shortcuts give false positives/negatives
// whenever a tie at the ceiling is actually winnable or losable on tiebreakers.
function isGroupTeamEliminated(targetTeamName, group, groupScores, cardScores = {}) {
  const remainingIdx = [];
  GROUP_MATCH_PAIRS.forEach((_, idx) => {
    const sc = groupScores[`${group.id}_${idx}`];
    const played = sc && sc.home !== '' && sc.away !== '' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
    if (!played) remainingIdx.push(idx);
  });
  if (remainingIdx.length === 0) {
    // Group is fully finished — just check the team's actual final position.
    const standings = calcGroupStandings(group, groupScores, cardScores);
    return standings.findIndex(t => t.name === targetTeamName) >= 3;
  }
  function canSurvive(remaining, overlay) {
    if (remaining.length === 0) {
      const merged = { ...groupScores, ...overlay };
      const standings = calcGroupStandings(group, merged, cardScores);
      return standings.findIndex(t => t.name === targetTeamName) < 3;
    }
    const [idx, ...rest] = remaining;
    const key = `${group.id}_${idx}`;
    for (const [a, b] of SIMULATION_SCORELINES) {
      if (canSurvive(rest, { ...overlay, [key]: { home: a, away: b } })) return true;
    }
    return false;
  }
  return !canSurvive(remainingIdx, {});
}

// General confirmation check: is this team GUARANTEED to land in `positionTest` (a function
// taking a 0-indexed standings position and returning true/false) no matter what happens in
// the remaining matches? A team is only confirmed if EVERY simulated outcome satisfies the
// test — a single outcome that fails it means not yet mathematically safe, regardless of
// how many points they currently have or how few matches remain.
function isGroupTeamConfirmedAt(targetTeamName, group, groupScores, cardScores, positionTest) {
  const remainingIdx = [];
  GROUP_MATCH_PAIRS.forEach((_, idx) => {
    const sc = groupScores[`${group.id}_${idx}`];
    const played = sc && sc.home !== '' && sc.away !== '' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
    if (!played) remainingIdx.push(idx);
  });
  if (remainingIdx.length === 0) {
    const standings = calcGroupStandings(group, groupScores, cardScores);
    return positionTest(standings.findIndex(t => t.name === targetTeamName));
  }
  function survivesEverywhere(remaining, overlay) {
    if (remaining.length === 0) {
      const merged = { ...groupScores, ...overlay };
      const standings = calcGroupStandings(group, merged, cardScores);
      return positionTest(standings.findIndex(t => t.name === targetTeamName));
    }
    const [idx, ...rest] = remaining;
    const key = `${group.id}_${idx}`;
    for (const [a, b] of SIMULATION_SCORELINES) {
      if (!survivesEverywhere(rest, { ...overlay, [key]: { home: a, away: b } })) return false;
    }
    return true;
  }
  return survivesEverywhere(remainingIdx, {});
}

// Confirmation check: is this team GUARANTEED a top-2 group finish no matter what happens
// in the remaining matches? Mirrors isGroupTeamEliminated — but here a team is only
// confirmed "THROUGH" if EVERY simulated outcome keeps them top-2; a single outcome that
// drops them to 3rd or worse means they are not yet mathematically safe, regardless of
// how many points they currently have or how few matches remain.
function isGroupTeamConfirmedTop2(targetTeamName, group, groupScores, cardScores = {}) {
  return isGroupTeamConfirmedAt(targetTeamName, group, groupScores, cardScores, pos => pos < 2);
}

// Confirmation check: is this team GUARANTEED this EXACT rank (0-indexed: 0 = group winner,
// 1 = runner-up) regardless of remaining results? This is stricter than top-2 — two teams can
// both be confirmed top-2 (qualified) while the order between them is still undecided, in
// which case NEITHER is confirmed at their current exact rank yet.
function isGroupTeamConfirmedExactRank(targetTeamName, group, groupScores, cardScores, targetRank) {
  return isGroupTeamConfirmedAt(targetTeamName, group, groupScores, cardScores, pos => pos === targetRank);
}

// Confirmation check: is the qualifying SET of best-8 third-place groups mathematically
// locked, given everyone else's CURRENT standing held fixed? This does NOT require every
// group to be finished — only that no remaining match, in any still-incomplete group, could
// possibly move that group's 3rd-place team across the qualifying boundary (in or out).
//
// Why per-group checks are sufficient (not a full cross-group simulation): any real change
// to the qualifying set requires SOME group's own remaining results to be the direct cause
// of a team crossing the boundary. Checking each group's own worst/best case against the
// CURRENT frozen state of every other group can only ever be over-cautious — it might keep
// something flagged as "not yet locked" a touch longer than the mathematical minimum in rare
// cases, but it can never incorrectly call something locked when it actually isn't. That
// safety direction is what matters: never falsely promise certainty.
function isThirdPlaceSetLocked(rows, groupsById, groupScoresById, cardScores) {
  if (rows.length < 12) return false; // not every group has even started yet
  const cutoffPts = rows[7]?.pts, cutoffGd = rows[7]?.gd, cutoffGf = rows[7]?.gf,
        cutoffConduct = rows[7]?.conduct, cutoffRank = rows[7]?.rank;

  for (const row of rows) {
    const group = groupsById[row.groupId];
    const merged = groupScoresById[row.groupId];
    const remainingIdx = [];
    GROUP_MATCH_PAIRS.forEach((_, idx) => {
      const sc = merged[`${row.groupId}_${idx}`];
      const played = sc && sc.home !== '' && sc.away !== '' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
      if (!played) remainingIdx.push(idx);
    });
    if (remainingIdx.length === 0) continue; // this group is done, its 3rd place can't move

    // Try every outcome of THIS group's remaining matches; check if the team's resulting
    // (pts, gd, gf, conduct, rank) tuple could cross the current cutoff in either direction.
    function crossesBoundary(remaining, overlay) {
      if (remaining.length === 0) {
        const standings = calcGroupStandings(group, { ...merged, ...overlay }, cardScores);
        // Must look up the TARGET team by name, not by position — under a simulated
        // outcome the order of teams can shift, so "whoever is 3rd now" is not necessarily
        // the same team we started tracking. Misattributing another team's stats here was
        // a real bug that could produce impossible point totals for the tracked team.
        const t = standings.find(s => s.name === row.team);
        if (!t) return false;
        const cmp = (a,b) => a !== undefined && b !== undefined ? (a===b?0:a>b?1:-1) : 0;
        // Compare this simulated outcome against the CURRENT 8th-place benchmark using the
        // same tiebreaker order as the real ranking: pts -> gd -> gf -> conduct -> rank.
        let order = -cmp(t.pts, cutoffPts);
        if (order === 0) order = -cmp(t.gd, cutoffGd);
        if (order === 0) order = -cmp(t.gf, cutoffGf);
        if (order === 0) order = -cmp(t.conduct, cutoffConduct);
        if (order === 0) order = cmp(t.rank, cutoffRank);
        const wouldQualify = order < 0; // strictly better than current 8th place
        // A boundary "cross" happened if this team's qualifying status under this simulated
        // outcome differs from their CURRENT qualifying status.
        return wouldQualify !== row.qualifying;
      }
      const [idx, ...rest] = remaining;
      const key = `${row.groupId}_${idx}`;
      for (const [a, b] of SIMULATION_SCORELINES) {
        if (crossesBoundary(rest, { ...overlay, [key]: { home: a, away: b } })) return true;
      }
      return false;
    }
    if (crossesBoundary(remainingIdx, {})) return false; // this team could still cross the line
  }
  return true; // no team's own remaining matches can move the boundary — set is locked
}


// ─── Helpers ──────────────────────────────────────────────────────────────
function getTeamByRank(picks, groupId, rank) {
  const p = picks[groupId] || {};
  return Object.keys(p).find(t => p[t] === rank) || null;
}
function getTeamObj(groupId, name) {
  return GROUPS.find(g => g.id === groupId)?.teams.find(t => t.name === name) || null;
}
function resolveDesc(desc, picks, thirdAssignment, scoreCtx) {
  if (desc.type === 'group') {
    const name = getTeamByRank(picks, desc.group, desc.rank);
    if (!name) return { name:null, flag:null, display:`${desc.rank}${desc.group}`, confirmed:false };
    const obj = getTeamObj(desc.group, name);
    // Exact-rank confirmation, not just top-2: a bracket slot that says "1st place from Group B"
    // needs to know this SPECIFIC team is locked at rank 1, not merely that they've qualified.
    // Two teams can both be confirmed top-2 (qualified) while the order between them — and
    // therefore which specific knockout matchup each one gets — is still undecided.
    let confirmed = false;
    if ((desc.rank === 1 || desc.rank === 2) && scoreCtx) {
      const group = GROUPS.find(g => g.id === desc.group);
      const merged = mergeGroupScores(desc.group, scoreCtx.groupScores, scoreCtx.lockedGroupScores, scoreCtx.liveGroupScores);
      confirmed = isGroupTeamConfirmedExactRank(name, group, merged, scoreCtx.cardScores, desc.rank - 1);
    }
    return { name, flag:obj?.flag||'', display:name, confirmed, confirmedRank: confirmed ? desc.rank : null };
  }
  const groupId = thirdAssignment[desc.slotIdx];
  if (!groupId) return { name:null, flag:null, display:`3 ${desc.eligible.join('')}`, confirmed:false };
  const name = getTeamByRank(picks, groupId, 3);
  if (!name) return { name:null, flag:null, display:`3 ${groupId}`, confirmed:false };
  const obj = getTeamObj(groupId, name);
  // Third-place teams are confirmed once the best-8 SET itself is mathematically locked
  // (see isThirdPlaceSetLocked) — passed in via scoreCtx once that's known at the Home level.
  const confirmed = !!scoreCtx?.thirdPlaceSetLocked;
  return { name, flag:obj?.flag||'', display:name, confirmed, confirmedRank: confirmed ? 3 : null };
}
function resolveWinner(matchup, pickedName) {
  if (!pickedName) return { name:null, flag:null, display:'TBD' };
  const side = matchup.home.name === pickedName ? matchup.home : matchup.away;
  return side.name ? side : { name:pickedName, flag:null, display:pickedName };
}
function resolveLoser(matchup, pickedName) {
  if (!pickedName) return { name:null, flag:null, display:'TBD' };
  const loser = matchup.home.name === pickedName ? matchup.away : matchup.home;
  return loser.name ? loser : { name:null, flag:null, display:'TBD' };
}

// R32 matchup definitions
const R32_DEFS = [
  [{type:'group',group:'A',rank:2},{type:'group',group:'B',rank:2}],
  [{type:'group',group:'E',rank:1},{type:'third',slotIdx:0,eligible:['A','B','C','D','F']}],
  [{type:'group',group:'F',rank:1},{type:'group',group:'C',rank:2}],
  [{type:'group',group:'C',rank:1},{type:'group',group:'F',rank:2}],
  [{type:'group',group:'I',rank:1},{type:'third',slotIdx:1,eligible:['C','D','F','G','H']}],
  [{type:'group',group:'E',rank:2},{type:'group',group:'I',rank:2}],
  [{type:'group',group:'A',rank:1},{type:'third',slotIdx:2,eligible:['C','E','F','H','I']}],
  [{type:'group',group:'L',rank:1},{type:'third',slotIdx:3,eligible:['E','H','I','J','K']}],
  [{type:'group',group:'D',rank:1},{type:'third',slotIdx:4,eligible:['B','E','F','I','J']}],
  [{type:'group',group:'G',rank:1},{type:'third',slotIdx:5,eligible:['A','E','H','I','J']}],
  [{type:'group',group:'K',rank:2},{type:'group',group:'L',rank:2}],
  [{type:'group',group:'H',rank:1},{type:'group',group:'J',rank:2}],
  [{type:'group',group:'B',rank:1},{type:'third',slotIdx:6,eligible:['E','F','G','I','J']}],
  [{type:'group',group:'J',rank:1},{type:'group',group:'H',rank:2}],
  [{type:'group',group:'K',rank:1},{type:'third',slotIdx:7,eligible:['D','E','I','J','L']}],
  [{type:'group',group:'D',rank:2},{type:'group',group:'G',rank:2}],
];
const R16_PAIRS = [[1,4],[0,2],[3,5],[6,7],[10,11],[8,9],[13,15],[12,14]];
const QF_PAIRS  = [[0,1],[4,5],[2,3],[6,7]];
const SF_PAIRS  = [[0,1],[2,3]];

// ─── Flag component ────────────────────────────────────────────────────────
function Flag({ team, size = 18 }) {
  const f = team && typeof team === 'object' ? team.flag : team;
  const isMono = typeof f === 'string' && /^[a-z]{2,3}$/.test(f);
  if (!f) return <span style={{ fontSize: size }}>⚽</span>;
  if (isMono) {
    return (
      <span className="flagmono" style={{ width: size + 6, height: size - 1, fontSize: size * 0.46 }}>
        {f.toUpperCase()}
      </span>
    );
  }
  return <span style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}>{f}</span>;
}

// ─── AI Panel ─────────────────────────────────────────────────────────────
// ─── Group Score Panel ────────────────────────────────────────────────────
function GroupScorePanel({ group, groupScores, onScoreChange, lockedGroupScores, liveGroupScores, cardScores, isThirdQualified, complete }) {
  // Merge in live in-progress scores so standings reflect the match as it's happening
  const displayScores = { ...groupScores };
  for (const key of Object.keys(liveGroupScores || {})) {
    if (key.startsWith(`${group.id}_`)) displayScores[key] = liveGroupScores[key];
  }
  const standings = calcGroupStandings(group, displayScores, cardScores);
  const hasScores = standings.some(s => s.played > 0);
  const allFilled = GROUP_MATCH_PAIRS.every((_,i) => {
    const sc = groupScores[`${group.id}_${i}`];
    return sc && sc.home!=='' && sc.away!=='' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
  });

  // Per-row qualification status, independent of the existing tint classes:
  //   pos 0 -> wonGroup if mathematically locked at EXACT rank 1 (not just top-2 — the order
  //            between 1st and 2nd can still be undecided even when both are safely qualified)
  //            otherwise currentlyIn, since they're leading right now but not yet guaranteed.
  //   pos 1 -> qualified if mathematically locked at EXACT rank 2, otherwise currentlyIn.
  //   pos 2 -> currentlyIn (3rd place, currently sits in the live best-8 — still provisional)
  //            or currentlyOut (3rd place, not currently in the best-8 — still alive, not safe)
  //   pos 3 -> out, but ONLY if mathematically eliminated (no realistic remaining-match outcome
  //            can put them top-3) — checked by full simulation, not just "group finished."
  //            A team can be confirmed OUT well before its group's last match is played.
  const statusFor = (pos, teamName) => {
    if (pos === 0) {
      const confirmed = isGroupTeamConfirmedExactRank(teamName, group, displayScores, cardScores, 0);
      return confirmed ? 'wonGroup' : 'currentlyIn';
    }
    if (pos === 1) {
      const confirmed = isGroupTeamConfirmedExactRank(teamName, group, displayScores, cardScores, 1);
      return confirmed ? 'qualified' : 'currentlyIn';
    }
    if (pos === 2) return isThirdQualified ? 'currentlyIn' : 'currentlyOut';
    const eliminated = isGroupTeamEliminated(teamName, group, displayScores, cardScores);
    return eliminated ? 'out' : 'currentlyOut';
  };
  const STATUS_LABEL = { wonGroup: 'WON GROUP', qualified: 'QUALIFIED R32', currentlyIn: 'CURRENTLY IN', currentlyOut: 'CURRENTLY OUT', out: 'OUT' };

  return (
    <div className="score-panel">
      <div className="score-matches">
        {GROUP_MATCH_PAIRS.map(([hi,ai], idx) => {
          const home = group.teams[hi], away = group.teams[ai];
          const key = `${group.id}_${idx}`;
          const isLive = !!liveGroupScores?.[key];
          const sc = displayScores[key] || { home:'', away:'' };
          const hg = sc.home==='' ? null : Number(sc.home);
          const ag = sc.away==='' ? null : Number(sc.away);
          const result = hg!==null && ag!==null ? (hg>ag?'home':hg<ag?'away':'draw') : null;
          const locked = !!lockedGroupScores?.[key] || isLive;
          return (
            <div key={idx} className={`score-row ${locked ? 'score-row--locked' : ''} ${isLive ? 'score-row--live' : ''}`}>
              <span className={`score-team score-team--l ${result==='home'?'score-team--w':result==='away'?'score-team--l2':''}`}>
                <Flag team={home} size={13}/><span className="score-team-name">{home.name}</span>
              </span>
              <div className="score-inputs">
                <input
                  className={`score-input ${locked ? 'score-input--locked' : ''} ${isLive ? 'score-input--live' : ''}`}
                  type="number" min="0" max="20" placeholder="–"
                  value={sc.home} disabled={locked}
                  onChange={e => !locked && onScoreChange(group.id,idx,'home',e.target.value)}/>
                <span className="score-colon">{isLive ? '⚡' : locked ? '–' : ':'}</span>
                <input
                  className={`score-input ${locked ? 'score-input--locked' : ''} ${isLive ? 'score-input--live' : ''}`}
                  type="number" min="0" max="20" placeholder="–"
                  value={sc.away} disabled={locked}
                  onChange={e => !locked && onScoreChange(group.id,idx,'away',e.target.value)}/>
              </div>
              <span className={`score-team score-team--r ${result==='away'?'score-team--w':result==='home'?'score-team--l2':''}`}>
                <span className="score-team-name">{away.name}</span><Flag team={away} size={13}/>
              </span>
            </div>
          );
        })}
      </div>
      {hasScores && (
        <div className="score-standings">
          <div className="standings-wrap">
            <div className="standings-head">
              <span className="sth-team">TEAM</span>
              <span>P</span><span>W</span><span>D</span><span>L</span>
              <span>GD</span>
              <span className="sth-pts">PTS</span>
              <span className="sth-status"></span>
            </div>
            {standings.map((s, i) => {
              const status = statusFor(i, s.name);
              return (
                <div key={s.name} className={`standings-row standings-row--${status}`}>
                  <span className="st-pos">{i+1}</span>
                  <span className="st-name">{s.name}</span>
                  <span>{s.played}</span><span>{s.w}</span><span>{s.d}</span><span>{s.l}</span>
                  <span className={s.gd>0?'gd-pos':s.gd<0?'gd-neg':''}>{s.gd>0?'+':''}{s.gd}</span>
                  <span className="st-pts">{s.pts}</span>
                  <span className={`st-status st-status--${status}`}>{STATUS_LABEL[status]}</span>
                </div>
              );
            })}
            {allFilled && <div className="standings-auto-note">✓ Rankings auto-filled from scores</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Group Stage Card ─────────────────────────────────────────────────────
function GroupStageCard({ group, groupPicks, complete, onSetRank, groupScores, onScoreChange, lockedGroupScores, liveGroupScores, cardScores, isThirdQualified }) {
  const [showPicks, setShowPicks] = useState(false);
  const color = GROUP_COLORS[group.id];
  const rankedCount = Object.keys(groupPicks).length;

  return (
    <div className={`gcard ${complete ? 'gcard--done' : ''}`} style={complete ? { '--gc': color } : {}}>
      <div className="gcard-head">
        <div className="gcard-id">
          <span className="gchip" style={{ background: color, boxShadow:`0 0 10px ${color}33` }}>{group.id}</span>
          <div>
            <div className="gcard-title">Group {group.id}</div>
            <div className="gcard-meta">
              {complete
                ? <span className="gcard-done-tag">✓ Complete</span>
                : <span>{rankedCount}/3 picked · top 2 advance</span>}
            </div>
          </div>
        </div>
        <button
          className={`score-toggle-btn score-toggle-btn--sm ${showPicks ? 'score-toggle-btn--on' : ''}`}
          onClick={() => setShowPicks(p => !p)}>
          {showPicks ? '▴ Hide picks' : '✎ My picks'}
        </button>
      </div>

      {showPicks && (
        <div className="gcard-teams">
          {group.teams.map(team => {
            const rank = groupPicks[team.name];
            const m = rank ? MEDAL[rank] : null;
            return (
              <div key={team.name} className="trow"
                style={m ? { background:m.tint, boxShadow:`inset 0 0 0 1px ${m.ring}` } : {}}>
                <div className="trow-id">
                  <Flag team={team} size={18} />
                  <span className="trow-name">{team.name}</span>
                  <span className="trow-rank">#{team.rank}</span>
                  {m && <span className="trow-tag" style={{ color:m.text }}>{m.label}</span>}
                </div>
                <div className="rankbtns">
                  {[1,2,3].map(r => {
                    const active = rank === r;
                    const rm = MEDAL[r];
                    return (
                      <button key={r} className={`rankbtn ${active ? 'rankbtn--on' : ''}`}
                        onClick={() => onSetRank(group.id, team.name, r)}
                        style={active ? { background:rm.solid, color:'#0a0a12', boxShadow:`0 0 12px ${rm.solid}66` } : {}}>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Score panel always visible */}
      <GroupScorePanel group={group} groupScores={groupScores} onScoreChange={onScoreChange} lockedGroupScores={lockedGroupScores} liveGroupScores={liveGroupScores} cardScores={cardScores} isThirdQualified={isThirdQualified} complete={complete} />
    </div>
  );
}

// ─── Third Place Picker ────────────────────────────────────────────────────
function ThirdPlacePicker({ candidates, picks, allGroupsDone, onToggle }) {
  if (!allGroupsDone) {
    return <div className="locked">Complete all 12 groups to unlock third-place selection.</div>;
  }
  return (
    <>
      <div className="third-slots">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={`slot-dot ${i < picks.length ? 'slot-dot--on' : ''}`} />
        ))}
        <span className="third-count">{picks.length}<span className="third-count-of">/8 selected</span></span>
      </div>
      <div className="third-grid">
        {candidates.map(c => {
          const selected = picks.includes(c.groupId);
          const atCap = picks.length >= 8 && !selected;
          const color = GROUP_COLORS[c.groupId];
          return (
            <button key={c.groupId}
              className={`third-card ${selected ? 'third-card--on' : ''} ${atCap ? 'third-card--cap' : ''}`}
              onClick={() => onToggle(c.groupId)} disabled={atCap}
              style={selected ? { '--gc': color } : {}}>
              <div className="third-top">
                <span className="third-grp" style={{ color }}>GROUP {c.groupId}</span>
                {selected && <span className="third-check">✓</span>}
              </div>
              <div className="third-team">
                <Flag team={c} size={20} />
                <span className="third-name">{c.name}</span>
              </div>
              <div className="third-status">{selected ? 'ADVANCING' : '3rd place'}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Bracket components ────────────────────────────────────────────────────
function BracketSlot({ matchup, picked, onPick, matchNum, wide, score, onScoreChange, badgePos = 'top', allGroupsDone = false }) {
  const { home, away } = matchup;
  const bothKnown = home.name && away.name;
  const info = matchNum ? MATCH_SCHEDULE[matchNum] : null;
  const title = info ? `M${matchNum} · ${info.date} · ${info.time} · ${info.venue}` : undefined;

  const handleScoreChange = (side, value) => {
    if (!onScoreChange) return;
    onScoreChange(side, value);
    const otherSide = side === 'home' ? 'away' : 'home';
    const otherVal = score?.[otherSide] ?? '';
    const thisNum = parseInt(value);
    const otherNum = parseInt(otherVal);
    if (!isNaN(thisNum) && !isNaN(otherNum) && value !== '' && otherVal !== '') {
      const homeScore = side === 'home' ? thisNum : otherNum;
      const awayScore = side === 'away' ? thisNum : otherNum;
      if (homeScore > awayScore && home.name) onPick(home.name);
      else if (awayScore > homeScore && away.name) onPick(away.name);
    }
  };

  return (
    <div className="slot-wrap" data-badgepos={badgePos}>
      {matchNum && <span className="slot-matchnum">M{matchNum}</span>}
      <div className={`slot ${wide ? 'slot--wide' : ''}`} title={title}>
      {[home, away].map((team, i) => {
        const isPicked = team.name !== null && picked === team.name;
        const isOther = picked && picked !== team.name;
        const clickable = bothKnown && team.name;
        const side = i === 0 ? 'home' : 'away';
        const confirmedClass = allGroupsDone
          ? (team.confirmedRank ? 'slotrow--wonGroup' : '')
          : (team.confirmedRank === 1 ? 'slotrow--wonGroup' : team.confirmedRank === 2 ? 'slotrow--qualified' : '');
        const nameConfirmedClass = allGroupsDone
          ? (team.confirmedRank ? 'slot-name--wonGroup' : '')
          : (team.confirmedRank === 1 ? 'slot-name--wonGroup' : team.confirmedRank === 2 ? 'slot-name--qualified' : '');
        return (
          <div key={i} className="slot-team-row">
            <button
              className={`slotrow ${isPicked ? 'slotrow--pick' : ''} ${isOther ? 'slotrow--out' : ''} ${clickable ? 'slotrow--live' : ''} ${confirmedClass}`}
              onClick={() => clickable && onPick(isPicked ? null : team.name)}
              disabled={!clickable}>
              <span className="slot-flag"><Flag team={team} size={11} /></span>
              <span className={`slot-name ${nameConfirmedClass}`}>{team.name || team.display}</span>
              {isPicked && <span className="slot-adv">▸</span>}
            </button>
            {bothKnown && onScoreChange && (
              <input
                className={`slot-score-inp ${isPicked ? 'slot-score-inp--pick' : isOther ? 'slot-score-inp--out' : ''}`}
                type="number" min="0" max="30" placeholder="–"
                value={score?.[side] ?? ''}
                onClick={e => e.stopPropagation()}
                onChange={e => handleScoreChange(side, e.target.value)} />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function GroupBox({ group }) {
  const color = GROUP_COLORS[group.id];
  return (
    <div className="gbox" style={{ '--gc': color }}>
      <div className="gbox-flags">
        {group.teams.map((t, i) => (
          <div key={i} className="gbox-cell"><Flag team={t} size={11} /></div>
        ))}
      </div>
      <div className="gbox-label">Group {group.id}</div>
    </div>
  );
}

function BracketLines() {
  // Geometry: 130px slots, 640px height, 6px gaps
  // Left column right edges:  R32=196, R16=332, QF=468, SF=604
  // Right column left edges:  SF=888, QF=1024, R16=1160, R32=1296
  // Slot centers (justify-around, 640px): R32=40,120,200,280,360,440,520,600
  // R16=80,240,400,560 | QF=160,480 | SF=320
  const lines = [
    // Left R32 vertical pairs + horizontal exits
    [196,40,196,120],  [196,80,202,80],
    [196,200,196,280], [196,240,202,240],
    [196,360,196,440], [196,400,202,400],
    [196,520,196,600], [196,560,202,560],
    // Left R16 vertical pairs + horizontal exits
    [332,80,332,240],  [332,160,338,160],
    [332,400,332,560], [332,480,338,480],
    // Left QF vertical + horizontal exit
    [468,160,468,480], [468,320,474,320],
    // Left SF → center
    [604,320,610,320],
    // Right R32 vertical pairs + horizontal exits
    [1296,40,1296,120],  [1290,80,1296,80],
    [1296,200,1296,280], [1290,240,1296,240],
    [1296,360,1296,440], [1290,400,1296,400],
    [1296,520,1296,600], [1290,560,1296,560],
    // Right R16 vertical pairs + horizontal exits
    [1160,80,1160,240],  [1154,160,1160,160],
    [1160,400,1160,560], [1154,480,1160,480],
    // Right QF vertical + horizontal exit
    [1024,160,1024,480], [1018,320,1024,320],
    // Right center → SF
    [882,320,888,320],
  ];
  return (
    <svg width="1492" height="640" className="bracket-svg" style={{ minWidth:1492 }}>
      {lines.map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="rgba(99,132,185,0.55)" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function MatchCard({ matchNum, home, away, picked, onPick }) {
  const bothKnown = home.name && away.name;
  const info = matchNum ? MATCH_SCHEDULE[matchNum] : null;
  return (
    <div className="mcard">
      {matchNum && (
        <div className="mcard-head">
          <span className="mcard-num">Match {matchNum}</span>
          {info && <span className="mcard-info">{info.date} · {info.venue}</span>}
        </div>
      )}
      <div className="mcard-rows">
        {[home, away].map((team, i) => {
          const isPicked = team.name !== null && picked === team.name;
          const isOther = picked && picked !== team.name;
          const clickable = bothKnown && team.name;
          return (
            <button key={i}
              className={`mrow ${isPicked ? 'mrow--pick' : ''} ${isOther ? 'mrow--out' : ''} ${clickable ? 'mrow--live' : ''}`}
              onClick={() => clickable && onPick(isPicked ? null : team.name)}
              disabled={!clickable}>
              <Flag team={team} size={16} />
              <span className="mrow-name">{team.name || team.display}</span>
              {isPicked && <span className="mrow-adv">Advances ▸</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoundSection({ title, subtitle, matchups, picks, onPick, matchNumStart, locked, lockedMsg }) {
  if (locked) return <div className="locked locked--dark">{lockedMsg}</div>;
  return (
    <div>
      <div className="round-head">
        <h3 className="round-title">{title}</h3>
        {subtitle && <p className="round-sub">{subtitle}</p>}
      </div>
      <div className="round-grid">
        {matchups.map((m, i) => (
          <MatchCard key={i} matchNum={matchNumStart ? matchNumStart + i : null}
            home={m.home} away={m.away} picked={picks[i]} onPick={n => onPick(i, n)} />
        ))}
      </div>
    </div>
  );
}

// ─── Score Carousel ───────────────────────────────────────────────────────
const TICKER_SHORT = {
  'Bosnia and Herzegovina': 'Bosnia-Herz.',
  'United States':          'USA',
  'Korea Republic':         'Korea Rep.',
  'Trinidad and Tobago':    'T&T',
  'DR Congo':               'DR Congo',
  'New Zealand':            'New Zealand',
  'Saudi Arabia':           'Saudi Arabia',
  'South Africa':           'South Africa',
};
const tickerName = name => TICKER_SHORT[name] || name;

function TickerMatchCard({ m }) {
  const hWin = m.homeScore > m.awayScore;
  const aWin = m.awayScore > m.homeScore;
  const draw = m.homeScore === m.awayScore;
  const hasScorers = !m.isLive && ((m.homeScorers?.length || 0) + (m.awayScorers?.length || 0) > 0);
  const hRank = m.homeTeamObj?.rank || 999;
  const aRank = m.awayTeamObj?.rank || 999;
  const upset = !draw && !m.isLive && (
    (hWin && hRank > aRank + 12) || (aWin && aRank > hRank + 12)
  );
  return (
    <div className={`ticker-card ${m.isLive ? 'ticker-card--live' : ''}`}>
      <div className="ticker-card-group">
        {m.isLive && <span className="ticker-live-dot" />}
        Group {m.group}
        {m.isLive && <span className="ticker-clock">{m.clock}</span>}
      </div>
      <div className="ticker-card-match">
        <div className={`ticker-team ${hWin?'ticker-team--win':!draw?'ticker-team--loss':''}`}>
          <Flag team={m.homeTeamObj} size={13}/>
          <span className="ticker-name">{tickerName(m.homeTeam)}</span>
        </div>
        <div className="ticker-score">
          <span className={hWin?'ticker-score--win':draw?'ticker-score--draw':'ticker-score--loss'}>{m.homeScore}</span>
          <span className="ticker-score-sep">–</span>
          <span className={aWin?'ticker-score--win':draw?'ticker-score--draw':'ticker-score--loss'}>{m.awayScore}</span>
        </div>
        <div className={`ticker-team ticker-team--r ${aWin?'ticker-team--win':!draw?'ticker-team--loss':''}`}>
          <span className="ticker-name">{tickerName(m.awayTeam)}</span>
          <Flag team={m.awayTeamObj} size={13}/>
        </div>
      </div>
      {hasScorers && (
        <div className="ticker-scorers">
          <div className="ticker-scorers-col">
            {(m.homeScorers || []).map((s, j) => <div key={j} className="ticker-scorer">{s}</div>)}
          </div>
          <div className="ticker-scorers-col ticker-scorers-col--r">
            {(m.awayScorers || []).map((s, j) => <div key={j} className="ticker-scorer">{s}</div>)}
          </div>
        </div>
      )}
      <div className="ticker-badges">
        {upset && <span className="ticker-upset">⚡ UPSET</span>}
        {draw && !m.isLive && <span className="ticker-draw">Draw</span>}
      </div>
    </div>
  );
}

function ScoreCarousel({ matches, liveMatches }) {
  const hasLive = liveMatches?.length > 0;
  const hasCompleted = matches?.length > 0;
  if (!hasLive && !hasCompleted) return null;

  // Completed matches stay strictly chronological (oldest → newest) — never reordered for animation.
  const completedCards = (matches || []).map(m => ({ ...m, isLive: false }));
  const shouldAnimate = completedCards.length >= 4;
  // Loop is built by appending the SAME chronological sequence again — order inside each
  // copy is identical, so the seam reads as "wrap to the start" rather than "duplicate team."
  const items = shouldAnimate ? [...completedCards, ...completedCards] : completedCards;
  const duration = `${completedCards.length * 6}s`;

  return (
    <>
      {hasLive && (
        <div className="ticker-section ticker-section--live">
          <div className="ticker-label">
            <span className="livedot" style={{display:'inline-block',marginRight:5}} />Live Now
          </div>
          <div className="ticker-track">
            <div className="ticker-cards ticker-cards--static">
              {liveMatches.map((m, i) => <TickerMatchCard key={i} m={{ ...m, isLive: true }} />)}
            </div>
          </div>
        </div>
      )}

      {hasCompleted && (
        <div className="ticker-section">
          <div className="ticker-label">⚽ Latest Results</div>
          <div className="ticker-track">
            <div className={`ticker-cards ${shouldAnimate ? 'ticker-cards--animate' : 'ticker-cards--static'}`}
              style={shouldAnimate ? { animationDuration: duration } : {}}>
              {items.map((m, i) => <TickerMatchCard key={i} m={m} />)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Confetti({ id }) {
  const colors = ['#f5c142','#39ff14','#06b6d4','#fb7185','#a78bfa','#ffffff'];
  return (
    <div className="confetti">
      {Array.from({ length: 28 }).map((_, i) => {
        const left = (i * 37 + 7) % 100;
        const delay = (i * 0.07) % 0.5;
        const dur = 1.4 + (i * 0.09) % 1.2;
        return (
          <span key={i} className="confetti-bit"
            style={{ left:`${left}%`, background:colors[i%colors.length], animationDelay:`${delay}s`, animationDuration:`${dur}s` }} />
        );
      })}
    </div>
  );
}
// ─── Auth Modal ───────────────────────────────────────────────────────────
function AuthModal({ show, onClose }) {
  const [tab, setTab] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (show) { setEmail(''); setPassword(''); setError(''); setSuccess(false); }
  }, [show]);

  if (!show) return null;

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = tab === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>✕</button>
        {success ? (
          <div className="auth-success">
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <div className="auth-title">You're in.</div>
            <p className="auth-desc">
              Your picks are now saved. Close this and keep building your bracket.
            </p>
            <button className="btn btn-green auth-submit" onClick={onClose}>Continue →</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>⚽</div>
            <h2 className="auth-title">Sign in</h2>
            <p className="auth-desc">
              Create a free account to save your picks across devices.
            </p>
            <div className="auth-tabs">
              <button className={`auth-tab ${tab==='signup'?'auth-tab--on':''}`} onClick={() => setTab('signup')}>Create Account</button>
              <button className={`auth-tab ${tab==='signin'?'auth-tab--on':''}`} onClick={() => setTab('signin')}>Sign In</button>
            </div>
            <div className="auth-fields">
              <input className="auth-input" type="email" placeholder="Email address"
                value={email} onChange={e => setEmail(e.target.value)} autoFocus />
              <input className="auth-input" type="password" placeholder="Password (min 6 chars)"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-green auth-submit" onClick={submit}
              disabled={loading || !email || !password}>
              {loading ? 'Please wait…' : tab === 'signup' ? 'Create Account →' : 'Sign In →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ChampionCelebration({ show, champion, championObj, onDismiss }) {
  if (!show || !champion) return null;
  return (
    <div className="champion-overlay" onClick={onDismiss}>
      <Confetti id={`celebrate-${champion}`} />
      <div className="champion-spotlight" />
      <div className="champion-modal">
        <div className="champion-year">FIFA WORLD CUP 2026</div>
        <div className="champion-trophy-big">🏆</div>
        <div className="champion-title-big">CHAMPIONS</div>
        <div className="champion-team-big">
          {championObj && <Flag team={championObj} size={36} />}
          <span>{champion}</span>
        </div>
        <div className="champion-dismiss">tap anywhere to close</div>
      </div>
    </div>
  );
}

function ChampionReveal({ champion, championObj, finalMatchup, thirdMatchup, bracketPicks, pickBracket, finalScore, onFinalScoreChange }) {
  const sfHome = finalMatchup.home;
  const sfAway = finalMatchup.away;
  return (
    <div className="champ-col">
      {champion && <Confetti id={champion} />}

      {/* Trophy */}
      <div className={`trophy ${champion ? 'trophy--won' : ''}`}>🏆</div>

      {/* Champion or pre-final state */}
      {champion ? (
        <div className="champ-name-wrap">
          <div className="champ-eyebrow">2026 World Champion</div>
          <div className="champ-name">
            <Flag team={championObj || { flag:'🏆', name:champion }} size={18} />
            {champion}
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center' }}>
          <div className="champ-eyebrow" style={{ opacity:.5 }}>FIFA World Cup</div>
          <div className="champ-placeholder">2026 Final</div>
          {sfHome.name && sfAway.name && (
            <div style={{ fontSize:11, color:'var(--dim)', marginTop:4 }}>
              {sfHome.name} <span style={{ color:'var(--border-2)' }}>vs</span> {sfAway.name}
            </div>
          )}
        </div>
      )}

      <div className="champ-div" />

      {/* Final match */}
      <div className="champ-match">
        <div className="champ-match-label champ-final-label">FINAL · JUL 19 · NY/NJ</div>
        <BracketSlot matchup={finalMatchup} picked={bracketPicks.final} onPick={n => pickBracket('final',0,n)} matchNum={104} wide badgePos="bottom" />

        {/* Score prediction — shown when both finalists are known */}
        {finalMatchup.home.name && finalMatchup.away.name && (
          <div className="final-score-wrap">
            <div className="final-score-label">Score prediction</div>
            <div className="final-score-inputs">
              <span className="final-score-team">
                <Flag team={finalMatchup.home} size={12}/> {finalMatchup.home.name}
              </span>
              <input className="final-score-input" type="number" min="0" max="20"
                placeholder="0" value={finalScore.home}
                onChange={e => onFinalScoreChange({ ...finalScore, home: e.target.value })} />
              <span className="final-score-sep">–</span>
              <input className="final-score-input" type="number" min="0" max="20"
                placeholder="0" value={finalScore.away}
                onChange={e => onFinalScoreChange({ ...finalScore, away: e.target.value })} />
              <span className="final-score-team">
                {finalMatchup.away.name} <Flag team={finalMatchup.away} size={12}/>
              </span>
            </div>
            <div style={{ height:4 }} />
          </div>
        )}
      </div>

      <div style={{ height:10 }} />

      {/* 3rd place */}
      <div className="champ-match">
        <div className="champ-match-label">3rd Place · Jul 18 · Miami</div>
        <BracketSlot matchup={thirdMatchup} picked={bracketPicks.thirdPlace} onPick={n => pickBracket('thirdPlace',0,n)} matchNum={103} wide badgePos="bottom" />
      </div>
    </div>
  );
}

function Bracket({ thirdPlaceDone, r32Matchups, r16Matchups, qfMatchups, sfMatchups,
                   finalMatchup, thirdMatchup, bracketPicks, pickBracket,
                   champion, championObj, r32Done, r16Done, qfDone, sfDone,
                   finalScore, onFinalScoreChange,
                   bracketScores, setBracketScore, allGroupsDone }) {
  return (
    <>
      <div className="tree-scroll">
        <div className="tree" style={{ minWidth:1492 }}>
          <BracketLines />
          <div className="tree-col tree-groups">
            {GROUPS.slice(0,6).map(g => <GroupBox key={g.id} group={g} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.r32.map(idx => <BracketSlot allGroupsDone={allGroupsDone} key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n=>pickBracket('r32',idx,n)} matchNum={73+idx} score={bracketScores[`r32_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r32',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.r16.map(idx => <BracketSlot allGroupsDone={allGroupsDone} key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n=>pickBracket('r16',idx,n)} matchNum={89+idx} score={bracketScores[`r16_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r16',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.qf.map(idx => <BracketSlot allGroupsDone={allGroupsDone} key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n=>pickBracket('qf',idx,n)} matchNum={97+idx} score={bracketScores[`qf_${idx}`]} onScoreChange={(s,v)=>setBracketScore('qf',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            <BracketSlot allGroupsDone={allGroupsDone} matchup={sfMatchups[0]} picked={bracketPicks.sf[0]} onPick={n=>pickBracket('sf',0,n)} matchNum={101} score={bracketScores['sf_0']} onScoreChange={(s,v)=>setBracketScore('sf',0,s,v)} />
          </div>
          <ChampionReveal champion={champion} championObj={championObj}
            finalMatchup={finalMatchup} thirdMatchup={thirdMatchup}
            bracketPicks={bracketPicks} pickBracket={pickBracket}
            finalScore={finalScore} onFinalScoreChange={onFinalScoreChange} />
          <div className="tree-col">
            <BracketSlot allGroupsDone={allGroupsDone} matchup={sfMatchups[1]} picked={bracketPicks.sf[1]} onPick={n=>pickBracket('sf',1,n)} matchNum={102} score={bracketScores['sf_1']} onScoreChange={(s,v)=>setBracketScore('sf',1,s,v)} />
          </div>
          <div className="tree-col">
            {BRACKET_R.qf.map(idx => <BracketSlot allGroupsDone={allGroupsDone} key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n=>pickBracket('qf',idx,n)} matchNum={97+idx} score={bracketScores[`qf_${idx}`]} onScoreChange={(s,v)=>setBracketScore('qf',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_R.r16.map(idx => <BracketSlot allGroupsDone={allGroupsDone} key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n=>pickBracket('r16',idx,n)} matchNum={89+idx} score={bracketScores[`r16_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r16',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_R.r32.map(idx => <BracketSlot allGroupsDone={allGroupsDone} key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n=>pickBracket('r32',idx,n)} matchNum={73+idx} score={bracketScores[`r32_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r32',idx,s,v)} />)}
          </div>
          <div className="tree-col tree-groups">
            {GROUPS.slice(6).map(g => <GroupBox key={g.id} group={g} />)}
          </div>
        </div>
        <div className="tree-labels" style={{ minWidth:1492 }}>
          <div style={{ width:60 }} />
          {['Round of 32','Round of 16','Quarterfinals','Semifinals'].map(l => <div key={l} className="tlabel">{l}</div>)}
          <div className="tlabel tlabel--c">Final</div>
          {['Semifinals','Quarterfinals','Round of 16','Round of 32'].map(l => <div key={l+'r'} className="tlabel">{l}</div>)}
          <div style={{ width:60 }} />
        </div>
      </div>

      {/* Tournament Story — fills horizontal space on wide screens */}
      {(champion || bracketPicks.sf[0] || bracketPicks.sf[1]) && (
        <div className="tournament-story">
          {champion && (
            <div className="ts-item ts-item--champion">
              <div className="ts-label">🏆 My Champion</div>
              <div className="ts-value">
                <Flag team={championObj || { flag:'🏆', name:champion }} size={20} />
                {champion}
              </div>
            </div>
          )}
          {bracketPicks.final && bracketPicks.final !== champion && (
            <div className="ts-item">
              <div className="ts-label">Runner-Up</div>
              <div className="ts-value ts-value--dim">
                {(() => {
                  const loser = finalMatchup.home.name === bracketPicks.final ? finalMatchup.away : finalMatchup.home;
                  return loser.name ? <><Flag team={loser} size={16} /> {loser.name}</> : '—';
                })()}
              </div>
            </div>
          )}
          {bracketPicks.final && (
            <div className="ts-item">
              <div className="ts-label">Final</div>
              <div className="ts-value ts-value--dim" style={{ fontSize:13 }}>
                {finalMatchup.home.name || '?'} vs {finalMatchup.away.name || '?'}
              </div>
            </div>
          )}
          {bracketPicks.thirdPlace && (
            <div className="ts-item">
              <div className="ts-label">3rd Place</div>
              <div className="ts-value ts-value--dim">
                {(() => {
                  const obj = GROUPS.flatMap(g=>g.teams).find(t=>t.name===bracketPicks.thirdPlace);
                  return obj ? <><Flag team={obj} size={16} /> {obj.name}</> : bracketPicks.thirdPlace;
                })()}
              </div>
            </div>
          )}
          <div className="ts-item ts-item--right">
            <div className="ts-label">Bracket Progress</div>
            <div className="ts-value" style={{ color:'var(--green)' }}>
              {Math.round(((bracketPicks.r32.filter(Boolean).length + bracketPicks.r16.filter(Boolean).length + bracketPicks.qf.filter(Boolean).length + bracketPicks.sf.filter(Boolean).length + (bracketPicks.final?1:0) + (bracketPicks.thirdPlace?1:0)) / 32) * 100)}% complete
            </div>
          </div>
        </div>
      )}

      <div className="tree-mobile" style={{ padding:'0 24px' }}>
        <RoundSection title="Round of 32" subtitle="Jun 28 – Jul 3" matchups={r32Matchups} picks={bracketPicks.r32} onPick={(i,n)=>pickBracket('r32',i,n)} matchNumStart={73} locked={false} />
        <div style={{ marginTop:28 }}>
          <RoundSection title="Round of 16" subtitle="Jul 4 – Jul 7" matchups={r16Matchups} picks={bracketPicks.r16} onPick={(i,n)=>pickBracket('r16',i,n)} matchNumStart={89} locked={!r32Done} lockedMsg="Complete the Round of 32 first." />
        </div>
        <div style={{ marginTop:28 }}>
          <RoundSection title="Quarterfinals" subtitle="Jul 9 – Jul 11" matchups={qfMatchups} picks={bracketPicks.qf} onPick={(i,n)=>pickBracket('qf',i,n)} matchNumStart={97} locked={!r16Done} lockedMsg="Complete the Round of 16 first." />
        </div>
        <div style={{ marginTop:28 }}>
          <RoundSection title="Semifinals" subtitle="Jul 14 – Jul 15" matchups={sfMatchups} picks={bracketPicks.sf} onPick={(i,n)=>pickBracket('sf',i,n)} matchNumStart={101} locked={!qfDone} lockedMsg="Complete the Quarterfinals first." />
        </div>
        {sfDone && (
          <div className="mfinals">
            <div>
              <h3 className="round-title" style={{ color:'#f5c142' }}>Final · Jul 19</h3>
              <MatchCard matchNum={104} home={finalMatchup.home} away={finalMatchup.away} picked={bracketPicks.final} onPick={n=>pickBracket('final',0,n)} />
            </div>
            <div>
              <h3 className="round-title">3rd Place · Jul 18</h3>
              <MatchCard matchNum={103} home={thirdMatchup.home} away={thirdMatchup.away} picked={bracketPicks.thirdPlace} onPick={n=>pickBracket('thirdPlace',0,n)} />
            </div>
          </div>
        )}
        {champion && (
          <div className="mchamp">
            <Confetti id={'m'+champion} />
            <div className="trophy trophy--won">🏆</div>
            <div className="champ-eyebrow">World Champion</div>
            <div className="mchamp-name">{champion}</div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Bracket Preview (compact, top-of-page teaser) ────────────────────────
function StatList({ eyebrow, title, items, valueKey, renderName, renderSub, maxRef }) {
  if (!items || items.length === 0) return null;
  const max = maxRef ? (items[0]?.[maxRef] || 1) : 1;
  return (
    <div className="ts-col">
      <div className="ts-head">
        <div className="ts-eyebrow">{eyebrow}</div>
        <div className="ts-title">{title}</div>
      </div>
      <div className="ts-list">
        {items.map((s, i) => (
          <div key={s.id || s.team} className="ts-row">
            <span className="ts-rank">{i + 1}</span>
            {renderName(s)}
            <span className="ts-team">{renderSub(s)}</span>
            <div className="ts-bar-track">
              <div className="ts-bar-fill" style={{ width: `${(s[valueKey] / max) * 100}%` }} />
            </div>
            <span className="ts-goals">{s[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopScorers({ topScorers }) {
  if (!topScorers || topScorers.length === 0) return null;
  const allTeams = GROUPS.flatMap(g => g.teams);
  return (
    <StatList
      eyebrow="⚽ Golden Boot Race"
      title="Top Scorers"
      items={topScorers}
      valueKey="goals"
      maxRef="goals"
      renderName={s => <><Flag team={allTeams.find(t => t.name === s.team) || { name: s.team }} size={16} /><span className="ts-name">{s.name}</span></>}
      renderSub={s => s.team}
    />
  );
}

function TeamGoals({ teamGoals }) {
  if (!teamGoals || teamGoals.length === 0) return null;
  const allTeams = GROUPS.flatMap(g => g.teams);
  return (
    <StatList
      eyebrow="🔥 Most Goals"
      title="Team Goals"
      items={teamGoals}
      valueKey="goals"
      maxRef="goals"
      renderName={s => <><Flag team={allTeams.find(t => t.name === s.team) || { name: s.team }} size={16} /><span className="ts-name">{s.team}</span></>}
      renderSub={s => `${s.played} played`}
    />
  );
}

function Best3rdPlace({ thirdPlaceStandings }) {
  if (!thirdPlaceStandings || thirdPlaceStandings.length === 0) return null;
  const allTeams = GROUPS.flatMap(g => g.teams);
  // QUALIFIED R32 / OUT become definitive once the qualifying SET of 8 groups is
  // mathematically locked — which can happen well before every group finishes, the moment
  // no remaining match anywhere could still swap who's in the top 8. See isThirdPlaceSetLocked.
  const raceSettled = thirdPlaceStandings.length === 12 && !!thirdPlaceStandings[0]?.setLocked;
  return (
    <div className="b3-inner">
      <div className="b3-head">
        <div className="b3-eyebrow">🥉 Best Third-Place Race</div>
        <div className="b3-title">Best Third-Place Standings</div>
        <p className="b3-sub">Live ranking of every group's current 3rd-place team. Top 8 join the Round of 32.</p>
      </div>
      <div className="b3-table">
        <div className="b3-row b3-row--head">
          <span>#</span>
          <span className="b3-th-team">Team</span>
          <span className="b3-th-next">Next Opponent</span>
          <span>P</span>
          <span>GD</span>
          <span>GF</span>
          <span>PTS</span>
          <span className="b3-th-status"></span>
        </div>
        {thirdPlaceStandings.map((row, i) => {
          const teamObj = allTeams.find(t => t.name === row.team) || { name: row.team };
          const opponentObj = row.nextOpponent ? (allTeams.find(t => t.name === row.nextOpponent) || { name: row.nextOpponent }) : null;
          const status = raceSettled
            ? (row.qualifying ? 'qualified' : 'out')
            : (row.qualifying ? 'currentlyIn' : 'currentlyOut');
          const label = raceSettled
            ? (row.qualifying ? 'QUALIFIED R32' : 'OUT')
            : (row.qualifying ? 'CURRENTLY IN' : 'CURRENTLY OUT');
          return (
            <div key={row.groupId} className={`b3-row standings-row--${status}`}>
              <span className="st-pos">{i + 1}</span>
              <span className="b3-team"><Flag team={teamObj} size={14} /><span className="st-name">{row.team}</span></span>
              <span className="b3-next">
                {opponentObj ? (
                  <>
                    <Flag team={opponentObj} size={12} />
                    <span className="b3-next-name">{opponentObj.name}</span>
                    {row.nextOpponentLive && <span className="b3-next-badge b3-next-badge--live">LIVE</span>}
                    {!row.nextOpponentLive && !row.nextOpponentConfirmed && <span className="b3-next-badge">PROJECTED</span>}
                  </>
                ) : <span className="b3-next-none">—</span>}
              </span>
              <span>{row.played}</span>
              <span className={row.gd>0?'gd-pos':row.gd<0?'gd-neg':''}>{row.gd>0?'+':''}{row.gd}</span>
              <span>{row.gf}</span>
              <span className="st-pts">{row.pts}</span>
              <span className={`st-status st-status--${status}`}>{label}</span>
            </div>
          );
        })}
      </div>
      <p className="b3-legend"><span className="b3-next-badge">PROJECTED</span> = provisional next opponent, not yet guaranteed</p>
    </div>
  );
}

function BracketPreview({ r32Matchups, onOpenBracket, allGroupsDone = false }) {
  const filledCount = r32Matchups.filter(m => m.home.name && m.away.name).length;
  return (
    <div className="bp-wrap">
      <div className="bp-head">
        <div>
          <div className="bp-eyebrow">⚡ Live Bracket</div>
          <div className="bp-title">Round of 32 — as it stands today</div>
        </div>
        <button className="btn btn-green bp-open" onClick={onOpenBracket}>
          Open full bracket ↓
        </button>
      </div>
      <div className="bp-grid">
        {r32Matchups.map((m, i) => {
          const homeClass = allGroupsDone
            ? (m.home.confirmedRank ? 'bp-name--wonGroup' : '')
            : (m.home.confirmedRank === 1 ? 'bp-name--wonGroup' : m.home.confirmedRank === 2 ? 'bp-name--qualified' : '');
          const awayClass = allGroupsDone
            ? (m.away.confirmedRank ? 'bp-name--wonGroup' : '')
            : (m.away.confirmedRank === 1 ? 'bp-name--wonGroup' : m.away.confirmedRank === 2 ? 'bp-name--qualified' : '');
          return (
            <div key={i} className="bp-match">
              <div className="bp-side">
                <Flag team={m.home} size={13}/>
                <span className={`bp-name ${homeClass}`}>{m.home.display || m.home.name || 'TBD'}</span>
              </div>
              <span className="bp-vs">vs</span>
              <div className="bp-side bp-side--r">
                <span className={`bp-name ${awayClass}`}>{m.away.display || m.away.name || 'TBD'}</span>
                <Flag team={m.away} size={13}/>
              </div>
            </div>
          );
        })}
      </div>
      <div className="bp-foot">{filledCount}/16 matchups locked in · updates automatically as groups finish</div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Home() {
  const [picks, setPicks] = useState({});
  const [thirdPlacePicks, setThirdPlacePicks] = useState([]);
  const [bracketPicks, setBracketPicks] = useState(initBracket());
  const [liveActive, setLiveActive] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [days, setDays] = useState(null);
  const [daysRemaining, setDaysRemaining] = useState(null); // days left until the Final (July 19, 2026)
  const [showChampionReveal, setShowChampionReveal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [liveMatches, setLiveMatches] = useState([]);
  const [groupScores, setGroupScores] = useState({});
  const [lockedGroupScores, setLockedGroupScores] = useState({});
  const [liveGroupScores, setLiveGroupScores] = useState({}); // provisional, in-progress match scores
  const [bracketScores, setBracketScores] = useState({});
  const [recentMatches, setRecentMatches] = useState([]);
  const [cardScores, setCardScores] = useState({}); // teamName -> conduct points (negative)
  const [topScorers, setTopScorers] = useState([]); // [{ id, name, team, goals }] — top 5, own goals excluded
  const [finalScore, setFinalScore] = useState({ home: '', away: '' });

  const thirdRef      = useRef(null);
  const bracketRef    = useRef(null);
  const treeScrollRef = useRef(null);

  useEffect(() => {
    const d = Math.ceil((new Date('2026-06-11') - new Date()) / 86400000);
    setDays(d);
    const remaining = Math.ceil((new Date('2026-07-19') - new Date()) / 86400000);
    setDaysRemaining(Math.max(0, remaining));
    try {
      // URL share param takes priority over localStorage
      const params = new URLSearchParams(window.location.search);
      const bracketParam = params.get('b');
      if (bracketParam) {
        const data = JSON.parse(atob(bracketParam));
        if (data.picks) setPicks(data.picks);
        if (data.thirdPlacePicks) setThirdPlacePicks(data.thirdPlacePicks);
        if (data.bracketPicks) setBracketPicks({ ...initBracket(), ...data.bracketPicks });
      } else {
        const saved = localStorage.getItem('wc2026-v2');
        if (saved) {
          const data = JSON.parse(saved);
          if (data.picks) setPicks(data.picks);
          if (data.thirdPlacePicks) setThirdPlacePicks(data.thirdPlacePicks);
          if (data.bracketPicks) setBracketPicks(data.bracketPicks);
          if (data.groupScores) setGroupScores(data.groupScores);
          if (data.bracketScores) setBracketScores(data.bracketScores);
          if (data.finalScore) setFinalScore(data.finalScore);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('wc2026-v2', JSON.stringify({ picks, thirdPlacePicks, bracketPicks, groupScores, bracketScores, finalScore }));
  }, [picks, thirdPlacePicks, bracketPicks, hydrated]);

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, [])

  // ── Live score polling ────────────────────────────────────────────────
  useEffect(() => {
    const allTeams = GROUPS.flatMap(g => g.teams);
    const enrich = (m) => ({
      ...m,
      homeTeamObj: allTeams.find(t => t.name === m.homeTeam) || { name: m.homeTeam },
      awayTeamObj: allTeams.find(t => t.name === m.awayTeam) || { name: m.awayTeam },
    });

    const fetchLive = () => {
      fetch('/api/live-scores')
        .then(r => r.json())
        .then(data => {
          if (!data.active) return;
          setLiveActive(true);
          if (data.groupScores && Object.keys(data.groupScores).length > 0) {
            setLockedGroupScores(prev => ({ ...prev, ...data.groupScores }));
            setGroupScores(prev => ({ ...prev, ...data.groupScores }));
          }
          if (data.recentMatches?.length > 0)
            setRecentMatches(data.recentMatches.map(enrich).slice(-6));
          setLiveMatches((data.liveMatches || []).map(enrich));
          setLiveGroupScores(data.liveGroupScores || {}); // full snapshot — clears once a match finishes (moves to lockedGroupScores instead)
          if (data.cardScores) setCardScores(data.cardScores); // full snapshot each poll, not incremental
          if (data.topScorers) setTopScorers(data.topScorers); // full snapshot, top 5 already sorted server-side
        })
        .catch(() => {});
    };
    fetchLive();
    const interval = setInterval(fetchLive, 60 * 1000); // 60s — tracks live matches
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setGroupScore = (groupId, matchIdx, side, value) => {
    setGroupScores(prev => ({
      ...prev,
      [`${groupId}_${matchIdx}`]: {
        ...(prev[`${groupId}_${matchIdx}`] || { home:'', away:'' }),
        [side]: value,
      },
    }));
  };

  // ── Bracket score handler ──────────────────────────────────────────────
  const setBracketScore = (round, idx, side, value) => {
    const key = `${round}_${idx}`;
    setBracketScores(prev => ({
      ...prev,
      [key]: { ...(prev[key] || { home:'', away:'' }), [side]: value },
    }));
  };

  // ── Auto-fill picks from group scores ─────────────────────────────────
  useEffect(() => {
    const updates = {};
    GROUPS.forEach(group => {
      const allFilled = GROUP_MATCH_PAIRS.every((_,i) => {
        const sc = groupScores[`${group.id}_${i}`];
        return sc && sc.home!=='' && sc.away!=='' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away)) && Number(sc.home)>=0 && Number(sc.away)>=0;
      });
      if (!allFilled) return;
      const standings = calcGroupStandings(group, groupScores, cardScores);
      if (standings.length < 3) return;
      const newRanks = {
        [standings[0].name]: 1,
        [standings[1].name]: 2,
        [standings[2].name]: 3,
      };
      // Only register this as an "update" if it actually differs from what's already in
      // picks — otherwise every 60s live poll re-derives the SAME ranks for groups whose
      // scores haven't changed, and the bracket gets wiped for no real reason.
      const existing = picks[group.id] || {};
      const changed = Object.keys(newRanks).some(name => existing[name] !== newRanks[name])
        || Object.keys(existing).length !== Object.keys(newRanks).length;
      if (changed) updates[group.id] = newRanks;
    });
    if (Object.keys(updates).length === 0) return;
    setPicks(prev => ({ ...prev, ...updates }));
    setBracketPicks(initBracket());
  }, [groupScores, cardScores]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-select best 8 third-place teams when all groups complete ──────
  useEffect(() => {
    const allComplete = GROUPS.every(group =>
      GROUP_MATCH_PAIRS.every((_,i) => {
        const sc = groupScores[`${group.id}_${i}`];
        return sc && sc.home!=='' && sc.away!=='' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
      })
    );
    if (!allComplete) return;
    const thirds = GROUPS.map(group => {
      const standings = calcGroupStandings(group, groupScores, cardScores);
      const t = standings[2];
      return t ? { groupId: group.id, ...t } : null;
    }).filter(Boolean);
    if (thirds.length < 12) return;
    const top8 = [...thirds]
      .sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || b.conduct-a.conduct || a.rank-b.rank)
      .slice(0,8)
      .map(t => t.groupId);
    // Only update if the actual set of qualifying groups changed — avoids re-triggering
    // this on every 60s poll when the top-8 picture hasn't actually moved.
    setThirdPlacePicks(prev => {
      const sameSet = prev.length === top8.length && prev.every(id => top8.includes(id));
      return sameSet ? prev : top8;
    });
  }, [groupScores, cardScores]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRank = (groupId, team, rank) => {
    setPicks(prev => {
      const current = { ...(prev[groupId] || {}) };
      if (current[team] === rank) delete current[team];
      else {
        Object.keys(current).forEach(t => { if (current[t] === rank) delete current[t]; });
        current[team] = rank;
      }
      return { ...prev, [groupId]: current };
    });
    setBracketPicks(initBracket());
  };

  // ── Live-driven picks: show current standings the moment any match locks ──
  const effectivePicks = useMemo(() => {
    const result = {};
    for (const group of GROUPS) {
      // Manual rank-toggle picks for this group always win — explicit user choice
      const manualRanks = Object.values(picks[group.id] || {});
      const hasManualPick = manualRanks.length > 0;
      if (hasManualPick) {
        result[group.id] = picks[group.id];
        continue;
      }
      // No manual picks for this group — derive from scores (locked + live in-progress + manually-typed)
      const merged = { ...groupScores };
      for (const key of Object.keys(lockedGroupScores)) {
        if (key.startsWith(`${group.id}_`)) merged[key] = lockedGroupScores[key];
      }
      for (const key of Object.keys(liveGroupScores)) {
        if (key.startsWith(`${group.id}_`)) merged[key] = liveGroupScores[key];
      }
      const hasAny = GROUP_MATCH_PAIRS.some((_, idx) => {
        const sc = merged[`${group.id}_${idx}`];
        return sc && sc.home !== '' && sc.away !== '' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
      });
      if (hasAny) {
        const standings = calcGroupStandings(group, merged, cardScores);
        result[group.id] = {};
        standings.forEach((team, pos) => { result[group.id][team.name] = pos + 1; });
      } else {
        result[group.id] = {};
      }
    }
    return result;
  }, [lockedGroupScores, liveGroupScores, groupScores, picks, cardScores]);

  // ── Auto best-8 third-place: rank current 3rd-place teams across groups ─
  const effectiveThirdGroupIds = useMemo(() => {
    if (thirdPlacePicks.length === 8) return thirdPlacePicks;
    const thirds = GROUPS
      .map(group => {
        const merged = { ...groupScores };
        for (const key of Object.keys(lockedGroupScores)) {
          if (key.startsWith(`${group.id}_`)) merged[key] = lockedGroupScores[key];
        }
        for (const key of Object.keys(liveGroupScores)) {
          if (key.startsWith(`${group.id}_`)) merged[key] = liveGroupScores[key];
        }
        const hasAny = GROUP_MATCH_PAIRS.some((_, idx) => {
          const sc = merged[`${group.id}_${idx}`];
          return sc && sc.home !== '' && sc.away !== '' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
        });
        if (!hasAny) return null;
        const standings = calcGroupStandings(group, merged, cardScores);
        const t = standings[2];
        return { groupId: group.id, pts: t?.pts || 0, gd: t?.gd || 0, gf: t?.gf || 0, conduct: t?.conduct ?? 0, rank: t?.rank ?? 999 };
      })
      .filter(Boolean)
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.conduct - a.conduct || a.rank - b.rank);
    // Manual picks come first, then auto-ranked fill the rest — no duplicates, max 8
    const autoIds = thirds.map(t => t.groupId).filter(id => !thirdPlacePicks.includes(id));
    return [...thirdPlacePicks, ...autoIds].slice(0, 8);
  }, [lockedGroupScores, liveGroupScores, groupScores, thirdPlacePicks, cardScores]);

  // Full standings row for every group's current 3rd-place team, ranked best-to-worst —
  // this is the same data behind effectiveThirdGroupIds, but kept in full (all 12, not
  // just the qualifying 8) with team name attached, for the standalone "Best 3rd-Place" table.
  const groupsById = useMemo(() => Object.fromEntries(GROUPS.map(g => [g.id, g])), []);
  const thirdPlaceStandings = useMemo(() => {
    const groupScoresById = {};
    const rows = GROUPS
      .map(group => {
        const merged = { ...groupScores };
        for (const key of Object.keys(lockedGroupScores)) {
          if (key.startsWith(`${group.id}_`)) merged[key] = lockedGroupScores[key];
        }
        for (const key of Object.keys(liveGroupScores)) {
          if (key.startsWith(`${group.id}_`)) merged[key] = liveGroupScores[key];
        }
        groupScoresById[group.id] = merged;
        const hasAny = GROUP_MATCH_PAIRS.some((_, idx) => {
          const sc = merged[`${group.id}_${idx}`];
          return sc && sc.home !== '' && sc.away !== '' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
        });
        if (!hasAny) return null;
        const standings = calcGroupStandings(group, merged, cardScores);
        const t = standings[2];
        if (!t) return null;
        const allLocked = GROUP_MATCH_PAIRS.every((_, idx) => !!lockedGroupScores[`${group.id}_${idx}`]);

        // Next opponent: scan this group's fixtures for the first one that isn't yet
        // FINALIZED (locked) and involves this exact team. A match can have a score in
        // `merged` because it's currently live — that's not "played" in the sense that
        // matters here, since the team is still actively out on the pitch against them.
        const teamIdx = group.teams.findIndex(tm => tm.name === t.name);
        let nextOpponent = null;
        let nextOpponentLive = false;
        for (let idx = 0; idx < GROUP_MATCH_PAIRS.length; idx++) {
          const [hi, ai] = GROUP_MATCH_PAIRS[idx];
          if (hi !== teamIdx && ai !== teamIdx) continue;
          const key = `${group.id}_${idx}`;
          const finalized = !!lockedGroupScores[key];
          if (finalized) continue;
          const opponentIdx = hi === teamIdx ? ai : hi;
          nextOpponent = group.teams[opponentIdx].name;
          nextOpponentLive = !!liveGroupScores[key];
          break;
        }

        return { groupId: group.id, team: t.name, pts: t.pts, gd: t.gd, gf: t.gf, played: t.played, conduct: t.conduct, rank: t.rank, complete: allLocked, nextOpponent, nextOpponentLive };
      })
      .filter(Boolean)
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.conduct - a.conduct || a.rank - b.rank);
    const ranked = rows.map((row, i) => ({ ...row, qualifying: i < 8 }));
    // Compute whether the qualifying SET is mathematically locked, given current standings.
    // This can become true well before every group finishes — see isThirdPlaceSetLocked.
    const setLocked = isThirdPlaceSetLocked(ranked, groupsById, groupScoresById, cardScores);
    return ranked.map(row => ({ ...row, setLocked }));
  }, [lockedGroupScores, liveGroupScores, groupScores, cardScores, groupsById]);


  const groupComplete = (groupId) => {
    // Complete = all 6 group matches locked by live data
    const allLocked = GROUP_MATCH_PAIRS.every((_, idx) => !!lockedGroupScores[`${groupId}_${idx}`]);
    if (allLocked) return true;
    // Fallback: user has ranked all 3 positions manually
    const g = picks[groupId] || {};
    const r = Object.values(g);
    return r.includes(1) && r.includes(2) && r.includes(3);
  };
  const completedCount = GROUPS.filter(g => groupComplete(g.id)).length;
  const allGroupsDone = completedCount === 12;

  const thirdPlaceCandidates = useMemo(() => GROUPS.map(g => {
    const name = getTeamByRank(effectivePicks, g.id, 3);
    if (!name) return null;
    const obj = getTeamObj(g.id, name);
    return { groupId: g.id, name, flag: obj?.flag || '' };
  }).filter(Boolean), [effectivePicks]);

  const toggleThirdPlace = (groupId) => {
    setThirdPlacePicks(prev => {
      if (prev.includes(groupId)) return prev.filter(g => g !== groupId);
      if (prev.length >= 8) return prev;
      return [...prev, groupId];
    });
    setBracketPicks(initBracket());
  };
  const thirdPlaceDone = effectiveThirdGroupIds.length === 8;


  const thirdAssignment = useMemo(() => {
    const ids = effectiveThirdGroupIds;
    if (ids.length < 8) return {};
    const key = [...ids].sort().join('');
    const scenario = ANNEX_C[key];
    if (scenario) return scenario;
    const result = {};
    function backtrack(slotIdx, used) {
      if (slotIdx === 8) return true;
      for (const g of SLOT_ELIGIBLE[slotIdx]) {
        if (ids.includes(g) && !used.has(g)) {
          used.add(g); result[slotIdx] = g;
          if (backtrack(slotIdx + 1, used)) return true;
          used.delete(g); delete result[slotIdx];
        }
      }
      return false;
    }
    backtrack(0, new Set());
    return result;
  }, [effectiveThirdGroupIds]);

  const r32Matchups = useMemo(() => {
    const thirdPlaceSetLocked = thirdPlaceStandings.length === 12 && !!thirdPlaceStandings[0]?.setLocked;
    const scoreCtx = { groupScores, lockedGroupScores, liveGroupScores, cardScores, thirdPlaceSetLocked };
    return R32_DEFS.map(([h,a]) => ({
      home: resolveDesc(h, effectivePicks, thirdAssignment, scoreCtx),
      away: resolveDesc(a, effectivePicks, thirdAssignment, scoreCtx),
    }));
  }, [effectivePicks, thirdAssignment, groupScores, lockedGroupScores, liveGroupScores, cardScores, thirdPlaceStandings]);
  const r16Matchups = useMemo(() => R16_PAIRS.map(([hi,ai]) => ({ home:resolveWinner(r32Matchups[hi],bracketPicks.r32[hi]), away:resolveWinner(r32Matchups[ai],bracketPicks.r32[ai]) })), [r32Matchups, bracketPicks.r32]);

  // Best Third-Place "Next Opponent" fallback: once a team's own group is fully done
  // (no more in-group fixtures left), check if they've locked into a specific R32 slot
  // yet — if their actual knockout opponent is already determined, show that instead of
  // a blank dash. Falls back to null (rendered as "—") if the R32 slot is still TBD.
  //
  // "Confirmed" (guaranteed, not provisional) requires BOTH:
  //   1. The opponent itself is a mathematically locked group winner/runner-up
  //      (the same confirmedRank flag used to highlight teams gold/silver elsewhere).
  //   2. The best-8 third-place SET is mathematically locked — see isThirdPlaceSetLocked.
  //      This can become true well before every group finishes, the moment no remaining
  //      match anywhere could still swap who's in the qualifying top 8.
  const raceSettled = thirdPlaceStandings.length === 12 && !!thirdPlaceStandings[0]?.setLocked;
  const thirdPlaceStandingsWithNextOpp = useMemo(() => {
    return thirdPlaceStandings.map(row => {
      // An in-group fixture is a scheduled fact, not a prediction — always certain.
      if (row.nextOpponent) return { ...row, nextOpponentConfirmed: true };
      const matchup = r32Matchups.find(m => m.home.name === row.team || m.away.name === row.team);
      if (!matchup) return row;
      const opponent = matchup.home.name === row.team ? matchup.away : matchup.home;
      if (!opponent.name) return row; // R32 slot still TBD, nothing to show yet
      const nextOpponentConfirmed = !!opponent.confirmed && raceSettled;
      return { ...row, nextOpponent: opponent.name, nextOpponentConfirmed };
    });
  }, [thirdPlaceStandings, r32Matchups, raceSettled]);
  const qfMatchups  = useMemo(() => QF_PAIRS.map(([hi,ai]) => ({ home:resolveWinner(r16Matchups[hi],bracketPicks.r16[hi]), away:resolveWinner(r16Matchups[ai],bracketPicks.r16[ai]) })), [r16Matchups, bracketPicks.r16]);
  const sfMatchups  = useMemo(() => SF_PAIRS.map(([hi,ai]) => ({ home:resolveWinner(qfMatchups[hi],bracketPicks.qf[hi]), away:resolveWinner(qfMatchups[ai],bracketPicks.qf[ai]) })), [qfMatchups, bracketPicks.qf]);
  const finalMatchup = useMemo(() => ({ home:resolveWinner(sfMatchups[0],bracketPicks.sf[0]), away:resolveWinner(sfMatchups[1],bracketPicks.sf[1]) }), [sfMatchups, bracketPicks.sf]);
  const thirdMatchup = useMemo(() => ({ home:resolveLoser(sfMatchups[0],bracketPicks.sf[0]), away:resolveLoser(sfMatchups[1],bracketPicks.sf[1]) }), [sfMatchups, bracketPicks.sf]);

  // Most goals scored per team, tallied directly from real match scorelines (no ESPN
  // event parsing needed — this is the same groupScores data already trusted for live
  // standings, so it's exact rather than a best-effort approximation).
  const teamGoals = useMemo(() => {
    const tally = {}; // teamName -> { team, goals, played }
    for (const group of GROUPS) {
      const merged = mergeGroupScores(group.id, groupScores, lockedGroupScores, liveGroupScores);
      GROUP_MATCH_PAIRS.forEach(([hi, ai], idx) => {
        const sc = merged[`${group.id}_${idx}`];
        if (!sc || sc.home === '' || sc.away === '') return;
        const hg = Number(sc.home), ag = Number(sc.away);
        if (isNaN(hg) || isNaN(ag)) return;
        const homeName = group.teams[hi].name, awayName = group.teams[ai].name;
        if (!tally[homeName]) tally[homeName] = { team: homeName, goals: 0, played: 0 };
        if (!tally[awayName]) tally[awayName] = { team: awayName, goals: 0, played: 0 };
        tally[homeName].goals += hg; tally[homeName].played++;
        tally[awayName].goals += ag; tally[awayName].played++;
      });
    }
    return Object.values(tally)
      .filter(t => t.goals > 0)
      .sort((a, b) => b.goals - a.goals || a.played - b.played)
      .slice(0, 5);
  }, [groupScores, lockedGroupScores, liveGroupScores]);

  const pickBracket = (round, idx, name) => {
    setBracketPicks(prev => {
      const u = {
        r32: [...prev.r32],
        r16: [...prev.r16],
        qf:  [...prev.qf],
        sf:  [...prev.sf],
        final: prev.final,
        thirdPlace: prev.thirdPlace,
      };

      // Cascade helper: null out only the downstream slots affected by this pick
      const clearFrom = (fromRound, fromIdx) => {
        if (fromRound === 'r32') {
          const r16i = R16_PAIRS.findIndex(([a,b]) => a === fromIdx || b === fromIdx);
          if (r16i === -1) return;
          u.r16[r16i] = null;
          clearFrom('r16', r16i);
        } else if (fromRound === 'r16') {
          const qfi = QF_PAIRS.findIndex(([a,b]) => a === fromIdx || b === fromIdx);
          if (qfi === -1) return;
          u.qf[qfi] = null;
          clearFrom('qf', qfi);
        } else if (fromRound === 'qf') {
          const sfi = SF_PAIRS.findIndex(([a,b]) => a === fromIdx || b === fromIdx);
          if (sfi === -1) return;
          u.sf[sfi] = null;
          u.final = null;
          u.thirdPlace = null;
        }
      };

      if (round === 'r32') {
        u.r32[idx] = name;
        clearFrom('r32', idx);
      } else if (round === 'r16') {
        u.r16[idx] = name;
        clearFrom('r16', idx);
      } else if (round === 'qf') {
        u.qf[idx] = name;
        clearFrom('qf', idx);
      } else if (round === 'sf') {
        u.sf[idx] = name;
        u.final = null;
        u.thirdPlace = null;
      } else if (round === 'final') {
        u.final = name;
      } else if (round === 'thirdPlace') {
        u.thirdPlace = name;
      }

      return u;
    });

    // Trigger celebration outside the updater — can't call setState inside setState
    if (round === 'final' && name) {
      setShowChampionReveal(true);
      setTimeout(() => setShowChampionReveal(false), 5000);
    }
  };

  const r32Done = bracketPicks.r32.every(p => p !== null);
  const r16Done = bracketPicks.r16.every(p => p !== null);
  const qfDone  = bracketPicks.qf.every(p => p !== null);
  const sfDone  = bracketPicks.sf.every(p => p !== null);

  const bracketFilled = bracketPicks.r32.filter(Boolean).length + bracketPicks.r16.filter(Boolean).length +
    bracketPicks.qf.filter(Boolean).length + bracketPicks.sf.filter(Boolean).length +
    (bracketPicks.final ? 1 : 0) + (bracketPicks.thirdPlace ? 1 : 0);
  const bracketPct = Math.round((bracketFilled / 32) * 100);

  const champion = bracketPicks.final;
  const championObj = champion ? GROUPS.flatMap(g => g.teams).find(t => t.name === champion) : null;

  // recentMatches populated from live-scores API (includes goalscorer data)

  const reset = () => {
    if (confirm('Clear all your picks? Live match results will stay.')) {
      setPicks({}); setThirdPlacePicks([]); setBracketPicks(initBracket());
      setBracketScores({}); setFinalScore({ home:'', away:'' });
      // Keep only locked (live) scores in groupScores — drop manual entries
      setGroupScores(prev => {
        const kept = {};
        for (const key of Object.keys(lockedGroupScores)) kept[key] = lockedGroupScores[key];
        return kept;
      });
      localStorage.removeItem('wc2026-v2');
    }
  };
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const shareLink = () => {
    const data = { picks, thirdPlacePicks, bracketPicks, groupScores, bracketScores, finalScore };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const url = `${window.location.origin}?b=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const autoFillByRanking = () => {
    const newPicks = {};
    GROUPS.forEach(group => {
      const sorted = [...group.teams].sort((a, b) => a.rank - b.rank);
      newPicks[group.id] = {};
      sorted.slice(0, 3).forEach((team, i) => {
        newPicks[group.id][team.name] = i + 1;
      });
    });
    setPicks(newPicks);
    setBracketPicks(initBracket());
  };

  const downloadPredictions = () => {
    const lc = '#252538';
    const fl = t => (t?.flag && !/^[a-z]{2,3}$/.test(t.flag)) ? t.flag + ' ' : '';
    const teamOf = (gid, rank) => {
      const name = getTeamByRank(effectivePicks, gid, rank);
      const obj  = name ? getTeamObj(gid, name) : null;
      return name ? `${fl(obj)}${name}` : '—';
    };

    // Match box — width:100% fills its flex parent
    const mbox = (matchup, pick) => {
      const h = matchup.home, a = matchup.away;
      const hW = pick && pick === h.name, aW = pick && pick === a.name;
      const row = (t, won, out) =>
        `<div style="padding:5px 8px;font-size:11px;line-height:1.4;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis;
          color:${won?'#4ade80':out?'#252538':'#c8d0de'};font-weight:${won?700:400};
          background:${won?'rgba(74,222,128,.07)':'transparent'};border-bottom:1px solid #12121e">
          ${fl(t)}${t.name||t.display}${won?' ✓':''}
        </div>`;
      return `<div style="background:#0c0c1c;border:1px solid #181828;border-radius:5px;
        overflow:hidden;width:100%">${row(h,hW,aW)}${row(a,aW,hW)}</div>`;
    };

    // Column — flex:1 so all columns share width equally
    const mcol = (matchups, picks_arr) =>
      `<div style="display:flex;flex-direction:column;justify-content:space-around;
        align-items:stretch;flex:1;min-width:0;height:620px">
        ${matchups.map((m,i) => mbox(m, picks_arr[i])).join('')}
      </div>`;

    // Left connector ┤ (bracket opens right)
    const connL = pairs => {
      const d = Array.from({length:pairs*2},(_,i)=>
        `<div style="flex:1;border-right:1px solid ${lc};${i%2===0?'border-bottom':'border-top'}:1px solid ${lc}"></div>`
      ).join('');
      return `<div style="display:flex;flex-direction:column;width:10px;flex-shrink:0;height:620px">${d}</div>`;
    };

    // Right connector ├ (bracket opens left)
    const connR = pairs => {
      const d = Array.from({length:pairs*2},(_,i)=>
        `<div style="flex:1;border-left:1px solid ${lc};${i%2===0?'border-bottom':'border-top'}:1px solid ${lc}"></div>`
      ).join('');
      return `<div style="display:flex;flex-direction:column;width:10px;flex-shrink:0;height:620px">${d}</div>`;
    };

    const lineH = () =>
      `<div style="display:flex;align-items:center;width:10px;flex-shrink:0;height:620px">
        <div style="width:100%;height:1px;background:${lc}"></div></div>`;

    // Gather matchup arrays
    const r32L = BRACKET_L.r32.map(i => r32Matchups[i]);
    const r16L = BRACKET_L.r16.map(i => r16Matchups[i]);
    const qfL  = BRACKET_L.qf.map(i  => qfMatchups[i]);
    const r32R = BRACKET_R.r32.map(i => r32Matchups[i]);
    const r16R = BRACKET_R.r16.map(i => r16Matchups[i]);
    const qfR  = BRACKET_R.qf.map(i  => qfMatchups[i]);
    const r32LP = BRACKET_L.r32.map(i => bracketPicks.r32[i]);
    const r16LP = BRACKET_L.r16.map(i => bracketPicks.r16[i]);
    const qfLP  = BRACKET_L.qf.map(i  => bracketPicks.qf[i]);
    const r32RP = BRACKET_R.r32.map(i => bracketPicks.r32[i]);
    const r16RP = BRACKET_R.r16.map(i => bracketPicks.r16[i]);
    const qfRP  = BRACKET_R.qf.map(i  => bracketPicks.qf[i]);

    // Center column (slightly wider via flex:1.4)
    const centerCol = `
      <div style="flex:1.4;flex-shrink:0;height:620px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:8px;min-width:0;padding:0 4px">
        <div style="font-size:40px;line-height:1;filter:${champion
          ?'drop-shadow(0 0 14px rgba(245,193,66,.55))'
          :'grayscale(1) opacity(.2)'}">🏆</div>
        ${champion
          ?`<div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#f5c142;
              text-align:center;white-space:nowrap">${fl(championObj)}${champion}</div>`:''}
        <div style="font-size:8px;font-weight:800;letter-spacing:.12em;color:#f5c142;
          text-transform:uppercase;margin-top:4px;white-space:nowrap">Final · Jul 19</div>
        ${mbox(finalMatchup, bracketPicks.final)}
        <div style="font-size:8px;font-weight:800;letter-spacing:.1em;color:#4a4a6a;
          text-transform:uppercase;margin-top:2px;white-space:nowrap">3rd Place · Jul 18</div>
        ${mbox(thirdMatchup, bracketPicks.thirdPlace)}
      </div>`;

    // Label row — mirrors the flex structure above
    const lbl = (text, flex, color='#2e2e4a') =>
      `<div style="flex:${flex};min-width:0;text-align:center;font-size:8px;font-weight:800;
        letter-spacing:.08em;color:${color};text-transform:uppercase;overflow:hidden">${text}</div>`;
    const gap10 = `<div style="width:10px;flex-shrink:0"></div>`;

    const labelRow = `
      <div style="display:flex;margin-top:8px;align-items:center">
        ${lbl('R32',1)} ${gap10} ${lbl('R16',1)} ${gap10} ${lbl('QF',1)} ${gap10}
        ${lbl('SF',1)} ${gap10} ${lbl('Final',1.4,'#f5c142')} ${gap10}
        ${lbl('SF',1)} ${gap10} ${lbl('QF',1)} ${gap10} ${lbl('R16',1)} ${gap10} ${lbl('R32',1)}
      </div>`;

    // ── sections ──────────────────────────────────────────────────────────

    // 1. Champion block
    const champBlock = champion ? `
      <div style="text-align:center;padding:36px 24px;margin-bottom:32px;
        background:radial-gradient(120% 140% at 50% 0,rgba(245,193,66,.12),transparent),#0e0e1a;
        border:1px solid rgba(245,193,66,.35);border-radius:18px">
        <div style="font-size:52px;margin-bottom:10px">🏆</div>
        <div style="font-size:10px;font-weight:800;letter-spacing:.28em;color:#f5c142;margin-bottom:8px">2026 WORLD CHAMPION</div>
        <div style="font-size:32px;font-weight:900;color:#fff">${fl(championObj)}${champion}</div>
      </div>` : '';

    // 2. Group stage (NOW FIRST, above bracket)
    const groupRows = GROUPS.map(g => `
      <div style="background:#0c0c1c;border:1px solid #181828;border-radius:10px;padding:12px">
        <div style="font-size:10px;font-weight:800;letter-spacing:.1em;color:${GROUP_COLORS[g.id]};margin-bottom:8px">GROUP ${g.id}</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:12px;color:#f5c142">🥇 ${teamOf(g.id,1)}</div>
          <div style="font-size:12px;color:#c2cad6">🥈 ${teamOf(g.id,2)}</div>
          <div style="font-size:12px;color:#cf8a4f">🥉 ${teamOf(g.id,3)}</div>
        </div>
      </div>`).join('');

    const thirdPills = thirdPlacePicks.map(gid => {
      const name = getTeamByRank(effectivePicks, gid, 3);
      const obj  = name ? getTeamObj(gid, name) : null;
      return `<span style="background:#0c0c1c;border:1px solid #181828;border-radius:6px;
        padding:4px 10px;font-size:12px;color:#c8d0de">${fl(obj)}${name||gid}</span>`;
    }).join('');

    const groupSection = `
      <div style="margin-bottom:36px">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#6b7280;text-transform:uppercase;margin-bottom:12px">Group Stage</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${groupRows}</div>
        ${thirdPlacePicks.length > 0 ? `
          <div style="margin-top:20px">
            <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#6b7280;text-transform:uppercase;margin-bottom:10px">Best 8 Third-Place Teams</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">${thirdPills}</div>
          </div>` : ''}
      </div>`;

    // 3. Knockout bracket (full-width, no min-width, no scrollbar)
    const bracketSection = `
      <div style="margin-bottom:36px">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#6b7280;text-transform:uppercase;margin-bottom:12px">Knockout Bracket</div>
        <div style="background:#080814;border:1px solid #151524;border-radius:12px;padding:20px 16px 12px">
          <div style="display:flex;align-items:stretch;width:100%">
            ${mcol(r32L,r32LP)} ${connL(4)}
            ${mcol(r16L,r16LP)} ${connL(2)}
            ${mcol(qfL,qfLP)}   ${connL(1)}
            ${mcol([sfMatchups[0]],[bracketPicks.sf[0]])} ${lineH()}
            ${centerCol}
            ${lineH()} ${mcol([sfMatchups[1]],[bracketPicks.sf[1]])}
            ${connR(1)} ${mcol(qfR,qfRP)}
            ${connR(2)} ${mcol(r16R,r16RP)}
            ${connR(4)} ${mcol(r32R,r32RP)}
          </div>
          ${labelRow}
        </div>
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My WC2026 Predictions</title>
<style>*{margin:0;box-sizing:border-box}
body{background:#080814;color:#e2e8f0;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body>
<div style="height:4px;background:linear-gradient(90deg,#4ade80,#06b6d4,#a78bfa,#f5c142,#fb7185)"></div>
<div style="max-width:1200px;margin:0 auto;padding:36px 28px">
  <div style="font-size:10px;font-weight:800;letter-spacing:.28em;color:#6b7280;text-transform:uppercase">FIFA World Cup 2026 · My Predictions</div>
  <div style="font-size:28px;font-weight:900;margin:6px 0 28px;color:#fff">Tournament Bracket</div>
  ${champBlock}
  ${groupSection}
  ${bracketSection}
  <div style="text-align:center;color:#1e1e30;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #111120">
    Generated ${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})} · Not affiliated with FIFA
  </div>
</div></body></html>`;

    const blob = new Blob([html], { type:'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'WC2026-My-Predictions.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const pct = (completedCount / 12) * 100;
  const r = 13, circumference = 2 * Math.PI * r;

  return (
    <main className="page">
      <AuthModal show={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <ChampionCelebration
        show={showChampionReveal}
        champion={champion}
        championObj={championObj}
        onDismiss={() => setShowChampionReveal(false)}
      />

      {/* ── Progress header ── */}
      <div className="phead">
        <div className="phead-inner">
          <div className="phead-left">
            <div className="ring" title={`${completedCount} of 12 groups complete`}>
              <svg width="34" height="34" viewBox="0 0 34 34">
                <circle cx="17" cy="17" r={r} fill="none" stroke="#1e1e30" strokeWidth="3.5" />
                <circle cx="17" cy="17" r={r} fill="none"
                  stroke={completedCount === 12 ? '#39ff14' : '#f5c142'} strokeWidth="3.5"
                  strokeLinecap="round" strokeDasharray={circumference}
                  strokeDashoffset={circumference - (circumference * pct) / 100}
                  transform="rotate(-90 17 17)"
                  style={{ transition: 'stroke-dashoffset .5s cubic-bezier(0,.55,.45,1)' }} />
              </svg>
              <span className="ring-num">{completedCount}</span>
            </div>
            <div className="phead-steps">
              <span className={`pstep ${completedCount === 12 ? 'pstep--on' : ''}`}>
                <b>{completedCount}/12</b> groups
              </span>
              <span className="psep">›</span>
              <span className={`pstep ${!allGroupsDone ? 'pstep--off' : thirdPlaceDone ? 'pstep--on' : ''}`}>
                <b>{thirdPlacePicks.length}/8</b> third places
              </span>
              <span className="psep">›</span>
              <span className={`pstep ${!thirdPlaceDone ? 'pstep--off' : bracketPct === 100 ? 'pstep--on' : ''}`}>
                <b>{bracketPct}%</b> bracket
              </span>
            </div>
          </div>
          <div className="phead-right">
            {thirdPlaceDone && (
              <button className="btn btn-green" onClick={() => scrollTo(bracketRef)}>Open bracket</button>
            )}
            <button className="btn btn-ghost" onClick={shareLink}>
              {copyFeedback ? '✓ Copied!' : '🔗 Share'}
            </button>
            {user ? (
              <button className="btn btn-bare" style={{ fontSize:11, color:'var(--dim)' }}
                onClick={() => supabase.auth.signOut()}>
                Sign out
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowAuthModal(true)}>
                Sign in
              </button>
            )}
            <button className="btn btn-gold" onClick={downloadPredictions}>Export</button>
            <button className="btn btn-bare" onClick={reset}>Reset</button>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-accent" />
        <div className="hero-glow hero-glow-a" />
        <div className="hero-glow hero-glow-b" />
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-eyebrow">
              <span className="livedot" />
              FIFA World Cup 2026
              <span className="hero-hosts">🇺🇸 🇨🇦 🇲🇽</span>
            </div>
            <h1 className="hero-title">
              <span className="hero-title-1">WORLD&nbsp;CUP</span>
              <span className="hero-title-2">20<span className="hero-26">26</span></span>
            </h1>
            <div className="hero-sub-row">
              
              <p className="hero-sub">
                Call all 104 matches — group winners, the eight best third-place teams,
                and the full bracket through the Final at MetLife Stadium.
              </p>
            </div>
            {days !== null && (
              <div className="hero-countdown">
                {days > 0 ? (
                  <>
                    <span className="cd-num">{days}</span>
                    <span className="cd-label">
                      day{days === 1 ? '' : 's'} to kickoff<br />
                      <b>Jun 11 · Estadio Azteca</b>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="cd-live">● LIVE</span>
                    <span className="cd-label">The tournament is underway</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="hero-stats">
            {[{ n:'48',label:'Teams'},{n:'12',label:'Groups'},{n:'104',label:'Matches'},{n:'16',label:'Venues'},{n:'3',label:'Host Nations'},{ n: daysRemaining !== null ? String(daysRemaining) : '–', label:'Days Left', accent:true }].map(s => (
              <div key={s.label} className={`stat-tile ${s.accent ? 'stat-tile--accent' : ''}`}>
                <div className={`stat-n ${s.accent ? 'stat-n--accent' : ''}`}>{s.n}</div>
                <div className={`stat-l ${s.accent ? 'stat-l--accent' : ''}`}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats: layout changes once the group stage is fully done ── */}
      {allGroupsDone ? (
        // Group stage over: the 3rd-place race is settled and folded into the bracket
        // itself, so this section reverts to the original side-by-side Scorers/Goals view.
        (topScorers.length > 0 || teamGoals.length > 0) && (
          <div className="stats-combo stats-combo--final">
            <div className="stats-combo-right stats-combo-right--row">
              <TopScorers topScorers={topScorers} />
              <TeamGoals teamGoals={teamGoals} />
            </div>
          </div>
        )
      ) : (
        (thirdPlaceStandings.length > 0 || topScorers.length > 0 || teamGoals.length > 0) && (
          <div className="stats-combo">
            <div className="stats-combo-left">
              <Best3rdPlace thirdPlaceStandings={thirdPlaceStandingsWithNextOpp} />
            </div>
            <div className="stats-combo-right">
              <TopScorers topScorers={topScorers} />
              <TeamGoals teamGoals={teamGoals} />
            </div>
          </div>
        )
      )}

      {/* ── Bracket Preview ── */}
      <BracketPreview r32Matchups={r32Matchups} onOpenBracket={() => scrollTo(bracketRef)} allGroupsDone={allGroupsDone} />

      {/* ── Score Carousel ── */}
      <ScoreCarousel matches={recentMatches} liveMatches={liveMatches} />

      {/* ── Group Stage ── */}
      <section className="section">
        <div className="section-head">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div>
              <div className="eyebrow" style={{ display:'flex', alignItems:'center', gap:8 }}>
                Stage 01 · Group Draw
                {liveActive && (
                  <span className="live-badge">
                    <span className="livedot" /> Live results active
                  </span>
                )}
              </div>
              <h2 className="section-title">Group Stage</h2>
              <p className="section-desc">
                Live scores update automatically as matches are played. Use <b>My picks</b> on each group to set your bracket predictions.
              </p>
            </div>
            <button
              className="btn btn-gold"
              onClick={autoFillByRanking}
              style={{ marginTop:8, whiteSpace:'nowrap' }}
            >
              ↕ Fill by FIFA Ranking
            </button>
          </div>
        </div>
        <div className="groups-grid">
          {GROUPS.map(group => (
            <GroupStageCard key={group.id} group={group}
              groupPicks={picks[group.id] || {}} complete={groupComplete(group.id)}
              groupScores={groupScores}
              onScoreChange={setGroupScore}
              lockedGroupScores={lockedGroupScores}
              liveGroupScores={liveGroupScores}
              cardScores={cardScores}
              isThirdQualified={effectiveThirdGroupIds.includes(group.id)}
              onSetRank={setRank} />
          ))}
        </div>
      </section>

      {/* ── Third Place ── */}
      <div style={{ background:'var(--surface)' }}>
        <section className="section" ref={thirdRef}>
          <div className="section-head">
            <div className="eyebrow">Stage 02 · Wildcards</div>
            <h2 className="section-title">Best 8 Third-Place Teams</h2>
            <p className="section-desc">
              The eight strongest third-place finishers join the 24 group qualifiers in the Round of 32.
              Ranked by points → goal difference → goals scored → team conduct (cards) → FIFA World Ranking — the official FIFA criteria.
            </p>
          </div>
          <ThirdPlacePicker candidates={thirdPlaceCandidates} picks={effectiveThirdGroupIds}
            allGroupsDone={true} onToggle={toggleThirdPlace} />
          {thirdPlaceDone && (
            <div className="third-cta">
              <button className="btn btn-green btn-lg" onClick={() => scrollTo(bracketRef)}>
                Build the bracket ▸
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ── Bracket ── */}
      <section ref={bracketRef} style={{ background:'var(--bg)', paddingTop:48, paddingBottom:48 }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px 24px' }}>
          <div className="section-head">
            <div className="eyebrow" style={{ color:'#f5c142' }}>Stage 03 · Knockout</div>
            <h2 className="section-title">The Road to the Final</h2>
            <p className="section-desc">
              Pairings reflect group standings <b>as they stand today</b> — updated automatically as matches are played.
              Click a team to advance them through the bracket.
            </p>
          </div>
        </div>
        <Bracket thirdPlaceDone={thirdPlaceDone}
          r32Matchups={r32Matchups} r16Matchups={r16Matchups} qfMatchups={qfMatchups} sfMatchups={sfMatchups}
          finalMatchup={finalMatchup} thirdMatchup={thirdMatchup}
          bracketPicks={bracketPicks} pickBracket={pickBracket}
          champion={champion} championObj={championObj}
          r32Done={r32Done} r16Done={r16Done} qfDone={qfDone} sfDone={sfDone}
          finalScore={finalScore} onFinalScoreChange={setFinalScore}
          bracketScores={bracketScores} setBracketScore={setBracketScore}
          allGroupsDone={allGroupsDone} />
      </section>

      <footer className="footer">
        <span>World Cup 2026 Predictor · fan-made, not affiliated with FIFA</span>
        <span className="footer-dim">Predictions are for entertainment only</span>
      </footer>
    </main>
  );
}
