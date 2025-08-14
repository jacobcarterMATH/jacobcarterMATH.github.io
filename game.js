"use strict";
/* =========================
   Endless Hack-and-Slash (Simplified Slots Build)
   Slots: weapon, armor, boots, ring, trinket
   - Normalizes legacy items: helm/chest -> armor, amulet -> trinket
   - All other features from the clean build retained
   ========================= */
/*
 * ====== Refactor Notes (2025-08-13) ======
 * - 'use strict' enabled for safer semantics
 * - Removed duplicate clamp() definition (kept clamp(v,min,max))
 * - Fixed screenToCanvas() to reference the correct canvas element 'cvs'
 * - Introduced FX constants for swing and floaty lifetimes
 * - Added JSDoc comments to core functions for maintainability
 *
 * Behavior should be unchanged. If anything regressed, search for this banner
 * and review diffs related to the above bullets.
 */


/* ========= Utils ========= */
function clamp(v,min,max){ return v<min?min:v>max?max:v; }
function rint(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function rand(a,b){ return a + Math.random()*(b-a); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
const choice = (arr)=>arr[Math.floor(Math.random()*arr.length)];

// UUID fallback
const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? () => crypto.randomUUID()
  : () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });

/* ========= Tunables ========= */
const TAU = Math.PI * 2;

const GAME = {
  width: 960, height: 540,
  bg: '#0b0f1a'
};
/* ========= Enemy Type Colors ========= */
// Match the colors you already use in tooltips: zombie=green, alien=light-blue, demon=red
const TYPE_COLOR = {
  zombie: { fill: "#2ecc71", stroke: "#27ae60", hp: "#2ecc71" },
  alien:  { fill: "#7ed6ff", stroke: "#22a6b3", hp: "#7ed6ff" },
  demon:  { fill: "#e74c3c", stroke: "#c0392b", hp: "#e74c3c" },
};

// Returns the base family for an enemy (so 'zombie_boss' -> 'zombie').
function baseTypeOf(e){
  if (!e || !e.type) return "zombie";
  if (e.type.endsWith("_boss")) return e.type.slice(0, e.type.indexOf("_boss"));
  return e.type; // 'zombie' | 'alien' | 'demon' | 'sniper' | ...
}

const AI = {
  alienRetreatDelay: 2500,  // ms grace after getting too close
  alienHysteresis: 24       // px beyond min to reset the retreat delay
};
const LOOT = {
  hpPackChance: 0.06,      // 6% base chance on kill
  hpPackHealFrac: 0.30     // heals 30% max hp
};
const FX = {
  swingLifeMs: 180,   // swing arc fade duration
  floatyLifeMs: 700   // damage number lifetime
};
const SNIPER = {
  windupMs: 900,
  spawnDelayMs: 900,       // grace after spawn before aiming
  minDist: 360,
  maxDist: 520,
  bulletSpeed: 560,    
};
/* ========= Spawn gates by wave ========= */
const SPAWN_GATE = Object.freeze({
  demon:  3,   // demons appear starting wave 3
  alien:  11,  // aliens appear starting wave 11
  sniper: 16   // snipers appear starting wave 16
});

function canSpawnType(type, wave){
  const gate = SPAWN_GATE[type];
  return gate == null || wave >= gate;
}

const root = (typeof globalThis !== 'undefined') ? globalThis : window;
const COMBAT = (root.COMBAT && typeof root.COMBAT === 'object')
  ? Object.assign({ dmgVariancePct: 0.10 }, root.COMBAT)
  : { dmgVariancePct: 0.10 };

const HIT = {
  contactCooldownMs: 400,   // how often the same enemy can hurt you on touch
  contactMul: .35,         // % of that enemy's dmg when applied as a contact hit
  minContact: 1,            // floor so weak hits still matter
  projectileCooldownMs: 150 // brief grace after getting shot
};

const DAMAGE = {
  meleeWindowMs: 220,         // rolling window
  meleeMaxHitsPerWindow: 1    // at most 2 touch hits per window
};

const SPEED = {
  earlyMin: 0.2,     // 20% speed on wave 1
  earlyMax: 0.6,     // reaches 60% by earlyUntilWave
  earlyUntilWave: 50,  // linear ramp from waves 1..30
  lateStartWave: 60,  // after this, we add a gentle slope
  lateSlopePerWave: 0.005, // +0.5% per wave past lateStartWave
  cap: 1           // never exceed base value 
};
const NAME_SEEDS = [
  'Dawn','Ash','Mist','Iron','Gales','Echoes',
  'Ember','Frost','Storm','Void','Nova','Shards',
  'Aegis','Vortex','Zephyr','the Warden','the Specter','Pulse',
  'Arcing','Obsidian','Aurora','Catalyst','Rift','the Quasar',
  'the Eclipse','the Sentinel','the Phantom','Relic','Tempest','Onyx'
];

// --- Alien aim variance (degrees) ---
const ALIEN_AIM = (()=> {
  const prior = (typeof globalThis!=='undefined' && globalThis.ALIEN_AIM && typeof globalThis.ALIEN_AIM==='object')
    ? globalThis.ALIEN_AIM : null;
  return Object.assign({
    baseSpreadDeg: 12,
    minSpreadDeg:  2,
    maxSpreadDeg: 18,
    waveTightenUntil: 10,
    distTightenStart: 180,
    distTightenEnd:   520,
    perShotJitterDeg: 2.5
  }, prior || {});
})();


const DEG = Math.PI / 180;

/**
 * Computes current alien aim spread (radians) from wave and distance.
 * @param {object} e - Alien entity.
 * @returns {number} spreadRadians
 */
function alienSpreadRadians(e){
  const A = ALIEN_AIM;
  const w = Math.max(1, game.wave);

  // Wave-based tightening: big spread early → min by waveTightenUntil
  const wt = clamp((A.waveTightenUntil - w) / Math.max(1,(A.waveTightenUntil - 1)), 0, 1);
  const waveSpread = A.minSpreadDeg + (A.baseSpreadDeg - A.minSpreadDeg) * wt;

  // Distance-based: more spread when far away
  const d  = Math.hypot(player.x - e.x, player.y - e.y);
  const dt = clamp((d - A.distTightenStart) / Math.max(1,(A.distTightenEnd - A.distTightenStart)), 0, 1);

  let spreadDeg = waveSpread + (A.maxSpreadDeg - waveSpread) * dt;
  spreadDeg += (Math.random()*2 - 1) * A.perShotJitterDeg;  // small per-shot wiggle
  spreadDeg = clamp(spreadDeg, A.minSpreadDeg, A.maxSpreadDeg);

  return spreadDeg * DEG; // radians
}

// Returns a scalar to multiply with the computed ms
/**
 * Returns a wave-scaled speed multiplier for enemies.
 * @param {number} w - Current wave number.
 * @returns {number} speedScalar
 */
function enemySpeedScalar(w){
  if (w <= SPEED.earlyUntilWave){
    const t = (w - 1) / Math.max(1, (SPEED.earlyUntilWave - 1));
    return SPEED.earlyMin + t * (SPEED.earlyMax - SPEED.earlyMin);
  }
  const late = SPEED.earlyMax + Math.max(0, w - SPEED.lateStartWave) * SPEED.lateSlopePerWave;
  return Math.min(late, SPEED.cap);
}



/* ========= Game State ========= */
const game = {
  width: GAME.width, height: GAME.height,
  time: performance.now(),
  state: 'combat',      // 'combat' | 'intermission' | 'shop' | 'over'
  wave: 1, kills: 0, drops: 0, credits: 0,
  bossAlive: false, shopOffers: [], shopPersistWave: null, shopBuys:{}
};

// === Simplified slots
const ITEM_SLOTS = ['weapon','armor','boots','ring','trinket'];

const player = {
  x: GAME.width/2, y: GAME.height/2, r: 14,
  base: { str: 3, agi: 3, end: 3, luck: 0 },
  equip: { weapon:null, armor:null, boots:null, ring:null, trinket:null },
  inv: [],
  stats: { hp: 100, maxhp: 100, dmg:100, atkCd:500, ms:350, range:44, regen:0, str:3, agi:3, end:3, luck:0 },
  lastAtk: 0, facing: 0, meleeWindowEnd: 0,
meleeHitsInWindow: 0,

};

// Canvas
const cvs = document.getElementById('gameCanvas');
cvs.width = GAME.width; cvs.height = GAME.height;
const ctx = cvs.getContext('2d');

/**
 * Convert viewport mouse coords to canvas space (handles CSS scaling).
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{x:number,y:number}}
 */
function screenToCanvas(clientX, clientY){
  const rect = cvs.getBoundingClientRect();
  const scaleX = cvs.width  / rect.width;
  const scaleY = cvs.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

// Track mouse even if an overlay is open
window.addEventListener('mousemove', (e)=>{
  const p = screenToCanvas(e.clientX, e.clientY);
  mouse.x = p.x; mouse.y = p.y;
});
function updateFacing(){
  // Optional smoothing: uncomment the lerp lines if you want a tiny ease
   const target = Math.atan2(mouse.y - player.y, mouse.x - player.x);
   const d = (((target - player.facing + Math.PI*3) % (Math.PI*2)) - Math.PI); // shortest angle
   player.facing += d * 0.25; // 0..1 smoothing factor

  // Instant snap (no smoothing):
  //player.facing = Math.atan2(mouse.y - player.y, mouse.x - player.x);
}

/* ========= Affixes & Items ========= */
const AFFIX_POOL = [
  { key:'str',  name:'Strength',  kind:'flat',  min:1, max:3 },
  { key:'agi',  name:'Agility',   kind:'flat',  min:1, max:3 },
  { key:'end',  name:'Endurance', kind:'flat',  min:1, max:3 },
  { key:'luck', name:'Luck',      kind:'flat',  min:1, max:2 },
  { key:'hp',   name:'Health',    kind:'flat',  min:6, max:16 },
  { key:'dmg',  name:'Damage',    kind:'flat',  min:2, max:6 },
  { key:'cd',   name:'Attack Speed', kind:'pct', min:3, max:10 },
  { key:'ms',   name:'Move Speed',   kind:'pct', min:2, max:8 },
  { key:'range',name:'Range',     kind:'flat',  min:6, max:14 },
  { key:'regen',name:'HP Regen',  kind:'flat',  min:0.1, max:0.6 },

  // enemy-type specific
  { key:'vs_zombie', name:'% Dmg vs Zombies', kind:'pct', min:50, max:150 },
  { key:'vs_alien',  name:'% Dmg vs Aliens',  kind:'pct', min:50, max:150 },
  { key:'vs_demon',  name:'% Dmg vs Demons',  kind:'pct', min:50, max:150 },
  { key:'dr_zombie', name:'% DR vs Zombies',  kind:'pct', min:10, max:20 },
  { key:'dr_alien',  name:'% DR vs Aliens',   kind:'pct', min:10, max:20 },
  { key:'dr_demon',  name:'% DR vs Demons',   kind:'pct', min:10, max:20 }
];
/* ========= Boss-only affixes & tunables ========= */
// These never roll on normal drops; only added to boss drops.
const BOSS_AFFIX_POOL = [
  // Chance to instantly kill targets that are already low (see threshold below).
  { key:'exec_chance', name:'Execute chance (<50% HP)', kind:'pct',
    min:5, max:20, slots:['weapon','ring','trinket'] },

  // Flat HP returned on each hit that deals damage.
  { key:'lifesteal',   name:'Life on Hit', kind:'flat',
    min:1, max:4, slots:['weapon','ring'] },

	  // Apply a short slow on hit; value is percent slow.
	{ key:'slow_on_hit', name:'Slow on Hit (1.4s)', kind:'pct',
	  min:25, max:50, slots:['weapon','boots','ring','armor'] }

];
const BOSS_AFFIX_KEYS = new Set(BOSS_AFFIX_POOL.map(a => a.key));
const BOSS_VALID_SLOTS = Array.from(new Set(BOSS_AFFIX_POOL.flatMap(a => a.slots)));

function slotSupportsBossAffix(slot){
  return BOSS_AFFIX_POOL.some(a => a.slots.includes(slot));
}

const BOSS_AFFIX_TUNES = {
  EXEC_THRESHOLD_PCT: 50,     // execute can trigger at or below this remaining HP%
  SLOW_DURATION_MS:   1400,   // how long the slow lasts
  SLOW_MIN_MULT:      0.30    // don't slow below 30% of base speed
};

function makeAffix(power){
  const a = choice(AFFIX_POOL);
  const spread = (a.kind==='flat') ? rand(a.min,a.max) : rint(a.min,a.max);
  const val = (a.kind==='flat') ? Math.round(spread*10)/10 : spread;
  return { key:a.key, name:a.name, val, pct:(a.kind==='pct') };
}
function ensureAffixMeta(a){
  if (a == null) return;
  if (typeof a.base  === 'undefined') a.base  = a.val;   // original roll
  if (typeof a.bonus === 'undefined') a.bonus = 0;       // cumulative upgrades
}
function normalizeItem(it){
  if (!it || !Array.isArray(it.affixes)) return;
  it.affixes.forEach(ensureAffixMeta);
}

function rarityFor(p){
  if (p>=90) return 'legendary';
  if (p>=70) return 'epic';
  if (p>=50) return 'rare';
  if (p>=30) return 'uncommon';
  return 'common';
}
const ITEM_NAMES = {
  weapon:  ['Spear','Glaive','Halberd','Pike'],
  armor:   ['Vest','Cuirass','Tunic','Coat'],
  boots:   ['Boots','Greaves','Sabaton','Treads'],
  ring:    ['Band','Loop','Seal','Signet'],
  trinket: ['Charm','Amulet','Pendant','Talisman']
};

// Cache stat elements (null-safe)
const statsUI = {
  str:    document.getElementById('str'),
  agi:    document.getElementById('agi'),
  end:    document.getElementById('end'),
  luck:   document.getElementById('luck'),
  power:  document.getElementById('power')
};

function renderStatsPanel(){
  const s = player.stats;
  if (statsUI.str)   statsUI.str.textContent   = Math.round(s.str);
  if (statsUI.agi)   statsUI.agi.textContent   = Math.round(s.agi);
  if (statsUI.end)   statsUI.end.textContent   = Math.round(s.end);
  if (statsUI.luck)  statsUI.luck.textContent  = Math.round(s.luck);

  // “Power” = sum of item.power across equipped
  const pow = ITEM_SLOTS.reduce((t,sl)=> t + (player.equip[sl]?.power||0), 0);
  if (statsUI.power) statsUI.power.textContent = pow;
}


// Inline SVG icons (covers legacy names for safety)
function iconFor(slot, rarity){
  const fill = ({
    weapon:'#fcd34d', armor:'#93c5fd', boots:'#f472b6', ring:'#f59e0b', trinket:'#34d399',
    // legacy aliases
    helm:'#93c5fd', chest:'#93c5fd', amulet:'#34d399'
  })[slot] || '#a3a3a3';
  const glow = ({ common:'#64748b', uncommon:'#10b981', rare:'#60a5fa', epic:'#a78bfa', legendary:'#f59e0b' })[rarity] || '#64748b';
  const stroke = '#0b0f1a';

  let inner = '';
  switch(slot){
    case 'weapon':
      inner = `<line x1="20" y1="44" x2="50" y2="14" stroke="${fill}" stroke-width="5" stroke-linecap="round"/>
               <polygon points="50,14 58,10 54,18" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      break;
    case 'armor': case 'helm': case 'chest':
      inner = `<rect x="18" y="18" width="28" height="28" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
               <line x1="22" y1="18" x2="22" y2="46" stroke="${stroke}" stroke-width="3" opacity="0.35"/>
               <line x1="42" y1="18" x2="42" y2="46" stroke="${stroke}" stroke-width="3" opacity="0.35"/>`;
      break;
    case 'boots':
      inner = `<path d="M16 34 h18 v8 h14 v8 H16 z" fill="${fill}" stroke="${stroke}" stroke-width="3" />`;
      break;
    case 'ring':
      inner = `<circle cx="32" cy="32" r="12" fill="none" stroke="${fill}" stroke-width="6"/>
               <circle cx="32" cy="32" r="12" fill="none" stroke="${stroke}" stroke-width="2" opacity="0.25"/>`;
      break;
    case 'trinket': case 'amulet':
      inner = `<path d="M20 14 C 28 8, 36 8, 44 14" fill="none" stroke="${glow}" stroke-width="2"/>
               <circle cx="32" cy="30" r="9" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
      break;
    default:
      inner = `<rect x="20" y="20" width="24" height="24" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect x="3" y="3" width="58" height="58" rx="8" fill="#0f1629" stroke="${glow}" stroke-width="3"/>
    ${inner}
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function makeItem(wave, luck){
  const slot  = choice(ITEM_SLOTS);
  const power = Math.max(1, Math.round(wave*2 + rand(-3,6)));
  const nAff  = clamp(
    1 + Math.floor(power/22) + (Math.random() < (0.1 + (luck||0)*0.01) ? 1 : 0),
    1, 4
  );

  const affixes = [];
  const used = new Set();
  while (affixes.length < nAff){
    const a = makeAffix(power);
    if (used.has(a.key)) continue;
    used.add(a.key);
    ensureAffixMeta(a);       // ← seed a.base and a.bonus on creation
    affixes.push(a);
  }

  const rarity = rarityFor(power + affixes.length*5);
  const name   = choice(ITEM_NAMES[slot]) + ' of ' + choice(NAME_SEEDS);

  const it = { id: uuid(), slot, name, power, affixes, rarity, upg: 0 }; // upg tracks item-upgrade count
  normalizeItem(it);           // ← safe no-op here, but future-proof if affix shapes change
  return it;
}

function summarizeItem(it){
  normalizeItem(it);
  const lines = it.affixes.map(a=> a ? affixLabelHTML(a).replace(/<[^>]*>/g,'') : ''); // plain text for shop body
  return `${it.name} [${it.slot}]
Power ${it.power}
` + lines.join('\n');
}

function fmtNum(n){ return Number.isInteger(n) ? n : (+n).toFixed(1); }

function affixLabelHTML(a){
  ensureAffixMeta(a);
  const colors = { zombie:'#16a34a', alien:'#22d3ee', demon:'#ef4444' };

  // Build label (Damage/DR vs Types stay color-coded)
  let label = a.name || (a.key ? a.key.toUpperCase() : 'Stat');
  if (a.key && (a.key.startsWith('vs_') || a.key.startsWith('dr_'))){
    const type = a.key.split('_')[1];
    const kind = a.key.startsWith('vs_') ? 'Dmg vs ' : 'DR vs ';
    const pretty = type==='zombie' ? 'Zombies' : type==='alien' ? 'Aliens' : 'Demons';
    const col = colors[type] || '#e5e7eb';
    label = `${kind}<span style="color:${col}">${pretty}</span>`;
  } else if (a.key){
    const map = { dmg:'Damage', hp:'Max HP', regen:'HP Regen', range:'Range', str:'Strength', agi:'Agility', end:'Endurance', luck:'Luck' };
    label = map[a.key] || label;
  }

  // Show base and cumulative bonus
  const base  = a.pct ? `${fmtNum(a.base)}%` : fmtNum(a.base);
  const bonus = (a.bonus && a.bonus !== 0) ? ` <span style="color:#34d399">(+${a.pct ? fmtNum(a.bonus)+'%' : fmtNum(a.bonus)})</span>` : '';
  return `+${base}${bonus} ${label}`;
}


function itemTooltipHTML(it, opts){
  const lines = [
    `<div style="font-weight:600">${it.name}</div>`,
    `<div style="opacity:.8">${it.slot} • power ${it.power}</div>`,
    `<hr style="border-color:#2b3650">`
  ];
  if (it.isBossItem){
  lines.push(`<div style="font-size:14px;opacity:.8;margin:2px 0;color:#ea03ff">Boss Item</div>`);
}

  for (const a of it.affixes){
    lines.push(`<div>${affixLabelHTML(a)}</div>`);
  }
  if (opts && opts.equipped) lines.push(`<div style="margin-top:6px;opacity:.8">Equipped</div>`);
  return lines.join('');
}


/* ========= Legacy slot normalization ========= */
function normalizeSlotName(s){
  if (s==='helm' || s==='chest') return 'armor';
  if (s==='amulet') return 'trinket';
  return s;
}
function normalizeSlots(){
  // migrate equipped
  ['helm','chest','amulet'].forEach(old=>{
    const it = player.equip[old];
    if (it){
      const tgt = normalizeSlotName(old);
      it.slot = tgt;
      if (!player.equip[tgt]) player.equip[tgt] = it;
      player.equip[old] = null;
    }
  });
  // ensure keys exist
  ITEM_SLOTS.forEach(k=>{ if (!(k in player.equip)) player.equip[k] = null; });
  // migrate inventory
  player.inv.forEach(it => it.slot = normalizeSlotName(it.slot));
}

/* ========= Type mods (damage taken modifiers) ========= */
function getTypeMods(type){
  let drMult = 1.0;
  const map = {
  zombie: 'dr_zombie',
  alien:  'dr_alien',
  demon:  'dr_demon',
  boss:   'dr_zombie',      // backward-compat if any legacy 'boss' slips through
  zombie_boss: 'dr_zombie',
  alien_boss:  'dr_alien',
  demon_boss:  'dr_demon'
};

  const key = map[type] || null;
  if (key){
    for(const slot of ITEM_SLOTS){
      const it = player.equip[slot]; if(!it) continue;
      for(const a of it.affixes){
        if(a.key===key) drMult *= (100 - a.val)/100;
      }
    }
  }
  return { drMult };
}


/** Sum all values for a given affix key across equipped items. */
function getAffixSum(key){
  let sum = 0;
  for (const slot of ITEM_SLOTS){
    const it = player.equip[slot]; if (!it) continue;
    for (const a of it.affixes){ if (a.key === key) sum += (a.val||0); }
  }
  return sum;
}

/* ========= Type bonuses (damage dealt modifiers) ========= */
/** Returns a multiplicative damage bonus for % Dmg vs {type} affixes. */
function getVsMult(type){
  let mult = 1.0;
  // Mirror the DR mapping; change 'boss' if you later tag boss subtypes.
  const map = {
  zombie: 'vs_zombie',
  alien:  'vs_alien',
  demon:  'vs_demon',
  boss:   'vs_zombie',      // backward-compat
  zombie_boss: 'vs_zombie',
  alien_boss:  'vs_alien',
  demon_boss:  'vs_demon'
};

  const key = map[type] || null;
  if (key){
    for (const slot of ITEM_SLOTS){
      const it = player.equip[slot]; if (!it) continue;
      for (const a of it.affixes){
        if (a.key === key){
          // a.val is already the upgraded % value; stack multiplicatively
          mult *= (100 + a.val) / 100;
        }
      }
    }
  }
  return mult;
}


/* ========= Stats (pure compute + assign) ========= */
function computeStats(equipMap){
  const b = player.base;
  const s = { str:b.str, agi:b.agi, end:b.end, luck:b.luck, regen:0,
              maxhp: 60 + b.end*8, hp: player.stats.hp,
              ms: 140 + b.agi*4, atkCd: 600 - b.agi*12, dmg: 8 + b.str*2, range: 44 };
  for(const slot of ITEM_SLOTS){
    const it = equipMap[slot];
    if(!it) continue;
    for(const a of it.affixes){
      switch(a.key){
        case 'str': s.str += a.val; s.dmg += a.val*2; break;
        case 'agi': s.agi += a.val; s.ms += a.val*3; s.atkCd -= a.val*10; break;
        case 'end': s.end += a.val; s.maxhp += a.val*10; break;
        case 'luck': s.luck += a.val; break;
        case 'hp': s.maxhp += a.val; break;
        case 'dmg': s.dmg += a.val; break;
        case 'cd': s.atkCd *= (100 - a.val)/100; break;
        case 'ms': s.ms *= (100 + a.val)/100; break;
        case 'range': s.range += a.val; break;
        case 'regen': s.regen += a.val; break;
      }
    }
  }
  s.atkCd = clamp(Math.round(s.atkCd), 160, 900);
  if(s.hp > s.maxhp) s.hp = s.maxhp;
  return s;
}
function recalcStats(){ player.stats = computeStats(player.equip); }

// For previews
function deriveStatsWithEquip(equipMap){ return computeStats(equipMap); }
function previewDelta(it){
  const now = computeStats({...player.equip});
  const after = computeStats({...player.equip, [it.slot]: it});
  return {
    now, after,
    dDmg: Math.round(after.dmg - now.dmg),
    dHpMax: Math.round(after.maxhp - now.maxhp),
    dMs: Math.round(after.ms - now.ms),
    dCd: Math.round(after.atkCd - now.atkCd),
    dRange: Math.round(after.range - now.range),
    dRegen: Math.round((after.regen - now.regen)*10)/10
  };
}

/* ========= Input ========= */
const keys = new Set();
const mouse = { x:0, y:0, down:false };

window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();
  keys.add(k);

  // Space: open/close shop (no wave advance)
  if (k === ' ') {
    e.preventDefault();
    tryAdvance();
    return;
  }

  // N: start next wave (only when shop is open)
if (k === 'n' && game.state === 'shop') {
  e.preventDefault();
  const btn = document.getElementById('startWaveBtn');
  if (btn && !btn.disabled) btn.click();   // reuse the button's exact logic
  return;
}


  // E: pickup
  if (k === 'e') {
    e.preventDefault();
    tryPickup();
    return;
  }
});

window.addEventListener('keyup', (e)=> keys.delete(e.key.toLowerCase()));

cvs.addEventListener('mousemove', (e)=>{
  const r = cvs.getBoundingClientRect();
  const sx = cvs.width / r.width, sy = cvs.height / r.height;
  mouse.x = (e.clientX - r.left)*sx;
  mouse.y = (e.clientY - r.top)*sy;
});

cvs.addEventListener('mousedown', ()=>{ mouse.down = true; });
window.addEventListener('mouseup', ()=>{ mouse.down = false; });
window.addEventListener('blur', ()=>{ keys.clear(); mouse.down = false; });

/* ========= Tooltip (above overlays) ========= */
let tooltip = document.getElementById('tooltip');
if(!tooltip){
  tooltip = document.createElement('div'); tooltip.id='tooltip';
  tooltip.style.cssText = 'position:fixed;z-index:10050;pointer-events:none;background:#0f1629;color:#e5e7eb;border:1px solid #2b3650;border-radius:6px;padding:8px;max-width:280px;display:none;box-shadow:0 8px 24px rgba(0,0,0,.45)';
  document.body.appendChild(tooltip);
}
function hideTooltip(){ tooltip.style.display='none'; }
function fmtDelta(n, unit='', invert=false){
  const txt = (n===0) ? '±0' : (n>0 ? `+${n}${unit}` : `${n}${unit}`);
  const good = invert ? n < 0 : n > 0;
  const color = (n===0) ? '#cbd5e1' : (good ? '#34d399' : '#f87171'); // gray | green | red
  return `<span style="color:${color}">${txt}</span>`;
}
/* ========= Tooltip Compare: show only stats present on either item ========= */
function labelForKey(key){
  // Direct names for boss-only affixes
  if (key === 'exec_chance') return 'Execute chance';
  if (key === 'lifesteal')   return 'Life on Hit';
  if (key === 'slow_on_hit') return 'Slow on Hit';

  const baseMap = {
    dmg:'Damage', hp:'Max HP', regen:'HP Regen', range:'Range',
    cd:'Attack Speed', ms:'Move Speed',
    str:'Strength', agi:'Agility', end:'Endurance', luck:'Luck'
  };

  // Colored labels for type-specific stats
  if (key && (key.startsWith('vs_') || key.startsWith('dr_'))){
    const colors = { zombie:'#16a34a', alien:'#22d3ee', demon:'#ef4444' };
    const type = key.split('_')[1];
    const kind = key.startsWith('vs_') ? 'Dmg vs ' : 'DR vs ';
    const pretty = type==='zombie' ? 'Zombies' : type==='alien' ? 'Aliens' : 'Demons';
    const col = colors[type] || '#e5e7eb';
    return kind + `<span style="color:${col}">${pretty}</span>`;
  }

  return baseMap[key] || (key || 'Stat');
}


function collectAffixValues(item){
  const out = {};
  if (!item || !Array.isArray(item.affixes)) return out;
  for (const a of item.affixes){
    if (!a || !a.key) continue;
    out[a.key] = (out[a.key] || 0) + (a.val || 0); // sum duplicates if any
  }
  return out;
}

function buildCompareByAffixesHTML(inspectItem, equippedItem){
  const a = collectAffixValues(equippedItem);
  const b = collectAffixValues(inspectItem);
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  if (keys.length === 0) return '';

  // Readable ordering
  const core = ['dmg','hp','regen','range','cd','ms'];
  const attrs = ['str','agi','end','luck'];
  const boss = ['exec_chance','lifesteal','slow_on_hit'];
  const vs = ['vs_zombie','vs_alien','vs_demon'];
  const dr = ['dr_zombie','dr_alien','dr_demon'];
  const order = [...core, ...attrs, ...boss, ...vs, ...dr];

  keys.sort((k1,k2)=>{
    const i1 = order.indexOf(k1), i2 = order.indexOf(k2);
    if (i1 === -1 && i2 === -1) return k1.localeCompare(k2);
    if (i1 === -1) return 1;
    if (i2 === -1) return -1;
    return i1 - i2;
  });

  let rows = [];
  for (const k of keys){
    const vEq = a[k] || 0;
    const vIn = b[k] || 0;
    const delta = vIn - vEq;

    // units/rounding per key
    const isPct = (
	  k==='cd' || k==='ms' ||
	  k==='exec_chance' || k==='slow_on_hit' ||
	  k.startsWith('vs_') || k.startsWith('dr_')
	);


    const unit = isPct ? '%' : (k==='regen' ? '/s' : '');
    const n = (k==='regen') ? Math.round(delta*10)/10 : Math.round(delta);

    // Only show if either item actually has this stat
    if (vEq !== 0 || vIn !== 0){
      rows.push(`<div>${labelForKey(k)}: <b>${fmtDelta(n, unit)}</b></div>`);
    }
  }

  if (rows.length === 0) return '';
  return `<div style="margin-top:6px;border-top:1px solid #2b3650;padding-top:6px">
    <div style="opacity:.8;font-size:12px;margin-bottom:2px">Compared to equipped:</div>
    ${rows.join('')}
  </div>`;
}

function showTooltipAt(it, x, y, opts){
  let html = itemTooltipHTML(it, opts||{});
  if (opts && opts.compare){
  const eq = player.equip[it.slot];
  if (eq){
    html += buildCompareByAffixesHTML(it, eq);
  }
}


  tooltip.innerHTML = html;
  tooltip.style.display='block';
  const pad=14, maxX=window.innerWidth-320, maxY=window.innerHeight-140;
  tooltip.style.left = Math.min(maxX, x+pad)+'px';
  tooltip.style.top  = Math.min(maxY, y+pad)+'px';
}

/* ========= Rendering ========= */
function drawEnemy(e){
    const family = baseTypeOf(e);
	const col = TYPE_COLOR[family] || TYPE_COLOR.zombie;

  if(e.type === 'zombie'){
    ctx.beginPath(); ctx.arc(e.x,e.y, e.r, 0, Math.PI*2);
    ctx.fillStyle = '#16a34a'; ctx.fill(); ctx.strokeStyle = '#bbf7d0'; ctx.stroke();
    ctx.fillStyle = '#0b0f1a'; ctx.fillRect(e.x-5, e.y-4, 4, 4); ctx.fillRect(e.x+1, e.y-4, 4, 4);
  } else if(e.type === 'alien'){
    ctx.save(); ctx.translate(e.x,e.y); ctx.scale(1.2,1);
    ctx.beginPath(); ctx.arc(0,0, e.r, 0, Math.PI*2); ctx.fillStyle = '#22d3ee'; ctx.fill(); ctx.strokeStyle = '#a5f3fc'; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r); ctx.lineTo(e.x, e.y - e.r - 8); ctx.strokeStyle = '#67e8f9'; ctx.stroke();
    ctx.beginPath(); ctx.arc(e.x, e.y - e.r - 10, 2, 0, Math.PI*2); ctx.fillStyle = '#67e8f9'; ctx.fill();
  } else if(e.type === 'demon'){
    ctx.beginPath(); ctx.arc(e.x,e.y, e.r, 0, Math.PI*2);
    ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.strokeStyle = '#fecaca'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.x-6, e.y-e.r+2); ctx.lineTo(e.x-2, e.y-e.r-6);
    ctx.moveTo(e.x+6, e.y-e.r+2); ctx.lineTo(e.x+2, e.y-e.r-6);
    ctx.strokeStyle = '#fde68a'; ctx.stroke();
  } else if(e.type === 'sniper'){
    // diamond + scope dot
    ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(Math.PI/4);
    ctx.beginPath(); ctx.rect(-10,-10,20,20); ctx.fillStyle = '#b91c1c'; ctx.fill(); ctx.strokeStyle = '#fecaca'; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(e.x+10, e.y-12, 2, 0, Math.PI*2); ctx.fillStyle = '#fecaca'; ctx.fill();
  } else if (e.isBoss) {
  ctx.save();
  ctx.beginPath(); ctx.arc(e.x,e.y, e.r, 0, Math.PI*2);
  ctx.fillStyle = col.fill; ctx.fill();
  ctx.strokeStyle = col.stroke; ctx.lineWidth = 4;
  ctx.shadowColor = col.stroke; ctx.shadowBlur = 12; // subtle glow for bosses
  ctx.stroke();
  ctx.restore();
} else {

    ctx.beginPath(); ctx.arc(e.x,e.y, e.r, 0, Math.PI*2);
    ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.strokeStyle = '#fecaca'; ctx.stroke();
  }
  // HP bar
  ctx.fillStyle = '#0007'; ctx.fillRect(e.x-12, e.y-18, 24, 4);
  ctx.fillStyle = '#34d399'; ctx.fillRect(e.x-12, e.y-18, 24*(e.hp/e.maxhp), 4);
}

const swingFX = [];
const floaties = [];

function drawPlayer(){
  // body
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
  ctx.fillStyle = '#94a3b8'; ctx.fill(); ctx.strokeStyle = '#e2e8f0'; ctx.stroke();

  // spear oriented by facing
  const ux = Math.cos(player.facing||0), uy = Math.sin(player.facing||0);
  // Map base range (≈44) to the old 26px spear, scale proportionally from there.
const spearLen = Math.max(16, Math.round(meleeReach() * 0.6));
  const baseX = player.x + ux*(player.r - 2);
  const baseY = player.y + uy*(player.r - 2);
  const tipX  = player.x + ux*(player.r + spearLen);
  const tipY  = player.y + uy*(player.r + spearLen);

  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY);
  ctx.lineWidth = 3; ctx.strokeStyle = '#fcd34d'; ctx.stroke();

  const px = -uy, py = ux;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - ux*7 + px*3, tipY - uy*7 + py*3);
  ctx.lineTo(tipX - ux*7 - px*3, tipY - uy*7 - py*3);
  ctx.closePath(); ctx.fillStyle = '#fde68a'; ctx.fill();
}

function draw(){
  ctx.fillStyle = GAME.bg; ctx.fillRect(0,0, game.width, game.height);

  // sniper sightlines
  const now = game.time;
  for(const e of enemies){
    if(!e.alive) continue;
    if (e.type==='sniper' && e.aiming){
      const len = 1500, ex = e.x + Math.cos(e.aimAng)*len, ey = e.y + Math.sin(e.aimAng)*len;
      const t = Math.min(1, (now - e.aimStart)/Math.max(1,e.aimDur));
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45*t;
      ctx.strokeStyle = '#f87171';
      ctx.setLineDash([8,8]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
	
    const fade = game.dropsFading ? Math.max(0, Math.min(1, (game.dropsFadeEnd - now) / 700)) : 1;
	ctx.save();
	ctx.globalAlpha *= fade;
	// Subtle breathing pulse (scales radius + alpha). Period ~= 1.8s


  // drops
for (const d of drops) {
  // --- Pronounced pulse ---
  const DROP_PULSE_MS = 1800;      // pulse period
  const ph = (d.pulse != null ? d.pulse : 0);
  const t  = (now % DROP_PULSE_MS) / DROP_PULSE_MS;
  const s  = (Math.sin(t * TAU + ph) + 1) * 0.5; // 0..1

  // stronger swing: alpha 0.55→1.00, scale 0.90→1.10
  const alphaPulse = 0.55 + 0.45 * s;
  const scalePulse = 0.90 + 0.20 * s;

  ctx.save();
  ctx.globalAlpha *= alphaPulse;

  // Use a pulsed radius as your size basis
  const r = d.r * scalePulse;

  if (d.type === 'item') {
    // === Yellow SQUARE item drop ===
    const half = r;                       // side = 2r
    const x = d.x - half, y = d.y - half;

    ctx.fillStyle   = '#facc15';          // amber-400
    ctx.strokeStyle = '#d97706';          // amber-600
    ctx.lineWidth   = 2;

    ctx.beginPath();
    ctx.rect(x, y, half*2, half*2);
    ctx.fill();
    ctx.stroke();

    // (optional) crisp pixel alignment:
    // ctx.translate(0.5, 0.5);

  } else if (d.type === 'hp') {
    // === Green CIRCLE with a "+" ===
    // circle
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, TAU);
    ctx.fillStyle   = '#10b981';          // emerald-500
    ctx.strokeStyle = '#064e3b';          // emerald-900
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();

    // plus sign (scales with r)
    const arm = r * 0.55;                 // half-length of each bar
    ctx.beginPath();
    ctx.lineWidth   = Math.max(2, r * 0.28);
    ctx.lineCap     = 'round';
    ctx.strokeStyle = '#ecfdf5';          // very light green/white

    // horizontal
    ctx.moveTo(d.x - arm, d.y);
    ctx.lineTo(d.x + arm, d.y);
    // vertical
    ctx.moveTo(d.x, d.y - arm);
    ctx.lineTo(d.x, d.y + arm);

    ctx.stroke();
  }

  ctx.restore();
}

  ctx.restore();

  // enemies
  for(const e of enemies){ if(!e.alive) continue; drawEnemy(e); }

  // projectiles
  for(const p of projectiles){
    if(!p.alive) continue;
    const sniper = p.src === 'sniper';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fillStyle = sniper ? '#f87171' : '#67e8f9';
    ctx.strokeStyle = sniper ? '#fecaca' : '#e0f2fe';
    ctx.fill(); ctx.stroke();
  }

  drawPlayer();

  // swing FX
  {
    const life = FX.swingLifeMs;
    ctx.save();
    for(let i=swingFX.length-1;i>=0;i--){
      const s = swingFX[i]; const age = now - s.t;
      if(age>life){ swingFX.splice(i,1); continue; }
      const p = age/life;
      ctx.globalAlpha = 1-p;
      ctx.beginPath();
      const r0 = player.r + 6;
	  const r1 = Math.max(r0 + 6, meleeReach());
      ctx.arc(s.x, s.y, r1, s.a - 0.6 + p*0.2, s.a + 0.6 - p*0.2);
      ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }

  // floating damage numbers
  {
    const lifeF = FX.floatyLifeMs;
    ctx.save();
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for(let i=floaties.length-1;i>=0;i--){
      const f = floaties[i]; const age = now - f.t;
      if(age>lifeF){ floaties.splice(i,1); continue; }
      const p = age / lifeF; const y = f.y - 22*p;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#0b0f1a'; ctx.lineWidth = 3; ctx.strokeText(f.val, f.x, y);
      ctx.fillStyle = '#fde68a'; ctx.fillText(f.val, f.x, y);
    }
    ctx.restore();
  }

  // crosshair
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 5, 0, Math.PI*2);
  ctx.moveTo(mouse.x-10, mouse.y); ctx.lineTo(mouse.x+10, mouse.y);
  ctx.moveTo(mouse.x, mouse.y-10); ctx.lineTo(mouse.x, mouse.y+10);
  ctx.strokeStyle = '#94a3b8'; ctx.stroke();
}

/* ========= Enemies & Drops ========= */
const enemies = [];
const drops = [];
const projectiles = [];
function isBossWave(){ return game.wave % 10 === 0; }
function sniperCapForWave(w){ return Math.min(1 + Math.floor(w/8), 4); }

/* ========= Wave cleanup ========= */
// Replace the previous "clear immediately" version with this:
function clearPickups(){
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  game.dropsFading = true;
  game.dropsFadeEnd = now + 700; // 0.7s subtle fade window
}


function spawnWave(n){
  // Clear leftover pickups from prior wave
  clearPickups();
  enemies.length = 0;
  game.bossAlive = false;

  if (isBossWave()){
	// Cycle bosses by theme every 10 waves: 10=zombie, 20=alien, 30=demon, then repeat.
	const bossOrder = ['zombie_boss', 'alien_boss', 'demon_boss'];
	const stage = Math.floor(game.wave / 10);               // 1 at wave 10, 2 at 20, 3 at 30...
	const bossType = bossOrder[(stage - 1) % bossOrder.length];

    const hp = 600 + game.wave*55;
    let ms = 90 + Math.floor(game.wave*1.8);
    ms = Math.round(ms * enemySpeedScalar(game.wave));
    ms = Math.round(ms * (0.92 + Math.random()*0.16));
    
    enemies.push({
      x: game.width/2, y: 120, r: 30,
      hp, maxhp: hp, ms, alive:true,
      dmg: 20 + Math.floor(game.wave*1.3),
      type: bossType,
	  isBoss: true,
      cd: 1400,
      cdVar: Math.round(1400 * (0.9 + Math.random()*0.4)),
      lastShot: performance.now() - Math.random()*1400,
      side:(Math.random()<0.5?-1:1),
      retreatAt:0
    });
    game.bossAlive = true;
    return;
  }
   
		// Gated pools by wave
		const baseTypes = ['zombie'];
		if (game.wave >= 3)  baseTypes.push('demon');  // demons start at wave 3
		if (game.wave >= 11) baseTypes.push('alien');  // aliens start at wave 11
		const types = (game.wave >= 16) ? baseTypes.concat('sniper') : baseTypes; // snipers start at wave 16

		let sniperCount = 0, maxSnipers = sniperCapForWave(game.wave);


  for(let i=0;i<n;i++){
    const edge = rint(0,3);
    let x=0,y=0; const pad=40;
    if(edge===0){ x=pad; y=rand(pad, game.height-pad); }
    else if(edge===1){ x=game.width-pad; y=rand(pad, game.height-pad); }
    else if(edge===2){ x=rand(pad, game.width-pad); y=pad; }
    else { x=rand(pad, game.width-pad); y=game.height-pad; }

    const baseHP = 24 + game.wave*7 + rint(0,10);
    const baseMS = 70 + game.wave*4 + rint(0,18);
    const baseDMG = 7 + Math.floor(game.wave*1.1);

    let type = choice(types);
    if (type==='sniper' && sniperCount>=maxSnipers) type = choice(baseTypes);

    let hp=baseHP, ms=baseMS, dmg=baseDMG, cd=1000;
    if(type==='zombie'){ hp=Math.round(baseHP*1.4); ms=Math.round(baseMS*0.75); dmg=Math.round(baseDMG*1.35); }
    if(type==='demon'){  hp=Math.round(baseHP*0.9);  ms=Math.round(baseMS*1.35); dmg=Math.round(baseDMG*0.9); }
    if(type==='alien'){  hp=Math.round(baseHP*1.0);  ms=Math.round(baseMS*.6);  dmg=Math.round(baseDMG*.5); cd=2000 - Math.min(700, game.wave*15); }
    if(type==='sniper'){ hp=Math.round(baseHP*0.80); ms=Math.round(baseMS*0.85); dmg=Math.round(baseDMG*3.2); cd=3000 - Math.min(1200, game.wave*20); }
    ms = Math.round(ms * enemySpeedScalar(game.wave));     // wave-based ramp
    ms = Math.round(ms * (0.92 + Math.random()*0.16));     // ±8% per-enemy jitter

    const cdVar = Math.max(400, Math.round(cd*(0.85 + Math.random()*0.5)));
    const lastShot = performance.now() - Math.random()*cdVar;

    enemies.push({
      x,y, r:12, hp, maxhp:hp, ms, alive:true, dmg, type, cd, cdVar,
      lastShot,
      side:(Math.random()<0.5?-1:1),
      retreatAt:0,
      aiming:false, aimStart:0, aimDur:0, aimAng:0,
      spawnSilenceUntil: (type==='sniper') ? performance.now() + rint(Math.floor(SNIPER.spawnDelayMs*0.7), Math.floor(SNIPER.spawnDelayMs*1.3)) : 0
    });
    if (type==='sniper') sniperCount++;
  }
}

function enemyDropChance(){
  const base = 0.10 + game.wave * 0.008;
  const bonus = Math.min(0.25, (player.stats.luck||0) * 0.0025);
 
 return Math.min(0.55, base + bonus);
}

function makeBossAffix(forItem, power){
  // pick from pool that is valid for this slot
  const candidates = BOSS_AFFIX_POOL.filter(a => a.slots.includes(forItem.slot));
  if (candidates.length === 0) return null;
  const a = choice(candidates);
  const spread = (a.kind === 'flat') ? rand(a.min,a.max) : rint(a.min,a.max);
  const val = (a.kind === 'flat') ? Math.round(spread*10)/10 : spread;
  return { key:a.key, name:a.name, val, pct:(a.kind==='pct') };
}

function rollBossAffixes(item){
  const want = 1 + (Math.random() < 0.50 ? 1 : 0); // 1–2 boss affixes
  const used = new Set(item.affixes.map(a=>a.key));
  let tries = 0;
  while (item.affixes.length < 6 && (item.affixes.filter(a => BOSS_AFFIX_POOL.some(b=>b.key===a.key)).length < want) && tries < 12){
    const a = makeBossAffix(item, item.power + 10);
    tries++;
    if (!a || used.has(a.key)) continue;
    ensureAffixMeta(a);
    item.affixes.push(a);
    used.add(a.key);
  }
  // bump power/rarity to feel special
  item.power += 6;
  item.rarity = rarityFor(item.power + (item.affixes?.length||0)*5);
}

function bossDrop(){
  // roll only slots that can carry boss affixes
  let boosted; let attempts = 0;
  do {
    boosted = makeItem(game.wave + 5, player.stats.luck + 3);
    attempts++;
  } while (!slotSupportsBossAffix(boosted.slot) && attempts < 20);

  // make it feel spicy
  if (boosted.affixes.length < 4) boosted.affixes.push(makeAffix(boosted.power + 8));
  boosted.power += 8;
  boosted.rarity = rarityFor(boosted.power);

  // inject 1–2 boss-only affixes; FORCE at least one if RNG failed
  rollBossAffixes(boosted);
  const hasBoss = boosted.affixes.some(a => BOSS_AFFIX_KEYS.has(a.key));
  if (!hasBoss){
    const forced = makeBossAffix(boosted, boosted.power + 12);
    if (forced){ ensureAffixMeta(forced); boosted.affixes.push(forced); }
    boosted.rarity = rarityFor(boosted.power + 10);
  }

  // tag for quick verification in tooltips/dev
  boosted.isBossItem = true;
  return boosted;
}




function wallAvoidVector(e, pad=48){
  let vx=0, vy=0;
  if(e.x < pad) vx += (pad-e.x)/pad;
  if(e.x > game.width-pad) vx -= (e.x-(game.width-pad))/pad;
  if(e.y < pad) vy += (pad-e.y)/pad;
  if(e.y > game.height-pad) vy -= (e.y-(game.height-pad))/pad;
  return {vx,vy};
}

/**
 * Updates AI, movement, aiming, and projectile firing for all enemies.
 * Handles touch/projectile damage and separation.
 * @param {number} dt - Delta time in ms
 */
function updateEnemies(dt){
  const now = game.time;
  for(const e of enemies){
    if(!e.alive) continue;
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
	const slowActive = now < (e.slowUntil || 0);
	const slow = slowActive ? (e.slowMult || 1) : 1;

    if (e.type==='zombie' || e.type==='zombie_boss') {

      e.x += Math.cos(ang) * e.ms * slow * dt/1000;
      e.y += Math.sin(ang) * e.ms * slow * dt/1000;

    }  else if (e.type==='demon' || e.type==='demon_boss') {
      const speed = e.ms * (1.1 + 0.2*Math.sin(now/180)) * slow;
      let dir = 1; if(now < (e.fleeUntil||0)) dir = -1;
      e.x += Math.cos(ang) * speed * dt/1000 * dir;
      e.y += Math.sin(ang) * speed * dt/1000 * dir;

    } else if(e.type==='sniper'){
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const dTo = Math.hypot(player.x - e.x, player.y - e.y);
      let mx=0,my=0;
      if (dTo < SNIPER.minDist){ mx=-ux; my=-uy; }
      else if (dTo > SNIPER.maxDist){ mx=ux; my=uy; }
      else {
        const side = (e.side !== undefined) ? e.side : (e.side=(Math.random()<0.5?-1:1));
        mx = -uy*side; my = ux*side; if(Math.random()<0.003) e.side *= -1;
      }
      const sp = e.ms * 0.9 * slow * dt/1000; e.x += mx*sp; e.y += my*sp;

      const cdUse = e.cdVar || e.cd || 2400;
      const ready = (now - (e.lastShot||0)) > cdUse;
      if (!e.aiming && ready && now >= (e.spawnSilenceUntil||0)){
        e.aiming = true; e.aimStart = now; e.aimDur = SNIPER.windupMs; e.aimAng = ang;
      }
      if (e.aiming){
        const desired = Math.atan2(player.y - e.y, player.x - e.x);
        const diff = Math.atan2(Math.sin(desired - e.aimAng), Math.cos(desired - e.aimAng));
        e.aimAng += diff * 0.08;
        if (now - e.aimStart >= e.aimDur){
          e.aiming=false; e.lastShot = now;
          const spd = SNIPER.bulletSpeed + game.wave*8;
          projectiles.push({ x:e.x, y:e.y, vx:Math.cos(e.aimAng)*spd, vy:Math.sin(e.aimAng)*spd, r:3, dmg: Math.round(e.dmg*1.0), alive:true, src:'sniper' });
        }
      }

    }  else if (e.type==='alien' || e.type==='alien_boss') {

      const ux = Math.cos(ang), uy = Math.sin(ang);
      const dTo = Math.hypot(player.x - e.x, player.y - e.y);
      let mx=0,my=0;
      const min=200, max=260;
      const side = (e.side !== undefined) ? e.side : (e.side=(Math.random()<0.5?-1:1));

      if(dTo < min){
        if(!e.retreatAt) e.retreatAt = now + AI.alienRetreatDelay;
        if(now < e.retreatAt){ mx=-uy*side; my=ux*side; }
        else { mx=-ux; my=-uy; }
      } else {
        if(dTo > min + AI.alienHysteresis) e.retreatAt = 0;
        if(dTo > max){ mx=ux*0.6; my=uy*0.6; }
        else { mx=-uy*side; my=ux*side; }
      }

      const w = wallAvoidVector(e, 56);
      mx += w.vx*1.2; my += w.vy*1.2;
      const nearEdge = (Math.abs(w.vx)>0.1 || Math.abs(w.vy)>0.1);
      if (nearEdge && now - (e.lastEdgeFlip||0) > 1000){ e.side *= -1; e.lastEdgeFlip = now; }

      const sp = e.ms * ((dTo < min && now >= (e.retreatAt||0)) ? 1.15 : 1.0) * slow * dt/1000;
      e.x += mx*sp; e.y += my*sp;

      const cdUse = e.cdVar || e.cd || 1200;
      if (now - (e.lastShot||0) > cdUse){
  e.lastShot = now;

  // Aim toward player, then add spread
  const base   = Math.atan2(player.y - e.y, player.x - e.x);
  const spread = alienSpreadRadians(e);                 // uses your ALIEN_AIM tunables
  const ang    = base + (Math.random()*2 - 1) * spread;

  // Speed & damage exactly as before
  const spd = 180 + game.wave * 6;
  const vx  = Math.cos(ang) * spd;
  const vy  = Math.sin(ang) * spd;

  projectiles.push({
    x: e.x, y: e.y,
    vx, vy,
    r: 4,
    dmg: Math.round(e.dmg * 0.7),
    alive: true,
    src: 'alien'
  });
}


    } else if(e.isBoss){
      e.x += Math.cos(ang) * e.ms * dt/1000 * 0.9;
      e.y += Math.sin(ang) * e.ms * dt/1000 * 0.9;

      const cdUse = e.cdVar || e.cd || 1200;
      if(now - (e.lastShot||0) > cdUse){
        e.lastShot = now;
        const vx = Math.cos(ang) * (180 + game.wave*6);
        const vy = Math.sin(ang) * (180 + game.wave*6);
        projectiles.push({ x:e.x, y:e.y, vx, vy, r:4, dmg: Math.round(e.dmg*0.7), alive:true, src:'boss' });
      }

    } else {
      e.x += Math.cos(ang) * e.ms * dt/1000;
      e.y += Math.sin(ang) * e.ms * dt/1000;
    }

    // touch damage (per-enemy cooldown + group cap)
const d = dist(player,e);
if (d < player.r + e.r){
  const now = game.time;
  if (now > (player.meleeWindowEnd || 0)) {
    player.meleeWindowEnd = now + DAMAGE.meleeWindowMs;
    player.meleeHitsInWindow = 0;
  }
  if (now >= (e.nextTouchAt || 0) && player.meleeHitsInWindow < DAMAGE.meleeMaxHitsPerWindow) {
    const mods = getTypeMods(e.type);
    const raw = Math.max(HIT.minContact, Math.round(e.dmg * HIT.contactMul * mods.drMult));
    if (raw > 0) {
      player.stats.hp -= raw;
	  floaties.push({ x:player.x, y:player.y - player.r - 4, val: raw, t: now });
      player.meleeHitsInWindow++;
      if (player.stats.hp <= 0){ player.stats.hp = 0; gameOver(); return; }
    }
    e.nextTouchAt = now + HIT.contactCooldownMs;
  }
}



  }

  // enemy-enemy separation
  for(let i=0;i<enemies.length;i++){
    const a = enemies[i]; if(!a.alive) continue;
    for(let j=i+1;j<enemies.length;j++){
      const b = enemies[j]; if(!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx,dy);
      const minDist = (a.r||12) + (b.r||12) - 1;
      if(d>0 && d < minDist){
        const nx = dx/d, ny = dy/d;
        const overlap = (minDist - d) * 0.5;
        a.x -= nx*overlap; a.y -= ny*overlap;
        b.x += nx*overlap; b.y += ny*overlap;
      }
    }
    a.x = clamp(a.x, a.r, game.width - a.r);
    a.y = clamp(a.y, a.r, game.height - a.r);
    if(a.type==='alien'){
      const hitEdge = (a.x<=a.r+1)||(a.x>=game.width-a.r-1)||(a.y<=a.r+1)||(a.y>=game.height-a.r-1);
      if(hitEdge) a.side *= -1;
    }
  }

  // projectiles update & collide
  for(const p of projectiles){
    if(!p.alive) continue;
    p.x += p.vx*dt/1000; p.y += p.vy*dt/1000;
    if(p.x<0||p.y<0||p.x>game.width||p.y>game.height) p.alive=false;
  }
  for(const p of projectiles){
    if(!p.alive) continue;
    if (Math.hypot(p.x-player.x, p.y-player.y) < player.r + p.r){
  if (now >= (player.nextProjAt || 0)){
    const mods = getTypeMods(p.src || 'alien');
    const dmg = Math.max(1, Math.round(p.dmg * mods.drMult));
    player.stats.hp -= dmg;
	floaties.push({ x:player.x, y:player.y - player.r - 4, val: dmg, t: now });
    player.nextProjAt = now + HIT.projectileCooldownMs;
    if (player.stats.hp <= 0){ player.stats.hp = 0; gameOver(); return; }
  }
  p.alive = false;
}


  }
  // purge
  for(let i=projectiles.length-1;i>=0;i--) if(!projectiles[i].alive) projectiles.splice(i,1);
}

/* ========= Combat & Player ========= */
/**
 * WASD movement with clamp to arena and stat-scaled speed.
 * @param {number} dt - Delta time in ms
 */
function movePlayer(dt){
  const sp = player.stats.ms * (dt/1000);
  let dx=0, dy=0;
  if(keys.has('w')) dy -= 1;
  if(keys.has('s')) dy += 1;
  if(keys.has('a')) dx -= 1;
  if(keys.has('d')) dx += 1;
  if(dx||dy){ const m = Math.hypot(dx,dy); dx/=m; dy/=m; }
  player.x = clamp(player.x + dx*sp, player.r, game.width - player.r);
  player.y = clamp(player.y + dy*sp, player.r, game.height - player.r);
}

/** Melee reach in pixels from the player's center (used by logic & visuals). */
function meleeReach(){
  return Math.round(player.stats.range);
}

/* ========= Centralized enemy death (keeps drops consistent) ========= */
function killEnemy(e, cause = 'generic'){
  if (!e || !e.alive) return;

  e.alive = false;
  game.kills++;
  game.credits += 1 + Math.floor(game.wave * 0.6);

  // HP pack roll (same as your current logic)
  if (Math.random() < LOOT.hpPackChance){
    drops.push({ type:'hp', x:e.x + rand(-6,6), y:e.y + rand(-6,6), r:9,  pulse: Math.random()*TAU });
  }

  // Item drop (boss vs normal)
  if (e.isBoss){
    const bi = bossDrop();
    drops.push({ type:'item', x:e.x, y:e.y, r:12, item: bossDrop(),    pulse: Math.random()*TAU });
    game.bossAlive = false;
  } else if (Math.random() < enemyDropChance()){
    game.drops++;
    drops.push({ type:'item', x:e.x, y:e.y, r:10, item: makeItem(game.wave, player.stats.luck), pulse: Math.random()*TAU });
  }
}

/**
 * Melee attack with angle cone; adds variance and floaties; respects attack cooldown.
 */
function tryAttack(){
  const now = game.time;
  if(now - player.lastAtk < player.stats.atkCd) return;
  if(!mouse.down) return;
  player.lastAtk = now;

  const aim = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  player.facing = aim;

  for(const e of enemies){
    if(!e.alive) continue;
    const d = dist(player,e);
    if (d <= meleeReach() + e.r) {
      const angTo = Math.atan2(e.y - player.y, e.x - player.x);
      const delta = Math.abs(Math.atan2(Math.sin(angTo-aim), Math.cos(angTo-aim)));
      if(delta <= Math.PI/3){
        // Base damage (includes % Dmg vs {type})
		const vs   = getVsMult(e.type);
		const base = Math.round(player.stats.dmg * vs);
		const v    = COMBAT.dmgVariancePct || 0;
		let dealt  = Math.max(1, Math.round(base * (1 - v + Math.random()*2*v)));

		// Execute (if enemy already low)
		const execPct = getAffixSum('exec_chance');
		if (execPct > 0){
		  const hpPct = (e.hp / e.maxhp) * 100;
		  if (hpPct <= BOSS_AFFIX_TUNES.EXEC_THRESHOLD_PCT && Math.random()*100 < execPct){
			dealt = Math.max(dealt, e.hp); // ensure lethal
		  }
		}


        e.hp -= dealt;
		// Life steal: flat healing on any damaging hit
		const steal = getAffixSum('lifesteal');
		if (steal > 0){
		  player.stats.hp = Math.min(player.stats.maxhp, player.stats.hp + steal);
		}

		// Apply slow on hit
		const slowPct = getAffixSum('slow_on_hit');
		if (slowPct > 0){
		  e.slowMult  = Math.max(BOSS_AFFIX_TUNES.SLOW_MIN_MULT, 1 - slowPct/100);
		  e.slowUntil = now + BOSS_AFFIX_TUNES.SLOW_DURATION_MS;
		}

        e.x += Math.cos(aim)*6; e.y += Math.sin(aim)*6;
        floaties.push({ x:e.x, y:e.y - e.r - 4, val: dealt, t: now });

        if(e.type==='demon'){ e.fleeUntil = now + 650; }

        if (e.hp <= 0){
		  killEnemy(e, 'melee');
		}

      }
    }
  }
  swingFX.push({ t: now, x: player.x, y: player.y, a: aim });
}

function applyRegen(dt){
  if(player.stats.regen>0){
    player.stats.hp = Math.min(player.stats.maxhp, player.stats.hp + player.stats.regen * dt/1000);
  }
}

function tryPickup(){
  for(let i=drops.length-1;i>=0;i--){
    const d = drops[i];
    if(dist(player,d) <= player.r + (d.r||10)){
      if(d.type==='hp'){
        player.stats.hp = Math.min(player.stats.maxhp, player.stats.hp + player.stats.maxhp*LOOT.hpPackHealFrac);
        drops.splice(i,1);
      } else if(d.type==='item'){
        if(player.inv.length >= INV_MAX) continue;
        player.inv.push(d.item); drops.splice(i,1); renderInventory();
      }
    }
  }
}

function checkWaveEnd(){
  if (game.state !== 'combat') return;
  if (enemies.every(e => !e.alive)){
    // Clear any stray enemy projectiles/telegraphs before intermission begins
    projectiles.length = 0;

    // If you have any other hostile visuals (e.g., sniper sightlines), also clear them here:
    // sightlines && (sightlines.length = 0);

    game.state = 'intermission';
    // If you still had auto-open here, keep it commented out:
    // openShop({reset:true});
    renderHUD();
  }
}

function gameOver(){
  game.state = 'over';
  alert('You died on wave '+game.wave+'. Refresh to try again.');
}

/* ========= Inventory & Equipment UI ========= */
const RARITY_CLASSES = ['rarity-common','rarity-uncommon','rarity-rare','rarity-epic','rarity-legendary'];
const INV_MAX = 15;
const invGrid = document.getElementById('inventory');
function itemValue(it){ return Math.max(1, Math.floor(it.power/3)); }

function renderEquipment(){
  const eqRoot = document.getElementById('equipment');
  if (!eqRoot) return;
  Array.from(eqRoot.querySelectorAll('.slot')).forEach(oldEl=>{
    const slot = oldEl.getAttribute('data-slot') || oldEl.dataset.slot;
    if (!slot) return;
    const el = oldEl.cloneNode(false);
    el.className = oldEl.className;
    el.setAttribute('data-slot', slot);
    oldEl.parentNode.replaceChild(el, oldEl);

    const it = player.equip[slot];
    el.classList.remove(...RARITY_CLASSES);
    el.innerHTML = '';

    if (it){
      el.classList.add('rarity-' + (it.rarity || 'common'));
      const img = document.createElement('img');
      img.src = iconFor(it.slot, it.rarity);
      img.alt = it.name;
      el.appendChild(img);

      const cap = document.createElement('div');
      cap.className = 'caption';
      cap.textContent = it.name;
      el.appendChild(cap);

      el.addEventListener('mouseenter', (e)=> showTooltipAt(it, e.clientX, e.clientY, {equipped:true}));
      el.addEventListener('mousemove',  (e)=> showTooltipAt(it, e.clientX, e.clientY, {equipped:true}));
      el.addEventListener('mouseleave', hideTooltip);
    } else {
      const ph = document.createElement('div');
      ph.className = 'placeholder';
      ph.textContent = slot[0].toUpperCase()+slot.slice(1);
      el.appendChild(ph);

      const sm = document.createElement('div');
      sm.className = 'small';
      sm.textContent = slot;
      el.appendChild(sm);
    }
  });
}

function renderInventory(){
  const invGrid = document.getElementById('inventory');
  if (!invGrid) return;

  // Build in a fragment to avoid partial reflows
  const frag = document.createDocumentFragment();

  // 1) Real items in order
  player.inv.forEach((it, idx)=>{
    const div = document.createElement('div');
    div.className = 'slot item';
    div.classList.add('rarity-'+(it.rarity||'common'));

    const img = document.createElement('img');
    img.src = iconFor(it.slot, it.rarity);
    img.alt = it.name;
    div.appendChild(img);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const sellBtn = document.createElement('button');
    sellBtn.className='mini sell';
    sellBtn.textContent='Sell';
    sellBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      game.credits += Math.max(1, Math.floor(it.power/3));
      player.inv.splice(idx,1);
      renderInventory();
      renderHUD();
      hideTooltip();
    });

 

    actions.appendChild(sellBtn);
    div.appendChild(actions);

    div.addEventListener('click', ()=> equipItem(idx));
    div.addEventListener('mouseenter', (e)=> showTooltipAt(it, e.clientX, e.clientY, {compare:true}));
    div.addEventListener('mousemove',  (e)=> showTooltipAt(it, e.clientX, e.clientY, {compare:true}));
    div.addEventListener('mouseleave', hideTooltip);

    frag.appendChild(div);      // ← append (never prepend)
  });

  // 2) Pad with empty slots up to INV_MAX (15)
  for (let i = player.inv.length; i < INV_MAX; i++){
    const empty = document.createElement('div');
    empty.className = 'slot empty';
    frag.appendChild(empty);
  }

  // Commit (single swap)
  invGrid.innerHTML = '';
  invGrid.appendChild(frag);

  // Equip panel last
  renderEquipment();
}


function equipItem(invIndex){
  const it = player.inv[invIndex]; if(!it) return;
  it.slot = normalizeSlotName(it.slot); // ensure new name
  const slot = it.slot;
  const current = player.equip[slot];
  player.equip[slot] = it;
  if(current) player.inv[invIndex] = current; else player.inv.splice(invIndex,1);
  recalcStats();
  renderInventory();
  renderHUD();   
  hideTooltip();
}


document.getElementById('sellAll').addEventListener('click', ()=>{
  const value = player.inv.reduce((t,it)=> t + itemValue(it), 0);
  game.credits += value;
  player.inv.length = 0;
  renderInventory();
  renderHUD();
});

/* ========= Shop Overlay ========= */
(function(){
  function ensureShopOverlay(){
    let el = document.getElementById('shopOverlay');
    if (el) return el;
    el = document.createElement('div'); el.id = 'shopOverlay';
    Object.assign(el.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.6)',display:'none',zIndex:9999});
    el.innerHTML = `
      <div id="shopCard" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#0b1220;border:1px solid #3b4763;border-radius:8px;max-width:720px;width:92%;padding:16px;color:#e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
          <h2 style="margin:0;font:600 18px system-ui">Shop — Wave <span id="shopWave"></span></h2>
          <div style="display:flex;align-items:center;gap:12px">
            <div>Credits: <span id="shopCredits"></span></div>
            <button id="shopSoftClose" title="Close (stay in intermission)" style="padding:4px 8px">×</button>
          </div>
        </div>
        <div id="shopList" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="startWaveBtn" style="padding:8px 12px">Start (N)ext Wave</button>
        </div>
      </div>`;
    document.body.appendChild(el);
el.querySelector('#startWaveBtn').addEventListener('click', ()=>{ hideTooltip(); closeShop(); });

el.querySelector('#shopSoftClose').addEventListener('click', ()=>{ hideTooltip(); closeShopSoft(); });
el.querySelector('#shopCard').addEventListener('mouseleave', hideTooltip); // belt & suspenders

    return el;
  }
  function shopPriceBase(){
  const w = Math.max(1, game.wave|0);
  const earlyEase = (w <= 6) ? 0.85 : 1.0;               // 15% off waves 1–6
  return Math.max(4, Math.round((7 + w * 1.15) * earlyEase));
}

  function shopItemPrice(it){ return Math.max(6, Math.floor(itemValue(it) * (1.8 + game.wave*0.35))); }

 function makeUpgradeOffer(key, amount, label){
  const buys  = game.shopBuys[key] || 0;                 // times you've bought THIS stat
  const base  = shopPriceBase();
  // gentler than before: small linear step + mild multiplier
  const price = Math.max(5, Math.round(base * (1 + buys * 0.18)) + buys * 2);
  return { kind:'upgrade', key, amount, label, price };
}

function makeHealOffer(){
  const pct = 0.30; // 30% of max HP
  const healAmt = Math.round(player.stats.maxhp * pct);
  // Price scaled with wave (tweak the 1.1 multiplier to taste)
  const price = Math.max(6, Math.floor(shopPriceBase() * 1.1));
  return { kind:'heal', pct, healAmt, price, label:`Heal ${Math.round(pct*100)}%` };
}

function makeUpgradeItemOffer(slot, label){
  const w   = Math.max(1, game.wave|0);
  const eq  = player.equip[slot];
  const u   = eq ? (eq.upg || 0) : 0;                    // how many upgrades that item has
  const base = 8 + Math.round(w * 2.2);                  // linear wave scaling (gentle)
  const price = Math.round(base * (1 + u * 0.35));       // each prior upgrade adds 35%
  return { kind:'upgradeItem', slot, label, price };
}


// Small, safe bump to an existing affix
function applyUpgradeToItem(item){
  if (!item) return null;
  if (!item.affixes || item.affixes.length === 0) item.affixes = [ makeAffix(item.power) ];

  const a = choice(item.affixes);
  ensureAffixMeta(a);                 // make sure base/bonus exist
  const before = a.val;
  const isPct  = !!a.pct;
  let delta = 0;

  if (isPct){
    delta = rint(2,4);                // +2–4% to existing % affix
    a.val += delta;
  } else {
    switch(a.key){
      case 'regen': { const inc = rand(0.15,0.35); a.val = Math.round((a.val + inc)*10)/10; delta = Math.round(inc*10)/10; break; }
      case 'hp':    delta = rint(8,14); a.val += delta; break;
      case 'dmg':   delta = rint(1,3);  a.val += delta; break;
      case 'range': delta = rint(2,4);  a.val += delta; break;
      case 'str':
      case 'agi':
      case 'end':
      case 'luck':  delta = 1;          a.val += delta; break;
      default:      delta = rint(1,3);  a.val += delta;
    }
  }

  a.bonus = (a.bonus || 0) + delta;   // << track cumulative upgrades

  const oldRarity = item.rarity;
  item.power += 2 + Math.floor(game.wave*0.3);
  item.rarity = rarityFor(item.power + (item.affixes?.length||0)*5);
  item.upg = (item.upg || 0) + 1;

  return {
    slot: item.slot, itemName: item.name, key: a.key, isPct,
    before, after: a.val, delta,
    rarityChanged: oldRarity !== item.rarity, newRarity: item.rarity
  };
}





  function buildShopRows(reset){
    if (reset){ game.shopOffers = []; }
    if (!Array.isArray(game.shopOffers) || game.shopOffers.length===0){
      game.shopOffers = [
        makeUpgradeOffer('str', 1 + Math.floor(game.wave/8),  'Strength +'),
        makeUpgradeOffer('agi', 1 + Math.floor(game.wave/10), 'Agility +'),
        makeUpgradeOffer('end', 1 + Math.floor(game.wave/10), 'Endurance +'),
      ];
	  // Luck upgrade appears with probability: 10% + 1% per current Luck
	{
  // Chance = 10% + 1% per current Luck (clamped to 80% so it doesn't get silly)
  const p = Math.min(0.80, 0.10 + 0.01 * (player.stats.luck || 0));
  if (Math.random() < p){
    game.shopOffers.push(makeUpgradeOffer('luck', 1, 'Luck +'));
  }
}
      const it1 = makeItem(game.wave+1, player.stats.luck);
      const it2 = makeItem(game.wave+2, player.stats.luck);
// Equipment upgrades (one each per intermission)
	game.shopOffers.push(makeUpgradeItemOffer('weapon','Upgrade Weapon'));
	game.shopOffers.push(makeUpgradeItemOffer('trinket','Upgrade Amulet')); // 'trinket' slot, label says Amulet
	game.shopOffers.push(makeUpgradeItemOffer('armor','Upgrade Armor'));
	game.shopOffers.push(makeUpgradeItemOffer('ring','Upgrade Ring'));
	game.shopOffers.push(makeUpgradeItemOffer('boots','Upgrade Boots'));


      // Wave-1: one-time cheap *random* starter offer (STR/AGI/END)
if (game.wave === 1){
  // Only pick once so reopening the shop doesn't re-roll
  if (!game._starterOffer){
    const keys   = ['str','agi','end'];
    const labels = { str:'Starter Strength +', agi:'Starter Agility +', end:'Starter Endurance +' };
    const key    = keys[Math.floor(Math.random() * keys.length)];
    game._starterOffer = { kind:'upgrade', key, amount: 1, label: labels[key], price: 4 };
  }
  game.shopOffers.unshift(game._starterOffer);
}

      // One heal per intermission
game.shopOffers.push(makeHealOffer());

      game.shopOffers.push({ kind:'item', item: it1, price: shopItemPrice(it1) });
      game.shopOffers.push({ kind:'item', item: it2, price: shopItemPrice(it2) });

    }
  }

function renderShop(){
  const overlay = ensureShopOverlay();   // returns #shopOverlay
  hideTooltip();
  overlay.style.display = 'block';

  // scope all lookups INSIDE the overlay
  overlay.querySelector('#shopWave').textContent    = String(game.wave);
  overlay.querySelector('#shopCredits').textContent = String(game.credits);

  const list = overlay.querySelector('#shopList');
  list.innerHTML = '';

  game.shopOffers.forEach((o, idx)=>{
    const card = document.createElement('div');
    card.className = 'shop-card';

    let disabled = false;
    const sold = !!o.sold;   // NEW

    if (o.kind === 'upgrade'){
      card.innerHTML = `
        <div class="title">${o.label}${o.amount}</div>
        <div class="sub">Permanent stat increase</div>
        <div class="price">${sold ? 'Purchased' : 'Cost ' + o.price}</div>`;
    }
    else if (o.kind === 'heal'){
      const missing = Math.max(0, player.stats.maxhp - player.stats.hp);
      disabled = (missing <= 0);
      card.innerHTML = `
        <div class="title">${o.label}</div>
        <div class="sub">${o.healAmt} HP (${Math.round(o.pct*100)}%)</div>
        <div class="price">${sold ? 'Purchased' : (disabled ? 'Full HP' : 'Cost ' + o.price)}</div>`;
    }
    else if (o.kind === 'upgradeItem'){
      const eq = player.equip[o.slot];
      disabled = !eq;
      const slotName = o.slot==='trinket' ? 'Amulet' : (o.slot[0].toUpperCase()+o.slot.slice(1));
      card.innerHTML = `
        <div class="title">${o.label}</div>
        <div class="sub">${slotName}${eq ? (': ' + eq.name) : ' not equipped'}</div>
        <div class="price">${sold ? 'Purchased' : (disabled ? 'Unavailable' : 'Cost ' + o.price)}</div>`;
    }
    else { // item
      card.innerHTML = `
        <div class="title">${o.item.name}</div>
        <div class="sub">${o.item.slot} • pwr ${o.item.power}</div>
        <div class="price">${sold ? 'Purchased' : 'Cost ' + o.price}</div>`;
      if (!sold){ // only show compare tooltip for buyable items
        card.addEventListener('mouseenter', (e)=> showTooltipAt(o.item, e.clientX, e.clientY, {compare:true}));
        card.addEventListener('mousemove',  (e)=> showTooltipAt(o.item, e.clientX, e.clientY, {compare:true}));
        card.addEventListener('mouseleave', hideTooltip);
      }
    }

    if (disabled || sold) card.classList.add('disabled');

    card.addEventListener('click', ()=>{
      if (disabled || sold) return;
      hideTooltip();
      buyOffer(idx);
    });

    list.appendChild(card);
  });
}



function buyOffer(idx){
  hideTooltip();
  const o = game.shopOffers[idx]; if (!o) return;
  if (game.credits < o.price) return;

  game.credits -= o.price;

  if (o.kind === 'upgrade'){
    game.shopBuys[o.key] = (game.shopBuys[o.key]||0) + 1;
    player.base[o.key] = (player.base[o.key]||0) + o.amount;
    recalcStats();
    o.sold = true;
  } else if (o.kind === 'heal'){
    if (player.stats.hp < player.stats.maxhp){
      player.stats.hp = Math.min(player.stats.maxhp, player.stats.hp + o.healAmt);
      o.sold = true;
    }
  }  else if (o.kind==='upgradeItem'){
  const eq = player.equip[o.slot];
  if (!eq){ game.credits += o.price; return; } // safety refund
  const rep = applyUpgradeToItem(eq);          // << get report
  recalcStats();
  renderInventory();
  o.sold = true;                               // or keep sold-out behavior
  renderShop();
  renderHUD();
  if (rep) showShopFlash(formatUpgradeReport(rep)); // << show message
  return;
}
 else { // item
    if (player.inv.length >= INV_MAX){ game.credits += o.price; return; } // refund if full
    player.inv.push(o.item);
    renderInventory();
    o.sold = true;
  }

  renderShop();
  renderHUD();
}

  function openShop(opts={}){
    const reset = !!opts.reset || (game.shopPersistWave !== game.wave) || !Array.isArray(game.shopOffers) || game.shopOffers.length===0;
    if (reset){
      buildShopRows(true);
      game.shopPersistWave = game.wave;
    }
    game.state = 'shop';
    renderShop();
  }
  function closeShopSoft(){
    const el = document.getElementById('shopOverlay');
    if (el) el.style.display = 'none';
    game.state = 'intermission';
    renderHUD();
  }
  function closeShop(){
    const el = document.getElementById('shopOverlay');
    if (el) el.style.display = 'none';
    game.shopOffers = [];
    game.shopPersistWave = null;
    if (typeof startNextWave === 'function') startNextWave();
    else {
      game.wave++;
      spawnWave(12 + Math.floor(game.wave*0.6));
      game.state = 'combat';
    }
    renderHUD();
  }

  // expose
  root.openShop = openShop;
  root.closeShop = closeShop;
  root.closeShopSoft = closeShopSoft;
  root.buildShopRows = buildShopRows;
})();
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

function formatUpgradeReport(rep){
  // Human label for the affix
  let label;
  if (rep.key && rep.key.startsWith('vs_')){
    const t = rep.key.split('_')[1]; label = `Damage vs ${cap(t)}s`;
  } else if (rep.key && rep.key.startsWith('dr_')){
    const t = rep.key.split('_')[1]; label = `DR vs ${cap(t)}s`;
  } else {
    const map = { dmg:'Damage', hp:'Max HP', regen:'HP Regen', range:'Range', str:'Strength', agi:'Agility', end:'Endurance', luck:'Luck' };
    label = map[rep.key] || cap(rep.key || 'Stat');
  }
  const fmt = (v)=> (Number.isInteger(v) ? v : (+v).toFixed(1));
  const deltaTxt = rep.isPct ? `+${fmt(rep.delta)}%` : `+${fmt(rep.delta)}`;
  const oldTxt   = rep.isPct ? `${fmt(rep.before)}%` : fmt(rep.before);
  const newTxt   = rep.isPct ? `${fmt(rep.after)}%`  : fmt(rep.after);
  const rarityTxt = rep.rarityChanged ? ` <span style="color:#fbbf24">(Rarity → ${cap(rep.newRarity)})</span>` : '';
  return `<b>${cap(rep.slot)} upgraded:</b> ${deltaTxt} ${label} <span style="opacity:.8">(${oldTxt} → ${newTxt})</span>${rarityTxt}`;
}

function showShopFlash(html){
  const overlay = document.getElementById('shopOverlay'); if (!overlay) return;
  // Create once
  let f = overlay.querySelector('#shopFlash');
  if (!f){
    f = document.createElement('div'); f.id = 'shopFlash';
    Object.assign(f.style,{
      position:'fixed', left:'50%', transform:'translateX(-50%)',
      top:'14%', zIndex:10001, background:'#0b1220', color:'#e5e7eb',
      border:'1px solid #334155', borderRadius:'8px',
      padding:'6px 10px', boxShadow:'0 8px 22px rgba(0,0,0,.45)',
      font:'12px system-ui', pointerEvents:'none'
    });
    overlay.appendChild(f);
  }
  f.innerHTML = html;
  f.style.display = 'block';
  clearTimeout(f._h); f._h = setTimeout(()=>{ f.style.display='none'; }, 1400);
}

/* ========= HUD ========= */
// === Hint fade helpers (define once) ===
const HINT_FADE_MS = 220;

function showHint(text){
  const el = document.getElementById('keyHint');
  if (!el) return;
  if (text != null) el.textContent = text;
  if (el.style.display !== 'block'){
    el.style.display = 'block';
    void el.offsetWidth; // reflow to enable transition
  }
  el.style.opacity = '1';
}

function hideHint(){
  const el = document.getElementById('keyHint');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => {
    if (el.style.opacity === '0') el.style.display = 'none';
  }, HINT_FADE_MS + 16);
}
// === Key-hint: creation + fade helpers ===

function ensureKeyHint(){
  let el = document.getElementById('keyHint');
  if (!el){
    el = document.createElement('div');
    el.id = 'keyHint';
    Object.assign(el.style, {
      position:'fixed', right:'12px', bottom:'12px',
      background:'#0f1629', color:'#e5e7eb',
      border:'1px solid #2b3650', borderRadius:'8px',
      padding:'10px 14px', font:'16px system-ui',
      opacity:'0', transition:`opacity ${HINT_FADE_MS}ms ease`,
      zIndex:'10060', display:'none', pointerEvents:'none'
    });
    document.body.appendChild(el);
  }
  return el;
}
function ensurePickupHint(){
  ensureKeyHintStyles();
  let el = document.getElementById('pickupHint');
  if (!el){
    el = document.createElement('div');
    el.id = 'pickupHint';
    Object.assign(el.style, {
      position:'fixed', right:'12px', bottom:'56px', // stacked above the other hint
      background:'#0f1629', color:'#e5e7eb',
      border:'1px solid #2b3650', borderRadius:'8px',
      padding:'8px 12px', font:'14px system-ui',
      zIndex:'10060', pointerEvents:'none',
      display:'none', opacity:'0', transition:'opacity 220ms ease',
      animation:'none'
    });
    document.body.appendChild(el);
  }
  return el;
}

function showPickupHintPulsing(text){
  const el = ensurePickupHint();
  if (text != null) el.textContent = text;
  if (el.style.display !== 'block'){ el.style.display = 'block'; void el.offsetWidth; }
  el.style.animation = `keyHintPulse ${HINT_PULSE_MS}ms ease-in-out infinite`;
  el.style.opacity = '1';
}

function hidePickupHint(){
  const el = ensurePickupHint();
  el.style.animation = 'none';
  el.style.opacity = '0';
  setTimeout(()=>{ if (el.style.opacity==='0') el.style.display='none'; }, 236);
}

// Helper: proximity check matches tryPickup's reach (+small leniency)
function playerNearDrop(){
  for (const d of drops){
    const reach = player.r + (d.r || 10) + 6; // +6 px cushion feels better
    if (Math.hypot(player.x - d.x, player.y - d.y) <= reach) return true;
  }
  return false;
}

function showHint(text){
  const el = ensureKeyHint();
  if (text != null) el.textContent = text;
  if (el.style.display !== 'block'){
    el.style.display = 'block';
    void el.offsetWidth; // reflow so the transition runs
  }
  el.style.opacity = '1';
}

function hideHint(){
  const el = ensureKeyHint();
  el.style.opacity = '0';
  setTimeout(()=>{ if (el.style.opacity === '0') el.style.display = 'none'; }, HINT_FADE_MS + 16);
}
// === Key-hint: pulsing fade helpers (define once) ===
const HINT_PULSE_MS = 1700;    // full pulse cycle (~1.7s)

function ensureKeyHintStyles(){
  if (!document.getElementById('keyHintPulseStyles')){
    const style = document.createElement('style');
    style.id = 'keyHintPulseStyles';
    style.textContent = `
@keyframes keyHintPulse {
  0%   { opacity: 0; }
  15%  { opacity: 1; }  /* fade in */
  50%  { opacity: 1; }  /* hold visible */
  100% { opacity: 0; }  /* fade out */
}`;
    document.head.appendChild(style);
  }
}

function ensureKeyHint(){
  ensureKeyHintStyles();
  let el = document.getElementById('keyHint');
  if (!el){
    el = document.createElement('div');
    el.id = 'keyHint';
    Object.assign(el.style, {
      position:'fixed', right:'12px', bottom:'12px',
      background:'#0f1629', color:'#e5e7eb',
      border:'1px solid #2b3650', borderRadius:'8px',
      padding:'10px 14px', font:'16px system-ui',
      zIndex:'10060', pointerEvents:'none',
      // start hidden; use transition only for the "hide" path
      opacity:'0', display:'none', transition:`opacity ${HINT_FADE_MS}ms ease`,
      // animation will be set/cleared by the helpers below
      animation:'none'
    });
    document.body.appendChild(el);
  }
  return el;
}

function showHintPulsing(text){
  const el = ensureKeyHint();
  if (text != null) el.textContent = text;
  if (el.style.display !== 'block'){
    el.style.display = 'block';
    void el.offsetWidth; // reflow so CSS can apply the animation cleanly
  }
  // run the pulse forever
  el.style.animation = `keyHintPulse ${HINT_PULSE_MS}ms ease-in-out infinite`;
}

function hideHint(){
  const el = ensureKeyHint();
  // stop the pulse, fade out, then hide
  el.style.animation = 'none';
  el.style.opacity = '0';
  setTimeout(()=>{ if (el.style.opacity === '0') el.style.display='none'; }, HINT_FADE_MS + 16);
}

function renderHUD(){
  const hpPct = Math.max(0, Math.min(1, player.stats.hp / player.stats.maxhp));
  document.getElementById('hpBar').style.width = (hpPct*100)+'%';
  document.getElementById('hpText').textContent = Math.round(player.stats.hp)+' / '+Math.round(player.stats.maxhp);
  document.getElementById('cdText').textContent = Math.round(player.stats.atkCd)+' ms';
  document.getElementById('kills').textContent = String(game.kills);
  document.getElementById('drops').textContent = String(game.drops);
  document.getElementById('credits').textContent = String(game.credits);
  document.getElementById('waveNum').textContent = String(game.wave);
  document.getElementById('state').textContent = game.state==='combat'?'Combat':(game.state==='shop'?'Shopping':'Intermission');
  renderStatsPanel();
  // B-key hint
  let hint = document.getElementById('keyHint');
  
  if (!hint){
    hint = document.createElement('div');
    hint.id='keyHint';
	Object.assign(hint.style, {
	  position:'fixed', right:'12px', bottom:'12px',
	  background:'#0f1629', color:'#e5e7eb',
	  border:'1px solid #2b3650', borderRadius:'8px',
	  padding:'10px 14px', font:'16px system-ui',
	  opacity:'0', transition:'opacity 220ms ease',
	  zIndex:'10060', display:'none', pointerEvents:'none'
	});


    document.body.appendChild(hint);
  }
// --- Key-hint state (pulse when visible) ---
if (game.state === 'shop'){
  showHintPulsing('Press Space to close the shop');
} else if (game.state === 'intermission'){
  showHintPulsing('Press Space to open the shop');
} else {
  hideHint();
}
// --- Pickup hint: only during combat, when near a drop ---
if (playerNearDrop()){
  showPickupHintPulsing('Press E to pick up');
} else {
  hidePickupHint();
}



}

/* ========= Wave control ========= */
function startNextWave(){
  game.wave++;
  const count = 12 + Math.floor(game.wave*0.6);
  spawnWave(count);
  game.state = 'combat';
}
function tryAdvance(){
  if (game.state === 'intermission') openShop();     // open (or reopen) the shop
  else if (game.state === 'shop') closeShopSoft();   // close the shop, stay in intermission
}


/* ========= Boot ========= */
function init(){
  game.credits = Math.max(game.credits, 25);
  normalizeSlots();          // migrate any legacy item slots
  recalcStats();
  renderStatsPanel()
  renderHUD();
  renderInventory();
  spawnWave(12 + Math.floor(game.wave*0.6));
  game.state = 'combat';
}
let last = performance.now();
function loop(now){
  const dt = Math.max(0, Math.min(now - last, 50)); 
  last = now; 
  game.time = now;
  recalcStats();
  applyRegen(dt);
  movePlayer(dt);
  updateFacing(); 
  if(game.state === 'combat'){
    if(mouse.down) tryAttack();
    updateEnemies(dt);
    checkWaveEnd();
  } else if (game.state === 'intermission'){
    // let enemies idle if any leftovers (no spawns)
  }
  // drop fading handler
	if (game.dropsFading && now >= game.dropsFadeEnd){
	  drops.length = 0;
	  if (typeof game.drops === 'number') game.drops = 0;
	  game.dropsFading = false;
	}

  draw();
  renderHUD();
  requestAnimationFrame(loop);
}
init();
requestAnimationFrame(loop);

function getStatEl(name){
  return document.getElementById(name) || document.querySelector(`[data-stat="${name}"]`);
}

function renderStatsPanel(){
  const s = player.stats;
  const set = (k,v)=>{ const el = getStatEl(k); if (el) el.textContent = String(v); };
  set('level', game.wave);                 // or your own level system
  set('str',   Math.round(s.str));
  set('agi',   Math.round(s.agi));
  set('end',   Math.round(s.end));
  set('luck',  Math.round(s.luck));
  const pow = ITEM_SLOTS.reduce((t,sl)=> t + (player.equip[sl]?.power||0), 0);
  set('power', pow);
}

// Make every recompute update the panel
function recalcStats(){
  player.stats = computeStats(player.equip);
  renderStatsPanel();
}

/* =========================
   DEV CHEATS (toggleable)
   Set DEBUG_CHEATS=false to remove UI & hotkeys
   ========================= */
(function(){
  const DEBUG_CHEATS = true;         // <— flip to false to disable everything
  if (!DEBUG_CHEATS) return;

  // ---- tiny toast ---
  function toast(msg, kind='ok'){
    let t = document.getElementById('devToast');
    if(!t){
      t = document.createElement('div'); t.id='devToast';
      t.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:10060;background:#0b1220;border:1px solid #2b3650;color:#e5e7eb;padding:6px 10px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);font:12px system-ui';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.borderColor = kind==='warn' ? '#f59e0b' : (kind==='bad' ? '#ef4444' : '#2b3650');
    t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(()=>{ t.style.display='none'; }, 900);
  }

  // ---- helpers to refresh UI safely ---
  function refreshAll(){
    if (typeof recalcStats === 'function') recalcStats();
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof renderHUD === 'function') renderHUD();
  }

  // ---- the 4 requested cheats ----
  function cheatHeal(){
    player.stats.hp = player.stats.maxhp;
    refreshAll();
    toast('HP restored');
  }

  function cheatNuke(){
    let killed = 0;
    for (const e of enemies){
      if (!e.alive) continue;
      // award like a normal kill
      e.alive = false; killed++; game.kills++;
      game.credits += 1 + Math.floor(game.wave*0.6);
      if (Math.random() < LOOT.hpPackChance){
        drops.push({ type:'hp', x:e.x + rand(-6,6), y:e.y + rand(-6,6), r:9 });
      }
      if (e.type === 'boss'){
        drops.push({ type:'item', x:e.x, y:e.y, r:12, item: bossDrop() });
        game.bossAlive = false;
      } else if (Math.random() < enemyDropChance()){
        game.drops++;
        drops.push({ type:'item', x:e.x, y:e.y, r:10, item: makeItem(game.wave, player.stats.luck) });
      }
    }
    if (typeof checkWaveEnd === 'function') checkWaveEnd();
    refreshAll();
    toast(killed ? `Nuked ${killed} enemies` : 'No enemies to nuke', killed? 'ok':'warn');
  }

  function cheatBoostAll(){
    ['str','agi','end','luck'].forEach(k=>{
      player.base[k] = (player.base[k]||0) + 10;
    });
    refreshAll();
    toast('+10 to all base stats');
  }

  function cheatGiveItem(){
    if (player.inv.length >= (typeof INV_MAX!=='undefined'?INV_MAX:15)){
      toast('Inventory full', 'warn'); return;
    }
    const it = makeItem(game.wave + 2, (player.stats.luck||0) + 5);
    player.inv.push(it);
    if (typeof renderInventory === 'function') renderInventory();
    toast(`Added item: ${it.name}`);
  }

  // ---- optional extra cheats (comment out if you don’t want them) ----
  function cheatCredits(amount=100){ game.credits += amount; refreshAll(); toast(`+${amount} credits`); }
  function cheatSkipWave(){ enemies.forEach(e=>e.alive=false); if (typeof checkWaveEnd==='function') checkWaveEnd(); toast('Wave skipped'); }

  // ---- floating DEV panel (fully self-contained) ----
  const panel = document.createElement('div');
  panel.id = 'devCheats';
  panel.style.cssText = 'position:fixed;right:10px;top:10px;z-index:10055;display:flex;flex-direction:column;gap:6px;align-items:flex-end;font:12px system-ui;color:#e5e7eb';
  panel.innerHTML = `
    <button id="devToggle" style="padding:2px 6px;border:1px solid #2b3650;border-radius:6px;background:#0b1220;color:#e5e7eb;cursor:pointer">DEV</button>
    <div id="devSheet" style="display:none;padding:8px;border:1px solid #2b3650;border-radius:8px;background:#0f1629;box-shadow:0 8px 24px rgba(0,0,0,.45);min-width:220px">
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">
        <div>Restore HP</div>           <button data-act="heal"  title="Alt+1" style="padding:4px 6px">Go</button>
        <div>Kill all enemies</div>     <button data-act="nuke"  title="Alt+2" style="padding:4px 6px">Go</button>
        <div>+10 all base stats</div>   <button data-act="boost" title="Alt+3" style="padding:4px 6px">Go</button>
        <div>Give random item</div>     <button data-act="item"  title="Alt+4" style="padding:4px 6px">Go</button>
      </div>
      <div style="margin-top:6px;opacity:.75;font-size:11px">Hotkeys: <b>Alt+1..4</b>. Toggle panel: <b>~</b> (backtick) or click <b>DEV</b>.</div>
    </div>
  `;
  document.body.appendChild(panel);
  const sheet  = panel.querySelector('#devSheet');
  const toggle = panel.querySelector('#devToggle');
  toggle.addEventListener('click', ()=>{ sheet.style.display = (sheet.style.display==='none'?'block':'none'); });

  panel.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-act]');
    if(!b) return;
    const act = b.getAttribute('data-act');
    if (act==='heal') cheatHeal();
    else if (act==='nuke') cheatNuke();
    else if (act==='boost') cheatBoostAll();
    else if (act==='item') cheatGiveItem();
  });

  // ---- hotkeys: Alt+1..4 and Backquote to toggle ----
  window.addEventListener('keydown', (e)=>{
    if (e.key === '`' || e.key === '~'){ sheet.style.display = (sheet.style.display==='none'?'block':'none'); }
    if (!e.altKey) return;
    if (e.key === '1'){ e.preventDefault(); cheatHeal(); }
    if (e.key === '2'){ e.preventDefault(); cheatNuke(); }
    if (e.key === '3'){ e.preventDefault(); cheatBoostAll(); }
    if (e.key === '4'){ e.preventDefault(); cheatGiveItem(); }
  });

  // That’s it. Toggle DEBUG_CHEATS to hide all of this.
})();
