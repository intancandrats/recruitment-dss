// ── KONFIGURASI ─────────────────────────────────────────
const API_BASE = "http://localhost:8000";

// ── STATE GLOBAL ─────────────────────────────────────────
let currentSessionId   = null;
let currentSessionName = "";

// ── NAVIGASI HALAMAN ─────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  document.getElementById("page-" + pageId).classList.add("active");
  document.getElementById("nav-" + pageId).classList.add("active");
}

function goToUpload(sessionId, sessionTitle) {
  currentSessionId   = sessionId;
  currentSessionName = sessionTitle;
  document.getElementById("upload-session-name").textContent = sessionTitle;
  document.getElementById("upload-session-id-display").textContent = sessionId;
  loadCandidates(sessionId);
  showPage("upload");
}

function goToRanking(sessionId, sessionTitle) {
  currentSessionId   = sessionId;
  currentSessionName = sessionTitle;
  document.getElementById("ranking-session-name").textContent = sessionTitle;
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

// ── HELPER: ALERT ────────────────────────────────────────
function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => { el.innerHTML = ""; }, 5000);
}

// ── HELPER: SCORE BAR ────────────────────────────────────
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

// ═══════════════════════════════════════════════════════
// HALAMAN 1: SESSIONS
// ═══════════════════════════════════════════════════════

async function loadSessions() {
  const grid = document.getElementById("sessions-grid");
  grid.innerHTML = `<p style="color:var(--text-muted);font-size:13px">Memuat session...</p>`;

  try {
    const res = await apiFetch("/sessions");
    const sessions = res.data;

    if (!sessions || sessions.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">Belum ada session</div>
          <div class="empty-state-hint">Klik "Buat Session Baru" untuk memulai</div>
        </div>`;
      return;
    }

    grid.innerHTML = sessions.map(s => `
      <div class="session-card" onclick="goToUpload('${s.id}', '${s.title.replace(/'/g,"\\'")}')">
        <div class="session-card-title">${s.title}</div>
        <div class="session-card-position">${s.position}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;line-height:1.5">
          ${s.description || "Tidak ada deskripsi"}
        </div>
        <div class="session-card-meta">
          <span class="badge badge-${s.status === 'active' ? 'success' : 'info'}">
            ${s.status === 'active' ? 'Aktif' : 'Selesai'}
          </span>
          <span>${new Date(s.created_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-primary btn-sm"
            onclick="event.stopPropagation();goToUpload('${s.id}','${s.title.replace(/'/g,"\\'")}')">
            Upload CV
          </button>
          <button class="btn btn-outline btn-sm"
            onclick="event.stopPropagation();goToRanking('${s.id}','${s.title.replace(/'/g,"\\'")}')">
            Lihat Ranking
          </button>
        </div>
      </div>`).join("");

  } catch (e) {
    grid.innerHTML = `<div class="alert alert-danger">Gagal memuat session: ${e.message}</div>`;
  }
}

// ── MODAL BUAT SESSION ────────────────────────────────────
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
    title:       document.getElementById("session-title").value.trim(),
    position:    document.getElementById("session-position").value.trim(),
    description: document.getElementById("session-desc").value.trim() || null
  };

  try {
    await apiFetch("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    closeCreateModal();
    loadSessions();
    showAlert("alert-sessions", "success", `Session "${payload.title}" berhasil dibuat!`);
  } catch (e) {
    showAlert("alert-sessions", "danger", "Gagal membuat session: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Buat Session";
  }
}

// ═══════════════════════════════════════════════════════
// HALAMAN 2: UPLOAD CV
// ═══════════════════════════════════════════════════════

let uploadQueue = [];   // File yang menunggu diupload

function setupDropZone() {
  const zone  = document.getElementById("drop-zone");
  const input = document.getElementById("cv-file-input");

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", e => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));

  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
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
  // Tambahkan ke queue, hindari duplikat nama
  files.forEach(file => {
    const exists = uploadQueue.find(q => q.file.name === file.name);
    if (!exists) {
      uploadQueue.push({ file, status: "pending", candidateName: "", candidateEmail: "" });
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
      ${uploadQueue.map((item, idx) => `
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
        </div>`).join("")}
    </div>`;
}

async function startUploadAll() {
  // Validasi: semua harus punya nama
  const missing = uploadQueue.filter(q => !q.candidateName.trim());
  if (missing.length > 0) {
    alert(`Isi nama kandidat untuk semua file terlebih dahulu! (${missing.length} file belum punya nama)`);
    return;
  }

  const btn = document.getElementById("btn-upload-all");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Mengupload...`;

  let success = 0;
  let failed  = 0;

  // Upload satu per satu (sequential agar tidak overwhelm API)
  for (let idx = 0; idx < uploadQueue.length; idx++) {
    const item = uploadQueue[idx];
    if (item.status === "done") continue;

    // Update status jadi "Mengupload..."
    const statusEl = document.getElementById(`status-${idx}`);
    if (statusEl) statusEl.innerHTML = `<span class="badge badge-warning">Mengupload...</span>`;

    try {
      const formData = new FormData();
      formData.append("session_id", currentSessionId);
      formData.append("name",       item.candidateName.trim());
      formData.append("email",      item.candidateEmail.trim());
      formData.append("cv_file",    item.file);

      await apiFetch("/candidates/upload", { method: "POST", body: formData });

      item.status = "done";
      if (statusEl) statusEl.innerHTML = `<span class="badge badge-success">Berhasil</span>`;
      success++;

    } catch (e) {
      item.status = "error";
      if (statusEl) statusEl.innerHTML = `<span class="badge badge-danger" title="${e.message}">Gagal</span>`;
      failed++;
    }
  }

  // Bersihkan queue yang sukses
  uploadQueue = uploadQueue.filter(q => q.status !== "done");

  btn.disabled = false;
  btn.innerHTML = "Upload Semua";

  // Reload daftar kandidat
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
          <div class="empty-state-icon">👤</div>
          <div class="empty-state-text">Belum ada kandidat</div>
          <div class="empty-state-hint">Upload CV di atas untuk menambahkan kandidat</div>
        </div>`;
      return;
    }

    const rows = candidates.map(c => {
      const score = c.candidate_scores?.[0];
      const statusBadge = {
        scored:  '<span class="badge badge-success">Terskor</span>',
        pending: '<span class="badge badge-warning">Pending</span>',
        error:   '<span class="badge badge-danger">Error</span>'
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
          ${c.cv_file_url
            ? `<a href="${c.cv_file_url}" target="_blank" class="btn btn-outline btn-sm">Lihat CV</a>`
            : "-"}
        </td>
      </tr>`;
    }).join("");

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

// ═══════════════════════════════════════════════════════
// HALAMAN 3: RANKING
// ═══════════════════════════════════════════════════════

async function runSAW() {
  if (!currentSessionId) return;

  const btn = document.getElementById("btn-run-saw");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Menghitung...`;

  try {
    await apiFetch(`/ranking/calculate/${currentSessionId}`, { method: "POST" });
    await loadRanking(currentSessionId);
    showAlert("alert-ranking", "success", "Ranking berhasil dihitung dengan metode SAW!");
  } catch (e) {
    showAlert("alert-ranking", "danger", "Gagal menghitung ranking: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Hitung Ranking SAW";
  }
}

async function loadRanking(sessionId) {
  const container = document.getElementById("ranking-table");
  container.innerHTML = `<p style="color:var(--text-muted);font-size:13px">Memuat ranking...</p>`;

  try {
    const res = await apiFetch(`/ranking/${sessionId}`);
    const rankings = res.data;

    if (!rankings || rankings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">Ranking belum dihitung</div>
          <div class="empty-state-hint">Klik "Hitung Ranking SAW" untuk memulai</div>
        </div>`;
      return;
    }

    const medalIcon = { 1:"🥇", 2:"🥈", 3:"🥉" };
    const rankClass = { 1:"rank-1", 2:"rank-2", 3:"rank-3" };

    const rows = rankings.map(r => {
      const c    = r.candidates;
      const sc   = c?.candidate_scores?.[0];
      const pct  = (r.preference_score * 100).toFixed(2);

      return `<tr>
        <td class="rank-num ${rankClass[r.rank_position] || ''}">
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
              <div class="score-bar-fill"
                style="width:${pct}%;background:#4f46e5"></div>
            </div>
            <span class="score-val">${r.preference_score.toFixed(4)}</span>
          </div>
        </td>
      </tr>`;
    }).join("");

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="text-align:center">Rank</th>
              <th>Kandidat</th>
              <th>Education (0.3)</th>
              <th>Experience (0.4)</th>
              <th>Skill (0.3)</th>
              <th>Nilai SAW</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">Gagal memuat ranking: ${e.message}</div>`;
  }
}

// ── INISIALISASI ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupDropZone();
  loadSessions();
});