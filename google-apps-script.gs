/**
 * Google Apps Script que actúa como API entre la web y la hoja de cálculo.
 *
 * INSTRUCCIONES:
 * 1. Abre tu hoja de Google Sheets.
 * 2. Menú: Extensiones > Apps Script.
 * 3. Borra el código de ejemplo y pega TODO este archivo.
 * 4. Ajusta SHEET_NAME si tu pestaña no se llama "Jugadores".
 * 5. Implementar > Nueva implementación (o "Administrar implementaciones" para
 *    actualizar la existente) > Tipo: Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 6. Copia la URL (.../exec) y pégala en js/config.js (SHEETS_API_URL).
 *
 * IMPORTANTE: si ya tenías una versión anterior desplegada, tras pegar este
 * código debes crear una NUEVA versión de la implementación para que los
 * cambios (editar / borrar) tengan efecto.
 *
 * Hoja "Jugadores" (fila 1):
 * ID | Nombre | Clase | Especializacion | Profesion1 | Profesion2 | Jugador | Nivel | Grupo
 *
 * Hoja "Grupos" (fila 1):
 * ID | Nombre | Notas | Objetivo | Fecha | Hora | NivelMin | NivelMax
 *
 * GET  ?type=players (por defecto) | ?type=groups | ?type=all
 * POST action: add | update | delete | setLevel | setGroup |
 *              addGroup | updateGroup | deleteGroup
 */

var SHEET_NAME = "Jugadores";
var HEADERS = ["ID", "Nombre", "Clase", "Especializacion", "Profesion1", "Profesion2", "Jugador", "Nivel", "Grupo"];

var GROUPS_SHEET_NAME = "Grupos";
var GROUP_HEADERS = ["ID", "Nombre", "Notas", "Objetivo", "Fecha", "Hora", "NivelMin", "NivelMax"];

// Columnas (1-based) de la hoja Jugadores
var COL_LEVEL = 8;
var COL_GROUP = 9;

function getSheet() {
  return getOrCreateSheet(SHEET_NAME, HEADERS);
}

function getGroupsSheet() {
  return getOrCreateSheet(GROUPS_SHEET_NAME, GROUP_HEADERS);
}

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

// ---------- GET ----------

function doGet(e) {
  var type = (e && e.parameter && e.parameter.type) || "players";

  if (type === "groups") return jsonResponse(readGroups());
  if (type === "all") return jsonResponse({ players: readPlayers(), groups: readGroups() });

  return jsonResponse(readPlayers());
}

function readPlayers() {
  var values = getSheet().getDataRange().getValues();
  var players = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0] && !row[1]) continue; // saltar filas totalmente vacías
    players.push({
      id: row[0],
      name: row[1],
      class: row[2],
      spec: row[3],
      prof1: row[4],
      prof2: row[5],
      owner: row[6],
      level: row[7] === "" || row[7] === undefined ? "" : Number(row[7]),
      group: row[8] === undefined ? "" : row[8]
    });
  }

  return players;
}

function readGroups() {
  var values = getGroupsSheet().getDataRange().getValues();
  var groups = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0] && !row[1]) continue;
    groups.push({
      id: row[0],
      name: row[1],
      notes: textOf(row[2]),
      target: textOf(row[3]),
      date: formatDateCell(row[4]),
      time: formatTimeCell(row[5]),
      minLevel: normalizeLevel(row[6]),
      maxLevel: normalizeLevel(row[7])
    });
  }

  return groups;
}

function textOf(value) {
  return value === undefined || value === null ? "" : String(value);
}

// Devuelve la fecha como AAAA-MM-DD aunque la celda tenga formato de fecha
function formatDateCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return textOf(value);
}

// Devuelve la hora como HH:MM aunque la celda tenga formato de hora
function formatTimeCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  }
  return textOf(value);
}

// Fila completa de un grupo para escribir en la hoja
function groupRow(id, data) {
  return [
    id,
    data.name,
    data.notes || "",
    data.target || "",
    data.date || "",
    data.time || "",
    normalizeLevel(data.minLevel),
    normalizeLevel(data.maxLevel)
  ];
}

// ---------- POST ----------

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "add";

    if (action === "add") return addPlayer(data);
    if (action === "update") return updatePlayer(data);
    if (action === "delete") return deletePlayer(data);
    if (action === "setLevel") return setPlayerLevel(data);
    if (action === "setGroup") return setPlayerGroup(data);
    if (action === "addGroup") return addGroup(data);
    if (action === "updateGroup") return updateGroup(data);
    if (action === "deleteGroup") return deleteGroup(data);

    return jsonResponse({ error: "Acción no reconocida: " + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Jugadores ----------

function addPlayer(data) {
  if (!data.name || !data.class || !data.spec) {
    return jsonResponse({ error: "Faltan campos obligatorios." });
  }

  var sheet = getSheet();
  var id = data.id || generateId("p");
  sheet.appendRow([
    id,
    data.name,
    data.class,
    data.spec,
    data.prof1 || "",
    data.prof2 || "",
    data.owner || "",
    normalizeLevel(data.level),
    data.group || ""
  ]);

  return jsonResponse({ success: true, id: id });
}

function updatePlayer(data) {
  if (!data.id) return jsonResponse({ error: "Falta el ID del jugador." });
  if (!data.name || !data.class || !data.spec) {
    return jsonResponse({ error: "Faltan campos obligatorios." });
  }

  var sheet = getSheet();
  var rowIndex = findRowById(sheet, data.id);
  if (rowIndex === -1) return jsonResponse({ error: "No se encontró el jugador." });

  var rowNumber = rowIndex + 2; // salta cabecera y base-1 de Sheets

  // Columnas A..G siempre
  sheet.getRange(rowNumber, 1, 1, 7).setValues([[
    data.id,
    data.name,
    data.class,
    data.spec,
    data.prof1 || "",
    data.prof2 || "",
    data.owner || ""
  ]]);

  // Nivel y Grupo solo si vienen en la petición (para no borrarlos sin querer)
  if (data.hasOwnProperty("level")) {
    sheet.getRange(rowNumber, COL_LEVEL).setValue(normalizeLevel(data.level));
  }
  if (data.hasOwnProperty("group")) {
    sheet.getRange(rowNumber, COL_GROUP).setValue(data.group || "");
  }

  return jsonResponse({ success: true });
}

function deletePlayer(data) {
  if (!data.id) return jsonResponse({ error: "Falta el ID del jugador." });

  var sheet = getSheet();
  var rowIndex = findRowById(sheet, data.id);
  if (rowIndex === -1) return jsonResponse({ error: "No se encontró el jugador." });

  sheet.deleteRow(rowIndex + 2);
  return jsonResponse({ success: true });
}

function setPlayerLevel(data) {
  if (!data.id) return jsonResponse({ error: "Falta el ID del jugador." });

  var sheet = getSheet();
  var rowIndex = findRowById(sheet, data.id);
  if (rowIndex === -1) return jsonResponse({ error: "No se encontró el jugador." });

  sheet.getRange(rowIndex + 2, COL_LEVEL).setValue(normalizeLevel(data.level));
  return jsonResponse({ success: true });
}

function setPlayerGroup(data) {
  if (!data.id) return jsonResponse({ error: "Falta el ID del jugador." });

  var groupId = data.group || "";
  if (groupId && findRowById(getGroupsSheet(), groupId) === -1) {
    return jsonResponse({ error: "No se encontró el grupo." });
  }

  var sheet = getSheet();
  var rowIndex = findRowById(sheet, data.id);
  if (rowIndex === -1) return jsonResponse({ error: "No se encontró el jugador." });

  sheet.getRange(rowIndex + 2, COL_GROUP).setValue(groupId);
  return jsonResponse({ success: true });
}

// ---------- Grupos ----------

function addGroup(data) {
  if (!data.name) return jsonResponse({ error: "Falta el nombre del grupo." });

  var id = data.id || generateId("g");
  var sheet = getGroupsSheet();
  var rowNumber = sheet.getLastRow() + 1;
  // Fecha y Hora como texto para que Sheets no las convierta
  sheet.getRange(rowNumber, 5, 1, 2).setNumberFormat("@");
  sheet.getRange(rowNumber, 1, 1, GROUP_HEADERS.length).setValues([groupRow(id, data)]);
  return jsonResponse({ success: true, id: id });
}

function updateGroup(data) {
  if (!data.id) return jsonResponse({ error: "Falta el ID del grupo." });
  if (!data.name) return jsonResponse({ error: "Falta el nombre del grupo." });

  var sheet = getGroupsSheet();
  var rowIndex = findRowById(sheet, data.id);
  if (rowIndex === -1) return jsonResponse({ error: "No se encontró el grupo." });

  var rowNumber = rowIndex + 2;
  sheet.getRange(rowNumber, 5, 1, 2).setNumberFormat("@");
  sheet.getRange(rowNumber, 1, 1, GROUP_HEADERS.length).setValues([groupRow(data.id, data)]);
  return jsonResponse({ success: true });
}

function deleteGroup(data) {
  if (!data.id) return jsonResponse({ error: "Falta el ID del grupo." });

  var groupsSheet = getGroupsSheet();
  var rowIndex = findRowById(groupsSheet, data.id);
  if (rowIndex === -1) return jsonResponse({ error: "No se encontró el grupo." });

  // Dejar sin grupo a los personajes que pertenecían a él
  var playersSheet = getSheet();
  var values = playersSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][COL_GROUP - 1]) === String(data.id)) {
      playersSheet.getRange(i + 1, COL_GROUP).setValue("");
    }
  }

  groupsSheet.deleteRow(rowIndex + 2);
  return jsonResponse({ success: true });
}

// ---------- Utilidades ----------

// Devuelve el índice 0-based (sobre filas de datos) del registro con ese ID en la columna A, o -1.
function findRowById(sheet, id) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i - 1;
  }
  return -1;
}

function normalizeLevel(value) {
  if (value === undefined || value === null || value === "") return "";
  var n = parseInt(value, 10);
  return isNaN(n) ? "" : n;
}

function generateId(prefix) {
  return (prefix || "p") + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
