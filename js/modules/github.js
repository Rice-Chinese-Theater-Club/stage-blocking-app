// github.js - GitHub Actions 触发模块
import { GITHUB_WORKFLOW_TOKEN, GITHUB_REPO } from '../config.js';
import { showStatus } from '../utils/helpers.js';
import { log, logError } from '../utils/logger.js';

/**
 * 触发 GitHub Actions workflow 同步 Firebase 数据
 * @param {string} versionName - 版本名称，用于 commit 消息
 * @returns {Promise<boolean>} 是否触发成功
 */
export async function triggerGitHubSync(versionName) {
    if (!GITHUB_WORKFLOW_TOKEN) {
        log('GitHub 同步未配置（Token 为空）');
        return false;
    }

    try {
        log('🔄 触发 GitHub Actions 同步...');

        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sync-firebase.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${GITHUB_WORKFLOW_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        version_name: versionName || 'Auto sync'
                    }
                })
            }
        );

        if (response.status === 204) {
            log('✅ GitHub Actions 同步已触发');
            showStatus('已触发 GitHub 同步', 'success');
            return true;
        } else {
            const errorText = await response.text();
            logError('GitHub API 响应:', response.status, errorText);
            showStatus('GitHub 同步触发失败', 'error');
            return false;
        }
    } catch (error) {
        logError('触发 GitHub 同步失败:', error);
        showStatus('GitHub 同步触发失败: ' + error.message, 'error');
        return false;
    }
}

// 挂载到 window
window.triggerGitHubSync = triggerGitHubSync;
