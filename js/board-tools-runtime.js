// Runtime actions for lightweight board tools: frames and sticky notes.
// Kept global for the current classic-script UI and inline handlers.

async function updateTaskField(id, key, val) {
    const task = await getTaskDB(id);
    if (!task) return;

    task[key] = val;
    await saveTaskDB(task);
}

async function toggleFrameCollapse(id) {
    const frame = await getTaskDB(id);
    if (!frame) return;

    frame.isCollapsed = !frame.isCollapsed;
    await saveTaskDB(frame);
    await renderBoard();
}

async function removeFrame(id) {
    if (!confirm('📦 确定要解散这个项目组吗？\n(内部卡片将安全保留在画布上)')) return;

    await deleteTaskDB(id);
    const tasks = await getAllTasksDB();
    for (let task of tasks) {
        if (task.parentId === id) {
            delete task.parentId;
            await saveTaskDB(task);
        }
    }

    await renderBoard();
    showToast("项目组已解散", "success");
}

async function createStickyNote(spawnX, spawnY) {
    if (spawnX === undefined) spawnX = (-transform.x + window.innerWidth / 2 - 120) / transform.scale;
    if (spawnY === undefined) spawnY = (-transform.y + window.innerHeight / 2 - 80) / transform.scale;

    await saveTaskDB({
        id: 'note_' + Date.now() + Math.random().toString(36).substr(2, 5),
        type: 'note',
        text: '',
        x: spawnX,
        y: spawnY,
        width: 260,
        height: 200,
        timestamp: Date.now(),
    });
    renderBoard();
}

let noteSaveTimeout;

async function updateNoteText(id, text) {
    clearTimeout(noteSaveTimeout);
    noteSaveTimeout = setTimeout(async () => {
        const note = await getTaskDB(id);
        if (!note) return;

        note.text = text;
        await saveTaskDB(note);
    }, 500);
}

function saveNoteSize(id, w, h) {
    setTimeout(async () => {
        const note = await getTaskDB(id);
        if (!note || (note.width === w && note.height === h)) return;

        note.width = w;
        note.height = h;
        await saveTaskDB(note);
        renderMinimap();
    }, 100);
}
