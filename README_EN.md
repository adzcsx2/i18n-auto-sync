# README_EN.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension for automatic i18n (internationalization) synchronization and translation. It automatically converts Chinese strings in code to `t("key")` format and maintains translation files. The extension specifically targets React/TypeScript projects with Chinese-to-English translation workflows.

## Common Commands

### Development
```bash
# Compile TypeScript to JavaScript
npm run compile

# Watch mode for development (recompiles on changes)
npm run watch

# Package extension as VSIX file
npm run package

# Full development workflow (compile + package + install)
npm run install

# Uninstall extension
npm run uninstall
```

### Debugging
- Press `F5` in VS Code to launch Extension Development Host
- Test extension functionality in the new VS Code window that opens

## Architecture

### Core Components

1. **extension.ts** - Main extension entry point
   - `I18nAutoSyncExtension` class manages the extension lifecycle
   - Handles VS Code commands, configuration, and file watching
   - Contains `WriteBatch` class for coordinated file writes to avoid conflicts

2. **i18nCore.ts** - Core processing logic
   - `PathUtils` - Centralized path management for project structure
   - `ChineseStringProcessor` - Detects and processes Chinese strings in code
   - `I18nSyncer` - Manages translation files and external translation APIs

### Key Features

- **Chinese String Detection**: Only processes strings containing Chinese characters ([\u4e00-\u9fa5])
- **Component Scope Handling**: Detects if `t()` functions are used outside React components
- **Translation Management**: Maintains synchronized zh/common.ts and en/common.ts files
- **Tencent Cloud Integration**: Optional automatic translation via Tencent Cloud API

### Project Structure Requirements

The extension expects this standard project structure:
```
your-project/
├── src/
│   ├── i18n/
│   │   ├── hooks.ts          # useTranslation hook
│   │   └── lang/
│   │       ├── zh/
│   │       │   └── common.ts # Chinese translations
│   │       └── en/
│   │           └── common.ts # English translations
```

### Configuration

Key VS Code settings (prefix: `i18n-auto-sync.`):
- `triggerMode`: "auto-save" or "manual"
- `langRootDir`: Root directory for i18n files (default: "src/")
- `activeDirectories`: Comma-separated directories to process (default: "src/*,pages/*")
- `excludePatterns`: Directories to exclude (default: "node_modules,.next,dist,build")
- `autoTranslate`: Enable Tencent Cloud translation
- `processExternalConstants`: Process constants outside React components

### Processing Logic

1. **String Detection**: Scans for Chinese characters in string literals
2. **Transformation**: Converts `"中文"` to `{t("中文")}`
3. **Import Management**: Auto-adds `useTranslation` hook imports
4. **Translation Sync**: Updates zh/common.ts and en/common.ts files
5. **Component Scope**: Ensures proper React component context for `t()` usage

## File Operations

The extension uses a `WriteBatch` system to:
- Coordinate multiple file writes in single operations
- Avoid conflicts with user edits in open documents
- Skip writes to dirty (unsaved) files
- Apply edits through VS Code workspace API when files are open

## Translation API

When enabled, uses Tencent Cloud Translation API with:
- Secret ID/Key configuration
- ap-beijing region (fixed)
- Retry mechanisms for failed requests
- 5 million free characters per month (compared to Baidu's 50k limit)