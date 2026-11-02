/* global CONFIG */
"use strict";

const NEW_GROUP = "__new__";
const LEVEL_MARGIN = (typeof CONFIG.LEVEL_MARGIN === "number") ? CONFIG.LEVEL_MARGIN : 3;
const GROUP_SIZE = (typeof CONFIG.GROUP_SIZE === "number") ? CONFIG.GROUP_SIZE : 5;

let masterData = { classes: [], professions: [] };
let players = [];
let groups = [];
let busy = false;

const els = {
    pool: document.getElementById("pool"),
    poolCount: document.getElementById("poolCount"),
    groupsList: document.getElementById("groupsList"),
    searchInput: document.getElementById("searchInput"),
    refreshBtn: document.getElementById("refreshBtn"),
    message: document.getElementById("groupsMessage")
};

document.addEventListener("DOMContentLoaded", init);

const AUTO_REFRESH_MS = 30000;
let loadToken = 0;

async function init() {
    await loadMasterData();
    els.refreshBtn.addEventListener("click", function () { loadData(); });
    els.searchInput.addEventListener("input", renderPool);

    // Volver a la pestaña o volver atrás con el navegador: recargar datos
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") refreshInBackground();
    });
    window.addEventListener("pageshow", function (e) {
        if (e.persisted) refreshInBackground();
    });

    // Refresco periódico para ver los cambios de otros miembros
    setInterval(function () {
        if (document.visibilityState === "visible") refreshInBackground();
    }, AUTO_REFRESH_MS);

    await loadData();
}

// Recarga silenciosa; no interrumpe un arrastre ni un guardado en curso
function refreshInBackground() {
    if (drag || busy) return;
    loadData({ silent: true });
}

// ---------- Datos ----------

async function loadMasterData() {
    try {
        const res = await fetch("data/wow-data.json");
        if (!res.ok) throw new Error("No se pudo cargar data/wow-data.json");
        masterData = await res.json();
    } catch (err) {
        showMessage("Error cargando la tabla maestra: " + err.message, "error");
    }
}

async function loadData(options) {
    const silent = !!(options && options.silent);

    if (!CONFIG.SHEETS_API_URL || CONFIG.SHEETS_API_URL.indexOf("http") !== 0) {
        showMessage("Configura la URL de Google Sheets en js/config.js", "error");
        return;
    }

    // Si llegan varias respuestas, solo se aplica la de la última petición
    const token = ++loadToken;

    if (!silent) showMessage("Cargando...", "");
    try {
        // Parámetro _ para evitar que el navegador devuelva datos en caché
        const url = CONFIG.SHEETS_API_URL + "?type=all&_=" + Date.now();
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();

        if (token !== loadToken) return;
        // No redibujar en mitad de un arrastre; se aplicará en el siguiente refresco
        if (drag && drag.ghost) return;

        if (Array.isArray(data)) {
            // El Apps Script desplegado es una versión antigua sin soporte de grupos
            players = data;
            groups = [];
            showMessage("El Apps Script desplegado no soporta grupos. Publica una nueva versión.", "error");
        } else {
            players = data.players || [];
            groups = data.groups || [];
            if (!silent) showMessage("", "");
        }
        render();
    } catch (err) {
        if (token !== loadToken) return;
        showMessage("Error al cargar: " + err.message, "error");
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

// ---------- Helpers de datos ----------

function groupExists(id) {
    return groups.some(function (g) { return String(g.id) === String(id); });
}

function playerGroup(p) {
    const g = p.group === undefined || p.group === null ? "" : String(p.group);
    return g && groupExists(g) ? g : "";
}

function membersOf(groupId) {
    return players.filter(function (p) { return playerGroup(p) === String(groupId); });
}

function findPlayer(id) {
    return players.find(function (p) { return String(p.id) === String(id); }) || null;
}

function findClass(className) {
    return masterData.classes.find(function (c) { return c.name === className; }) || null;
}

function findSpec(className, specName) {
    const cls = findClass(className);
    if (!cls) return null;
    return cls.specs.find(function (s) { return s.name === specName; }) || null;
}

function levelOf(p) {
    const n = parseInt(p.level, 10);
    return isNaN(n) ? null : n;
}

function byLevelThenName(a, b) {
    const la = levelOf(a);
    const lb = levelOf(b);
    if (la !== lb) {
        if (la === null) return 1;
        if (lb === null) return -1;
        return la - lb;
    }
    return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
}

function nextGroupName() {
    let n = groups.length + 1;
    const names = groups.map(function (g) { return String(g.name).toLowerCase(); });
    while (names.indexOf(("grupo " + n).toLowerCase()) !== -1) n++;
    return "Grupo " + n;
}

// ---------- Render ----------

function render() {
    renderPool();
    renderGroups();
}

function renderPool() {
    const term = els.searchInput.value.trim().toLowerCase();
    const free = players
        .filter(function (p) { return !playerGroup(p); })
        .sort(byLevelThenName);

    els.poolCount.textContent = free.length;
    els.pool.innerHTML = "";

    const visible = term
        ? free.filter(function (p) {
            return (p.name || "").toLowerCase().indexOf(term) !== -1 ||
                (p.owner || "").toLowerCase().indexOf(term) !== -1;
        })
        : free;

    if (visible.length === 0) {
        els.pool.appendChild(emptyHint(free.length === 0 ? "Todos los personajes tienen grupo." : "Sin resultados."));
        return;
    }

    visible.forEach(function (p) { els.pool.appendChild(charCard(p)); });
}

function renderGroups() {
    els.groupsList.innerHTML = "";

    groups.forEach(function (g) {
        els.groupsList.appendChild(groupCard(g));
    });

    els.groupsList.appendChild(newGroupCard());
}

function groupCard(group) {
    const members = membersOf(group.id).sort(byLevelThenName);

    const card = document.createElement("div");
    card.className = "card group-card";

    // Cabecera
    const header = document.createElement("div");
    header.className = "group-header";

    const title = document.createElement("h3");
    title.textContent = group.name;

    const count = document.createElement("span");
    count.className = "count-badge" + (members.length >= GROUP_SIZE ? " full" : "");
    count.textContent = members.length + "/" + GROUP_SIZE;
    title.appendChild(count);

    const actions = document.createElement("div");
    actions.className = "group-actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "btn-icon edit";
    renameBtn.title = "Renombrar grupo";
    renameBtn.textContent = "✏️";
    renameBtn.addEventListener("click", function () { renameGroup(group); });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-icon delete";
    deleteBtn.title = "Borrar grupo";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", function () { deleteGroup(group); });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(title);
    header.appendChild(actions);
    card.appendChild(header);

    // Resumen de nivel
    card.appendChild(levelSummary(members));

    // Zona de soltar
    const zone = document.createElement("div");
    zone.className = "dropzone char-list";
    zone.dataset.group = group.id;

    if (members.length === 0) {
        zone.appendChild(emptyHint("Arrastra personajes aquí"));
    } else {
        members.forEach(function (p) { zone.appendChild(charCard(p)); });
    }

    card.appendChild(zone);
    return card;
}

function newGroupCard() {
    const card = document.createElement("div");
    card.className = "card group-card new-group-card";

    const zone = document.createElement("div");
    zone.className = "dropzone new-group-zone";
    zone.dataset.group = NEW_GROUP;
    zone.innerHTML = '<span class="new-group-plus">+</span><span>Crear nuevo grupo</span><small>Suelta aquí un personaje</small>';

    card.appendChild(zone);
    return card;
}

function levelSummary(members) {
    const box = document.createElement("div");
    box.className = "group-summary";

    const levels = members.map(levelOf).filter(function (l) { return l !== null; });

    if (levels.length === 0) {
        box.textContent = members.length ? "Sin nivel definido" : "Grupo vacío";
        return box;
    }

    const min = Math.min.apply(null, levels);
    const max = Math.max.apply(null, levels);
    const avg = Math.round(levels.reduce(function (a, b) { return a + b; }, 0) / levels.length);
    const spread = max - min;

    box.textContent = "Nivel " + (min === max ? min : min + "–" + max) + " · media " + avg;

    if (spread > LEVEL_MARGIN) {
        box.classList.add("warn");
        box.textContent += " · ⚠️ diferencia de " + spread + " niveles";
    } else {
        box.classList.add("ok");
    }

    return box;
}

function charCard(p) {
    const card = document.createElement("div");
    card.className = "char-card";
    card.dataset.id = p.id;

    const cls = findClass(p.class);
    if (cls) card.style.borderLeftColor = cls.color;

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.title = "Arrastrar";
    card.appendChild(handle);

    const spec = findSpec(p.class, p.spec);
    if (spec && spec.icon) {
        const img = document.createElement("img");
        img.className = "spec-icon";
        img.src = spec.icon;
        img.alt = p.spec;
        img.title = p.class + " - " + p.spec;
        img.draggable = false;
        card.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "char-info";

    const name = document.createElement("span");
    name.className = "char-name";
    name.textContent = p.name || "";
    if (cls) name.style.color = cls.color;

    const owner = document.createElement("span");
    owner.className = "char-owner";
    owner.textContent = p.owner || "—";

    info.appendChild(name);
    info.appendChild(owner);
    card.appendChild(info);

    const level = document.createElement("span");
    level.className = "char-level";
    const l = levelOf(p);
    level.textContent = l === null ? "?" : l;
    level.title = "Nivel";
    card.appendChild(level);

    card.addEventListener("pointerdown", onPointerDown);
    return card;
}

function emptyHint(text) {
    const div = document.createElement("div");
    div.className = "empty-hint";
    div.textContent = text;
    return div;
}

// ---------- Drag & drop (pointer events: ratón y táctil) ----------

const DRAG_THRESHOLD = 6;
let drag = null;

function onPointerDown(e) {
    if (busy || e.button !== 0) return;

    // En táctil solo se arrastra desde el asa, para no bloquear el scroll
    const fromHandle = e.target.closest(".drag-handle");
    if (e.pointerType !== "mouse" && !fromHandle) return;

    const card = e.currentTarget;
    drag = {
        id: card.dataset.id,
        source: card,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - card.getBoundingClientRect().left,
        offsetY: e.clientY - card.getBoundingClientRect().top,
        ghost: null,
        over: null,
        pointerId: e.pointerId
    };

    if (fromHandle) e.preventDefault();

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", cancelDrag);
}

function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;

    if (!drag.ghost) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        startGhost();
    }

    e.preventDefault();
    drag.ghost.style.left = (e.clientX - drag.offsetX) + "px";
    drag.ghost.style.top = (e.clientY - drag.offsetY) + "px";

    autoScroll(e.clientY);

    const target = dropzoneAt(e.clientX, e.clientY);
    if (target !== drag.over) {
        if (drag.over) drag.over.classList.remove("drag-over", "drag-invalid");
        drag.over = target;
        if (target) target.classList.add(isValidDrop(target) ? "drag-over" : "drag-invalid");
    }
}

function startGhost() {
    const rect = drag.source.getBoundingClientRect();
    const ghost = drag.source.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.width = rect.width + "px";
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.source.classList.add("dragging");
    document.body.classList.add("is-dragging");
}

function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;

    const wasDragging = !!drag.ghost;
    const target = drag.over;
    const id = drag.id;
    const valid = target && isValidDrop(target);

    cleanupDrag();

    if (wasDragging && valid) {
        handleDrop(id, target.dataset.group);
    }
}

function cancelDrag() {
    cleanupDrag();
}

function cleanupDrag() {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.over) drag.over.classList.remove("drag-over", "drag-invalid");
    drag.source.classList.remove("dragging");
    document.body.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", cancelDrag);
    drag = null;
}

function dropzoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(".dropzone") : null;
}

function isValidDrop(zone) {
    const target = zone.dataset.group;
    const p = findPlayer(drag.id);
    if (!p) return false;

    const current = playerGroup(p);
    if (target === current) return false;
    if (target === "" || target === NEW_GROUP) return true;

    return membersOf(target).length < GROUP_SIZE;
}

function autoScroll(clientY) {
    const edge = 60;
    if (clientY < edge) window.scrollBy(0, -12);
    else if (clientY > window.innerHeight - edge) window.scrollBy(0, 12);
}

// ---------- Acciones ----------

async function handleDrop(playerId, target) {
    const p = findPlayer(playerId);
    if (!p) return;

    if (target === NEW_GROUP) {
        await createGroupWith(p);
    } else {
        await movePlayer(p, target);
    }
}

async function movePlayer(p, groupId) {
    const previous = p.group;
    p.group = groupId;
    render();

    setBusy(true);
    try {
        await postAction({ action: "setGroup", id: p.id, group: groupId });
        showMessage("", "");
    } catch (err) {
        p.group = previous;
        render();
        showMessage("Error al mover a " + p.name + ": " + err.message, "error");
    } finally {
        setBusy(false);
    }

    // Sincronizar con la hoja para ver también los cambios de otros
    await loadData({ silent: true });
}

async function createGroupWith(p) {
    const suggested = nextGroupName();
    const name = prompt("Nombre del nuevo grupo:", suggested);
    if (name === null) return;

    const finalName = name.trim() || suggested;

    setBusy(true);
    showMessage("Creando grupo...", "");
    try {
        const result = await postAction({ action: "addGroup", name: finalName });
        groups.push({ id: result.id, name: finalName, notes: "" });

        await postAction({ action: "setGroup", id: p.id, group: result.id });
        p.group = result.id;

        render();
        showMessage("Grupo \"" + finalName + "\" creado.", "success");
    } catch (err) {
        showMessage("Error al crear el grupo: " + err.message, "error");
    } finally {
        setBusy(false);
    }

    await loadData({ silent: true });
}

async function renameGroup(group) {
    const name = prompt("Nuevo nombre del grupo:", group.name);
    if (name === null || !name.trim() || name.trim() === group.name) return;

    const previous = group.name;
    group.name = name.trim();
    render();

    setBusy(true);
    try {
        await postAction({ action: "updateGroup", id: group.id, name: group.name, notes: group.notes || "" });
    } catch (err) {
        group.name = previous;
        render();
        showMessage("Error al renombrar: " + err.message, "error");
    } finally {
        setBusy(false);
    }

    await loadData({ silent: true });
}

async function deleteGroup(group) {
    const count = membersOf(group.id).length;
    const msg = count
        ? "¿Borrar \"" + group.name + "\"? Sus " + count + " personajes quedarán sin grupo."
        : "¿Borrar \"" + group.name + "\"?";
    if (!confirm(msg)) return;

    setBusy(true);
    try {
        await postAction({ action: "deleteGroup", id: group.id });
        groups = groups.filter(function (g) { return String(g.id) !== String(group.id); });
        players.forEach(function (p) {
            if (String(p.group) === String(group.id)) p.group = "";
        });
        render();
        showMessage("Grupo borrado.", "success");
    } catch (err) {
        showMessage("Error al borrar: " + err.message, "error");
    } finally {
        setBusy(false);
    }

    await loadData({ silent: true });
}

// ---------- Utilidades UI ----------

function setBusy(value) {
    busy = value;
    document.body.classList.toggle("is-busy", value);
}

function showMessage(text, type) {
    els.message.textContent = text;
    els.message.className = "message " + (type || "");
}
