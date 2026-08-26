// ==========================================================
// KONFIGURASI
// ==========================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwIHdFBw5dchWdf-6s9RFpLy91bjBR0aM6DXbvdgCGu2MFTPB7_qtXtnLc6bjW1wGrk/exec";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 jam

function getCachedJson(key, maxAgeMs) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !data.timestamp || !data.value) return null;
        if (maxAgeMs && Date.now() - data.timestamp > maxAgeMs) return null;
        return data.value;
    } catch (e) {
        return null;
    }
}

function setCachedJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), value }));
    } catch (e) {
        // ignore storage errors
    }
}

function clearLocalAppCache() {
    const cacheKeys = [
        'pertasis_schedule_list',
        'pertasis_siswa_data',
        'pertasis_resume_data',
        'pertasis_psy_selected_class',
        'pertasis_psy_selected_student',
        'pertasis_psy_minggu_ke',
        'pertasis_psy_semester',
        'pertasis_selected_class',
        'pertasis_mode_pencatatan',
        'pertasis_jenis_aktivitas',
        'pertasis_minggu_ke',
        'pertasis_semester'
    ];
    cacheKeys.forEach(key => localStorage.removeItem(key));
}

// ==========================================================
// UTILITAS BERSAMA (dipakai di kedua halaman)
// ==========================================================

// Format ms -> "MM:SS:xx" (dipakai stopwatch & tabel resume)
function formatTime(ms) {
    const totalMs = Number(ms) || 0;
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = Math.floor(totalMs % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
}

// Variabel instance Chart.js
    let fitnessChartInstance = null;
    const chartModeSelect = document.getElementById('chart-mode');

// Ubah "MM:SS:xx" atau nilai waktu dari spreadsheet -> total milidetik, untuk membandingkan mana yang tercepat
function parseTimeToMs(timeStr) {
    if (timeStr === null || timeStr === undefined || timeStr === '') return null;

    const str = String(timeStr).trim();

    const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(?:Z|[+-]\d{2}:\d{2})?$/i);
    if (isoMatch) {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const h = date.getHours();
            const m = date.getMinutes();
            const s = date.getSeconds();
            const ms = date.getMilliseconds();
            return (((h * 60) + m) * 60 + s) * 1000 + ms;
        }
    }

    const date = new Date(str);
    if (!isNaN(date.getTime()) && /[T ]/.test(str)) {
        const h = date.getHours();
        const m = date.getMinutes();
        const s = date.getSeconds();
        const ms = date.getMilliseconds();
        return (((h * 60) + m) * 60 + s) * 1000 + ms;
    }

    const parts = str.split(':');
    if (parts.length === 3) {
        const m = parseInt(parts[0], 10) || 0;
        const s = parseInt(parts[1], 10) || 0;
        const msPart = String(parts[2]).split('.')[0];
        const ms = parseInt(msPart, 10) || 0;
        return (m * 60 + s) * 1000 + ms;
    }

    if (parts.length === 2) {
        const m = parseInt(parts[0], 10) || 0;
        const s = parseInt(parts[1], 10) || 0;
        return (m * 60 + s) * 1000;
    }

    return null;
}

function formatSpreadsheetValue(value) {
    if (value === null || value === undefined || value === '') return '-';

    const str = String(value).trim();
    if (!str || str === '-') return '-';

    if (/^\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(str) || /^\d{1,2}:\d{2}\.\d{1,3}$/.test(str)) {
        return str;
    }

    const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(?:Z|[+-]\d{2}:\d{2})?$/i);
    if (isoMatch) {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
            return `${hours}:${minutes}:${seconds}.${milliseconds}`;
        }
    }

    const date = new Date(str);
    if (!isNaN(date.getTime()) && /[T ]/.test(str)) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    return str;
}

function parsePsychologyScore(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    const str = String(value).trim();
    if (!str) return null;

    const lower = str.toLowerCase();
    if (lower === 'q1' || lower === '1') return 1;
    if (lower === 'q2' || lower === '2') return 2;
    if (lower === 'q3' || lower === '3') return 3;
    if (lower === 'q4' || lower === '4') return 4;

    const explicitMatch = str.match(/skor observasi:\s*([0-9]{1,2})(?:\s*\/\s*20)?/i);
    if (explicitMatch) return parseInt(explicitMatch[1], 10);

    const scoreAnyMatch = str.match(/([0-9]{1,2})(?:\s*\/\s*20)?/);
    if (scoreAnyMatch) return parseInt(scoreAnyMatch[1], 10);

    return null;
}

function formatPsychologyLabel(value) {
    const score = parsePsychologyScore(value);
    if (score !== null) return score;
    return formatSpreadsheetValue(value);
}

function formatChartTime(value) {
    if (value === null || value === undefined || value === '') return '00:00:00.000';

    const totalMs = Number(value) || 0;
    const safeMs = Math.max(0, totalMs);
    const minutes = Math.floor(safeMs / 60000);
    const seconds = Math.floor((safeMs % 60000) / 1000);
    const milliseconds = Math.floor(safeMs % 1000);

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
}

// "1" -> "Ganjil", "2" -> "Genap" (mengikuti value pada <select id="semester"> di halaman pencatatan)
function semesterLabel(val) {
    const v = String(val).trim();
    if (v === '1') return 'Ganjil';
    if (v === '2') return 'Genap';
    return v || '-';
}

// Timestamp ISO -> format tanggal Indonesia yang enak dibaca
function formatTanggal(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString || '-';
    return d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function getTodayDateLabel() {
    return new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function extractPertemuanNumber(value, fallback = 1) {
    if (value === null || value === undefined || value === '') return fallback;

    const raw = String(value).trim();
    if (!raw) return fallback;

    const direct = Number(raw);
    if (Number.isInteger(direct) && String(raw).match(/^\d+$/)) {
        return direct;
    }

    const match = raw.match(/(?:pertemuan|minggu)\s*ke?\s*(\d+)/i);
    if (match && match[1]) {
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

function buildPertemuanNumberMap(records) {
    const orderMap = new Map();
    const entries = (records || [])
        .map(rec => ({
            rec,
            raw: String(rec && (rec.Minggu_Ke || rec.minggu_ke || rec.Pertemuan_Ke || rec.pertemuan_ke || '')).trim(),
            timestamp: rec && rec.Timestamp ? new Date(rec.Timestamp) : null
        }))
        .filter(entry => entry.raw || (entry.timestamp && !isNaN(entry.timestamp.getTime())))
        .sort((a, b) => {
            const aTime = a.timestamp && !isNaN(a.timestamp.getTime()) ? a.timestamp.getTime() : 0;
            const bTime = b.timestamp && !isNaN(b.timestamp.getTime()) ? b.timestamp.getTime() : 0;
            return aTime - bTime;
        });

    let nextNumber = 1;
    entries.forEach(({ rec, raw }) => {
        const trimmed = raw;
        if (!trimmed) return;

        const direct = Number(trimmed);
        if (String(trimmed).match(/^\d+$/) && Number.isInteger(direct)) {
            if (!orderMap.has(trimmed)) {
                orderMap.set(trimmed, direct);
            }
            nextNumber = Math.max(nextNumber, direct + 1);
            return;
        }

        if (!orderMap.has(trimmed)) {
            orderMap.set(trimmed, nextNumber);
            nextNumber += 1;
        }
    });

    return orderMap;
}

function getPertemuanNumber(rec, orderMap = new Map()) {
    if (!rec) return NaN;
    const raw = String(rec.Minggu_Ke ?? rec.minggu_ke ?? rec.Pertemuan_Ke ?? rec.pertemuan_ke ?? '').trim();
    if (!raw) return NaN;

    const direct = Number(raw);
    if (String(raw).match(/^\d+$/) && Number.isInteger(direct)) {
        return direct;
    }

    if (orderMap.has(raw)) return orderMap.get(raw);

    const fallback = extractPertemuanNumber(raw, NaN);
    return Number.isFinite(fallback) ? fallback : NaN;
}

function normalizePertemuanValue(value) {
    if (value === null || value === undefined) return '';
    const trimmed = String(value).trim();
    return trimmed;
}

async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Server merespons dengan status ${response.status}`);
    }
    return response.json();
}

// -------------------------
// Jadwal Kelas (global)
// -------------------------
let scheduleList = [];

async function loadScheduleList() {
    const cached = getCachedJson('pertasis_schedule_list', CACHE_TTL_MS);
    if (cached && Array.isArray(cached) && cached.length > 0) {
        scheduleList = cached;
        return scheduleList;
    }

    const candidates = ['getDaftarKelas','getDaftar_kelas','getDaftarKelasRaw','getDaftarKelasList'];
    for (const action of candidates) {
        try {
            const res = await fetch(`${API_URL}?action=${action}`);
            if (!res.ok) continue;
            const json = await res.json();
            if (Array.isArray(json) && json.length > 0) {
                scheduleList = json.map(r => ({
                    id: r.ID_kelas || r.ID_KELAS || r.id_kelas || r.ID_kelas || '',
                    nama: r.Nama_kelas || r.Nama_Kelas || r.nama_kelas || r.Nama_kelas || '',
                    jam: r.Jam || r.jam || r.time || '',
                    hari: String(r.Hari || r.hari || '').toLowerCase()
                }));
                setCachedJson('pertasis_schedule_list', scheduleList);
                return scheduleList;
            }
        } catch (e) {
            // ignore and try next
        }
    }

    // Fallback: try generic endpoint via fetchJSON
    try {
        const json = await fetchJSON(`${API_URL}?action=getDaftarKelas`);
        if (Array.isArray(json)) {
            scheduleList = json.map(r => ({
                id: r.ID_kelas || r.ID_KELAS || r.id_kelas || r.ID_kelas || '',
                nama: r.Nama_kelas || r.Nama_Kelas || r.nama_kelas || r.Nama_kelas || '',
                jam: r.Jam || r.jam || r.time || '',
                hari: String(r.Hari || r.hari || '').toLowerCase()
            }));
            setCachedJson('pertasis_schedule_list', scheduleList);
            return scheduleList;
        }
    } catch (e) {
        // ignore
    }

    scheduleList = [];
    return scheduleList;
}

function parseJamRange(jamStr) {
    if (!jamStr) return null;

    const normalizeJam = value => {
        if (value === null || value === undefined) return '';
        let s = String(value).trim().replace(/\s+/g, '');
        s = s.replace(/,/g, '.');

        // Normalisasi format seperti 8.05 -> 8:05, 8.05-9.10 -> 8:05-9:10
        s = s.replace(/(\d{1,2})\.(\d{2})(?=(?:-|$))/g, '$1:$2');
        s = s.replace(/(\d{1,2})\.(\d{2})\.(\d{2})/g, '$1:$2:$3');

        return s;
    };

    const s = normalizeJam(jamStr);
    const parts = s.split('-').map(p => p.trim()).filter(Boolean);
    const toMinutes = t => {
        if (!t) return null;
        const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!m) return null;
        const hours = parseInt(m[1], 10);
        const minutes = parseInt(m[2], 10);
        const seconds = m[3] ? parseInt(m[3], 10) : 0;
        return hours * 60 + minutes + (seconds > 0 ? seconds / 60 : 0);
    };

    const start = toMinutes(parts[0]);
    const end = parts[1] ? toMinutes(parts[1]) : null;
    return { start, end };
}

function isNowInSchedule(entry) {
    if (!entry || !entry.hari || !entry.jam) return false;
    const now = new Date();
    const dayNames = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
    const today = dayNames[now.getDay()];
    if (!String(entry.hari).toLowerCase().includes(today)) return false;
    const range = parseJamRange(entry.jam);
    if (!range || range.start === null) return false;
    const nowMinutes = now.getHours()*60 + now.getMinutes();
    if (range.end === null) {
        return Math.abs(nowMinutes - range.start) <= 30;
    }
    return nowMinutes >= range.start && nowMinutes <= range.end;
}

function getTodayClasses() {
    if (!scheduleList || scheduleList.length === 0) return [];
    return scheduleList.filter(isNowInSchedule).map(s => s.nama).filter(Boolean);
}

// Alias backward-compatible untuk page resume / helper lama yang masih dipanggil
function getCurrentClasses() {
    return getTodayClasses();
}

function getNowClassesWithTime() {
    if (!scheduleList || scheduleList.length === 0) return [];
    return scheduleList.filter(isNowInSchedule).map(s => ({ nama: s.nama, jam: s.jam || '' }));
}

function getClassesForTodayByDay() {
    if (!scheduleList || scheduleList.length === 0) return [];
    const now = new Date();
    const dayNames = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
    const today = dayNames[now.getDay()];
    return scheduleList.filter(s => String(s.hari || '').toLowerCase().includes(today)).map(s => ({ nama: s.nama, jam: s.jam || '' })).filter(Boolean);
}
// Update displays: index shows day-based classes (with times), resume shows current classes (with times)
function updateCurrentTimeAndClass() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID');
    const nowClasses = getNowClassesWithTime(); // currently ongoing
    const dayClasses = getClassesForTodayByDay(); // all classes today

    const elResumeTime = document.getElementById('currentTimeDisplay');
    const elResumeClasses = document.getElementById('currentClassDisplay');
    const elResumeClassesTimes = document.getElementById('currentClassTimesDisplay');

    const elIdxTime = document.getElementById('currentTimeDisplayIndex');
    const elIdxClasses = document.getElementById('currentClassesDisplayIndex');
    const elIdxClassesTimes = document.getElementById('currentClassesTimesIndex');

    // Update time
    if (elResumeTime) elResumeTime.textContent = timeStr;
    if (elIdxTime) elIdxTime.textContent = timeStr;

    // Resume: current classes now
    if (elResumeClasses) elResumeClasses.textContent = nowClasses.length ? nowClasses.map(c => c.nama).join(', ') : '-';
    if (elResumeClassesTimes) elResumeClassesTimes.textContent = nowClasses.length ? nowClasses.map(c => (c.jam ? `${c.nama} (${c.jam})` : c.nama)).join(' • ') : '-';

    // Index/Psikologi: classes for today (day-based)
    if (elIdxClasses) elIdxClasses.textContent = dayClasses.length ? dayClasses.map(d => d.nama).join(', ') : '-';
    if (elIdxClassesTimes) elIdxClassesTimes.textContent = dayClasses.length ? dayClasses.map(d => (d.jam ? `${d.nama} (${d.jam})` : d.nama)).join(' • ') : '-';
}

// ==========================================================
// HALAMAN 1: PENCATATAN (index.html)
// Hanya berjalan jika elemen halaman pencatatan ada di DOM,
// supaya tidak bentrok / crash saat app.js dimuat di resume.html
// ==========================================================
if (document.getElementById('selectKelas')) {
    initHalamanPencatatan();
}

function initHalamanPencatatan() {
    // Variabel Global halaman ini
    let allSiswaData = [];
    let recordedData = {}; // Menyimpan catatan waktu tiap ID Siswa
    let startTime, timerInterval;
    let elapsedTime = 0;
    let isRunning = false;

    // Elemen DOM
    const selectKelas = document.getElementById('selectKelas');
    const modePencatatan = document.getElementById('modePencatatan');
    const listSiswaPencatatan = document.getElementById('listSiswaPencatatan');
    const pencatatanContainer = document.getElementById('pencatatanContainer');
    const stopwatchContainer = document.getElementById('stopwatchContainer');
    const stopwatchDisplay = document.getElementById('stopwatchDisplay');
    const btnStart = document.getElementById('btnStart');
    const btnStop = document.getElementById('btnStop');
    const btnReset = document.getElementById('btnReset');
    const btnKirimKolektif = document.getElementById('btnKirimKolektif');

    // ----------------------------------------
    // 1. MEMUAT DATA KELAS SAAT APLIKASI DIBUKA
    // ----------------------------------------
    async function muatDataSiswa() {
        try {
            const cached = getCachedJson('pertasis_siswa_data', CACHE_TTL_MS);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                allSiswaData = cached;
            } else {
                const data = await fetchJSON(`${API_URL}?action=getSiswa`);
                if (data && data.error) {
                    throw new Error(data.error);
                }
                allSiswaData = data.filter(siswa => siswa.ID_Siswa && siswa.Nama_Siswa && siswa.Kelas);
                setCachedJson('pertasis_siswa_data', allSiswaData);
            }

            const kelasSet = new Set(allSiswaData.map(siswa => String(siswa.Kelas).trim()));
            const kelasList = Array.from(kelasSet).sort();

            selectKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
            kelasList.forEach(kelas => {
                const option = document.createElement("option");
                option.value = kelas;
                option.textContent = `Kelas ${kelas}`;
                selectKelas.appendChild(option);
            });

            const savedKelas = localStorage.getItem('pertasis_selected_class');
            if (savedKelas && kelasSet.has(savedKelas)) {
                selectKelas.value = savedKelas;
            }
            renderStudentList();
        } catch (error) {
            alert("Gagal memuat data: " + error.message);
        }
    }

    const jenisAktivitasEl = document.getElementById('jenisAktivitas');
    const mingguKeEl = document.getElementById('mingguKe');
    const semesterEl = document.getElementById('semester');

    const savedMode = localStorage.getItem('pertasis_mode_pencatatan');
    if (savedMode) {
        modePencatatan.value = savedMode;
    }

    const savedJenis = localStorage.getItem('pertasis_jenis_aktivitas');
    if (savedJenis && jenisAktivitasEl) jenisAktivitasEl.value = savedJenis;
    const savedMinggu = localStorage.getItem('pertasis_minggu_ke');
    if (mingguKeEl) {
        if (savedMinggu) {
            mingguKeEl.value = savedMinggu;
        } else {
            mingguKeEl.value = getTodayDateLabel();
        }
    }
    const savedSemester = localStorage.getItem('pertasis_semester');
    if (savedSemester && semesterEl) semesterEl.value = savedSemester;

    if (jenisAktivitasEl) {
        jenisAktivitasEl.addEventListener('input', () => {
            localStorage.setItem('pertasis_jenis_aktivitas', jenisAktivitasEl.value);
        });
    }
    if (mingguKeEl) {
        mingguKeEl.addEventListener('input', () => {
            localStorage.setItem('pertasis_minggu_ke', mingguKeEl.value);
        });
    }
    if (semesterEl) {
        semesterEl.addEventListener('change', () => {
            localStorage.setItem('pertasis_semester', semesterEl.value);
        });
    }

    window.addEventListener('load', muatDataSiswa);

    // ----------------------------------------
    // 2. MENAMPILKAN SISWA (DINAMIS WAKTU / REPETISI)
    // ----------------------------------------
    function renderStudentList() {
        const kelasTerpilih = selectKelas.value;
        const mode = modePencatatan.value;

        if (!kelasTerpilih) {
            pencatatanContainer.style.display = 'none';
            stopwatchContainer.style.display = 'none';
            return;
        }

        // Tampilkan atau Sembunyikan Stopwatch sesuai mode
        stopwatchContainer.style.display = (mode === 'waktu') ? 'block' : 'none';

        recordedData = {}; // Reset memori rekaman
        listSiswaPencatatan.innerHTML = '';

        const siswaDiKelas = allSiswaData.filter(s => String(s.Kelas).trim() === kelasTerpilih);

        siswaDiKelas.forEach(siswa => {
            const li = document.createElement('li');
            li.className = 'student-item';

            const info = document.createElement('div');
            info.className = 'student-info';
            info.textContent = siswa.Nama_Siswa;

            const action = document.createElement('div');
            action.className = 'student-action';

            if (mode === 'waktu') {
                // -- LOGIKA WAKTU (LARI) --
                const timeDisplay = document.createElement('span');
                timeDisplay.className = 'recorded-time';
                timeDisplay.textContent = '--:--:--';

                const btnCatat = document.createElement('button');
                btnCatat.type = 'button';
                btnCatat.className = 'btn-catat';
                btnCatat.textContent = 'Catat Waktu';

                btnCatat.onclick = () => {
                    if (!isRunning && elapsedTime === 0) {
                        alert("Mulai stopwatch terlebih dahulu!");
                        return;
                    }
                    const waktuSaatIni = formatTime(elapsedTime);
                    recordedData[siswa.ID_Siswa] = waktuSaatIni;
                    timeDisplay.textContent = waktuSaatIni;

                    btnCatat.textContent = 'Ubah Catatan';
                    btnCatat.style.backgroundColor = '#7f8c8d';
                };

                action.appendChild(timeDisplay);
                action.appendChild(btnCatat);
            } else {
                // -- LOGIKA REPETISI (PUSH-UP / SIT-UP) --
                const inputAngka = document.createElement('input');
                inputAngka.type = 'number';
                inputAngka.className = 'input-repetisi';
                inputAngka.placeholder = '0';
                inputAngka.min = '0';

                // Simpan data ke dalam elemen agar mudah ditarik saat kirim
                inputAngka.dataset.idSiswa = siswa.ID_Siswa;
                inputAngka.dataset.namaSiswa = siswa.Nama_Siswa;

                action.appendChild(inputAngka);
            }

            li.appendChild(info);
            li.appendChild(action);
            listSiswaPencatatan.appendChild(li);
        });

        pencatatanContainer.style.display = 'block';
    }

    // Pasang event listener perubahan Kelas / Mode
    selectKelas.addEventListener('change', () => {
        localStorage.setItem('pertasis_selected_class', selectKelas.value);
        renderStudentList();
    });
    modePencatatan.addEventListener('change', () => {
        localStorage.setItem('pertasis_mode_pencatatan', modePencatatan.value);
        renderStudentList();
    });

    // ----------------------------------------
    // 3. LOGIKA STOPWATCH GLOBAL
    // ----------------------------------------
    btnStart.onclick = () => {
        if (!isRunning) {
            startTime = Date.now() - elapsedTime;
            timerInterval = setInterval(() => {
                elapsedTime = Date.now() - startTime;
                stopwatchDisplay.textContent = formatTime(elapsedTime);
            }, 10);
            isRunning = true;
        }
    };

    btnStop.onclick = () => {
        clearInterval(timerInterval);
        isRunning = false;
    };

    btnReset.onclick = () => {
        clearInterval(timerInterval);
        isRunning = false;
        elapsedTime = 0;
        stopwatchDisplay.textContent = "00:00:00";
    };

    // ----------------------------------------
    // 4. MENGIRIM DATA KOLEKTIF KE SPREADSHEET
    // ----------------------------------------
    btnKirimKolektif.addEventListener('click', async () => {
        const kelas = selectKelas.value;
        const mode = modePencatatan.value;
        const jenisAktivitas = document.getElementById('jenisAktivitas').value;
        const mingguKe = normalizePertemuanValue(document.getElementById('mingguKe').value);
        const semester = document.getElementById('semester').value;

        if (!jenisAktivitas || !mingguKe || !semester) {
            alert("Harap lengkapi Jenis Aktivitas, Pertemuan, dan Semester terlebih dahulu!");
            return;
        }

        const payload = [];

        if (mode === 'waktu') {
            const siswaDiKelas = allSiswaData.filter(s => String(s.Kelas).trim() === kelas);
            siswaDiKelas.forEach(siswa => {
                const hasilWaktu = recordedData[siswa.ID_Siswa];
                if (hasilWaktu) {
                    payload.push({
                        idSiswa: siswa.ID_Siswa,
                        namaSiswa: siswa.Nama_Siswa,
                        jenisAktivitas: jenisAktivitas,
                        hasil: hasilWaktu,
                        mingguKe: mingguKe,
                        semester: semester
                    });
                }
            });
        } else {
            const inputs = document.querySelectorAll('.input-repetisi');
            inputs.forEach(input => {
                const nilai = input.value;
                if (nilai && nilai !== "" && parseInt(nilai) > 0) {
                    payload.push({
                        idSiswa: input.dataset.idSiswa,
                        namaSiswa: input.dataset.namaSiswa,
                        jenisAktivitas: jenisAktivitas,
                        hasil: `${nilai} kali`,
                        mingguKe: mingguKe,
                        semester: semester
                    });
                }
            });
        }

        if (payload.length === 0) {
            alert("Belum ada siswa yang dicatat hasilnya di kelas ini!");
            return;
        }

        try {
            btnKirimKolektif.textContent = 'MENGIRIM DATA...';
            btnKirimKolektif.disabled = true;

            const result = await fetchJSON(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (result.status === 'success') {
                alert(`Berhasil mengirim ${payload.length} catatan siswa!`);
                if (mode === 'waktu') btnReset.click();
                renderStudentList();
            } else {
                alert("Terjadi kesalahan: " + result.message);
            }
        } catch (error) {
            alert("Gagal menghubungi server: " + error.message);
        } finally {
            btnKirimKolektif.textContent = 'Kirim Semua Catatan';
            btnKirimKolektif.disabled = false;
        }
    });
}

// ==========================================================
// HALAMAN 2: RESUME DASHBOARD (resume.html)
// Hanya berjalan jika elemen halaman resume ada di DOM
// ==========================================================
if (document.getElementById('resume-table-body')) {
    initHalamanResume();
}

function initHalamanResume() {
    let allResumeData = []; // gabungan Log_Aktivitas + Kelas hasil join dari Daftar_Siswa
    let scheduleList = []; // daftar kelas dari sheet Daftar_kelas

    const chartModeSelect = document.getElementById('chart-mode');
    const filterSearch = document.getElementById('filter-search');
    const filterKelas = document.getElementById('filter-kelas');
    const filterSiswa = document.getElementById('filter-siswa');
    const filterAktivitas = document.getElementById('filter-aktivitas');
    const filterMinggu = document.getElementById('filter-minggu');
    const filterSemester = document.getElementById('filter-semester');
    const observationSummaryCard = document.getElementById('observation-summary-card');
    const observationSummaryText = document.getElementById('observation-summary-text');
    const btnClearLocalCache = document.getElementById('btn-clear-local-cache');
    const btnExportPdf = document.getElementById('btn-export-pdf');

    function normalizeActivityName(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    function isPsychologyActivity(value) {
        const normalized = normalizeActivityName(value);
        return normalized.includes('kesehatandanpsikologi') || normalized.includes('psikologi') || normalized.includes('observasibk') || normalized.includes('observasi');
    }

    function getNumericScore(value) {
        const str = String(value || '').trim().toLowerCase();
        if (str === 'q1' || str === '1') return 1;
        if (str === 'q2' || str === '2') return 2;
        if (str === 'q3' || str === '3') return 3;
        if (str === 'q4' || str === '4') return 4;
        const num = parseInt(str, 10);
        return Number.isNaN(num) ? null : num;
    }

    function formatQuartileLabel(value) {
        const score = getNumericScore(value);
        if (score === 1) return 'Q1';
        if (score === 2) return 'Q2';
        if (score === 3) return 'Q3';
        if (score === 4) return 'Q4';
        return formatSpreadsheetValue(value);
    }

    if (chartModeSelect) {
        chartModeSelect.addEventListener('change', applyFiltersAndRender);
    }
    if (filterKelas) {
        filterKelas.addEventListener('change', () => {
            const currentSelectedStudent = filterSiswa ? filterSiswa.value : '';
            renderStudentOptions();
            if (filterSiswa && currentSelectedStudent && [...filterSiswa.options].some(opt => opt.value === currentSelectedStudent)) {
                filterSiswa.value = currentSelectedStudent;
            } else if (filterSiswa) {
                filterSiswa.value = '';
            }
            updateObservationSummary(filterSiswa ? filterSiswa.value : '');
            applyFiltersAndRender();
        });
    }

    if (filterSiswa) {
        filterSiswa.addEventListener('change', () => {
            updateObservationSummary(filterSiswa.value);
            applyFiltersAndRender();
        });
    }

    function renderClassOptions() {
        if (!filterKelas) return;
        const selected = filterKelas.value;
        const kelasUnik = [...new Set(allResumeData.map(d => d._Kelas).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));

        filterKelas.innerHTML = '<option value="">Pilih Kelas</option>';
        kelasUnik.forEach(kelas => {
            const opt = document.createElement('option');
            opt.value = kelas;
            opt.textContent = kelas;
            filterKelas.appendChild(opt);
        });

        if (selected && kelasUnik.includes(selected)) {
            filterKelas.value = selected;
        } else if (selected && !kelasUnik.includes(selected)) {
            filterKelas.value = '';
        }
    }

    function renderStudentOptions() {
        if (!filterSiswa) return;
        const selected = filterSiswa.value;
        const kelasFilter = filterKelas ? filterKelas.value : '';
        const siswaUnik = [...new Set(
            allResumeData
                .filter(rec => !kelasFilter || rec._Kelas === kelasFilter)
                .map(d => d.Nama_Siswa)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'id'));

        filterSiswa.innerHTML = '<option value="">Pilih Nama Siswa</option>';
        siswaUnik.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            filterSiswa.appendChild(opt);
        });

        if (selected && siswaUnik.includes(selected)) {
            filterSiswa.value = selected;
        } else {
            filterSiswa.value = '';
        }
    }

    function getLatestPsychologyRecord(studentName) {
        if (!studentName) return null;
        const records = allResumeData
            .filter(rec => rec.Nama_Siswa === studentName)
            .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
        return records.find(rec => isPsychologyActivity(rec.Jenis_Aktivitas)) || null;
    }

    function getComparableActivityValue(rec) {
        if (!rec) return null;

        const jenis = String(rec.Jenis_Aktivitas || '').toLowerCase();
        const hasil = String(rec.Hasil || '').trim();
        if (!hasil) return null;

        const timeMs = parseTimeToMs(hasil);
        if (timeMs !== null) {
            return {
                value: timeMs,
                isLowerBetter: true,
                display: formatSpreadsheetValue(hasil),
                label: jenis.includes('lari') ? 'Lari' : 'Waktu'
            };
        }

        const psychScore = parsePsychologyScore(hasil);
        if (psychScore !== null) {
            return {
                value: psychScore,
                isLowerBetter: false,
                display: String(psychScore),
                label: 'Indeks'
            };
        }

        const numeric = Number.parseFloat(String(hasil).replace(/[^0-9.\-]/g, ''));
        if (!Number.isNaN(numeric)) {
            return {
                value: numeric,
                isLowerBetter: !(jenis.includes('lari') || jenis.includes('push') || jenis.includes('sit')) ? false : false,
                display: formatSpreadsheetValue(hasil),
                label: 'Hasil'
            };
        }

        return null;
    }

    function getActivityTrendSummary(studentName) {
        const records = allResumeData
            .filter(rec => rec.Nama_Siswa === studentName)
            .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

        if (records.length === 0) return '';

        const grouped = new Map();
        records.forEach(rec => {
            const key = String(rec.Jenis_Aktivitas || '').trim() || 'Umum';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(rec);
        });

        const summaries = [];

        grouped.forEach((items, activityName) => {
            if (items.length < 2) return;

            const latest = items[0];
            const previous = items[1];
            const latestValue = getComparableActivityValue(latest);
            const previousValue = getComparableActivityValue(previous);
            if (!latestValue || !previousValue) return;

            const better = latestValue.isLowerBetter
                ? latestValue.value < previousValue.value
                : latestValue.value > previousValue.value;

            const currentDisplay = latestValue.display;
            const previousDisplay = previousValue.display;
            const statusText = better ? 'lebih baik' : 'lebih buruk';
            const actionText = better ? 'Pertahankan pola latihan ini.' : 'Perkuat latihan dan konsistensi pada aktivitas ini.';
            const shortName = activityName || 'Aktivitas';

            summaries.push(`• <strong>${escapeHtml(shortName)}</strong>: ${escapeHtml(currentDisplay)} vs ${escapeHtml(previousDisplay)} (<strong>${statusText}</strong>). Saran: <strong>${actionText}</strong>`);
        });

        return summaries.join('<br>');
    }

    function updateObservationSummary(studentName) {
        if (!observationSummaryCard || !observationSummaryText) return;
        if (!studentName) {
            observationSummaryCard.style.display = 'none';
            observationSummaryText.textContent = 'Pilih nama siswa untuk melihat catatan observasi terakhir.';
            return;
        }

        const records = allResumeData
            .filter(rec => rec.Nama_Siswa === studentName)
            .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

        const latest = records[0];
        const latestTrendString = getActivityTrendSummary(studentName);
        const summaryHeader = latest ? `<strong>${escapeHtml(latest.Jenis_Aktivitas || 'Aktivitas')}</strong> terakhir: ${escapeHtml(formatSpreadsheetValue(latest.Hasil))}` : 'Belum ada catatan.';

        if (latest) {
            observationSummaryCard.style.display = 'block';
            observationSummaryText.innerHTML = `${summaryHeader}<br>${latestTrendString || 'Belum ada perbandingan dua hasil terakhir yang cukup untuk dianalisa.'}`;
            return;
        }

        observationSummaryCard.style.display = 'block';
        observationSummaryText.textContent = 'Belum ada catatan untuk siswa yang dipilih.';
    }

    // ----------------------------------------
    // FITUR KURVA GRAFIK (LINE CHART)
    // ----------------------------------------
    function updateChart(data) {
        const ctx = document.getElementById('fitnessChart');
        if (!ctx) return;

        const pertemuanMap = buildPertemuanNumberMap(data);
        const getMeetingNumber = rec => getPertemuanNumber(rec, pertemuanMap);

        const mingguSet = new Set();
        data.forEach(d => {
            const m = getMeetingNumber(d);
            if (Number.isFinite(m)) mingguSet.add(m);
        });
        const mingguSorted = Array.from(mingguSet).sort((a, b) => a - b);
        const labels = mingguSorted.map(m => String(m));

        const selectedActivity = filterAktivitas.value;
        const modeChart = chartModeSelect ? chartModeSelect.value : 'rata-rata';
        const datasets = [];

        const matchesSelectedActivity = rec => {
            if (!selectedActivity || selectedActivity === 'Semua Aktivitas') return true;
            const recName = normalizeActivityName(rec && rec.Jenis_Aktivitas ? rec.Jenis_Aktivitas : '');
            const filterName = normalizeActivityName(selectedActivity);

            if (!recName || !filterName) return true;
            if (recName.includes(filterName)) return true;

            if (filterName.includes('lari') && recName.includes('lari')) return true;
            if (filterName.includes('push') && recName.includes('push')) return true;
            if (filterName.includes('sit') && recName.includes('sit')) return true;
            if ((filterName.includes('kesehatan') || filterName.includes('psikologi')) && (recName.includes('kesehatan') || recName.includes('psikologi'))) return true;
            return false;
        };

        const getMetricInfo = rec => {
            if (!rec) return null;

            const jenis = String(rec.Jenis_Aktivitas || '').toLowerCase();
            const normalizedJenis = normalizeActivityName(rec.Jenis_Aktivitas);

            if (isPsychologyActivity(rec.Jenis_Aktivitas)) {
                const score = parsePsychologyScore(rec.Hasil);
                if (score === null) return null;
                return {
                    value: score,
                    metricType: 'psychology',
                    display: formatPsychologyLabel(rec.Hasil),
                    activityName: 'Psikologi'
                };
            }

            if (normalizedJenis.includes('lari') || jenis.includes('lari')) {
                const ms = parseTimeToMs(rec.Hasil);
                if (ms !== null) {
                    return {
                        value: ms,
                        metricType: 'time',
                        display: formatSpreadsheetValue(rec.Hasil),
                        activityName: 'Lari'
                    };
                }
            }

            if (normalizedJenis.includes('push')) {
                const value = Number.parseFloat(String(rec.Hasil || '').replace(/[^0-9.\-]/g, ''));
                if (!Number.isNaN(value)) {
                    return {
                        value,
                        metricType: 'number',
                        display: formatSpreadsheetValue(rec.Hasil),
                        activityName: 'Push Up'
                    };
                }
            }

            if (normalizedJenis.includes('sit')) {
                const value = Number.parseFloat(String(rec.Hasil || '').replace(/[^0-9.\-]/g, ''));
                if (!Number.isNaN(value)) {
                    return {
                        value,
                        metricType: 'number',
                        display: formatSpreadsheetValue(rec.Hasil),
                        activityName: 'Sit Up'
                    };
                }
            }

            const numeric = Number.parseFloat(String(rec.Hasil || '').replace(/[^0-9.\-]/g, ''));
            if (!Number.isNaN(numeric)) {
                return {
                    value: numeric,
                    metricType: 'number',
                    display: formatSpreadsheetValue(rec.Hasil),
                    activityName: String(rec.Jenis_Aktivitas || 'Aktivitas')
                };
            }

            return null;
        };

        const getYTitle = metricType => {
            if (metricType === 'time') return 'Waktu (MM:SS:mmm) - Lebih Rendah Lebih Baik';
            if (metricType === 'psychology') return 'Skor Psikologi (0-20)';
            return 'Jumlah Repetisi / Kali';
        };

        const getDisplayValue = (value, metricType) => {
            if (metricType === 'time') return formatChartTime(value);
            if (metricType === 'psychology') return value !== null && value !== undefined ? Number(value).toFixed(1) : '-';
            return value !== null && value !== undefined ? Number(value).toFixed(1) : '-';
        };

        const chartRecords = (selectedActivity && selectedActivity !== 'Semua Aktivitas')
            ? data.filter(matchesSelectedActivity)
            : data;

        if (modeChart === 'rata-rata') {
            const activityGroups = new Map();
            chartRecords.forEach(rec => {
                const metric = getMetricInfo(rec);
                if (!metric) return;
                const key = metric.activityName;
                if (!activityGroups.has(key)) activityGroups.set(key, []);
                activityGroups.get(key).push(rec);
            });

            if (activityGroups.size === 0) {
                datasets.push({
                    label: 'Tidak ada data',
                    data: Array(mingguSorted.length || 1).fill(null),
                    pointInfo: Array(mingguSorted.length || 1).fill({ value: null, display: '-' }),
                    borderColor: '#94a3b8',
                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    metricType: 'number'
                });
            } else {
                activityGroups.forEach((groupRecords, activityName) => {
                    const metricTypeByGroup = getMetricInfo(groupRecords[0])?.metricType || 'number';
                    const pointInfoData = [];
                    const dataPoint = mingguSorted.map(m => {
                        const recs = groupRecords.filter(d => getMeetingNumber(d) === m);
                        if (recs.length === 0) {
                            pointInfoData.push({ value: null, display: null });
                            return null;
                        }

                        const values = recs
                            .map(getMetricInfo)
                            .filter(Boolean)
                            .map(v => v.value);

                        if (values.length === 0) {
                            pointInfoData.push({ value: null, display: null });
                            return null;
                        }

                        const avgValue = values.reduce((sum, value) => sum + value, 0) / values.length;
                        const mingguValues = [...new Set(recs
                            .map(rec => normalizePertemuanValue(rec.Minggu_Ke ?? rec.minggu_ke ?? rec.Pertemuan_Ke ?? rec.pertemuan_ke))
                            .filter(Boolean))];
                        pointInfoData.push({
                            value: avgValue,
                            display: getDisplayValue(avgValue, metricTypeByGroup),
                            mingguKe: mingguValues.join(', ')
                        });
                        return avgValue;
                    });

                    datasets.push({
                        label: `${activityName} (Rata-rata)`,
                        data: dataPoint,
                        pointInfo: pointInfoData,
                        borderColor: activityName === 'Lari' ? '#3498db' : activityName === 'Push Up' ? '#27ae60' : activityName === 'Sit Up' ? '#e67e22' : '#8b5cf6',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: false,
                        pointBackgroundColor: '#2c3e50',
                        pointRadius: 5,
                        metricType: metricTypeByGroup
                    });
                });
            }
        } else {
            const siswaUnik = [...new Set(chartRecords.map(d => d.Nama_Siswa))].slice(0, 5);
            const warnaPalette = ['#3498db', '#27ae60', '#e67e22', '#e74c3c', '#9b59b6'];

            siswaUnik.forEach((nama, idx) => {
                const pointInfoData = [];
                const dataPoint = mingguSorted.map(m => {
                    const rec = chartRecords.find(d => d.Nama_Siswa === nama && getMeetingNumber(d) === m);
                    if (!rec) {
                        pointInfoData.push({ value: null, display: null });
                        return null;
                    }

                    const metric = getMetricInfo(rec);
                    pointInfoData.push({
                        value: metric ? metric.value : null,
                        display: metric ? metric.display : null,
                        mingguKe: normalizePertemuanValue(rec.Minggu_Ke ?? rec.minggu_ke ?? rec.Pertemuan_Ke ?? rec.pertemuan_ke)
                    });
                    return metric ? metric.value : null;
                });

                const metricType = chartRecords
                    .map(getMetricInfo)
                    .find(Boolean)?.metricType || 'number';

                datasets.push({
                    label: nama,
                    data: dataPoint,
                    pointInfo: pointInfoData,
                    borderColor: warnaPalette[idx % warnaPalette.length],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 4,
                    metricType
                });
            });
        }

        // 4. Render ke Canvas Chart.js
        if (fitnessChartInstance) {
            fitnessChartInstance.destroy(); // Hapus chart lama sebelum membuat baru
        }

        fitnessChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['1', '2', '3'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const dataset = context.dataset || {};
                                const metricType = dataset.metricType || 'number';
                                let label = dataset.label || '';
                                let val = context.parsed.y;
                                const pointInfo = dataset.pointInfo?.[context.dataIndex] || null;
                                const displayValue = pointInfo && pointInfo.display ? pointInfo.display : (() => {
                                    if (metricType === 'psychology') return formatPsychologyLabel(val);
                                    if (metricType === 'time') return formatChartTime(val);
                                    return `${val} Kali`;
                                })();
                                return `${label}: ${displayValue}`;
                            },
                            afterLabel: function(context) {
                                const pointInfo = context.dataset?.pointInfo?.[context.dataIndex];
                                return pointInfo?.mingguKe ? `Minggu ke: ${pointInfo.mingguKe}` : '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: datasets.some(ds => ds.metricType === 'psychology') ? 1 : undefined,
                            callback: function(value) {
                                const dsMetricType = datasets[0]?.metricType || 'number';
                                if (dsMetricType === 'psychology') return value;
                                if (dsMetricType === 'time') {
                                    const matchingPoint = datasets.flatMap(ds => ds.pointInfo || []).find(entry => entry && entry.value === value);
                                    if (matchingPoint && matchingPoint.display) return matchingPoint.display;
                                    return formatChartTime(value);
                                }
                                return value;
                            }
                        },
                        title: {
                            display: true,
                            text: datasets[0]?.metricType === 'psychology'
                                ? 'Skor Psikologi (0-20)'
                                : (datasets[0]?.metricType === 'time' ? 'Waktu (MM:SS:mmm) - Lebih Rendah Lebih Baik' : 'Jumlah Repetisi / Kali')
                        },
                        min: datasets.some(ds => ds.metricType === 'psychology') ? 0 : undefined,
                        max: datasets.some(ds => ds.metricType === 'psychology') ? 20 : undefined
                    }
                }
            }
        });
    }

    // Elemen DOM
    const btnRefresh = document.getElementById('btn-refresh-data');
    const tbody = document.getElementById('resume-table-body');
    const tableInfo = document.getElementById('table-entries-info');

    const statTotal = document.getElementById('stat-total-records');
    const statBestRunning = document.getElementById('stat-best-running');
    const statBestRunningName = document.getElementById('stat-best-running-name');
    const statBestPushup = document.getElementById('stat-best-pushup');
    const statBestPushupName = document.getElementById('stat-best-pushup-name');
    const statBestSitup = document.getElementById('stat-best-situp');
    const statBestSitupName = document.getElementById('stat-best-situp-name');

    // Variabel instance Chart.js
    let fitnessChartInstance = null;

    // ----------------------------------------
    // 1. MEMUAT DATA (Daftar_Siswa untuk info Kelas + Log_Aktivitas)
    // ----------------------------------------
    async function muatDataResume() {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted">Memuat data dari Google Sheets...</td></tr>`;
        if (btnRefresh) {
            btnRefresh.disabled = true;
            btnRefresh.classList.add('is-loading');
        }

        try {
            const [siswaData, logData] = await Promise.all([
                fetchJSON(`${API_URL}?action=getSiswa`),
                fetchJSON(`${API_URL}?action=getResume`)
            ]);

            // schedule list and clock are handled globally on window load

            if (siswaData && siswaData.error) throw new Error(siswaData.error);
            if (logData && logData.error) throw new Error(logData.error);

            // Peta ID_Siswa -> Kelas, dipakai untuk pencarian "nama atau kelas"
            const kelasMap = {};
            (siswaData || []).forEach(s => {
                if (s.ID_Siswa) kelasMap[String(s.ID_Siswa)] = String(s.Kelas || '').trim();
            });

            allResumeData = (logData || [])
                .filter(rec => rec.Nama_Siswa) // buang baris rusak/kosong
                .map(rec => ({
                    ...rec,
                    _Kelas: kelasMap[String(rec.ID_Siswa)] || ''
                }));

            computeAndRenderStats();
            renderClassOptions();
            renderStudentOptions();
            updateObservationSummary(filterSiswa ? filterSiswa.value : '');
            applyFiltersAndRender();

        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted">Gagal memuat data: ${error.message}</td></tr>`;
            tableInfo.textContent = 'Menampilkan 0 data.';
        } finally {
            if (btnRefresh) {
                btnRefresh.disabled = false;
                btnRefresh.classList.remove('is-loading');
            }
        }
    }

    // ----------------------------------------
    // 2. MENGHITUNG KARTU STATISTIK (dari seluruh data, tanpa filter)
    // ----------------------------------------
    function computeAndRenderStats() {
        statTotal.textContent = allResumeData.length;

        let terbaikLari = null; // { ms, value, nama }
        let terbaikPushup = null; // { nilai, value, nama }
        let terbaikSitup = null; // { nilai, value, nama }

        allResumeData.forEach(rec => {
            const hasil = String(rec.Hasil || '');
            const jenis = String(rec.Jenis_Aktivitas || '').toLowerCase();
            const ms = parseTimeToMs(hasil);

            if (ms !== null) {
                if (terbaikLari === null || ms < terbaikLari.ms) {
                    terbaikLari = { ms, value: hasil, nama: rec.Nama_Siswa };
                }
            } else {
                const nilai = parseInt(hasil, 10);
                if (!isNaN(nilai)) {
                    if (jenis.includes('push')) {
                        if (terbaikPushup === null || nilai > terbaikPushup.nilai) {
                            terbaikPushup = { nilai, value: hasil, nama: rec.Nama_Siswa };
                        }
                    } else if (jenis.includes('sit')) {
                        if (terbaikSitup === null || nilai > terbaikSitup.nilai) {
                            terbaikSitup = { nilai, value: hasil, nama: rec.Nama_Siswa };
                        }
                    }
                }
            }
        });

        statBestRunning.textContent = terbaikLari ? formatSpreadsheetValue(terbaikLari.value) : '--:--.--';
        statBestRunningName.textContent = terbaikLari ? terbaikLari.nama : '-';

        statBestPushup.textContent = terbaikPushup ? formatSpreadsheetValue(terbaikPushup.value) : '0';
        statBestPushupName.textContent = terbaikPushup ? terbaikPushup.nama : '-';

        statBestSitup.textContent = terbaikSitup ? formatSpreadsheetValue(terbaikSitup.value) : '0';
        statBestSitupName.textContent = terbaikSitup ? terbaikSitup.nama : '-';
    }

    // ----------------------------------------
    // 3. FILTER + RENDER TABEL
    // ----------------------------------------
    function applyFiltersAndRender() {
        const q = filterSearch.value.trim().toLowerCase();
        const aktivitasFilter = filterAktivitas.value;
        const mingguFilter = filterMinggu.value;
        const semesterFilter = filterSemester.value;
        const pertemuanMap = buildPertemuanNumberMap(allResumeData);

        let filtered = allResumeData.filter(rec => {
            if (q) {
                const gabungan = `${rec.Nama_Siswa || ''} ${rec._Kelas || ''} ${rec.Jenis_Aktivitas || ''}`.toLowerCase();
                if (!gabungan.includes(q)) return false;
            }

            if (filterKelas && filterKelas.value) {
                if (rec._Kelas !== filterKelas.value) return false;
            }

            if (filterSiswa && filterSiswa.value) {
                if (rec.Nama_Siswa !== filterSiswa.value) return false;
            }

            if (aktivitasFilter) {
                const jenis = normalizeActivityName(rec.Jenis_Aktivitas);
                const filterNorm = normalizeActivityName(aktivitasFilter);
                if (!jenis.includes(filterNorm)) return false;
            }

            if (mingguFilter) {
                const nomor = Number(String(mingguFilter).trim());
                if (!Number.isFinite(nomor) || getPertemuanNumber(rec, pertemuanMap) !== nomor) return false;
            }

            if (semesterFilter) {
                if (semesterLabel(rec.Semester) !== semesterFilter) return false;
            }

            return true;
        });

        filtered.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

        updateChart(filtered);
        renderTable(filtered);
    }

    function renderTable(data) {
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted">Tidak ada data yang cocok dengan filter.</td></tr>`;
            tableInfo.textContent = 'Menampilkan 0 data.';
            return;
        }

        tbody.innerHTML = data.map((rec, idx) => {
            const pertemuanKe = getPertemuanNumber(rec, buildPertemuanNumberMap(allResumeData));
            const periode = `Pertemuan ke ${Number.isFinite(pertemuanKe) ? pertemuanKe : (rec.Minggu_Ke || '-')} &middot; ${semesterLabel(rec.Semester)}`;
            const kelasSedang = getCurrentClasses();
            const inClassNow = kelasSedang.includes(rec._Kelas) ? 'Ya' : '';
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${formatTanggal(rec.Timestamp)}</td>
                    <td>${escapeHtml(rec.Nama_Siswa)}</td>
                    <td>${escapeHtml(rec.Jenis_Aktivitas || '-')}</td>
                    <td class="mono-cell">${escapeHtml(formatSpreadsheetValue(rec.Hasil))}</td>
                    <td>${inClassNow}</td>
                    <td>${periode}</td>
                </tr>
            `;
        }).join('');

        tableInfo.textContent = `Menampilkan ${data.length} data.`;
    }

    function exportPdfReport() {
        const kelas = filterKelas ? filterKelas.value : '';
        const minggu = filterMinggu ? filterMinggu.value : '';

        if (!kelas || !minggu) {
            alert('Pilih kelas dan pertemuan terlebih dahulu untuk membuat laporan PDF.');
            return;
        }

        const pertemuanMap = buildPertemuanNumberMap(allResumeData);
        const nomorPertemuan = Number(minggu);
        const reportData = allResumeData
            .filter(rec => rec._Kelas === kelas && getPertemuanNumber(rec, pertemuanMap) === nomorPertemuan)
            .sort((a, b) => {
                const studentOrder = String(a.Nama_Siswa || '').localeCompare(String(b.Nama_Siswa || ''), 'id');
                if (studentOrder !== 0) return studentOrder;
                return String(a.Jenis_Aktivitas || '').localeCompare(String(b.Jenis_Aktivitas || ''), 'id');
            });

        if (reportData.length === 0) {
            alert('Tidak ada aktivitas untuk kelas dan pertemuan yang dipilih.');
            return;
        }

        const reportRows = reportData.map((rec, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(rec.Nama_Siswa || '-')}</td>
                <td>${escapeHtml(rec.Jenis_Aktivitas || '-')}</td>
                <td class="result">${escapeHtml(formatSpreadsheetValue(rec.Hasil))}</td>
                <td>${escapeHtml(formatTanggal(rec.Timestamp))}</td>
                <td>${escapeHtml(semesterLabel(rec.Semester))}</td>
            </tr>
        `).join('');

        const reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            alert('Jendela laporan diblokir browser. Izinkan pop-up untuk mengekspor PDF.');
            return;
        }

        reportWindow.document.write(`<!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Laporan Aktivitas - ${escapeHtml(kelas)} - Pertemuan ${nomorPertemuan}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; color: #1f2937; margin: 32px; font-size: 12px; }
                    h1 { margin: 0 0 6px; font-size: 20px; }
                    .meta { color: #4b5563; margin-bottom: 20px; line-height: 1.6; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #e8f1f8; color: #1f3b53; text-align: left; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
                    td.result { font-weight: 700; }
                    .total { margin-top: 12px; text-align: right; color: #4b5563; }
                    @media print { body { margin: 12mm; } }
                </style>
            </head>
            <body>
                <h1>Laporan Semua Aktivitas Siswa</h1>
                <div class="meta"><strong>Kelas:</strong> ${escapeHtml(kelas)}<br><strong>Pertemuan:</strong> ke-${nomorPertemuan}<br><strong>Dicetak:</strong> ${escapeHtml(getTodayDateLabel())}</div>
                <table>
                    <thead><tr><th>No</th><th>Nama Siswa</th><th>Aktivitas</th><th>Hasil</th><th>Tanggal Rekam</th><th>Semester</th></tr></thead>
                    <tbody>${reportRows}</tbody>
                </table>
                <div class="total">Total catatan: ${reportData.length}</div>
            </body>
            </html>`);
        reportWindow.document.close();
        reportWindow.focus();
        reportWindow.print();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ----------------------------------------
    // 4. EVENT LISTENERS
    // ----------------------------------------
    if (btnRefresh) btnRefresh.addEventListener('click', muatDataResume);
    if (btnExportPdf) btnExportPdf.addEventListener('click', exportPdfReport);
    if (btnClearLocalCache) {
        btnClearLocalCache.addEventListener('click', () => {
            clearLocalAppCache();
            alert('Cache lokal berhasil dihapus. Data akan diambil ulang dari Google Sheets.');
            window.location.reload();
        });
    }
    filterSearch.addEventListener('input', applyFiltersAndRender);
    filterAktivitas.addEventListener('change', applyFiltersAndRender);
    filterMinggu.addEventListener('change', applyFiltersAndRender);
    filterSemester.addEventListener('change', applyFiltersAndRender);

    window.addEventListener('load', muatDataResume);
}

    // Inisialisasi global untuk jadwal & jam ketika dokumen siap
    window.addEventListener('load', async () => {
        try {
            await loadScheduleList();
        } catch (e) {
            // ignore
        }
        updateCurrentTimeAndClass();
        setInterval(updateCurrentTimeAndClass, 1000);
    });
