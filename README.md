# I18n Auto Sync - VS Code 扩展

一键将中文字符串自动转换为 `t("key")` 形式，并同步维护翻译文件的 VS Code 扩展。

## ✨ 核心功能

- 🚀 **自动转换**: 将 `"你好世界"` 转换为 `{t("你好世界")}`
- 📝 **自动导入**: 自动添加 `import { useTranslation } from "@/i18n/hooks"`
- 🎯 **自动调用**: 自动添加 `const { t } = useTranslation()`
- 📁 **文件同步**: 自动更新 `zh/common.ts` 和 `en/common.ts` 翻译文件
- 🌍 **自动翻译**: 可选的腾讯云自动英文翻译

## 🚀 快速开始

### 第一步：安装依赖

确保你的项目已安装必要的依赖：

```bash
npm install react-i18next
# 或
yarn add react-i18next
```

### 第二步：安装扩展

#### 方法一：从源码安装

```bash
# 1. 克隆或下载扩展代码
git clone <repo-url>

# 2. 进入扩展目录
cd i18n-auto-sync

# 3. 安装依赖
npm install

# 4. 编译扩展
npm run compile

# 5. 打包扩展
npm run package

# 6. 安装到 VS Code
code --install-extension i18n-auto-sync-0.0.8.vsix
```

#### 方法二：开发模式

```bash
# 1. 在 VS Code 中打开扩展目录
code i18n-auto-sync

# 2. 按 F5 启动调试模式
# 这会打开一个新的 VS Code 窗口，扩展已加载
```

### 第三步：配置扩展

在 VS Code 设置中搜索 `i18n-auto-sync`：

```json
{
  "i18n-auto-sync.triggerMode": "manual",
  "i18n-auto-sync.langRootDir": "src/",
  "i18n-auto-sync.activeDirectories": "src/*",
  "i18n-auto-sync.autoTranslate": true,
  "i18n-auto-sync.tencentSecretId": "你的腾讯云ID",
  "i18n-auto-sync.tencentSecretKey": "你的腾讯云密钥"
}
```

## 📖 使用方法

### 基础用法

1. **创建包含中文的组件**:
```tsx
export default function App() {
  return <div>你好世界</div>;
}
```

2. **按快捷键处理**: `Ctrl+Alt+S`

3. **自动转换结果**:
```tsx
import { useTranslation } from "@/i18n/hooks";

export default function App() {
  const { t } = useTranslation();
  return <div>{t("你好世界")}</div>;
}
```

4. **自动生成翻译文件**:
```typescript
// src/i18n/lang/zh/common.ts
export default {
  "你好世界": "你好世界",
};

// src/i18n/lang/en/common.ts  
export default {
  "你好世界": "Hello World", // 如果配置了自动翻译
};
```

### 命令列表

| 快捷键 | 命令 | 说明 |
|--------|------|------|
| `Ctrl+Alt+S` | Save And Process | 保存并处理中文字符串 |
| `Ctrl+Shift+I` | Process Current File | 仅处理当前文件 |
| `Ctrl+Shift+R` | Rename Key | 重命名翻译键 |

## ⚙️ 配置选项

### 基础配置

- **`triggerMode`**: 触发模式
  - `manual`: 手动触发（推荐）
  - `auto-save`: 保存时自动触发

- **`langRootDir`**: 翻译文件根目录
  - 默认: `src/`
  - 生成路径: `<langRootDir>i18n/lang/{zh|en}/common.ts`

### 文件过滤

- **`activeDirectories`**: 处理目录（逗号分隔）
  - 默认: `src/*`
  - 示例: `src/*,pages/*`

- **`excludePatterns`**: 排除目录（逗号分隔）
  - 默认: `node_modules,.next,dist,build`

### 翻译配置

- **`autoTranslate`**: 是否自动翻译
- **`tencentSecretId`**: 腾讯云翻译 ID
- **`tencentSecretKey`**: 腾讯云翻译密钥

## 🏗️ 项目结构要求

扩展需要以下目录结构：

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
│   └── ...
```

## 🔧 开发

```bash
# 编译
npm run compile

# 监听模式
npm run watch

# 打包
npm run package
```

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
### Changelog (节选)
0.0.3: 重构核心，修复损坏翻译文件；新增 `autoTranslate`、`translationRetryCount`、排序命令；增加翻译失败重试。
0.0.2: 修复重复保存导致出现多重嵌套 `t(t(t("key")))` 的问题；新增防抖 `processDebounceMs`；支持手动修改 t("key") 时自动补齐 zh/common.ts；跳过已是参数的字符串并折叠嵌套。