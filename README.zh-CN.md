[English](README.md) | [简体中文](README.zh-CN.md)

# 电子走位本（Stage Blocking App）

用于戏剧舞台走位记录的在线系统。导演和舞台监督可以在排练中标注演员走位、编辑台词、添加备注，并通过 Firebase 实现多用户实时同步（可选）。

## 功能特性

- **实时走位标注** — 在舞台图上点击标记演员位置，支持拖拽调整、弧线走位、多选批量操作
- **台词编辑** — 双击编辑台词内容，支持新增/删除行，所有修改实时同步
- **备注系统** — 在台词中精确到字的位置添加导演备注（动作指示、表演提示等）
- **多用户同步** — 基于 Firebase Realtime Database，多人同时编辑自动同步（可选）
- **场次/角色管理** — 按场次管理角色走位，支持台词视图和角色视图切换
- **版本管理** — 保存版本快照，随时恢复到历史版本
- **PDF 导出** — 将走位本导出为 PDF，包含走位图和台词对照
- **舞台图管理** — 上传和管理多张舞台图，为不同场次配置不同舞台布局
- **撤销功能** — 支持 Ctrl+Z 撤销走位操作

## 快速开始（无需 Firebase）

不配置 Firebase 也可以使用本应用的**只读模式**——适合试用或查看已有走位记录。

```bash
# 克隆仓库
git clone https://github.com/Rice-Chinese-Theater-Club/stage-blocking-app.git
cd stage-blocking-app

# 使用任意静态文件服务器
python3 -m http.server 8000
# 或: npx serve .
```

打开 `http://localhost:8000`，应用会加载 `data/` 中的示例数据。你可以浏览场次、查看走位标记、导出 PDF。

**无 Firebase 的限制：** 编辑不会保存——对走位、备注、台词的修改在刷新页面后会丢失。多用户同步不可用。

## 完整配置（使用 Firebase）

要启用保存、实时同步和多人协作，需要一个 Firebase 项目。

### 第 1 步：创建 Firebase 项目

1. 访问 [Firebase 控制台](https://console.firebase.google.com/)
2. 点击 **添加项目**，按提示完成
3. 在项目主页点击 **Web 图标** (`</>`) 注册一个 Web 应用
4. 复制设置界面中的 `firebaseConfig` 对象

### 第 2 步：启用 Realtime Database

1. 在 Firebase 项目中，进入 **构建 → Realtime Database**
2. 点击 **创建数据库**
3. 选择区域，以**测试模式**启动（后续可以收紧安全规则）
4. 数据库 URL 格式：`https://your-project-id-default-rtdb.firebaseio.com`

### 第 3 步：配置应用

编辑 `js/config.js`，填入你的 Firebase 配置：

```javascript
export const firebaseConfig = {
    apiKey: "AIzaSy...",              // 必填
    authDomain: "myapp.firebaseapp.com",  // 必填
    databaseURL: "https://myapp-default-rtdb.firebaseio.com",  // 必填
    projectId: "myapp",              // 必填
    storageBucket: "myapp.appspot.com",   // 必填
    messagingSenderId: "123456789",  // 必填
    appId: "1:123456789:web:abc",    // 必填
    measurementId: "G-XXXXXXXXXX"    // 可选（仅用于 Analytics）
};
```

其他配置字段：

| 字段 | 是否必填 | 说明 |
|------|---------|------|
| `DRIVE_UPLOAD_URL` | 否 | Google Apps Script URL，用于上传图片到 Google Drive。不需要可保留占位符。 |
| `GITHUB_WORKFLOW_TOKEN` | 否 | GitHub PAT，用于触发 Actions 工作流（数据备份）。不需要可保留占位符。 |
| `GITHUB_REPO` | 否 | `org/repo` 格式，用于 GitHub Actions 集成。 |
| `features.*` | 否 | 功能开关：搜索、GitHub 同步、版本管理、PDF 导出。 |

### 第 4 步：运行

```bash
python3 -m http.server 8000
```

打开 `http://localhost:8000`，走位数据会自动保存到 Firebase。

## 准备剧本数据

编辑 `data/` 目录下的 JSON 文件。只需要三个核心文件：

### `characters.json`

```json
[
  {
    "id": "alice",
    "name": "Alice",
    "fullName": "Alice Chen",
    "color": "#fde2e4"
  }
]
```

| 字段 | 必填 | 说明 |
|------|-----|------|
| `id` | 是 | 唯一标识符（内部使用） |
| `name` | 是 | 简短显示名称（显示在舞台图标记上） |
| `fullName` | 是 | 全名（显示在角色列表中） |
| `color` | 是 | 该角色标记的颜色（十六进制） |

### `scenes.json`

```json
[
  {
    "id": "1-1",
    "name": "第一幕 第一场",
    "subtitle": "初到",
    "stageMap": "act1/stage.png",
    "characters": ["alice", "bob"]
  }
]
```

| 字段 | 必填 | 说明 |
|------|-----|------|
| `id` | 是 | 唯一场次标识（如 `"1-1"`、`"2-3"`） |
| `name` | 是 | 显示名称 |
| `subtitle` | 否 | 可选副标题 |
| `stageMap` | 否 | 舞台图路径，相对于 `stage-layouts/` 目录 |
| `characters` | 否 | 该场次的角色 `id` 数组 |

### `lines.json`

```json
[
  {
    "sceneId": "1-1",
    "character": "alice",
    "content": "有人在吗？",
    "isStageDirection": false,
    "lineNumber": 1
  },
  {
    "sceneId": "1-1",
    "character": null,
    "content": "（Alice 从舞台左侧上场）",
    "isStageDirection": true,
    "lineNumber": null
  }
]
```

| 字段 | 必填 | 说明 |
|------|-----|------|
| `sceneId` | 是 | 所属场次 |
| `character` | 是* | 说台词的角色 `id`。舞台指示为 `null`。 |
| `content` | 是 | 台词文本或舞台指示 |
| `isStageDirection` | 是 | `true` 为舞台指示，`false` 为台词 |
| `lineNumber` | 否 | 显示用行号。舞台指示为 `null`。 |

其他数据文件（`blockingData.json`、`dialogueEdits.json`、`lineOperations.json`、`sceneCharacters.json`、`versions.json`）由应用通过 Firebase 在运行时生成，可以保留为空对象 `{}` 或空数组 `[]`。

## 添加舞台图

将舞台布局图片放入 `stage-layouts/` 目录：

```
stage-layouts/
├── default-blank.png      # 默认空白舞台
├── layout_1.png           # 命名布局（可在应用内选择）
├── layout_2.png
└── act1/
    └── stage.png          # 按幕默认图（对应 scenes.json 中的 stageMap 字段）
```

支持格式：PNG、JPG。建议尺寸：800×600 或类似横向比例。

## 技术栈

- HTML5 / CSS3 / JavaScript (ES Modules)
- Firebase Realtime Database (v8 compat SDK，通过 CDN 加载)
- jsPDF + html2canvas (PDF 导出)
- 无需构建步骤——直接作为静态目录提供服务

## 许可证

[MIT](LICENSE)
