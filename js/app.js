// Konfigurasi URL Google Apps Script Anda
const API_URL = "https://script.google.com/macros/s/AKfycbzO6o5F7NqsWSdDHu0QdBWcWUC9gqTT8rttuJ80Uc5oW7cUo83dsc0NKIawp_56PWec/exec"; // Pastikan menempelkan URL yang benar

// Variabel Global
let allSiswaData = [];
let recordedData = {}; // Menyimpan catatan waktu tiap ID Siswa
let startTime, timerInterval;
let elapsedTime = 0;
let isRunning = false;

// Elemen DOM
const selectKelas = document.getElementById('selectKelas');
const listSiswaPencatatan = document.getElementById('listSiswaPencatatan');
const pencatatanContainer = document.getElementById('pencatatanContainer');
const stopwatchDisplay = document.getElementById('stopwatchDisplay');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnReset = document.getElementById('btnReset');
const btnKirimKolektif = document.getElementById('btnKirimKolektif');

// ==========================================
// 1. MEMUAT DATA KELAS SAAT APLIKASI DIBUKA
// ==========================================
window.onload = async function() {
    try {
        const response = await fetch(`${API_URL}?action=getSiswa`);
        const data = await response.json();
        
        // Filter data rusak
        allSiswaData = data.filter(siswa => siswa.ID_Siswa && siswa.Nama_Siswa && siswa.Kelas);
        
        // Ambil daftar kelas yang unik menggunakan Set
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
};

// ==========================================
// 2. MENAMPILKAN SISWA BERDASARKAN KELAS
// ==========================================
selectKelas.addEventListener('change', (e) => {
    const kelasTerpilih = e.target.value;
    
    if(!kelasTerpilih) {
        pencatatanContainer.style.display = 'none';
        return;
    }

    recordedData = {}; // Reset memori rekaman sebelumnya
    listSiswaPencatatan.innerHTML = '';
    
    // Filter siswa sesuai kelas
    const siswaDiKelas = allSiswaData.filter(s => String(s.Kelas).trim() === kelasTerpilih);
    
    siswaDiKelas.forEach(siswa => {
        const li = document.createElement('li');
        li.className = 'student-item';

        const info = document.createElement('div');
        info.className = 'student-info';
        info.textContent = siswa.Nama_Siswa;

        const action = document.createElement('div');
        action.className = 'student-action';

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'recorded-time';
        timeDisplay.textContent = '--:--:--';

        const btnCatat = document.createElement('button');
        btnCatat.className = 'btn-catat';
        btnCatat.textContent = 'Catat Waktu';
        
        // Logika saat tombol catat anak ditekan
        btnCatat.onclick = () => {
            if(!isRunning && elapsedTime === 0) {
                alert("Mulai stopwatch terlebih dahulu!");
                return;
            }
            const waktuSaatIni = formatTime(elapsedTime);
            recordedData[siswa.ID_Siswa] = waktuSaatIni; // Simpan di memori
            timeDisplay.textContent = waktuSaatIni; // Tampilkan di layar
            
            // Ubah gaya tombol sebagai penanda sudah dicatat
            btnCatat.textContent = 'Ubah Catatan';
            btnCatat.style.backgroundColor = '#7f8c8d';
        };

        action.appendChild(timeDisplay);
        action.appendChild(btnCatat);
        li.appendChild(info);
        li.appendChild(action);
        listSiswaPencatatan.appendChild(li);
    });

    pencatatanContainer.style.display = 'block';
});

// ==========================================
// 3. LOGIKA STOPWATCH GLOBAL
// ==========================================
function formatTime(ms) {
    let date = new Date(ms);
    let m = String(date.getUTCMinutes()).padStart(2, '0');
    let s = String(date.getUTCSeconds()).padStart(2, '0');
    let msFormat = String(date.getUTCMilliseconds()).padStart(3, '0').slice(0, 2);
    return `${m}:${s}:${msFormat}`;
}

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

// ==========================================
// 4. MENGIRIM DATA KOLEKTIF KE SPREADSHEET
// ==========================================
btnKirimKolektif.addEventListener('click', async () => {
    const kelas = selectKelas.value;
    const jenisAktivitas = document.getElementById('jenisAktivitas').value;
    const mingguKe = document.getElementById('mingguKe').value;
    const semester = document.getElementById('semester').value;

    if(!jenisAktivitas || !mingguKe || !semester) {
        alert("Harap lengkapi Jenis Aktivitas, Minggu, dan Semester terlebih dahulu!");
        return;
    }

    const payload = [];
    const siswaDiKelas = allSiswaData.filter(s => String(s.Kelas).trim() === kelas);

    // Kumpulkan hanya anak-anak yang sudah memiliki catatan waktu
    siswaDiKelas.forEach(siswa => {
        const hasilWaktu = recordedData[siswa.ID_Siswa];
        if(hasilWaktu) {
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

    if(payload.length === 0) {
        alert("Belum ada siswa yang dicatat waktunya di kelas ini!");
        return;
    }

    // Proses pengiriman ke Google Sheets
    try {
        btnKirimKolektif.textContent = 'MENGIRIM DATA...';
        btnKirimKolektif.disabled = true;

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === 'success') {
            alert(`Berhasil mengirim ${payload.length} catatan siswa!`);
            // Reset formulir opsional
            btnReset.click();
            selectKelas.dispatchEvent(new Event('change')); // Segarkan daftar siswa
        } else {
            alert("Terjadi kesalahan: " + result.message);
        }
    } catch (error) {
        alert("Gagal menghubungi server: " + error.message);
    } finally {
        btnKirimKolektif.textContent = 'Kirim Semua Catatan Waktu';
        btnKirimKolektif.disabled = false;
    }
});
