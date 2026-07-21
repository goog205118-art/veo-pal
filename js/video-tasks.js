// ==========================================
// Video task submission, retry, and polling
// ==========================================
(function () {
    const activeTaskIds = new Set();
    const activeRetries = new Set();
    const pollControllers = new Map();
    const pollTimers = new Map();

    function isActive(taskId) {
        return activeTaskIds.has(taskId);
    }

    function removeActive(taskId) {
        activeTaskIds.delete(taskId);
    }

    function clearPolling(taskId, removeActiveTask = true) {
        const controller = pollControllers.get(taskId);
        if (controller) {
            try { controller.abort(); } catch (err) {}
            pollControllers.delete(taskId);
        }
        const timerId = pollTimers.get(taskId);
        if (timerId) {
            clearTimeout(timerId);
            pollTimers.delete(taskId);
        }
        if (removeActiveTask) removeActive(taskId);
    }

    async function submitBatchTask() {
        const promptInput = document.getElementById('prompt-input');
        const prompt = promptInput ? promptInput.value.trim() : '';
        if (!prompt) return alert('请填写提示词');

        const batchSelect = document.getElementById('batch-select');
        const generateBtn = document.getElementById('generate-btn');
        const batchCount = batchSelect ? parseInt(batchSelect.value, 10) : 1;
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>`;
        }

        const state = globalStore.getState();
        const inputMode = state.currentMode === 'frame' ? 'frame' : 'ref';
        let submitRef = [...state.references];
        let submitFirst = state.firstFrame;
        let submitLast = state.lastFrame;
        if (inputMode === 'ref') {
            submitFirst = null;
            submitLast = null;
        } else {
            submitRef = [];
        }
        const taskParams = {
            model: buildVideoSubmitModel(state.model, inputMode),
            inputMode,
            aspectRatio: state.aspectRatio,
            enhancePrompt: state.enhancePrompt,
            enableUpsample: state.enableUpsample,
            autoRetry: state.autoRetry,
            firstFrame: submitFirst,
            lastFrame: submitLast,
            references: submitRef
        };

        const promises = [];
        const count = Number.isFinite(batchCount) && batchCount > 0 ? batchCount : 1;
        for (let i = 0; i < count; i++) promises.push(executeSubmission(taskParams, prompt, i));

        await Promise.allSettled(promises);
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = `<span class="material-symbols-outlined">arrow_upward</span>`;
        }
        updateEstimatedCost();
        if (promptInput) promptInput.value = '';

        clearFrame(null, 'firstFrame');
        clearFrame(null, 'lastFrame');
        clearReferences({ stopPropagation() {} });
        const firstFile = document.getElementById('first-file');
        const lastFile = document.getElementById('last-file');
        const refFile = document.getElementById('ref-file');
        if (firstFile) firstFile.value = '';
        if (lastFile) lastFile.value = '';
        if (refFile) refFile.value = '';
    }

    async function executeSubmission(params, promptText, offsetIndex = 0) {
        try {
            const apiPayload = {
                model: params.model,
                prompt: promptText,
                aspectRatio: params.aspectRatio,
                enhancePrompt: params.enhancePrompt,
                enableUpsample: params.enableUpsample,
                firstFrame: await blobToBase64(params.firstFrame, { mode: 'network' }),
                lastFrame: await blobToBase64(params.lastFrame, { mode: 'network' }),
                references: await blobsToBase64Sequential(params.references, { mode: 'network' })
            };
            const response = await window.VeoApi.postEndpoint('video.submit', apiPayload);

            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                throw new Error('密码错误');
            }
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API 返回异常: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            const returnedId = data.taskId || data.id || data.task_id;

            if (returnedId) {
                const spawnX = (-transform.x + window.innerWidth / 2 - 170) / transform.scale + (offsetIndex * 360);
                const spawnY = (-transform.y + window.innerHeight / 2 - 150) / transform.scale + (offsetIndex * 40);
                const taskMode = params.inputMode || (params.references && params.references.length > 0 ? 'ref' : 'frame');
                const displayModelName = getVideoModelDisplayName(params.model, taskMode);
                const newTask = {
                    id: returnedId,
                    prompt: promptText,
                    modelStr: displayModelName,
                    modelVal: params.model,
                    ratio: params.aspectRatio,
                    autoRetry: params.autoRetry,
                    retryCount: 0,
                    rawImages: {
                        firstFrame: params.firstFrame,
                        lastFrame: params.lastFrame,
                        references: params.references || []
                    },
                    mode: taskMode,
                    inputMode: taskMode,
                    status: 'processing',
                    progress: null,
                    timestamp: Date.now(),
                    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    videoUrl: null,
                    x: spawnX,
                    y: spawnY,
                    isBilled: false
                };
                await saveTaskDB(newTask);
                await renderBoard();
            }
        } catch (error) {
            console.error('任务提交失败:', error);
            showToast('视频生成提交失败，请检查网络或余额。', 'error');
        }
    }

    async function retryTask(taskId, btnElement) {
        if (activeRetries.has(taskId)) return;
        activeRetries.add(taskId);
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:18px;height:18px;stroke:var(--text-sub);"><circle cx="25" cy="25" r="20"></circle></svg>`;
        }
        const task = await getTaskDB(taskId);
        if (!task) {
            activeRetries.delete(taskId);
            return;
        }
        try {
            const apiPayload = {
                model: task.modelVal,
                prompt: task.prompt,
                aspectRatio: task.ratio,
                enhancePrompt: true,
                enableUpsample: false,
                firstFrame: await blobToBase64(task.rawImages.firstFrame, { mode: 'network' }),
                lastFrame: await blobToBase64(task.rawImages.lastFrame, { mode: 'network' }),
                references: await blobsToBase64Sequential((task.rawImages.references || []), { mode: 'network' })
            };
            const response = await window.VeoApi.postEndpoint('video.submit', apiPayload);
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                throw new Error('密码错误');
            }
            if (!response.ok) throw new Error('API 异常');
            const data = await response.json();
            const returnedId = data.taskId || data.id || data.task_id;
            if (returnedId) {
                clearPolling(taskId);
                await deleteTaskDB(taskId);
                task.id = returnedId;
                task.status = 'processing';
                task.progress = null;
                task.retryCount = (task.retryCount || 0) + 1;
                task.timestamp = Date.now();
                task.time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                task.isBilled = false;
                await saveTaskDB(task);
                activeRetries.delete(taskId);
                await renderBoard();
            } else {
                throw new Error('无返回 ID');
            }
        } catch (error) {
            task.status = 'failed';
            task.autoRetry = false;
            await saveTaskDB(task);
            activeRetries.delete(taskId);
            renderCard(taskId);
        }
    }

    function ensurePollingTask(task) {
        if (!task || task.type || task.status !== 'processing' || !task.id) return false;
        if (activeTaskIds.has(task.id)) return false;
        activeTaskIds.add(task.id);
        startPolling(task.id);
        return true;
    }

    function startPolling(taskId) {
        clearPolling(taskId, false);
        activeTaskIds.add(taskId);
        let attempts = 0;
        let errorCount = 0;
        const maxAttempts = 240;
        const maxConsecutiveErrors = 20;
        const scheduleNextPoll = (delayMs = 15000) => {
            const safeDelay = Math.max(500, toFiniteNumber(delayMs, 15000));
            const timerId = setTimeout(() => {
                poll().catch(() => {});
            }, safeDelay);
            pollTimers.set(taskId, timerId);
        };
        const poll = async () => {
            pollTimers.delete(taskId);
            attempts++;
            try {
                const task = await getTaskDB(taskId);
                if (!task) {
                    clearPolling(taskId);
                    return;
                }
                if (task.type) {
                    clearPolling(taskId);
                    return;
                }
                if (!task.modelVal) {
                    clearPolling(taskId);
                    return;
                }
                const currentPwd = sessionStorage.getItem('veo_admin_pwd');
                if (!currentPwd) {
                    scheduleNextPoll(2000);
                    return;
                }

                const controller = new AbortController();
                pollControllers.set(taskId, controller);
                const response = await window.VeoApi.postEndpoint('video.poll', { taskId, model: task.modelVal }, { signal: controller.signal });
                pollControllers.delete(taskId);
                if (response.status === 401 || response.status === 403) {
                    clearPolling(taskId);
                    handleAuthError();
                    return;
                }
                if (!response.ok) throw new Error('API 异常');
                const data = await response.json();
                errorCount = 0;

                const currentStatus = (data.status || data.state || 'processing').toLowerCase();
                const currentVideoUrl = data.videoUrl || data.video_url || data.url;

                if (data && (currentStatus === 'success' || currentStatus === 'completed' || currentStatus === 'succeeded') && currentVideoUrl) {
                    clearPolling(taskId);
                    task.status = 'success';
                    task.videoUrl = currentVideoUrl;
                    if (!task.isBilled) {
                        const billingInfo = getVideoBillingInfo(task.modelVal);
                        await addBillingRecord({
                            id: 'bill_' + task.id,
                            taskId: task.id,
                            type: 'video',
                            cost: billingInfo.cost,
                            detail: billingInfo.detail
                        });
                        task.isBilled = true;
                        updateBillingUI();
                        if (window.VeoBilling && typeof window.VeoBilling.refreshBalanceAfterUsage === 'function') {
                            window.VeoBilling.refreshBalanceAfterUsage();
                        }
                    }
                    await saveTaskDB(task);
                    renderCard(taskId);
                    return;
                }
                if (data && (currentStatus === 'failed' || currentStatus === 'error' || currentStatus === 'canceled' || currentStatus === 'rejected')) {
                    clearPolling(taskId);
                    if (task.autoRetry) retryTask(task.id, null);
                    else {
                        task.status = 'failed';
                        await saveTaskDB(task);
                        renderCard(taskId);
                    }
                    return;
                }
                if (data && (currentStatus === 'processing' || currentStatus === 'pending' || currentStatus === 'queued' || currentStatus === 'in_progress') && data.progress && task.progress !== data.progress) {
                    task.progress = data.progress;
                    await saveTaskDB(task);
                    renderCard(taskId);
                }

                if (attempts < maxAttempts) scheduleNextPoll(15000);
                else {
                    clearPolling(taskId);
                    if (task.autoRetry) retryTask(task.id, null);
                    else {
                        task.status = 'failed';
                        await saveTaskDB(task);
                        renderCard(taskId);
                    }
                }
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                errorCount++;
                pollControllers.delete(taskId);
                const task = await getTaskDB(taskId);
                if (!task) {
                    clearPolling(taskId);
                    return;
                }
                if (errorCount >= maxConsecutiveErrors || attempts >= maxAttempts) {
                    clearPolling(taskId);
                    if (task.autoRetry) retryTask(task.id, null);
                    else {
                        task.status = 'failed';
                        await saveTaskDB(task);
                        renderCard(taskId);
                    }
                    return;
                }
                scheduleNextPoll(15000);
            }
        };
        poll();
    }

    window.VeoVideoTasks = {
        clearPolling,
        ensurePollingTask,
        executeSubmission,
        getVideoBillingInfo,
        isActive,
        removeActive,
        retryTask,
        startPolling,
        submitBatchTask
    };
})();
