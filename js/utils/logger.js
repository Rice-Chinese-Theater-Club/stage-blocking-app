// logger.js - 统一日志系统
import { DEBUG_MODE, VERSION } from '../config.js';

// 条件日志函数
export const log = DEBUG_MODE ? console.log.bind(console) : () => {};
export const logError = console.error.bind(console); // 错误始终输出

// 版本标记 - 仅在调试模式下显示
if (DEBUG_MODE) {
    console.log(
        `%c📦 电子走位本 ${VERSION} 已加载`,
        'background: #FF5722; color: white; padding: 5px 10px; font-size: 14px; font-weight: bold;'
    );
}
