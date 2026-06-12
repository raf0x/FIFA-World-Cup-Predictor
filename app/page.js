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

function calcGroupStandings(group, groupScores) {
  const s = {};
  group.teams.forEach(t => {
    s[t.name] = { name:t.name, pts:0, gf:0, ga:0, gd:0, played:0, w:0, d:0, l:0 };
  });
  GROUP_MATCH_PAIRS.forEach(([hi, ai], idx) => {
    const sc = groupScores[`${group.id}_${idx}`];
    if (!sc || sc.home==='' || sc.away==='' || sc.home===null || sc.away===null) return;
    const hg = Number(sc.home), ag = Number(sc.away);
    if (isNaN(hg) || isNaN(ag) || hg < 0 || ag < 0) return;
    const hn = group.teams[hi].name, an = group.teams[ai].name;
    s[hn].gf+=hg; s[hn].ga+=ag; s[hn].gd+=(hg-ag); s[hn].played++;
    s[an].gf+=ag; s[an].ga+=hg; s[an].gd+=(ag-hg); s[an].played++;
    if (hg>ag)      { s[hn].pts+=3; s[hn].w++; s[an].l++; }
    else if (hg<ag) { s[an].pts+=3; s[an].w++; s[hn].l++; }
    else            { s[hn].pts++; s[an].pts++; s[hn].d++; s[an].d++; }
  });
  return Object.values(s).sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getTeamByRank(picks, groupId, rank) {
  const p = picks[groupId] || {};
  return Object.keys(p).find(t => p[t] === rank) || null;
}
function getTeamObj(groupId, name) {
  return GROUPS.find(g => g.id === groupId)?.teams.find(t => t.name === name) || null;
}
function resolveDesc(desc, picks, thirdAssignment) {
  if (desc.type === 'group') {
    const name = getTeamByRank(picks, desc.group, desc.rank);
    if (!name) return { name:null, flag:null, display:`${desc.rank}${desc.group}` };
    const obj = getTeamObj(desc.group, name);
    return { name, flag:obj?.flag||'', display:name };
  }
  const groupId = thirdAssignment[desc.slotIdx];
  if (!groupId) return { name:null, flag:null, display:`3 ${desc.eligible.join('')}` };
  const name = getTeamByRank(picks, groupId, 3);
  if (!name) return { name:null, flag:null, display:`3 ${groupId}` };
  const obj = getTeamObj(groupId, name);
  return { name, flag:obj?.flag||'', display:name };
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
function AIPanel({ loading, analysis, color }) {
  if (loading) {
    return (
      <div className="aipanel">
        <div className="ai-loading">
          <span className="ai-spinner" />
          <div>
            <div className="ai-load-1">Researching live data…</div>
            <div className="ai-load-2">Scanning results, squads & rankings · 15–40s</div>
          </div>
        </div>
      </div>
    );
  }
  if (!analysis?.teams?.length) {
    return <div className="aipanel"><p className="ai-empty">No analysis yet.</p></div>;
  }
  const ranked = [...analysis.teams].sort((a, b) => a.rank - b.rank);
  return (
    <div className="aipanel">
      <div className="ai-head">
        <span className="ai-badge" style={{ color }}>◆ AI BRIEFING</span>
        {analysis.confidence && (
          <span className="ai-conf" style={{ color: CONF[analysis.confidence] }}>
            <span className="ai-conf-dot" style={{ background: CONF[analysis.confidence] }} />
            {analysis.confidence} confidence
          </span>
        )}
      </div>
      {analysis.summary && <p className="ai-summary">{analysis.summary}</p>}
      <div className="ai-teams">
        {ranked.map(t => {
          const m = MEDAL[t.rank] || { tint:'rgba(120,120,150,.1)', ring:'#1e1e30', text:'#7a7a9a', solid:'#55556e' };
          return (
            <div key={t.name} className="ai-team">
              <span className="ai-rank" style={{ background:m.tint, color:m.text, boxShadow:`inset 0 0 0 1px ${m.ring}` }}>{t.rank}</span>
              <div>
                <p className="ai-note"><b>{t.name}.</b> {t.note}</p>
                {t.lastMatch && t.lastMatch !== 'Last result unverified' && (() => {
                  const color = t.lastMatch.includes('WON') ? 'var(--green)' : t.lastMatch.includes('LOST') ? '#fb7185' : t.lastMatch.includes('DREW') ? '#f5c142' : 'var(--dim)';
                  return (
                    <p className="ai-last-match" style={{ color }}>
                      ⚽ <span className="ai-last-match-label">Last match:</span> {t.lastMatch}
                    </p>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="ai-foot">
        {analysis.advance?.length > 0 && (
          <div className="ai-foot-row">
            <span className="ai-foot-k" style={{ color:'#39ff14' }}>Advance</span>
            <span className="ai-chips">{analysis.advance.map(a => <span key={a} className="ai-chip">{a}</span>)}</span>
          </div>
        )}
        {analysis.thirdPlaceShot && (
          <div className="ai-foot-row"><span className="ai-foot-k">Wildcard</span><span className="ai-foot-v">{analysis.thirdPlaceShot}</span></div>
        )}
        {analysis.upset && (
          <div className="ai-foot-row"><span className="ai-foot-k" style={{ color:'#fb923c' }}>Upset risk</span><span className="ai-foot-v">{analysis.upset}</span></div>
        )}
      </div>
    </div>
  );
}

// ─── Group Stage Card ──────────────────────────────────────────────────────
// ─── Group Score Panel ─────────────────────────────────────────────────────
function GroupScorePanel({ group, groupScores, onScoreChange, lockedGroupScores }) {
  const standings = calcGroupStandings(group, groupScores);
  const hasScores = standings.some(s => s.played > 0);
  const allFilled = GROUP_MATCH_PAIRS.every((_,i) => {
    const sc = groupScores[`${group.id}_${i}`];
    return sc && sc.home!=='' && sc.away!=='' && !isNaN(Number(sc.home)) && !isNaN(Number(sc.away));
  });

  return (
    <div className="score-panel">
      <div className="score-matches">
        {GROUP_MATCH_PAIRS.map(([hi,ai], idx) => {
          const home = group.teams[hi], away = group.teams[ai];
          const key = `${group.id}_${idx}`;
          const sc = groupScores[key] || { home:'', away:'' };
          const hg = sc.home==='' ? null : Number(sc.home);
          const ag = sc.away==='' ? null : Number(sc.away);
          const result = hg!==null && ag!==null ? (hg>ag?'home':hg<ag?'away':'draw') : null;
          const locked = !!lockedGroupScores?.[key];
          return (
            <div key={idx} className={`score-row ${locked ? 'score-row--locked' : ''}`}>
              <span className={`score-team score-team--l ${result==='home'?'score-team--w':result==='away'?'score-team--l2':''}`}>
                <Flag team={home} size={13}/> {home.name}
              </span>
              <div className="score-inputs">
                <input
                  className={`score-input ${locked ? 'score-input--locked' : ''}`}
                  type="number" min="0" max="20" placeholder="–"
                  value={sc.home} disabled={locked}
                  onChange={e => !locked && onScoreChange(group.id,idx,'home',e.target.value)}/>
                <span className="score-colon">{locked ? '–' : ':'}</span>
                <input
                  className={`score-input ${locked ? 'score-input--locked' : ''}`}
                  type="number" min="0" max="20" placeholder="–"
                  value={sc.away} disabled={locked}
                  onChange={e => !locked && onScoreChange(group.id,idx,'away',e.target.value)}/>
                {locked && <span className="score-lock">✓</span>}
              </div>
              <span className={`score-team score-team--r ${result==='away'?'score-team--w':result==='home'?'score-team--l2':''}`}>
                {away.name} <Flag team={away} size={13}/>
              </span>
            </div>
          );
        })}
      </div>

      {hasScores && (
        <div className="standings-wrap">
          <div className="standings-head">
            <span className="sth-team">Team</span>
            <span>P</span><span>W</span><span>D</span><span>L</span>
            <span>GD</span><span className="sth-pts">Pts</span>
          </div>
          {standings.map((s,i) => (
            <div key={s.name} className={`standings-row ${i<2?'standings-row--q':i===2?'standings-row--3':'standings-row--e'}`}>
              <span className="st-pos">{i+1}</span>
              <span className="st-name">{s.name}</span>
              <span>{s.played}</span><span>{s.w}</span><span>{s.d}</span><span>{s.l}</span>
              <span className={s.gd>0?'gd-pos':s.gd<0?'gd-neg':''}>{s.gd>0?'+':''}{s.gd}</span>
              <span className="st-pts">{s.pts}</span>
            </div>
          ))}
          {allFilled && (
            <div className="standings-auto-note">✓ Rankings auto-filled from scores</div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupStageCard({ group, groupPicks, complete, isOpen, analysis, loading, onToggleAI, onSetRank, limitReached, contactMsg, groupScores, scoreOpen, onToggleScore, onScoreChange, lockedGroupScores }) {
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
                : <span>{rankedCount}/3 ranked · top 2 advance</span>}
            </div>
          </div>
        </div>
        <button
          className={`ai-toggle ${isOpen ? 'ai-toggle--on' : ''}`}
          onClick={onToggleAI}
          title={limitReached && !analysis ? 'AI analysis limit reached' : undefined}
        >
          {loading
            ? <><span className="ai-spinner ai-spinner--sm" /> Analyzing</>
            : isOpen ? 'Hide AI'
            : analysis ? '◆ AI Analysis'
            : limitReached ? '◆ Want more AI?'
            : '◆ AI Analysis'}
        </button>
      </div>

      {isOpen && (
        contactMsg
          ? <div className="aipanel" style={{ textAlign:'center', padding:'24px 20px' }}>
              <div style={{ fontSize:24, marginBottom:10 }}>😅</div>
              <p style={{ fontSize:13, color:'var(--dim)', lineHeight:1.7 }}>
                If you want to use more AI Analysis, contact Rafa because this costs him money 💸
              </p>
            </div>
          : <AIPanel loading={loading} analysis={analysis} color={color} />
      )}

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

      {/* Score entry toggle */}
      <div className="score-toggle-row">
        <button className={`score-toggle-btn ${scoreOpen ? 'score-toggle-btn--on' : ''}`} onClick={onToggleScore}>
          {scoreOpen ? '▴ Hide match scores' : '⚽ Enter scores → auto-ranks your group'}
        </button>
      </div>
      {scoreOpen && (
        <GroupScorePanel group={group} groupScores={groupScores} onScoreChange={onScoreChange} lockedGroupScores={lockedGroupScores} />
      )}
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
function BracketSlot({ matchup, picked, onPick, matchNum, wide, score, onScoreChange }) {
  const { home, away } = matchup;
  const bothKnown = home.name && away.name;
  const info = matchNum ? MATCH_SCHEDULE[matchNum] : null;
  const title = info ? `M${matchNum} · ${info.date} · ${info.time} · ${info.venue}` : undefined;

  const handleScoreChange = (side, value) => {
    if (!onScoreChange) return;
    onScoreChange(side, value);
    // Auto-advance higher scorer when both fields are filled
    const otherSide = side === 'home' ? 'away' : 'home';
    const otherVal = score?.[otherSide] ?? '';
    const thisNum = parseInt(value);
    const otherNum = parseInt(otherVal);
    if (!isNaN(thisNum) && !isNaN(otherNum) && value !== '' && otherVal !== '') {
      const homeScore = side === 'home' ? thisNum : otherNum;
      const awayScore = side === 'away' ? thisNum : otherNum;
      if (homeScore > awayScore && home.name) onPick(home.name);
      else if (awayScore > homeScore && away.name) onPick(away.name);
      // Equal score: don't auto-pick — user clicks the winner (extra time/pens)
    }
  };

  return (
    <div className={`slot ${wide ? 'slot--wide' : ''}`} title={title}>
      {[home, away].map((team, i) => {
        const isPicked = team.name !== null && picked === team.name;
        const isOther = picked && picked !== team.name;
        const clickable = bothKnown && team.name;
        const side = i === 0 ? 'home' : 'away';
        return (
          <div key={i} className="slot-team-row">
            <button
              className={`slotrow ${isPicked ? 'slotrow--pick' : ''} ${isOther ? 'slotrow--out' : ''} ${clickable ? 'slotrow--live' : ''}`}
              onClick={() => clickable && onPick(isPicked ? null : team.name)}
              disabled={!clickable}>
              <span className="slot-flag"><Flag team={team} size={11} /></span>
              <span className="slot-name">{team.name || team.display}</span>
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
              You now have <b>3 AI analyses</b>. Close this and click <b>◆ AI Analysis</b> on any group.
            </p>
            <button className="btn btn-green auth-submit" onClick={onClose}>Start analyzing →</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>🔒</div>
            <h2 className="auth-title">Unlock AI Analysis</h2>
            <p className="auth-desc">
              Create a free account to unlock <b>3 AI analyses</b> — live squad data,
              form guides and group predictions.
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
        <BracketSlot matchup={finalMatchup} picked={bracketPicks.final} onPick={n => pickBracket('final',0,n)} matchNum={104} wide />

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
        <BracketSlot matchup={thirdMatchup} picked={bracketPicks.thirdPlace} onPick={n => pickBracket('thirdPlace',0,n)} matchNum={103} wide />
      </div>
    </div>
  );
}

function Bracket({ thirdPlaceDone, r32Matchups, r16Matchups, qfMatchups, sfMatchups,
                   finalMatchup, thirdMatchup, bracketPicks, pickBracket,
                   champion, championObj, r32Done, r16Done, qfDone, sfDone,
                   finalScore, onFinalScoreChange,
                   bracketScores, setBracketScore }) {
  if (!thirdPlaceDone) {
    return <div className="locked locked--dark locked--big">Select your 8 third-place teams above to unlock the bracket.</div>;
  }
  return (
    <>
      <div className="tree-scroll">
        <div className="tree" style={{ minWidth:1492 }}>
          <BracketLines />
          <div className="tree-col tree-groups">
            {GROUPS.slice(0,6).map(g => <GroupBox key={g.id} group={g} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.r32.map(idx => <BracketSlot key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n=>pickBracket('r32',idx,n)} matchNum={73+idx} score={bracketScores[`r32_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r32',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.r16.map(idx => <BracketSlot key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n=>pickBracket('r16',idx,n)} matchNum={89+idx} score={bracketScores[`r16_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r16',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.qf.map(idx => <BracketSlot key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n=>pickBracket('qf',idx,n)} matchNum={97+idx} score={bracketScores[`qf_${idx}`]} onScoreChange={(s,v)=>setBracketScore('qf',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            <BracketSlot matchup={sfMatchups[0]} picked={bracketPicks.sf[0]} onPick={n=>pickBracket('sf',0,n)} matchNum={101} score={bracketScores['sf_0']} onScoreChange={(s,v)=>setBracketScore('sf',0,s,v)} />
          </div>
          <ChampionReveal champion={champion} championObj={championObj}
            finalMatchup={finalMatchup} thirdMatchup={thirdMatchup}
            bracketPicks={bracketPicks} pickBracket={pickBracket}
            finalScore={finalScore} onFinalScoreChange={onFinalScoreChange} />
          <div className="tree-col">
            <BracketSlot matchup={sfMatchups[1]} picked={bracketPicks.sf[1]} onPick={n=>pickBracket('sf',1,n)} matchNum={102} score={bracketScores['sf_1']} onScoreChange={(s,v)=>setBracketScore('sf',1,s,v)} />
          </div>
          <div className="tree-col">
            {BRACKET_R.qf.map(idx => <BracketSlot key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n=>pickBracket('qf',idx,n)} matchNum={97+idx} score={bracketScores[`qf_${idx}`]} onScoreChange={(s,v)=>setBracketScore('qf',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_R.r16.map(idx => <BracketSlot key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n=>pickBracket('r16',idx,n)} matchNum={89+idx} score={bracketScores[`r16_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r16',idx,s,v)} />)}
          </div>
          <div className="tree-col">
            {BRACKET_R.r32.map(idx => <BracketSlot key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n=>pickBracket('r32',idx,n)} matchNum={73+idx} score={bracketScores[`r32_${idx}`]} onScoreChange={(s,v)=>setBracketScore('r32',idx,s,v)} />)}
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

// ─── Main component ────────────────────────────────────────────────────────
export default function Home() {
  const [picks, setPicks] = useState({});
  const [thirdPlacePicks, setThirdPlacePicks] = useState([]);
  const [bracketPicks, setBracketPicks] = useState(initBracket());
  const [analyses, setAnalyses] = useState({});
  const [loadingAnalysis, setLoadingAnalysis] = useState({});
  const [aiCallsUsed, setAiCallsUsed] = useState(0);
  const AI_LIMIT = 2;
  const [openGroup, setOpenGroup] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [days, setDays] = useState(null);
  const [showChampionReveal, setShowChampionReveal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [contactMsgGroup, setContactMsgGroup] = useState(null);
  const [groupScores, setGroupScores] = useState({});
  const [lockedGroupScores, setLockedGroupScores] = useState({});
  const [bracketScores, setBracketScores] = useState({});
  const [scoreOpenGroup, setScoreOpenGroup] = useState(null);
  const [liveActive, setLiveActive] = useState(false);
  const [finalScore, setFinalScore] = useState({ home: '', away: '' });
  const pendingGroupRef = useRef(null);

  const thirdRef      = useRef(null);
  const bracketRef    = useRef(null);
  const treeScrollRef = useRef(null);

  useEffect(() => {
    const d = Math.ceil((new Date('2026-06-11') - new Date()) / 86400000);
    setDays(d);
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
          if (data.analyses) setAnalyses(data.analyses);
          if (data.groupScores) setGroupScores(data.groupScores);
          if (data.bracketScores) setBracketScores(data.bracketScores);
          if (data.finalScore) setFinalScore(data.finalScore);
        }
      }
    } catch {}
    try {
      const savedCalls = localStorage.getItem('wc2026-ai-calls');
      if (savedCalls) setAiCallsUsed(parseInt(savedCalls, 10) || 0);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('wc2026-v2', JSON.stringify({ picks, thirdPlacePicks, bracketPicks, analyses, groupScores, bracketScores, finalScore }));
  }, [picks, thirdPlacePicks, bracketPicks, analyses, hydrated]);

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === 'SIGNED_IN') {
        // Reset client counter — server is authoritative for logged-in users
        setAiCallsUsed(0);
        localStorage.removeItem('wc2026-ai-calls');
        // Auto-open pending group if user just signed in to unlock it
        if (pendingGroupRef.current) {
          setOpenGroup(pendingGroupRef.current);
          pendingGroupRef.current = null;
        }
      }
      if (event === 'SIGNED_OUT') {
        // Restore anon counter
        try {
          const saved = localStorage.getItem('wc2026-ai-calls');
          setAiCallsUsed(parseInt(saved, 10) || 0);
        } catch {}
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Live score polling ────────────────────────────────────────────────
  useEffect(() => {
    const fetchLive = () => {
      fetch('/api/live-scores')
        .then(r => r.json())
        .then(data => {
          if (data.active && data.count > 0) {
            setLiveActive(true);
            setLockedGroupScores(prev => ({ ...prev, ...data.groupScores }));
            setGroupScores(prev => ({ ...prev, ...data.groupScores }));
          }
        })
        .catch(() => {});
    };
    fetchLive();
    const interval = setInterval(fetchLive, 5 * 60 * 1000); // every 5 min
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
      const standings = calcGroupStandings(group, groupScores);
      if (standings.length < 3) return;
      updates[group.id] = {
        [standings[0].name]: 1,
        [standings[1].name]: 2,
        [standings[2].name]: 3,
      };
    });
    if (Object.keys(updates).length === 0) return;
    setPicks(prev => ({ ...prev, ...updates }));
    setBracketPicks(initBracket());
  }, [groupScores]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const standings = calcGroupStandings(group, groupScores);
      const t = standings[2];
      return t ? { groupId: group.id, ...t } : null;
    }).filter(Boolean);
    if (thirds.length < 12) return;
    const top8 = [...thirds]
      .sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf)
      .slice(0,8)
      .map(t => t.groupId);
    setThirdPlacePicks(top8);
  }, [groupScores]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const groupComplete = (groupId) => {
    const g = picks[groupId] || {};
    const r = Object.values(g);
    return r.includes(1) && r.includes(2) && r.includes(3);
  };
  const completedCount = GROUPS.filter(g => groupComplete(g.id)).length;
  const allGroupsDone = completedCount === 12;

  const thirdPlaceCandidates = useMemo(() => GROUPS.map(g => {
    const name = getTeamByRank(picks, g.id, 3);
    if (!name) return null;
    const obj = getTeamObj(g.id, name);
    return { groupId: g.id, name, flag: obj?.flag || '' };
  }).filter(Boolean), [picks]);

  const toggleThirdPlace = (groupId) => {
    setThirdPlacePicks(prev => {
      if (prev.includes(groupId)) return prev.filter(g => g !== groupId);
      if (prev.length >= 8) return prev;
      return [...prev, groupId];
    });
    setBracketPicks(initBracket());
  };
  const thirdPlaceDone = thirdPlacePicks.length === 8;

  const fetchAnalysis = async (groupId) => {
    // Anonymous: 1 free call, then login wall
    if (!user && aiCallsUsed >= 2) {
      pendingGroupRef.current = groupId;
      setShowAuthModal(true);
      return;
    }
    // Logged-in: client-side guard (server is authoritative via 429)
    if (user && aiCallsUsed >= AI_LIMIT) return;

    const teams = GROUPS.find(g => g.id === groupId)?.teams.map(t => t.name) || [];
    setLoadingAnalysis(prev => ({ ...prev, [groupId]: true }));
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupId, teams }),
      });
      if (res.status === 429) {
        setAiCallsUsed(AI_LIMIT); // server confirmed limit reached
        return;
      }
      const data = await res.json();
      setAnalyses(prev => ({ ...prev, [groupId]: data.result }));
      // Only count as a used call if the analysis actually returned data
      if (data.result?.teams?.length > 0) {
        setAiCallsUsed(prev => {
          const next = prev + 1;
          if (!user) localStorage.setItem('wc2026-ai-calls', String(next));
          return next;
        });
      }
    } catch {
      setAnalyses(prev => ({ ...prev, [groupId]: { summary: 'Analysis unavailable. Try again.', teams: [] } }));
    } finally {
      setLoadingAnalysis(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const thirdAssignment = useMemo(() => {
    const key = [...thirdPlacePicks].sort().join('');
    const scenario = ANNEX_C[key];
    if (scenario) return scenario;
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

  const r32Matchups = useMemo(() => R32_DEFS.map(([h,a]) => ({ home:resolveDesc(h,picks,thirdAssignment), away:resolveDesc(a,picks,thirdAssignment) })), [picks, thirdAssignment]);
  const r16Matchups = useMemo(() => R16_PAIRS.map(([hi,ai]) => ({ home:resolveWinner(r32Matchups[hi],bracketPicks.r32[hi]), away:resolveWinner(r32Matchups[ai],bracketPicks.r32[ai]) })), [r32Matchups, bracketPicks.r32]);
  const qfMatchups  = useMemo(() => QF_PAIRS.map(([hi,ai]) => ({ home:resolveWinner(r16Matchups[hi],bracketPicks.r16[hi]), away:resolveWinner(r16Matchups[ai],bracketPicks.r16[ai]) })), [r16Matchups, bracketPicks.r16]);
  const sfMatchups  = useMemo(() => SF_PAIRS.map(([hi,ai]) => ({ home:resolveWinner(qfMatchups[hi],bracketPicks.qf[hi]), away:resolveWinner(qfMatchups[ai],bracketPicks.qf[ai]) })), [qfMatchups, bracketPicks.qf]);
  const finalMatchup = useMemo(() => ({ home:resolveWinner(sfMatchups[0],bracketPicks.sf[0]), away:resolveWinner(sfMatchups[1],bracketPicks.sf[1]) }), [sfMatchups, bracketPicks.sf]);
  const thirdMatchup = useMemo(() => ({ home:resolveLoser(sfMatchups[0],bracketPicks.sf[0]), away:resolveLoser(sfMatchups[1],bracketPicks.sf[1]) }), [sfMatchups, bracketPicks.sf]);

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

  const reset = () => {
    if (confirm('Clear all picks?')) {
      setPicks({}); setThirdPlacePicks([]); setBracketPicks(initBracket()); setAnalyses({});
      setGroupScores({}); setBracketScores({}); setLockedGroupScores({}); setFinalScore({ home:'', away:'' });
      setOpenGroup(null); setScoreOpenGroup(null);
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
      const name = getTeamByRank(picks, gid, rank);
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
      const name = getTeamByRank(picks, gid, 3);
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
            {allGroupsDone && !thirdPlaceDone && (
              <button className="btn btn-ghost" onClick={() => scrollTo(thirdRef)}>Pick 3rd places</button>
            )}
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
              <span className="hero-pill">AI PREDICTOR</span>
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
            {[{ n:'48',label:'Teams'},{n:'12',label:'Groups'},{n:'104',label:'Matches'},{n:'16',label:'Venues'},{n:'3',label:'Host Nations'},{n:'39',label:'Days'}].map(s => (
              <div key={s.label} className="stat-tile">
                <div className="stat-n">{s.n}</div>
                <div className="stat-l">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                Rank each group 1–2–3. Top two qualify directly; third place enters the best-eight race.
                Tap <b>AI Analysis</b> for a live scouting briefing.
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
              isOpen={openGroup === group.id} analysis={analyses[group.id]} loading={loadingAnalysis[group.id]}
              limitReached={user ? aiCallsUsed >= AI_LIMIT : aiCallsUsed >= 2}
              contactMsg={contactMsgGroup === group.id}
              groupScores={groupScores}
              scoreOpen={scoreOpenGroup === group.id}
              onToggleScore={() => setScoreOpenGroup(scoreOpenGroup === group.id ? null : group.id)}
              onScoreChange={setGroupScore}
              lockedGroupScores={lockedGroupScores}
              onToggleAI={() => {
                const isNowOpen = openGroup !== group.id;
                const atLimit = user ? aiCallsUsed >= AI_LIMIT : aiCallsUsed >= 2;
                if (isNowOpen && atLimit && !analyses[group.id]) {
                  // At limit with no cache: show contact message instead
                  setOpenGroup(group.id);
                  setContactMsgGroup(group.id);
                } else {
                  setContactMsgGroup(null);
                  setOpenGroup(isNowOpen ? group.id : null);
                  if (isNowOpen && !analyses[group.id] && !loadingAnalysis[group.id]) fetchAnalysis(group.id);
                }
              }}
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
              Choose decisively — placement sets your bracket path.
            </p>
          </div>
          <ThirdPlacePicker candidates={thirdPlaceCandidates} picks={thirdPlacePicks}
            allGroupsDone={allGroupsDone} onToggle={toggleThirdPlace} />
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
              Click a team to advance them. Every pick cascades through all downstream rounds — right to the champion.
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
          bracketScores={bracketScores} setBracketScore={setBracketScore} />
      </section>

      <footer className="footer">
        <span>World Cup 2026 AI Predictor · fan-made, not affiliated with FIFA</span>
        <span className="footer-dim">Predictions are for entertainment only</span>
      </footer>
    </main>
  );
}
