// ═══════════════════════════════════
//  firebase-config.js — Kalyaan
// ═══════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKrBlMXCDM5yLgEqfdrleSa1LSpBUqNIA",
  authDomain: "colorwin-ad4cc.firebaseapp.com",
  databaseURL: "https://colorwin-ad4cc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "colorwin-ad4cc",
  storageBucket: "colorwin-ad4cc.firebasestorage.app",
  messagingSenderId: "289877120544",
  appId: "1:289877120544:web:e8b434073140fb476fce4",
  measurementId: "G-PVMMSB5GCY"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin@kalyaan123';

// ── Session ──
function getSession()       { return localStorage.getItem('ky_session'); }
function setSession(u)      { localStorage.setItem('ky_session', u); }
function clearSession()     { localStorage.removeItem('ky_session'); }
function getAdminSession()  { return localStorage.getItem('ky_admin') === '1'; }
function setAdminSession()  { localStorage.setItem('ky_admin', '1'); }
function clearAdminSession(){ localStorage.removeItem('ky_admin'); }

// ── Users ──
async function getUser(u)         { const s=await get(ref(db,'users/'+u)); return s.exists()?s.val():null; }
async function saveUser(u,d)      { await set(ref(db,'users/'+u),d); }
async function updateUser(u,d)    { await update(ref(db,'users/'+u),d); }
async function getAllUsers()       { const s=await get(ref(db,'users')); return s.exists()?s.val():{}; }

// ── UID counter (starts from 0) ──
async function getNextUID() {
  const s = await get(ref(db,'meta/userCount'));
  const n = s.exists() ? s.val() : 0;
  await set(ref(db,'meta/userCount'), n+1);
  return 'KY' + String(n+1).padStart(6,'0');
}

// ── Referral ──
async function applyReferral(newUsername, code) {
  if (!code) return 0;
  const all = await getAllUsers();
  const entry = Object.entries(all).find(([k,u]) => u.referralCode === code.toUpperCase());
  if (!entry) return 0;
  const [refKey, refUser] = entry;
  await updateUser(refKey, {
    balance: (refUser.balance||0) + 50,
    referralEarnings: (refUser.referralEarnings||0) + 50,
    referralCount: (refUser.referralCount||0) + 1
  });
  await addTransaction(refKey, { type:'referral', amount:50, desc:`Referral bonus — @${newUsername} joined`, time:Date.now() });
  await addTransaction(newUsername, { type:'referral', amount:20, desc:'Welcome referral bonus', time:Date.now() });
  return 20;
}

// ── Transactions ──
async function addTransaction(u, tx) { await push(ref(db,'transactions/'+u), tx); }
async function getTransactions(u) {
  const s = await get(ref(db,'transactions/'+u));
  if (!s.exists()) return [];
  return Object.values(s.val()).sort((a,b)=>b.time-a.time).slice(0,50);
}

// ── Game State ──
async function getGameState() {
  const s = await get(ref(db,'gameState'));
  if (!s.exists()) {
    const init = { timeLeft:30, period:1, lastTick:Date.now() };
    await set(ref(db,'gameState'), init);
    return init;
  }
  return s.val();
}
async function setGameState(d) { await update(ref(db,'gameState'),d); }

// ── Game History (global, persistent) ──
async function getGameHistory() {
  const s = await get(ref(db,'gameHistory'));
  if (!s.exists()) return [];
  return Object.values(s.val()).sort((a,b)=>b.period-a.period);
}
async function addGameHistory(entry) {
  await push(ref(db,'gameHistory'), entry);
  // Trim to 100 records
  const s = await get(ref(db,'gameHistory'));
  if (s.exists()) {
    const entries = Object.entries(s.val()).sort((a,b)=>a[1].period-b[1].period);
    if (entries.length > 100) {
      await set(ref(db,'gameHistory/'+entries[0][0]), null);
    }
  }
}

// ── Leaderboard ──
async function getLeaderboard() {
  const users = await getAllUsers();
  return Object.entries(users)
    .map(([k,u])=>({ username:k, name:u.name, uid:u.uid, totalWins:u.totalWins||0, bets:u.bets||0 }))
    .sort((a,b)=>b.totalWins-a.totalWins)
    .slice(0,20);
}

export {
  db, ref, set, get, update, onValue, push,
  ADMIN_USER, ADMIN_PASS,
  getSession, setSession, clearSession,
  getAdminSession, setAdminSession, clearAdminSession,
  getUser, saveUser, updateUser, getAllUsers,
  getNextUID, applyReferral,
  addTransaction, getTransactions,
  getGameState, setGameState,
  getGameHistory, addGameHistory,
  getLeaderboard
};
