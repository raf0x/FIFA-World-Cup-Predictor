'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { GROUPS } from '../lib/groups';

const RANK_STYLES = {
  1: 'bg-amber-100 text-amber-900 ring-amber-300',
  2: 'bg-slate-100 text-slate-700 ring-slate-300',
  3: 'bg-orange-100 text-orange-900 ring-orange-300',
};

const RANK_LABELS = { 1: '1st', 2: '2nd', 3: '3rd' };

export default function Home() {
  const [picks, setPicks] = useState({});
  const [thirdPlacePicks, setThirdPlacePicks] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  const thirdRef = useRef(null);
  const summaryRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wc2026-picks');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.picks) setPicks(data.picks);
        if (data.thirdPlacePicks) setThirdPlacePicks(data.thirdPlacePicks);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      'wc2026-picks',
      JSON.stringify({ picks, thirdPlacePicks })
    );
  }, [picks, thirdPlacePicks, hydrated]);

  const setRank = (groupId, team, rank) => {
    setPicks((prev) => {
      const current = { ...(prev[groupId] || {}) };
      // If team already holds this rank, toggle it off
      if (current[team] === rank) {
        delete current[team];
        return { ...prev, [groupId]: current };
      }
      // Clear any other team holding this rank
      Object.keys(current).forEach((t) => {
        if (current[t] === rank) delete current[t];
      });
      // Assign new rank to team (replaces any prior rank it had)
      current[team] = rank;
      return { ...prev, [groupId]: current };
    });
  };

  const groupComplete = (groupId) => {
    const g = picks[groupId] || {};
    const ranks = Object.values(g);
    return ranks.includes(1) && ranks.includes(2) && ranks.includes(3);
  };

  const completedCount = GROUPS.filter((g) => groupComplete(g.id)).length;
  const allGroupsDone = completedCount === 12;

  const thirdPlaceCandidates = useMemo(() => {
    return GROUPS.map((g) => {
      const p = picks[g.id] || {};
      const team = Object.keys(p).find((t) => p[t] === 3);
      if (!team) return null;
      const teamObj = g.teams.find((t) => t.name === team);
      return { groupId: g.id, team, flag: teamObj?.flag || '' };
    }).filter(Boolean);
  }, [picks]);

  const toggleThirdPlace = (groupId) => {
    setThirdPlacePicks((prev) => {
      if (prev.includes(groupId)) return prev.filter((g) => g !== groupId);
      if (prev.length >= 8) return prev;
      return [...prev, groupId];
    });
  };

  const summaryReady = allGroupsDone && thirdPlacePicks.length === 8;

  const reset = () => {
    if (confirm('Clear all picks? This cannot be undone.')) {
      setPicks({});
      setThirdPlacePicks([]);
    }
  };

  const scrollTo = (ref) => {
    if (ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const buildSummaryText = () => {
    const lines = ['FIFA World Cup 2026: My Predictions', ''];
    GROUPS.forEach((g) => {
      const p = picks[g.id] || {};
      const winner = Object.keys(p).find((t) => p[t] === 1);
      const second = Object.keys(p).find((t) => p[t] === 2);
      const third = Object.keys(p).find((t) => p[t] === 3);
      lines.push(`Group ${g.id}:`);
      lines.push(`  1st: ${winner || '(not set)'}`);
      lines.push(`  2nd: ${second || '(not set)'}`);
      lines.push(`  3rd: ${third || '(not set)'}`);
    });
    lines.push('');
    lines.push('Best 8 third-place teams advancing:');
    thirdPlacePicks.forEach((gid) => {
      const c = thirdPlaceCandidates.find((x) => x.groupId === gid);
      if (c) lines.push(`  Group ${gid}: ${c.team}`);
    });
    return lines.join('\n');
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      {/* Sticky progress bar */}
      <div className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-stone-900">
              {completedCount}/12 groups
              {allGroupsDone && (
                <span className="ml-2 text-emerald-700">
                  · {thirdPlacePicks.length}/8 third places
                </span>
              )}
            </div>
            <div className="mt-1 h-1 w-40 sm:w-64 rounded-full bg-stone-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{
                  width: `${
                    ((completedCount + (allGroupsDone ? thirdPlacePicks.length / 8 * 0 : 0)) / 12) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allGroupsDone && (
              <button
                onClick={() => scrollTo(thirdRef)}
                className="text-xs sm:text-sm px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-100"
              >
                Third places
              </button>
            )}
            {summaryReady && (
              <button
                onClick={() => scrollTo(summaryRef)}
                className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Summary
              </button>
            )}
            <button
              onClick={reset}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-md text-stone-500 hover:text-stone-900"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-8">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-xs font-semibold tracking-widest text-emerald-700">
            JUNE 11 TO JULY 19, 2026
          </span>
          <span className="text-xs text-stone-500">USA · CANADA · MEXICO</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          World Cup 2026 Predictor
        </h1>
        <p className="mt-4 max-w-2xl text-stone-600">
          Pick who finishes 1st, 2nd, and 3rd in each of the 12 groups. Then choose
          the 8 best third-place teams that join them in the Round of 32. Your picks
          save automatically.
        </p>
      </section>

      {/* Groups */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GROUPS.map((group) => {
            const complete = groupComplete(group.id);
            const groupPicks = picks[group.id] || {};
            return (
              <div
                key={group.id}
                className={`rounded-xl border bg-white p-5 transition ${
                  complete ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-stone-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Group {group.id}</h2>
                  {complete && (
                    <span className="text-xs font-medium text-emerald-700">
                      ✓ Complete
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {group.teams.map((team) => {
                    const rank = groupPicks[team.name];
                    return (
                      <div
                        key={team.name}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 transition ${
                          rank
                            ? RANK_STYLES[rank]
                            : 'bg-stone-50 ring-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg shrink-0" aria-hidden>
                            {team.flag}
                          </span>
                          <span className="truncate font-medium text-sm">
                            {team.name}
                          </span>
                          {rank && (
                            <span className="text-xs font-semibold opacity-70 shrink-0">
                              {RANK_LABELS[rank]}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {[1, 2, 3].map((r) => (
                            <button
                              key={r}
                              onClick={() => setRank(group.id, team.name, r)}
                              className={`w-7 h-7 rounded-md text-xs font-semibold transition ${
                                rank === r
                                  ? 'bg-stone-900 text-white'
                                  : 'bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-100 hover:text-stone-900'
                              }`}
                              aria-label={`Set ${team.name} as ${RANK_LABELS[r]}`}
                            >
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

      {/* Third place picker */}
      <section
        ref={thirdRef}
        className={`border-t border-stone-200 ${
          allGroupsDone ? 'bg-white' : 'bg-stone-100/50'
        }`}
      >
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Best 8 Third-Place Teams
            </h2>
            <span className="text-sm text-stone-500">
              {thirdPlacePicks.length}/8 selected
            </span>
          </div>
          <p className="text-stone-600 mb-6 max-w-2xl">
            With 32 teams advancing, the 8 best third-place finishers join the 24
            group winners and runners-up in the Round of 32.
          </p>

          {!allGroupsDone ? (
            <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-500">
              Finish picking 1st, 2nd, and 3rd for all 12 groups to unlock.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {thirdPlaceCandidates.map((c) => {
                const selected = thirdPlacePicks.includes(c.groupId);
                const atCap = thirdPlacePicks.length >= 8 && !selected;
                return (
                  <button
                    key={c.groupId}
                    onClick={() => toggleThirdPlace(c.groupId)}
                    disabled={atCap}
                    className={`text-left rounded-lg border p-3 transition ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                        : atCap
                        ? 'border-stone-200 bg-stone-50 opacity-40 cursor-not-allowed'
                        : 'border-stone-200 bg-white hover:border-stone-400'
                    }`}
                  >
                    <div className="text-xs font-semibold text-stone-500 mb-1">
                      Group {c.groupId}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden>
                        {c.flag}
                      </span>
                      <span className="text-sm font-medium truncate">{c.team}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Summary */}
      <section
        ref={summaryRef}
        className={`border-t border-stone-200 ${
          summaryReady ? 'bg-stone-50' : 'bg-stone-100/50'
        }`}
      >
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Round of 32: Your 32 Teams
            </h2>
            {summaryReady && (
              <button
                onClick={copySummary}
                className="text-sm px-4 py-2 rounded-md bg-stone-900 text-white hover:bg-stone-700"
              >
                {copied ? 'Copied' : 'Copy summary'}
              </button>
            )}
          </div>

          {!summaryReady ? (
            <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-500">
              Complete all groups and pick 8 third-place teams to see your final 32.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GROUPS.map((g) => {
                const p = picks[g.id] || {};
                const winnerName = Object.keys(p).find((t) => p[t] === 1);
                const secondName = Object.keys(p).find((t) => p[t] === 2);
                const thirdName = Object.keys(p).find((t) => p[t] === 3);
                const winner = g.teams.find((t) => t.name === winnerName);
                const second = g.teams.find((t) => t.name === secondName);
                const third = g.teams.find((t) => t.name === thirdName);
                const thirdAdvances = thirdPlacePicks.includes(g.id);
                return (
                  <div
                    key={g.id}
                    className="rounded-xl border border-stone-200 bg-white p-5"
                  >
                    <div className="text-sm font-semibold text-stone-500 mb-3">
                      Group {g.id}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span aria-hidden>{winner?.flag}</span>
                          <span className="font-medium">{winnerName}</span>
                        </div>
                        <span className="text-xs font-semibold text-amber-700">
                          1st · Advances
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span aria-hidden>{second?.flag}</span>
                          <span className="font-medium">{secondName}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          2nd · Advances
                        </span>
                      </div>
                      <div
                        className={`flex items-center justify-between ${
                          thirdAdvances ? '' : 'opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span aria-hidden>{third?.flag}</span>
                          <span className="font-medium">{thirdName}</span>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            thirdAdvances ? 'text-emerald-700' : 'text-stone-500'
                          }`}
                        >
                          {thirdAdvances ? '3rd · Advances' : '3rd · Out'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-stone-500 flex flex-wrap items-center justify-between gap-2">
          <div>
            Tournament data: official FIFA draw, December 5, 2025. Picks saved
            locally in your browser.
          </div>
          <div>Built for fun. Not affiliated with FIFA.</div>
        </div>
      </footer>
    </main>
  );
}
