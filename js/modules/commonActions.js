// commonActions.js - 常用动作模块
import { BlockingApp, commonActionsRef } from '../services/firebase.js';
import { showStatus, updateSaveStatus } from '../utils/helpers.js';

// 默认常用动作
const DEFAULT_COMMON_ACTIONS = [
    '站起',
    '坐下',
    '转身',
    '指向',
    '倒向',
    '看向'
];

// 舞台方位（固定9个）
const STAGE_DIRECTIONS = [
    ['USR', 'USC', 'USL'],
    ['CSR', 'CS', 'CSL'],
    ['DSR', 'DSC', 'DSL']
];

// 初始化常用动作
export async function initCommonActions() {
    // 从 Firebase 加载
    commonActionsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data)) {
            window.commonActions = data;
        } else if (!window.commonActions || window.commonActions.length === 0) {
            // 如果云端没有数据且本地也没有，使用默认值
            window.commonActions = [...DEFAULT_COMMON_ACTIONS];
            // 保存默认值到云端
            saveCommonActions();
        }
        // 刷新所有常用动作显示
        refreshAllCommonActionsUI();
    });
}

// 保存常用动作到 Firebase
function saveCommonActions() {
    updateSaveStatus('saving');
    commonActionsRef.set(window.commonActions)
        .then(() => {
            updateSaveStatus('synced');
        })
        .catch((error) => {
            console.error('保存常用动作失败:', error);
            updateSaveStatus('error');
        });
}

// 添加常用动作
export function addCommonAction(action) {
    if (!action || !action.trim()) return false;

    const trimmedAction = action.trim();

    // 检查是否已存在
    if (window.commonActions.includes(trimmedAction)) {
        showStatus('该动作已在常用列表中', 'info');
        return false;
    }

    window.commonActions.push(trimmedAction);
    saveCommonActions();
    showStatus('已添加到常用动作', 'success');
    return true;
}

// 删除常用动作
export function removeCommonAction(action) {
    const index = window.commonActions.indexOf(action);
    if (index > -1) {
        window.commonActions.splice(index, 1);
        saveCommonActions();
        showStatus('已从常用动作移除', 'success');
        return true;
    }
    return false;
}

// 重置为默认常用动作
export function resetCommonActions() {
    window.commonActions = [...DEFAULT_COMMON_ACTIONS];
    saveCommonActions();
    showStatus('已重置为默认常用动作', 'success');
    refreshAllCommonActionsUI();
}

// 渲染常用动作芯片
export function renderCommonActionsChips(containerId, inputId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const actions = window.commonActions || [];

    if (actions.length === 0) {
        container.innerHTML = '<span class="no-common-actions">暂无常用动作</span>';
        return;
    }

    container.innerHTML = actions.map(action =>
        `<span class="common-action-chip" data-action="${escapeHtml(action)}">${escapeHtml(action)}</span>`
    ).join('');

    // 绑定点击事件
    container.querySelectorAll('.common-action-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const actionText = chip.dataset.action;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = actionText;
                input.focus();
            }
            if (onSelect) {
                onSelect(actionText);
            }
        });
    });
}

// 渲染舞台方位选择器
export function renderStageDirections(containerId, inputId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '<div class="stage-direction-grid">';
    STAGE_DIRECTIONS.forEach(row => {
        row.forEach(dir => {
            html += `<button type="button" class="stage-direction-btn" data-direction="${dir}">${dir}</button>`;
        });
    });
    html += '</div>';

    container.innerHTML = html;

    // 绑定点击事件
    container.querySelectorAll('.stage-direction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const direction = btn.dataset.direction;
            const input = document.getElementById(inputId);
            if (input) {
                // 追加方位到输入框
                const currentValue = input.value.trim();
                if (currentValue) {
                    input.value = currentValue + direction;
                } else {
                    input.value = direction;
                }
                input.focus();
            }
        });
    });
}

// 刷新所有常用动作显示
function refreshAllCommonActionsUI() {
    // 台词备注模态框
    if (document.getElementById('commonActionsContainer')) {
        renderCommonActionsChips('commonActionsContainer', 'noteInput');
    }
    if (document.getElementById('stageDirectionContainer')) {
        renderStageDirections('stageDirectionContainer', 'noteInput');
    }
    // 走位备注模态框
    if (document.getElementById('movementCommonActionsContainer')) {
        renderCommonActionsChips('movementCommonActionsContainer', 'movementNoteInput');
    }
    if (document.getElementById('movementStageDirectionContainer')) {
        renderStageDirections('movementStageDirectionContainer', 'movementNoteInput');
    }
}

// 转义 HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加当前输入到常用动作
export function addCurrentActionToCommon(inputId) {
    const input = document.getElementById(inputId);
    if (input && input.value.trim()) {
        addCommonAction(input.value.trim());
        refreshAllCommonActionsUI();
    }
}

// 初始化
if (!window.commonActions) {
    window.commonActions = [];
}

// 挂载到 window
window.addCommonAction = addCommonAction;
window.removeCommonAction = removeCommonAction;
window.resetCommonActions = resetCommonActions;
window.renderCommonActionsChips = renderCommonActionsChips;
window.renderStageDirections = renderStageDirections;
window.initCommonActions = initCommonActions;
window.addCurrentActionToCommon = addCurrentActionToCommon;

// 首次部署时自动重置为新的默认值（只执行一次）
const COMMON_ACTIONS_VERSION = 3;  // 升级版本号
const storedVersion = localStorage.getItem('commonActionsVersion');
if (!storedVersion || parseInt(storedVersion) < COMMON_ACTIONS_VERSION) {
    // 延迟执行，等待 Firebase 连接
    setTimeout(() => {
        if (window.resetCommonActions) {
            window.resetCommonActions();
            localStorage.setItem('commonActionsVersion', COMMON_ACTIONS_VERSION.toString());
            console.log('常用动作已更新到版本', COMMON_ACTIONS_VERSION);
        }
    }, 2000);
}
