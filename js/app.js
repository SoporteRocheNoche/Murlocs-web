/* global CONFIG */
"use strict";

// Estado en memoria de la tabla maestra (clases / especializaciones / profesiones)
let masterData = { classes: [], professions: [] };

// Referencias al DOM
const els = {
    form: document.getElementById("player-form"),
    name: document.getElementById("playerName"),
    owner: document.getElementById("playerOwner"),
    ownerList: document.getElementById("ownerList"),
    class: document.getElementById("playerClass"),
    spec: document.getElementById("playerSpec"),
    prof1: document.getElementById("playerProf1"),
    prof2: document.getElementById("playerProf2"),
    submitBtn: document.getElementById("submitBtn"),
    message: document.getElementById("formMessage"),
    tbody: document.getElementById("players-tbody"),
    refreshBtn: document.getElementById("refreshBtn")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    await loadMasterData();
    populateClasses();
    populateProfessions();
    bindEvents();
    await loadPlayers();
}

// ---------- Tabla maestra (JSON) ----------

async function loadMasterData() {
    try {
        const res = await fetch("data/wow-data.json");
        if (!res.ok) throw new Error("No se pudo cargar data/wow-data.json");
        masterData = await res.json();
    } catch (err) {
        showMessage("Error cargando la tabla maestra: " + err.message, "error");
    }
}

function populateClasses() {
    masterData.classes.forEach(function (cls) {
        const opt = document.createElement("option");
        opt.value = cls.name;
        opt.textContent = cls.name;
        opt.style.color = cls.color;
        opt.style.backgroundColor = "#1f1f28";
        els.class.appendChild(opt);
    });
}

function updateClassSelectColor() {
    const cls = masterData.classes.find(function (c) { return c.name === els.class.value; });
    els.class.style.color = cls ? cls.color : "";
    els.class.style.fontWeight = cls ? "700" : "";
}

function populateProfessions() {
    masterData.professions.forEach(function (prof) {
        [els.prof1, els.prof2].forEach(function (select) {
            const opt = document.createElement("option");
            opt.value = prof;
            opt.textContent = prof;
            select.appendChild(opt);
        });
    });
}

function populateSpecs(className) {
    els.spec.innerHTML = "";
    const cls = masterData.classes.find(function (c) { return c.name === className; });

    if (!cls) {
        els.spec.disabled = true;
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "Selecciona una especialización";
    els.spec.appendChild(placeholder);

    cls.specs.forEach(function (spec) {
        const opt = document.createElement("option");
        opt.value = spec.name;
        opt.textContent = spec.name;
        els.spec.appendChild(opt);
    });

    els.spec.disabled = false;
}

function findSpec(className, specName) {
    const cls = masterData.classes.find(function (c) { return c.name === className; });
    if (!cls) return null;
    return cls.specs.find(function (s) { return s.name === specName; }) || null;
}

// ---------- Eventos ----------

function bindEvents() {
    els.class.addEventListener("change", function () {
        populateSpecs(els.class.value);
        updateClassSelectColor();
    });

    els.form.addEventListener("submit", handleSubmit);
    els.refreshBtn.addEventListener("click", loadPlayers);
}

async function handleSubmit(event) {
    event.preventDefault();

    const player = {
        name: els.name.value.trim(),
        owner: els.owner.value.trim(),
        class: els.class.value,
        spec: els.spec.value,
        prof1: els.prof1.value,
        prof2: els.prof2.value
    };
    if (!player.name || !player.class || !player.spec) {
        showMessage("Rellena nombre, clase y especialización.", "error");
        return;
    }

    if (player.prof1 && player.prof2 && player.prof1 === player.prof2) {
        showMessage("Las dos profesiones no pueden ser iguales.", "error");
        return;
    }

    setLoading(true);
    try {
        await addPlayer(player);
        showMessage("Jugador añadido correctamente.", "success");
        els.form.reset();
        els.spec.disabled = true;
        updateClassSelectColor();
        await loadPlayers();
    } catch (err) {
        showMessage("Error al guardar: " + err.message, "error");
    } finally {
        setLoading(false);
    }
}

// ---------- Google Sheets (a través del Apps Script) ----------

function isConfigured() {
    return CONFIG.SHEETS_API_URL && CONFIG.SHEETS_API_URL.indexOf("http") === 0;
}

async function loadPlayers() {
    if (!isConfigured()) {
        renderPlayers([]);
        showMessage("Configura la URL de Google Sheets en js/config.js", "error");
        return;
    }

    els.tbody.innerHTML = '<tr><td colspan="6" class="empty">Cargando...</td></tr>';

    try {
        const res = await fetch(CONFIG.SHEETS_API_URL);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const players = sortPlayers(await res.json());
        renderPlayers(players);
    } catch (err) {
        els.tbody.innerHTML =
            '<tr><td colspan="6" class="empty">Error al cargar: ' + err.message + "</td></tr>";
    }
}

// Ordena por Jugador y luego por Nombre de personaje (alfabético, sin distinguir mayúsculas)
function sortPlayers(players) {
    return (players || []).slice().sort(function (a, b) {
        const ownerA = (a.owner || "").toLowerCase();
        const ownerB = (b.owner || "").toLowerCase();
        const byOwner = ownerA.localeCompare(ownerB);
        if (byOwner !== 0) return byOwner;
        return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
    });
}

async function addPlayer(player) {
    if (!isConfigured()) {
        throw new Error("URL de Google Sheets no configurada.");
    }

    const res = await fetch(CONFIG.SHEETS_API_URL, {
        method: "POST",
        // text/plain evita la petición preflight CORS con Apps Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(player)
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    const result = await res.json();
    if (result && result.error) throw new Error(result.error);
    return result;
}

// ---------- Render ----------

function renderPlayers(players) {
    populateOwnerOptions(players);

    if (!players || players.length === 0) {
        els.tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay jugadores todavía.</td></tr>';
        return;
    }

    els.tbody.innerHTML = "";
    players.forEach(function (p) {
        const tr = document.createElement("tr");
        tr.appendChild(nameCell(p.name));
        tr.appendChild(classCell(p.class));
        tr.appendChild(specCell(p.class, p.spec));
        tr.appendChild(textCell(p.prof1));
        tr.appendChild(textCell(p.prof2));
        tr.appendChild(textCell(p.owner));
        els.tbody.appendChild(tr);
    });
}

function populateOwnerOptions(players) {
    if (!els.ownerList) return;

    // Nombres de "Jugador" únicos y ordenados
    const owners = [];
    (players || []).forEach(function (p) {
        const value = (p.owner || "").trim();
        if (value && owners.indexOf(value) === -1) owners.push(value);
    });
    owners.sort(function (a, b) { return a.localeCompare(b); });

    els.ownerList.innerHTML = "";
    owners.forEach(function (owner) {
        const opt = document.createElement("option");
        opt.value = owner;
        els.ownerList.appendChild(opt);
    });
}

function nameCell(value) {
    const td = document.createElement("td");
    td.textContent = value || "";
    return td;
}

function classCell(className) {
    const td = document.createElement("td");
    const cls = masterData.classes.find(function (c) { return c.name === className; });

    if (cls) {
        const dot = document.createElement("span");
        dot.className = "class-dot";
        dot.style.backgroundColor = cls.color;
        td.appendChild(dot);
        td.style.color = cls.color;
        td.style.fontWeight = "600";
    }

    td.appendChild(document.createTextNode(className || ""));
    return td;
}

function specCell(className, specName) {
    const td = document.createElement("td");
    const spec = findSpec(className, specName);

    if (spec && spec.icon) {
        const img = document.createElement("img");
        img.className = "spec-icon";
        img.src = spec.icon;
        img.alt = specName;
        img.title = specName;
        td.appendChild(img);
    }

    td.appendChild(document.createTextNode(specName || "—"));
    return td;
}

function textCell(value) {
    const td = document.createElement("td");
    td.textContent = value || "—";
    return td;
}

// ---------- Utilidades UI ----------

function showMessage(text, type) {
    els.message.textContent = text;
    els.message.className = "message " + (type || "");
}

function setLoading(loading) {
    els.submitBtn.disabled = loading;
    els.submitBtn.textContent = loading ? "Guardando..." : "Añadir jugador";
}
