/* global CONFIG */
"use strict";

// Estado en memoria
let masterData = { classes: [], professions: [] };
let allPlayers = [];

const els = {
    tbody: document.getElementById("players-tbody"),
    refreshBtn: document.getElementById("refreshBtn"),
    searchInput: document.getElementById("searchInput"),
    listMessage: document.getElementById("listMessage"),
    // Modal
    modal: document.getElementById("editModal"),
    editForm: document.getElementById("edit-form"),
    editId: document.getElementById("editId"),
    editName: document.getElementById("editName"),
    editOwner: document.getElementById("editOwner"),
    editClass: document.getElementById("editClass"),
    editSpec: document.getElementById("editSpec"),
    editProf1: document.getElementById("editProf1"),
    editProf2: document.getElementById("editProf2"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    saveEditBtn: document.getElementById("saveEditBtn"),
    editMessage: document.getElementById("editMessage")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    await loadMasterData();
    populateSelectOptions();
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
        showListMessage("Error cargando la tabla maestra: " + err.message, "error");
    }
}

function populateSelectOptions() {
    masterData.classes.forEach(function (cls) {
        const opt = document.createElement("option");
        opt.value = cls.name;
        opt.textContent = cls.name;
        opt.style.color = cls.color;
        opt.style.backgroundColor = "#1f1f28";
        els.editClass.appendChild(opt);
    });

    masterData.professions.forEach(function (prof) {
        [els.editProf1, els.editProf2].forEach(function (select) {
            const opt = document.createElement("option");
            opt.value = prof;
            opt.textContent = prof;
            select.appendChild(opt);
        });
    });
}

function populateEditSpecs(className, selectedSpec) {
    els.editSpec.innerHTML = "";
    const cls = masterData.classes.find(function (c) { return c.name === className; });
    if (!cls) return;

    cls.specs.forEach(function (spec) {
        const opt = document.createElement("option");
        opt.value = spec.name;
        opt.textContent = spec.name;
        if (spec.name === selectedSpec) opt.selected = true;
        els.editSpec.appendChild(opt);
    });
}

function findSpec(className, specName) {
    const cls = masterData.classes.find(function (c) { return c.name === className; });
    if (!cls) return null;
    return cls.specs.find(function (s) { return s.name === specName; }) || null;
}

// ---------- Eventos ----------

function bindEvents() {
    els.refreshBtn.addEventListener("click", loadPlayers);
    els.searchInput.addEventListener("input", renderFiltered);
    els.editClass.addEventListener("change", function () {
        populateEditSpecs(els.editClass.value, null);
    });
    els.editForm.addEventListener("submit", handleEditSubmit);
    els.cancelEditBtn.addEventListener("click", closeModal);
    els.modal.addEventListener("click", function (e) {
        if (e.target === els.modal) closeModal();
    });
}

// ---------- Google Sheets (a través del Apps Script) ----------

function isConfigured() {
    return CONFIG.SHEETS_API_URL && CONFIG.SHEETS_API_URL.indexOf("http") === 0;
}

async function loadPlayers() {
    if (!isConfigured()) {
        showListMessage("Configura la URL de Google Sheets en js/config.js", "error");
        renderPlayers([]);
        return;
    }

    els.tbody.innerHTML = '<tr><td colspan="7" class="empty">Cargando...</td></tr>';
    showListMessage("", "");

    try {
        const res = await fetch(CONFIG.SHEETS_API_URL);
        if (!res.ok) throw new Error("HTTP " + res.status);
        allPlayers = await res.json();
        renderFiltered();
    } catch (err) {
        els.tbody.innerHTML =
            '<tr><td colspan="7" class="empty">Error al cargar: ' + err.message + "</td></tr>";
    }
}

async function postAction(payload) {
    const res = await fetch(CONFIG.SHEETS_API_URL, {
        method: "POST",
        // text/plain evita la petición preflight CORS con Apps Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const result = await res.json();
    if (result && result.error) throw new Error(result.error);
    return result;
}

// ---------- Render ----------

function renderFiltered() {
    const term = els.searchInput.value.trim().toLowerCase();
    const filtered = term
        ? allPlayers.filter(function (p) {
            return (p.name || "").toLowerCase().indexOf(term) !== -1 ||
                (p.owner || "").toLowerCase().indexOf(term) !== -1;
        })
        : allPlayers;
    renderPlayers(filtered);
}

function renderPlayers(players) {
    if (!players || players.length === 0) {
        els.tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay jugadores.</td></tr>';
        return;
    }

    els.tbody.innerHTML = "";
    players.forEach(function (p) {
        const tr = document.createElement("tr");
        tr.appendChild(textCell(p.name));
        tr.appendChild(classCell(p.class));
        tr.appendChild(specCell(p.class, p.spec));
        tr.appendChild(textCell(p.prof1));
        tr.appendChild(textCell(p.prof2));
        tr.appendChild(textCell(p.owner));
        tr.appendChild(actionsCell(p));
        els.tbody.appendChild(tr);
    });
}

function textCell(value) {
    const td = document.createElement("td");
    td.textContent = value || "—";
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

function actionsCell(player) {
    const td = document.createElement("td");
    td.className = "actions-cell";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-icon edit";
    editBtn.textContent = "✏️ Editar";
    editBtn.addEventListener("click", function () { openModal(player); });

    const delBtn = document.createElement("button");
    delBtn.className = "btn-icon delete";
    delBtn.textContent = "🗑️ Borrar";
    delBtn.addEventListener("click", function () { confirmDelete(player); });

    td.appendChild(editBtn);
    td.appendChild(delBtn);
    return td;
}

// ---------- Borrar ----------

async function confirmDelete(player) {
    if (!player.id) {
        alert("Este jugador no tiene ID. Añade la columna ID en la hoja o vuelve a crearlo.");
        return;
    }
    if (!confirm('¿Seguro que quieres borrar a "' + player.name + '"?')) return;

    showListMessage("Borrando...", "");
    try {
        await postAction({ action: "delete", id: player.id });
        showListMessage("Jugador borrado.", "success");
        await loadPlayers();
    } catch (err) {
        showListMessage("Error al borrar: " + err.message, "error");
    }
}

// ---------- Editar (modal) ----------

function openModal(player) {
    els.editId.value = player.id || "";
    els.editName.value = player.name || "";
    els.editOwner.value = player.owner || "";
    els.editClass.value = player.class || "";
    populateEditSpecs(player.class, player.spec);
    els.editProf1.value = player.prof1 || "";
    els.editProf2.value = player.prof2 || "";
    showEditMessage("", "");
    els.modal.classList.remove("hidden");
}

function closeModal() {
    els.modal.classList.add("hidden");
}

async function handleEditSubmit(event) {
    event.preventDefault();

    const payload = {
        action: "update",
        id: els.editId.value,
        name: els.editName.value.trim(),
        owner: els.editOwner.value.trim(),
        class: els.editClass.value,
        spec: els.editSpec.value,
        prof1: els.editProf1.value,
        prof2: els.editProf2.value
    };

    if (!payload.id) {
        showEditMessage("Este jugador no tiene ID y no se puede editar.", "error");
        return;
    }
    if (!payload.name || !payload.class || !payload.spec) {
        showEditMessage("Rellena nombre, clase y especialización.", "error");
        return;
    }
    if (payload.prof1 && payload.prof2 && payload.prof1 === payload.prof2) {
        showEditMessage("Las dos profesiones no pueden ser iguales.", "error");
        return;
    }

    els.saveEditBtn.disabled = true;
    els.saveEditBtn.textContent = "Guardando...";
    try {
        await postAction(payload);
        closeModal();
        await loadPlayers();
        showListMessage("Cambios guardados.", "success");
    } catch (err) {
        showEditMessage("Error al guardar: " + err.message, "error");
    } finally {
        els.saveEditBtn.disabled = false;
        els.saveEditBtn.textContent = "Guardar cambios";
    }
}

// ---------- Utilidades UI ----------

function showListMessage(text, type) {
    els.listMessage.textContent = text;
    els.listMessage.className = "message " + (type || "");
}

function showEditMessage(text, type) {
    els.editMessage.textContent = text;
    els.editMessage.className = "message " + (type || "");
}
