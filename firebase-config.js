// ═══════════════════════════════════
//  firebase-config.js — Kalyaan v3
// ═══════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, remove }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKrBlMXCDM5yLgEqfdrleSa1LSpBUqNIA",
  authDomain: "colorwin-ad4cc.firebaseapp.com",
  databaseURL: "https://colorwin-ad4cc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "colorwin-ad4cc",
  storageBucket: "colorwin-ad4cc.firebasestorage.app",
  messagingSenderId: "289877120544",
  appId: "1:289877120544:web:e8b434073140fb476fce4"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Admin credentials ──
const ADMIN_USER   = 'admin';
const ADMIN_PASS   = 'admin@kalyaan123';
const ADMIN_SECRET = 'SuJeniHe1493u484smdn';

// ── Game Rooms (WinGo style) ──
const GAME_ROOMS = [
  { id:'wingo30s',  label:'WinGo 30s',  duration:30,    color:'#7c3aed' },
  { id:'wingo1m',   label:'WinGo 1Min', duration:60,    color:'#059669' },
  { id:'wingo3m',   label:'WinGo 3Min', duration:180,   color:'#d97706' },
  { id:'wingo5m',   label:'WinGo 5Min', duration:300,   color:'#dc2626' },
];

// ── Platform cut: 1.5% ONLY on WinGo ──
const PLATFORM_CUT = 0.015;
function calcWinAmount(bet, mult) {
  // With 1.5% fee (WinGo only)
  return Math.floor(bet * mult * (1 - PLATFORM_CUT));
}
function calcWinAmountRaw(bet, mult) {
  // No fee (Mines, Crash)
  return Math.floor(bet * mult);
}

// ── Session ──
function getSession()        { return localStorage.getItem('ky_session'); }
function setSession(u)       { localStorage.setItem('ky_session', u); }
function clearSession()      { localStorage.removeItem('ky_session'); }
function getAdminSession()   { return localStorage.getItem('ky_adm') === btoa(ADMIN_SECRET); }
function setAdminSession()   { localStorage.setItem('ky_adm', btoa(ADMIN_SECRET)); }
function clearAdminSession() { localStorage.removeItem('ky_adm'); }

// ── Theme ──
function getTheme()    { return localStorage.getItem('ky_theme') || 'light'; }
function setTheme(t)   { localStorage.setItem('ky_theme', t); document.documentElement.setAttribute('data-theme', t); }
function initTheme()   { document.documentElement.setAttribute('data-theme', getTheme()); }
function toggleTheme() { setTheme(getTheme()==='dark' ? 'light' : 'dark'); return getTheme(); }

// ── Users ──
async function getUser(u)      { const s=await get(ref(db,'users/'+u)); return s.exists()?s.val():null; }
async function saveUser(u,d)   { await set(ref(db,'users/'+u),d); }
async function updateUser(u,d) { await update(ref(db,'users/'+u),d); }
async function getAllUsers()    { const s=await get(ref(db,'users')); return s.exists()?s.val():{}; }

// ── UID Counter ──
async function getNextUID() {
  const s = await get(ref(db,'meta/userCount'));
  const n = s.exists()?s.val():0;
  await set(ref(db,'meta/userCount'),n+1);
  return 'KY'+String(n+1).padStart(6,'0');
}

// ── VIP Levels ──
const VIP_LEVELS = [
  { level:1,  name:'Bronze',   minBets:0,    badge:'🥉', dailyBonus:5   },
  { level:2,  name:'Silver',   minBets:10,   badge:'🥈', dailyBonus:8   },
  { level:3,  name:'Gold',     minBets:25,   badge:'🥇', dailyBonus:12  },
  { level:4,  name:'Platinum', minBets:50,   badge:'💎', dailyBonus:18  },
  { level:5,  name:'Diamond',  minBets:100,  badge:'💠', dailyBonus:25  },
  { level:6,  name:'Master',   minBets:200,  badge:'🔮', dailyBonus:35  },
  { level:7,  name:'Elite',    minBets:400,  badge:'⭐', dailyBonus:50  },
  { level:8,  name:'Legend',   minBets:700,  badge:'🌟', dailyBonus:75  },
  { level:9,  name:'Supreme',  minBets:1000, badge:'👑', dailyBonus:100 },
  { level:10, name:'God',      minBets:2000, badge:'🔱', dailyBonus:150 },
];
function getVIPLevel(bets) {
  let level = VIP_LEVELS[0];
  for (const v of VIP_LEVELS) { if (bets >= v.minBets) level = v; }
  return level;
}

// ── Daily Login Bonus ──
async function claimDailyBonus(username) {
  const user = await getUser(username);
  if (!user) return { success:false, msg:'User not found' };
  const today = new Date().toDateString();
  if (user.lastLoginBonus === today) return { success:false, msg:'Already claimed today!' };
  const vip = getVIPLevel(user.bets||0);
  const bonus = vip.dailyBonus;
  await updateUser(username, { balance:(user.balance||0)+bonus, lastLoginBonus:today, totalLoginBonuses:(user.totalLoginBonuses||0)+bonus });
  await addTransaction(username, { type:'bonus', amount:bonus, desc:`Daily login bonus (${vip.name})`, time:Date.now() });
  return { success:true, amount:bonus, vip };
}

// ── Deposit Bonus (5%) ──
async function applyDepositBonus(username, depositAmount) {
  const bonus = Math.floor(depositAmount * 0.05);
  if (bonus < 1) return 0;
  const user = await getUser(username);
  await updateUser(username, { balance:(user.balance||0)+bonus });
  await addTransaction(username, { type:'bonus', amount:bonus, desc:`5% deposit bonus on ₹${depositAmount}`, time:Date.now() });
  return bonus;
}

// ── Referral ──
async function applyReferral(newUsername, code) {
  if (!code) return 0;
  const all = await getAllUsers();
  const entry = Object.entries(all).find(([k,u])=>u.referralCode===code.toUpperCase());
  if (!entry) return 0;
  const [refKey, refUser] = entry;
  await updateUser(refKey, { balance:(refUser.balance||0)+50, referralEarnings:(refUser.referralEarnings||0)+50, referralCount:(refUser.referralCount||0)+1 });
  await addTransaction(refKey, {type:'referral',amount:50,desc:`Referral bonus — @${newUsername} joined`,time:Date.now()});
  await addTransaction(newUsername, {type:'referral',amount:20,desc:'Welcome referral bonus',time:Date.now()});
  return 20;
}

// ── Transactions ──
async function addTransaction(u,tx) { await push(ref(db,'transactions/'+u),tx); }
async function getTransactions(u) {
  const s = await get(ref(db,'transactions/'+u));
  if (!s.exists()) return [];
  return Object.values(s.val()).sort((a,b)=>b.time-a.time).slice(0,50);
}

// ── Game State — per room (server-side always ticking) ──
// Key: timeLeft is always computed from lastTick so timer runs even when nobody is on page
async function getGameState(roomId) {
  const room = GAME_ROOMS.find(r=>r.id===roomId) || GAME_ROOMS[0];
  const s = await get(ref(db,'rooms/'+roomId+'/state'));
  if (!s.exists()) {
    const init = { startTime:Date.now(), period:1, duration:room.duration, forcedResult:null };
    await set(ref(db,'rooms/'+roomId+'/state'), init);
    return computeState(init, room);
  }
  const raw = s.val();
  // If old format (has timeLeft), migrate to new format
  if (raw.timeLeft !== undefined && raw.startTime === undefined) {
    const init = { startTime:Date.now(), period:raw.period||1, duration:room.duration, forcedResult:raw.forcedResult||null };
    await set(ref(db,'rooms/'+roomId+'/state'), init);
    return computeState(init, room);
  }
  return computeState(raw, room);
}

// Compute real timeLeft from startTime — timer always ticking server-side
function computeState(raw, room) {
  const duration = raw.duration || room.duration;
  const elapsed  = Math.floor((Date.now() - (raw.startTime||Date.now())) / 1000);
  const cyclePos = elapsed % duration;
  const timeLeft = duration - cyclePos;
  const periodOffset = Math.floor(elapsed / duration);
  const period = (raw.period || 1) + periodOffset;
  return { timeLeft, period, duration, forcedResult:raw.forcedResult||null, startTime:raw.startTime, _periodBase:raw.period||1, _elapsed:elapsed };
}

async function setGameState(roomId, d) {
  // Only update forcedResult or reset startTime for new period
  await update(ref(db,'rooms/'+roomId+'/state'), d);
}
async function advancePeriod(roomId) {
  // Call this when period ends — reset startTime for next round
  const room = GAME_ROOMS.find(r=>r.id===roomId) || GAME_ROOMS[0];
  const s = await get(ref(db,'rooms/'+roomId+'/state'));
  const raw = s.exists() ? s.val() : {};
  const state = computeState(raw, room);
  await set(ref(db,'rooms/'+roomId+'/state'), {
    startTime: Date.now(),
    period: state.period + 1,
    duration: room.duration,
    forcedResult: null
  });
  return state.period + 1;
}
async function setForcedResult(roomId, r) { await update(ref(db,'rooms/'+roomId+'/state'), {forcedResult:r}); }
async function clearForcedResult(roomId)  { await update(ref(db,'rooms/'+roomId+'/state'), {forcedResult:null}); }

// ── Game History — per room ──
async function getGameHistory(roomId) {
  const s = await get(ref(db,'rooms/'+roomId+'/history'));
  if (!s.exists()) return [];
  return Object.values(s.val()).sort((a,b)=>b.period-a.period);
}
async function addGameHistory(roomId, entry) {
  await push(ref(db,'rooms/'+roomId+'/history'), entry);
  const s = await get(ref(db,'rooms/'+roomId+'/history'));
  if (s.exists()) {
    const entries = Object.entries(s.val()).sort((a,b)=>a[1].period-b[1].period);
    if (entries.length > 100) await remove(ref(db,'rooms/'+roomId+'/history/'+entries[0][0]));
  }
}

// ── User Bets — per room, persistent 24hr ──
async function saveUserBet(username, roomId, bet) {
  const r = await push(ref(db,'userBets/'+username+'/'+roomId), bet);
  return r.key;
}
async function getUserBets(username, roomId) {
  const s = await get(ref(db,'userBets/'+username+'/'+roomId));
  if (!s.exists()) return [];
  const cutoff = Date.now() - 24*60*60*1000;
  const all = Object.entries(s.val());
  for (const [key,b] of all) {
    if (b.time < cutoff) await remove(ref(db,'userBets/'+username+'/'+roomId+'/'+key));
  }
  return all.filter(([k,b])=>b.time>=cutoff).map(([k,b])=>({...b,_key:k})).sort((a,b)=>b.time-a.time);
}
async function updateUserBet(username, roomId, key, updates) {
  await update(ref(db,'userBets/'+username+'/'+roomId+'/'+key), updates);
}

// ── Result Notifications — push result to user's node ──
async function pushResultNotification(username, notification) {
  await set(ref(db,'notifications/'+username), notification);
}
async function clearResultNotification(username) {
  await remove(ref(db,'notifications/'+username));
}

// ── Live Players ──
async function registerPresence(username) {
  await set(ref(db,'presence/'+username), {time:Date.now(), active:true});
}
async function getLivePlayerCount() {
  const s = await get(ref(db,'presence'));
  if (!s.exists()) return 0;
  const cutoff = Date.now() - 60000;
  return Object.values(s.val()).filter(p=>p.time>cutoff).length;
}

// ── Anti-cheat: validate bet ──
async function validateBet(username, amount, roomId) {
  const user = await getUser(username);
  if (!user)          return {valid:false, msg:'User not found'};
  if (user.blocked)   return {valid:false, msg:'Account blocked'};
  if ((user.balance||0) < amount) return {valid:false, msg:'Insufficient balance'};
  const state = await getGameState(roomId);
  if ((state.timeLeft||0) <= 5) return {valid:false, msg:'Betting locked'};
  return {valid:true};
}

// ── Leaderboard ──
async function getLeaderboard() {
  const users = await getAllUsers();
  return Object.entries(users)
    .map(([k,u])=>({username:k, name:u.name, uid:u.uid, totalWins:u.totalWins||0, bets:u.bets||0}))
    .sort((a,b)=>b.totalWins-a.totalWins).slice(0,20);
}


// ── Mines Game ──
function calcMinesMultiplier(totalTiles, mineCount, safeOpened) {
  if (safeOpened === 0) return 1.0;
  let prob = 1.0;
  const safeTiles = totalTiles - mineCount;
  for (let i = 0; i < safeOpened; i++) {
    prob *= (safeTiles - i) / (totalTiles - i);
  }
  const raw = 1 / prob;
  return parseFloat((Math.max(1.01, raw * (1 - PLATFORM_CUT))).toFixed(2));
}
async function saveMinesSession(username, session) {
  await set(ref(db, 'minesSessions/' + username), session);
}
async function getMinesSession(username) {
  const s = await get(ref(db, 'minesSessions/' + username));
  return s.exists() ? s.val() : null;
}
async function clearMinesSession(username) {
  await remove(ref(db, 'minesSessions/' + username));
}
async function saveMinesHistory(username, entry) {
  await push(ref(db, 'minesHistory/' + username), entry);
  const s = await get(ref(db, 'minesHistory/' + username));
  if (s.exists()) {
    const entries = Object.entries(s.val()).sort((a,b) => a[1].time - b[1].time);
    if (entries.length > 30) await remove(ref(db, 'minesHistory/' + username + '/' + entries[0][0]));
  }
}
async function getMinesHistory(username) {
  const s = await get(ref(db, 'minesHistory/' + username));
  if (!s.exists()) return [];
  return Object.values(s.val()).sort((a,b) => b.time - a.time).slice(0, 20);
}


// ── Crash Game (Aviator style) ──
// Global crash game state — all users see same multiplier
async function getCrashState() {
  const s = await get(ref(db,'crash/state'));
  if (!s.exists()) {
    const init = { phase:'waiting', startTime:Date.now(), crashAt:generateCrashPoint(), roundId:1, waitDuration:8000 };
    await set(ref(db,'crash/state'), init);
    return init;
  }
  return s.val();
}
async function setCrashState(d) { await update(ref(db,'crash/state'), d); }

// Crash point generation — house-edge distribution
function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.20) return 1.00;                                                      // 20% instant crash at 1.00x
  if (r < 0.70) return parseFloat((1.01 + Math.random() * 0.79).toFixed(2));      // 50% crash 1.01x-1.80x
  if (r < 0.90) return parseFloat((1.80 + Math.random() * 0.70).toFixed(2));      // 20% crash 1.80x-2.50x
  if (r < 0.95) return parseFloat((2.50 + Math.random() * 12.5).toFixed(2));      // 5%  crash 2.50x-15x
  return parseFloat((15 + Math.random() * 585).toFixed(2));                       // 5%  crash 15x-600x
}

// Current multiplier based on elapsed time
function calcCrashMultiplier(startTime) {
  const elapsed = (Date.now() - startTime) / 1000;
  // Exponential growth: starts at 1x, grows fast
  return parseFloat(Math.max(1.00, Math.pow(1.0024, elapsed * 100)).toFixed(2));
}

// Crash history
async function addCrashHistory(entry) {
  await push(ref(db,'crash/history'), entry);
  const s = await get(ref(db,'crash/history'));
  if (s.exists()) {
    const entries = Object.entries(s.val()).sort((a,b)=>a[1].time-b[1].time);
    if (entries.length > 50) await remove(ref(db,'crash/history/'+entries[0][0]));
  }
}
async function getCrashHistory() {
  const s = await get(ref(db,'crash/history'));
  if (!s.exists()) return [];
  return Object.values(s.val()).sort((a,b)=>b.time-a.time).slice(0,20);
}

// User crash bets
async function saveCrashBet(username, bet) {
  await push(ref(db,'crash/bets/'+username), bet);
}
async function getCrashBets(username) {
  const s = await get(ref(db,'crash/bets/'+username));
  if (!s.exists()) return [];
  const cutoff = Date.now() - 24*60*60*1000;
  const all = Object.entries(s.val());
  for (const [k,b] of all) {
    if (b.time < cutoff) await remove(ref(db,'crash/bets/'+username+'/'+k));
  }
  return all.filter(([k,b])=>b.time>=cutoff).map(([k,b])=>({...b,_key:k})).sort((a,b)=>b.time-a.time);
}
async function updateCrashBet(username, key, updates) {
  await update(ref(db,'crash/bets/'+username+'/'+key), updates);
}

export {
  db, ref, set, get, update, onValue, push, remove,
  ADMIN_USER, ADMIN_PASS, ADMIN_SECRET,
  GAME_ROOMS, PLATFORM_CUT, calcWinAmount, calcWinAmountRaw,
  getSession, setSession, clearSession,
  getAdminSession, setAdminSession, clearAdminSession,
  getTheme, setTheme, initTheme, toggleTheme,
  getUser, saveUser, updateUser, getAllUsers,
  getNextUID, VIP_LEVELS, getVIPLevel,
  claimDailyBonus, applyDepositBonus, applyReferral,
  addTransaction, getTransactions,
  getGameState, setGameState, advancePeriod, setForcedResult, clearForcedResult,
  getGameHistory, addGameHistory,
  saveUserBet, getUserBets, updateUserBet,
  pushResultNotification, clearResultNotification,
  registerPresence, getLivePlayerCount,
  validateBet, getLeaderboard,
  calcMinesMultiplier, saveMinesSession, getMinesSession,
  clearMinesSession, saveMinesHistory, getMinesHistory,
  getCrashState, setCrashState, generateCrashPoint, calcCrashMultiplier,
  addCrashHistory, getCrashHistory,
  saveCrashBet, getCrashBets, updateCrashBet
};
