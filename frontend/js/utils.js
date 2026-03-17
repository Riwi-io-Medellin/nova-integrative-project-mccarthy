/* ═══════════════════════════════════════════════════════
   NOVA — utils.js  — Helpers compartidos
   ═══════════════════════════════════════════════════════ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api'
  : (window.NOVA_API_URL || '') + '/api';

// ── Auth helpers ──────────────────────────────────────
const Auth = {
  token: () => localStorage.getItem('nova_token'),
  user:  () => { try { return JSON.parse(localStorage.getItem('nova_user')||'null'); } catch { return null; } },
  headers: () => ({
    'Content-Type': 'application/json',
    ...(Auth.token() ? { Authorization: `Bearer ${Auth.token()}` } : {}),
  }),
  requireAuth: () => {
    const user = Auth.user();
    if (!user || !Auth.token()) { window.location.href = '/pages/login.html'; return null; }
    return user;
  },
  requireAdmin: () => {
    const user = Auth.requireAuth();
    if (!user) return null;
    const role = (user.role||'').toLowerCase();
    if (!['administrador', 'admin'].includes(role)) {
      window.location.href = '/pages/user.html'; return null;
    }
    return user;
  },
  logout: () => {
    localStorage.removeItem('nova_token');
    localStorage.removeItem('nova_user');
    window.location.href = '/pages/login.html';
  },
};

// ── Fetch helpers ─────────────────────────────────────
const http = {
  get:    (url)       => fetch(API + url, { headers: Auth.headers() }),
  post:   (url, body) => fetch(API + url, { method:'POST',   headers: Auth.headers(), body: JSON.stringify(body) }),
  put:    (url, body) => fetch(API + url, { method:'PUT',    headers: Auth.headers(), body: JSON.stringify(body) }),
  patch:  (url, body) => fetch(API + url, { method:'PATCH',  headers: Auth.headers(), body: JSON.stringify(body) }),
  delete: (url)       => fetch(API + url, { method:'DELETE', headers: Auth.headers() }),
  postForm: (url, fd) => fetch(API + url, { method:'POST',   headers: { Authorization: `Bearer ${Auth.token()}` }, body: fd }),
  putForm:  (url, fd) => fetch(API + url, { method:'PUT',    headers: { Authorization: `Bearer ${Auth.token()}` }, body: fd }),
};

// ── Toasts ────────────────────────────────────────────
function showToast(msg, type='info') {
  let cont = document.getElementById('toast-container');
  if (!cont) { cont = document.createElement('div'); cont.id='toast-container'; document.body.appendChild(cont); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  cont.appendChild(el);
  setTimeout(() => { el.classList.add('removing'); setTimeout(()=>el.remove(),250); }, 3500);
}

// ── Theme ─────────────────────────────────────────────
function initTheme() {
  const t = localStorage.getItem('nova_theme') || 'light';
  document.body.classList.add(t, 'ready');
  syncThemeBtns(t);
}
function setTheme(t) {
  // Si ya está activo ese tema, alterna al contrario
  const current = document.body.classList.contains('dark') ? 'dark' : 'light';
  if (t === current) {
    t = t === 'dark' ? 'light' : 'dark';
  }
  document.body.classList.remove('light','dark');
  document.body.classList.add(t);
  localStorage.setItem('nova_theme', t);
  syncThemeBtns(t);
}
function toggleTheme() {
  const current = document.body.classList.contains('dark') ? 'dark' : 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}
function syncThemeBtns(t) {
  document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme===t));
}

// ── Modals ────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
// Close on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ── Formatters ────────────────────────────────────────
const fmt = {
  date:  d => d ? new Date(d).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—',
  time:  d => d ? new Date(d).toLocaleString('es-CO') : '—',
  statusBadge: s => {
    const map = { pending:'badge-pending', accepted:'badge-accepted', rejected:'badge-rejected' };
    const lbl = { pending:'Pendiente', accepted:'Aprobada', rejected:'Rechazada' };
    const cls = map[s] || 'badge-purple';
    return `<span class="badge ${cls}">${lbl[s]||s}</span>`;
  },
  prioClass: p => ({ Alta:'danger', Media:'warning', Baja:'info' }[p] || 'purple'),
};

// ── Sidebar toggle ────────────────────────────────────
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const layout  = document.getElementById('main-layout');
  if (!sidebar) return;
  const stored = localStorage.getItem('nova_sidebar');
  if (stored === 'collapsed') { sidebar.classList.add('collapsed'); layout?.classList.add('collapsed'); }

  // Crear overlay para cerrar sidebar en mobile al tocar fuera
  if (!document.getElementById('sidebar-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', () => closeMobileSidebar());
    document.body.appendChild(overlay);
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.remove('mobile-open');
  overlay?.classList.remove('active');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const layout  = document.getElementById('main-layout');
  const overlay = document.getElementById('sidebar-overlay');

  if (window.innerWidth <= 768) {
    // Mobile: abrir/cerrar con overlay
    const isOpen = sidebar?.classList.contains('mobile-open');
    if (isOpen) {
      sidebar?.classList.remove('mobile-open');
      overlay?.classList.remove('active');
    } else {
      sidebar?.classList.add('mobile-open');
      overlay?.classList.add('active');
    }
  } else {
    // Desktop: comportamiento collapsed original
    sidebar?.classList.toggle('collapsed');
    layout?.classList.toggle('collapsed');
    localStorage.setItem('nova_sidebar', sidebar?.classList.contains('collapsed') ? 'collapsed' : '');
  }
}

// ── User info in topbar ───────────────────────────────
function renderTopbarUser() {
  const u = Auth.user();
  if (!u) return;
  const name = [u.nombre, u.apellido].filter(Boolean).join(' ');
  const el = document.getElementById('topbar-user');
  if (el) el.textContent = name;
  const av = document.getElementById('topbar-avatar');
  if (av) {
    if (u.avatar) av.innerHTML = `<img src="${u.avatar}" alt="${name}">`;
    else av.textContent = name.charAt(0).toUpperCase();
  }
}
