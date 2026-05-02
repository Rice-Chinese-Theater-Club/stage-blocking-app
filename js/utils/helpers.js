// helpers.js - 通用工具函数
import { log, logError } from './logger.js';

// ==================== 安全 DOM 操作 ====================

// 安全获取 DOM 元素，不存在时返回 null 且不报错
export function safeGetElement(id) {
    return document.getElementById(id);
}

// 安全添加事件监听器
export function safeAddEventListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
        return true;
    }
    return false;
}

// 安全设置属性
export function safeSetProperty(id, property, value) {
    const el = document.getElementById(id);
    if (el) {
        el[property] = value;
        return true;
    }
    return false;
}

// ====================

// Promise超时包装器
export function withTimeout(promise, timeoutMs, operationName) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operationName} 超时 (${timeoutMs}ms)`)), timeoutMs)
        )
    ]);
}

// 统一获取场景ID的方式，兼容currentScene是对象或字符串的情况
export function getCurrentSceneId() {
    if (!window.currentScene) return null;

    log('getCurrentSceneId - currentScene type:', typeof window.currentScene);
    log('getCurrentSceneId - currentScene value:', window.currentScene);

    if (typeof window.currentScene === 'object') {
        const id = window.currentScene.id;
        if (!id) {
            logError('currentScene对象没有id属性:', window.currentScene);
            return null;
        }
        return id;
    } else {
        return window.currentScene;
    }
}

// 验证Firebase路径，防止无效字符
export function validateFirebasePath(path) {
    if (!path) {
        logError('Firebase路径为空');
        return false;
    }

    if (path.includes('[object Object]')) {
        logError('Firebase路径包含无效的对象引用:', path);
        return false;
    }

    const invalidChars = /[.#$\[\]]/;
    if (invalidChars.test(path)) {
        logError('Firebase路径包含无效字符:', path);
        return false;
    }

    return true;
}

// 包装Firebase操作，添加路径验证
export function safeFirebaseOperation(operation, errorMessage) {
    try {
        return operation();
    } catch (error) {
        logError(errorMessage || 'Firebase操作失败:', error);
        if (error.message && error.message.includes('[object Object]')) {
            alert('数据操作失败：场景信息错误。请刷新页面重试。');
        } else {
            alert('数据操作失败：' + (error.message || '未知错误'));
        }
        return null;
    }
}

// 将hex颜色转换为RGB
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 100, g: 100, b: 100 };
}

// 将ArrayBuffer转换为Base64
export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// 排序走位的辅助函数
export function sortMovements(movements) {
    movements.sort((a, b) => {
        const aHasLine = a.lineId && a.charIndex !== undefined;
        const bHasLine = b.lineId && b.charIndex !== undefined;

        if (aHasLine && bHasLine) {
            const aLineParts = a.lineId.split('-');
            const bLineParts = b.lineId.split('-');
            const aLine = parseInt(aLineParts[aLineParts.length - 1]) || 0;
            const bLine = parseInt(bLineParts[bLineParts.length - 1]) || 0;
            const lineDiff = aLine - bLine;
            if (lineDiff !== 0) return lineDiff;
            return (a.charIndex || 0) - (b.charIndex || 0);
        }

        if (aHasLine && !bHasLine) return -1;
        if (!aHasLine && bHasLine) return 1;

        return (a.timestamp || 0) - (b.timestamp || 0);
    });
}

// 显示状态提示
export function showStatus(message, type = 'info') {
    const statusBar = document.getElementById('statusBar');
    if (!statusBar) return;

    const colors = {
        info: '#2196F3',
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800'
    };

    statusBar.textContent = message;
    statusBar.style.background = colors[type] || colors.info;
    statusBar.style.color = 'white';
    statusBar.style.padding = '10px';
    statusBar.style.display = 'block';

    if (type !== 'error') {
        setTimeout(() => {
            statusBar.style.display = 'none';
        }, 3000);
    }
}

// 更新保存状态
export function updateSaveStatus(status) {
    // 不显示"保存中"状态
    if (status === 'saving') return;

    const statusEl = document.getElementById('saveStatus');
    if (!statusEl) return;

    const statusText = {
        saved: '已保存',
        synced: '已同步',
        error: '保存失败'
    };

    statusEl.textContent = statusText[status] || status;
    statusEl.className = 'save-status ' + status;
}

// 模态框操作辅助函数
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// 获取相对坐标
export function getRelativeCoordinates(event, element) {
    const rect = element.getBoundingClientRect();
    return {
        x: parseFloat(((event.clientX - rect.left) / rect.width * 100).toFixed(2)),
        y: parseFloat(((event.clientY - rect.top) / rect.height * 100).toFixed(2))
    };
}

// 确保角色数据存在
export function ensureCharacterData(blockingData, sceneId, charName) {
    if (!blockingData[sceneId]) {
        blockingData[sceneId] = {};
    }
    if (!blockingData[sceneId][charName]) {
        blockingData[sceneId][charName] = {
            initial: null,
            movements: []
        };
    }
    return blockingData[sceneId][charName];
}

// 根据名称获取角色
export function getCharacterByName(characters, charName) {
    return characters.find(c => c.name === charName);
}

// 解析角色名（处理合台词如 "A、B、C" -> ["A", "B", "C"]）
// 过滤掉"众"角色，走位功能不需要
export function parseCharacterNames(charString) {
    if (!charString) return [];
    if (charString === '众') return [];
    // 用顿号拆分，并过滤掉"众"
    return charString.split('、').map(s => s.trim()).filter(s => s && s !== '众');
}

// 获取场景角色列表（从配置或台词中解析）
export function getSceneCharactersList(scenes, lines, sceneId) {
    const sceneObj = scenes.find(s => s.id === sceneId);
    // 优先使用场景配置的角色
    if (sceneObj?.characters?.length > 0) {
        return sceneObj.characters;
    }
    // 从台词中解析角色
    const sceneLines = lines.filter(line =>
        line.sceneId === sceneId && !line.isStageDirection
    );
    const allChars = new Set();
    sceneLines.forEach(line => {
        parseCharacterNames(line.character).forEach(c => allChars.add(c));
    });
    return [...allChars];
}
