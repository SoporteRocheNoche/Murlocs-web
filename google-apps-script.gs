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
 * La primera fila de la hoja debe tener las cabeceras:
 * ID | Nombre | Clase | Especializacion | Profesion1 | Profesion2
 */

var SHEET_NAME = "Jugadores";
var HEADERS = ["ID", "Nombre", "Clase", "Especializacion", "Profesion1", "Profesion2"];

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

// GET: devuelve todos los jugadores como JSON
function doGet() {
  var sheet = getSheet();
  var values = sheet.getDataRange().getValues();
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
      prof2: row[5]
    });
  }

  return jsonResponse(players);
}

// POST: enruta según data.action (add | update | delete). Por defecto: add.
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "add";

    if (action === "add") return addPlayer(data);
    if (action === "update") return updatePlayer(data);
    if (action === "delete") return deletePlayer(data);

    return jsonResponse({ error: "Acción no reconocida: " + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function addPlayer(data) {
  if (!data.name || !data.class || !data.spec) {
    return jsonResponse({ error: "Faltan campos obligatorios." });
  }

  var sheet = getSheet();
  var id = data.id || generateId();
  sheet.appendRow([
    id,
    data.name,
    data.class,
    data.spec,
    data.prof1 || "",
    data.prof2 || ""
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

  // rowIndex es 0-based sobre datos; +2 -> salta cabecera y base-1 de Sheets
  sheet.getRange(rowIndex + 2, 1, 1, HEADERS.length).setValues([[
    data.id,
    data.name,
    data.class,
    data.spec,
    data.prof1 || "",
    data.prof2 || ""
  ]]);

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

// Devuelve el índice 0-based (sobre filas de datos) del jugador, o -1.
function findRowById(sheet, id) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i - 1;
  }
  return -1;
}

function generateId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
