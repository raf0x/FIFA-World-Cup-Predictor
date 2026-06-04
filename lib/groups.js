/* ──────────────────────────────────────────────────────────────────────────
   World Cup 2026 Predictor — DATA LAYER
   Ported verbatim from raf0x/FIFA-World-Cup-Predictor (lib/groups.js,
   lib/schedule.js) + bracket constants from app/page.js.
   `rank` (approx. FIFA ranking) added for the premium data-card feel.
   ────────────────────────────────────────────────────────────────────────── */

const GROUPS = [
  { id: 'A', teams: [
    { name: 'Mexico', flag: '🇲🇽', rank: 13 },
    { name: 'South Africa', flag: '🇿🇦', rank: 56 },
    { name: 'Korea Republic', flag: '🇰🇷', rank: 23 },
    { name: 'Czechia', flag: '🇨🇿', rank: 42 },
  ]},
  { id: 'B', teams: [
    { name: 'Canada', flag: '🇨🇦', rank: 30 },
    { name: 'Bosnia and Herzegovina', flag: '🇧🇦', rank: 74 },
    { name: 'Qatar', flag: '🇶🇦', rank: 52 },
    { name: 'Switzerland', flag: '🇨🇭', rank: 19 },
  ]},
  { id: 'C', teams: [
    { name: 'Brazil', flag: '🇧🇷', rank: 5 },
    { name: 'Morocco', flag: '🇲🇦', rank: 11 },
    { name: 'Haiti', flag: '🇭🇹', rank: 83 },
    { name: 'Scotland', flag: 'sco', rank: 39 },
  ]},
  { id: 'D', teams: [
    { name: 'United States', flag: '🇺🇸', rank: 15 },
    { name: 'Paraguay', flag: '🇵🇾', rank: 48 },
    { name: 'Australia', flag: '🇦🇺', rank: 26 },
    { name: 'Türkiye', flag: '🇹🇷', rank: 27 },
  ]},
  { id: 'E', teams: [
    { name: 'Germany', flag: '🇩🇪', rank: 9 },
    { name: 'Curaçao', flag: '🇨🇼', rank: 82 },
    { name: 'Ivory Coast', flag: '🇨🇮', rank: 41 },
    { name: 'Ecuador', flag: '🇪🇨', rank: 24 },
  ]},
  { id: 'F', teams: [
    { name: 'Netherlands', flag: '🇳🇱', rank: 6 },
    { name: 'Japan', flag: '🇯🇵', rank: 18 },
    { name: 'Sweden', flag: '🇸🇪', rank: 43 },
    { name: 'Tunisia', flag: '🇹🇳', rank: 50 },
  ]},
  { id: 'G', teams: [
    { name: 'Belgium', flag: '🇧🇪', rank: 8 },
    { name: 'Egypt', flag: '🇪🇬', rank: 33 },
    { name: 'Iran', flag: '🇮🇷', rank: 21 },
    { name: 'New Zealand', flag: '🇳🇿', rank: 86 },
  ]},
  { id: 'H', teams: [
    { name: 'Spain', flag: '🇪🇸', rank: 2 },
    { name: 'Cape Verde', flag: '🇨🇻', rank: 70 },
    { name: 'Saudi Arabia', flag: '🇸🇦', rank: 58 },
    { name: 'Uruguay', flag: '🇺🇾', rank: 16 },
  ]},
  { id: 'I', teams: [
    { name: 'France', flag: '🇫🇷', rank: 3 },
    { name: 'Senegal', flag: '🇸🇳', rank: 17 },
    { name: 'Iraq', flag: '🇮🇶', rank: 59 },
    { name: 'Norway', flag: '🇳🇴', rank: 28 },
  ]},
  { id: 'J', teams: [
    { name: 'Argentina', flag: '🇦🇷', rank: 1 },
    { name: 'Algeria', flag: '🇩🇿', rank: 37 },
    { name: 'Austria', flag: '🇦🇹', rank: 22 },
    { name: 'Jordan', flag: '🇯🇴', rank: 64 },
  ]},
  { id: 'K', teams: [
    { name: 'Portugal', flag: '🇵🇹', rank: 7 },
    { name: 'DR Congo', flag: '🇨🇩', rank: 54 },
    { name: 'Uzbekistan', flag: '🇺🇿', rank: 57 },
    { name: 'Colombia', flag: '🇨🇴', rank: 12 },
  ]},
  { id: 'L', teams: [
    { name: 'England', flag: 'eng', rank: 4 },
    { name: 'Croatia', flag: '🇭🇷', rank: 10 },
    { name: 'Ghana', flag: '🇬🇭', rank: 46 },
    { name: 'Panama', flag: '🇵🇦', rank: 45 },
  ]},
];

const MATCH_SCHEDULE = {
  73:{date:'Sun Jun 28',time:'15:00 ET',venue:'Los Angeles'},
  74:{date:'Mon Jun 29',time:'16:30 ET',venue:'Boston'},
  75:{date:'Mon Jun 29',time:'21:00 ET',venue:'Monterrey'},
  76:{date:'Mon Jun 29',time:'13:00 ET',venue:'Houston'},
  77:{date:'Tue Jun 30',time:'17:00 ET',venue:'New York/New Jersey'},
  78:{date:'Tue Jun 30',time:'13:00 ET',venue:'Dallas'},
  79:{date:'Tue Jun 30',time:'21:00 ET',venue:'Mexico City'},
  80:{date:'Wed Jul 1',time:'12:00 ET',venue:'Atlanta'},
  81:{date:'Wed Jul 1',time:'20:00 ET',venue:'San Francisco Bay Area'},
  82:{date:'Wed Jul 1',time:'16:00 ET',venue:'Seattle'},
  83:{date:'Thu Jul 2',time:'19:00 ET',venue:'Toronto'},
  84:{date:'Thu Jul 2',time:'15:00 ET',venue:'Los Angeles'},
  85:{date:'Thu Jul 2',time:'23:00 ET',venue:'Vancouver'},
  86:{date:'Fri Jul 3',time:'18:00 ET',venue:'Miami'},
  87:{date:'Fri Jul 3',time:'21:30 ET',venue:'Kansas City'},
  88:{date:'Fri Jul 3',time:'14:00 ET',venue:'Dallas'},
  89:{date:'Sat Jul 4',time:'17:00 ET',venue:'Philadelphia'},
  90:{date:'Sat Jul 4',time:'13:00 ET',venue:'Houston'},
  91:{date:'Sun Jul 5',time:'16:00 ET',venue:'New York/New Jersey'},
  92:{date:'Sun Jul 5',time:'20:00 ET',venue:'Mexico City'},
  93:{date:'Mon Jul 6',time:'15:00 ET',venue:'Dallas'},
  94:{date:'Mon Jul 6',time:'20:00 ET',venue:'Seattle'},
  95:{date:'Tue Jul 7',time:'12:00 ET',venue:'Atlanta'},
  96:{date:'Tue Jul 7',time:'16:00 ET',venue:'Vancouver'},
  97:{date:'Thu Jul 9',time:'16:00 ET',venue:'Boston'},
  98:{date:'Fri Jul 10',time:'15:00 ET',venue:'Los Angeles'},
  99:{date:'Sat Jul 11',time:'17:00 ET',venue:'Miami'},
  100:{date:'Sat Jul 11',time:'21:00 ET',venue:'Kansas City'},
  101:{date:'Tue Jul 14',time:'15:00 ET',venue:'Dallas'},
  102:{date:'Wed Jul 15',time:'15:00 ET',venue:'Atlanta'},
  103:{date:'Sat Jul 18',time:'17:00 ET',venue:'Miami'},
  104:{date:'Sun Jul 19',time:'15:00 ET',venue:'New York/New Jersey'},
};

// ─── Bracket constants (official FIFA 2026 Annex C) ─────────────────────────
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
const QF_PAIRS = [[0,1],[4,5],[2,3],[6,7]];
const SF_PAIRS = [[0,1],[2,3]];
const SLOT_ELIGIBLE = [
  ['A','B','C','D','F'],['C','D','F','G','H'],['C','E','F','H','I'],['E','H','I','J','K'],
  ['B','E','F','I','J'],['A','E','H','I','J'],['E','F','G','I','J'],['D','E','I','J','L'],
];
const BRACKET_L = { r32:[1,4,0,2,10,11,8,9], r16:[0,1,4,5], qf:[0,1], sf:[0] };
const BRACKET_R = { r32:[3,5,6,7,12,14,13,15], r16:[2,3,7,6], qf:[2,3], sf:[1] };

// Refined, harmonious 12-hue group palette (rooted in Protocol's category colors)
const GROUP_COLORS = {
  A:'#39ff14', B:'#06b6d4', C:'#8b5cf6', D:'#fbbf24',
  E:'#fb923c', F:'#f87171', G:'#ec4899', H:'#22d3ee',
  I:'#a78bfa', J:'#facc15', K:'#fb7185', L:'#34d399',
};

const initBracket = () => ({
  r32: Array(16).fill(null), r16: Array(8).fill(null),
  qf: Array(4).fill(null), sf: Array(2).fill(null),
  final: null, thirdPlace: null,
});

// ─── Helpers (verbatim logic) ──────────────────────────────────────────────
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
    if (!name) return { name: null, flag: null, display: `${desc.rank}${desc.group}` };
    const obj = getTeamObj(desc.group, name);
    return { name, flag: obj?.flag || '', display: name };
  }
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

// ─── Curated pre-tournament briefings (live app uses Claude + web search) ───
const ANALYSES = {
  A: { summary: 'Mexico carry home-nation momentum, but Korea Republic are the sharper side on form.',
    teams: [
      { name:'Mexico', rank:1, note:'Host advantage and a settled core; expected to top the group with comfort.' },
      { name:'Korea Republic', rank:2, note:'Son-led, athletic and well-drilled — the most likely side to push Mexico.' },
      { name:'Czechia', rank:3, note:'Organised European outfit with a realistic best-third pathway.' },
      { name:'South Africa', rank:4, note:'Quick in transition but short of tournament pedigree at this level.' },
    ], advance:['Mexico','Korea Republic'], thirdPlaceShot:'Czechia have a strong best-third case if they avoid defeat to Korea.', upset:'South Africa could steal points from a complacent Czechia side.', confidence:'High' },
  B: { summary: 'Switzerland are the class of a balanced group; Canada ride the host wave.',
    teams: [
      { name:'Switzerland', rank:1, note:'Top-20 ranking and tournament reliability make them clear favourites.' },
      { name:'Canada', rank:2, note:'Pace out wide and home support; capable of finishing second.' },
      { name:'Qatar', rank:3, note:'Cohesive and experienced from continental success — a genuine dark horse.' },
      { name:'Bosnia and Herzegovina', rank:4, note:'Dangerous in attack but defensively exposed against elite movement.' },
    ], advance:['Switzerland','Canada'], thirdPlaceShot:'Qatar can sneak through as a best-third with one win.', upset:'Bosnia\'s forwards could ambush Canada early.', confidence:'Medium' },
  C: { summary: 'Brazil headline, but Morocco\'s semifinal-grade core makes this the toughest top-two call.',
    teams: [
      { name:'Brazil', rank:1, note:'Deepest attacking talent in the tournament; group winners barring a shock.' },
      { name:'Morocco', rank:2, note:'2022 semifinalists with elite spine — runners-up and a deep-run threat.' },
      { name:'Scotland', rank:3, note:'Disciplined and set-piece dangerous; a plausible best-third.' },
      { name:'Haiti', rank:4, note:'Spirited debut-level side, but a clear gap in quality here.' },
    ], advance:['Brazil','Morocco'], thirdPlaceShot:'Scotland are well placed for a best-third spot.', upset:'Morocco beating Brazil to top spot is very live.', confidence:'High' },
  D: { summary: 'Hosts USA set the tempo; Türkiye and Australia scrap for the second ticket.',
    teams: [
      { name:'United States', rank:1, note:'Home advantage, athletic midfield and depth — expected group winners.' },
      { name:'Türkiye', rank:2, note:'Technical and ambitious; the most talented challenger to the USA.' },
      { name:'Australia', rank:3, note:'Relentless and organised — exactly the profile that grabs a best-third.' },
      { name:'Paraguay', rank:4, note:'Defensively stubborn but light on cutting edge.' },
    ], advance:['United States','Türkiye'], thirdPlaceShot:'Australia are strong best-third contenders.', upset:'Türkiye could top the group if the USA stutter early.', confidence:'Medium' },
  E: { summary: 'Germany are the obvious favourites; Ecuador are the value pick for second.',
    teams: [
      { name:'Germany', rank:1, note:'Elite tournament pedigree and a revitalised attack — clear group winners.' },
      { name:'Ecuador', rank:2, note:'Young, athletic backline; the standout side for the runner-up spot.' },
      { name:'Ivory Coast', rank:3, note:'Reigning African champions — a serious best-third threat.' },
      { name:'Curaçao', rank:4, note:'Compact and counter-driven, but outgunned at this level.' },
    ], advance:['Germany','Ecuador'], thirdPlaceShot:'Ivory Coast could advance as a best-third.', upset:'Ivory Coast over Ecuador for second is plausible.', confidence:'High' },
  F: { summary: 'Netherlands lead a deceptively tough group with Japan rising fast.',
    teams: [
      { name:'Netherlands', rank:1, note:'Top-six side with control and quality — expected to top the group.' },
      { name:'Japan', rank:2, note:'Fearless, high-pressing and in superb form; runners-up at minimum.' },
      { name:'Sweden', rank:3, note:'Physical and direct; can grind out a best-third place.' },
      { name:'Tunisia', rank:4, note:'Well-organised but blunt going forward.' },
    ], advance:['Netherlands','Japan'], thirdPlaceShot:'Sweden have a workable best-third route.', upset:'Japan are good enough to win the group outright.', confidence:'Medium' },
  G: { summary: 'Belgium\'s golden core still sets the standard; Iran are the second-place value.',
    teams: [
      { name:'Belgium', rank:1, note:'Star quality and experience carry them to top spot.' },
      { name:'Iran', rank:2, note:'Asia\'s most consistent side — disciplined and built to finish second.' },
      { name:'Egypt', rank:3, note:'Salah-driven and dangerous; a strong best-third candidate.' },
      { name:'New Zealand', rank:4, note:'Committed but several levels below the top three.' },
    ], advance:['Belgium','Iran'], thirdPlaceShot:'Egypt are firmly in best-third contention.', upset:'Egypt edging Iran for second is on the cards.', confidence:'Medium' },
  H: { summary: 'Spain are the tournament favourites; Uruguay bring the steel for second.',
    teams: [
      { name:'Spain', rank:1, note:'European champions, total control — the side to beat in the whole field.' },
      { name:'Uruguay', rank:2, note:'Ruthless and tournament-tested; comfortable runners-up.' },
      { name:'Cape Verde', rank:3, note:'Fearless debutants with pace — an outside best-third shout.' },
      { name:'Saudi Arabia', rank:4, note:'Energetic but lacking the firepower to trouble the top two.' },
    ], advance:['Spain','Uruguay'], thirdPlaceShot:'Cape Verde would need results elsewhere to advance.', upset:'Cape Verde shocking Saudi Arabia for third is realistic.', confidence:'High' },
  I: { summary: 'France\'s depth is overwhelming; Senegal are the clear second power.',
    teams: [
      { name:'France', rank:1, note:'Arguably the deepest squad on earth — emphatic group winners.' },
      { name:'Senegal', rank:2, note:'Powerful, quick and proven — runners-up and a knockout danger.' },
      { name:'Norway', rank:3, note:'Haaland-led firepower gives them a live best-third case.' },
      { name:'Iraq', rank:4, note:'Combative underdogs, but the gap in class is significant.' },
    ], advance:['France','Senegal'], thirdPlaceShot:'Norway are strong best-third contenders.', upset:'Norway\'s attack could derail Senegal\'s second place.', confidence:'High' },
  J: { summary: 'Holders Argentina remain the benchmark; Austria are the smart second pick.',
    teams: [
      { name:'Argentina', rank:1, note:'Reigning champions, world No.1 — the standard the field chases.' },
      { name:'Austria', rank:2, note:'Aggressive pressing unit; the most rounded challenger for second.' },
      { name:'Algeria', rank:3, note:'Technically gifted with real best-third upside.' },
      { name:'Jordan', rank:4, note:'Plucky and improving, but outclassed in this company.' },
    ], advance:['Argentina','Austria'], thirdPlaceShot:'Algeria are well positioned for a best-third spot.', upset:'Algeria pipping Austria for second is a genuine risk.', confidence:'High' },
  K: { summary: 'Portugal\'s generational talent leads; Colombia are an elite second seed.',
    teams: [
      { name:'Portugal', rank:1, note:'Stacked across every line — expected group winners with margin.' },
      { name:'Colombia', rank:2, note:'A top-12 side and arguably the strongest runner-up in the draw.' },
      { name:'Uzbekistan', rank:3, note:'Organised debutants; a long-shot best-third.' },
      { name:'DR Congo', rank:4, note:'Athletic and physical but inconsistent in the final third.' },
    ], advance:['Portugal','Colombia'], thirdPlaceShot:'Colombia\'s quality makes this group\'s third a tough qualifier.', upset:'Colombia have the squad to top the group over Portugal.', confidence:'High' },
  L: { summary: 'England carry favourite status; Croatia\'s know-how makes them dangerous.',
    teams: [
      { name:'England', rank:1, note:'Top-four ranking and elite depth — clear group winners.' },
      { name:'Croatia', rank:2, note:'Serial over-performers with midfield mastery; comfortable second.' },
      { name:'Ghana', rank:3, note:'Pace and power give them a credible best-third shot.' },
      { name:'Panama', rank:4, note:'Spirited and physical, but short of end product.' },
    ], advance:['England','Croatia'], thirdPlaceShot:'Ghana are live for a best-third place.', upset:'Croatia\'s experience could topple England for top spot.', confidence:'High' },
};

window.WC = {
  GROUPS, MATCH_SCHEDULE, R32_DEFS, R16_PAIRS, QF_PAIRS, SF_PAIRS,
  SLOT_ELIGIBLE, BRACKET_L, BRACKET_R, GROUP_COLORS, ANALYSES,
  initBracket, getTeamByRank, getTeamObj, resolveDesc, resolveWinner, resolveLoser,
};
