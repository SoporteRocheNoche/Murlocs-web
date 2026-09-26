/**
 * Google Apps Script que actúa como API entre la web y la hoja de cálculo.
 *
 * INSTRUCCIONES:
 * 1. Abre tu hoja de Google Sheets.
 * 2. Menú: Extensiones > Apps Script.
 * 3. Borra el código de ejemplo y pega TODO este archivo.
 * 4. Ajusta SHEET_NAME si tu pestaña no se llama "Jugadores".
 * 5. Implementar > Nueva implementación > Tipo: Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 6. Copia la URL (.../exec) y pégala en js/config.js (SHEETS_API_URL).
 *
 * La primera fila de la hoja debe tener las cabeceras:
 * Nombre | Clase | Especializacion | Profesion1 | Profesion2
 */

var SHEET_NAME = "Jugadores";

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Nombre", "Clase", "Especializacion", "Profesion1", "Profesion2"]);
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
    if (!row[0]) continue; // saltar filas vacías
    players.push({
      name: row[0],
      class: row[1],
      spec: row[2],
      prof1: row[3],
      prof2: row[4]
    });
  }

  return jsonResponse(players);
}

// POST: añade un jugador nuevo
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (!data.name || !data.class || !data.spec) {
      return jsonResponse({ error: "Faltan campos obligatorios." });
    }

    var sheet = getSheet();
    sheet.appendRow([
      data.name,
      data.class,
      data.spec,
      data.prof1 || "",
      data.prof2 || ""
    ]);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
