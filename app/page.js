'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { GROUPS } from '../lib/groups';

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
  const used = new Set();
  const result = {};
  SLOT_ELIGIBLE.forEach((eligible, slotIdx) => {
    const match = eligible.find(g => thirdPlacePicks.includes(g) && !used.has(g));
    if (match) { result[slotIdx] = match; used.add(match); }
  });
  return result;
}

// Teams split for the visual hero banner (Groups A-F left, G-L right)
const LEFT_TEAMS = GROUPS.slice(0, 6).flatMap(g => g.teams);
const RIGHT_TEAMS = GROUPS.slice(6).flatMap(g => g.teams);

function resolveDesc(desc, picks, thirdAssignment) {
  if (desc.type === 'group') {
    const name = getTeamByRank(picks, desc.group, desc.rank);
    if (!name) return { name: null, flag: null, display: `Group ${desc.group} ${RANK_LABELS[desc.rank]}` };
    const obj = getTeamObj(desc.group, name);
    return { name, flag: obj?.flag || '', display: name };
  }
  // type: 'third'
  const groupId = thirdAssignment[desc.slotIdx];
  if (!groupId) return { name: null, flag: null, display: `Best 3rd (${desc.eligible.join('/')})` };
  const name = getTeamByRank(picks, groupId, 3);
  if (!name) return { name: null, flag: null, display: `Group ${groupId} 3rd` };
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

// ─── Main component ───────────────────────────────────────────────────────────

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

  const thirdAssignment = useMemo(() => assign3rdPlace(thirdPlacePicks), [thirdPlacePicks]);

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
      <section
        className="relative overflow-hidden w-full"
        style={{ background: 'linear-gradient(108deg, #06b6d4 0%, #06b6d4 49%, #ea580c 51%, #ea580c 100%)' }}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 flex items-center gap-2">

          {/* Left flags: Groups A-F */}
          <div className="hidden md:grid grid-cols-6 gap-1.5 flex-1">
            {LEFT_TEAMS.map((team, i) => (
              <div
                key={i}
                title={team.name}
                className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-xl shadow-md border border-white/30 hover:scale-110 transition-transform cursor-default"
              >
                {team.flag}
              </div>
            ))}
          </div>

          {/* Center: trophy + branding */}
          <div className="flex-shrink-0 text-center text-white px-6 md:px-10 mx-auto md:mx-0">
            <div className="text-6xl md:text-7xl mb-1">🏆</div>
            <div className="text-[10px] font-bold tracking-[0.3em] opacity-90 uppercase">
              FIFA World Cup
            </div>
            <div className="text-5xl md:text-6xl font-black tracking-tighter leading-none">
              2026
            </div>
            <div className="text-[10px] opacity-70 mt-1 tracking-widest">
              USA · CANADA · MEXICO
            </div>
            <div className="mt-3 text-xs font-semibold bg-white/20 rounded-full px-4 py-1 inline-block border border-white/30">
              AI Predictor
            </div>
          </div>

          {/* Right flags: Groups G-L */}
          <div className="hidden md:grid grid-cols-6 gap-1.5 flex-1">
            {RIGHT_TEAMS.map((team, i) => (
              <div
                key={i}
                title={team.name}
                className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-xl shadow-md border border-white/30 hover:scale-110 transition-transform cursor-default"
              >
                {team.flag}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Page title */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          World Cup 2026 Predictor
        </h1>
        <p className="text-stone-600 max-w-2xl text-sm">
          Use AI analysis to pick group winners and runners-up, select the 8 best third-place
          teams, then build your full bracket from Round of 32 through the Final.
        </p>
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
      <section ref={bracketRef} className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-12 space-y-12">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-1">Knockout Bracket</h2>
            <p className="text-stone-500 text-sm">
              Click a team in each match to pick the winner. Picks update downstream rounds automatically.
            </p>
          </div>

          {/* R32 */}
          <div>
            <RoundSection
              title="Round of 32"
              subtitle="June 28 to July 3"
              matchups={r32Matchups}
              picks={bracketPicks.r32}
              onPick={(i, name) => pickBracket('r32', i, name)}
              matchNumStart={73}
              locked={!thirdPlaceDone}
              lockedMsg="Select your 8 third-place teams to unlock the bracket."
            />
          </div>

          {/* R16 */}
          <div>
            <RoundSection
              title="Round of 16"
              subtitle="July 4 to July 7"
              matchups={r16Matchups}
              picks={bracketPicks.r16}
              onPick={(i, name) => pickBracket('r16', i, name)}
              matchNumStart={89}
              locked={!r32Done}
              lockedMsg="Complete the Round of 32 first."
            />
          </div>

          {/* QF */}
          <div>
            <RoundSection
              title="Quarterfinals"
              subtitle="July 9 to July 11"
              matchups={qfMatchups}
              picks={bracketPicks.qf}
              onPick={(i, name) => pickBracket('qf', i, name)}
              matchNumStart={97}
              locked={!r16Done}
              lockedMsg="Complete the Round of 16 first."
            />
          </div>

          {/* SF */}
          <div>
            <RoundSection
              title="Semifinals"
              subtitle="July 14 to July 15"
              matchups={sfMatchups}
              picks={bracketPicks.sf}
              onPick={(i, name) => pickBracket('sf', i, name)}
              locked={!qfDone}
              lockedMsg="Complete the Quarterfinals first."
            />
          </div>

          {/* 3rd place + Final */}
          {sfDone && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold mb-3">3rd Place Match</h3>
                <p className="text-xs text-stone-500 mb-3">July 18, Hard Rock Stadium, Miami</p>
                <MatchCard
                  home={thirdPlaceMatchup.home}
                  away={thirdPlaceMatchup.away}
                  picked={bracketPicks.thirdPlace}
                  onPick={(name) => pickBracket('thirdPlace', 0, name)}
                />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-3">World Cup Final</h3>
                <p className="text-xs text-stone-500 mb-3">July 19, MetLife Stadium, New Jersey</p>
                <MatchCard
                  home={finalMatchup.home}
                  away={finalMatchup.away}
                  picked={bracketPicks.final}
                  onPick={(name) => pickBracket('final', 0, name)}
                />
              </div>
            </div>
          )}

          {/* Champion */}
          {champion && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center">
              <div className="text-4xl mb-3">{championObj?.flag || '🏆'}</div>
              <div className="text-xs font-bold tracking-widest text-amber-700 mb-1">2026 WORLD CHAMPION</div>
              <div className="text-3xl font-bold">{champion}</div>
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
