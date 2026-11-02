/*
 * Configuración de la conexión con Google Sheets.
 *
 * PASOS PARA CONFIGURAR (ver README.md para el detalle):
 * 1. Crea una hoja de cálculo en Google Sheets con las columnas:
 *    ID | Nombre | Clase | Especializacion | Profesion1 | Profesion2
 * 2. En la hoja: Extensiones > Apps Script y pega el contenido de google-apps-script.gs
 * 3. Publica el script como "Aplicación web" (acceso: cualquier usuario).
 * 4. Copia la URL que te da y pégala abajo en SHEETS_API_URL.
 */
const CONFIG = {
    // URL del Web App de Google Apps Script (termina en /exec)
    SHEETS_API_URL: "https://script.google.com/macros/s/AKfycbx1EH_hGrVqzAqBiBwdzN9uYeGhLMQsSPWVGM0M8wcmaZ0U4Nkmb_5TKcEA6Yir2GR0CQ/exec",

    // Diferencia máxima de nivel dentro de un grupo antes de mostrar aviso
    LEVEL_MARGIN: 3,

    // Número máximo de personajes por grupo
    GROUP_SIZE: 5,

    // Nivel máximo seleccionable
    MAX_LEVEL: 60
};
