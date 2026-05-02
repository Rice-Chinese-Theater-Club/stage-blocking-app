// export.js - PDF 导出模块（纵向双页对开布局）
import { BlockingApp } from '../services/firebase.js';
import { log, logError } from '../utils/logger.js';
import { showStatus, arrayBufferToBase64, hexToRgb, sortMovements } from '../utils/helpers.js';
import { getStageImageForScene, getActFromSceneId } from './stageImages.js';

// 纵向 A4 尺寸 (px)
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1122;

// 打开PDF导出模态框
export function openExportPDFModal() {
    const modal = document.getElementById('exportPDFModal');
    const checklist = document.getElementById('scenesChecklist');

    checklist.innerHTML = '';
    BlockingApp.data.scenes.forEach(scene => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.padding = '8px';
        label.style.borderBottom = '1px solid #eee';
        label.innerHTML = `
            <input type="checkbox" value="${scene.id}" class="scene-checkbox" checked>
            ${scene.id} - ${scene.name}
        `;
        checklist.appendChild(label);
    });

    modal.classList.add('active');
}

// 关闭PDF导出模态框
export function closeExportPDFModal() {
    document.getElementById('exportPDFModal').classList.remove('active');
}

// 全选场次
export function selectAllScenes() {
    document.querySelectorAll('.scene-checkbox').forEach(cb => cb.checked = true);
}

// 清空场次选择
export function deselectAllScenes() {
    document.querySelectorAll('.scene-checkbox').forEach(cb => cb.checked = false);
}

// 收集单个场次的走位数据
function collectSceneBlockingData(sceneId) {
    const sceneBlockingData = window.blockingData[sceneId] || {};
    const sceneLines = BlockingApp.data.lines.filter(l => l.sceneId === sceneId);

    const characterMovements = {};

    Object.keys(sceneBlockingData).forEach(charName => {
        const charData = sceneBlockingData[charName];
        const movements = [];

        if (charData.initial) {
            movements.push({
                type: 'initial',
                x: charData.initial.x,
                y: charData.initial.y,
                label: '起'
            });
        }

        if (charData.movements && charData.movements.length > 0) {
            charData.movements.forEach(movement => {
                movements.push({
                    type: movement.type || 'line',
                    lineId: movement.lineId,
                    charIndex: movement.charIndex,
                    x: movement.x,
                    y: movement.y,
                    timestamp: movement.timestamp,
                    controlPointFromPrev: movement.controlPointFromPrev || null,  // 弧线控制点
                    note: movement.note || null  // 走位备注
                });
            });
        }

        characterMovements[charName] = movements;
    });

    return { characterMovements, sceneLines };
}

// 为走位生成标签
function generateMovementLabels(characterMovements) {
    const labeledMovements = {};

    Object.keys(characterMovements).forEach(charName => {
        const movements = characterMovements[charName];
        const labeled = [];
        let counter = 1;

        movements.forEach((movement, index) => {
            if (movement.type === 'initial') {
                labeled.push({
                    ...movement,
                    displayLabel: `${charName}-${movement.label}`
                });
            } else {
                labeled.push({
                    ...movement,
                    displayLabel: `${charName}-${counter}`,
                    number: counter
                });
                counter++;
            }
        });

        labeledMovements[charName] = labeled;
    });

    return labeledMovements;
}

// 为台词添加走位标记、备注和lineId
function annotateLines(sceneLines, labeledMovements, sceneId) {
    const annotatedLines = [];

    sceneLines.forEach((line, index) => {
        const lineId = line.lineId || `${sceneId}-${index}`;
        let content = line.content;
        const markers = [];

        Object.keys(labeledMovements).forEach(charName => {
            const movements = labeledMovements[charName];
            movements.forEach(movement => {
                if (movement.lineId === lineId && movement.type !== 'initial') {
                    markers.push(movement.displayLabel);
                }
            });
        });

        // 获取备注并插入到内容中
        const lineNotes = window.notes[sceneId]?.[lineId] || [];
        let annotatedContent = content;

        if (lineNotes.length > 0) {
            // 按 charIndex 降序排序，从后往前插入，避免索引偏移问题
            const sortedNotes = [...lineNotes].sort((a, b) => b.charIndex - a.charIndex);

            sortedNotes.forEach(note => {
                const charIdx = note.charIndex;
                if (charIdx >= 0 && charIdx < annotatedContent.length) {
                    // 在字符后面插入备注标记
                    const before = annotatedContent.slice(0, charIdx + 1);
                    const after = annotatedContent.slice(charIdx + 1);
                    annotatedContent = `${before}[${note.note}]${after}`;
                }
            });
        }

        annotatedLines.push({
            lineId: lineId,
            character: line.character,
            content: annotatedContent,
            originalContent: content,
            isStageDirection: line.isStageDirection,
            markers: markers,
            notes: lineNotes
        });
    });

    return annotatedLines;
}

// 计算一行台词需要的视觉行数（纵向页面更窄）
function calculateVisualLines(line) {
    const CHARS_PER_LINE = 24;  // 减少每行字符数，留出更多余量

    let fullText = '';
    if (line.isStageDirection) {
        fullText = `(${line.content})`;
    } else {
        const prefix = line.character ? `${line.character}: ` : '';
        const markerSuffix = line.markers.length > 0
            ? ` ${'「' + line.markers.join('」「') + '」'}`
            : '';
        fullText = prefix + line.content + markerSuffix;
    }

    // 计算备注标记的额外字符（[备注] 格式）
    const noteMatches = fullText.match(/\[[^\]]+\]/g) || [];
    const extraNoteChars = noteMatches.length * 4; // 每个备注标记额外占用空间

    const charCount = fullText.length + extraNoteChars;
    const visualLines = Math.ceil(charCount / CHARS_PER_LINE);

    return Math.max(visualLines, 1); // 至少1行
}

// 智能分页（减少每页行数避免内容被截断）
function paginateLines(annotatedLines, maxVisualLines = 30) {
    const pages = [];
    let currentPage = [];
    let currentVisualLineCount = 0;

    annotatedLines.forEach(line => {
        const visualLinesNeeded = calculateVisualLines(line);

        if (currentVisualLineCount + visualLinesNeeded > maxVisualLines && currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = [];
            currentVisualLineCount = 0;
        }

        currentPage.push(line);
        currentVisualLineCount += visualLinesNeeded;
    });

    if (currentPage.length > 0) {
        pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [[]];
}

// 按幕分组场景
function groupScenesByAct(scenes) {
    const actGroups = new Map();

    scenes.forEach(scene => {
        const actNumber = scene.id.split('-')[0];
        const actName = `第${actNumber}幕`;

        if (!actGroups.has(actName)) {
            actGroups.set(actName, []);
        }
        actGroups.get(actName).push(scene);
    });

    return actGroups;
}

// 获取当前页的走位数据（过滤 + 连续性）
function getMovementsForPage(labeledMovements, pageLines, sceneId, previousEndPositions, isFirstPage) {
    // 收集当前页涉及的 lineId
    const pageLineIds = new Set();
    pageLines.forEach(line => {
        pageLineIds.add(line.lineId);
    });

    const filteredMovements = {};
    // 继承之前所有角色的结束位置，确保连续性
    const newEndPositions = { ...previousEndPositions };

    Object.keys(labeledMovements).forEach(charName => {
        const allMovements = labeledMovements[charName];
        const pageMovements = [];

        // 如果是第一页，添加初始位置
        if (isFirstPage) {
            const initial = allMovements.find(m => m.type === 'initial');
            if (initial) {
                pageMovements.push(initial);
                // 第一页也要记录初始位置作为结束位置
                newEndPositions[charName] = {
                    x: initial.x,
                    y: initial.y,
                    displayLabel: initial.displayLabel
                };
            }
        } else if (previousEndPositions[charName]) {
            // 非第一页，添加上一页结束位置作为起点（半透明标记）
            pageMovements.push({
                ...previousEndPositions[charName],
                type: 'continue',
                displayLabel: `${charName}-续`
            });
        }

        // 添加当前页涉及的走位点
        allMovements.forEach(movement => {
            if (movement.type !== 'initial' && pageLineIds.has(movement.lineId)) {
                pageMovements.push(movement);
            }
        });

        if (pageMovements.length > 0) {
            filteredMovements[charName] = pageMovements;

            // 更新结束位置为当前页最后一个走位点
            const lastMovement = pageMovements[pageMovements.length - 1];
            newEndPositions[charName] = {
                x: lastMovement.x,
                y: lastMovement.y,
                displayLabel: lastMovement.displayLabel
            };
        }
    });

    return { movements: filteredMovements, endPositions: newEndPositions };
}

// 生成封面页 HTML
function generateCoverHTML(selectedScenes) {
    const date = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // 按幕分组场次列表
    const actGroups = groupScenesByAct(selectedScenes);
    let sceneListHtml = '';

    actGroups.forEach((scenes, actName) => {
        sceneListHtml += `<div style="margin: 15px 0;">
            <div style="font-size: 16px; font-weight: bold; color: #555; margin-bottom: 8px;">${actName}</div>
            <div style="font-size: 14px; color: #666; line-height: 1.8;">
                ${scenes.map(s => `${s.id} ${s.name}`).join('<br>')}
            </div>
        </div>`;
    });

    return `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px;">
            <div style="font-size: 56px; font-weight: bold; color: #333; margin-bottom: 20px;">XXXX</div>
            <div style="font-size: 32px; color: #666; margin-bottom: 40px;">电子走位本</div>
            <div style="font-size: 18px; color: #888; margin-bottom: 60px;">${date}</div>
            <div style="width: 80%; text-align: left; border-top: 2px solid #ddd; padding-top: 30px;">
                <div style="font-size: 18px; font-weight: bold; color: #444; margin-bottom: 15px;">场次目录</div>
                ${sceneListHtml}
            </div>
        </div>
    `;
}

// 生成幕间分隔页 HTML
function generateActDividerHTML(actName) {
    return `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="font-size: 72px; font-weight: bold; color: #333;">${actName}</div>
        </div>
    `;
}

// 生成走位图页 HTML（横向显示）
function generateStagePageHTML(scene, movements, pageInfo = null) {
    // 使用新的图片获取逻辑：优先场次配置，否则用该幕默认图
    let stageImageSrc = getStageImageForScene(scene.id);
    if (!stageImageSrc) {
        // 回退到默认幕图
        const actNumber = getActFromSceneId(scene.id);
        const stageImages = BlockingApp.data.stageImages || {};
        stageImageSrc = stageImages[actNumber] || `走位图/act${actNumber}/stage.png`;
    }

    // 舞台图尺寸（横向，适配纵向页面宽度）
    const stageWidth = 700;
    const stageHeight = 400;

    let svgContent = '';

    // 添加走位标记
    Object.keys(movements).forEach(charName => {
        const charMovements = movements[charName];
        const character = window.characters.find(c => c.name === charName);
        const color = character ? character.color : '#888';

        // 画连线（支持弧线）
        for (let i = 0; i < charMovements.length - 1; i++) {
            const from = charMovements[i];
            const to = charMovements[i + 1];
            const controlPoint = to.controlPointFromPrev;

            if (controlPoint) {
                // controlPoint 是曲线经过的点，需要反算贝塞尔控制点
                const bezierCtrlX = 2 * controlPoint.x - 0.5 * from.x - 0.5 * to.x;
                const bezierCtrlY = 2 * controlPoint.y - 0.5 * from.y - 0.5 * to.y;
                // 绘制二次贝塞尔曲线
                svgContent += `<path d="M ${from.x}% ${from.y}% Q ${bezierCtrlX}% ${bezierCtrlY}% ${to.x}% ${to.y}%"
                    stroke="${color}" stroke-width="3" fill="none"/>`;
            } else {
                // 绘制直线
                svgContent += `<line x1="${from.x}%" y1="${from.y}%" x2="${to.x}%" y2="${to.y}%"
                    stroke="${color}" stroke-width="3"/>`;
            }
        }

        // 画点
        charMovements.forEach((movement, index) => {
            const isInitial = movement.type === 'initial';
            const r = isInitial ? 13 : 11;

            svgContent += `
                <circle cx="${movement.x}%" cy="${movement.y}%" r="${r}"
                    fill="${color}" stroke="#000" stroke-width="2"/>
                <text x="${movement.x}%" y="${movement.y}%"
                    text-anchor="middle" dominant-baseline="middle"
                    fill="white" font-size="${isInitial ? 10 : 8}" font-weight="bold">
                    ${movement.displayLabel}
                </text>
            `;
        });
    });

    const pageInfoText = pageInfo ? ` (${pageInfo.current}/${pageInfo.total})` : '';

    return `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; padding: 40px; box-sizing: border-box;">
            <div style="font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #333;">
                ${scene.id} - ${scene.name}${scene.subtitle ? ' - ' + scene.subtitle : ''}${pageInfoText}
            </div>
            <div style="flex: 1; display: flex; justify-content: center; align-items: center;">
                <div style="position: relative; width: ${stageWidth}px; height: ${stageHeight}px;
                    border: 3px solid #333; border-radius: 8px; overflow: hidden; background: #f5f5f5;">
                    <img src="${stageImageSrc}"
                        style="width: 100%; height: 100%; object-fit: contain;"
                        crossorigin="anonymous">
                    <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                        ${svgContent}
                    </svg>
                </div>
            </div>
        </div>
    `;
}

// 生成台词页 HTML
function generateLinesPageHTML(scene, pageLines, pageInfo = null) {
    let linesHtml = '';

    pageLines.forEach(line => {
        if (line.isStageDirection) {
            linesHtml += `<div style="padding: 6px 0; color: #666; font-style: italic; font-size: 14px;">(${line.content})</div>`;
        } else {
            const character = window.characters.find(c => c.name === line.character);
            const color = character ? character.color : '#888';
            const markerText = line.markers.length > 0
                ? ` <span style="color: #e91e63; font-size: 12px;">「${line.markers.join('」「')}」</span>`
                : '';

            // 处理备注标记的样式：将 [备注] 替换为带样式的版本
            let displayContent = line.content;
            displayContent = displayContent.replace(/\[([^\]]+)\]/g,
                '<span style="background: #fff3cd; color: #856404; padding: 1px 4px; border-radius: 3px; font-size: 12px; margin: 0 2px;">[$1]</span>'
            );

            linesHtml += `<div style="padding: 6px 0; font-size: 15px; line-height: 1.6;">
                <span style="background: ${color}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 13px; margin-right: 8px;">${line.character}</span>
                ${displayContent}${markerText}
            </div>`;
        }
    });

    const pageInfoText = pageInfo ? ` (${pageInfo.current}/${pageInfo.total})` : '';

    return `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; padding: 40px; box-sizing: border-box;">
            <div style="font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #333;">
                ${scene.id} - ${scene.name}${scene.subtitle ? ' - ' + scene.subtitle : ''}${pageInfoText}
            </div>
            <div style="flex: 1;">
                ${linesHtml}
            </div>
        </div>
    `;
}

// 渲染HTML到Canvas
async function renderToCanvas(htmlContent, width, height, container = null) {
    const tempContainer = container || document.createElement('div');
    tempContainer.innerHTML = htmlContent;

    if (!container) {
        tempContainer.style.cssText = `position: absolute; left: -9999px; width: ${width}px; height: ${height}px; background: white; box-sizing: border-box;`;
        document.body.appendChild(tempContainer);
    }

    await new Promise(r => setTimeout(r, 150));

    const canvas = await html2canvas(tempContainer, {
        width: width,
        height: height,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
    });

    if (!container) {
        document.body.removeChild(tempContainer);
    }

    return canvas;
}

// 生成PDF主函数
export async function generatePDF() {
    const selectedCheckboxes = document.querySelectorAll('.scene-checkbox:checked');
    const selectedSceneIds = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (selectedSceneIds.length === 0) {
        alert('请至少选择一个场次');
        return;
    }

    closeExportPDFModal();
    showStatus('正在生成PDF...', 'info');

    if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        alert('PDF库加载失败，请刷新页面重试');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
        hotfixes: ['px_scaling']
    });

    // 获取选中的场景
    const selectedScenes = selectedSceneIds
        .map(id => BlockingApp.data.scenes.find(s => s.id === id))
        .filter(s => s);

    // 预处理所有场景数据
    const scenePagesData = [];
    let totalPages = 1; // 封面

    for (const scene of selectedScenes) {
        const { characterMovements, sceneLines } = collectSceneBlockingData(scene.id);
        const labeledMovements = generateMovementLabels(characterMovements);
        const annotatedLines = annotateLines(sceneLines, labeledMovements, scene.id);
        const linePages = paginateLines(annotatedLines);  // 使用默认的30行

        scenePagesData.push({ scene, labeledMovements, annotatedLines, linePages });
        totalPages += linePages.length * 2; // 每页台词对应一页走位图
    }

    // 计算幕间分隔页数量
    const actGroups = groupScenesByAct(selectedScenes);
    totalPages += actGroups.size - 1; // 除第一幕外，每幕前有分隔页

    // 创建渲染容器
    const container = document.createElement('div');
    container.style.cssText = `position: absolute; left: -9999px; width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; background: white; box-sizing: border-box;`;
    document.body.appendChild(container);

    let currentPage = 0;

    // 1. 渲染封面 (P1)
    currentPage++;
    showStatus(`正在渲染 第 ${currentPage}/${totalPages} 页（封面）...`, 'info');
    const coverHtml = generateCoverHTML(selectedScenes);
    const coverCanvas = await renderToCanvas(coverHtml, PAGE_WIDTH, PAGE_HEIGHT, container);
    doc.addImage(coverCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // 2. 按幕渲染场景
    let isFirstAct = true;
    let sceneDataIndex = 0;

    for (const [actName, actScenes] of actGroups) {
        // 幕间分隔页（非第一幕）
        if (!isFirstAct) {
            currentPage++;
            showStatus(`正在渲染 第 ${currentPage}/${totalPages} 页（${actName}分隔）...`, 'info');
            doc.addPage();
            const dividerHtml = generateActDividerHTML(actName);
            const dividerCanvas = await renderToCanvas(dividerHtml, PAGE_WIDTH, PAGE_HEIGHT, container);
            doc.addImage(dividerCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        }
        isFirstAct = false;

        // 渲染该幕的所有场景
        for (const scene of actScenes) {
            const sceneData = scenePagesData.find(d => d.scene.id === scene.id);
            if (!sceneData) continue;

            const { labeledMovements, linePages } = sceneData;
            let previousEndPositions = {};

            for (let pageIndex = 0; pageIndex < linePages.length; pageIndex++) {
                const pageLines = linePages[pageIndex];
                const isFirstPage = pageIndex === 0;
                const pageInfo = linePages.length > 1
                    ? { current: pageIndex + 1, total: linePages.length }
                    : null;

                // 获取当前页的走位数据
                const { movements, endPositions } = getMovementsForPage(
                    labeledMovements, pageLines, scene.id, previousEndPositions, isFirstPage
                );
                previousEndPositions = endPositions;

                // 走位图页 (偶数页，左边)
                currentPage++;
                showStatus(`正在渲染 第 ${currentPage}/${totalPages} 页（${scene.id} 走位图）...`, 'info');
                doc.addPage();
                const stageHtml = generateStagePageHTML(scene, movements, pageInfo);
                const stageCanvas = await renderToCanvas(stageHtml, PAGE_WIDTH, PAGE_HEIGHT, container);
                doc.addImage(stageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);

                // 台词页 (奇数页，右边)
                currentPage++;
                showStatus(`正在渲染 第 ${currentPage}/${totalPages} 页（${scene.id} 台词）...`, 'info');
                doc.addPage();
                const linesHtml = generateLinesPageHTML(scene, pageLines, pageInfo);
                const linesCanvas = await renderToCanvas(linesHtml, PAGE_WIDTH, PAGE_HEIGHT, container);
                doc.addImage(linesCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
            }
        }
    }

    document.body.removeChild(container);

    // 保存到本地
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `走位本_${timestamp}.pdf`;

    doc.save(fileName);
    showStatus('PDF 已下载', 'success');
}

// 挂载到 window
window.openExportPDFModal = openExportPDFModal;
window.closeExportPDFModal = closeExportPDFModal;
window.selectAllScenes = selectAllScenes;
window.deselectAllScenes = deselectAllScenes;
window.generatePDF = generatePDF;
