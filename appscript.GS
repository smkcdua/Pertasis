const SPREADSHEET_ID = "1Pjk81tRzMuurglFL_yUzzS6GcTwuOXP-Kon_GPpH2Vo"; // Pastikan ID ini benar

function doGet(e) {
  const action = e.parameter.action;
  let result;
  
  try {
    if (action === "getSiswa") {
      result = getSheetData("Daftar_Siswa");
    } else if (action === "getResume") {
      result = getSheetData("Log_Aktivitas");
    } else if (action === "getDaftarKelas" || action === "getDaftar_kelas") {
      result = getSheetData("Daftar_kelas", { allowAny: true });
    } else {
      result = { error: "Aksi tidak dikenal!" };
    }
  } catch (error) {
    result = { error: error.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// Fungsi super-optimasi (kebal error, buang spasi, abaikan baris kosong)
function getSheetData(sheetName, options) {
  options = options || {};
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return { error: `Sheet '${sheetName}' tidak ditemukan.` };
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const rawHeaders = data[0].map(h => String(h).trim());
  const headers = rawHeaders.map(header => normalizeHeader(header));
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every(cell => cell === "")) continue;
    
    let rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (!header) continue;
      rowObj[header] = row[j];
    }
    // Untuk sheet khusus (mis. Daftar_kelas) kita izinkan semua baris jika opsi allowAny true
    if (options.allowAny || rowObj.Timestamp || rowObj.ID_Siswa || rowObj.Nama_Siswa || rowObj.Jenis_Aktivitas || rowObj.Hasil) {
      rows.push(rowObj);
    }
  }
  
  return rows;
}

function normalizeHeader(header) {
  const normalized = String(header || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

  if (normalized === 'timestamp') return 'Timestamp';
  if (normalized === 'idsiswa' || normalized === 'ids' || normalized === 'idsiswaid') return 'ID_Siswa';
  if (normalized === 'namasiswa' || normalized === 'nama' || normalized === 'namasiswa') return 'Nama_Siswa';
  if (normalized === 'jenisaktivitas' || normalized === 'jenisaktivitaskegiatankegiatan' || normalized === 'jeniskegiatan') return 'Jenis_Aktivitas';
  if (normalized === 'hasil') return 'Hasil';
  if (normalized === 'mingguke' || normalized === 'minggu' || normalized === 'mingguke1') return 'Minggu_Ke';
  if (normalized === 'semester') return 'Semester';
  if (normalized === 'jeniskelamin' || normalized === 'gender' || normalized === 'jk') return 'Jenis_Kelamin';

  if (normalized === 'idkelas' || normalized === 'id_kelas') return 'ID_kelas';
  if (normalized === 'namakelas' || normalized === 'nama_kelas') return 'Nama_kelas';
  if (normalized === 'jam' || normalized === 'time') return 'Jam';
  if (normalized === 'hari') return 'Hari';

  return header;
}

// Menangani POST (Simpan Data Kolektif atau Satuan)
function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let result;

  try {
    const params = JSON.parse(e.postData.contents);

    // ------------------------------------------------------------
    // RUTE BARU: penyimpanan nilai dari catat_nilai.html
    // Dikenali lewat params.action === "submitNilai" supaya TIDAK
    // menabrak alur lama (jasmani.html tidak pernah mengirim field
    // "action", jadi payload lama tetap jatuh ke rute Log_Aktivitas)
    // ------------------------------------------------------------
    const urlAction = String((e.parameter && e.parameter.action) || '').trim().toLowerCase();
    const bodyAction = !Array.isArray(params) ? String(params.action || '').trim().toLowerCase() : '';
    const isNilaiSubmission = !Array.isArray(params) && (
      urlAction === "submitnilai" ||
      bodyAction === "submitnilai" ||
      Array.isArray(params.records)
    );

    if (isNilaiSubmission) {
      result = simpanCatatNilai(ss, params);
    } else {
      // ------------------------------------------------------------
      // RUTE LAMA: log latihan dari jasmani.html — TIDAK DIUBAH
      // ------------------------------------------------------------
      let logSheet = ss.getSheetByName("Log_Aktivitas");
      if (!logSheet) {
        logSheet = ss.insertSheet("Log_Aktivitas");
        logSheet.appendRow(["Timestamp", "ID_Siswa", "Nama_Siswa", "Jenis_Aktivitas", "Hasil", "Minggu_Ke", "Semester"]);
      }

      const timestamp = new Date().toISOString();

      if (Array.isArray(params)) {
        params.forEach(data => {
          logSheet.appendRow([
            timestamp,
            data.idSiswa || "",
            data.namaSiswa || "",
            data.jenisAktivitas || "",
            data.hasil || "",
            data.mingguKe || "",
            data.semester || ""
          ]);
        });
      } else {
        logSheet.appendRow([
          timestamp,
          params.idSiswa || "",
          params.namaSiswa || "",
          params.jenisAktivitas || "",
          params.hasil || "",
          params.mingguKe || "",
          params.semester || ""
        ]);
      }

      result = { status: "success", message: "Data berhasil disimpan!" };
    }
  } catch (error) {
    result = { status: "error", message: error.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// Simpan nilai kolektif ke sheet "Catat_Nilai"
// Payload dari nilai.html:
// {
//   action: 'submitNilai', kelas, semester, mingguKe, mode, jenisAktivitas,
//   records: [{ nis, nama, nilai, predikat }, ...]
// }
// ------------------------------------------------------------
function simpanCatatNilai(ss, params) {
  let sheet = ss.getSheetByName("Catat_Nilai");
  const legacySheet = ss.getSheetByName("catat_nilai");
  if (!sheet && legacySheet) {
    legacySheet.setName("Catat_Nilai");
    sheet = legacySheet;
  }

  if (!sheet) {
    sheet = ss.insertSheet("Catat_Nilai");
    sheet.appendRow([
      "Timestamp", "Kelas", "Semester", "Minggu_Ke", "Mode_Pencatatan",
      "Jenis_Aktivitas", "ID_Siswa", "Nama_Siswa", "Nilai", "Predikat", "Keterangan"
    ]);
    sheet.setFrozenRows(1);
  }

  const timestamp = new Date().toISOString();
  const records = params.records || [];

  records.forEach(r => {
    sheet.appendRow([
      timestamp,
      params.kelas || "",
      params.semester || "",
      params.mingguKe || "",
      params.mode || "",
      params.jenisAktivitas || "",
      r.nis || r.idSiswa || "",
      r.nama || r.namaSiswa || "",
      r.nilai !== undefined && r.nilai !== null ? r.nilai : "",
      r.predikat || "",
      r.keterangan || ""
    ]);
  });

  return {
    status: "success",
    sheet: "Catat_Nilai",
    message: records.length + " baris nilai tersimpan di sheet Catat_Nilai."
  };
}