const TABLE_ID = "1-TKbdrgaS0gW7lfnH20Wi8OhlTszzq4CwvlA5tqZUtk";
const SHEET_NAME = "apply";
const RECEIPTS_FOLDER = "1XpiMCwIlNlmHvqjXUWzshdeFC5HBfJS7";
const CHUNKS_FOLDER = "14aDveacWmXw4wGnvl2VeyMUreLJvpImw";

function doGet(e) {
  console.log("doGet called");
  logRequest_(e);
  const action = e && e.parameter && e.parameter.action;
  if (action === "chunk") {
    return saveChunk_(e.parameter);
  }
  if (action === "attach") {
    return attachReceipt_(e.parameter);
  }
  if (hasPayload_(e)) {
    return save_(e);
  }
  Logger.log("doGet: no payload, health check");
  return ContentService.createTextOutput("ERA apply ok");
}

function doPost(e) {
  Logger.log("doPost called");
  logRequest_(e);
  return save_(e);
}

function testWrite() {
  const result = save_({
    parameter: {
      payload: JSON.stringify({
        name: "TEST",
        alias: "",
        city: "Санкт-Петербург",
        dateOfBirth: "1990-01-01",
        category: "Heels",
        level: "Любитель",
        genre: "Classic",
        videoLink: "https://example.com/video",
        experience: "1 год",
        teachingExperience: "",
        vkLink: "https://vk.com/test",
        tgLink: "",
        igLink: "",
        phone: "+79990000000",
        email: "test@example.com"
      })
    }
  });
  Logger.log(result.getContent());
}

function testChunkWrite() {
  const id = "testchunk";
  const result = saveChunk_({
    id: id,
    n: "0",
    t: "1",
    d: "TEST_CHUNK " + new Date().toISOString()
  });
  Logger.log("saveChunk: " + result.getContent());

  const folder = getDriveFolder_(CHUNKS_FOLDER);
  Logger.log("folder: " + folder.getName());
  Logger.log("folderUrl: " + folder.getUrl());

  const files = folder.getFilesByName(chunkName_(id, 0));
  if (!files.hasNext()) {
    throw new Error("Файл чанка не появился в папке " + CHUNKS_FOLDER);
  }
  const file = files.next();
  Logger.log("file: " + file.getName());
  Logger.log("fileUrl: " + file.getUrl());
  Logger.log("fileText: " + file.getBlob().getDataAsString());
}

function testReceiptWrite() {
  const jpeg =
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ADwA/9k=";
  const id = "testrcpt";
  const chunkSize = 80;
  const total = Math.ceil(jpeg.length / chunkSize);

  for (let i = 0; i < total; i++) {
    saveChunk_({
      id: id,
      n: String(i),
      t: String(total),
      d: jpeg.slice(i * chunkSize, (i + 1) * chunkSize)
    });
  }

  const result = save_({
    parameter: {
      payload: JSON.stringify({
        name: "TEST RECEIPT",
        alias: "",
        city: "Санкт-Петербург",
        dateOfBirth: "1990-01-01",
        category: "Heels",
        level: "Любитель",
        genre: "Classic",
        videoLink: "https://example.com/video",
        experience: "1 год",
        teachingExperience: "",
        vkLink: "https://vk.com/test",
        tgLink: "",
        igLink: "",
        phone: "+79990000000",
        email: "test@example.com",
        uploadId: id,
        chunkTotal: total,
        receiptName: "test-receipt.jpg",
        receiptMime: "image/jpeg"
      })
    }
  });
  Logger.log(result.getContent());
}

function hasPayload_(e) {
  return !!(
    (e && e.parameter && (e.parameter.payload || e.parameter.name)) ||
    (e && e.postData && e.postData.contents)
  );
}

function save_(e) {
  try {
    Logger.log("=== save_ start ===");
    logRequest_(e);

    const data = parsePayload_(e);
    Logger.log("parsed keys: " + Object.keys(data).join(", "));
    Logger.log("fields: " + JSON.stringify({
      name: data.name || "",
      alias: data.alias || "",
      city: data.city || "",
      dateOfBirth: data.dateOfBirth || "",
      category: data.category || "",
      level: data.level || "",
      genre: data.genre || "",
      videoLink: data.videoLink || "",
      experience: data.experience || "",
      teachingExperience: data.teachingExperience || "",
      vkLink: data.vkLink || "",
      tgLink: data.tgLink || "",
      igLink: data.igLink || "",
      phone: data.phone || "",
      email: data.email || "",
      tableId: data.tableId || "",
      sheetName: data.sheetName || "",
      receiptName: data.receiptName || "",
      receiptMime: data.receiptMime || "",
      hasReceipt: !!data.receiptBase64,
      receiptLength: data.receiptBase64 ? String(data.receiptBase64).length : 0,
      uploadId: data.uploadId || "",
      chunkTotal: data.chunkTotal || 0
    }));

    const tableId = data.tableId || TABLE_ID;
    const sheetName = data.sheetName || SHEET_NAME;
    Logger.log("open spreadsheet: " + tableId + " / sheet: " + sheetName);

    let paymentUrl = "";
    if (!data.receiptBase64 && data.uploadId) {
      Logger.log("assemble receipt " + data.uploadId + " chunks=" + data.chunkTotal);
      try {
        data.receiptBase64 = assembleReceipt_(data.uploadId, Number(data.chunkTotal || 0));
        Logger.log("assembled length: " + data.receiptBase64.length);
      } catch (err) {
        Logger.log("assemble fail: " + err.message);
        paymentUrl = "чек не собран: " + err.message;
      }
    }

    if (data.receiptBase64) {
      const folder = getDriveFolder_(RECEIPTS_FOLDER);
      const bytes = Utilities.base64Decode(data.receiptBase64);
      const blob = Utilities.newBlob(
        bytes,
        data.receiptMime || "application/octet-stream",
        data.receiptName || ("receipt-" + Date.now())
      );
      const file = folder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {
        Logger.log("setSharing skip: " + err.message);
      }
      paymentUrl = file.getUrl();
      Logger.log("drive file: " + paymentUrl);
      if (data.uploadId) {
        cleanupChunks_(data.uploadId, Number(data.chunkTotal || 0));
      }
    } else {
      Logger.log("receipt missing in row request, skip Drive");
    }

    const ss = SpreadsheetApp.openById(tableId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log("sheet not found, creating: " + sheetName);
      sheet = ss.insertSheet(sheetName);
    }

    Logger.log("sheet lastRow before: " + sheet.getLastRow());

    ensureHeaders_(sheet);
    writeSheetRow_(sheet, {
      "Дата": new Date(),
      "ФИО": data.name || "",
      "Псевдоним": data.alias || "",
      "Город": data.city || "",
      "Дата рождения": data.dateOfBirth || "",
      "Категория": data.category || "",
      "Уровень": data.level || "",
      "Жанр": data.genre || "",
      "Ссылка на видео": data.videoLink || "",
      "Стаж": data.experience || "",
      "Преподавательский стаж": data.teachingExperience || "",
      "VK": data.vkLink || "",
      "Telegram": data.tgLink || "",
      "Instagram": data.igLink || "",
      "Чек": paymentUrl,
      "Телефон": data.phone || "",
      "E-mail": data.email || ""
    });

    Logger.log("sheet lastRow after: " + sheet.getLastRow());
    Logger.log("=== save_ ok ===");

    return ContentService.createTextOutput("ok");
  } catch (err) {
    Logger.log("=== save_ error ===");
    Logger.log(err.message);
    Logger.log(err.stack);
    return ContentService.createTextOutput("error: " + err.message);
  }
}

function logRequest_(e) {
  if (!e) {
    Logger.log("e is empty");
    return;
  }
  Logger.log("parameter keys: " + (e.parameter ? Object.keys(e.parameter).join(", ") : "(none)"));
  if (e.postData) {
    Logger.log("postData.type: " + e.postData.type);
    Logger.log("postData.length: " + (e.postData.contents ? e.postData.contents.length : 0));
    Logger.log("postData.head: " + String(e.postData.contents || "").substring(0, 200));
  } else {
    Logger.log("postData: missing");
  }
}

function parsePayload_(e) {
  let data = {};
  if (e && e.parameter && e.parameter.payload) {
    data = JSON.parse(e.parameter.payload);
  } else if (e && e.parameter && e.parameter.name) {
    data = e.parameter;
  } else {
    const raw = (e && e.postData && e.postData.contents) || "";
    if (!raw) {
      throw new Error("Пустой запрос");
    }
    if (raw.indexOf("payload=") === 0) {
      data = JSON.parse(decodeURIComponent(raw.slice("payload=".length).replace(/\+/g, " ")));
    } else {
      data = JSON.parse(raw);
    }
  }

  const params = (e && e.parameter) || {};
  if (!data.alias && params.alias) data.alias = params.alias;
  if (!data.genre && params.genre) data.genre = params.genre;
  if (!data.teachingExperience && params.teachingExperience) {
    data.teachingExperience = params.teachingExperience;
  }
  if (!data.igLink && params.igLink) data.igLink = params.igLink;
  if (!data.email && params.email) data.email = params.email;
  return data;
}

const SHEET_HEADERS = [
  "Дата",
  "ФИО",
  "Псевдоним",
  "Город",
  "Дата рождения",
  "Категория",
  "Уровень",
  "Жанр",
  "Ссылка на видео",
  "Стаж",
  "Преподавательский стаж",
  "VK",
  "Telegram",
  "Instagram",
  "Чек",
  "Телефон",
  "E-mail"
];

function headerIndex_(headers, name) {
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim() === name) return i;
  }
  return -1;
}

function readHeaders_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (value) {
    return String(value || "").trim();
  });
}

function insertHeaderAfter_(sheet, afterName, newName) {
  let headers = readHeaders_(sheet);
  if (headerIndex_(headers, newName) !== -1) return;
  const after = headerIndex_(headers, afterName);
  const col = after === -1 ? headers.length + 1 : after + 2;
  if (col <= sheet.getLastColumn()) {
    sheet.insertColumnBefore(col);
  }
  sheet.getRange(1, col).setValue(newName);
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    SpreadsheetApp.flush();
    return;
  }
  insertHeaderAfter_(sheet, "ФИО", "Псевдоним");
  insertHeaderAfter_(sheet, "Уровень", "Жанр");
  insertHeaderAfter_(sheet, "Стаж", "Преподавательский стаж");
  insertHeaderAfter_(sheet, "Telegram", "Instagram");
  insertHeaderAfter_(sheet, "Телефон", "E-mail");
  SHEET_HEADERS.forEach(function (name) {
    const headers = readHeaders_(sheet);
    if (headerIndex_(headers, name) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(name);
    }
  });
  SpreadsheetApp.flush();
}

function cellValue_(values, key) {
  const value = values[key];
  return value === undefined || value === null ? "" : value;
}

function writeSheetRow_(sheet, values) {
  const headers = readHeaders_(sheet);
  const row = headers.map(function (header) {
    return header ? cellValue_(values, header) : "";
  });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  const rowNumber = sheet.getLastRow();
  ["Псевдоним", "Жанр", "Преподавательский стаж", "Instagram", "E-mail"].forEach(function (name) {
    const index = headerIndex_(headers, name);
    if (index !== -1) {
      sheet.getRange(rowNumber, index + 1).setValue(cellValue_(values, name));
    }
  });
}

function saveChunk_(p) {
  const id = String(p.id || "");
  const n = String(p.n || "0");
  const total = String(p.t || "0");
  const data = String(p.d || "");
  Logger.log("chunk " + n + "/" + total + " id=" + id + " len=" + data.length);
  if (!id) {
    return ContentService.createTextOutput("chunk-error");
  }
  const folder = getDriveFolder_(CHUNKS_FOLDER);
  const name = chunkName_(id, n);
  trashFilesByName_(folder, name);
  folder.createFile(name, data, MimeType.PLAIN_TEXT);
  return ContentService.createTextOutput("chunk-ok");
}

function assembleReceipt_(id, total) {
  const folder = getDriveFolder_(CHUNKS_FOLDER);
  const parts = [];
  for (let i = 0; i < total; i++) {
    const files = folder.getFilesByName(chunkName_(id, i));
    if (!files.hasNext()) {
      throw new Error("Нет куска чека " + i + " из " + total);
    }
    parts.push(files.next().getBlob().getDataAsString());
  }
  return parts.join("");
}

function cleanupChunks_(id, total) {
  const folder = getDriveFolder_(CHUNKS_FOLDER);
  for (let i = 0; i < total; i++) {
    trashFilesByName_(folder, chunkName_(id, i));
  }
}

function chunkName_(id, n) {
  return "era_" + id + "_" + n + ".part";
}

function trashFilesByName_(folder, name) {
  const files = folder.getFilesByName(name);
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }
}

function attachReceipt_(p) {
  try {
    const data = JSON.parse(p.payload || "{}");
    Logger.log("attach start " + JSON.stringify({
      uploadId: data.uploadId,
      chunkTotal: data.chunkTotal,
      name: data.name,
      phone: data.phone
    }));
    const base64 = assembleReceipt_(data.uploadId, Number(data.chunkTotal || 0));
    const folder = getDriveFolder_(RECEIPTS_FOLDER);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      data.receiptMime || "application/octet-stream",
      data.receiptName || ("receipt-" + Date.now())
    );
    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) {}
    const paymentUrl = file.getUrl();
    Logger.log("attach drive file: " + paymentUrl);

    const ss = SpreadsheetApp.openById(TABLE_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    const last = sheet.getLastRow();
    if (last > 1) {
      sheet.getRange(last, 11).setValue(paymentUrl);
    }
    return ContentService.createTextOutput("attach-ok");
  } catch (err) {
    Logger.log("attach error: " + err.message);
    return ContentService.createTextOutput("attach-error: " + err.message);
  }
}

function getDriveFolder_(folderId) {
  try {
    return DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error("Нет доступа к папке для загрузки чеков: " + e.message);
  }
}

function testDrive() {
  const folder = DriveApp.getFolderById(CHUNKS_FOLDER);
  Logger.log(folder.getName());
}
