// ═══════════════════════════════════
//  firebase-config.js — ColorWin
// ═══════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, child }
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

// ── Admin credentials ──
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin@colorwin123';

// ── Session helpers (localStorage) ──
function getSession()       { return localStorage.getItem('cw_session'); }
function setSession(u)      { localStorage.setItem('cw_session', u); }
function clearSession()     { localStorage.removeItem('cw_session'); }
function getAdminSession()  { return localStorage.getItem('cw_admin') === '1'; }
function setAdminSession()  { localStorage.setItem('cw_admin', '1'); }
function clearAdminSession(){ localStorage.removeItem('cw_admin'); }

// ── Firebase User helpers ──
async function getUser(username) {
  const snap = await get(ref(db, 'users/' + username));
  return snap.exists() ? snap.val() : null;
}

async function saveUser(username, data) {
  await set(ref(db, 'users/' + username), data);
}

async function updateUser(username, data) {
  await update(ref(db, 'users/' + username), data);
}

async function getAllUsers() {
  const snap = await get(ref(db, 'users'));
  return snap.exists() ? snap.val() : {};
}

// ── Game timer helpers (Firebase so all users stay in sync) ──
async function getGameState() {
  const snap = await get(ref(db, 'gameState'));
  if (!snap.exists()) {
    const initial = { timeLeft: 30, period: 20250313001, lastTick: Date.now() };
    await set(ref(db, 'gameState'), initial);
    return initial;
  }
  return snap.val();
}

async function setGameState(data) {
  await update(ref(db, 'gameState'), data);
}

async function getGameHistory() {
  const snap = await get(ref(db, 'gameHistory'));
  return snap.exists() ? Object.values(snap.val()) : [];
}

async function addGameHistory(entry) {
  const snap = await get(ref(db, 'gameHistory'));
  let history = snap.exists() ? Object.values(snap.val()) : [];
  history.push(entry);
  if (history.length > 30) history = history.slice(-30);
  const obj = {};
  history.forEach((h, i) => obj[i] = h);
  await set(ref(db, 'gameHistory'), obj);
}

export {
  db, ref, set, get, update, onValue, child,
  ADMIN_USER, ADMIN_PASS,
  getSession, setSession, clearSession,
  getAdminSession, setAdminSession, clearAdminSession,
  getUser, saveUser, updateUser, getAllUsers,
  getGameState, setGameState, getGameHistory, addGameHistory
};
