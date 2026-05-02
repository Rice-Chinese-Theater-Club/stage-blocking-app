// history.js - 撤销历史管理模块
import { blockingRef, notesRef, dialogueEditsRef, lineOperationsRef } from '../services/firebase.js';
import { showStatus } from '../utils/helpers.js';

// 历史状态栈
const historyStack = [];
const MAX_HISTORY = 30;  // 最多保存30步

// 上一次成功保存的状态（用于下次操作时推入历史）
let lastSavedState = null;

// 防止撤销操作触发新的历史记录
let isUndoing = false;

// 防止同一操作周期内重复 push（因为 blocking.js 和 notes.js 都会调用）
let hasPushedInCurrentCycle = false;

// 创建当前状态的深拷贝
function createSnapshot() {
    return {
        blockingData: JSON.parse(JSON.stringify(window.blockingData || {})),
        notes: JSON.parse(JSON.stringify(window.notes || {})),
        dialogueEdits: JSON.parse(JSON.stringify(window.dialogueEdits || {})),
        lineOperations: JSON.parse(JSON.stringify(window.lineOperations || { added: {}, deleted: {} }))
    };
}

// 初始化：在数据加载完成后调用，记录初始状态
export function initHistory() {
    lastSavedState = createSnapshot();
    updateUndoButton();
}

// 在 autoSave 调用时调用此函数
// 把"修改前"的状态推入历史栈
export function pushHistory() {
    // 如果正在撤销，不记录
    if (isUndoing) return;

    // 防止同一操作周期内重复 push
    if (hasPushedInCurrentCycle) return;

    // 如果有上一次保存的状态，推入历史（这是修改前的状态）
    if (lastSavedState) {
        historyStack.push(lastSavedState);
        hasPushedInCurrentCycle = true;

        if (historyStack.length > MAX_HISTORY) {
            historyStack.shift();  // 移除最旧的
        }
    }

    updateUndoButton();
}

// 在 autoSave 成功后调用，更新"上一次保存的状态"
export function updateLastSavedState() {
    if (isUndoing) return;
    lastSavedState = createSnapshot();
    // 重置标志，允许下一次操作 push
    hasPushedInCurrentCycle = false;
}

// 撤销一步
export function undo() {
    if (historyStack.length === 0) {
        showStatus('没有可撤销的操作', 'warning');
        return;
    }

    isUndoing = true;

    const snapshot = historyStack.pop();

    // 恢复数据
    window.blockingData = snapshot.blockingData;
    window.notes = snapshot.notes;
    window.dialogueEdits = snapshot.dialogueEdits;
    window.lineOperations = snapshot.lineOperations;

    // 保存到 Firebase
    Promise.all([
        blockingRef.set(window.blockingData),
        notesRef.set(window.notes),
        dialogueEditsRef.set(window.dialogueEdits),
        lineOperationsRef.set(window.lineOperations)
    ]).then(() => {
        showStatus('已撤销', 'success');
        isUndoing = false;
    }).catch(err => {
        console.error('撤销保存失败:', err);
        showStatus('撤销保存失败', 'error');
        isUndoing = false;
    });

    // 刷新视图
    if (window.renderStageView) window.renderStageView();
    if (window.displayLines && window.currentScene) {
        window.displayLines(window.currentScene.id);
    }
    if (window.updateSceneStats) window.updateSceneStats();

    updateUndoButton();
}

// 获取是否正在撤销
export function isCurrentlyUndoing() {
    return isUndoing;
}

// 获取历史长度
export function getHistoryLength() {
    return historyStack.length;
}

// 更新撤销按钮状态
function updateUndoButton() {
    const btn = document.getElementById('undoBtn');
    if (btn) {
        btn.disabled = historyStack.length === 0;
        const count = historyStack.length;
        btn.title = count > 0 ? `撤销 (${count}步可用)` : '撤销';
    }
}

// 初始化快捷键
function initKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z 或 Cmd+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            // 检查是否在输入框中
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                return; // 让输入框自己处理撤销
            }
            e.preventDefault();
            undo();
        }
    });
}

// 初始化
initKeyboardShortcut();

// 挂载到 window
window.initHistory = initHistory;
window.pushHistory = pushHistory;
window.updateLastSavedState = updateLastSavedState;
window.undo = undo;
window.getHistoryLength = getHistoryLength;
