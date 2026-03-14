// ═══════════════════════════════════
//  firebase-config.js — Kalyaan Pro
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

// ── Admin credentials (hashed in memory) ──
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin@kalyaan123';
const ADMIN_SECRET = 'KY_ADMIN_2024_SECRET'; // extra layer

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
  { level:1,  name:'Bronze',   minBets:0,    badge:'🥉', dailyBonus:5  },
  { level:2,  name:'Silver',   minBets:10,   badge:'🥈', dailyBonus:8  },
  { level:3,  name:'Gold',     minBets:25,   badge:'🥇', dailyBonus:12 },
  { level:4,  name:'Platinum', minBets:50,   badge:'💎', dailyBonus:18 },
  { level:5,  name:'Diamond',  minBets:100,  badge:'💠', dailyBonus:25 },
  { level:6,  name:'Master',   minBets:200,  badge:'🔮', dailyBonus:35 },
  { level:7,  name:'Elite',    minBets:400,  badge:'⭐', dailyBonus:50 },
  { level:8,  name:'Legend',   minBets:700,  badge:'🌟', dailyBonus:75 },
  { level:9,  name:'Supreme',  minBets:1000, badge:'👑', dailyBonus:100},
  { level:10, name:'God',      minBets:2000, badge:'🔱', dailyBonus:150},
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
  await updateUser(username, {
    balance: (user.balance||0) + bonus,
    lastLoginBonus: today,
    totalLoginBonuses: (user.totalLoginBonuses||0) + bonus
  });
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
  await updateUser(refKey, {
    balance:(refUser.balance||0)+50,
    referralEarnings:(refUser.referralEarnings||0)+50,
    referralCount:(refUser.referralCount||0)+1
  });
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

// ── Game State (global server timer) ──
async function getGameState() {
  const s = await get(ref(db,'gameState'));
  if (!s.exists()) {
    const init = {timeLeft:30,period:1,lastTick:Date.now(),forcedResult:null};
    await set(ref(db,'gameState'),init); return init;
  }
  return s.val();
}
async function setGameState(d)   { await update(ref(db,'gameState'),d); }
async function setForcedResult(r){ await update(ref(db,'gameState'),{forcedResult:r}); }
async function clearForcedResult(){ await update(ref(db,'gameState'),{forcedResult:null}); }

// ── Game History (persistent) ──
async function getGameHistory() {
  const s = await get(ref(db,'gameHistory'));
  if (!s.exists()) return [];
  return Object.values(s.val()).sort((a,b)=>b.period-a.period);
}
async function addGameHistory(entry) {
  await push(ref(db,'gameHistory'),entry);
  const s = await get(ref(db,'gameHistory'));
  if (s.exists()) {
    const entries = Object.entries(s.val()).sort((a,b)=>a[1].period-b[1].period);
    if (entries.length>100) await remove(ref(db,'gameHistory/'+entries[0][0]));
  }
}

// ── Live Players (anti-cheat: register presence) ──
async function registerPresence(username) {
  await set(ref(db,'presence/'+username),{time:Date.now(),active:true});
}
async function getLivePlayerCount() {
  const s = await get(ref(db,'presence'));
  if (!s.exists()) return 0;
  const cutoff = Date.now() - 60000; // active in last 60s
  return Object.values(s.val()).filter(p=>p.time>cutoff).length;
}

// ── Anti-cheat: validate bet ──
async function validateBet(username, amount) {
  const user = await getUser(username);
  if (!user) return {valid:false, msg:'User not found'};
  if (user.blocked) return {valid:false, msg:'Account blocked'};
  if ((user.balance||0) < amount) return {valid:false, msg:'Insufficient balance'};
  const state = await getGameState();
  if ((state.timeLeft||0) <= 5) return {valid:false, msg:'Betting locked'};
  return {valid:true};
}

// ── User Bets (persistent, 24hr) ──
async function saveUserBet(username, bet) {
  await push(ref(db, 'userBets/' + username), bet);
}
async function getUserBets(username) {
  const s = await get(ref(db, 'userBets/' + username));
  if (!s.exists()) return [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
  const all = Object.entries(s.val());
  // Delete old bets (older than 24hr)
  for (const [key, b] of all) {
    if (b.time < cutoff) await remove(ref(db, 'userBets/' + username + '/' + key));
  }
  return all.filter(([k,b]) => b.time >= cutoff).map(([k,b]) => ({...b, _key:k})).sort((a,b)=>b.time-a.time);
}
async function updateUserBet(username, key, updates) {
  await update(ref(db, 'userBets/' + username + '/' + key), updates);
}

// ── Leaderboard ──
async function getLeaderboard() {
  const users = await getAllUsers();
  return Object.entries(users)
    .map(([k,u])=>({username:k,name:u.name,uid:u.uid,totalWins:u.totalWins||0,bets:u.bets||0}))
    .sort((a,b)=>b.totalWins-a.totalWins).slice(0,20);
}

export {
  db, ref, set, get, update, onValue, push, remove,
  ADMIN_USER, ADMIN_PASS, ADMIN_SECRET,
  getSession, setSession, clearSession,
  getAdminSession, setAdminSession, clearAdminSession,
  getTheme, setTheme, initTheme, toggleTheme,
  getUser, saveUser, updateUser, getAllUsers,
  getNextUID, VIP_LEVELS, getVIPLevel,
  claimDailyBonus, applyDepositBonus, applyReferral,
  addTransaction, getTransactions,
  getGameState, setGameState, setForcedResult, clearForcedResult,
  getGameHistory, addGameHistory,
  registerPresence, getLivePlayerCount,
  validateBet, getLeaderboard,
  saveUserBet, getUserBets, updateUserBet
};
