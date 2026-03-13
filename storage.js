// ═══════════════════════════════════
//  storage.js  —  ColorWin Shared JS
//  Used by: login.html, index.html,
//           game.html, admin.html
// ═══════════════════════════════════

// ── localStorage helpers ──
function loadUsers() {
  try { return JSON.parse(localStorage.getItem('cw_users')) || {}; }
  catch(e) { return {}; }
}
function saveUsers(u) { localStorage.setItem('cw_users', JSON.stringify(u)); }

function getSession()  { return localStorage.getItem('cw_session'); }
function setSession(u) { localStorage.setItem('cw_session', u); }
function clearSession(){ localStorage.removeItem('cw_session'); }

function getAdminSession()  { return localStorage.getItem('cw_admin') === '1'; }
function setAdminSession()  { localStorage.setItem('cw_admin', '1'); }
function clearAdminSession(){ localStorage.removeItem('cw_admin'); }

// ── Ensure demo account always exists ──
(function() {
  let u = loadUsers();
  if (!u['demo']) {
    u['demo'] = { password:'demo123', name:'Demo User', uid:'CW100001', balance:10000, totalWins:0, bets:0 };
    saveUsers(u);
  }
})();

// ── Admin credentials ──
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin@colorwin123';

// ── Global live game state (shared across pages via localStorage ticks) ──
// timeLeft is stored in localStorage so all pages stay in sync
function getTimeLeft() {
  const v = parseInt(localStorage.getItem('cw_timeleft'));
  return isNaN(v) ? 30 : v;
}
function setTimeLeft(v) { localStorage.setItem('cw_timeleft', v); }

function getPeriod() {
  const v = parseInt(localStorage.getItem('cw_period'));
  return isNaN(v) ? 20250313001 : v;
}
function setPeriod(v) { localStorage.setItem('cw_period', v); }

function getGameHistory() {
  try { return JSON.parse(localStorage.getItem('cw_history')) || []; }
  catch(e) { return []; }
}
function saveGameHistory(h) { localStorage.setItem('cw_history', JSON.stringify(h.slice(-30))); }
