/**
 * FitTrack Digital - Client Side JavaScript
 * Logika stopwatch, counter, dan koneksi API GAS.
 */

// URL Aplikasi Web Google Apps Script hasil Deployment
// PASTIKAN Anda mengisi URL ini setelah mendeploy Code.gs di Apps Script
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzO6o5F7NqsWSdDHu0QdBWcWUC9gqTT8rttuJ80Uc5oW7cUo83dsc0NKIawp_56PWec/exec";

// data cadangan lokal jika API belum dideploy, agar web langsung interaktif
const DEFAULT_SISWA = [
    { ID_Siswa: "S001", Nama_Siswa: "Ahmad Fauzi", Kelas: "VIII A" },
    { ID_Siswa: "S002", Nama_Siswa: "Budi Santoso", Kelas: "VIII A" },
    { ID_Siswa: "S003", Nama_Siswa: "Citra Lestari", Kelas: "VIII B" },
    { ID_Siswa: "S004", Nama_Siswa: "Dewi Kartika", Kelas: "VIII B" },
    { ID_Siswa: "S005", Nama_Siswa: "Eko Prasetyo", Kelas: "IX A" },
    { ID_Siswa: "S006", Nama_Siswa: "Farhan Mahendra", Kelas: "IX B" },
    { ID_Siswa: "S007", Nama_Siswa: "Gita Amanda", Kelas: "VII A" }
];

const DEFAULT_LOGS = [
    { Timestamp: "2026-07-15T08:30:00.000Z", ID_Siswa: "S001", Nama_Siswa: "Ahmad Fauzi", Jenis_Aktivitas: "Lari", Hasil: "01:45.20", Minggu_Ke: "Minggu 1", Semester: "Ganjil" },
    { Timestamp: "2026-07-15T08:35:00.000Z", ID_Siswa: "S002", Nama_Siswa: "Budi Santoso", Jenis_Aktivitas: "Push Up", Hasil: "42", Minggu_Ke: "Minggu 1", Semester: "Ganjil" },
    { Timestamp: "2026-07-15T08:40:00.000Z", ID_Siswa: "S003", Nama_Siswa: "Citra Lestari", Jenis_Aktivitas: "Sit Up", Hasil: "35", Minggu_Ke: "Minggu 1", Semester: "Ganjil" },
    { Timestamp: "2026-07-16T09:12:00.000Z", ID_Siswa: "S004", Nama_Siswa: "Dewi Kartika", Jenis_Aktivitas: "Lari", Hasil: "02:10.15", Minggu_Ke: "Minggu 1", Semester: "Ganjil" },
    { Timestamp: "2026-07-16T09:20:00.000Z", ID_Siswa: "S005", Nama_Siswa: "Eko Prasetyo", Jenis_Aktivitas: "Push Up", Hasil: "50", Minggu_Ke: "Minggu 1", Semester: "Ganjil" }
];

// Memory state aplikasi
let siswaList = [];
let logsList = [];

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
    
    // CEK HALAMAN AKTIF
    const isIndexPage = document.getElementById("exercise-form") !== null;
    const isResumePage = document.getElementById("resume-table") !== null;

    if (isIndexPage) {
        initIndexPage();
    }
    
    if (isResumePage) {
        initResumePage();
    }
});

/* ==========================================================================
   1. HALAMAN UTAMA (INDEX.HTML) - LOGIKA RECORDING, STOPWATCH, & COUNTER
   ========================================================================== */
function initIndexPage() {
    const form = document.getElementById("exercise-form");
    const selectSiswa = document.getElementById("select-siswa");
    const radioAktivitas = document.getElementsByName("aktivitas");
    const finalResultDisplay = document.getElementById("final-result-display");
    const finalResultInput = document.getElementById("final-result-input");
    const statusMsg = document.getElementById("status-msg");
    const btnSubmit = document.getElementById("btn-submit");
    const submitSpinner = document.getElementById("submit-spinner");
    const submitText = document.getElementById("submit-text");

    // Stopwatch Elements
    const panelStopwatch = document.getElementById("panel-stopwatch");
    const stopwatchDisplay = document.getElementById("stopwatch-display");
    const btnSwStart = document.getElementById("btn-sw-start");
    const btnSwPause = document.getElementById("btn-sw-pause");
    const btnSwReset = document.getElementById("btn-sw-reset");
    const btnSwRecord = document.getElementById("btn-sw-record");

    // Counter Elements
    const panelCounter = document.getElementById("panel-counter");
    const counterTitle = document.getElementById("counter-title");
    const counterDisplay = document.getElementById("counter-display");
    const btnCntMinus = document.getElementById("btn-cnt-minus");
    const btnCntPlus = document.getElementById("btn-cnt-plus");
    const btnCntReset = document.getElementById("btn-cnt-reset");
    const btnCntRecord = document.getElementById("btn-cnt-record");

    // Stopwatch Variables
    let startTime = 0;
    let elapsedTime = 0;
    let timerInterval = null;
    let isTimerRunning = false;

    // Counter Variables
    let counterValue = 0;

    // A. LOAD DAFTAR SISWA (Mendukung Realtime GAS atau Lokal Fallback)
    function loadSiswa() {
        if (!GAS_API_URL || GAS_API_URL.includes("SILAKAN_TEMPEL")) {
            console.log("Menggunakan data siswa default lokal (API belum diatur).");
            siswaList = DEFAULT_SISWA;
            populateSiswaDropdown(siswaList);
            return;
        }

        fetch(`${GAS_API_URL}?action=getSiswa`)
            .then(response => {
                if (!response.ok) throw new Error("Koneksi bermasalah.");
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                siswaList = data;
                populateSiswaDropdown(siswaList);
            })
            .catch(error => {
                console.error("Gagal memuat siswa dari GAS API:", error);
                showStatus("Gagal memuat dari awan, menggunakan database siswa lokal sementara.", "error");
                siswaList = DEFAULT_SISWA;
                populateSiswaDropdown(siswaList);
            });
    }

    function populateSiswaDropdown(list) {
        selectSiswa.innerHTML = '<option value="">-- Pilih Nama Siswa --</option>';
        
        // OPTIMASI: Saring data, buang baris yang tidak memiliki Nama atau ID valid
        const validList = list.filter(siswa => siswa.ID_Siswa && siswa.Nama_Siswa);
        
        validList.forEach(siswa => {
            const option = document.createElement("option");
            option.value = siswa.ID_Siswa;
            option.dataset.nama = siswa.Nama_Siswa;
            option.textContent = `${siswa.Nama_Siswa} (${siswa.Kelas || "-"})`;
            selectSiswa.appendChild(option);
        });
    }

    // B. SWITCH PANEL AKTIVITAS (Stopwatch vs Counter)
    radioAktivitas.forEach(radio => {
        radio.addEventListener("change", (e) => {
            const val = e.target.value;
            if (val === "Lari") {
                panelStopwatch.classList.remove("hidden");
                panelCounter.classList.add("hidden");
                updateFinalDisplay(stopwatchDisplay.textContent);
            } else {
                panelStopwatch.classList.add("hidden");
                panelCounter.classList.remove("hidden");
                counterTitle.textContent = `Counter ${val}`;
                updateFinalDisplay(counterValue.toString());
            }
        });
    });

    function updateFinalDisplay(val) {
        finalResultDisplay.textContent = val;
        finalResultInput.value = val;
    }

    // C. LOGIKA STOPWATCH (LARI)
    function formatTime(ms) {
        let totalSeconds = Math.floor(ms / 1000);
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;
        let centiseconds = Math.floor((ms % 1000) / 10);

        let mStr = minutes.toString().padStart(2, "0");
        let sStr = seconds.toString().padStart(2, "0");
        let cStr = centiseconds.toString().padStart(2, "0");

        return `${mStr}:${sStr}.${cStr}`;
    }

    function swStart() {
        if (!isTimerRunning) {
            isTimerRunning = true;
            startTime = Date.now() - elapsedTime;
            timerInterval = setInterval(() => {
                elapsedTime = Date.now() - startTime;
                stopwatchDisplay.textContent = formatTime(elapsedTime);
            }, 10);
            btnSwStart.disabled = true;
            btnSwPause.disabled = false;
        }
    }

    function swPause() {
        if (isTimerRunning) {
            isTimerRunning = false;
            clearInterval(timerInterval);
            btnSwStart.disabled = false;
            btnSwPause.disabled = true;
        }
    }

    function swReset() {
        isTimerRunning = false;
        clearInterval(timerInterval);
        elapsedTime = 0;
        stopwatchDisplay.textContent = "00:00.00";
        btnSwStart.disabled = false;
        btnSwPause.disabled = true;
    }

    btnSwStart.addEventListener("click", swStart);
    btnSwPause.addEventListener("click", swPause);
    btnSwReset.addEventListener("click", swReset);

    btnSwRecord.addEventListener("click", () => {
        swPause();
        updateFinalDisplay(stopwatchDisplay.textContent);
        showStatus("Hasil waktu lari tersalin ke formulir!", "success");
    });

    // D. LOGIKA COUNTER (PUSH UP / SIT UP)
    function updateCounterDisplay() {
        counterDisplay.textContent = counterValue;
    }

    btnCntPlus.addEventListener("click", () => {
        counterValue++;
        updateCounterDisplay();
    });

    btnCntMinus.addEventListener("click", () => {
        if (counterValue > 0) {
            counterValue--;
            updateCounterDisplay();
        }
    });

    btnCntReset.addEventListener("click", () => {
        counterValue = 0;
        updateCounterDisplay();
    });

    btnCntRecord.addEventListener("click", () => {
        updateFinalDisplay(counterValue.toString());
        showStatus(`Jumlah repetisi (${counterValue}) tersalin ke formulir!`, "success");
    });

    // E. STATUS MESSAGE TRIGGER
    function showStatus(text, type) {
        statusMsg.textContent = text;
        statusMsg.className = "status-message " + (type === "success" ? "status-success" : "status-error");
        setTimeout(() => {
            statusMsg.textContent = "";
        }, 6000);
    }

    // F. SUBMIT DATA KE DATABASE (GOOGLE SHEETS)
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const selectedOption = selectSiswa.options[selectSiswa.selectedIndex];
        const idSiswa = selectSiswa.value;
        const namaSiswa = selectedOption.dataset.nama || "";
        const jenisAktivitas = document.querySelector('input[name="aktivitas"]:checked').value;
        const hasil = finalResultInput.value;
        const mingguKe = document.getElementById("select-minggu").value;
        const semester = document.getElementById("select-semester").value;

        if (!idSiswa) {
            showStatus("Pilih nama siswa terlebih dahulu!", "error");
            return;
        }

        if (!hasil || hasil === "00:00.00" || hasil === "0") {
            showStatus("Hasil belum dicatat! Jalankan stopwatch atau counter dulu dan rekam nilainya.", "error");
            return;
        }

        const payload = { idSiswa, namaSiswa, jenisAktivitas, hasil, mingguKe, semester };

        // Set state loading
        btnSubmit.disabled = true;
        submitSpinner.classList.remove("hidden");
        submitText.textContent = "Mengirim...";

        if (!GAS_API_URL || GAS_API_URL.includes("SILAKAN_TEMPEL")) {
            // Simulasi lokal jika belum dideploy
            setTimeout(() => {
                console.log("Berhasil simulasi simpan lokal: ", payload);
                showStatus("Simulasi Berhasil! (Data tidak benar-benar terkirim karena URL API GAS belum diisi)", "success");
                resetForm();
            }, 1000);
            return;
        }

        // POST request ke Google Apps Script Web App
        fetch(GAS_API_URL, {
            method: "POST",
            mode: "no-cors", // Penting untuk bypass beberapa kebijakan browser GAS
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        .then(() => {
            // Karena no-cors, response akan opaque (kosong), tapi status biasanya sukses terkirim
            showStatus("Berhasil! Data telah dikirim ke Google Sheets.", "success");
            resetForm();
        })
        .catch(err => {
            console.error(err);
            showStatus("Terjadi kesalahan pengiriman. Periksa koneksi internet.", "error");
        })
        .finally(() => {
            btnSubmit.disabled = false;
            submitSpinner.classList.add("hidden");
            submitText.textContent = "Kirim ke Google Sheets";
        });
    });

    function resetForm() {
        selectSiswa.value = "";
        swReset();
        counterValue = 0;
        updateCounterDisplay();
        updateFinalDisplay(document.querySelector('input[name="aktivitas"]:checked').value === "Lari" ? "00:00.00" : "0");
    }

    // Jalankan inisialisasi awal
    loadSiswa();
}

/* ==========================================================================
   2. HALAMAN RESUME (RESUME.HTML) - LOGIKA FETCHING, FILTERING, & SUMMARY
   ========================================================================== */
function initResumePage() {
    const tableBody = document.getElementById("resume-table-body");
    const btnRefresh = document.getElementById("btn-refresh-data");
    const tableInfo = document.getElementById("table-entries-info");

    // Filter Elements
    const filterSearch = document.getElementById("filter-search");
    const filterAktivitas = document.getElementById("filter-aktivitas");
    const filterMinggu = document.getElementById("filter-minggu");
    const filterSemester = document.getElementById("filter-semester");

    // Stats Card DOM Elements
    const statTotalRecords = document.getElementById("stat-total-records");
    const statBestRunning = document.getElementById("stat-best-running");
    const statBestRunningName = document.getElementById("stat-best-running-name");
    const statBestPushup = document.getElementById("stat-best-pushup");
    const statBestPushupName = document.getElementById("stat-best-pushup-name");
    const statBestSitup = document.getElementById("stat-best-situp");
    const statBestSitupName = document.getElementById("stat-best-situp-name");

    // A. FETCHING DATA RESUME DARI GOOGLE SHEETS
    function loadResumeData() {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-muted">Memuat data secara realtime dari spreadsheet...</td></tr>';
        
        if (!GAS_API_URL || GAS_API_URL.includes("SILAKAN_TEMPEL")) {
            console.log("Menggunakan database log latihan default lokal (API belum diatur).");
            logsList = DEFAULT_LOGS;
            renderTable(logsList);
            calculateStats(logsList);
            return;
        }

        fetch(`${GAS_API_URL}?action=getResume`)
            .then(response => {
                if (!response.ok) throw new Error("Gagal mengunduh log.");
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                logsList = data;
                renderTable(logsList);
                calculateStats(logsList);
            })
            .catch(error => {
                console.error("Gagal sinkronisasi data:", error);
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 status-error">Gagal menyinkronkan dengan Google Sheets. Menampilkan rekap lokal.</td></tr>';
                logsList = DEFAULT_LOGS;
                renderTable(logsList);
                calculateStats(logsList);
            });
    }

    // B. RENDER TABEL LOG
    function renderTable(list) {
        tableBody.innerHTML = "";

        if (list.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-muted">Belum ada latihan yang tercatat.</td></tr>';
            tableInfo.textContent = "Menampilkan 0 data.";
            return;
        }

        // Susun urutan terbalik dari yang terbaru agar praktis dibaca (descending order)
        const reversedList = [...list].reverse();

        reversedList.forEach((log, index) => {
            const tr = document.createElement("tr");

            // Format Tanggal
            let formattedDate = "-";
            if (log.Timestamp) {
                const dateObj = new Date(log.Timestamp);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                }
            }

            // Jenis Badge Aktivitas
            let badgeClass = "badge-lari";
            if (log.Jenis_Aktivitas === "Push Up") badgeClass = "badge-pushup";
            if (log.Jenis_Aktivitas === "Sit Up") badgeClass = "badge-situp";

            tr.innerHTML = `
                <td>${reversedList.length - index}</td>
                <td>${formattedDate}</td>
                <td><strong>${log.Nama_Siswa || "-"}</strong></td>
                <td><span class="badge ${badgeClass}">${log.Jenis_Aktivitas || "-"}</span></td>
                <td><strong>${log.Hasil || "-"}</strong>${log.Jenis_Aktivitas === "Lari" ? "" : " Repetisi"}</td>
                <td>${log.Minggu_Ke || "-"} / Smst ${log.Semester || "-"}</td>
            `;
            tableBody.appendChild(tr);
        });

        tableInfo.textContent = `Menampilkan ${list.length} catatan latihan.`;
    }

    // C. HITUNG STATISTIK UTAMA (REKOR TERBAIK)
    function calculateStats(list) {
        statTotalRecords.textContent = list.length;

        // Reset
        let bestRunTime = Infinity; // Cari yang terkecil (tercepat)
        let bestRunName = "-";
        let bestPush = 0; // Cari yang terbesar
        let bestPushName = "-";
        let bestSit = 0; // Cari yang terbesar
        let bestSitName = "-";

        // Konversi string "MM:SS.CC" ke milidetik untuk perbandingan stopwatch
        function runningTimeToMs(timeStr) {
            if (!timeStr || !timeStr.includes(":")) return Infinity;
            try {
                const parts = timeStr.split(":");
                const minutes = parseInt(parts[0], 10);
                const secondsParts = parts[1].split(".");
                const seconds = parseInt(secondsParts[0], 10);
                const centiseconds = parseInt(secondsParts[1], 10);
                return (minutes * 60 * 1000) + (seconds * 1000) + (centiseconds * 10);
            } catch (e) {
                return Infinity;
            }
        }

        list.forEach(log => {
            if (log.Jenis_Aktivitas === "Lari") {
                const ms = runningTimeToMs(log.Hasil);
                if (ms < bestRunTime) {
                    bestRunTime = ms;
                    bestRunName = `${log.Nama_Siswa} (${log.Hasil})`;
                }
            } else if (log.Jenis_Aktivitas === "Push Up") {
                const count = parseInt(log.Hasil, 10) || 0;
                if (count > bestPush) {
                    bestPush = count;
                    bestPushName = log.Nama_Siswa;
                }
            } else if (log.Jenis_Aktivitas === "Sit Up") {
                const count = parseInt(log.Hasil, 10) || 0;
                if (count > bestSit) {
                    bestSit = count;
                    bestSitName = log.Nama_Siswa;
                }
            }
        });

        // Set values ke UI
        statBestRunning.textContent = bestRunTime === Infinity ? "--:--.--" : formatMsToDisplay(bestRunTime);
        statBestRunningName.textContent = bestRunName;

        statBestPushup.textContent = bestPush === 0 ? "0" : `${bestPush}x`;
        statBestPushupName.textContent = bestPushName;

        statBestSitup.textContent = bestSit === 0 ? "0" : `${bestSit}x`;
        statBestSitupName.textContent = bestSitName;
    }

    function formatMsToDisplay(ms) {
        let totalSeconds = Math.floor(ms / 1000);
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;
        let centiseconds = Math.floor((ms % 1000) / 10);

        let mStr = minutes.toString().padStart(2, "0");
        let sStr = seconds.toString().padStart(2, "0");
        let cStr = centiseconds.toString().padStart(2, "0");

        return `${mStr}:${sStr}.${cStr}`;
    }

    // D. LOGIKA FILTER & PENCARIAN REALTIME
    function filterLogs() {
        const query = filterSearch.value.toLowerCase().trim();
        const act = filterAktivitas.value;
        const wk = filterMinggu.value;
        const sem = filterSemester.value;

        const filtered = logsList.filter(log => {
            const matchName = !query || 
                             (log.Nama_Siswa && log.Nama_Siswa.toLowerCase().includes(query)) ||
                             (log.ID_Siswa && log.ID_Siswa.toLowerCase().includes(query));
            const matchAct = !act || log.Jenis_Aktivitas === act;
            const matchWk = !wk || log.Minggu_Ke === wk;
            const matchSem = !sem || log.Semester === sem;

            return matchName && matchAct && matchWk && matchSem;
        });

        renderTable(filtered);
    }

    // Event listeners untuk input filter
    filterSearch.addEventListener("input", filterLogs);
    filterAktivitas.addEventListener("change", filterLogs);
    filterMinggu.addEventListener("change", filterLogs);
    filterSemester.addEventListener("change", filterLogs);

    // Refresh button
    btnRefresh.addEventListener("click", () => {
        loadResumeData();
    });

    // Inisialisasi data
    loadResumeData();
}
