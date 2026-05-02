[English](README.md) | [简体中文](README.zh-CN.md)

# 电子走位本

## 简介

电子走位本是一个用于戏剧舞台走位记录的在线系统。它允许导演和舞台监督在排练过程中实时标注演员走位、编辑台词、添加备注，并通过 Firebase 实现多用户实时同步。

## 功能特性

- **实时走位标注** - 在舞台图上点击标记演员位置，支持拖拽调整、弧线走位、多选批量操作
- **台词编辑** - 双击编辑台词内容，支持新增/删除行，所有修改实时同步
- **备注系统** - 在台词中精确到字的位置添加导演备注（动作指示、表演提示等）
- **多用户同步** - 基于 Firebase Realtime Database，多人同时编辑自动同步
- **场次/角色管理** - 按场次管理角色走位，支持台词视图和角色视图切换
- **版本管理** - 保存版本快照，随时恢复到历史版本
- **PDF 导出** - 将走位本导出为 PDF，包含走位图和台词对照
- **舞台图管理** - 上传和管理多张舞台图，为不同场次配置不同舞台布局
- **撤销功能** - 支持 Ctrl+Z 撤销走位操作

## 快速开始

1. **配置 Firebase**
   - 创建 Firebase 项目并启用 Realtime Database
   - 将 Firebase 配置填入 `js/config.js`

2. **准备数据**
   - 编辑 `data/` 目录下的 JSON 文件，填入你的剧本数据
   - `characters.json` - 角色信息
   - `scenes.json` - 场次信息
   - `lines.json` - 台词数据

3. **添加舞台图**
   - 将舞台布局图片放入 `走位图/` 目录

4. **本地运行**
   ```bash
   # 使用任意静态文件服务器
   python3 -m http.server 8000
   # 或
   npx serve .
   ```
   然后访问 `http://localhost:8000`

## 技术栈

- HTML5 / CSS3 / JavaScript (ES Modules)
- Firebase Realtime Database (v8 compat SDK)
- jsPDF + html2canvas (PDF 导出)

## 截图

<!-- 在此添加应用截图 -->
![Screenshot Placeholder](https://via.placeholder.com/800x450?text=Screenshot+Placeholder)
