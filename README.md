# README.md

[🇨🇳 中文](README.md) | [🇺🇸 English](README_EN.md)

这个文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

这是一个用于自动 i18n（国际化）同步和翻译的 VS Code 扩展。它会自动将代码中的中文字符串转换为 `t("key")` 格式并维护翻译文件。该扩展专门针对具有中文到英文翻译工作流的 React/TypeScript 项目。

## 常用命令

### 开发
```bash
# 将 TypeScript 编译为 JavaScript
npm run compile

# 开发模式（文件变化时重新编译）
npm run watch

# 将扩展打包为 VSIX 文件
npm run package

# 完整开发工作流（编译 + 打包 + 安装）
npm run install

# 卸载扩展
npm run uninstall
```

### 调试
- 在 VS Code 中按 `F5` 启动扩展开发主机
- 在新打开的 VS Code 窗口中测试扩展功能

## 架构

### 核心组件

1. **extension.ts** - 扩展主入口点
   - `I18nAutoSyncExtension` 类管理扩展生命周期
   - 处理 VS Code 命令、配置和文件监视
   - 包含 `WriteBatch` 类用于协调文件写入以避免冲突

2. **i18nCore.ts** - 核心处理逻辑
   - `PathUtils` - 项目结构的集中路径管理
   - `ChineseStringProcessor` - 检测和处理代码中的中文字符串
   - `I18nSyncer` - 管理翻译文件和外部翻译 API

### 关键特性

- **中文字符串检测**：仅处理包含中文字符的字符串 ([\u4e00-\u9fa5])
- **组件作用域处理**：检测 `t()` 函数是否在 React 组件外部使用
- **翻译管理**：维护同步的 zh/common.ts 和 en/common.ts 文件
- **腾讯云集成**：通过腾讯云 API 进行可选的自动翻译

### 项目结构要求

扩展期望以下标准项目结构：
```
your-project/
├── src/
│   ├── i18n/
│   │   ├── hooks.ts          # useTranslation hook
│   │   └── lang/
│   │       ├── zh/
│   │       │   └── common.ts # 中文翻译
│   │       └── en/
│   │           └── common.ts # 英文翻译
```

### 配置

关键 VS Code 设置（前缀：`i18n-auto-sync.`）：
- `triggerMode`："auto-save" 或 "manual"
- `langRootDir`：i18n 文件的根目录（默认："src/"）
- `activeDirectories`：要处理的目录，逗号分隔（默认："src/*,pages/*"）
- `excludePatterns`：要排除的目录（默认："node_modules,.next,dist,build"）
- `autoTranslate`：启用腾讯云翻译
- `processExternalConstants`：处理 React 组件外部的常量

### 处理逻辑

1. **字符串检测**：扫描字符串字面量中的中文字符
2. **转换**：将 `"中文"` 转换为 `{t("中文")}`
3. **导入管理**：自动添加 `useTranslation` hook 导入
4. **翻译同步**：更新 zh/common.ts 和 en/common.ts 文件
5. **组件作用域**：确保 `t()` 使用的正确 React 组件上下文

## 文件操作

扩展使用 `WriteBatch` 系统来：
- 在单个操作中协调多个文件写入
- 避免与打开文档中的用户编辑冲突
- 跳过对脏（未保存）文件的写入
- 当文件打开时通过 VS Code 工作区 API 应用编辑

## 翻译 API

启用时，使用腾讯云翻译 API：
- Secret ID/密钥配置
- ap-beijing 区域（固定）
- 失败请求的重试机制
- 每月 500 万免费字符（相比百度的 5 万限制）

---

## English Documentation

For detailed technical documentation and architecture information, please refer to [README_EN.md](README_EN.md).