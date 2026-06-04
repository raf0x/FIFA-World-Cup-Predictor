'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { GROUPS } from '../lib/groups';
import { ANNEX_C } from '../lib/annex_c';
import { MATCH_SCHEDULE } from '../lib/schedule';

// ─── Bracket constants (official FIFA 2026 Annex C) ─────────────────────────

// R32 matchup definitions (matches 73-88 in order)
// type: 'group' = group position; type: 'third' = best 3rd-place slot
const R32_DEFS = [
  [{ type: 'group', group: 'A', rank: 2 }, { type: 'group', group: 'B', rank: 2 }],                    // M73
  [{ type: 'group', group: 'E', rank: 1 }, { type: 'third', slotIdx: 0, eligible: ['A','B','C','D','F'] }], // M74
  [{ type: 'group', group: 'F', rank: 1 }, { type: 'group', group: 'C', rank: 2 }],                    // M75
  [{ type: 'group', group: 'C', rank: 1 }, { type: 'group', group: 'F', rank: 2 }],                    // M76
  [{ type: 'group', group: 'I', rank: 1 }, { type: 'third', slotIdx: 1, eligible: ['C','D','F','G','H'] }], // M77
  [{ type: 'group', group: 'E', rank: 2 }, { type: 'group', group: 'I', rank: 2 }],                    // M78
  [{ type: 'group', group: 'A', rank: 1 }, { type: 'third', slotIdx: 2, eligible: ['C','E','F','H','I'] }], // M79
  [{ type: 'group', group: 'L', rank: 1 }, { type: 'third', slotIdx: 3, eligible: ['E','H','I','J','K'] }], // M80
  [{ type: 'group', group: 'D', rank: 1 }, { type: 'third', slotIdx: 4, eligible: ['B','E','F','I','J'] }], // M81
  [{ type: 'group', group: 'G', rank: 1 }, { type: 'third', slotIdx: 5, eligible: ['A','E','H','I','J'] }], // M82
  [{ type: 'group', group: 'K', rank: 2 }, { type: 'group', group: 'L', rank: 2 }],                    // M83
  [{ type: 'group', group: 'H', rank: 1 }, { type: 'group', group: 'J', rank: 2 }],                    // M84
  [{ type: 'group', group: 'B', rank: 1 }, { type: 'third', slotIdx: 6, eligible: ['E','F','G','I','J'] }], // M85
  [{ type: 'group', group: 'J', rank: 1 }, { type: 'group', group: 'H', rank: 2 }],                    // M86
  [{ type: 'group', group: 'K', rank: 1 }, { type: 'third', slotIdx: 7, eligible: ['D','E','I','J','L'] }], // M87
  [{ type: 'group', group: 'D', rank: 2 }, { type: 'group', group: 'G', rank: 2 }],                    // M88
];

// Which R32 match indices feed each R16 match
const R16_PAIRS = [[1,4],[0,2],[3,5],[6,7],[10,11],[8,9],[13,15],[12,14]];
// M74vM77, M73vM75, M76vM78, M79vM80, M83vM84, M81vM82, M86vM88, M85vM87

// Which R16 match indices feed each QF
const QF_PAIRS = [[0,1],[4,5],[2,3],[6,7]];
// R16[0]vR16[1], R16[4]vR16[5], R16[2]vR16[3], R16[6]vR16[7]

// Which QF indices feed each SF
const SF_PAIRS = [[0,1],[2,3]];

const RANK_LABELS = { 1: '1st', 2: '2nd', 3: '3rd' };
const FINISH_BADGE = {
  1: 'bg-amber-200 text-amber-900',
  2: 'bg-slate-200 text-slate-700',
  3: 'bg-orange-200 text-orange-900',
  4: 'bg-stone-200 text-stone-500',
};
const RANK_COLORS = {
  1: 'bg-amber-50 ring-amber-300 text-amber-900',
  2: 'bg-slate-50 ring-slate-300 text-slate-700',
  3: 'bg-orange-50 ring-orange-200 text-orange-900',
};

const initBracket = () => ({
  r32: Array(16).fill(null),
  r16: Array(8).fill(null),
  qf: Array(4).fill(null),
  sf: Array(2).fill(null),
  final: null,
  thirdPlace: null,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTeamByRank(picks, groupId, rank) {
  const p = picks[groupId] || {};
  return Object.keys(p).find(t => p[t] === rank) || null;
}

function getTeamObj(groupId, name) {
  return GROUPS.find(g => g.id === groupId)?.teams.find(t => t.name === name) || null;
}

// Greedy assignment of user-selected 3rd-place groups to bracket slots
const SLOT_ELIGIBLE = [
  ['A','B','C','D','F'],
  ['C','D','F','G','H'],
  ['C','E','F','H','I'],
  ['E','H','I','J','K'],
  ['B','E','F','I','J'],
  ['A','E','H','I','J'],
  ['E','F','G','I','J'],
  ['D','E','I','J','L'],
];

function assign3rdPlace(thirdPlacePicks) {
  const result = {};

  function backtrack(slotIdx, used) {
    if (slotIdx === 8) return true;
    for (const g of SLOT_ELIGIBLE[slotIdx]) {
      if (thirdPlacePicks.includes(g) && !used.has(g)) {
        used.add(g);
        result[slotIdx] = g;
        if (backtrack(slotIdx + 1, used)) return true;
        used.delete(g);
        delete result[slotIdx];
      }
    }
    return false;
  }

  backtrack(0, new Set());
  return result;
}

// Teams split for the visual hero banner (Groups A-F left, G-L right)
const LEFT_TEAMS = GROUPS.slice(0, 6).flatMap(g => g.teams);
const RIGHT_TEAMS = GROUPS.slice(6).flatMap(g => g.teams);

// Visual bracket column ordering (matches the official FIFA bracket tree structure)
const BRACKET_L = { r32:[1,4,0,2,10,11,8,9], r16:[0,1,4,5], qf:[0,1], sf:[0] };
const BRACKET_R = { r32:[3,5,6,7,12,14,13,15], r16:[2,3,7,6], qf:[2,3], sf:[1] };

// Group box colors for the bracket
const GROUP_COLORS = {
  A:'#22c55e',B:'#ef4444',C:'#f97316',D:'#3b82f6',
  E:'#a855f7',F:'#06b6d4',G:'#ec4899',H:'#14b8a6',
  I:'#8b5cf6',J:'#eab308',K:'#f97316',L:'#0ea5e9',
};

function resolveDesc(desc, picks, thirdAssignment) {
  if (desc.type === 'group') {
    const name = getTeamByRank(picks, desc.group, desc.rank);
    if (!name) return { name: null, flag: null, display: `${desc.rank}${desc.group}` };
    const obj = getTeamObj(desc.group, name);
    return { name, flag: obj?.flag || '', display: name };
  }
  // type: 'third'
  const groupId = thirdAssignment[desc.slotIdx];
  if (!groupId) return { name: null, flag: null, display: `3 ${desc.eligible.join('')}` };
  const name = getTeamByRank(picks, groupId, 3);
  if (!name) return { name: null, flag: null, display: `3 ${groupId}` };
  const obj = getTeamObj(groupId, name);
  return { name, flag: obj?.flag || '', display: name };
}

function resolveWinner(matchup, pickedName) {
  if (!pickedName) return { name: null, flag: null, display: 'TBD' };
  const side = matchup.home.name === pickedName ? matchup.home : matchup.away;
  return side.name ? side : { name: pickedName, flag: null, display: pickedName };
}

function resolveLoser(matchup, pickedName) {
  if (!pickedName) return { name: null, flag: null, display: 'TBD' };
  const loser = matchup.home.name === pickedName ? matchup.away : matchup.home;
  return loser.name ? loser : { name: null, flag: null, display: 'TBD' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MatchCard({ matchNum, home, away, picked, onPick }) {
  const bothKnown = home.name && away.name;
  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      {matchNum && (
        <div className="px-3 py-1 bg-stone-50 border-b border-stone-100 text-xs text-stone-500 font-medium">
          Match {matchNum}
        </div>
      )}
      <div className="divide-y divide-stone-100">
        {[home, away].map((team, i) => {
          const isHome = i === 0;
          const isPicked = team.name !== null && picked === team.name;
          const isOther = picked && picked !== team.name;
          return (
            <button
              key={i}
              onClick={() => bothKnown && team.name && onPick(isPicked ? null : team.name)}
              disabled={!bothKnown || !team.name}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                isPicked
                  ? 'bg-emerald-50 text-emerald-900 font-semibold'
                  : isOther
                  ? 'bg-white text-stone-400'
                  : bothKnown && team.name
                  ? 'hover:bg-stone-50 text-stone-800'
                  : 'text-stone-400 cursor-default'
              }`}
            >
              <span className="text-base shrink-0">{team.flag || '?'}</span>
              <span className="text-sm flex-1 truncate">{team.display}</span>
              {isPicked && <span className="text-xs text-emerald-600 shrink-0">Advances</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoundSection({ title, subtitle, matchups, picks, onPick, matchNumStart, locked, lockedMsg }) {
  if (locked) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-500 text-sm">
        {lockedMsg}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-xl font-bold">{title}</h3>
        {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {matchups.map((m, i) => (
          <MatchCard
            key={i}
            matchNum={matchNumStart ? matchNumStart + i : null}
            home={m.home}
            away={m.away}
            picked={picks[i]}
            onPick={(name) => onPick(i, name)}
          />
        ))}
      </div>
    </div>
  );
}

// Colored group box (used in visual bracket sides)
function GroupBox({ group }) {
  return (
    <div className="rounded-lg p-1.5 flex-shrink-0" style={{ backgroundColor: GROUP_COLORS[group.id], width: '60px' }}>
      <div className="grid grid-cols-2 gap-0.5 mb-1">
        {group.teams.map((t, i) => (
          <div key={i} className="flex items-center justify-center bg-black/20 rounded-sm" style={{ height: '22px', fontSize: '13px' }}>
            {t.flag}
          </div>
        ))}
      </div>
      <div className="text-white text-center font-black uppercase" style={{ fontSize: '7px', letterSpacing: '0.08em' }}>
        Group {group.id}
      </div>
    </div>
  );
}

// Compact interactive match slot for the visual bracket tree
function BracketSlot({ matchup, picked, onPick, matchNum }) {
  const { home, away } = matchup;
  const bothKnown = home.name && away.name;
  const info = matchNum ? MATCH_SCHEDULE[matchNum] : null;
  const title = info ? `M${matchNum} · ${info.date} · ${info.time} · ${info.venue}` : undefined;
  return (
    <div className="flex-shrink-0 rounded overflow-hidden border border-stone-700 bg-stone-800" style={{ width: '110px' }} title={title}>
      {[home, away].map((team, i) => {
        const isPicked = team.name !== null && picked === team.name;
        const isOther = picked && picked !== team.name;
        return (
          <button
            key={i}
            onClick={() => bothKnown && team.name && onPick(isPicked ? null : team.name)}
            disabled={!bothKnown || !team.name}
            className={`w-full flex items-center gap-1 px-1.5 py-1.5 border-t first:border-t-0 border-stone-700 transition text-left ${
              isPicked ? 'bg-emerald-700 text-white' :
              isOther ? 'text-stone-600' :
              bothKnown && team.name ? 'hover:bg-stone-700 text-stone-300' :
              'text-stone-600 cursor-default'
            }`}
            style={{ fontSize: '10px' }}
          >
            <span className="shrink-0" style={{ fontSize: '11px' }}>{team.flag || ''}</span>
            <span className="truncate">{team.name || team.display}</span>
          </button>
        );
      })}
    </div>
  );
}

// SVG connector lines drawn over the bracket columns.
// Positions calculated from: justify-around in 544px, 110px slots, 6px gaps, 60px group boxes.
// Match center y formula: i*68 + 34 (R32), i*136 + 68 (R16), i*272 + 136 (QF), 272 (SF)
function BracketLines() {
  const s = '#52525b'; // stone-600
  const w = 2;
  const lines = [
    // Left R32 → R16  (vertical bracket at x=176, horizontal to x=182)
    [176,34,176,102],[176,68,182,68],
    [176,170,176,238],[176,204,182,204],
    [176,306,176,374],[176,340,182,340],
    [176,442,176,510],[176,476,182,476],
    // Left R16 → QF  (x=292 → x=298)
    [292,68,292,204],[292,136,298,136],
    [292,340,292,476],[292,408,298,408],
    // Left QF → SF  (x=408 → x=414)
    [408,136,408,408],[408,272,414,272],
    // Left SF → Center  (x=524 → x=530)
    [524,272,530,272],
    // Right R32 → R16  (vertical at x=1076, horizontal to x=1070)
    [1076,34,1076,102],[1070,68,1076,68],
    [1076,170,1076,238],[1070,204,1076,204],
    [1076,306,1076,374],[1070,340,1076,340],
    [1076,442,1076,510],[1070,476,1076,476],
    // Right R16 → QF  (x=960 → x=954)
    [960,68,960,204],[954,136,960,136],
    [960,340,960,476],[954,408,960,408],
    // Right QF → SF  (x=844 → x=838)
    [844,136,844,408],[838,272,844,272],
    // Right SF → Center  (x=728 → x=722)
    [728,272,722,272],
  ];
  return (
    <svg width="1252" height="544" className="absolute top-0 left-0 pointer-events-none" style={{ minWidth: 1252 }}>
      {lines.map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={s} strokeWidth={w} />
      ))}
    </svg>
  );
}

export default function Home() {
  const [picks, setPicks] = useState({});
  const [thirdPlacePicks, setThirdPlacePicks] = useState([]);
  const [bracketPicks, setBracketPicks] = useState(initBracket());
  const [analyses, setAnalyses] = useState({});
  const [loadingAnalysis, setLoadingAnalysis] = useState({});
  const [openGroup, setOpenGroup] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const thirdRef = useRef(null);
  const bracketRef = useRef(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wc2026-v2');
      if (saved) {
        const d = JSON.parse(saved);
        if (d.picks) setPicks(d.picks);
        if (d.thirdPlacePicks) setThirdPlacePicks(d.thirdPlacePicks);
        if (d.bracketPicks) setBracketPicks(d.bracketPicks);
        if (d.analyses) setAnalyses(d.analyses);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('wc2026-v2', JSON.stringify({ picks, thirdPlacePicks, bracketPicks, analyses }));
  }, [picks, thirdPlacePicks, bracketPicks, analyses, hydrated]);

  // ─── Group stage handlers ─────────────────────────────────────────────────

  const setRank = (groupId, team, rank) => {
    setPicks(prev => {
      const current = { ...(prev[groupId] || {}) };
      if (current[team] === rank) {
        delete current[team];
      } else {
        Object.keys(current).forEach(t => { if (current[t] === rank) delete current[t]; });
        current[team] = rank;
      }
      return { ...prev, [groupId]: current };
    });
    setBracketPicks(initBracket());
  };

  const groupComplete = (groupId) => {
    const g = picks[groupId] || {};
    const ranks = Object.values(g);
    return ranks.includes(1) && ranks.includes(2) && ranks.includes(3);
  };

  const completedCount = GROUPS.filter(g => groupComplete(g.id)).length;
  const allGroupsDone = completedCount === 12;

  // ─── Third place handlers ─────────────────────────────────────────────────

  const thirdPlaceCandidates = useMemo(() => {
    return GROUPS.map(g => {
      const name = getTeamByRank(picks, g.id, 3);
      if (!name) return null;
      const obj = getTeamObj(g.id, name);
      return { groupId: g.id, name, flag: obj?.flag || '' };
    }).filter(Boolean);
  }, [picks]);

  const toggleThirdPlace = (groupId) => {
    setThirdPlacePicks(prev => {
      if (prev.includes(groupId)) return prev.filter(g => g !== groupId);
      if (prev.length >= 8) return prev;
      return [...prev, groupId];
    });
    setBracketPicks(initBracket());
  };

  const thirdPlaceDone = thirdPlacePicks.length === 8;

  // ─── AI analysis ─────────────────────────────────────────────────────────

  const fetchAnalysis = async (groupId) => {
    const teams = GROUPS.find(g => g.id === groupId)?.teams.map(t => t.name) || [];
    setLoadingAnalysis(prev => ({ ...prev, [groupId]: true }));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, teams }),
      });
      const data = await res.json();
      setAnalyses(prev => ({ ...prev, [groupId]: data.result }));
    } catch {
      setAnalyses(prev => ({ ...prev, [groupId]: { summary: 'Analysis unavailable. Try again.', teams: [] } }));
    } finally {
      setLoadingAnalysis(prev => ({ ...prev, [groupId]: false }));
    }
  };

  // ─── Bracket computation ──────────────────────────────────────────────────

  // Assign 3rd-place teams to bracket slots using official FIFA Annex C table.
  // Falls back to backtracking (valid but not guaranteed to match exact FIFA
  // assignment) for the 113 combinations not yet in our partial table.
  const thirdAssignment = useMemo(() => {
    const key = [...thirdPlacePicks].sort().join('');
    const scenario = ANNEX_C[key];
    if (scenario) return scenario;

    // Backtracking fallback for combinations outside the partial table
    const result = {};
    function backtrack(slotIdx, used) {
      if (slotIdx === 8) return true;
      for (const g of SLOT_ELIGIBLE[slotIdx]) {
        if (thirdPlacePicks.includes(g) && !used.has(g)) {
          used.add(g); result[slotIdx] = g;
          if (backtrack(slotIdx + 1, used)) return true;
          used.delete(g); delete result[slotIdx];
        }
      }
      return false;
    }
    backtrack(0, new Set());
    return result;
  }, [thirdPlacePicks]);

  const r32Matchups = useMemo(() => {
    return R32_DEFS.map(([homeDef, awayDef]) => ({
      home: resolveDesc(homeDef, picks, thirdAssignment),
      away: resolveDesc(awayDef, picks, thirdAssignment),
    }));
  }, [picks, thirdAssignment]);

  const r16Matchups = useMemo(() => {
    return R16_PAIRS.map(([hi, ai]) => ({
      home: resolveWinner(r32Matchups[hi], bracketPicks.r32[hi]),
      away: resolveWinner(r32Matchups[ai], bracketPicks.r32[ai]),
    }));
  }, [r32Matchups, bracketPicks.r32]);

  const qfMatchups = useMemo(() => {
    return QF_PAIRS.map(([hi, ai]) => ({
      home: resolveWinner(r16Matchups[hi], bracketPicks.r16[hi]),
      away: resolveWinner(r16Matchups[ai], bracketPicks.r16[ai]),
    }));
  }, [r16Matchups, bracketPicks.r16]);

  const sfMatchups = useMemo(() => {
    return SF_PAIRS.map(([hi, ai]) => ({
      home: resolveWinner(qfMatchups[hi], bracketPicks.qf[hi]),
      away: resolveWinner(qfMatchups[ai], bracketPicks.qf[ai]),
    }));
  }, [qfMatchups, bracketPicks.qf]);

  const finalMatchup = useMemo(() => ({
    home: resolveWinner(sfMatchups[0], bracketPicks.sf[0]),
    away: resolveWinner(sfMatchups[1], bracketPicks.sf[1]),
  }), [sfMatchups, bracketPicks.sf]);

  const thirdPlaceMatchup = useMemo(() => ({
    home: resolveLoser(sfMatchups[0], bracketPicks.sf[0]),
    away: resolveLoser(sfMatchups[1], bracketPicks.sf[1]),
  }), [sfMatchups, bracketPicks.sf]);

  const pickBracket = (round, idx, name) => {
    setBracketPicks(prev => {
      const updated = { ...prev };
      // Clear downstream rounds when a pick changes
      if (round === 'r32') {
        updated.r32 = [...prev.r32]; updated.r32[idx] = name;
        updated.r16 = Array(8).fill(null);
        updated.qf = Array(4).fill(null);
        updated.sf = Array(2).fill(null);
        updated.final = null; updated.thirdPlace = null;
      } else if (round === 'r16') {
        updated.r16 = [...prev.r16]; updated.r16[idx] = name;
        updated.qf = Array(4).fill(null);
        updated.sf = Array(2).fill(null);
        updated.final = null; updated.thirdPlace = null;
      } else if (round === 'qf') {
        updated.qf = [...prev.qf]; updated.qf[idx] = name;
        updated.sf = Array(2).fill(null);
        updated.final = null; updated.thirdPlace = null;
      } else if (round === 'sf') {
        updated.sf = [...prev.sf]; updated.sf[idx] = name;
        updated.final = null; updated.thirdPlace = null;
      } else if (round === 'final') {
        updated.final = name;
      } else if (round === 'thirdPlace') {
        updated.thirdPlace = name;
      }
      return updated;
    });
  };

  const r32Done = bracketPicks.r32.every(p => p !== null);
  const r16Done = bracketPicks.r16.every(p => p !== null);
  const qfDone = bracketPicks.qf.every(p => p !== null);
  const sfDone = bracketPicks.sf.every(p => p !== null);

  const champion = bracketPicks.final;
  const championObj = champion
    ? GROUPS.flatMap(g => g.teams).find(t => t.name === champion)
    : null;

  const reset = () => {
    if (confirm('Clear all picks?')) {
      setPicks({}); setThirdPlacePicks([]); setBracketPicks(initBracket());
      setAnalyses({}); setOpenGroup(null);
    }
  };

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const downloadPredictions = () => {
    const teamOf = (groupId, rank) => {
      const name = getTeamByRank(picks, groupId, rank);
      const obj = name ? getTeamObj(groupId, name) : null;
      return name ? `${obj?.flag || ''} ${name}` : '—';
    };

    const roundName = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarterfinals', sf: 'Semifinals' };

    const bracketRow = (matchup, winner, label) => {
      if (!matchup.home.name && !matchup.away.name) return '';
      const home = matchup.home.name ? `${matchup.home.flag} ${matchup.home.name}` : matchup.home.display;
      const away = matchup.away.name ? `${matchup.away.flag} ${matchup.away.name}` : matchup.away.display;
      const w = winner ? `<span style="color:#6ee7b7;font-weight:700">${winner}</span>` : '<span style="color:#6b7280">TBD</span>';
      return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #1c1917">
        <span style="color:#a8a29e;font-size:11px;min-width:130px">${label}</span>
        <span style="flex:1;font-size:13px">${home} <span style="color:#57534e">vs</span> ${away}</span>
        <span style="font-size:12px">${w}</span>
      </div>`;
    };

    const allMatchups = [
      ...r32Matchups.map((m,i) => ({ matchup: m, winner: bracketPicks.r32[i], label: `R32 M${73+i}` })),
      ...r16Matchups.map((m,i) => ({ matchup: m, winner: bracketPicks.r16[i], label: `R16 M${89+i}` })),
      ...qfMatchups.map((m,i) => ({ matchup: m, winner: bracketPicks.qf[i], label: `QF M${97+i}` })),
      ...sfMatchups.map((m,i) => ({ matchup: m, winner: bracketPicks.sf[i], label: `SF M${101+i}` })),
      { matchup: finalMatchup, winner: bracketPicks.final, label: 'Final M104' },
      { matchup: thirdPlaceMatchup, winner: bracketPicks.thirdPlace, label: '3rd Place M103' },
    ];

    const groupRows = GROUPS.map(g => `
      <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.08em;margin-bottom:10px">GROUP ${g.id}</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <div style="font-size:12px"><span style="color:#fbbf24">🥇</span> ${teamOf(g.id,1)}</div>
          <div style="font-size:12px"><span style="color:#94a3b8">🥈</span> ${teamOf(g.id,2)}</div>
          <div style="font-size:12px"><span style="color:#cd7f32">🥉</span> ${teamOf(g.id,3)}</div>
        </div>
      </div>`).join('');

    const thirdRows = thirdPlacePicks.map(gid => {
      const name = getTeamByRank(picks, gid, 3);
      const obj = name ? getTeamObj(gid, name) : null;
      return `<span style="background:#1c1917;border:1px solid #292524;border-radius:6px;padding:5px 10px;font-size:12px">${obj?.flag || ''} ${name || gid}</span>`;
    }).join('');

    const championSection = champion ? `
      <div style="text-align:center;margin:32px 0 40px;padding:32px;background:linear-gradient(135deg,#451a03,#78350f);border:1px solid #92400e;border-radius:16px">
        <div style="font-size:56px;margin-bottom:8px">${championObj?.flag || '🏆'}</div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.2em;color:#fcd34d;margin-bottom:6px">2026 WORLD CHAMPION</div>
        <div style="font-size:36px;font-weight:900;color:#fef3c7">${champion}</div>
      </div>` : `<div style="text-align:center;margin:24px 0;color:#6b7280;font-size:14px">Bracket in progress...</div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>My 2026 World Cup Predictions</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0c0a09;color:#e7e5e4;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;padding:0}
  @media print{body{background:#0c0a09;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div style="background:linear-gradient(108deg,#06b6d4 0%,#06b6d4 49%,#ea580c 51%,#ea580c 100%);padding:28px 40px;display:flex;align-items:center;gap:16px">
  <span style="font-size:40px">🏆</span>
  <div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.2em;color:rgba(255,255,255,.8)">FIFA WORLD CUP 2026</div>
    <div style="font-size:26px;font-weight:900;color:white">My Predictions</div>
    <div style="font-size:11px;color:rgba(255,255,255,.65);margin-top:2px">Generated ${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>
  </div>
</div>

<div style="max-width:1100px;margin:0 auto;padding:32px 24px">

  ${championSection}

  <h2 style="font-size:18px;font-weight:700;color:#e7e5e4;margin-bottom:16px">Group Stage Picks</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:40px">
    ${groupRows}
  </div>

  ${thirdPlacePicks.length > 0 ? `
  <h2 style="font-size:18px;font-weight:700;color:#e7e5e4;margin-bottom:12px">Best 8 Third-Place Teams</h2>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:40px">${thirdRows}</div>` : ''}

  <h2 style="font-size:18px;font-weight:700;color:#e7e5e4;margin-bottom:4px">Knockout Bracket</h2>
  <p style="font-size:12px;color:#6b7280;margin-bottom:16px">Green = my pick to advance</p>
  <div style="background:#111827;border:1px solid #1c1917;border-radius:12px;padding:16px">
    ${allMatchups.filter(({matchup}) => matchup.home.name || matchup.away.name)
      .map(({matchup, winner, label}) => bracketRow(matchup, winner, label)).join('')}
  </div>

</div>
<div style="text-align:center;padding:20px;font-size:11px;color:#44403c;border-top:1px solid #1c1917;margin-top:24px">
  fifa-world-cup-predictor.vercel.app · Not affiliated with FIFA
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'WC2026-My-Predictions.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className={`font-semibold ${completedCount === 12 ? 'text-emerald-700' : 'text-stone-900'}`}>
                {completedCount}/12 groups
              </span>
              {allGroupsDone && (
                <span className={`ml-3 ${thirdPlaceDone ? 'text-emerald-700 font-semibold' : 'text-stone-500'}`}>
                  {thirdPlacePicks.length}/8 third places
                </span>
              )}
            </div>
            <div className="h-1 w-32 rounded-full bg-stone-200 overflow-hidden hidden sm:block">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${(completedCount / 12) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allGroupsDone && !thirdPlaceDone && (
              <button onClick={() => scrollTo(thirdRef)}
                className="text-xs px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-100">
                Pick 3rd places
              </button>
            )}
            {thirdPlaceDone && (
              <button onClick={() => scrollTo(bracketRef)}
                className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
                Open bracket
              </button>
            )}
            <button onClick={reset}
              className="text-xs px-3 py-1.5 text-stone-500 hover:text-stone-900">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Visual hero banner */}
      <section className="w-full bg-stone-950">
        {/* Thin rainbow accent bar — FIFA 2026 branding colors */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #06b6d4, #a855f7, #ef4444, #f97316, #eab308, #22c55e)' }} />

        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">

          {/* Left: title */}
          <div>
            <div className="text-[11px] font-bold tracking-[.25em] text-stone-500 uppercase mb-3">
              FIFA World Cup 2026™
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none mb-2">
              AI Predictor
            </h1>
            <p className="text-stone-400 text-sm max-w-sm">
              Pick your groups, select the best third-place teams, and predict the full bracket through the Final.
            </p>
          </div>

          {/* Right: tournament stats */}
          <div className="grid grid-cols-3 gap-px bg-stone-800 rounded-2xl overflow-hidden shrink-0 border border-stone-800">
            {[
              { n: '48', label: 'Teams' },
              { n: '12', label: 'Groups' },
              { n: '104', label: 'Matches' },
              { n: '3', label: 'Countries' },
              { n: '16', label: 'Venues' },
              { n: '39', label: 'Days' },
            ].map(({ n, label }) => (
              <div key={label} className="bg-stone-900 px-5 py-4 text-center">
                <div className="text-2xl font-black text-white leading-none">{n}</div>
                <div className="text-[10px] text-stone-500 mt-1 tracking-wider uppercase">{label}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Page title */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              World Cup 2026 Predictor
            </h1>
            <p className="text-stone-600 max-w-2xl text-sm">
              Use AI analysis to pick group winners and runners-up, select the 8 best third-place
              teams, then build your full bracket from Round of 32 through the Final.
            </p>
          </div>
          <button
            onClick={downloadPredictions}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm hover:bg-stone-700 transition font-medium"
          >
            <span>⬇</span>
            <span>Download My Bracket</span>
          </button>
        </div>
      </section>

      {/* Groups */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="text-2xl font-bold mb-6">Group Stage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {GROUPS.map((group) => {
            const complete = groupComplete(group.id);
            const groupPicks = picks[group.id] || {};
            const isOpen = openGroup === group.id;
            const analysis = analyses[group.id];
            const loading = loadingAnalysis[group.id];

            return (
              <div key={group.id}
                className={`rounded-xl border bg-white p-5 transition ${
                  complete ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-stone-200'
                }`}>

                {/* Card header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">Group {group.id}</h3>
                    {complete && <span className="text-xs text-emerald-700 font-medium">Complete</span>}
                  </div>
                  <button
                    onClick={() => {
                      setOpenGroup(isOpen ? null : group.id);
                      if (!analysis && !loading) fetchAnalysis(group.id);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md border transition ${
                      isOpen
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-900'
                    }`}>
                    {loading ? 'Analyzing...' : isOpen ? 'Hide AI' : 'AI Analysis'}
                  </button>
                </div>

                {/* AI Analysis panel */}
                {isOpen && (
                  <div className="mb-4 rounded-lg bg-stone-50 border border-stone-200 p-3 text-xs text-stone-700 leading-relaxed">
                    {loading ? (
                      <div className="text-stone-500 animate-pulse">
                        Researching live data... (15-40s)
                      </div>
                    ) : analysis && analysis.teams && analysis.teams.length ? (
                      <div className="space-y-3">
                        {analysis.summary && (
                          <p className="text-stone-600 italic">{analysis.summary}</p>
                        )}
                        <div className="space-y-1.5">
                          {[...analysis.teams].sort((a, b) => a.rank - b.rank).map(t => (
                            <div key={t.name} className="flex gap-2 items-start">
                              <span className={`shrink-0 w-5 h-5 rounded flex items-center justify-center font-bold ${FINISH_BADGE[t.rank] || FINISH_BADGE[4]}`}>
                                {t.rank}
                              </span>
                              <p className="flex-1">
                                <span className="font-semibold text-stone-900">{t.name}.</span> {t.note}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-stone-200 pt-2 space-y-1 text-stone-500">
                          {analysis.advance && analysis.advance.length > 0 && (
                            <div><span className="font-medium text-emerald-700">Advance:</span> {analysis.advance.join(', ')}</div>
                          )}
                          {analysis.thirdPlaceShot && (
                            <div><span className="font-medium">Wildcard:</span> {analysis.thirdPlaceShot}</div>
                          )}
                          {analysis.upset && (
                            <div><span className="font-medium">Upset risk:</span> {analysis.upset}</div>
                          )}
                          {analysis.confidence && (
                            <div><span className="font-medium">Confidence:</span> {analysis.confidence}</div>
                          )}
                        </div>
                      </div>
                    ) : analysis && analysis.summary ? (
                      <p>{analysis.summary}</p>
                    ) : (
                      <p className="text-stone-500 italic">No analysis yet.</p>
                    )}
                  </div>
                )}

                {/* Teams */}
                <div className="space-y-2">
                  {group.teams.map((team) => {
                    const rank = groupPicks[team.name];
                    return (
                      <div key={team.name}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 transition ${
                          rank ? RANK_COLORS[rank] : 'bg-stone-50 ring-stone-200'
                        }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{team.flag}</span>
                          <span className="text-sm font-medium truncate">{team.name}</span>
                          {rank && (
                            <span className="text-xs opacity-60 shrink-0">{RANK_LABELS[rank]}</span>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {[1, 2, 3].map(r => (
                            <button key={r}
                              onClick={() => setRank(group.id, team.name, r)}
                              className={`w-7 h-7 rounded text-xs font-bold transition ${
                                rank === r
                                  ? 'bg-stone-900 text-white'
                                  : 'bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-100'
                              }`}>
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Third place */}
      <section ref={thirdRef} className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-baseline justify-between flex-wrap gap-4 mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Best 8 Third-Place Teams</h2>
            <span className="text-sm text-stone-500">{thirdPlacePicks.length}/8 selected</span>
          </div>
          <p className="text-stone-600 mb-6 max-w-2xl text-sm">
            The 8 best third-place finishers join the 24 group qualifiers in the Round of 32.
            Pick carefully: finishing position determines which group winner you face.
          </p>

          {!allGroupsDone ? (
            <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-500 text-sm">
              Complete all 12 groups first.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {thirdPlaceCandidates.map(c => {
                const selected = thirdPlacePicks.includes(c.groupId);
                const atCap = thirdPlacePicks.length >= 8 && !selected;
                return (
                  <button key={c.groupId}
                    onClick={() => toggleThirdPlace(c.groupId)}
                    disabled={atCap}
                    className={`text-left rounded-lg border p-3 transition ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                        : atCap
                        ? 'border-stone-200 bg-stone-50 opacity-40 cursor-not-allowed'
                        : 'border-stone-200 bg-white hover:border-stone-400'
                    }`}>
                    <div className="text-xs font-semibold text-stone-500 mb-1">Group {c.groupId}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{c.flag}</span>
                      <span className="text-sm font-medium truncate">{c.name}</span>
                    </div>
                    {selected && <div className="text-xs text-emerald-600 mt-1 font-medium">Advancing</div>}
                  </button>
                );
              })}
            </div>
          )}

          {thirdPlaceDone && (
            <div className="mt-6 flex justify-end">
              <button onClick={() => scrollTo(bracketRef)}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                Build the bracket
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Bracket */}
      <section ref={bracketRef} className="border-t border-stone-800 bg-stone-950">
        <div className="mx-auto max-w-[1500px] px-4 py-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Knockout Bracket</h2>
            <p className="text-stone-500 text-sm mt-1">
              Click a team to advance them. Each pick updates all downstream rounds.
            </p>
          </div>

          {!thirdPlaceDone ? (
            <div className="rounded-lg border border-dashed border-stone-700 p-10 text-center text-stone-500">
              Select your 8 third-place teams above to unlock the bracket.
            </div>
          ) : (
            <>
              {/* ── Visual bracket tree (desktop xl+) ── */}
              <div className="hidden xl:block overflow-x-auto pb-4">
                <div className="relative flex items-stretch gap-1.5" style={{ height: '544px', minWidth: '1252px' }}>
                  <BracketLines />

                  {/* Group boxes — left */}
                  <div className="flex flex-col justify-around gap-0" style={{ height: '544px' }}>
                    {GROUPS.slice(0, 6).map(g => <GroupBox key={g.id} group={g} />)}
                  </div>

                  {/* R32 left */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    {BRACKET_L.r32.map(idx => (
                      <BracketSlot key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n => pickBracket('r32', idx, n)} matchNum={73 + idx} />
                    ))}
                  </div>

                  {/* R16 left */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    {BRACKET_L.r16.map(idx => (
                      <BracketSlot key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n => pickBracket('r16', idx, n)} matchNum={89 + idx} />
                    ))}
                  </div>

                  {/* QF left */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    {BRACKET_L.qf.map(idx => (
                      <BracketSlot key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n => pickBracket('qf', idx, n)} matchNum={97 + idx} />
                    ))}
                  </div>

                  {/* SF left */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    <BracketSlot matchup={sfMatchups[0]} picked={bracketPicks.sf[0]} onPick={n => pickBracket('sf', 0, n)} matchNum={101} />
                  </div>

                  {/* Center — Final, 3rd, Champion */}
                  <div className="flex flex-col items-center justify-center gap-3 px-3" style={{ height: '544px', width: '192px', minWidth: '192px' }}>
                    <div className="text-4xl">🏆</div>
                    {champion ? (
                      <div className="text-center">
                        <div className="text-[8px] font-bold tracking-widest text-amber-500 uppercase mb-1">World Champion</div>
                        <div className="text-sm font-bold text-amber-400">{championObj?.flag} {champion}</div>
                      </div>
                    ) : (
                      <div className="text-[9px] text-stone-600 font-bold tracking-widest uppercase">Champion</div>
                    )}
                    <div className="w-px h-4 bg-stone-700" />
                    <div>
                      <div className="text-[8px] font-bold tracking-widest text-stone-500 uppercase text-center mb-1">Final · Jul 19</div>
                      <BracketSlot matchup={finalMatchup} picked={bracketPicks.final} onPick={n => pickBracket('final', 0, n)} matchNum={104} />
                    </div>
                    <div className="w-px h-4 bg-stone-700" />
                    <div>
                      <div className="text-[8px] font-bold tracking-widest text-stone-500 uppercase text-center mb-1">3rd Place · Jul 18</div>
                      <BracketSlot matchup={thirdPlaceMatchup} picked={bracketPicks.thirdPlace} onPick={n => pickBracket('thirdPlace', 0, n)} matchNum={103} />
                    </div>
                  </div>

                  {/* SF right */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    <BracketSlot matchup={sfMatchups[1]} picked={bracketPicks.sf[1]} onPick={n => pickBracket('sf', 1, n)} matchNum={102} />
                  </div>

                  {/* QF right */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    {BRACKET_R.qf.map(idx => (
                      <BracketSlot key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n => pickBracket('qf', idx, n)} matchNum={97 + idx} />
                    ))}
                  </div>

                  {/* R16 right */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    {BRACKET_R.r16.map(idx => (
                      <BracketSlot key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n => pickBracket('r16', idx, n)} matchNum={89 + idx} />
                    ))}
                  </div>

                  {/* R32 right */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    {BRACKET_R.r32.map(idx => (
                      <BracketSlot key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n => pickBracket('r32', idx, n)} matchNum={73 + idx} />
                    ))}
                  </div>

                  {/* Group boxes — right */}
                  <div className="flex flex-col justify-around" style={{ height: '544px' }}>
                    {GROUPS.slice(6).map(g => <GroupBox key={g.id} group={g} />)}
                  </div>

                </div>

                {/* Round labels */}
                <div className="flex items-center gap-1.5 mt-2 text-stone-600 uppercase" style={{ minWidth: '1252px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em' }}>
                  <div style={{ width: '60px' }} />
                  <div className="text-center" style={{ width: '110px' }}>Round of 32</div>
                  <div className="text-center" style={{ width: '110px' }}>Round of 16</div>
                  <div className="text-center" style={{ width: '110px' }}>Quarterfinals</div>
                  <div className="text-center" style={{ width: '110px' }}>Semifinals</div>
                  <div className="text-center flex-1">Final</div>
                  <div className="text-center" style={{ width: '110px' }}>Semifinals</div>
                  <div className="text-center" style={{ width: '110px' }}>Quarterfinals</div>
                  <div className="text-center" style={{ width: '110px' }}>Round of 16</div>
                  <div className="text-center" style={{ width: '110px' }}>Round of 32</div>
                  <div style={{ width: '60px' }} />
                </div>
              </div>

              {/* ── Mobile: card-based rounds ── */}
              <div className="xl:hidden space-y-10">
                <RoundSection title="Round of 32" subtitle="June 28 to July 3" matchups={r32Matchups} picks={bracketPicks.r32} onPick={(i,n) => pickBracket('r32',i,n)} matchNumStart={73} locked={false} />
                <RoundSection title="Round of 16" subtitle="July 4 to July 7" matchups={r16Matchups} picks={bracketPicks.r16} onPick={(i,n) => pickBracket('r16',i,n)} matchNumStart={89} locked={!r32Done} lockedMsg="Complete the Round of 32 first." />
                <RoundSection title="Quarterfinals" subtitle="July 9 to July 11" matchups={qfMatchups} picks={bracketPicks.qf} onPick={(i,n) => pickBracket('qf',i,n)} matchNumStart={97} locked={!r16Done} lockedMsg="Complete the Round of 16 first." />
                <RoundSection title="Semifinals" subtitle="July 14 to July 15" matchups={sfMatchups} picks={bracketPicks.sf} onPick={(i,n) => pickBracket('sf',i,n)} locked={!qfDone} lockedMsg="Complete the Quarterfinals first." />
                {sfDone && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">3rd Place · July 18, Miami</h3>
                      <MatchCard home={thirdPlaceMatchup.home} away={thirdPlaceMatchup.away} picked={bracketPicks.thirdPlace} onPick={n => pickBracket('thirdPlace',0,n)} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">Final · July 19, New Jersey</h3>
                      <MatchCard home={finalMatchup.home} away={finalMatchup.away} picked={bracketPicks.final} onPick={n => pickBracket('final',0,n)} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Champion card — mobile only (desktop shows in bracket center) */}
          {champion && (
            <div className="mt-10 xl:hidden rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
              <div className="text-4xl mb-3">{championObj?.flag || '🏆'}</div>
              <div className="text-xs font-bold tracking-widest text-amber-500 mb-1">2026 WORLD CHAMPION</div>
              <div className="text-3xl font-bold text-white">{champion}</div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-stone-500 flex flex-wrap justify-between gap-2">
          <span>Official bracket: FIFA Annex C draw, December 5, 2025. Picks saved in your browser.</span>
          <span>Not affiliated with FIFA.</span>
        </div>
      </footer>
    </main>
  );
}
