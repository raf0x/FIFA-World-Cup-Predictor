'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { GROUPS } from '../lib/groups';
import { ANNEX_C } from '../lib/annex_c';
import { MATCH_SCHEDULE } from '../lib/schedule';

// ─── Design tokens ────────────────────────────────────────────────────────
const GROUP_COLORS = {
  A:'#39ff14', B:'#06b6d4', C:'#8b5cf6', D:'#fbbf24',
  E:'#fb923c', F:'#f87171', G:'#ec4899', H:'#22d3ee',
  I:'#a78bfa', J:'#facc15', K:'#fb7185', L:'#34d399',
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
              <p className="ai-note"><b>{t.name}.</b> {t.note}</p>
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
function GroupStageCard({ group, groupPicks, complete, isOpen, analysis, loading, onToggleAI, onSetRank }) {
  const color = GROUP_COLORS[group.id];
  const rankedCount = Object.keys(groupPicks).length;
  return (
    <div className={`gcard ${complete ? 'gcard--done' : ''}`} style={complete ? { '--gc': color } : {}}>
      <div className="gcard-head">
        <div className="gcard-id">
          <span className="gchip" style={{ background: color, boxShadow:`0 0 14px ${color}66` }}>{group.id}</span>
          <div>
            <div className="gcard-title">Group {group.id}</div>
            <div className="gcard-meta">
              {complete
                ? <span className="gcard-done-tag">✓ Complete</span>
                : <span>{rankedCount}/3 ranked · top 2 advance</span>}
            </div>
          </div>
        </div>
        <button className={`ai-toggle ${isOpen ? 'ai-toggle--on' : ''}`} onClick={onToggleAI}>
          {loading
            ? <><span className="ai-spinner ai-spinner--sm" /> Analyzing</>
            : isOpen ? 'Hide AI' : '◆ AI Analysis'}
        </button>
      </div>

      {isOpen && <AIPanel loading={loading} analysis={analysis} color={color} />}

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
function BracketSlot({ matchup, picked, onPick, matchNum, wide }) {
  const { home, away } = matchup;
  const bothKnown = home.name && away.name;
  const info = matchNum ? MATCH_SCHEDULE[matchNum] : null;
  const title = info ? `M${matchNum} · ${info.date} · ${info.time} · ${info.venue}` : undefined;
  return (
    <div className={`slot ${wide ? 'slot--wide' : ''}`} title={title}>
      {[home, away].map((team, i) => {
        const isPicked = team.name !== null && picked === team.name;
        const isOther = picked && picked !== team.name;
        const clickable = bothKnown && team.name;
        return (
          <button key={i}
            className={`slotrow ${isPicked ? 'slotrow--pick' : ''} ${isOther ? 'slotrow--out' : ''} ${clickable ? 'slotrow--live' : ''}`}
            onClick={() => clickable && onPick(isPicked ? null : team.name)}
            disabled={!clickable}>
            <span className="slot-flag"><Flag team={team} size={11} /></span>
            <span className="slot-name">{team.name || team.display}</span>
            {isPicked && <span className="slot-adv">▸</span>}
          </button>
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
  const lines = [
    [176,34,176,102],[176,68,182,68],[176,170,176,238],[176,204,182,204],
    [176,306,176,374],[176,340,182,340],[176,442,176,510],[176,476,182,476],
    [292,68,292,204],[292,136,298,136],[292,340,292,476],[292,408,298,408],
    [408,136,408,408],[408,272,414,272],[524,272,530,272],
    [1076,34,1076,102],[1070,68,1076,68],[1076,170,1076,238],[1070,204,1076,204],
    [1076,306,1076,374],[1070,340,1076,340],[1076,442,1076,510],[1070,476,1076,476],
    [960,68,960,204],[954,136,960,136],[960,340,960,476],[954,408,960,408],
    [844,136,844,408],[838,272,844,272],[728,272,722,272],
  ];
  return (
    <svg width="1252" height="544" className="bracket-svg" style={{ minWidth:1252 }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a3550" />
          <stop offset="100%" stopColor="#3a4a6b" />
        </linearGradient>
      </defs>
      {lines.map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#lg)" strokeWidth="1.5" strokeLinecap="round" />
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

function ChampionReveal({ champion, championObj, finalMatchup, thirdMatchup, bracketPicks, pickBracket }) {
  return (
    <div className="champ-col">
      {champion && <Confetti id={champion} />}
      <div className={`trophy ${champion ? 'trophy--won' : ''}`}>🏆</div>
      {champion ? (
        <div className="champ-name-wrap">
          <div className="champ-eyebrow">World Champion</div>
          <div className="champ-name"><Flag team={championObj || { flag:'🏆', name:champion }} size={16} /> {champion}</div>
        </div>
      ) : (
        <div className="champ-placeholder">Champion</div>
      )}
      <div className="champ-div" />
      <div className="champ-match">
        <div className="champ-match-label" style={{ color:'#f5c142' }}>Final · Jul 19 · NY/NJ</div>
        <BracketSlot matchup={finalMatchup} picked={bracketPicks.final} onPick={n => pickBracket('final',0,n)} matchNum={104} wide />
      </div>
      <div className="champ-match" style={{ marginTop:8 }}>
        <div className="champ-match-label">3rd Place · Jul 18 · Miami</div>
        <BracketSlot matchup={thirdMatchup} picked={bracketPicks.thirdPlace} onPick={n => pickBracket('thirdPlace',0,n)} matchNum={103} wide />
      </div>
    </div>
  );
}

function Bracket({ thirdPlaceDone, r32Matchups, r16Matchups, qfMatchups, sfMatchups,
                   finalMatchup, thirdMatchup, bracketPicks, pickBracket,
                   champion, championObj, r32Done, r16Done, qfDone, sfDone }) {
  if (!thirdPlaceDone) {
    return <div className="locked locked--dark locked--big">Select your 8 third-place teams above to unlock the bracket.</div>;
  }
  return (
    <>
      <div className="tree-scroll">
        <div className="tree">
          <BracketLines />
          <div className="tree-col tree-groups">
            {GROUPS.slice(0,6).map(g => <GroupBox key={g.id} group={g} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.r32.map(idx => <BracketSlot key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n=>pickBracket('r32',idx,n)} matchNum={73+idx} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.r16.map(idx => <BracketSlot key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n=>pickBracket('r16',idx,n)} matchNum={89+idx} />)}
          </div>
          <div className="tree-col">
            {BRACKET_L.qf.map(idx => <BracketSlot key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n=>pickBracket('qf',idx,n)} matchNum={97+idx} />)}
          </div>
          <div className="tree-col">
            <BracketSlot matchup={sfMatchups[0]} picked={bracketPicks.sf[0]} onPick={n=>pickBracket('sf',0,n)} matchNum={101} />
          </div>
          <ChampionReveal champion={champion} championObj={championObj}
            finalMatchup={finalMatchup} thirdMatchup={thirdMatchup}
            bracketPicks={bracketPicks} pickBracket={pickBracket} />
          <div className="tree-col">
            <BracketSlot matchup={sfMatchups[1]} picked={bracketPicks.sf[1]} onPick={n=>pickBracket('sf',1,n)} matchNum={102} />
          </div>
          <div className="tree-col">
            {BRACKET_R.qf.map(idx => <BracketSlot key={idx} matchup={qfMatchups[idx]} picked={bracketPicks.qf[idx]} onPick={n=>pickBracket('qf',idx,n)} matchNum={97+idx} />)}
          </div>
          <div className="tree-col">
            {BRACKET_R.r16.map(idx => <BracketSlot key={idx} matchup={r16Matchups[idx]} picked={bracketPicks.r16[idx]} onPick={n=>pickBracket('r16',idx,n)} matchNum={89+idx} />)}
          </div>
          <div className="tree-col">
            {BRACKET_R.r32.map(idx => <BracketSlot key={idx} matchup={r32Matchups[idx]} picked={bracketPicks.r32[idx]} onPick={n=>pickBracket('r32',idx,n)} matchNum={73+idx} />)}
          </div>
          <div className="tree-col tree-groups">
            {GROUPS.slice(6).map(g => <GroupBox key={g.id} group={g} />)}
          </div>
        </div>
        <div className="tree-labels">
          <div style={{ width:60 }} />
          {['Round of 32','Round of 16','Quarterfinals','Semifinals'].map(l => <div key={l} className="tlabel">{l}</div>)}
          <div className="tlabel tlabel--c">Final</div>
          {['Semifinals','Quarterfinals','Round of 16','Round of 32'].map(l => <div key={l+'r'} className="tlabel">{l}</div>)}
          <div style={{ width:60 }} />
        </div>
      </div>

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
  const [openGroup, setOpenGroup] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [days, setDays] = useState(null);

  const thirdRef = useRef(null);
  const bracketRef = useRef(null);

  useEffect(() => {
    const d = Math.ceil((new Date('2026-06-11') - new Date()) / 86400000);
    setDays(d);
    try {
      const saved = localStorage.getItem('wc2026-v2');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.picks) setPicks(data.picks);
        if (data.thirdPlacePicks) setThirdPlacePicks(data.thirdPlacePicks);
        if (data.bracketPicks) setBracketPicks(data.bracketPicks);
        if (data.analyses) setAnalyses(data.analyses);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('wc2026-v2', JSON.stringify({ picks, thirdPlacePicks, bracketPicks, analyses }));
  }, [picks, thirdPlacePicks, bracketPicks, analyses, hydrated]);

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
      const u = { ...prev };
      if (round==='r32') { u.r32=[...prev.r32]; u.r32[idx]=name; u.r16=Array(8).fill(null); u.qf=Array(4).fill(null); u.sf=Array(2).fill(null); u.final=null; u.thirdPlace=null; }
      else if (round==='r16') { u.r16=[...prev.r16]; u.r16[idx]=name; u.qf=Array(4).fill(null); u.sf=Array(2).fill(null); u.final=null; u.thirdPlace=null; }
      else if (round==='qf') { u.qf=[...prev.qf]; u.qf[idx]=name; u.sf=Array(2).fill(null); u.final=null; u.thirdPlace=null; }
      else if (round==='sf') { u.sf=[...prev.sf]; u.sf[idx]=name; u.final=null; u.thirdPlace=null; }
      else if (round==='final') u.final=name;
      else if (round==='thirdPlace') u.thirdPlace=name;
      return u;
    });
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
      setPicks({}); setThirdPlacePicks([]); setBracketPicks(initBracket()); setAnalyses({}); setOpenGroup(null);
    }
  };
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const downloadPredictions = () => {
    const teamOf = (gid, rank) => {
      const name = getTeamByRank(picks, gid, rank);
      const obj = name ? getTeamObj(gid, name) : null;
      const fl = obj?.flag && !/^[a-z]{2,3}$/.test(obj.flag) ? obj.flag : (obj?.flag ? obj.flag.toUpperCase() : '');
      return name ? `${fl} ${name}` : '—';
    };
    const groupRows = GROUPS.map(g => `
      <div style="background:#12121a;border:1px solid #1e1e2e;border-radius:12px;padding:14px">
        <div style="font-size:11px;font-weight:800;color:${GROUP_COLORS[g.id]};letter-spacing:.1em;margin-bottom:10px">GROUP ${g.id}</div>
        <div style="display:grid;gap:6px">
          <div style="font-size:13px;color:#f5c142">1 ${teamOf(g.id,1)}</div>
          <div style="font-size:13px;color:#c2cad6">2 ${teamOf(g.id,2)}</div>
          <div style="font-size:13px;color:#cf8a4f">3 ${teamOf(g.id,3)}</div>
        </div>
      </div>`).join('');
    const champBlock = champion ? `
      <div style="text-align:center;margin:0 0 36px;padding:36px;background:radial-gradient(120% 140% at 50% 0,rgba(245,193,66,.18),transparent),#12121a;border:1px solid rgba(245,193,66,.4);border-radius:20px">
        <div style="font-size:64px">🏆</div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.25em;color:#f5c142;margin:8px 0 4px">2026 WORLD CHAMPION</div>
        <div style="font-size:40px;font-weight:900;color:#fff">${champion}</div>
      </div>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>My WC2026 Predictions</title>
      <style>*{margin:0;box-sizing:border-box}body{background:#0a0a12;color:#fff;font-family:ui-sans-serif,system-ui,sans-serif;padding:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
      <body><div style="height:5px;background:linear-gradient(90deg,#39ff14,#06b6d4,#a78bfa,#f5c142,#fb7185)"></div>
      <div style="max-width:1040px;margin:0 auto;padding:40px 28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:.25em;color:#8b8ba7">FIFA WORLD CUP 2026 · MY PREDICTIONS</div>
      <div style="font-size:34px;font-weight:900;margin:6px 0 30px">Tournament Bracket</div>
      ${champBlock}
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;color:#8b8ba7;margin-bottom:14px">GROUP STAGE</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px">${groupRows}</div>
      <div style="text-align:center;color:#3d3d5c;font-size:11px;margin-top:36px">Generated ${new Date().toLocaleDateString()} · Not affiliated with FIFA</div>
      </div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'WC2026-My-Predictions.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const pct = (completedCount / 12) * 100;
  const r = 13, circumference = 2 * Math.PI * r;

  return (
    <main className="page">

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
          <div className="eyebrow">Stage 01 · Group Draw</div>
          <h2 className="section-title">Group Stage</h2>
          <p className="section-desc">
            Rank each group 1–2–3. Top two qualify directly; third place enters the best-eight race.
            Tap <b>AI Analysis</b> for a live scouting briefing.
          </p>
        </div>
        <div className="groups-grid">
          {GROUPS.map(group => (
            <GroupStageCard key={group.id} group={group}
              groupPicks={picks[group.id] || {}} complete={groupComplete(group.id)}
              isOpen={openGroup === group.id} analysis={analyses[group.id]} loading={loadingAnalysis[group.id]}
              onToggleAI={() => {
                const isNowOpen = openGroup !== group.id;
                setOpenGroup(isNowOpen ? group.id : null);
                if (isNowOpen && !analyses[group.id] && !loadingAnalysis[group.id]) fetchAnalysis(group.id);
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
          r32Done={r32Done} r16Done={r16Done} qfDone={qfDone} sfDone={sfDone} />
      </section>

      <footer className="footer">
        <span>World Cup 2026 AI Predictor · fan-made, not affiliated with FIFA</span>
        <span className="footer-dim">Predictions are for entertainment only</span>
      </footer>
    </main>
  );
}
