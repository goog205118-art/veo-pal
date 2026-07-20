// Prompt generator data and actions for the board generator card.
// Kept as a classic script so existing inline handlers can call these functions.

const genData = {
    formats: ["主播带货", "街头采访", "教程演示", "前后反差", "开箱测评", "对比实验", "剧情短剧", "冲突夸张", "用户证言", "评论区回复", "生活方式植入"],
    openings: ["产品痛点开场", "夸张吸睛开场", "结果先给开场", "问题提问开场", "场景代入开场", "测评对比开场", "评论群回复开场", "数字清单开场"],
    attributes: ["强化主播人设", "情绪张力更强", "提前带出福利", "加入真实经历", "种草干货收尾", "单一卖点更聚焦"],
    generals: ["节奏更快", "情绪更强", "更像真实博主", "更强结果感", "更弱广告感", "强化收尾下单", "更强调产品细节", "UGC感", "更像评论区安利"],
};

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function shuffleGenerator(id) {
    const task = await getTaskDB(id);
    if (!task) return;

    task.state.format = getRandom(genData.formats);
    task.state.opening = getRandom(genData.openings);
    task.state.attribute = getRandom(genData.attributes);
    task.state.general = getRandom(genData.generals);

    await saveTaskDB(task);
    renderCard(id);
}

async function updateGeneratorState(id, key, value) {
    const task = await getTaskDB(id);
    if (!task) return;

    task.state[key] = value;
    await saveTaskDB(task);
}

async function applyGeneratorToPrompt(id, btnElement) {
    const task = await getTaskDB(id);
    if (!task) return;

    const { format, opening, attribute, general } = task.state;
    if (!format || !opening || !attribute || !general) {
        alert("请先点击【随机抽取】生成完整的组合");
        return;
    }

    document.getElementById('prompt-input').value = `【带货形式】${format} | 【开头】${opening} | 【属性】${attribute} | 【通用】${general} \n\n围绕以上要求，帮我生成...`;
    document.getElementById('floating-console').classList.remove('minimized');

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> 已应用`;
    btnElement.style.color = 'var(--success)';
    setTimeout(() => {
        btnElement.innerHTML = originalText;
        btnElement.style.color = '';
    }, 1500);
}

function buildGeneratorOptions(arr, selected) {
    let html = `<option value="" disabled ${!selected ? 'selected' : ''}>请选择...</option>`;
    arr.forEach(item => {
        html += `<option value="${item}" ${selected === item ? 'selected' : ''}>${item}</option>`;
    });
    return html;
}
