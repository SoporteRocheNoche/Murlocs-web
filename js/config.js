/*
 * Configuración de la conexión con Google Sheets.
 *
 * PASOS PARA CONFIGURAR (ver README.md para el detalle):
 * 1. Crea una hoja de cálculo en Google Sheets con las columnas:
 *    Nombre | Clase | Especializacion | Profesion1 | Profesion2
 * 2. En la hoja: Extensiones > Apps Script y pega el contenido de google-apps-script.gs
 * 3. Publica el script como "Aplicación web" (acceso: cualquier usuario).
 * 4. Copia la URL que te da y pégala abajo en SHEETS_API_URL.
 */
const CONFIG = {
    // URL del Web App de Google Apps Script (termina en /exec)
    SHEETS_API_URL: "https://script.google.com/macros/s/AKfycbzlA8rdXLV6Jy4y8GS9H26qdlwldOuok1N7sCi80A6cvsWR_wP6Sc6aX0Jkkg2gHM79dg/exec"
};
