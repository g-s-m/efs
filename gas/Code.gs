const TABLE_ID = "17MZ9t_IEDaeqV6GSRb8Kbk1VXnpEGtX3EidkBkdxpZM";
const SHEET_NAME = "apply";
const RECEIPTS_FOLDER = "1VKPS2u7AeWXR4pGTTV4BuLdudIbDcbDM";
const CHUNKS_FOLDER = "1yAvHCdn_8Y8oErg38cl-_a9vE9Pghyc8";

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
        city: "Санкт-Петербург",
        dateOfBirth: "1990-01-01",
        category: "Heels",
        videoLink: "https://example.com/video",
        experience: "1 год",
        level: "Любитель",
        vkLink: "https://vk.com/test",
        tgLink: "",
        phone: "+79990000000"
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
        city: "Санкт-Петербург",
        dateOfBirth: "1990-01-01",
        category: "Heels",
        videoLink: "https://example.com/video",
        experience: "1 год",
        level: "Любитель",
        vkLink: "https://vk.com/test",
        tgLink: "",
        phone: "+79990000000",
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
      city: data.city || "",
      dateOfBirth: data.dateOfBirth || "",
      category: data.category || "",
      videoLink: data.videoLink || "",
      experience: data.experience || "",
      level: data.level || "",
      vkLink: data.vkLink || "",
      tgLink: data.tgLink || "",
      phone: data.phone || "",
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

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Дата",
        "ФИО",
        "Город",
        "Дата рождения",
        "Категория",
        "Ссылка на видео",
        "Стаж",
        "Уровень",
        "VK",
        "Telegram",
        "Чек",
        "Телефон"
      ]);
    }

    sheet.appendRow([
      new Date(),
      data.name || "",
      data.city || "",
      data.dateOfBirth || "",
      data.category || "",
      data.videoLink || "",
      data.experience || "",
      data.level || "",
      data.vkLink || "",
      data.tgLink || "",
      paymentUrl,
      data.phone || ""
    ]);

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
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  if (e && e.parameter && e.parameter.name) {
    return e.parameter;
  }

  const raw = (e && e.postData && e.postData.contents) || "";
  if (!raw) {
    throw new Error("Пустой запрос");
  }

  if (raw.indexOf("payload=") === 0) {
    return JSON.parse(decodeURIComponent(raw.slice("payload=".length).replace(/\+/g, " ")));
  }

  return JSON.parse(raw);
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
