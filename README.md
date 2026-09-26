# Murlocs-web
# 🐟 Roster de la Guild (Murlocs-web)

Página web estática y sencilla para sustituir el Excel de una guild de WoW.
Sin login: cualquiera puede añadir jugadores. Usa **Google Sheets como base de datos**
y un **JSON como tabla maestra** para clases, especializaciones y profesiones.

## Estructura del proyecto

```
index.html              ? Página principal
css/styles.css          ? Estilos
js/config.js            ? Configuración (URL de Google Sheets)
js/app.js               ? Lógica de la app
data/wow-data.json      ? Tabla maestra (clases / specs / profesiones)
google-apps-script.gs   ? Código para pegar en Google Apps Script
```

## Puesta en marcha

### 1. Crear la base de datos en Google Sheets
1. Crea una hoja de cálculo en [Google Sheets](https://sheets.google.com).
2. Renombra la primera pestaña a `Jugadores` (o deja que el script la cree).
3. En la primera fila pon las cabeceras:
   `Nombre | Clase | Especializacion | Profesion1 | Profesion2`

### 2. Publicar el Apps Script (la "API")
1. En la hoja: **Extensiones ? Apps Script**.
2. Borra el código de ejemplo y pega el contenido de `google-apps-script.gs`.
3. **Implementar ? Nueva implementación ? Aplicación web**:
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier usuario**
4. Copia la URL generada (termina en `/exec`).

### 3. Conectar la web
Abre `js/config.js` y pega tu URL:

```js
const CONFIG = {
    SHEETS_API_URL: "https://script.google.com/macros/s/XXXXX/exec"
};
```

### 4. Publicar la web
Al ser estática, puedes subirla gratis a **GitHub Pages**:
1. Sube estos archivos al repositorio.
2. En GitHub: **Settings ? Pages ? Deploy from a branch ? main / root**.
3. Tu web estará en `https://soporterochenoche.github.io/Murlocs-web/`.

## Personalizar
- Añade o quita clases, especializaciones y profesiones editando `data/wow-data.json`.
- No hace falta tocar el código para cambiar la tabla maestra.

## Desarrollo local
Ábrelo con un servidor estático (por el `fetch` del JSON):

```powershell
python -m http.server 8000
```

Luego visita `http://localhost:8000`.
