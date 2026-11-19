/**
 * ============================================================================
 * JAVASCRIPT LOGIKA KLIEN (SPA) — PORTAL PPID PTUN PALEMBANG
 * Sesuai arsitektur gas-pro-api, gas-scale-turbo, gas-notifikasi-wa-crm & gas-pwa-github
 * ============================================================================
 */

// ============================================================================
// 1. STATE STORE & CLIENT-SIDE CACHE (SWR / 0ms INSTANT UX)
// ============================================================================
const Store = {
  activeRoute: 'beranda',
  userSession: null,
  publicData: null,
  formDraft: null,
  trackingData: null,
  adminData: {
    dashboard: null,
    antrean: [],
    crm: [],
    dokumen: [],
    laporan: null,
    antrianNotif: []
  },
  selectedPermohonan: null,

  init() {
    // Muat sesi dari sessionStorage
    try {
      const savedSession = sessionStorage.getItem('ppid_session');
      if (savedSession) this.userSession = JSON.parse(savedSession);
    } catch (e) {}

    // Muat draf formulir permohonan dari localStorage
    try {
      const savedDraft = localStorage.getItem('ppid_form_draft');
      if (savedDraft) this.formDraft = JSON.parse(savedDraft);
    } catch (e) {}

    // Muat preferensi aksesibilitas
    if (localStorage.getItem('ppid_high_contrast') === 'true') {
      document.body.classList.add('high-contrast');
    }
    const fontScale = localStorage.getItem('ppid_font_scale');
    if (fontScale) {
      document.body.classList.add(fontScale);
    }
  },

  saveSession(user, token) {
    this.userSession = { user, token };
    sessionStorage.setItem('ppid_session', JSON.stringify(this.userSession));
  },

  clearSession() {
    this.userSession = null;
    sessionStorage.removeItem('ppid_session');
  }
};

// ============================================================================
// 2. HTTP API CLIENT (ANTI-CORS & ZERO-DELAY REST API)
// ============================================================================
const API = {
  // GET Request dengan SWR Cache
  async get(action, params = {}, cacheKey = null, ttlSeconds = 300) {
    // 1. Kembalikan data dari cache lokal seketika (0ms delay) jika ada
    if (cacheKey) {
      try {
        const cachedRaw = localStorage.getItem('swr_' + cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (Date.now() - cached.time < ttlSeconds * 1000) {
            // Silently revalidate in background jika hampir kedaluwarsa
            setTimeout(() => this.get(action, params, cacheKey, ttlSeconds).catch(() => {}), 100);
            return cached.data;
          }
        }
      } catch (e) {}
    }

    // 2. Fetch ke GAS
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.set('action', action);
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));

    try {
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal memuat data.');

      // Simpan ke cache lokal
      if (cacheKey) {
        try {
          localStorage.setItem('swr_' + cacheKey, JSON.stringify({
            data: json.data,
            time: Date.now()
          }));
        } catch (e) {}
      }

      return json.data;
    } catch (err) {
      // Fallback ke cache kadaluarsa jika jaringan offline
      if (cacheKey) {
        const fallback = localStorage.getItem('swr_' + cacheKey);
        if (fallback) return JSON.parse(fallback).data;
      }
      throw err;
    }
  },

  // POST Request (Wajib Content-Type text/plain;charset=utf-8 agar bebas CORS)
  async post(action, payload = {}) {
    const token = Store.userSession ? Store.userSession.token : '';
    const bodyData = {
      action: action,
      token: token,
      data: payload
    };

    try {
      const res = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // Kunci anti CORS di Google Apps Script
        },
        body: JSON.stringify(bodyData)
      });
      const json = await res.json();
      return json;
    } catch (err) {
      return { success: false, message: 'Gagal menghubungi server: ' + err.message };
    }
  }
};

// ============================================================================
// 3. TOAST NOTIFICATION & ACCESSIBILITY CONTROLS
// ============================================================================
function showToast(type, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-[#1b4332] text-white border-l-4 border-[#d4a017]',
    error: 'bg-[#991b1b] text-white border-l-4 border-[#fca5a5]',
    warning: 'bg-[#854d0e] text-white border-l-4 border-[#fde047]',
    info: 'bg-[#1e3a8a] text-white border-l-4 border-[#93c5fd]'
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  toast.className = `flex items-center gap-3 p-4 rounded-xl shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 text-sm max-w-md ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px] shrink-0">${icons[type] || 'info'}</span>
    <span class="flex-1 font-medium leading-snug">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white p-1">
      <span class="material-symbols-outlined text-[16px]">close</span>
    </button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function setFontScale(scale) {
  document.body.classList.remove('font-scale-sm', 'font-scale-lg');
  if (scale === 'sm') {
    document.body.classList.add('font-scale-sm');
    localStorage.setItem('ppid_font_scale', 'font-scale-sm');
  } else if (scale === 'lg') {
    document.body.classList.add('font-scale-lg');
    localStorage.setItem('ppid_font_scale', 'font-scale-lg');
  } else {
    localStorage.removeItem('ppid_font_scale');
  }
}

function toggleHighContrast() {
  const isHigh = document.body.classList.toggle('high-contrast');
  localStorage.setItem('ppid_high_contrast', isHigh ? 'true' : 'false');
  showToast('info', isHigh ? 'Mode Kontras Tinggi Diaktifkan' : 'Mode Tampilan Normal');
}

// ============================================================================
// 4. SPA ROUTER & NAVIGATION (0ms HASH SWITCHING)
// ============================================================================
const Router = {
  routes: [
    'beranda',
    'direktori',
    'standar-layanan',
    'permohonan',
    'lacak',
    'keberatan',
    'profil',
    'admin'
  ],

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  navigate(route, params = {}) {
    let hash = '#' + route;
    const query = new URLSearchParams(params).toString();
    if (query) hash += '?' + query;
    window.location.hash = hash;
  },

  handleRoute() {
    const rawHash = window.location.hash.slice(1) || 'beranda';
    const [path, queryString] = rawHash.split('?');
    const params = new URLSearchParams(queryString || '');

    const targetRoute = this.routes.includes(path) ? path : 'beranda';
    Store.activeRoute = targetRoute;

    // Sembunyikan seluruh view section
    this.routes.forEach(r => {
      const el = document.getElementById('view-' + r);
      if (el) el.classList.add('hidden');
    });

    // Tampilkan view yang aktif
    const activeEl = document.getElementById('view-' + targetRoute);
    if (activeEl) activeEl.classList.remove('hidden');

    // Update active state di navbar
    document.querySelectorAll('[data-path]').forEach(link => {
      const p = link.getAttribute('data-path');
      if (p === targetRoute) {
        link.classList.add('bg-primary', 'text-secondary-container', 'font-semibold');
        link.classList.remove('text-primary-fixed-dim');
      } else {
        link.classList.remove('bg-primary', 'text-secondary-container', 'font-semibold');
        link.classList.add('text-primary-fixed-dim');
      }
    });

    // Scroll ke atas halaman
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger loader halaman terkait
    if (targetRoute === 'beranda') loadBerandaView();
    else if (targetRoute === 'direktori') loadDirektoriView();
    else if (targetRoute === 'standar-layanan') loadStandarLayananView();
    else if (targetRoute === 'permohonan') loadPermohonanView();
    else if (targetRoute === 'lacak') loadLacakView(params);
    else if (targetRoute === 'keberatan') loadKeberatanView(params);
    else if (targetRoute === 'profil') loadProfilView();
    else if (targetRoute === 'admin') loadAdminView();
  }
};

// ============================================================================
// 5. VIEW: BERANDA PUBLIK
// ============================================================================
async function loadBerandaView() {
  // Ambil data statistik dari SWR cache atau server
  try {
    const data = await API.get('getPublicInitialData', {}, 'public_initial_data', 600);
    if (data && data.stats) {
      document.getElementById('stat-total-permohonan').textContent = data.stats.total;
      document.getElementById('stat-tepat-waktu').textContent = data.stats.tepatWaktu;
      document.getElementById('stat-rata-hari').textContent = data.stats.rataRataHari;
      document.getElementById('stat-skor-ikm').textContent = data.stats.ikm;
    }
    if (data && data.sertaMerta) {
      const bannerText = document.getElementById('announcement-banner-text');
      if (bannerText) bannerText.textContent = data.sertaMerta.judul;
    }
  } catch (err) {
    console.warn('Gagal memuat statistik online, menggunakan data lokal default:', err);
  }
}

// ============================================================================
// 6. VIEW: FORMULIR PERMOHONAN INFORMASI ONLINE
// ============================================================================
function loadPermohonanView() {
  // Restore draft jika ada
  if (Store.formDraft) {
    const d = Store.formDraft;
    if (d.nik) document.getElementById('form-nik').value = d.nik;
    if (d.noWA) document.getElementById('form-wa').value = d.noWA;
    if (d.nama) document.getElementById('form-nama').value = d.nama;
    if (d.email) document.getElementById('form-email').value = d.email;
    if (d.pekerjaan) document.getElementById('form-pekerjaan').value = d.pekerjaan;
    if (d.alamat) document.getElementById('form-alamat').value = d.alamat;
    if (d.rincian) document.getElementById('form-rincian').value = d.rincian;
    if (d.tujuan) document.getElementById('form-tujuan').value = d.tujuan;
    validateNIK();
  }
}

function validateNIK() {
  const input = document.getElementById('form-nik');
  const badge = document.getElementById('nik-validation-badge');
  if (!input || !badge) return;

  const val = input.value.replace(/\D/g, '');
  input.value = val;

  if (val.length === 16) {
    badge.className = 'inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full font-semibold';
    badge.innerHTML = '<span class="material-symbols-outlined text-[14px]">check_circle</span> NIK 16 Digit Valid';
  } else {
    badge.className = 'inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full font-medium';
    badge.innerHTML = `<span class="material-symbols-outlined text-[14px]">info</span> ${val.length}/16 Digit`;
  }
}

function handleKTPFileSelect(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('error', 'Ukuran berkas KTP maksimal 5 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    window.uploadedKTPBase64 = e.target.result;
    const previewContainer = document.getElementById('ktp-preview-container');
    const dropzone = document.getElementById('ktp-dropzone');
    const previewImg = document.getElementById('ktp-preview-img');
    const fileNameEl = document.getElementById('ktp-file-name');
    const fileSizeEl = document.getElementById('ktp-file-size');

    if (previewImg && file.type.startsWith('image/')) {
      previewImg.src = e.target.result;
      previewImg.classList.remove('hidden');
    }
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    if (dropzone) dropzone.classList.add('hidden');
    if (previewContainer) previewContainer.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeKTPPreview() {
  window.uploadedKTPBase64 = null;
  const dropzone = document.getElementById('ktp-dropzone');
  const previewContainer = document.getElementById('ktp-preview-container');
  if (dropzone) dropzone.classList.remove('hidden');
  if (previewContainer) previewContainer.classList.add('hidden');
}

function saveFormDraft() {
  const draft = {
    nik: document.getElementById('form-nik').value,
    noWA: document.getElementById('form-wa').value,
    nama: document.getElementById('form-nama').value,
    email: document.getElementById('form-email').value,
    pekerjaan: document.getElementById('form-pekerjaan').value,
    alamat: document.getElementById('form-alamat').value,
    rincian: document.getElementById('form-rincian').value,
    tujuan: document.getElementById('form-tujuan').value
  };
  localStorage.setItem('ppid_form_draft', JSON.stringify(draft));
  showToast('info', 'Draf formulir berhasil disimpan di perangkat ini.');
}

async function submitPermohonanOnline(event) {
  if (event) event.preventDefault();

  const nik = document.getElementById('form-nik').value.trim();
  const noWA = document.getElementById('form-wa').value.trim();
  const nama = document.getElementById('form-nama').value.trim();
  const email = document.getElementById('form-email').value.trim();
  const pekerjaan = document.getElementById('form-pekerjaan').value.trim();
  const atasNama = document.querySelector('input[name="atas-nama"]:checked')?.value || 'Diri Sendiri';
  const alamat = document.getElementById('form-alamat').value.trim();
  const rincian = document.getElementById('form-rincian').value.trim();
  const tujuan = document.getElementById('form-tujuan').value.trim();
  const caraMemperoleh = document.querySelector('input[name="bentuk-salinan"]:checked')?.value || 'Salinan Elektronik (PDF)';
  const caraPenyerahan = document.querySelector('input[name="cara-penyerahan"]:checked')?.value || 'Unduh melalui Portal / Kirim ke Email';
  const setuju = document.getElementById('form-pernyataan').checked;

  if (nik.length !== 16) {
    showToast('error', 'Nomor Induk Kependudukan (NIK) wajib 16 digit.');
    document.getElementById('form-nik').focus();
    return;
  }
  if (!nama || !email || !noWA || !rincian || !tujuan) {
    showToast('error', 'Mohon lengkapi seluruh kolom bertanda bintang (*).');
    return;
  }
  if (!setuju) {
    showToast('warning', 'Anda wajib menyetujui pernyataan kebenaran data identitas.');
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-permohonan');
  const originalText = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Memproses Pendaftaran...`;

  const payload = {
    nik: nik,
    noWA: noWA,
    nama: nama,
    email: email,
    pekerjaan: pekerjaan,
    atasNama: atasNama,
    alamat: alamat,
    rincianInformasi: rincian,
    tujuanPenggunaan: tujuan,
    caraMemperoleh: caraMemperoleh,
    caraPenyerahan: caraPenyerahan,
    fileKTP: window.uploadedKTPBase64 ? { base64: window.uploadedKTPBase64, type: 'image/jpeg' } : null
  };

  try {
    const res = await API.post('submitPermohonan', payload);
    if (!res.success) throw new Error(res.message);

    // Hapus draf setelah sukses
    localStorage.removeItem('ppid_form_draft');

    // Tampilkan modal tanda terima
    showReceiptModal(res.data);
    showToast('success', 'Permohonan berhasil didaftarkan dengan nomor ' + res.data.noRegistrasi);

    // Reset formulir
    document.getElementById('form-permohonan-el').reset();
    removeKTPPreview();
  } catch (err) {
    showToast('error', 'Gagal mendaftarkan permohonan: ' + err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalText;
  }
}

function showReceiptModal(data) {
  const modal = document.getElementById('modal-tanda-terima');
  if (!modal) return;

  document.getElementById('receipt-reg-id').textContent = data.noRegistrasi;
  document.getElementById('receipt-pemohon').textContent = data.nama;
  document.getElementById('receipt-nik-masked').textContent = data.maskedNIK;
  document.getElementById('receipt-tanggal').textContent = new Date(data.tanggalDaftar).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) + ' WIB';
  document.getElementById('receipt-batas-sla').textContent = new Date(data.batasSLA).toLocaleDateString('id-ID', { dateStyle: 'long' });
  document.getElementById('receipt-rincian').textContent = data.rincian;

  // Generate QR Code via Google Charts API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(CONFIG.GAS_URL + '?action=verifyReceipt&token=' + data.hashVerifikasi)}`;
  document.getElementById('receipt-qr-img').src = qrUrl;

  modal.classList.remove('hidden');
}

// ============================================================================
// 7. VIEW: LACAK STATUS PERMOHONAN & TIMELINE 5 TAHAP
// ============================================================================
async function loadLacakView(params) {
  const regId = params.get('reg');
  const nik = params.get('nik');
  if (regId) {
    document.getElementById('reg-number').value = regId;
    if (nik) document.getElementById('nik-digit').value = nik;
    submitLacakForm();
  }
}

async function submitLacakForm(event) {
  if (event) event.preventDefault();

  const regId = document.getElementById('reg-number').value.trim();
  const nikLast4 = document.getElementById('nik-digit').value.trim();

  if (!regId || !nikLast4) {
    showToast('warning', 'Masukkan Nomor Registrasi dan 4 digit akhir NIK Anda.');
    return;
  }

  const btnSearch = document.getElementById('search-btn');
  const originalHtml = btnSearch.innerHTML;
  btnSearch.disabled = true;
  btnSearch.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Mencari...`;

  try {
    const res = await API.get('lacakPermohonan', { regId, nikLast4 });
    renderLacakResult(res);
  } catch (err) {
    showToast('error', err.message || 'Nomor registrasi atau NIK tidak sesuai.');
    document.getElementById('lacak-result-container')?.classList.add('hidden');
    document.getElementById('lacak-empty-state')?.classList.remove('hidden');
  } finally {
    btnSearch.disabled = false;
    btnSearch.innerHTML = originalHtml;
  }
}

function renderLacakResult(data) {
  Store.trackingData = data;
  document.getElementById('lacak-empty-state')?.classList.add('hidden');
  const container = document.getElementById('lacak-result-container');
  if (!container) return;
  container.classList.remove('hidden');

  // Metadata Kasus
  document.getElementById('track-reg-badge').textContent = data.noRegistrasi;
  document.getElementById('track-reg-date').textContent = 'Registrasi: ' + new Date(data.tanggalDaftar).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB';
  document.getElementById('track-applicant-name').textContent = data.namaPemohon;
  document.getElementById('track-nik-masked').textContent = 'NIK: ' + data.nikMasked;
  document.getElementById('track-object-title').textContent = data.rincianInformasi;
  document.getElementById('track-unit-pic').textContent = data.petugasDisposisi || 'Kepaniteraan Hukum PTUN Palembang';

  // Badge Status
  const statusBadge = document.getElementById('track-status-pill');
  statusBadge.textContent = `Tahap ${data.tahapStatus}: ${data.statusTeks}`;

  // Hitung SLA
  const slaText = document.getElementById('track-sla-text');
  const sisa = data.sisaHariSLA;
  if (sisa < 0) {
    slaText.innerHTML = `<span class="text-red-700 font-bold">Melewati Batas SLA (${Math.abs(sisa)} hari kerja)</span>`;
  } else if (sisa <= 2) {
    slaText.innerHTML = `<span class="text-amber-700 font-bold">Sisa Waktu: ${sisa} Hari Kerja Tersisa (Mendesak)</span>`;
  } else {
    slaText.innerHTML = `<span class="text-green-700 font-bold">Sisa Waktu Layanan: ${sisa} Hari Kerja Tersisa</span>`;
  }

  // Render 5-Stage Stepper
  const timelineEl = document.getElementById('track-timeline-container');
  if (timelineEl) {
    const tahapNames = [
      'Permohonan Diterima & Tercatat Sistem',
      'Verifikasi Berkas & Identitas Pemohon',
      'Pengolahan Informasi & Koordinasi Panitera/Unit',
      'Uji Konsekuensi & Legalitas PPID',
      'Penyerahan Informasi & Pengiriman Salinan Dokumen'
    ];

    let html = '';
    for (let t = 1; t <= 5; t++) {
      const isComplete = t < data.tahapStatus || (t === 5 && data.tahapStatus === 5);
      const isActive = t === data.tahapStatus && data.tahapStatus < 5;
      const historyItem = data.timeline.find(x => parseInt(x.tahap, 10) === t);

      let icon = isComplete ? 'check' : (isActive ? 'hourglass_top' : t);
      let ringColor = isComplete ? 'bg-green-700 text-white' : (isActive ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-200 text-gray-500');

      html += `
        <div class="relative flex items-start gap-4 p-4 rounded-xl ${isActive ? 'bg-blue-50/60 border border-blue-200 shadow-sm' : 'hover:bg-gray-50'} transition-colors">
          <div class="w-9 h-9 rounded-full ${ringColor} flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
            <span class="material-symbols-outlined text-[18px]">${isComplete ? 'check' : 'radio_button_checked'}</span>
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="font-bold text-sm ${isActive ? 'text-blue-900' : 'text-gray-900'}">Tahap ${t}: ${tahapNames[t - 1]}</span>
              <span class="text-xs text-gray-500">${historyItem ? new Date(historyItem.waktuUpdate).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Menunggu antrean'}</span>
            </div>
            <p class="text-xs text-gray-600 mt-1">${historyItem ? historyItem.catatanPublik : 'Proses akan dilaksanakan sesuai SLA standar pelayanan peradilan.'}</p>
            ${historyItem && historyItem.petugas ? `<span class="inline-block mt-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Petugas: ${historyItem.petugas}</span>` : ''}
          </div>
        </div>
      `;
    }
    timelineEl.innerHTML = html;
  }

  // Tampilkan QR Code & link keberatan
  const qrImg = document.getElementById('track-receipt-qr');
  if (qrImg && data.hashVerifikasi) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(CONFIG.GAS_URL + '?action=verifyReceipt&token=' + data.hashVerifikasi)}`;
  }

  // Siapkan tautan pengajuan keberatan jika ditolak atau melewati SLA
  const linkKeberatan = document.getElementById('btn-ajukan-keberatan-terkait');
  if (linkKeberatan) {
    linkKeberatan.onclick = () => Router.navigate('keberatan', { reg: data.noRegistrasi });
  }
}

async function submitRatingIKMOnline(rating) {
  if (!Store.trackingData) return;
  const regId = Store.trackingData.noRegistrasi;
  const catatan = document.getElementById('ikm-feedback-note')?.value || '';

  try {
    const res = await API.post('submitRatingIKM', { noRegistrasi: regId, rating, catatan });
    if (!res.success) throw new Error(res.message);
    showToast('success', 'Terima kasih atas ulasan dan penilaian bintang ' + rating + ' Anda!');
  } catch (err) {
    showToast('error', 'Gagal mengirim penilaian: ' + err.message);
  }
}

// ============================================================================
// 8. VIEW: DIREKTORI INFORMASI PUBLIK (DIP)
// ============================================================================
let searchDebounceTimeout = null;

async function loadDirektoriView() {
  const cariInput = document.getElementById('dip-search-input');
  if (cariInput) {
    cariInput.oninput = () => {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => fetchDirektori(), 300);
    };
  }
  fetchDirektori();
}

async function fetchDirektori() {
  const cari = document.getElementById('dip-search-input')?.value || '';
  const kategori = document.querySelector('[data-dip-category].active-category')?.getAttribute('data-dip-category') || 'Semua';
  const container = document.getElementById('dip-document-list');
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-full py-12 flex flex-col items-center justify-center text-gray-500">
      <span class="material-symbols-outlined text-[36px] animate-spin text-primary">progress_activity</span>
      <p class="text-sm mt-2">Memuat dokumen direktori...</p>
    </div>
  `;

  try {
    const res = await API.get('getDirektori', { cari, kategori, limit: 12 });
    if (!res || res.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span class="material-symbols-outlined text-[48px] text-gray-300">folder_off</span>
          <p class="text-base font-semibold mt-2 text-gray-700">Tidak ada dokumen publik yang sesuai</p>
          <p class="text-xs text-gray-500 mt-1">Coba gunakan kata kunci pencarian lain atau pilih kategori Semua.</p>
        </div>
      `;
      return;
    }

    let html = '';
    res.forEach(item => {
      html += `
        <div class="bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 p-5 flex flex-col justify-between transition-all duration-200">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800">${item.Kategori || 'Publik'}</span>
              <span class="text-xs text-gray-400 font-mono">${item.Tahun || '2026'}</span>
            </div>
            <h3 class="font-bold text-sm text-gray-900 line-clamp-2 leading-snug">${item.Judul}</h3>
            <p class="text-xs text-gray-600 mt-2 line-clamp-2">${item.Ringkasan || 'Dokumen resmi Pengadilan Tata Usaha Negara Palembang.'}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span class="flex items-center gap-1 font-mono">
              <span class="material-symbols-outlined text-[15px]">description</span> ${item.Format || 'PDF'}
            </span>
            <a href="${item.URLBerkas || '#'}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-emerald-900 font-medium transition-colors">
              <span>Unduh</span>
              <span class="material-symbols-outlined text-[15px]">download</span>
            </a>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="col-span-full text-center text-red-600 py-8">${err.message}</div>`;
  }
}

function selectDIPCategory(btn, category) {
  document.querySelectorAll('[data-dip-category]').forEach(b => {
    b.classList.remove('active-category', 'bg-primary', 'text-white');
    b.classList.add('bg-gray-100', 'text-gray-700');
  });
  btn.classList.add('active-category', 'bg-primary', 'text-white');
  btn.classList.remove('bg-gray-100', 'text-gray-700');
  fetchDirektori();
}

// ============================================================================
// 9. VIEW: STANDAR LAYANAN & PROFIL
// ============================================================================
async function loadStandarLayananView() {
  try {
    const res = await API.get('getStandarLayanan', {}, 'standar_layanan_data', 3600);
    if (res && res.maklumat) {
      const makEl = document.getElementById('maklumat-teks');
      if (makEl) makEl.textContent = res.maklumat;
    }
  } catch (e) {}
}

async function loadProfilView() {
  try {
    const res = await API.get('getProfilPPID', {}, 'profil_ppid_data', 3600);
    if (res && res.struktur) {
      const el = document.getElementById('struktur-ppid-list');
      if (el) {
        let h = '';
        res.struktur.forEach(s => {
          h += `
            <div class="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span class="text-xs font-bold text-secondary uppercase">${s.jabatan}</span>
                <h4 class="font-bold text-base text-gray-900">${s.nama}</h4>
                <p class="text-xs text-gray-500">${s.tupoksi || ''}</p>
              </div>
              <span class="px-3 py-1 bg-gray-100 rounded-full text-xs font-mono text-gray-700 shrink-0">NIP: ${s.nip || '-'}</span>
            </div>
          `;
        });
        el.innerHTML = h;
      }
    }
  } catch (e) {}
}

// ============================================================================
// 10. VIEW: PENGAJUAN KEBERATAN ONLINE
// ============================================================================
function loadKeberatanView(params) {
  const regId = params.get('reg');
  if (regId) {
    document.getElementById('keb-reg-id').value = regId;
  }
}

async function submitKeberatanForm(event) {
  if (event) event.preventDefault();

  const regId = document.getElementById('keb-reg-id').value.trim();
  const alasan = document.querySelector('input[name="alasan-keberatan"]:checked')?.value;
  const penjelasan = document.getElementById('keb-penjelasan').value.trim();

  if (!regId || !alasan || !penjelasan) {
    showToast('warning', 'Lengkapi nomor registrasi, pilihan alasan, dan penjelasan detail keberatan.');
    return;
  }

  const btn = document.getElementById('btn-submit-keberatan');
  btn.disabled = true;
  btn.innerHTML = 'Mengirimkan ke Atasan PPID...';

  try {
    const res = await API.post('submitKeberatan', {
      noRegistrasi: regId,
      alasanKeberatan: alasan,
      penjelasanDetail: penjelasan
    });
    if (!res.success) throw new Error(res.message);

    showToast('success', res.message);
    document.getElementById('form-keberatan-el').reset();
    setTimeout(() => Router.navigate('lacak', { reg: regId }), 1500);
  } catch (err) {
    showToast('error', 'Gagal mengajukan keberatan: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Kirim Keberatan Resmi ke Atasan PPID';
  }
}

// ============================================================================
// 11. VIEW: PANEL OPERASIONAL ADMIN & PETUGAS
// ============================================================================
async function loadAdminView() {
  if (!Store.userSession) {
    document.getElementById('admin-login-card')?.classList.remove('hidden');
    document.getElementById('admin-main-panel')?.classList.add('hidden');
    return;
  }

  document.getElementById('admin-login-card')?.classList.add('hidden');
  document.getElementById('admin-main-panel')?.classList.remove('hidden');

  const u = Store.userSession.user;
  document.getElementById('admin-user-name').textContent = u.name;
  document.getElementById('admin-user-role').textContent = u.role;

  // Muat dashboard awal
  refreshAdminDashboard();
}

async function handleAdminLogin(event) {
  if (event) event.preventDefault();

  const email = document.getElementById('admin-login-email').value.trim();
  const pass = document.getElementById('admin-login-pass').value;

  const btn = document.getElementById('btn-admin-login');
  btn.disabled = true;
  btn.innerHTML = 'Memverifikasi...';

  try {
    const res = await API.post('loginAdmin', { email, password: pass });
    if (!res.success) throw new Error(res.message);

    Store.saveSession(res.user, res.token);
    showToast('success', 'Selamat datang, ' + res.user.name + ' (' + res.user.role + ')');
    loadAdminView();
  } catch (err) {
    showToast('error', err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Masuk Panel Operasional';
  }
}

async function handleEmergencyLogin() {
  const user = prompt('Masukkan Username Darurat (Superadmin):');
  if (!user) return;
  const pass = prompt('Masukkan Kata Sandi Darurat:');
  if (!pass) return;

  try {
    const res = await API.post('loginEmergency', { username: user, password: pass });
    if (!res.success) throw new Error(res.message);

    Store.saveSession(res.user, res.token);
    showToast('success', 'Akses Darurat Aktif sebagai Superadmin!');
    loadAdminView();
  } catch (err) {
    showToast('error', err.message);
  }
}

function handleAdminLogout() {
  Store.clearSession();
  showToast('info', 'Anda telah keluar dari panel operasional.');
  loadAdminView();
}

async function refreshAdminDashboard() {
  try {
    const res = await API.post('getAdminDashboard');
    if (!res.success) throw new Error(res.message);
    const d = res.data;

    document.getElementById('kpi-total-masuk').textContent = d.kpi.total;
    document.getElementById('kpi-menunggu').textContent = d.kpi.menungguVerifikasi;
    document.getElementById('kpi-dalam-proses').textContent = d.kpi.dalamProses;
    document.getElementById('kpi-selesai').textContent = d.kpi.selesai;

    // Render Urgent SLA Tasks
    const urgentList = document.getElementById('admin-urgent-tasks-list');
    if (urgentList) {
      if (d.urgentTasks.length === 0) {
        urgentList.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500">Tidak ada permohonan yang mendekati batas SLA hari ini. Semua tertangani!</td></tr>`;
      } else {
        let h = '';
        d.urgentTasks.forEach(item => {
          let badgeColor = item.urgensi === 'OVERDUE' ? 'bg-red-100 text-red-800 font-bold' : (item.urgensi === 'CRITICAL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800');
          h += `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
              <td class="p-3 font-mono font-bold text-xs text-primary">${item.noRegistrasi}</td>
              <td class="p-3 text-xs font-semibold text-gray-900">${item.namaPemohon}</td>
              <td class="p-3 text-xs text-gray-600 line-clamp-1">${item.rincian}</td>
              <td class="p-3 text-xs"><span class="px-2 py-0.5 rounded-full ${badgeColor}">Sisa ${item.sisaHari} Hari</span></td>
              <td class="p-3 text-xs text-gray-700">${item.petugas}</td>
              <td class="p-3 text-xs text-right">
                <button onclick="openDrawerDetail('${item.permohonanId}')" class="px-2.5 py-1 bg-primary text-white rounded text-xs font-medium hover:bg-emerald-900">Periksa</button>
              </td>
            </tr>
          `;
        });
        urgentList.innerHTML = h;
      }
    }
  } catch (err) {
    showToast('error', 'Gagal memuat dasbor admin: ' + err.message);
  }
}

// Slide-Over Drawer Detail & Action
async function openDrawerDetail(permohonanId) {
  const drawer = document.getElementById('slideover-drawer');
  drawer?.classList.remove('hidden');

  try {
    const res = await API.post('getDetailPermohonan', { permohonanId });
    if (!res.success) throw new Error(res.message);

    const p = res.data.permohonan;
    Store.selectedPermohonan = p;

    document.getElementById('drawer-reg-id').textContent = p.NoRegistrasi;
    document.getElementById('drawer-nama').textContent = p.NamaPemohon;
    document.getElementById('drawer-nik').textContent = p.NIK_Masked;
    document.getElementById('drawer-wa').textContent = p.NoWhatsApp;
    document.getElementById('drawer-email').textContent = p.Email;
    document.getElementById('drawer-alamat').textContent = p.Alamat;
    document.getElementById('drawer-rincian').textContent = p.RincianInformasi;
    document.getElementById('drawer-tujuan').textContent = p.TujuanPenggunaan;
    document.getElementById('drawer-status-select').value = p.TahapStatus;
    document.getElementById('drawer-pic-input').value = p.PetugasDisposisi || '';

    const btnKTP = document.getElementById('drawer-btn-ktp');
    if (btnKTP) {
      if (p.URLIdentitasKTP) {
        btnKTP.classList.remove('hidden');
        btnKTP.onclick = () => window.open(p.URLIdentitasKTP, '_blank');
      } else {
        btnKTP.classList.add('hidden');
      }
    }
  } catch (err) {
    showToast('error', err.message);
  }
}

function closeDrawer() {
  document.getElementById('slideover-drawer')?.classList.add('hidden');
}

async function saveDrawerStatus() {
  if (!Store.selectedPermohonan) return;

  const tahap = parseInt(document.getElementById('drawer-status-select').value, 10);
  const statusTexts = [
    'Tahap 1: Permohonan Diterima & Tercatat Sistem',
    'Tahap 2: Verifikasi Berkas & Identitas Pemohon',
    'Tahap 3: Pengolahan Informasi & Koordinasi Panitera/Unit',
    'Tahap 4: Uji Konsekuensi & Legalitas PPID',
    'Tahap 5: Penyerahan Informasi & Penyelesaian'
  ];
  const statusTeks = statusTexts[tahap - 1] || 'Dalam Proses';
  const catatanPublik = document.getElementById('drawer-catatan-publik').value.trim();
  const petugas = document.getElementById('drawer-pic-input').value.trim();

  try {
    const res = await API.post('updateStatusPermohonan', {
      permohonanId: Store.selectedPermohonan.PermohonanID,
      tahap: tahap,
      statusTeks: statusTeks,
      catatanPublik: catatanPublik,
      petugasDisposisi: petugas
    });
    if (!res.success) throw new Error(res.message);

    showToast('success', res.message);
    closeDrawer();
    refreshAdminDashboard();
  } catch (err) {
    showToast('error', err.message);
  }
}

// ============================================================================
// 12. INISIALISASI SAAT DOM READY & SERVICE WORKER PWA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  Store.init();
  Router.init();

  // Daftarkan Service Worker PWA (gas-pwa-github)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('✅ Service Worker PWA PPID PTUN Palembang aktif:', reg.scope);
      }).catch(err => {
        console.warn('Service Worker registration skipped:', err);
      });
    });
  }
});
