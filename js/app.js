// ==========================================================
// KONFIGURASI
// ==========================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwhI5kOQnIn56wpq-QiLc3QD9YjTd4Djclj-JApeCASpJJ6kFYQ5Hon3t49KrTso5Qv/exec";

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

async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Server merespons dengan status ${response.status}`);
    }
    return response.json();
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
            const data = await fetchJSON(`${API_URL}?action=getSiswa`);

            if (data && data.error) {
                throw new Error(data.error);
            }

            // Filter data rusak
            allSiswaData = data.filter(siswa => siswa.ID_Siswa && siswa.Nama_Siswa && siswa.Kelas);

            // Ambil daftar kelas yang unik
            const kelasSet = new Set(allSiswaData.map(siswa => String(siswa.Kelas).trim()));
            const kelasList = Array.from(kelasSet).sort();

            // Masukkan ke Dropdown Kelas
            selectKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
            kelasList.forEach(kelas => {
                const option = document.createElement("option");
                option.value = kelas;
                option.textContent = `Kelas ${kelas}`;
                selectKelas.appendChild(option);
            });

        } catch (error) {
            alert("Gagal memuat data: " + error.message);
        }
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
    selectKelas.addEventListener('change', renderStudentList);
    modePencatatan.addEventListener('change', renderStudentList);

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
        const mingguKe = document.getElementById('mingguKe').value;
        const semester = document.getElementById('semester').value;

        if (!jenisAktivitas || !mingguKe || !semester) {
            alert("Harap lengkapi Jenis Aktivitas, Minggu, dan Semester terlebih dahulu!");
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

    const chartModeSelect = document.getElementById('chart-mode');
    const filterSearch = document.getElementById('filter-search');
    const filterAktivitas = document.getElementById('filter-aktivitas');
    const filterMinggu = document.getElementById('filter-minggu');
    const filterSemester = document.getElementById('filter-semester');

    if (chartModeSelect) {
        chartModeSelect.addEventListener('change', applyFiltersAndRender);
    }

    // ----------------------------------------
    // FITUR KURVA GRAFIK (LINE CHART)
    // ----------------------------------------
    function updateChart(data) {
        const ctx = document.getElementById('fitnessChart');
        if (!ctx) return;

        // 1. Kelompokkan data berdasarkan Minggu (1 sampai 16)
        const mingguSet = new Set();
        data.forEach(d => {
            const m = parseInt(d.Minggu_Ke, 10);
            if (!isNaN(m)) mingguSet.add(m);
        });
        const mingguSorted = Array.from(mingguSet).sort((a, b) => a - b);
        const labels = mingguSorted.map(m => `Minggu ${m}`);

        // 2. Tentukan apakah jenis aktivitas dominan bertipe waktu (Lari) atau repetisi
        let isTimeBased = false;
        if (filterAktivitas.value.toLowerCase().includes('lari')) {
            isTimeBased = true;
        } else if (data.length > 0 && String(data[0].Hasil || '').includes(':')) {
            isTimeBased = true;
        }

        // 3. Susun Dataset (Rata-rata atau Per Siswa)
        const modeChart = chartModeSelect ? chartModeSelect.value : 'rata-rata';
        const datasets = [];

        if (modeChart === 'rata-rata') {
            // Hitung rata-rata per minggu dari data terfilter
            const pointInfoData = [];
            const dataPoint = mingguSorted.map(m => {
                const recs = data.filter(d => parseInt(d.Minggu_Ke, 10) === m);
                if (recs.length === 0) {
                    pointInfoData.push({ value: null, display: null });
                    return null;
                }

                const total = recs.reduce((sum, r) => {
                    if (isTimeBased) {
                        const ms = parseTimeToMs(r.Hasil);
                        return sum + (ms !== null ? ms : 0);
                    } else {
                        return sum + (parseInt(r.Hasil, 10) || 0);
                    }
                }, 0);

                const avgValue = recs.length > 0 ? total / recs.length : null;
                const displayValue = recs.find(r => r.Hasil) ? formatSpreadsheetValue(recs.find(r => r.Hasil).Hasil) : null;
                pointInfoData.push({ value: avgValue, display: displayValue });
                return avgValue;
            });

            datasets.push({
                label: isTimeBased ? 'Rata-rata Waktu Lari' : 'Rata-rata Repetisi',
                data: dataPoint,
                pointInfo: pointInfoData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#2c3e50',
                pointRadius: 5
            });
        } else {
            // Mode Individu: Ambil maksimal 5 siswa pertama agar grafik tidak semrawut
            const siswaUnik = [...new Set(data.map(d => d.Nama_Siswa))].slice(0, 5);
            const warnaPalette = ['#3498db', '#27ae60', '#e67e22', '#e74c3c', '#9b59b6'];

            siswaUnik.forEach((nama, idx) => {
                const pointInfoData = [];
                const dataPoint = mingguSorted.map(m => {
                    const rec = data.find(d => d.Nama_Siswa === nama && parseInt(d.Minggu_Ke, 10) === m);
                    if (!rec) {
                        pointInfoData.push({ value: null, display: null });
                        return null;
                    }

                    if (isTimeBased) {
                        const ms = parseTimeToMs(rec.Hasil);
                        pointInfoData.push({ value: ms, display: formatSpreadsheetValue(rec.Hasil) });
                        return ms !== null ? ms : null;
                    } else {
                        pointInfoData.push({ value: parseInt(rec.Hasil, 10) || null, display: formatSpreadsheetValue(rec.Hasil) });
                        return parseInt(rec.Hasil, 10) || null;
                    }
                });

                datasets.push({
                    label: nama,
                    data: dataPoint,
                    pointInfo: pointInfoData,
                    borderColor: warnaPalette[idx % warnaPalette.length],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 4
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
                labels: labels.length > 0 ? labels : ['Minggu 1', 'Minggu 2', 'Minggu 3'],
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
                                let label = context.dataset.label || '';
                                let val = context.parsed.y;
                                const pointInfo = context.dataset.pointInfo?.[context.dataIndex] || null;
                                if (isTimeBased) {
                                    const displayValue = pointInfo && pointInfo.display ? pointInfo.display : formatChartTime(val);
                                    return `${label}: ${displayValue}`;
                                }
                                return `${label}: ${val} Kali`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMin: 0,
                        ticks: {
                            callback: function(value) {
                                if (!isTimeBased) return value;
                                const matchingPoint = datasets.flatMap(ds => ds.pointInfo || []).find(entry => entry && entry.value === value);
                                if (matchingPoint && matchingPoint.display) {
                                    return matchingPoint.display;
                                }
                                return formatChartTime(value);
                            }
                        },
                        title: {
                            display: true,
                            text: isTimeBased ? 'Waktu (MM:SS:mmm) - Lebih Rendah Lebih Baik' : 'Jumlah Repetisi / Kali'
                        }
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

        let filtered = allResumeData.filter(rec => {
            if (q) {
                const gabungan = `${rec.Nama_Siswa || ''} ${rec._Kelas || ''}`.toLowerCase();
                if (!gabungan.includes(q)) return false;
            }

            if (aktivitasFilter) {
                const jenis = String(rec.Jenis_Aktivitas || '').toLowerCase();
                if (!jenis.includes(aktivitasFilter.toLowerCase())) return false;
            }

            if (mingguFilter) {
                const nomor = (mingguFilter.match(/\d+/) || [])[0];
                if (String(rec.Minggu_Ke).trim() !== String(nomor)) return false;
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
            const periode = `Minggu ${rec.Minggu_Ke || '-'} &middot; ${semesterLabel(rec.Semester)}`;
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${formatTanggal(rec.Timestamp)}</td>
                    <td>${escapeHtml(rec.Nama_Siswa)}</td>
                    <td>${escapeHtml(rec.Jenis_Aktivitas || '-')}</td>
                    <td class="mono-cell">${escapeHtml(formatSpreadsheetValue(rec.Hasil))}</td>
                    <td>${periode}</td>
                </tr>
            `;
        }).join('');

        tableInfo.textContent = `Menampilkan ${data.length} data.`;
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
    filterSearch.addEventListener('input', applyFiltersAndRender);
    filterAktivitas.addEventListener('change', applyFiltersAndRender);
    filterMinggu.addEventListener('change', applyFiltersAndRender);
    filterSemester.addEventListener('change', applyFiltersAndRender);

    window.addEventListener('load', muatDataResume);
}
