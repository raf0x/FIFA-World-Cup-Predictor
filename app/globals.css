@tailwind base;
@tailwind components;
@tailwind utilities;

/* ─── Design tokens ───────────────────────────────────────────────────────── */
:root {
  --bg:          #0a0a12;
  --surface:     #0e0e1a;
  --surface-2:   #141422;
  --surface-3:   #1a1a2e;
  --border:      #1e1e30;
  --border-2:    #2a2a42;
  --text:        #f0f0f2;
  --dim:         #7a7a9a;
  --dim-2:       #4a4a6a;
  --green:       #39ff14;
  --gold:        #f5c142;
  --gold-dim:    rgba(245,193,66,.18);
  --ease:        cubic-bezier(.22,.68,0,1.2);
  --ease-out:    cubic-bezier(0,.55,.45,1);
}

/* ─── Base ────────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
}
button { font: inherit; cursor: pointer; border: none; background: none; }
a { color: inherit; }

/* ─── Page layout ─────────────────────────────────────────────────────────── */
.page { min-height: 100dvh; }

.section {
  padding: 56px 24px;
  max-width: 1280px;
  margin: 0 auto;
}
.section--alt { background: var(--surface); border-radius: 0; padding: 56px 24px; max-width: 100%; }
.section--alt .section-inner { max-width: 1280px; margin: 0 auto; }
.section--bracket {
  background: var(--bg);
  padding: 48px 0 0;
  max-width: 100%;
}
.section--bracket .section-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px 48px; }

.eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .18em;
  color: var(--dim);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.section-title {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 900;
  color: var(--text);
  line-height: 1.1;
  margin-bottom: 10px;
}
.section-desc {
  font-size: 14px;
  color: var(--dim);
  line-height: 1.65;
  max-width: 600px;
}
.section-head { margin-bottom: 36px; }

/* ─── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: opacity .15s, transform .1s;
}
.btn:hover { opacity: .85; }
.btn:active { transform: scale(.97); }

.btn-green  { background: var(--green); color: #0a0a12; }
.btn-gold   { background: transparent; color: var(--gold); border: 1.5px solid var(--gold); }
.btn-ghost  { background: var(--surface-2); color: var(--text); border: 1px solid var(--border-2); }
.btn-bare   { color: var(--dim); }
.btn-bare:hover { color: var(--text); }
.btn-lg     { padding: 11px 24px; font-size: 15px; border-radius: 10px; }

/* ─── Flag monogram chip ──────────────────────────────────────────────────── */
.flagmono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: var(--surface-3);
  border: 1px solid var(--border-2);
  color: var(--dim);
  font-weight: 800;
  font-size: 9px;
  letter-spacing: .04em;
  flex-shrink: 0;
}

/* ─── Progress header ─────────────────────────────────────────────────────── */
.phead {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(10,10,18,.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.phead-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.phead-left  { display: flex; align-items: center; gap: 14px; }
.phead-right { display: flex; align-items: center; gap: 8px; }

.ring { position: relative; width: 34px; height: 34px; flex-shrink: 0; }
.ring-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--text);
}

.phead-steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pstep        { font-size: 13px; color: var(--dim); transition: color .2s; }
.pstep--on    { color: var(--text); }
.pstep--off   { opacity: .35; }
.pstep b      { font-weight: 700; }
.psep         { color: var(--border-2); font-size: 12px; }

/* ─── Hero ────────────────────────────────────────────────────────────────── */
.hero {
  position: relative;
  overflow: hidden;
  background: var(--bg);
  padding: 52px 24px 56px;
}
.hero-accent {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, #39ff14, #06b6d4, #8b5cf6, #f5c142, #fb923c, #f87171);
}
.hero-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.hero-glow-a {
  width: 500px; height: 400px;
  top: -120px; left: -80px;
  background: rgba(57,255,20,.06);
}
.hero-glow-b {
  width: 400px; height: 300px;
  top: -60px; right: 10%;
  background: rgba(245,193,66,.07);
}

.hero-inner {
  position: relative;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  flex-wrap: wrap;
}
.hero-left { flex: 1; min-width: 300px; }

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .2em;
  color: var(--green);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.livedot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
.hero-hosts { font-size: 16px; letter-spacing: .05em; }

.hero-title {
  display: flex;
  flex-direction: column;
  line-height: 1;
  margin-bottom: 20px;
}
.hero-title-1 {
  font-size: clamp(52px, 8vw, 90px);
  font-weight: 900;
  color: var(--text);
  letter-spacing: -.02em;
}
.hero-title-2 {
  font-size: clamp(52px, 8vw, 90px);
  font-weight: 900;
  color: var(--text);
  letter-spacing: -.02em;
}
.hero-26 { color: var(--gold); }

.hero-sub-row { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
.hero-pill {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
  color: var(--green);
  border: 1.5px solid rgba(57,255,20,.4);
  background: rgba(57,255,20,.06);
  align-self: flex-start;
}
.hero-sub { font-size: 14px; color: var(--dim); line-height: 1.6; max-width: 440px; }

.hero-countdown {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.cd-num  { font-size: 36px; font-weight: 900; color: var(--text); line-height: 1; }
.cd-live { font-size: 14px; font-weight: 800; color: var(--green); letter-spacing: .06em; }
.cd-label {
  font-size: 13px;
  color: var(--dim);
  line-height: 1.5;
}
.cd-label b { color: var(--text); font-weight: 700; }

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--border);
  min-width: 280px;
}
.stat-tile {
  background: var(--surface);
  padding: 20px 18px;
  text-align: center;
  transition: background .2s;
}
.stat-tile:hover { background: var(--surface-2); }
.stat-n { font-size: 32px; font-weight: 900; color: var(--text); line-height: 1; }
.stat-l { font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--dim); text-transform: uppercase; margin-top: 4px; }

/* ─── Groups grid ─────────────────────────────────────────────────────────── */
.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* ─── Group card ──────────────────────────────────────────────────────────── */
.gcard {
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 20px;
  transition: border-color .2s;
}
.gcard--done {
  border-color: color-mix(in srgb, var(--gc, #39ff14) 35%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--gc, #39ff14) 12%, transparent) inset;
}

.gcard-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.gcard-id { display: flex; align-items: center; gap: 12px; }
.gchip {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 900;
  color: #0a0a12;
  flex-shrink: 0;
}
.gcard-title { font-size: 16px; font-weight: 800; color: var(--text); line-height: 1.2; }
.gcard-meta  { font-size: 12px; color: var(--dim); margin-top: 2px; }
.gcard-done-tag { color: var(--green); font-weight: 700; }

.ai-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--dim);
  border: 1px solid var(--border-2);
  background: var(--surface-2);
  white-space: nowrap;
  transition: all .15s;
  flex-shrink: 0;
}
.ai-toggle:hover { color: var(--text); border-color: var(--dim); }
.ai-toggle--on { color: var(--text); border-color: var(--border-2); background: var(--surface-3); }

/* Team rows */
.gcard-teams { display: flex; flex-direction: column; gap: 6px; }
.trow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-2);
  transition: background .15s;
}
.trow:hover { background: var(--surface-3); }
.trow-id { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.trow-name { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; truncate: clip; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trow-rank { font-size: 11px; color: var(--dim-2); font-weight: 700; flex-shrink: 0; }
.trow-tag  { font-size: 10px; font-weight: 800; letter-spacing: .07em; flex-shrink: 0; }

.rankbtns { display: flex; gap: 4px; flex-shrink: 0; }
.rankbtn {
  width: 28px; height: 28px;
  border-radius: 7px;
  font-size: 12px; font-weight: 800;
  color: var(--dim);
  background: var(--surface-3);
  border: 1px solid var(--border-2);
  transition: all .12s;
}
.rankbtn:hover { color: var(--text); border-color: var(--dim); }
.rankbtn--on { color: #0a0a12 !important; border-color: transparent !important; }

/* ─── AI Panel ────────────────────────────────────────────────────────────── */
.aipanel {
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  padding: 16px;
  margin-bottom: 14px;
}
.ai-loading { display: flex; align-items: flex-start; gap: 12px; }
.ai-spinner {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border-2);
  border-top-color: var(--gold);
  animation: spin .7s linear infinite;
  flex-shrink: 0;
  margin-top: 2px;
}
.ai-spinner--sm { width: 11px; height: 11px; }
@keyframes spin { to { transform: rotate(360deg); } }
.ai-load-1 { font-size: 13px; font-weight: 700; color: var(--text); }
.ai-load-2 { font-size: 11px; color: var(--dim); margin-top: 3px; }

.ai-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ai-badge { font-size: 11px; font-weight: 800; letter-spacing: .1em; }
.ai-conf  { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; }
.ai-conf-dot { width: 6px; height: 6px; border-radius: 50%; }

.ai-summary { font-size: 12px; color: var(--dim); font-style: italic; margin-bottom: 12px; line-height: 1.55; }
.ai-teams { display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; }
.ai-team { display: flex; align-items: flex-start; gap: 8px; }
.ai-rank {
  width: 20px; height: 20px;
  border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800;
  flex-shrink: 0;
}
.ai-note { font-size: 12px; color: var(--text); line-height: 1.5; }
.ai-note b { font-weight: 700; }

.ai-foot { border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 5px; }
.ai-foot-row { display: flex; align-items: baseline; gap: 8px; font-size: 12px; flex-wrap: wrap; }
.ai-foot-k { font-weight: 700; flex-shrink: 0; color: var(--dim); }
.ai-foot-v { color: var(--dim); flex: 1; }
.ai-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.ai-chip {
  padding: 2px 8px; border-radius: 99px;
  background: rgba(57,255,20,.1);
  color: var(--green);
  font-size: 11px; font-weight: 700;
  border: 1px solid rgba(57,255,20,.25);
}
.ai-empty { font-size: 13px; color: var(--dim); font-style: italic; }

/* ─── Third place ─────────────────────────────────────────────────────────── */
.third-slots {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.slot-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--border-2);
  transition: background .2s, box-shadow .2s;
}
.slot-dot--on {
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
}
.third-count { font-size: 13px; font-weight: 700; color: var(--text); margin-left: 4px; }
.third-count-of { font-weight: 500; color: var(--dim); }

.third-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.third-card {
  text-align: left;
  padding: 14px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  transition: all .15s;
}
.third-card:hover:not(.third-card--cap) { border-color: var(--border-2); background: var(--surface-2); }
.third-card--on {
  border-color: color-mix(in srgb, var(--gc, #39ff14) 50%, transparent);
  background: color-mix(in srgb, var(--gc, #39ff14) 8%, var(--surface));
}
.third-card--cap { opacity: .35; cursor: not-allowed; }

.third-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.third-grp { font-size: 10px; font-weight: 800; letter-spacing: .1em; }
.third-check { font-size: 12px; color: var(--green); font-weight: 800; }
.third-team { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.third-name { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.third-status { font-size: 10px; font-weight: 800; letter-spacing: .1em; color: var(--dim); text-transform: uppercase; }
.third-card--on .third-status { color: var(--green); }

.third-cta { margin-top: 28px; display: flex; justify-content: flex-end; }
.locked {
  padding: 28px;
  border-radius: 12px;
  border: 1px dashed var(--border-2);
  text-align: center;
  font-size: 14px;
  color: var(--dim);
}
.locked--dark { border-color: var(--border); background: var(--surface); }
.locked--big  { padding: 48px; font-size: 15px; }

/* ─── Bracket tree ────────────────────────────────────────────────────────── */
.tree-scroll { overflow-x: auto; padding-bottom: 20px; }
.tree {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 6px;
  height: 544px;
  min-width: 1252px;
}
.tree-col {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 544px;
}
.tree-groups { width: 60px; gap: 0; }
.bracket-svg {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 1;
}

.tree-labels {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 1252px;
  padding: 10px 0 0;
}
.tlabel {
  flex: 1;
  text-align: center;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--dim-2);
}
.tlabel--c { flex: 1.6; }

/* Bracket match slot */
.slot {
  width: 110px;
  flex-shrink: 0;
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface);
  z-index: 2;
}
.slot--wide { width: 130px; }

.slotrow {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 7px;
  border-top: 1px solid var(--border);
  font-size: 10px;
  text-align: left;
  color: var(--dim);
  transition: background .12s;
}
.slotrow:first-child { border-top: none; }
.slotrow--live { color: var(--text); }
.slotrow--live:hover { background: var(--surface-2); cursor: pointer; }
.slotrow--pick { background: rgba(57,255,20,.1); color: var(--green) !important; }
.slotrow--out  { color: var(--dim-2) !important; }
.slot-flag { flex-shrink: 0; display: flex; align-items: center; }
.slot-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slot-adv  { font-size: 9px; color: var(--green); flex-shrink: 0; }

/* Group box */
.gbox {
  width: 58px;
  height: 58px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--gc, #39ff14) 35%, transparent);
  background: color-mix(in srgb, var(--gc, #39ff14) 10%, var(--surface));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow: hidden;
  padding: 5px;
}
.gbox-flags { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
.gbox-cell  { display: flex; align-items: center; justify-content: center; }
.gbox-label {
  font-size: 7px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--gc, #39ff14) 80%, white);
  white-space: nowrap;
}

/* Champion center */
.champ-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 160px;
  flex: 1;
  padding: 0 8px;
  position: relative;
  z-index: 2;
}
.trophy { font-size: 40px; transition: transform .4s var(--ease); }
.trophy--won { animation: trophyPop .6s var(--ease) forwards; }
@keyframes trophyPop { 0%{transform:scale(.6)}70%{transform:scale(1.25)}100%{transform:scale(1)} }
.champ-name-wrap { text-align: center; }
.champ-eyebrow {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 3px;
}
.champ-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 900;
  color: var(--gold);
}
.champ-placeholder { font-size: 11px; color: var(--dim-2); letter-spacing: .1em; }
.champ-div { width: 1px; height: 20px; background: var(--border-2); }
.champ-match { width: 100%; }
.champ-match-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--dim);
  text-align: center;
  margin-bottom: 5px;
}

/* Mobile bracket */
.tree-mobile { display: none; }
@media (max-width: 1280px) {
  .tree-scroll { display: none; }
  .tree-mobile { display: block; }
}

.round-head { margin-bottom: 16px; }
.round-title { font-size: 18px; font-weight: 800; color: var(--text); }
.round-sub   { font-size: 13px; color: var(--dim); margin-top: 3px; }
.round-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }

.mcard {
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
}
.mcard-head {
  padding: 8px 12px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.mcard-num  { font-size: 11px; font-weight: 800; color: var(--dim); }
.mcard-info { font-size: 11px; color: var(--dim-2); }
.mcard-rows { }

.mrow {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  text-align: left;
  color: var(--dim);
  border-top: 1px solid var(--border);
  font-size: 13px;
  transition: background .12s;
}
.mrow:first-child { border-top: none; }
.mrow--live { color: var(--text); }
.mrow--live:hover { background: var(--surface-2); cursor: pointer; }
.mrow--pick { background: rgba(57,255,20,.08); color: var(--green) !important; }
.mrow--out  { color: var(--dim-2) !important; }
.mrow-name  { flex: 1; font-weight: 600; }
.mrow-adv   { font-size: 11px; color: var(--green); font-weight: 700; flex-shrink: 0; }

.mfinals { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
@media (max-width: 640px) { .mfinals { grid-template-columns: 1fr; } }

.mchamp {
  position: relative;
  margin-top: 32px;
  text-align: center;
  padding: 40px 24px;
  border-radius: 20px;
  background: radial-gradient(120% 140% at 50% 0, rgba(245,193,66,.15), transparent), var(--surface);
  border: 1px solid rgba(245,193,66,.4);
  overflow: hidden;
}
.mchamp-name { font-size: 28px; font-weight: 900; color: var(--gold); margin-top: 6px; }

/* Confetti */
.confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.confetti-bit {
  position: absolute;
  top: -10px;
  width: 6px; height: 6px;
  border-radius: 2px;
  animation: fall linear forwards;
}
@keyframes fall {
  0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(560px) rotate(720deg); opacity: 0; }
}

/* Mobile round sections */
.tree-mobile > div + div { margin-top: 28px; }

/* ─── Footer ──────────────────────────────────────────────────────────────── */
.footer {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--dim-2);
  border-top: 1px solid var(--border);
  max-width: 100%;
}
.footer-dim { opacity: .6; }

/* ─── Section alt inner ───────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .hero-inner { flex-direction: column; }
  .hero-stats  { width: 100%; }
  .groups-grid { grid-template-columns: 1fr; }
}
