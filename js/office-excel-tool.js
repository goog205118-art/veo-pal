(function (window, document) {
    'use strict';

    const SETTINGS_KEY = 'veoOfficeExcelToolSettings';
    const SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    const MAX_PREVIEW_ROWS = 10;

    const docTypes = {
        product: {
            label: '商品详情页',
            filePrefix: 'product-detail',
            template: [
                ['商品详情页', '{{sku}}'],
                ['目标国家', '{{country}}'],
                ['标题', '{{title}}'],
                ['价格', '{{price}}'],
                ['卖点1', '{{feature_1}}'],
                ['卖点2', '{{feature_2}}'],
                ['卖点3', '{{feature_3}}'],
                ['规格', '{{spec}}'],
                ['合规备注', '{{compliance_note}}']
            ]
        },
        purchase: {
            label: '采购单',
            filePrefix: 'purchase-order',
            template: [
                ['采购单号', '{{po_no}}'],
                ['供应商', '{{supplier}}'],
                ['SKU', '{{sku}}'],
                ['数量', '{{quantity}}'],
                ['单价', '{{price}}'],
                ['国家', '{{country}}'],
                ['交付日期', '{{delivery_date}}']
            ]
        },
        quotation: {
            label: '报价单',
            filePrefix: 'quotation',
            template: [
                ['报价编号', '{{quote_no}}'],
                ['客户国家', '{{country}}'],
                ['SKU', '{{sku}}'],
                ['产品名', '{{title}}'],
                ['报价', '{{price}}'],
                ['有效期', '{{valid_until}}'],
                ['贸易条款', '{{trade_terms}}']
            ]
        },
        invoice: {
            label: '发票',
            filePrefix: 'invoice',
            template: [
                ['Invoice No.', '{{invoice_no}}'],
                ['Country', '{{country}}'],
                ['SKU', '{{sku}}'],
                ['Description', '{{title}}'],
                ['Qty', '{{quantity}}'],
                ['Unit Price', '{{price}}'],
                ['Amount', '{{amount}}']
            ]
        },
        packing: {
            label: '装箱单',
            filePrefix: 'packing-list',
            template: [
                ['Packing List No.', '{{packing_no}}'],
                ['SKU', '{{sku}}'],
                ['Country', '{{country}}'],
                ['Cartons', '{{cartons}}'],
                ['Gross Weight', '{{gross_weight}}'],
                ['Net Weight', '{{net_weight}}'],
                ['Dimensions', '{{dimensions}}']
            ]
        },
        email: {
            label: '邮件回复',
            filePrefix: 'email-reply',
            template: [
                ['邮件主题', 'Re: {{sku}} inquiry for {{country}}'],
                ['称呼', 'Dear {{customer_name}},'],
                ['正文', 'Thank you for your inquiry. The current offer for {{sku}} is {{price}}. Delivery country: {{country}}.'],
                ['补充说明', '{{email_note}}'],
                ['签名', '{{brand_name}} Team']
            ]
        }
    };

    const defaultSettings = {
        localePreset: 'US',
        dateFormat: 'YYYY-MM-DD',
        defaultDocType: 'product',
        requiredFields: 'sku,price,country',
        bannedWords: 'best,guaranteed,permanent,cure,治愈,永久,绝对',
        fieldAliases: [
            'sku=SKU,商品编码,货号,产品编码',
            'price=价格,单价,报价,售价,Price',
            'country=国家,站点,市场,Country',
            'title=标题,商品名,产品名,Title',
            'quantity=数量,Qty,库存',
            'supplier=供应商,工厂'
        ].join('\n')
    };

    let settings = { ...defaultSettings };
    let activeLayer = 'work';
    let sourceFile = null;
    let templateFile = null;
    let sourceRows = [];
    let sourceHeaders = [];
    let templateWorkbook = null;
    let templateSheetName = '';
    let templatePlaceholders = [];
    let generated = [];
    let issues = [];

    const byId = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function loadSettings() {
        try {
            settings = { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) };
        } catch (error) {
            settings = { ...defaultSettings };
        }
    }

    function saveSettings() {
        settings = {
            localePreset: byId('office-excel-locale').value,
            dateFormat: byId('office-excel-date-format').value.trim() || defaultSettings.dateFormat,
            defaultDocType: byId('office-excel-default-doc').value,
            requiredFields: byId('office-excel-required-fields').value.trim(),
            bannedWords: byId('office-excel-banned-words').value.trim(),
            fieldAliases: byId('office-excel-field-aliases').value.trim()
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        setDocType(settings.defaultDocType);
        toast('设置已保存');
    }

    function loadScriptOnce(src, globalName) {
        return new Promise((resolve, reject) => {
            if (globalName && window[globalName]) {
                resolve(true);
                return;
            }
            const existing = Array.from(document.scripts).find((script) => script.src === src);
            if (existing) {
                existing.addEventListener('load', () => resolve(true), { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('表格解析库加载失败'));
            document.head.appendChild(script);
        });
    }

    async function ensureXlsx() {
        if (!window.XLSX) await loadScriptOnce(SHEETJS_CDN, 'XLSX');
        if (!window.XLSX) throw new Error('XLSX 库不可用');
    }

    function readAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function rowsFromSheet(sheet) {
        return window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    }

    function findHeaderIndex(rows) {
        let best = 0;
        let count = 0;
        rows.forEach((row, index) => {
            const filled = row.filter((cell) => String(cell || '').trim()).length;
            if (filled > count) {
                best = index;
                count = filled;
            }
        });
        return best;
    }

    function rowsToObjects(rows) {
        if (!rows.length) return { headers: [], rows: [] };
        const headerIndex = findHeaderIndex(rows);
        const headers = rows[headerIndex].map((cell, index) => String(cell || `Column ${index + 1}`).trim());
        const items = rows.slice(headerIndex + 1)
            .filter((row) => row.some((cell) => String(cell || '').trim()))
            .map((row) => {
                const item = {};
                headers.forEach((header, index) => {
                    item[header] = row[index] == null ? '' : row[index];
                });
                return item;
            });
        return { headers, rows: items };
    }

    async function parseWorkbook(file) {
        await ensureXlsx();
        const buffer = await readAsArrayBuffer(file);
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = sheet ? rowsFromSheet(sheet) : [];
        return { workbook, sheetName, rawRows, ...rowsToObjects(rawRows) };
    }

    function parseAliasMap() {
        const map = {};
        String(settings.fieldAliases || '').split(/\n+/).forEach((line) => {
            const parts = line.split('=');
            if (parts.length < 2) return;
            const key = parts[0].trim();
            const aliases = parts[1].split(',').map((value) => value.trim()).filter(Boolean);
            if (key) map[key.toLowerCase()] = [key, ...aliases];
        });
        return map;
    }

    function findField(row, field) {
        const aliasMap = parseAliasMap();
        const aliases = aliasMap[String(field).toLowerCase()] || [field];
        const keys = Object.keys(row || {});
        const matched = keys.find((key) => aliases.some((alias) => key.toLowerCase() === alias.toLowerCase()));
        if (matched) return row[matched];
        const loose = keys.find((key) => aliases.some((alias) => key.toLowerCase().includes(alias.toLowerCase())));
        return loose ? row[loose] : '';
    }

    function getCurrencySymbol(country) {
        const preset = String(settings.localePreset || '').toUpperCase();
        const value = String(country || preset).toUpperCase();
        if (value.includes('JP') || value.includes('JAPAN') || value.includes('日本')) return 'JPY ';
        if (value.includes('DE') || value.includes('FR') || value.includes('IT') || value.includes('ES') || value.includes('EU')) return 'EUR ';
        if (value.includes('AE') || value.includes('UAE') || value.includes('阿拉伯')) return 'AED ';
        if (value.includes('CN') || value.includes('中国')) return 'CNY ';
        return 'USD ';
    }

    function formatField(field, value, sourceRow) {
        const raw = value == null ? '' : String(value).trim();
        if (!raw) return '';
        const name = String(field || '').toLowerCase();
        if (name.includes('price') || name.includes('amount')) {
            if (/^[A-Z]{3}\s|^\$|^€|^¥|^￥/.test(raw)) return raw;
            const numeric = Number(raw.replace(/[^\d.-]/g, ''));
            if (Number.isFinite(numeric)) return `${getCurrencySymbol(findField(sourceRow, 'country'))}${numeric.toFixed(2)}`;
        }
        if (name.includes('date') || name.includes('until')) return formatDate(raw);
        return raw;
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const fmt = settings.dateFormat || 'YYYY-MM-DD';
        if (fmt === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
        if (fmt === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`;
        if (fmt === 'YYYY/MM/DD') return `${yyyy}/${mm}/${dd}`;
        return `${yyyy}-${mm}-${dd}`;
    }

    function extractPlaceholdersFromText(text) {
        const found = new Set();
        String(text || '').replace(/\{\{\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*\}\}/g, (match, key) => {
            found.add(key.trim());
            return match;
        });
        return Array.from(found);
    }

    function extractTemplatePlaceholders() {
        const found = new Set();
        if (templateWorkbook && templateSheetName) {
            const sheet = templateWorkbook.Sheets[templateSheetName];
            Object.keys(sheet || {}).forEach((addr) => {
                if (addr[0] === '!') return;
                extractPlaceholdersFromText(sheet[addr].v).forEach((field) => found.add(field));
            });
        } else {
            const doc = docTypes[getSelectedDocType()];
            doc.template.flat().forEach((cell) => extractPlaceholdersFromText(cell).forEach((field) => found.add(field)));
        }
        templatePlaceholders = Array.from(found);
    }

    function getSelectedDocType() {
        return byId('office-excel-doc-type')?.value || settings.defaultDocType || 'product';
    }

    function setDocType(value) {
        const select = byId('office-excel-doc-type');
        if (select && docTypes[value]) select.value = value;
        extractTemplatePlaceholders();
        renderTemplateFields();
        renderPreview();
    }

    function buildContext(row) {
        const context = {};
        const fields = new Set([
            ...templatePlaceholders,
            ...String(settings.requiredFields || '').split(',').map((field) => field.trim()).filter(Boolean)
        ]);
        fields.forEach((field) => {
            context[field] = formatField(field, findField(row, field), row);
        });
        return context;
    }

    function fillText(text, context) {
        return String(text == null ? '' : text).replace(/\{\{\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*\}\}/g, (match, key) => {
            const value = context[key.trim()];
            return value == null || value === '' ? match : String(value);
        });
    }

    function cloneSheetWithContext(sheet, context) {
        const next = {};
        Object.keys(sheet || {}).forEach((addr) => {
            const cell = sheet[addr];
            if (addr[0] === '!') {
                next[addr] = Array.isArray(cell) ? cell.slice() : cell;
                return;
            }
            next[addr] = { ...cell };
            if (typeof cell.v === 'string') {
                next[addr].v = fillText(cell.v, context);
                next[addr].w = next[addr].v;
            }
        });
        return next;
    }

    function builtInSheet(context) {
        const rows = docTypes[getSelectedDocType()].template.map((row) => row.map((cell) => fillText(cell, context)));
        return window.XLSX.utils.aoa_to_sheet(rows);
    }

    function validateOutput(items) {
        const list = [];
        const required = String(settings.requiredFields || '').split(',').map((field) => field.trim()).filter(Boolean);
        const banned = String(settings.bannedWords || '').split(',').map((word) => word.trim()).filter(Boolean);
        items.forEach((item, index) => {
            required.forEach((field) => {
                if (!String(item.context[field] || '').trim()) {
                    list.push({ level: 'danger', row: index + 1, title: `缺失字段 {{${field}}}`, detail: '模板生成前需要补齐该字段。' });
                }
            });
            const text = JSON.stringify(item.context);
            banned.forEach((word) => {
                if (word && text.toLowerCase().includes(word.toLowerCase())) {
                    list.push({ level: 'danger', row: index + 1, title: `命中禁用词 ${word}`, detail: '建议替换为更保守的跨境平台表达。' });
                }
            });
            Object.entries(item.context).forEach(([field, value]) => {
                if ((field.toLowerCase().includes('title') || field.includes('标题')) && String(value).length > 80) {
                    list.push({ level: 'warn', row: index + 1, title: '标题过长', detail: '建议控制在 80 字符以内，避免移动端折行过多。' });
                }
                if (String(value).includes('{{')) {
                    list.push({ level: 'warn', row: index + 1, title: '仍有未替换占位符', detail: String(value).slice(0, 100) });
                }
            });
            const country = String(item.context.country || '').toUpperCase();
            const joined = text.toLowerCase();
            if ((country.includes('DE') || country.includes('EU')) && (joined.includes(' inch') || joined.includes(' lb'))) {
                list.push({ level: 'warn', row: index + 1, title: '欧盟站单位疑似未本地化', detail: '建议统一检查 cm / kg 单位。' });
            }
        });
        return list;
    }

    function applyTemplate() {
        if (!sourceRows.length) {
            toast('请先导入 Excel / CSV 数据', true);
            return;
        }
        extractTemplatePlaceholders();
        const limit = Math.max(1, Math.min(500, Number(byId('office-excel-row-limit').value) || sourceRows.length));
        generated = sourceRows.slice(0, limit).map((row, index) => {
            const context = buildContext(row);
            return {
                index,
                source: row,
                context,
                sheetName: `${String(context.sku || index + 1).slice(0, 24) || `Row${index + 1}`}`.replace(/[\\/?*[\]:]/g, '-')
            };
        });
        issues = validateOutput(generated);
        renderAll();
        toast(`已套用 ${generated.length} 行模板`);
    }

    async function handleSourceFiles(fileList) {
        const file = Array.from(fileList || [])[0];
        if (!file) return;
        try {
            sourceFile = file;
            const parsed = await parseWorkbook(file);
            sourceRows = parsed.rows;
            sourceHeaders = parsed.headers;
            generated = [];
            issues = [];
            renderAll();
            toast(`已读取 ${sourceRows.length} 行数据`);
        } catch (error) {
            console.error(error);
            toast(error.message || '源数据解析失败', true);
        }
    }

    async function handleTemplateFiles(fileList) {
        const file = Array.from(fileList || [])[0];
        if (!file) return;
        try {
            templateFile = file;
            const parsed = await parseWorkbook(file);
            templateWorkbook = parsed.workbook;
            templateSheetName = parsed.sheetName;
            extractTemplatePlaceholders();
            generated = [];
            issues = [];
            renderAll();
            toast(`已识别 ${templatePlaceholders.length} 个模板字段`);
        } catch (error) {
            console.error(error);
            toast(error.message || '模板解析失败', true);
        }
    }

    function exportWorkbook() {
        if (!generated.length) {
            toast('暂无可导出的批量结果', true);
            return;
        }
        const workbook = window.XLSX.utils.book_new();
        generated.forEach((item, index) => {
            const sourceSheet = templateWorkbook && templateSheetName ? templateWorkbook.Sheets[templateSheetName] : null;
            const sheet = sourceSheet ? cloneSheetWithContext(sourceSheet, item.context) : builtInSheet(item.context);
            const safeName = item.sheetName || `Row${index + 1}`;
            window.XLSX.utils.book_append_sheet(workbook, sheet, safeName.slice(0, 31));
        });
        const date = new Date();
        const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        const prefix = docTypes[getSelectedDocType()].filePrefix;
        window.XLSX.writeFile(workbook, `${prefix}-batch-${stamp}.xlsx`);
        toast('已导出批量文档 xlsx');
    }

    function renderTable(targetId, rows, headers, fallback) {
        const target = byId(targetId);
        if (!target) return;
        if (!rows.length || !headers.length) {
            target.className = 'office-excel-empty';
            target.innerHTML = fallback;
            return;
        }
        target.className = 'office-excel-table-wrap';
        target.innerHTML = `
            <table class="office-excel-table">
                <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>${rows.slice(0, MAX_PREVIEW_ROWS).map((row) => `
                    <tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>
                `).join('')}</tbody>
            </table>
        `;
    }

    function renderSourcePreview() {
        renderTable('office-excel-source-preview', sourceRows, sourceHeaders, '导入 Excel / CSV 后在这里预览源数据');
        const meta = byId('office-excel-source-meta');
        if (meta) meta.textContent = sourceFile ? `${sourceFile.name} / ${sourceRows.length} 行` : '未导入源数据';
    }

    function renderTemplateFields() {
        const box = byId('office-excel-template-fields');
        if (!box) return;
        const fields = templatePlaceholders.length ? templatePlaceholders : extractPlaceholdersFromText(JSON.stringify(docTypes[getSelectedDocType()].template));
        box.innerHTML = fields.length
            ? fields.map((field) => `<span class="office-excel-chip">{{${escapeHtml(field)}}}</span>`).join('')
            : '<span class="office-excel-chip">未识别字段</span>';
        const meta = byId('office-excel-template-meta');
        if (meta) meta.textContent = templateFile ? `${templateFile.name} / ${fields.length} 字段` : `内置模板 / ${fields.length} 字段`;
    }

    function renderIssues() {
        const box = byId('office-excel-issues');
        if (!box) return;
        if (!issues.length) {
            box.innerHTML = '<div class="office-excel-issue ok"><b>质检通过</b><span>当前批次暂无敏感词、缺失字段或明显格式问题。</span></div>';
            return;
        }
        box.innerHTML = issues.slice(0, 60).map((issue) => `
            <div class="office-excel-issue ${issue.level}">
                <b>Row ${issue.row} · ${escapeHtml(issue.title)}</b>
                <span>${escapeHtml(issue.detail)}</span>
            </div>
        `).join('');
    }

    function renderResultPreview() {
        const headers = ['row', ...templatePlaceholders];
        const rows = generated.map((item) => {
            const row = { row: item.index + 1 };
            templatePlaceholders.forEach((field) => {
                row[field] = item.context[field] || '';
            });
            return row;
        });
        renderTable('office-excel-result-preview', rows, headers, '点击“一键套用模板”后在这里预览生成字段');
    }

    function renderPreview() {
        const target = byId('office-excel-live-preview');
        if (!target) return;
        const item = generated[0] || { context: buildContext(sourceRows[0] || {}) };
        let html = '';
        if (templateWorkbook && templateSheetName && window.XLSX) {
            const sheet = cloneSheetWithContext(templateWorkbook.Sheets[templateSheetName], item.context);
            html = window.XLSX.utils.sheet_to_html(sheet);
        } else {
            const rows = docTypes[getSelectedDocType()].template.map((row) => row.map((cell) => fillText(cell, item.context)));
            html = `
                <table class="office-excel-preview-grid">
                    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            `;
        }
        target.innerHTML = html;
    }

    function renderAll() {
        extractTemplatePlaceholders();
        renderTemplateFields();
        renderSourcePreview();
        renderResultPreview();
        renderIssues();
        renderPreview();
    }

    function setLayer(layer) {
        activeLayer = layer === 'settings' ? 'settings' : 'work';
        const shell = byId('office-excel-shell');
        if (shell) shell.dataset.layer = activeLayer;
        document.querySelectorAll('[data-office-excel-layer]').forEach((button) => {
            button.classList.toggle('active', button.dataset.officeExcelLayer === activeLayer);
        });
    }

    function toast(message, isError) {
        const box = byId('office-excel-toast');
        if (!box) return;
        box.textContent = message;
        box.classList.toggle('error', !!isError);
        box.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => box.classList.remove('show'), 2400);
    }

    function ensureStyles() {
        if (byId('office-excel-styles')) return;
        const style = document.createElement('style');
        style.id = 'office-excel-styles';
        style.textContent = `
.office-excel-modal { z-index: 10070; }
.office-excel-shell { width: min(1320px, calc(100vw - 32px)); max-height: min(900px, calc(100vh - 36px)); padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.office-excel-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--border); }
.office-excel-title h2 { margin: 0; display: flex; align-items: center; gap: 8px; color: var(--text-main); font-size: 20px; }
.office-excel-title p { margin: 5px 0 0; color: var(--text-sub); font-size: 12px; }
.office-excel-actions { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.office-excel-tabs { display: flex; gap: 8px; padding: 12px 18px 0; border-bottom: 1px solid var(--border); }
.office-excel-tab { border: 1px solid var(--border); border-bottom: 0; border-radius: 8px 8px 0 0; background: rgba(255,255,255,.04); color: var(--text-sub); padding: 9px 13px; display: flex; align-items: center; gap: 7px; font-size: 13px; }
.office-excel-tab.active { color: var(--accent); background: rgba(94,156,255,.12); border-color: rgba(94,156,255,.32); }
.office-excel-body { display: grid; grid-template-columns: minmax(360px, .82fr) minmax(560px, 1.18fr); gap: 16px; padding: 18px; overflow: auto; }
.office-excel-settings { display: none; padding: 18px; overflow: auto; }
.office-excel-shell[data-layer='settings'] .office-excel-body { display: none; }
.office-excel-shell[data-layer='settings'] .office-excel-settings { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
.office-excel-stack { display: grid; gap: 14px; align-content: start; }
.office-excel-panel { border: 1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,.045); padding: 15px; min-width: 0; }
:root[data-theme='light'] .office-excel-panel { background: rgba(246,249,255,.82); }
.office-excel-panel h3 { margin: 0 0 12px; color: var(--text-main); font-size: 14px; display: flex; align-items: center; gap: 7px; }
.office-excel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.office-excel-field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; }
.office-excel-field label { color: var(--text-sub); font-size: 12px; font-weight: 650; }
.office-excel-input, .office-excel-textarea, .office-excel-select { width: 100%; border: 1px solid var(--border); border-radius: 8px; background: var(--input-muted-bg); color: var(--text-main); outline: none; font-size: 13px; padding: 10px 12px; user-select: text; }
.office-excel-textarea { min-height: 112px; resize: vertical; line-height: 1.5; }
.office-excel-drop { border: 1px dashed var(--border); border-radius: 8px; min-height: 112px; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-sub); background: rgba(255,255,255,.035); cursor: pointer; padding: 14px; }
.office-excel-drop:hover { color: var(--accent); border-color: var(--accent); background: rgba(94,156,255,.08); }
.office-excel-drop strong { display: block; color: var(--text-main); margin-bottom: 4px; font-size: 13px; }
.office-excel-drop input { display: none; }
.office-excel-meta { border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,.12); padding: 9px 10px; color: var(--text-sub); font-size: 12px; line-height: 1.5; }
:root[data-theme='light'] .office-excel-meta { background: rgba(255,255,255,.58); }
.office-excel-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.office-excel-chip { border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; background: rgba(255,255,255,.04); color: var(--text-sub); font-size: 12px; }
.office-excel-table-wrap { overflow: auto; max-height: 230px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,.1); }
.office-excel-table { width: 100%; border-collapse: collapse; font-size: 12px; color: var(--text-main); }
.office-excel-table th, .office-excel-table td { border-bottom: 1px solid var(--border); padding: 8px 9px; text-align: left; vertical-align: top; min-width: 96px; }
.office-excel-table th { position: sticky; top: 0; background: var(--chrome-bg-strong); color: var(--text-sub); font-weight: 700; z-index: 1; }
.office-excel-empty { min-height: 150px; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-sub); font-size: 13px; border: 1px dashed var(--border); border-radius: 8px; }
.office-excel-preview { min-height: 420px; max-height: 620px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: rgba(255,255,255,.04); }
.office-excel-preview table, .office-excel-preview-grid { width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 13px; }
.office-excel-preview td, .office-excel-preview th, .office-excel-preview-grid td { border: 1px solid var(--border); padding: 9px 10px; min-width: 100px; }
.office-excel-preview tr:first-child td { font-weight: 700; background: rgba(94,156,255,.08); }
.office-excel-issue { display: grid; gap: 4px; border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; margin-bottom: 8px; background: rgba(255,255,255,.04); }
.office-excel-issue b { font-size: 13px; color: var(--text-main); }
.office-excel-issue span { font-size: 12px; color: var(--text-sub); }
.office-excel-issue.danger { border-color: rgba(255,94,89,.35); background: rgba(255,94,89,.08); }
.office-excel-issue.warn { border-color: rgba(245,158,11,.35); background: rgba(245,158,11,.08); }
.office-excel-issue.ok { border-color: rgba(63,212,122,.28); background: rgba(63,212,122,.08); }
.office-excel-main-btn { width: 100%; justify-content: center; padding: 12px 14px; }
.office-excel-toast { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%) translateY(14px); opacity: 0; pointer-events: none; z-index: 10090; border: 1px solid var(--border); background: var(--chrome-bg-strong); color: var(--text-main); border-radius: 8px; padding: 10px 14px; font-size: 13px; box-shadow: var(--panel-shadow); transition: opacity .2s ease, transform .2s ease; }
.office-excel-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.office-excel-toast.error { border-color: rgba(255,94,89,.35); color: var(--danger); }
@media (max-width: 980px) {
  .office-excel-body, .office-excel-grid { grid-template-columns: 1fr; }
  .office-excel-shell { width: calc(100vw - 20px); }
}
`;
        document.head.appendChild(style);
    }

    function ensureShell() {
        if (byId('office-excel-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'office-excel-modal';
        modal.className = 'help-modal office-excel-modal';
        modal.innerHTML = `
            <div class="help-content office-excel-shell" id="office-excel-shell" data-layer="work" onclick="event.stopPropagation()">
                <div class="office-excel-head">
                    <div class="office-excel-title">
                        <h2><span class="material-symbols-outlined">dataset</span> Office 表格模板工具</h2>
                        <p>不调用大模型，按 OfficeCLI merge / validate / view 的思路做本地字段套用、批量生成和预览。</p>
                    </div>
                    <div class="office-excel-actions">
                        <button class="top-btn" id="office-excel-apply-top" type="button">
                            <span class="material-symbols-outlined">bolt</span>
                            一键套用
                        </button>
                        <button class="top-btn top-btn-primary" id="office-excel-export-top" type="button">
                            <span class="material-symbols-outlined">download</span>
                            导出
                        </button>
                        <button class="top-btn icon-only" id="office-excel-close" type="button" data-tip="关闭">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="office-excel-tabs">
                    <button class="office-excel-tab active" type="button" data-office-excel-layer="work">
                        <span class="material-symbols-outlined">play_circle</span>
                        使用层
                    </button>
                    <button class="office-excel-tab" type="button" data-office-excel-layer="settings">
                        <span class="material-symbols-outlined">tune</span>
                        设置层
                    </button>
                </div>
                <div class="office-excel-body">
                    <div class="office-excel-stack">
                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">category</span> 文档类型</h3>
                            <div class="office-excel-grid">
                                <div class="office-excel-field">
                                    <label for="office-excel-doc-type">套用模板</label>
                                    <select class="office-excel-select" id="office-excel-doc-type">
                                        ${Object.entries(docTypes).map(([key, doc]) => `<option value="${key}">${doc.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="office-excel-field">
                                    <label for="office-excel-row-limit">批量行数</label>
                                    <input class="office-excel-input" id="office-excel-row-limit" type="number" min="1" max="500" value="50">
                                </div>
                            </div>
                        </section>

                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">upload_file</span> 表格数据</h3>
                            <label class="office-excel-drop">
                                <input id="office-excel-source-input" type="file" accept=".xlsx,.xls,.csv">
                                <div>
                                    <span class="material-symbols-outlined">table_view</span>
                                    <strong>上传 Excel / CSV 源数据</strong>
                                    <div>每一行会生成一个模板结果，字段支持别名映射。</div>
                                </div>
                            </label>
                            <div class="office-excel-meta" id="office-excel-source-meta">未导入源数据</div>
                        </section>

                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">contract_edit</span> 自定义模板</h3>
                            <label class="office-excel-drop">
                                <input id="office-excel-template-input" type="file" accept=".xlsx,.xls,.csv">
                                <div>
                                    <span class="material-symbols-outlined">note_stack</span>
                                    <strong>可选：上传含 {{sku}} 的 Excel 模板</strong>
                                    <div>不上传时使用当前文档类型的内置模板。</div>
                                </div>
                            </label>
                            <div class="office-excel-meta" id="office-excel-template-meta">内置模板</div>
                        </section>

                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">data_object</span> 模板字段</h3>
                            <div class="office-excel-chip-row" id="office-excel-template-fields"></div>
                        </section>

                        <section class="office-excel-panel">
                            <button class="top-btn top-btn-primary office-excel-main-btn" id="office-excel-apply-main" type="button">
                                <span class="material-symbols-outlined">bolt</span>
                                一键批量套用模板
                            </button>
                        </section>
                    </div>

                    <div class="office-excel-stack">
                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">preview</span> 右侧实时预览</h3>
                            <div class="office-excel-preview" id="office-excel-live-preview"></div>
                        </section>
                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">fact_check</span> 合规和质检</h3>
                            <div id="office-excel-issues"></div>
                        </section>
                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">dataset</span> 源数据预览</h3>
                            <div id="office-excel-source-preview" class="office-excel-empty"></div>
                        </section>
                        <section class="office-excel-panel">
                            <h3><span class="material-symbols-outlined">library_books</span> 生成字段预览</h3>
                            <div id="office-excel-result-preview" class="office-excel-empty"></div>
                        </section>
                    </div>
                </div>
                <div class="office-excel-settings">
                    <section class="office-excel-panel">
                        <h3><span class="material-symbols-outlined">language</span> 本地化规则</h3>
                        <div class="office-excel-grid">
                            <div class="office-excel-field">
                                <label for="office-excel-locale">默认市场</label>
                                <select class="office-excel-select" id="office-excel-locale">
                                    <option value="US">美国 / USD / inch / lb</option>
                                    <option value="EU">欧盟 / EUR / cm / kg</option>
                                    <option value="JP">日本 / JPY / cm / kg</option>
                                    <option value="AE">阿拉伯 / AED / cm / kg</option>
                                    <option value="CN">中国 / CNY / cm / kg</option>
                                </select>
                            </div>
                            <div class="office-excel-field">
                                <label for="office-excel-date-format">日期格式</label>
                                <select class="office-excel-select" id="office-excel-date-format">
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                                </select>
                            </div>
                            <div class="office-excel-field">
                                <label for="office-excel-default-doc">默认模板</label>
                                <select class="office-excel-select" id="office-excel-default-doc">
                                    ${Object.entries(docTypes).map(([key, doc]) => `<option value="${key}">${doc.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="office-excel-field">
                                <label for="office-excel-required-fields">必填字段</label>
                                <input class="office-excel-input" id="office-excel-required-fields" type="text">
                            </div>
                        </div>
                    </section>
                    <section class="office-excel-panel">
                        <h3><span class="material-symbols-outlined">block</span> 禁用词与字段别名</h3>
                        <div class="office-excel-field">
                            <label for="office-excel-banned-words">禁用词，英文逗号分隔</label>
                            <textarea class="office-excel-textarea" id="office-excel-banned-words"></textarea>
                        </div>
                        <div class="office-excel-field">
                            <label for="office-excel-field-aliases">字段别名，每行格式：标准字段=别名1,别名2</label>
                            <textarea class="office-excel-textarea" id="office-excel-field-aliases"></textarea>
                        </div>
                        <div class="office-excel-actions">
                            <button class="top-btn" id="office-excel-reset-settings" type="button">
                                <span class="material-symbols-outlined">restart_alt</span>
                                恢复默认
                            </button>
                            <button class="top-btn top-btn-primary" id="office-excel-save-settings" type="button">
                                <span class="material-symbols-outlined">save</span>
                                保存到浏览器缓存
                            </button>
                        </div>
                    </section>
                </div>
            </div>
            <div class="office-excel-toast" id="office-excel-toast"></div>
        `;
        modal.addEventListener('click', close);
        document.body.appendChild(modal);
        bindEvents();
    }

    function syncSettingsUI() {
        byId('office-excel-locale').value = settings.localePreset;
        byId('office-excel-date-format').value = settings.dateFormat;
        byId('office-excel-default-doc').value = settings.defaultDocType;
        byId('office-excel-required-fields').value = settings.requiredFields;
        byId('office-excel-banned-words').value = settings.bannedWords;
        byId('office-excel-field-aliases').value = settings.fieldAliases;
        setDocType(settings.defaultDocType);
    }

    function bindEvents() {
        byId('office-excel-close').addEventListener('click', close);
        byId('office-excel-apply-top').addEventListener('click', applyTemplate);
        byId('office-excel-apply-main').addEventListener('click', applyTemplate);
        byId('office-excel-export-top').addEventListener('click', exportWorkbook);
        byId('office-excel-save-settings').addEventListener('click', saveSettings);
        byId('office-excel-reset-settings').addEventListener('click', () => {
            settings = { ...defaultSettings };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            syncSettingsUI();
            toast('已恢复默认设置');
        });
        byId('office-excel-source-input').addEventListener('change', (event) => handleSourceFiles(event.target.files));
        byId('office-excel-template-input').addEventListener('change', (event) => handleTemplateFiles(event.target.files));
        byId('office-excel-doc-type').addEventListener('change', (event) => {
            setDocType(event.target.value);
            generated = [];
            issues = [];
            renderAll();
        });
        document.querySelectorAll('[data-office-excel-layer]').forEach((button) => {
            button.addEventListener('click', () => setLayer(button.dataset.officeExcelLayer));
        });
    }

    function open() {
        loadSettings();
        ensureStyles();
        ensureShell();
        syncSettingsUI();
        renderAll();
        byId('office-excel-modal').classList.add('show');
        setLayer(activeLayer);
    }

    function close() {
        const modal = byId('office-excel-modal');
        if (modal) modal.classList.remove('show');
    }

    window.openOfficeExcelTool = open;
    window.VeoOfficeExcelTool = {
        open,
        close,
        getSettings: () => ({ ...settings }),
        getGenerated: () => generated.map((item) => ({ ...item }))
    };
})(window, document);
