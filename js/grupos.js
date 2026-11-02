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
    message: document.getElementById("groupsMessage"),
    // Modal de nivel
    levelModal: document.getElementById("levelModal"),
    levelForm: document.getElementById("levelForm"),
    levelTitle: document.getElementById("levelTitle"),
    levelSelect: document.getElementById("levelSelect"),
    cancelLevelBtn: document.getElementById("cancelLevelBtn"),
    saveLevelBtn: document.getElementById("saveLevelBtn"),
    // Modal de grupo
    groupModal: document.getElementById("groupModal"),
    groupModalTitle: document.getElementById("groupModalTitle"),
    clearEventBtn: document.getElementById("clearEventBtn"),
    groupForm: document.getElementById("groupForm"),
    groupName: document.getElementById("groupName"),
    groupTarget: document.getElementById("groupTarget"),
    groupDate: document.getElementById("groupDate"),
    groupTime: document.getElementById("groupTime"),
    groupMinLevel: document.getElementById("groupMinLevel"),
    groupMaxLevel: document.getElementById("groupMaxLevel"),
    groupNotes: document.getElementById("groupNotes"),
    cancelGroupBtn: document.getElementById("cancelGroupBtn"),
    groupFormMessage: document.getElementById("groupFormMessage")
};

let editingGroupId = null;

const MAX_LEVEL = (typeof CONFIG.MAX_LEVEL === "number") ? CONFIG.MAX_LEVEL : 60;
let levelPlayerId = null;
let suppressClick = false;

document.addEventListener("DOMContentLoaded", init);

const AUTO_REFRESH_MS = 30000;
let loadToken = 0;

async function init() {
    await loadMasterData();
    els.refreshBtn.addEventListener("click", function () { loadData(); });
    els.searchInput.addEventListener("input", renderPool);
    initLevelModal();
    initGroupModal();

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
    renameBtn.title = "Editar grupo";
    renameBtn.textContent = "✏️";
    renameBtn.addEventListener("click", function () { openGroupModal(group, "group"); });

    const eventBtn = document.createElement("button");
    eventBtn.className = "btn-icon event";
    eventBtn.title = "Datos del evento";
    eventBtn.textContent = "🕒";
    eventBtn.addEventListener("click", function () { openGroupModal(group, "event"); });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-icon delete";
    deleteBtn.title = "Borrar grupo";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", function () { deleteGroup(group); });

    actions.appendChild(eventBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(title);
    header.appendChild(actions);
    card.appendChild(header);

    // Objetivo, fecha y rango requerido
    const plan = groupPlan(group);
    if (plan) card.appendChild(plan);

    // Resumen de nivel
    card.appendChild(levelSummary(members));

    // Zona de soltar
    const zone = document.createElement("div");
    zone.className = "dropzone char-list";
    zone.dataset.group = group.id;

    if (members.length === 0) {
        zone.appendChild(emptyHint("Arrastra personajes aquí"));
    } else {
        members.forEach(function (p) { zone.appendChild(charCard(p, group)); });
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

function charCard(p, group) {
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
    const range = group ? levelRange(group) : null;
    if (range && l !== null && (l < range.min || l > range.max)) {
        level.classList.add("out-of-range");
        level.title = "Fuera del rango " + range.min + "–" + range.max;
    }
    card.appendChild(level);

    card.addEventListener("pointerdown", onPointerDown);
    card.addEventListener("click", function () {
        if (suppressClick || busy) return;
        openLevelModal(p.id);
    });
    card.title = "Clic para cambiar el nivel";
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

    if (wasDragging) {
        // El navegador lanza un click al soltar; ignorarlo tras un arrastre
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 0);
    }

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
        groups.push({
            id: result.id, name: finalName, notes: "",
            target: "", date: "", time: "", minLevel: "", maxLevel: ""
        });

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

// ---------- Plan del grupo (objetivo, fecha, hora, niveles) ----------

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Rango de nivel requerido; null si no hay ninguno definido
function levelRange(group) {
    const min = parseInt(group.minLevel, 10);
    const max = parseInt(group.maxLevel, 10);
    if (isNaN(min) && isNaN(max)) return null;
    return { min: isNaN(min) ? 1 : min, max: isNaN(max) ? MAX_LEVEL : max };
}

// "2025-06-13" -> "vie 13/06"
function formatDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    if (!m) return String(value || "");
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return WEEKDAYS[d.getDay()] + " " + m[3] + "/" + m[2];
}

function groupPlan(group) {
    const parts = [];
    if (group.target) parts.push("🎯 " + group.target);

    const when = [group.date ? formatDate(group.date) : "", group.time || ""]
        .filter(Boolean).join(" · ");
    if (when) parts.push("📅 " + when);

    const range = levelRange(group);
    if (range) parts.push("Niv. " + range.min + "–" + range.max);

    if (parts.length === 0) return null;

    const box = document.createElement("div");
    box.className = "group-plan";
    box.textContent = parts.join(" · ");
    if (group.notes) box.title = group.notes;
    return box;
}

function initGroupModal() {
    els.groupForm.addEventListener("submit", saveGroup);
    els.cancelGroupBtn.addEventListener("click", closeGroupModal);
    els.clearEventBtn.addEventListener("click", function () {
        els.groupTarget.value = "";
        els.groupDate.value = "";
        els.groupTime.value = "";
        els.groupMinLevel.value = "";
        els.groupMaxLevel.value = "";
        els.groupTarget.focus();
    });
    els.groupModal.addEventListener("click", function (e) {
        if (e.target === els.groupModal) closeGroupModal();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && editingGroupId !== null) closeGroupModal();
    });
}

function openGroupModal(group, mode) {
    const isEvent = mode === "event";
    editingGroupId = group.id;
    els.groupModal.dataset.mode = isEvent ? "event" : "group";
    els.groupModalTitle.textContent = isEvent
        ? "Evento de " + (group.name || "")
        : "Editar grupo";

    // Se rellenan todos los campos; los ocultos conservan su valor al guardar
    els.groupName.value = group.name || "";
    els.groupTarget.value = group.target || "";
    els.groupDate.value = group.date || "";
    els.groupTime.value = group.time || "";
    els.groupMinLevel.value = group.minLevel === "" || group.minLevel === undefined ? "" : group.minLevel;
    els.groupMaxLevel.value = group.maxLevel === "" || group.maxLevel === undefined ? "" : group.maxLevel;
    els.groupNotes.value = group.notes || "";
    showGroupFormMessage("", "");
    els.groupModal.classList.remove("hidden");
    (isEvent ? els.groupTarget : els.groupName).focus();
}

function closeGroupModal() {
    editingGroupId = null;
    els.groupModal.classList.add("hidden");
}

function showGroupFormMessage(text, type) {
    els.groupFormMessage.textContent = text;
    els.groupFormMessage.className = "message " + (type || "");
}

async function saveGroup(event) {
    event.preventDefault();

    const group = groups.find(function (g) { return String(g.id) === String(editingGroupId); });
    if (!group) {
        closeGroupModal();
        return;
    }

    const minLevel = els.groupMinLevel.value === "" ? "" : parseInt(els.groupMinLevel.value, 10);
    const maxLevel = els.groupMaxLevel.value === "" ? "" : parseInt(els.groupMaxLevel.value, 10);

    const updated = {
        name: els.groupName.value.trim(),
        target: els.groupTarget.value.trim(),
        date: els.groupDate.value,
        time: els.groupTime.value,
        minLevel: minLevel,
        maxLevel: maxLevel,
        notes: els.groupNotes.value.trim()
    };

    if (!updated.name) {
        showGroupFormMessage("El grupo necesita un nombre.", "error");
        return;
    }
    if (minLevel !== "" && maxLevel !== "" && minLevel > maxLevel) {
        showGroupFormMessage("El nivel mínimo no puede ser mayor que el máximo.", "error");
        return;
    }

    const previous = Object.assign({}, group);
    Object.assign(group, updated);
    closeGroupModal();
    render();

    setBusy(true);
    try {
        await postAction(Object.assign({ action: "updateGroup", id: group.id }, updated));
        showMessage("Grupo \"" + group.name + "\" guardado.", "success");
    } catch (err) {
        Object.assign(group, previous);
        render();
        showMessage("Error al guardar el grupo: " + err.message, "error");
    } finally {
        setBusy(false);
    }

    await loadData({ silent: true });
}

// ---------- Nivel ----------

function initLevelModal() {
    for (let i = 1; i <= MAX_LEVEL; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        els.levelSelect.appendChild(opt);
    }

    els.levelForm.addEventListener("submit", saveLevel);
    els.cancelLevelBtn.addEventListener("click", closeLevelModal);
    els.levelModal.addEventListener("click", function (e) {
        if (e.target === els.levelModal) closeLevelModal();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && levelPlayerId !== null) closeLevelModal();
    });
}

function openLevelModal(playerId) {
    const p = findPlayer(playerId);
    if (!p) return;

    levelPlayerId = p.id;
    els.levelTitle.textContent = "Nivel de " + (p.name || "");

    const current = levelOf(p);
    els.levelSelect.value = current === null ? 1 : Math.min(Math.max(current, 1), MAX_LEVEL);

    els.levelModal.classList.remove("hidden");
    els.levelSelect.focus();
}

function closeLevelModal() {
    levelPlayerId = null;
    els.levelModal.classList.add("hidden");
}

async function saveLevel(event) {
    event.preventDefault();

    const p = findPlayer(levelPlayerId);
    if (!p) {
        closeLevelModal();
        return;
    }

    const newLevel = parseInt(els.levelSelect.value, 10);
    const previous = p.level;
    closeLevelModal();

    if (levelOf(p) === newLevel) return;

    p.level = newLevel;
    render();

    setBusy(true);
    try {
        await postAction({ action: "setLevel", id: p.id, level: newLevel });
        showMessage(p.name + " ahora es nivel " + newLevel + ".", "success");
    } catch (err) {
        p.level = previous;
        render();
        showMessage("Error al cambiar el nivel: " + err.message, "error");
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
