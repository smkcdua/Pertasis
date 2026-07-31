const SPREADSHEET_ID = "1Pjk81tRzMuurglFL_yUzzS6GcTwuOXP-Kon_GPpH2Vo"; // Pastikan ID ini benar

function doGet(e) {
  const action = e.parameter.action;
  let result;
  
  try {
    if (action === "getSiswa") {
      result = getSheetData("Daftar_Siswa");
    } else if (action === "getResume") {
      result = getSheetData("Log_Aktivitas");
    } else {
      result = { error: "Aksi tidak dikenal!" };
    }
  } catch (error) {
    result = { error: error.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// Fungsi super-optimasi (kebal error, buang spasi, abaikan baris kosong)
function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return { error: `Sheet '${sheetName}' tidak ditemukan.` };
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim());
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every(cell => cell === "")) continue;
    
    let rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = row[j];
    }
    rows.push(rowObj);
  }
  
  return rows;
}

// Menangani POST (Simpan Data Kolektif atau Satuan)
function doPost(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let result;
  
  try {
    let logSheet = sheet.getSheetByName("Log_Aktivitas");
    if (!logSheet) {
      logSheet = sheet.insertSheet("Log_Aktivitas");
      logSheet.appendRow(["Timestamp", "ID_Siswa", "Nama_Siswa", "Jenis_Aktivitas", "Hasil", "Minggu_Ke", "Semester"]);
    }
    
    const params = JSON.parse(e.postData.contents);
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
  } catch (error) {
    result = { status: "error", message: error.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}