// ── KONFIGURASI ─────────────────────────────────────────
const API_BASE = "http://localhost:8000";
const LAST_PAGE_KEY = "app_last_page";
const LAST_SESSION_KEY = "app_last_session";

function persistLastPage(pageId) {
  if (!pageId || pageId === "login" || pageId === "register") {
    localStorage.removeItem(LAST_PAGE_KEY);
    return;
  }
  localStorage.setItem(LAST_PAGE_KEY, pageId);
}

function getLastPage() {
  return localStorage.getItem(LAST_PAGE_KEY);
}

function persistLastSession(sessionId, sessionName) {
  if (!sessionId || !sessionName) {
    localStorage.removeItem(LAST_SESSION_KEY);
    return;
  }
  localStorage.setItem(
    LAST_SESSION_KEY,
    JSON.stringify({ id: sessionId, name: sessionName }),
  );
}

function getLastSessionContext() {
  try {
    return JSON.parse(localStorage.getItem(LAST_SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function setCurrentSessionContext(sessionId, sessionName) {
  currentSessionId = sessionId;
  currentSessionName = sessionName || currentSessionName || "";
  persistLastSession(sessionId, currentSessionName);
}

async function restoreLastPageState() {
  const lastPage = getLastPage();
  const lastSession = getLastSessionContext();

  if (!lastPage) {
    showPage("dashboard");
    await loadDashboard();
    return;
  }

  if (lastPage === "dashboard") {
    showPage("dashboard");
    await loadDashboard();
    return;
  }

  if (lastPage === "sessions") {
    showPage("sessions");
    await loadSessions();
    return;
  }

  if (lastPage === "upload" && lastSession?.id) {
    setCurrentSessionContext(lastSession.id, lastSession.name);
    document.getElementById("upload-session-name").textContent = lastSession.name;
    document.getElementById("upload-session-id-display").textContent = lastSession.id;
    await loadCandidates(lastSession.id);
    showPage("upload");
    return;
  }

  if (lastPage === "ranking" && lastSession?.id) {
    setCurrentSessionContext(lastSession.id, lastSession.name);
    document.getElementById("ranking-session-name").textContent = lastSession.name;
    await loadRanking(lastSession.id);
    showPage("ranking");
    return;
  }

  if (lastPage === "ahp" && lastSession?.id) {
    setCurrentSessionContext(lastSession.id, lastSession.name);
    showPage("ahp");
    await loadAHP(lastSession.id);
    return;
  }

  showPage("dashboard");
  await loadDashboard();
}

// ── NAVIGASI HALAMAN ────────────────────────────────────
function showPage(pageId) {
  // Sembunyikan semua halaman
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Tampilkan halaman yang dipilih
  const pageEl = document.getElementById('page-' + pageId);
  if (pageEl) {
    pageEl.classList.add('active');
  }
  
  // Update navbar active state
  document.querySelectorAll('.nav-link').forEach(nav => {
    nav.classList.remove('active');
  });
  const navEl = document.getElementById('nav-' + pageId);
  if (navEl) {
    navEl.classList.add('active');
  }

  persistLastPage(pageId);
}

// ── STATE GLOBAL ─────────────────────────────────────────
let currentSessionId = null;
let currentSessionName = "";
let currentAdmin = null;
let allSessionsCache = [];
let currentFilter = "all";

// ══════════════════════════════════════════════════
// AUTH — LOGIN & LOGOUT
// ══════════════════════════════════════════════════

function switchAuthTab(tab) {
  // Ubah active tab
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
  
  // Ubah form yang ditampilkan
  document.getElementById("form-login").style.display = tab === "login" ? "block" : "none";
  document.getElementById("form-register").style.display = tab === "register" ? "block" : "none";
  
  // Reset alert
  document.getElementById("alert-login").innerHTML = "";
}

function togglePassword(formType) {
  const inputId = formType === "login" ? "login-password" : "register-password";
  const input = document.getElementById(inputId);
  const buttons = document.querySelectorAll(".btn-toggle-pw");
  
  if (input.type === "password") {
    input.type = "text";
    // Menggunakan icon mata tertutup (eye-off)
    buttons.forEach(btn => {
      btn.innerHTML = `<i data-lucide="eye-off" style="width:18px; height:18px;"></i>`;
    });
  } else {
    input.type = "password";
    // Menggunakan icon mata terbuka (eye)
    buttons.forEach(btn => {
      btn.innerHTML = `<i data-lucide="eye" style="width:18px; height:18px;"></i>`;
    });
  }

  // Penting: Render ulang icon agar Lucide mengenali tag <i> yang baru ditambahkan
  lucide.createIcons();
}

async function submitLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login");
  const alertEl = document.getElementById("alert-login");

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Memproses...`;

  try {
    const response = await apiFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    // Simpan session login
    currentAdmin = response;
    sessionStorage.setItem("adminSession", JSON.stringify(response));

    // Tampilkan nama admin di navbar
    document.getElementById("navbar-admin-name").innerHTML = `
  <span class="admin-badge" style="display:inline-flex; align-items:center; gap:6px;">
    <i data-lucide="user" style="width:14px; height:14px;"></i>
    ${response.name}
  </span>`;

// Wajib panggil ini agar icon dirender
lucide.createIcons();

    // Sembunyikan login, tampilkan app
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-main").style.display = "block";

    // Kembalikan ke halaman terakhir yang dikunjungi
    await restoreLastPageState();
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Masuk";
  }
}

async function submitRegister(e) {
  e.preventDefault();
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const btn = document.getElementById("btn-register");
  const alertEl = document.getElementById("alert-login");

  // Validasi password minimal 8 karakter
  if (password.length < 8) {
    alertEl.innerHTML = `<div class="alert alert-danger">❌ Password minimal 8 karakter</div>`;
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Mendaftar...`;

  try {
    const response = await apiFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    // Reset form dan tampilkan pesan sukses
    document.getElementById("form-register").reset();
    alertEl.innerHTML = `<div class="alert alert-success">✅ Registrasi berhasil! Silakan login dengan email dan password Anda.</div>`;
    
    // Switch ke tab login
    switchAuthTab("login");
    
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Daftar";
  }
}

function logout() {
  if (!confirm("Yakin ingin keluar?")) return;
  currentAdmin = null;
  sessionStorage.removeItem("adminSession");
  localStorage.removeItem(LAST_PAGE_KEY);
  localStorage.removeItem(LAST_SESSION_KEY);
  document.getElementById("app-main").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("form-login").reset();
  document.getElementById("form-register").reset();
  document.getElementById("alert-login").innerHTML = "";
  document.getElementById("tab-login").classList.add("active");
  document.getElementById("tab-register").classList.remove("active");
  document.getElementById("form-login").style.display = "block";
  document.getElementById("form-register").style.display = "none";
  // Reset state
  currentSessionId = null;
  currentSessionName = "";
}

// Cek session login saat halaman dimuat
async function checkExistingSession() {
  const saved = sessionStorage.getItem("adminSession");
  if (saved) {
    try {
      currentAdmin = JSON.parse(saved);
      
      // Mengganti emoji 👤 dengan icon 'user' dari Lucide
      document.getElementById("navbar-admin-name").innerHTML = `
        <span class="admin-badge" style="display:flex; align-items:center; gap:6px;">
          <i data-lucide="user" style="width:14px; height:14px;"></i>
          ${currentAdmin.name}
        </span>`;
        
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app-main").style.display = "block";
      
      await restoreLastPageState();
      
      // PENTING: Render icon segera setelah innerHTML diubah
      lucide.createIcons();
      
    } catch (e) {
      sessionStorage.removeItem("adminSession");
    }
  }
}

function goToUpload(sessionId, sessionTitle) {
  setCurrentSessionContext(sessionId, sessionTitle);
  document.getElementById("upload-session-name").textContent = sessionTitle;
  document.getElementById("upload-session-id-display").textContent = sessionId;
  loadCandidates(sessionId);
  showPage("upload");
}

async function goToRanking(sessionId, sessionTitle) {
  setCurrentSessionContext(sessionId, sessionTitle);
  document.getElementById("ranking-session-name").textContent = sessionTitle;

  // Fetch bobot AHP
  try {
    const res = await apiFetch(`/ahp/${sessionId}`);
    if (res.success && res.data) {
      const d = res.data;
      document.getElementById("w-edu").textContent =
        (d.weight_education * 100).toFixed(2) + "%";
      document.getElementById("w-exp").textContent =
        (d.weight_experience * 100).toFixed(2) + "%";
      document.getElementById("w-skill").textContent =
        (d.weight_skill * 100).toFixed(2) + "%";
      document.getElementById("w-source").textContent = "AHP";
    } else {
      document.getElementById("w-edu").textContent = "30% (default)";
      document.getElementById("w-exp").textContent = "40% (default)";
      document.getElementById("w-skill").textContent = "30% (default)";
      document.getElementById("w-source").textContent = "Default ⚠️";
    }
  } catch (e) {
    document.getElementById("w-source").textContent = "Gagal memuat";
  }

  loadRanking(sessionId);
  showPage("ranking");
}

// ── HELPER: API CALL ─────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Terjadi kesalahan");
  }
  return res.json();
}

function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    el.innerHTML = "";
  }, 5000);
}

function scoreBar(value) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 80 ? "#059669" : pct >= 60 ? "#d97706" : "#dc2626";
  return `
    <div class="score-bar-wrap">
      <div class="score-bar-bg">
        <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="score-val">${value}</span>
    </div>`;
}

// ══════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════

async function loadDashboard() {
  // Reset nilai ke loading
  [
    "stat-total-sessions",
    "stat-active-sessions",
    "stat-closed-sessions",
    "stat-total-candidates",
    "stat-scored-candidates",
  ].forEach((id) => {
    document.getElementById(id).textContent = "...";
  });

  try {
    const res = await apiFetch("/sessions/stats/summary");
    const d = res.data;

    document.getElementById("stat-total-sessions").textContent =
      d.total_sessions;
    document.getElementById("stat-active-sessions").textContent =
      d.active_sessions;
    document.getElementById("stat-closed-sessions").textContent =
      d.closed_sessions;
    document.getElementById("stat-total-candidates").textContent =
      d.total_candidates;
    document.getElementById("stat-scored-candidates").textContent =
      d.scored_candidates;

    // Render session aktif di dashboard
    const container = document.getElementById("dashboard-active-sessions");
    if (!d.active_session_list || d.active_session_list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">Tidak ada session aktif</div>
          <div class="empty-state-hint">Buat session baru untuk memulai rekrutmen</div>
        </div>`;
      return;
    }

    container.innerHTML = d.active_session_list
      .map(
        (s) => `
      <div class="dashboard-session-row">
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${s.title}</div>
          <div style="font-size:12px;color:var(--primary)">${s.position}</div>
          <div style="font-size:11px;color:var(--text-muted)">
            ${new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="badge badge-success">Aktif</span>
          <button class="btn btn-outline btn-sm"
            onclick="goToUpload('${s.id}','${s.title.replace(/'/g, "\\'")}')">
            Upload CV
          </button>
          <button class="btn btn-primary btn-sm"
            onclick="goToRanking('${s.id}','${s.title.replace(/'/g, "\\'")}')">
            Ranking
          </button>
        </div>
      </div>`,
      )
      .join("");
  } catch (e) {
    document.getElementById("dashboard-active-sessions").innerHTML =
      `<div class="alert alert-danger">Gagal memuat data: ${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════
// HALAMAN SESSIONS
// ══════════════════════════════════════════════════

function filterSessions(filter) {
  currentFilter = filter;

  // Update tombol filter
  ["all", "active", "closed"].forEach((f) => {
    document.getElementById("filter-" + f).classList.remove("active-filter");
  });
  document.getElementById("filter-" + filter).classList.add("active-filter");

  renderSessionGrid();
}

async function loadSessions() {
  const grid = document.getElementById("sessions-grid");
  grid.innerHTML = `<p style="color:var(--text-muted);font-size:13px">Memuat session...</p>`;

  try {
    const res = await apiFetch("/sessions");
    allSessionsCache = res.data || [];
    renderSessionGrid();
  } catch (e) {
    grid.innerHTML = `<div class="alert alert-danger">Gagal memuat session: ${e.message}</div>`;
  }
}

function renderSessionGrid() {
  const grid = document.getElementById("sessions-grid");

  let sessions = allSessionsCache;
  if (currentFilter === "active")
    sessions = sessions.filter((s) => s.status === "active");
  if (currentFilter === "closed")
    sessions = sessions.filter((s) => s.status === "closed");

  if (!sessions || sessions.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Tidak ada session${currentFilter !== "all" ? " " + currentFilter : ""}</div>
        <div class="empty-state-hint">Klik "Buat Session Baru" untuk memulai</div>
      </div>`;
    return;
  }

  grid.innerHTML = sessions
    .map(
      (s) => `
    <div class="session-card ${s.status === "active" ? "session-active" : "session-closed"}"
      onclick="goToUpload('${s.id}', '${s.title.replace(/'/g, "\\'")}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="flex:1">
          <div class="session-card-title">${s.title}</div>
          <div class="session-card-position">${s.position}</div>
        </div>
        
        <div class="status-badge-container" 
             onclick="event.stopPropagation();toggleSessionStatus('${s.id}','${s.status}','${s.title.replace(/'/g, "\\'")}')"
             style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:600; 
                    ${s.status === 'active' 
                      ? 'background:#f0fdf4; border:1px solid #bbf7d0; color:#16a34a;' 
                      : 'background:#fef2f2; border:1px solid #fecaca; color:#dc2626;'};">
          <i data-lucide="${s.status === 'active' ? 'check-circle' : 'lock'}" style="width:12px; height:12px;"></i>
          ${s.status === 'active' ? 'Aktif' : 'Selesai'}
        </div>
      </div>

      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;line-height:1.5">
        ${s.description || "Tidak ada deskripsi"}
      </div>
      
      <div class="session-card-meta">
        <span style="font-size:11px;">${new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>

      <div style="display:flex;gap:6px;margin-top:14px">
        <button class="btn btn-outline" 
          style="display:flex; align-items:center; gap:6px; padding:5px 9px; font-size:11px; height:auto;"
          onclick="event.stopPropagation();setCurrentSessionContext('${s.id}','${s.title.replace(/'/g, "\\'")}');showPage('ahp');loadAHP('${s.id}')">
          <i data-lucide="calculator" style="width:12px; height:12px;"></i> AHP
        </button>
        <button class="btn btn-primary" 
          style="display:flex; align-items:center; gap:4px; padding:4px 8px; font-size:11px; height:auto;"
          onclick="event.stopPropagation();goToUpload('${s.id}','${s.title.replace(/'/g, "\\'")}')">
          <i data-lucide="cloud-upload" style="width:12px; height:12px;"></i> Upload CV
        </button>
        <button class="btn btn-outline" 
          style="display:flex; align-items:center; gap:4px; padding:4px 8px; font-size:11px; height:auto;"
          onclick="event.stopPropagation();goToRanking('${s.id}','${s.title.replace(/'/g, "\\'")}')">
          <i data-lucide="award" style="width:12px; height:12px;"></i> Ranking
        </button>
      </div>
    </div>`,
    )
    .join("");

lucide.createIcons();
}

async function toggleSessionStatus(sessionId, currentStatus, sessionTitle) {
  const action =
    currentStatus === "active" ? "menutup" : "mengaktifkan kembali";
  if (!confirm(`Yakin ingin ${action} session "${sessionTitle}"?`)) return;

  try {
    const res = await apiFetch(`/sessions/${sessionId}/status`, {
      method: "PATCH",
    });
    // Update cache lokal
    const idx = allSessionsCache.findIndex((s) => s.id === sessionId);
    if (idx !== -1) allSessionsCache[idx].status = res.new_status;
    renderSessionGrid();
    showAlert(
      "alert-sessions",
      "success",
      `Status session "${sessionTitle}" berhasil diubah ke "${res.new_status}".`,
    );
    // Refresh dashboard jika sedang di sana
    if (
      document.getElementById("page-dashboard").classList.contains("active")
    ) {
      loadDashboard();
    }
  } catch (e) {
    showAlert(
      "alert-sessions",
      "danger",
      "Gagal mengubah status: " + e.message,
    );
  }
}

// ── MODAL BUAT SESSION ─────────────────────────────────
function openCreateModal() {
  document.getElementById("modal-create").classList.add("open");
}

function closeCreateModal() {
  document.getElementById("modal-create").classList.remove("open");
  document.getElementById("form-create-session").reset();
}

async function submitCreateSession(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-create-session");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Menyimpan...`;

  const payload = {
    title: document.getElementById("session-title").value.trim(),
    position: document.getElementById("session-position").value.trim(),
    description: document.getElementById("session-desc").value.trim() || null,
  };

  try {
    await apiFetch("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    closeCreateModal();
    await loadSessions();
    showAlert(
      "alert-sessions",
      "success",
      `✅ Session "${payload.title}" berhasil dibuat!`,
    );
  } catch (e) {
    showAlert(
      "alert-sessions",
      "danger",
      "Gagal membuat session: " + e.message,
    );
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Buat Session";
  }
}

// ══════════════════════════════════════════════════
// AHP
// ══════════════════════════════════════════════════

const saatyLabels = {
  1: "Sama penting",
  2: "Antara sama dan sedikit lebih penting",
  3: "Sedikit lebih penting",
  4: "Antara sedikit dan lebih penting",
  5: "Lebih penting",
  6: "Antara lebih dan sangat lebih penting",
  7: "Sangat lebih penting",
  8: "Antara sangat dan mutlak lebih penting",
  9: "Mutlak lebih penting",
};

function updateComparison(num) {
  const left = document.getElementById(`ahp-left-${num}`).value;
  const val = document.getElementById(`ahp-val-${num}`).value;
  const desc = document.getElementById(`ahp-desc-${num}`);
  const labelMap = {
    1: ["edu", "exp"],
    2: ["edu", "skill"],
    3: ["exp", "skill"],
  };
  const nameMap = { edu: "Education", exp: "Experience", skill: "Skill" };
  const [a, b] = labelMap[num];
  const winner = left;
  const loser = winner === a ? b : a;
  desc.textContent =
    val === "1"
      ? `${nameMap[a]} dan ${nameMap[b]} sama penting`
      : `${nameMap[winner]} ${saatyLabels[val].toLowerCase()} dari ${nameMap[loser]}`;
}

async function loadAHP(sessionId) {
  document.getElementById("ahp-session-name").textContent = currentSessionName;
  updateComparison(1);
  updateComparison(2);
  updateComparison(3);

  try {
    const res = await apiFetch(`/ahp/${sessionId}`);
    if (res.success && res.data) {
      renderAHPResult(res.data);
    }
  } catch (e) {}
}

async function submitAHP() {
  const btn = document.getElementById("btn-calc-ahp");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Menghitung...`;

  function getVal(num) {
    const left = document.getElementById(`ahp-left-${num}`).value;
    const val = parseFloat(document.getElementById(`ahp-val-${num}`).value);
    const pairs = {
      1: ["edu", "exp"],
      2: ["edu", "skill"],
      3: ["exp", "skill"],
    };
    const [a] = pairs[num];
    return left === a ? val : 1 / val;
  }

  const payload = {
    session_id: currentSessionId,
    edu_vs_exp: getVal(1),
    edu_vs_skill: getVal(2),
    exp_vs_skill: getVal(3),
  };

  try {
    const res = await apiFetch("/ahp/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    renderAHPResult(res);
    if (res.warning) {
      showAlert("alert-ahp", "danger", "⚠️ " + res.warning);
    } else {
      showAlert(
        "alert-ahp",
        "success",
        "✅ Bobot AHP berhasil dihitung dan disimpan!",
      );
    }
  } catch (e) {
    showAlert("alert-ahp", "danger", "Gagal menghitung AHP: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Hitung Bobot AHP";
  }
}

function renderAHPResult(data) {
  const weights = data.weights || {
    education: data.weight_education,
    experience: data.weight_experience,
    skill: data.weight_skill,
  };
  const cr = data.consistency_ratio;
  const isConsistent = data.is_consistent;

  document.getElementById("ahp-result").style.display = "block";
  document.getElementById("ahp-cr-badge").innerHTML =
    `<span class="badge ${isConsistent ? "badge-success" : "badge-danger"}">
      CR = ${cr.toFixed(4)} ${isConsistent ? "✅ Konsisten" : "❌ Tidak Konsisten"}
    </span>`;

  const rows = [
    { label: "Education", val: weights.education, color: "#4f46e5" },
    { label: "Experience", val: weights.experience, color: "#059669" },
    { label: "Skill", val: weights.skill, color: "#d97706" },
  ];

  document.getElementById("ahp-result-content").innerHTML = `
    ${rows
      .map(
        (r) => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <strong>${r.label}</strong>
          <span>${(r.val * 100).toFixed(2)}%</span>
        </div>
        <div class="score-bar-bg" style="height:10px">
          <div class="score-bar-fill"
            style="width:${(r.val * 100).toFixed(1)}%;background:${r.color};height:10px">
          </div>
        </div>
      </div>`,
      )
      .join("")}
    <p style="font-size:12px;color:var(--text-muted);margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      Bobot ini akan digunakan otomatis saat menghitung ranking SAW.
    </p>`;
}

// ══════════════════════════════════════════════════
// UPLOAD CV
// ══════════════════════════════════════════════════

let uploadQueue = [];

function setupDropZone() {
  const zone = document.getElementById("drop-zone");
  const input = document.getElementById("cv-file-input");
  if (!zone || !input) return;

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf",
    );
    if (files.length) addFilesToQueue(files);
    else alert("Hanya file PDF yang diterima!");
  });

  input.addEventListener("change", () => {
    const files = Array.from(input.files);
    if (files.length) addFilesToQueue(files);
    input.value = "";
  });
}

function addFilesToQueue(files) {
  files.forEach((file) => {
    const exists = uploadQueue.find((q) => q.file.name === file.name);
    if (!exists) {
      uploadQueue.push({
        file,
        status: "pending",
        candidateName: "",
        candidateEmail: "",
      });
    }
  });
  renderUploadQueue();
}

function renderUploadQueue() {
  const container = document.getElementById("upload-queue");
  if (uploadQueue.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">Antrian Upload (${uploadQueue.length} file)</div>
        <button class="btn btn-primary" onclick="startUploadAll()" id="btn-upload-all">
          Upload Semua
        </button>
      </div>
      ${uploadQueue
        .map(
          (item, idx) => `
        <div class="upload-item" id="upload-item-${idx}">
          <div style="font-size:20px">📄</div>
          <div class="upload-item-name">${item.file.name}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="text" class="form-control" style="width:140px;height:32px;font-size:12px"
              placeholder="Nama kandidat *"
              value="${item.candidateName}"
              onchange="uploadQueue[${idx}].candidateName=this.value"
              id="name-${idx}">
            <input type="email" class="form-control" style="width:150px;height:32px;font-size:12px"
              placeholder="Email (opsional)"
              value="${item.candidateEmail}"
              onchange="uploadQueue[${idx}].candidateEmail=this.value"
              id="email-${idx}">
            <span class="upload-status" id="status-${idx}">
              <span class="badge badge-info">Menunggu</span>
            </span>
            <button class="btn btn-outline btn-sm"
              onclick="uploadQueue.splice(${idx},1);renderUploadQueue()">✕</button>
          </div>
        </div>`,
        )
        .join("")}
    </div>`;
}

async function startUploadAll() {
  const missing = uploadQueue.filter((q) => !q.candidateName.trim());
  if (missing.length > 0) {
    alert(
      `Isi nama kandidat untuk semua file! (${missing.length} file belum punya nama)`,
    );
    return;
  }

  const btn = document.getElementById("btn-upload-all");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Mengupload...`;

  let success = 0,
    failed = 0;

  for (let idx = 0; idx < uploadQueue.length; idx++) {
    const item = uploadQueue[idx];
    if (item.status === "done") continue;

    const statusEl = document.getElementById(`status-${idx}`);
    if (statusEl)
      statusEl.innerHTML = `<span class="badge badge-warning">Mengupload...</span>`;

    try {
      const formData = new FormData();
      formData.append("session_id", currentSessionId);
      formData.append("name", item.candidateName.trim());
      formData.append("email", item.candidateEmail.trim());
      formData.append("cv_file", item.file);

      await apiFetch("/candidates/upload", { method: "POST", body: formData });
      item.status = "done";
      if (statusEl)
        statusEl.innerHTML = `<span class="badge badge-success">Berhasil</span>`;
      success++;
    } catch (e) {
      item.status = "error";
      if (statusEl)
        statusEl.innerHTML = `<span class="badge badge-danger" title="${e.message}">Gagal</span>`;
      failed++;
    }
  }

  uploadQueue = uploadQueue.filter((q) => q.status !== "done");
  btn.disabled = false;
  btn.innerHTML = "Upload Semua";
  await loadCandidates(currentSessionId);

  const msg = `${success} CV berhasil diupload${failed ? `, ${failed} gagal` : ""}.`;
  showAlert("alert-upload", success > 0 ? "success" : "danger", msg);
  if (uploadQueue.length === 0) renderUploadQueue();
}

async function loadCandidates(sessionId) {
  const container = document.getElementById("candidates-list");
  container.innerHTML = `<p style="color:var(--text-muted);font-size:13px">Memuat kandidat...</p>`;

  try {
    const res = await apiFetch(`/candidates/${sessionId}`);
    const candidates = res.data;

    if (!candidates || candidates.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-text">Belum ada kandidat</div>
          <div class="empty-state-hint">Upload CV di atas untuk menambahkan kandidat</div>
        </div>`;
      return;
    }

    const rows = candidates
      .map((c) => {
        const score = c.candidate_scores?.[0];
        const statusBadge =
          {
            scored: '<span class="badge badge-success">Terskor</span>',
            pending: '<span class="badge badge-warning">Pending</span>',
            error: '<span class="badge badge-danger">Error</span>',
          }[c.status] || c.status;

        return `<tr>
        <td><strong>${c.name}</strong><br>
          <span style="font-size:11px;color:var(--text-muted)">${c.email || "-"}</span>
        </td>
        <td>${statusBadge}</td>
        <td>${score ? scoreBar(score.education_score) : "-"}</td>
        <td>${score ? scoreBar(score.experience_score) : "-"}</td>
        <td>${score ? scoreBar(score.skill_score) : "-"}</td>
        <td>
          ${
            c.cv_file_url
              ? `<a href="${c.cv_file_url}" target="_blank" class="btn btn-outline btn-sm">Lihat CV</a>`
              : "-"
          }
        </td>
      </tr>`;
      })
      .join("");

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kandidat</th>
              <th>Status</th>
              <th>Education</th>
              <th>Experience</th>
              <th>Skill</th>
              <th>CV</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">Gagal memuat kandidat: ${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════
// RANKING
// ══════════════════════════════════════════════════

async function runSAW() {
  if (!currentSessionId) return;
  const btn = document.getElementById("btn-run-saw");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Menghitung...`;

  try {
    await apiFetch(`/ranking/calculate/${currentSessionId}`, {
      method: "POST",
    });
    await loadRanking(currentSessionId);
    showAlert(
      "alert-ranking",
      "success",
      "✅ Ranking berhasil dihitung dengan metode AHP-SAW!",
    );
  } catch (e) {
    showAlert(
      "alert-ranking",
      "danger",
      "Gagal menghitung ranking: " + e.message,
    );
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Hitung Ranking SAW";
  }
}

async function loadRanking(sessionId) {
  const tableContainer = document.getElementById("ranking-table");
  const podiumContainer = document.getElementById("ranking-podium");

  tableContainer.innerHTML = `<p style="color:var(--text-muted);font-size:13px">Memuat ranking...</p>`;
  podiumContainer.style.display = "none";

  try {
    const res = await apiFetch(`/ranking/${sessionId}`);
    const rankings = res.data;

    if (!rankings || rankings.length === 0) {
      tableContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-text">Ranking belum dihitung</div>
          <div class="empty-state-hint">Klik "Hitung Ranking SAW" untuk memulai</div>
        </div>`;
      return;
    }

    // ── PODIUM TOP 3 ─────────────────────────────
    renderPodium(rankings.slice(0, 3), podiumContainer);

    // ── TABEL LENGKAP ─────────────────────────────
    const medalIcon = { 1: "🥇", 2: "🥈", 3: "🥉" };
    const rankClass = { 1: "rank-1", 2: "rank-2", 3: "rank-3" };

    const rows = rankings
      .map((r) => {
        const c = r.candidates;
        const sc = c?.candidate_scores?.[0];
        const pct = (r.preference_score * 100).toFixed(2);

        return `<tr ${r.rank_position === 1 ? 'style="background:#fffbeb"' : ""}>
        <td class="rank-num ${rankClass[r.rank_position] || ""}">
          ${medalIcon[r.rank_position] || "#" + r.rank_position}
        </td>
        <td>
          <strong>${c?.name || "-"}</strong><br>
          <span style="font-size:11px;color:var(--text-muted)">${c?.email || "-"}</span>
        </td>
        <td>${sc ? scoreBar(sc.education_score) : "-"}</td>
        <td>${sc ? scoreBar(sc.experience_score) : "-"}</td>
        <td>${sc ? scoreBar(sc.skill_score) : "-"}</td>
        <td>
          <div class="score-bar-wrap">
            <div class="score-bar-bg">
              <div class="score-bar-fill" style="width:${pct}%;background:#4f46e5"></div>
            </div>
            <span class="score-val">${r.preference_score.toFixed(4)}</span>
          </div>
        </td>
      </tr>`;
      })
      .join("");

    tableContainer.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="text-align:center">Rank</th>
              <th>Kandidat</th>
              <th>Education</th>
              <th>Experience</th>
              <th>Skill</th>
              <th>Nilai SAW</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    tableContainer.innerHTML = `<div class="alert alert-danger">Gagal memuat ranking: ${e.message}</div>`;
  }
}

function renderPodium(top3, container) {
  if (!top3 || top3.length === 0) return;

  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const classes = { 1: "rank-1-card", 2: "rank-2-card", 3: "rank-3-card" };
  const badges = { 1: "rank-badge-1", 2: "rank-badge-2", 3: "rank-badge-3" };
  const labels = { 1: "TERBAIK", 2: "RUNNER UP", 3: "PERINGKAT 3" };

  // Urutan tampil: 2 - 1 - 3 (podium style)
  const displayOrder = [
    top3.find((r) => r.rank_position === 2),
    top3.find((r) => r.rank_position === 1),
    top3.find((r) => r.rank_position === 3),
  ].filter(Boolean);

  // Jika hanya ada 1 atau 2 kandidat
  if (top3.length === 1) {
    displayOrder.splice(0, 0); // keep as-is
  }

  const cards = displayOrder
    .map((r) => {
      const c = r.candidates;
      const sc = c?.candidate_scores?.[0];
      const pos = r.rank_position;

      return `
      <div class="podium-card ${classes[pos] || ""}">
        <div class="podium-rank-badge ${badges[pos] || ""}">${labels[pos] || "#" + pos}</div>
        <span class="podium-medal">${medals[pos] || pos}</span>
        <div class="podium-name">${c?.name || "-"}</div>
        <div class="podium-email">${c?.email || ""}</div>
        <div class="podium-score">${(r.preference_score * 100).toFixed(1)}</div>
        <div class="podium-score-label">Nilai SAW (%)</div>
        ${
          sc
            ? `
        <div class="podium-scores-detail">
          <span class="podium-score-pill">Edu: ${sc.education_score}</span>
          <span class="podium-score-pill">Exp: ${sc.experience_score}</span>
          <span class="podium-score-pill">Skill: ${sc.skill_score}</span>
        </div>`
            : ""
        }
      </div>`;
    })
    .join("");

  container.style.display = "block";
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🏆 Kandidat Terbaik</div>
      </div>
      <div class="podium-container">
        ${cards}
      </div>
    </div>`;
}

// ── INISIALISASI ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  setupDropZone();
  await checkExistingSession();

  // Default: tampilkan halaman sessions jika belum ada session login
  if (!sessionStorage.getItem("adminSession")) {
    // Halaman login sudah tampil by default
  }
});
