[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md)

# 電子走位本（Stage Blocking App）

用於戲劇舞台走位記錄的線上系統。導演和舞台監督可以在排練中標註演員走位、編輯台詞、添加備註，並透過 Firebase 實現多用戶即時同步（可選）。

## 功能特性

- **即時走位標註** — 在舞台圖上點擊標記演員位置，支援拖曳調整、弧線走位、多選批次操作
- **台詞編輯** — 雙擊編輯台詞內容，支援新增/刪除行，所有修改即時同步
- **備註系統** — 在台詞中精確到字的位置添加導演備註（動作指示、表演提示等）
- **多用戶同步** — 基於 Firebase Realtime Database，多人同時編輯自動同步（可選）
- **場次/角色管理** — 按場次管理角色走位，支援台詞檢視和角色檢視切換
- **版本管理** — 儲存版本快照，隨時恢復到歷史版本
- **PDF 匯出** — 將走位本匯出為 PDF，包含走位圖和台詞對照
- **舞台圖管理** — 上傳和管理多張舞台圖，為不同場次配置不同舞台佈局
- **復原功能** — 支援 Ctrl+Z 復原走位操作

## 快速開始（無需 Firebase）

不配置 Firebase 也可以使用本應用的**唯讀模式**——適合試用或檢視已有走位記錄。

```bash
# 複製儲存庫
git clone https://github.com/Rice-Chinese-Theater-Club/stage-blocking-app.git
cd stage-blocking-app

# 使用任意靜態檔案伺服器
python3 -m http.server 8000
# 或: npx serve .
```

開啟 `http://localhost:8000`，應用會載入 `data/` 中的範例資料。你可以瀏覽場次、檢視走位標記、匯出 PDF。

**無 Firebase 的限制：** 編輯不會儲存——對走位、備註、台詞的修改在重新整理頁面後會遺失。多用戶同步不可用。

## 完整配置（使用 Firebase）

要啟用儲存、即時同步和多人協作，需要一個 Firebase 專案。

### 第 1 步：建立 Firebase 專案

1. 前往 [Firebase 主控台](https://console.firebase.google.com/)
2. 點擊 **新增專案**，按提示完成
3. 在專案首頁點擊 **Web 圖示** (`</>`) 註冊一個 Web 應用
4. 複製設定畫面中的 `firebaseConfig` 物件

### 第 2 步：啟用 Realtime Database

1. 在 Firebase 專案中，進入 **建構 → Realtime Database**
2. 點擊 **建立資料庫**
3. 選擇區域，以**測試模式**啟動（後續可以收緊安全規則）
4. 資料庫 URL 格式：`https://your-project-id-default-rtdb.firebaseio.com`

### 第 3 步：配置應用

編輯 `js/config.js`，填入你的 Firebase 配置：

```javascript
export const firebaseConfig = {
    apiKey: "AIzaSy...",              // 必填
    authDomain: "myapp.firebaseapp.com",  // 必填
    databaseURL: "https://myapp-default-rtdb.firebaseio.com",  // 必填
    projectId: "myapp",              // 必填
    storageBucket: "myapp.appspot.com",   // 必填
    messagingSenderId: "123456789",  // 必填
    appId: "1:123456789:web:abc",    // 必填
    measurementId: "G-XXXXXXXXXX"    // 可選（僅用於 Analytics）
};
```

其他配置欄位：

| 欄位 | 是否必填 | 說明 |
|------|---------|------|
| `DRIVE_UPLOAD_URL` | 否 | Google Apps Script URL，用於上傳圖片到 Google Drive。不需要可保留佔位符。 |
| `GITHUB_WORKFLOW_TOKEN` | 否 | GitHub PAT，用於觸發 Actions 工作流程（資料備份）。不需要可保留佔位符。 |
| `GITHUB_REPO` | 否 | `org/repo` 格式，用於 GitHub Actions 整合。 |
| `features.*` | 否 | 功能開關：搜尋、GitHub 同步、版本管理、PDF 匯出。 |

### 第 4 步：執行

```bash
python3 -m http.server 8000
```

開啟 `http://localhost:8000`，走位資料會自動儲存到 Firebase。

## 準備劇本資料

編輯 `data/` 目錄下的 JSON 檔案。只需要三個核心檔案：

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

| 欄位 | 必填 | 說明 |
|------|-----|------|
| `id` | 是 | 唯一識別碼（內部使用） |
| `name` | 是 | 簡短顯示名稱（顯示在舞台圖標記上） |
| `fullName` | 是 | 全名（顯示在角色列表中） |
| `color` | 是 | 該角色標記的顏色（十六進位） |

### `scenes.json`

```json
[
  {
    "id": "1-1",
    "name": "第一幕 第一場",
    "subtitle": "初到",
    "stageMap": "act1/stage.png",
    "characters": ["alice", "bob"]
  }
]
```

| 欄位 | 必填 | 說明 |
|------|-----|------|
| `id` | 是 | 唯一場次識別碼（如 `"1-1"`、`"2-3"`） |
| `name` | 是 | 顯示名稱 |
| `subtitle` | 否 | 可選副標題 |
| `stageMap` | 否 | 舞台圖路徑，相對於 `stage-layouts/` 目錄 |
| `characters` | 否 | 該場次的角色 `id` 陣列 |

### `lines.json`

```json
[
  {
    "sceneId": "1-1",
    "character": "alice",
    "content": "有人在嗎？",
    "isStageDirection": false,
    "lineNumber": 1
  },
  {
    "sceneId": "1-1",
    "character": null,
    "content": "（Alice 從舞台左側上場）",
    "isStageDirection": true,
    "lineNumber": null
  }
]
```

| 欄位 | 必填 | 說明 |
|------|-----|------|
| `sceneId` | 是 | 所屬場次 |
| `character` | 是* | 說台詞的角色 `id`。舞台指示為 `null`。 |
| `content` | 是 | 台詞文本或舞台指示 |
| `isStageDirection` | 是 | `true` 為舞台指示，`false` 為台詞 |
| `lineNumber` | 否 | 顯示用行號。舞台指示為 `null`。 |

其他資料檔案（`blockingData.json`、`dialogueEdits.json`、`lineOperations.json`、`sceneCharacters.json`、`versions.json`）由應用透過 Firebase 在執行時產生，可以保留為空物件 `{}` 或空陣列 `[]`。

## 新增舞台圖

將舞台佈局圖片放入 `stage-layouts/` 目錄：

```
stage-layouts/
├── default-blank.png      # 預設空白舞台
├── layout_1.png           # 命名佈局（可在應用內選擇）
├── layout_2.png
└── act1/
    └── stage.png          # 按幕預設圖（對應 scenes.json 中的 stageMap 欄位）
```

支援格式：PNG、JPG。建議尺寸：800×600 或類似橫向比例。

## 技術棧

- HTML5 / CSS3 / JavaScript (ES Modules)
- Firebase Realtime Database (v8 compat SDK，透過 CDN 載入)
- jsPDF + html2canvas (PDF 匯出)
- 無需建構步驟——直接作為靜態目錄提供服務

## 授權條款

[MIT](LICENSE)
