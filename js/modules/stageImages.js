// stageImages.js - 舞台图管理模块（图片库 + 场次配置）
import { BlockingApp, stageLibraryRef, sceneStageMapRef } from '../services/firebase.js';
import { showStatus } from '../utils/helpers.js';
import { log, logError } from '../utils/logger.js';
import { GITHUB_REPO } from '../config.js';

// 当前 Tab 状态
let currentTab = 'library';

// 场次舞台图配置（内存缓存）
let sceneStageMap = {};

// 从场景ID解析幕号
export function getActFromSceneId(sceneId) {
    return sceneId.split('-')[0];
}

// 辅助函数：File 转 Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 生成唯一 key
function generateImageKey(name) {
    const timestamp = Date.now();
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    return `${safeName}_${timestamp}`;
}

// 获取GitHub配置（从localStorage）
function getGithubToken() {
    return localStorage.getItem('stageImageGithubToken') || '';
}

function setGithubToken(token) {
    localStorage.setItem('stageImageGithubToken', token);
}

// 加载图片库数据（从 Firebase，并与本地同步）
export async function loadStageLibrary() {
    try {
        const snapshot = await stageLibraryRef.once('value');
        const firebaseData = snapshot.val() || {};

        // 获取本地加载的图片库（由 init.js 的 loadStageImages 加载）
        const localLibrary = BlockingApp.data.stageImages?.library || {};

        // 合并：本地数据为基础，Firebase 数据补充
        const mergedLibrary = { ...localLibrary };

        // Firebase 中的额外数据也加入（用户之前上传的）
        Object.keys(firebaseData).forEach(key => {
            if (!mergedLibrary[key]) {
                mergedLibrary[key] = firebaseData[key];
            }
        });

        // 检查是否需要同步本地图片到 Firebase
        const localKeys = Object.keys(localLibrary);
        const firebaseKeys = Object.keys(firebaseData);
        const newKeys = localKeys.filter(k => !firebaseKeys.includes(k));

        if (newKeys.length > 0) {
            log(`  发现 ${newKeys.length} 张新图片，同步到 Firebase...`);

            const syncData = {};
            newKeys.forEach(key => {
                syncData[key] = {
                    name: localLibrary[key].name,
                    path: localLibrary[key].path
                };
            });

            await stageLibraryRef.update(syncData);
            log(`  ✓ 已同步 ${newKeys.length} 张图片元数据到 Firebase`);
        }

        // 更新内存中的图片库
        BlockingApp.data.stageImages.library = mergedLibrary;

        log('  图片库加载完成，共', Object.keys(mergedLibrary).length, '张');
    } catch (error) {
        logError('加载图片库失败:', error);
    }
}

// 一次性同步所有本地图片到 GitHub（手动触发）
export async function syncAllImagesToGitHub() {
    const token = getGithubToken();
    if (!token) {
        showStatus('请先配置 GitHub Token', 'warning');
        return false;
    }

    const library = BlockingApp.data.stageImages?.library || {};
    const images = Object.entries(library);

    if (images.length === 0) {
        showStatus('没有图片需要同步', 'info');
        return false;
    }

    showStatus(`开始同步 ${images.length} 张图片到 GitHub...`, 'info');

    let successCount = 0;
    for (const [key, data] of images) {
        if (!data.base64) continue;

        try {
            const content = data.base64.split(',')[1];
            const githubPath = `走位图/library/${key}.png`;

            // 检查文件是否已存在
            let sha = null;
            try {
                const existingFile = await fetch(
                    `https://api.github.com/repos/${GITHUB_REPO}/contents/${githubPath}?ref=main`,
                    {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                if (existingFile.ok) {
                    const fileData = await existingFile.json();
                    sha = fileData.sha;
                    log(`    跳过已存在: ${data.name}`);
                    successCount++;
                    continue;
                }
            } catch (e) {
                // 文件不存在，继续上传
            }

            // 上传到 GitHub
            const response = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${githubPath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `同步舞台图: ${data.name}`,
                        content: content,
                        branch: 'main',
                        sha: sha
                    })
                }
            );

            if (response.ok) {
                log(`    ✓ 上传成功: ${data.name}`);
                successCount++;
            } else {
                const error = await response.json();
                logError(`    ✗ 上传失败: ${data.name}`, error.message);
            }
        } catch (error) {
            logError(`    ✗ 上传失败: ${data.name}`, error);
        }
    }

    showStatus(`同步完成: ${successCount}/${images.length} 张图片`, successCount === images.length ? 'success' : 'warning');
    return successCount === images.length;
}

// 加载场次配置
export async function loadSceneStageMap() {
    try {
        const snapshot = await sceneStageMapRef.once('value');
        sceneStageMap = snapshot.val() || {};
        log('  场次舞台图配置加载完成');
    } catch (error) {
        logError('加载场次配置失败:', error);
    }
}

// 获取某场次应该使用的舞台图
export function getStageImageForScene(sceneId) {
    const library = BlockingApp.data.stageImages.library || {};

    // 1. 检查是否有单独配置
    const customKey = sceneStageMap[sceneId];
    if (customKey && library[customKey]) {
        return library[customKey].base64;
    }

    // 2. 否则使用该幕的默认图
    const actNumber = getActFromSceneId(sceneId);
    return BlockingApp.data.stageImages[actNumber] || null;
}

// 上传图片到图片库
export async function uploadToLibrary(files, names = []) {
    const token = getGithubToken();

    if (!token) {
        showStatus('请先设置 GitHub Token', 'warning');
        showTokenConfig();
        return false;
    }

    if (!BlockingApp.data.stageImages.library) {
        BlockingApp.data.stageImages.library = {};
    }

    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const customName = names[i] || file.name.replace(/\.[^.]+$/, '');

        try {
            showStatus(`正在上传 ${customName}...`, 'info');

            // 转换为 Base64
            const base64Content = await fileToBase64(file);
            const content = base64Content.split(',')[1];

            // 生成唯一 key
            const imageKey = generateImageKey(customName);
            const path = `走位图/library/${imageKey}.png`;

            // 上传到 GitHub
            const response = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `添加舞台图: ${customName}`,
                        content: content,
                        branch: 'main'
                    })
                }
            );

            if (response.ok) {
                // 保存到 Firebase
                const imageData = {
                    name: customName,
                    base64: base64Content,
                    path: path,
                    uploadedAt: Date.now()
                };

                await stageLibraryRef.child(imageKey).set(imageData);

                // 更新本地缓存
                BlockingApp.data.stageImages.library[imageKey] = imageData;

                results.push({ success: true, name: customName, key: imageKey });
            } else {
                const error = await response.json();
                throw new Error(error.message || '上传失败');
            }
        } catch (error) {
            logError(`上传 ${customName} 失败:`, error);
            results.push({ success: false, name: customName, error: error.message });
        }
    }

    // 刷新界面
    renderLibraryTab();

    const successCount = results.filter(r => r.success).length;
    if (successCount === files.length) {
        showStatus(`成功上传 ${successCount} 张图片`, 'success');
    } else {
        showStatus(`上传完成: ${successCount}/${files.length} 成功`, 'warning');
    }

    return results;
}

// 从图片库删除
export async function deleteFromLibrary(imageKey) {
    const token = getGithubToken();
    const library = BlockingApp.data.stageImages.library || {};
    const imageData = library[imageKey];

    if (!imageData) {
        showStatus('图片不存在', 'error');
        return false;
    }

    // 检查是否有场次正在使用
    const usedBy = Object.entries(sceneStageMap)
        .filter(([_, key]) => key === imageKey)
        .map(([sceneId]) => sceneId);

    if (usedBy.length > 0) {
        showStatus(`该图片正被 ${usedBy.join(', ')} 使用，请先解除关联`, 'error');
        return false;
    }

    if (!confirm(`确定删除图片「${imageData.name}」？`)) {
        return false;
    }

    try {
        showStatus('正在删除...', 'info');

        // 从 GitHub 删除（需要先获取 SHA）
        if (token && imageData.path) {
            try {
                const getResponse = await fetch(
                    `https://api.github.com/repos/${GITHUB_REPO}/contents/${imageData.path}?ref=main`,
                    {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );

                if (getResponse.ok) {
                    const fileData = await getResponse.json();
                    await fetch(
                        `https://api.github.com/repos/${GITHUB_REPO}/contents/${imageData.path}`,
                        {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `token ${token}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                message: `删除舞台图: ${imageData.name}`,
                                sha: fileData.sha,
                                branch: 'main'
                            })
                        }
                    );
                }
            } catch (e) {
                logError('GitHub 删除失败:', e);
            }
        }

        // 从 Firebase 删除
        await stageLibraryRef.child(imageKey).remove();

        // 更新本地缓存
        delete BlockingApp.data.stageImages.library[imageKey];

        // 刷新界面
        renderLibraryTab();

        showStatus('图片已删除', 'success');
        return true;
    } catch (error) {
        logError('删除失败:', error);
        showStatus('删除失败: ' + error.message, 'error');
        return false;
    }
}

// 保存场次配置
export async function saveSceneStageMap(newConfig) {
    try {
        await sceneStageMapRef.set(newConfig);
        sceneStageMap = newConfig;
        showStatus('场次配置已保存', 'success');

        // 刷新当前场景的舞台图
        if (window.currentScene && window.loadStageMap) {
            window.loadStageMap(window.currentScene.id);
        }

        return true;
    } catch (error) {
        logError('保存场次配置失败:', error);
        showStatus('保存失败', 'error');
        return false;
    }
}

// 渲染图片库 Tab
function renderLibraryTab() {
    const container = document.getElementById('stageImageTabContent');
    if (!container) return;

    const library = BlockingApp.data.stageImages.library || {};
    const defaultImages = BlockingApp.data.stageImages || {};

    // 构建图片列表（默认图 + 自定义图）
    let html = '<div class="stage-library-grid">';

    // 默认的 4 幕图片
    ['1', '2', '3', '4'].forEach(act => {
        const base64 = defaultImages[act];
        html += `
            <div class="stage-library-item default-image">
                <div class="stage-image-preview">
                    ${base64
                        ? `<img src="${base64}" alt="第${act}幕">`
                        : '<div class="no-image">暂无</div>'
                    }
                </div>
                <div class="stage-image-name">第${act}幕（默认）</div>
            </div>
        `;
    });

    // 自定义图片
    Object.entries(library).forEach(([key, data]) => {
        html += `
            <div class="stage-library-item" data-key="${key}">
                <div class="stage-image-preview">
                    <img src="${data.base64}" alt="${data.name}">
                </div>
                <div class="stage-image-name">${data.name}</div>
                <button class="delete-image-btn" onclick="deleteStageImage('${key}')" title="删除">x</button>
            </div>
        `;
    });

    // 上传按钮
    html += `
        <div class="stage-library-item upload-item">
            <input type="file" id="libraryUploadInput" accept="image/*" multiple
                   onchange="handleLibraryUpload(this)" style="display: none;">
            <div class="upload-placeholder" onclick="document.getElementById('libraryUploadInput').click()">
                <div class="upload-icon">+</div>
                <div class="upload-text">上传图片</div>
                <div class="upload-hint">支持多选</div>
            </div>
        </div>
    `;

    html += '</div>';

    container.innerHTML = html;
}

// 渲染场次配置 Tab
function renderConfigTab() {
    const container = document.getElementById('stageImageTabContent');
    if (!container) return;

    const scenes = BlockingApp.data.scenes || [];
    const library = BlockingApp.data.stageImages.library || {};
    const defaultImages = BlockingApp.data.stageImages || {};

    let html = '<div class="scene-config-list">';

    scenes.forEach(scene => {
        const currentValue = sceneStageMap[scene.id] || '';
        const actNumber = getActFromSceneId(scene.id);

        html += `
            <div class="scene-config-item">
                <div class="scene-config-label">
                    <span class="scene-id">${scene.id}</span>
                    <span class="scene-name">${scene.name}</span>
                </div>
                <select class="scene-stage-select" data-scene="${scene.id}">
                    <option value="" ${!currentValue ? 'selected' : ''}>第${actNumber}幕（默认）</option>
        `;

        // 添加图片库选项
        Object.entries(library).forEach(([key, data]) => {
            html += `<option value="${key}" ${currentValue === key ? 'selected' : ''}>${data.name}</option>`;
        });

        html += `
                </select>
            </div>
        `;
    });

    html += '</div>';
    html += `
        <div class="config-actions">
            <button class="save-config-btn" onclick="saveStageConfig()">保存配置</button>
        </div>
    `;

    container.innerHTML = html;
}

// 切换 Tab
function switchTab(tab) {
    currentTab = tab;

    // 更新 Tab 按钮状态
    document.querySelectorAll('.stage-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // 渲染对应内容
    if (tab === 'library') {
        renderLibraryTab();
    } else {
        renderConfigTab();
    }
}

// 显示 Token 配置
function showTokenConfig() {
    const currentToken = getGithubToken();
    const maskedToken = currentToken ? '****' + currentToken.slice(-8) : '未设置';

    const modal = document.getElementById('stageImageModal');
    const content = modal.querySelector('.modal-content');

    content.innerHTML = `
        <div class="modal-header">GitHub Token 配置</div>
        <div class="config-actors-info">
            <p>上传舞台图需要具有 <code>repo</code> 权限的 GitHub Personal Access Token</p>
            <p style="margin-top: 10px; font-size: 12px; color: #666;">
                创建方法：GitHub Settings -> Developer settings -> Personal access tokens -> Generate new token
            </p>
        </div>
        <div style="margin: 20px 0;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">当前Token: ${maskedToken}</label>
            <input type="password" id="githubTokenInput" placeholder="输入新的 GitHub Token"
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
        </div>
        <div class="modal-buttons">
            <button class="cancel" onclick="showStageImageManager()">返回</button>
            <button onclick="saveGithubToken()">保存Token</button>
        </div>
    `;
}

// 保存 Token
function saveGithubToken() {
    const input = document.getElementById('githubTokenInput');
    const token = input.value.trim();

    if (token) {
        setGithubToken(token);
        showStatus('GitHub Token 已保存', 'success');
    }

    showStageImageManager();
}

// 显示舞台图管理模态框
export function showStageImageManager() {
    const modal = document.getElementById('stageImageModal');
    if (!modal) return;

    const content = modal.querySelector('.modal-content');
    const hasToken = !!getGithubToken();

    content.innerHTML = `
        <div class="modal-header">舞台图管理</div>
        <div class="stage-tabs">
            <button class="stage-tab-btn ${currentTab === 'library' ? 'active' : ''}"
                    data-tab="library" onclick="switchStageTab('library')">图片库</button>
            <button class="stage-tab-btn ${currentTab === 'config' ? 'active' : ''}"
                    data-tab="config" onclick="switchStageTab('config')">场次配置</button>
        </div>
        <div class="stage-tab-content" id="stageImageTabContent">
            <!-- 动态渲染 -->
        </div>
        <div class="modal-buttons">
            <button class="cancel" onclick="closeStageImageManager()">关闭</button>
            <button onclick="showTokenConfigUI()">配置 Token</button>
        </div>
    `;

    // 渲染当前 Tab
    if (currentTab === 'library') {
        renderLibraryTab();
    } else {
        renderConfigTab();
    }

    modal.classList.add('active');
}

// 处理图片库上传
async function handleLibraryUpload(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    // 如果只有一张图，直接上传
    if (files.length === 1) {
        const name = prompt('请输入图片名称：', files[0].name.replace(/\.[^.]+$/, ''));
        if (name === null) return;
        await uploadToLibrary(files, [name]);
    } else {
        // 多张图片，使用文件名
        await uploadToLibrary(files);
    }

    // 清空 input
    input.value = '';
}

// 保存场次配置
function saveStageConfig() {
    const selects = document.querySelectorAll('.scene-stage-select');
    const newConfig = {};

    selects.forEach(select => {
        const sceneId = select.dataset.scene;
        const value = select.value;
        if (value) {
            newConfig[sceneId] = value;
        }
    });

    saveSceneStageMap(newConfig);
}

// 关闭舞台图管理模态框
export function closeStageImageManager() {
    const modal = document.getElementById('stageImageModal');
    if (modal) modal.classList.remove('active');
}

// 挂载到 window
window.showStageImageManager = showStageImageManager;
window.closeStageImageManager = closeStageImageManager;
window.handleLibraryUpload = handleLibraryUpload;
window.saveGithubToken = saveGithubToken;
window.showTokenConfigUI = showTokenConfig;
window.switchStageTab = switchTab;
window.deleteStageImage = deleteFromLibrary;
window.saveStageConfig = saveStageConfig;
window.getStageImageForScene = getStageImageForScene;
window.sceneStageMap = sceneStageMap;
window.syncAllImagesToGitHub = syncAllImagesToGitHub;
