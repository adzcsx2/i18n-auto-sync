# I18n Auto Sync - VS Code Extension

[🇨🇳 中文](README.md) | [🇺🇸 English](README-en.md)

一键将中文字符串自动转换为 `t("key")` 形式，并同步维护翻译文件的 VS Code 扩展。

## ✨ 核心功能

- 🚀 **自动转换**: 将 `"你好世界"` 转换为 `{t("你好世界")}`
- 📝 **自动导入**: 自动添加 `import { useTranslation } from "@/i18n/hooks"`
- 🎯 **自动调用**: 自动添加 `const { t } = useTranslation()`
- 📁 **文件同步**: 自动更新 `zh/common.ts` 和 `en/common.ts` 翻译文件
- 🌍 **自动翻译**: 可选的腾讯云自动英文翻译(每个月500w免费,相比百度只有5w这个好用)

> ⚠️ **重要提示**: 目前插件只会处理包含中文字符的字符串。纯英文或其他语言的字符串不会被转换。

## � 使用者指南

如果您只是想使用这个插件，按以下步骤操作：

### 1️⃣ 安装插件
1. 下载 `i18n-auto-sync-0.1.0.vsix` 文件
2. 在 VS Code 中按 `Ctrl+Shift+P`（Windows）或 `Cmd+Shift+P`（Mac）
3. 输入 `Extensions: Install from VSIX...`
4. 选择下载的 `.vsix` 文件

### 2️⃣ 配置项目
确保你的项目有以下结构：
```
src/
  i18n/
    lang/
      zh/
        common.ts
      en/
        common.ts
```

### 3️⃣ 使用方法
- **自动模式**: 保存文件时自动转换（默认开启）
- **手动模式**: 
  - `Ctrl+Shift+I`: 处理当前文件
  - `Ctrl+Shift+R`: 重命名翻译键
  - `Ctrl+Alt+S`: 保存并处理

### 4️⃣ 插件设置
在 VS Code 设置中搜索 `i18n-auto-sync`，可配置：
- 触发模式（自动/手动）
- 翻译文件路径
- 目标目录过滤
- 腾讯云翻译（可选）

## 🛠️ 开发者指南

```bash
git clone <repository-url>
cd i18n-auto-sync
npm install
```

### 2️⃣ 开发环境设置

```bash
# 编译 TypeScript
npm run compile

# 监听文件变化（推荐开发时使用）
npm run watch
```

### 3️⃣ 调试模式

1. 在 VS Code 中打开插件项目
2. 按 `F5` 启动扩展开发主机
3. 在新打开的 VS Code 窗口中测试插件功能

### 4️⃣ 打包发布

```bash
# 打包为 VSIX 文件
npm run package

# 安装到 VS Code（旧方法）
code --install-extension i18n-auto-sync-0.1.0.vsix
```

### 5️⃣ 快速安装/卸载命令

#### 使用 npm 脚本（推荐）
```bash
# 安装插件
npm run install

# 卸载插件
npm run uninstall
```

#### 使用 PowerShell 脚本
```bash
# 安装插件
.\install.ps1

# 卸载插件
.\uninstall.ps1
```

#### 使用批处理文件
```bash
# 安装插件
install.bat

# 卸载插件
uninstall.bat
```

#### 一键开发流程
```bash
# 编译 + 打包 + 安装 一条命令完成
npm run install
```

> 💡 **提示**: 
> - 安装脚本会自动查找最新的 `.vsix` 文件
> - 安装前会自动卸载旧版本避免冲突
> - 安装后可能需要重启 VS Code

## ⚙️ 配置选项

在 VS Code 设置中搜索 `i18n-auto-sync`，可配置以下选项：

### 基础配置
- `triggerMode`: 触发模式（`auto-save` | `manual`）
- `langRootDir`: 语言文件根目录（默认: `src/`）
- `activeDirectories`: 活动目录过滤（默认: `src/*`）
- `cleanUnusedKeys`: 清理未使用的翻译键

### 高级配置  
- `autoTranslate`: 启用自动翻译
- `tencentSecretId`: 腾讯云翻译 API ID
- `tencentSecretKey`: 腾讯云翻译 API 密钥
- `excludePatterns`: 排除的文件模式

示例配置：
```json
{
  "i18n-auto-sync.triggerMode": "manual",
  "i18n-auto-sync.langRootDir": "src/",
  "i18n-auto-sync.activeDirectories": "src/app/*,src/components/*",
  "i18n-auto-sync.autoTranslate": true
}
```

## 📖 使用示例

### 处理前
```tsx
export default function LoginPage() {
  return (
    <Form.Item
      label="用户名"
      name="username"
      rules={[{ required: true, message: "请输入用户名" }]}
    >
      <Input placeholder="请输入用户名" />
    </Form.Item>
  );
}
```

### 处理后
```tsx
import { useTranslation } from "@/i18n/hooks";

export default function LoginPage() {
  const { t } = useTranslation("common");
  return (
    <Form.Item
      label={t("用户名")}
      name="username"
      rules={[{ required: true, message: t("请输入用户名") }]}
    >
      <Input placeholder={t("请输入用户名")} />
    </Form.Item>
  );
}
```

### 翻译文件自动生成

扩展会自动生成和更新翻译文件：

```typescript
// src/i18n/lang/zh/common.ts
export default {
  "用户名": "用户名",
  "请输入用户名": "请输入用户名",
};

// src/i18n/lang/en/common.ts  
export default {
  "用户名": "Username",
  "请输入用户名": "Please enter username",
};
```

## 🎯 快捷键

| 快捷键 | 命令 | 说明 |
|--------|------|------|
| `Ctrl+Alt+S` | 保存并处理 | 保存文件并处理中文字符串 |
| `Ctrl+Shift+I` | 处理当前文件 | 仅处理当前文件的中文字符串 |
| `Ctrl+Shift+R` | 重命名键值 | 重命名翻译键 |

## 📁 项目结构要求

插件要求项目具备以下基本结构：

```
your-project/
├── src/
│   ├── i18n/
│   │   ├── hooks.ts          # useTranslation hook
│   │   └── lang/
│   │       ├── zh/
│   │       │   └── common.ts # 中文翻译文件
│   │       └── en/
│   │           └── common.ts # 英文翻译文件
│   ├── components/           # 你的组件
│   └── ...
└── ...
```

## 🔧 常见问题

### Q: 插件没有自动处理中文字符串？
A: 检查以下设置：
1. 确保 `triggerMode` 设置正确
2. 检查 `activeDirectories` 是否包含当前文件目录  
3. 确保文件保存后再手动触发
4. **注意**: 只有包含中文字符的字符串才会被处理

### Q: 英文字符串没有被转换？
A: 这是设计如此。插件目前只处理包含中文字符（汉字）的字符串。纯英文字符串会被忽略，以避免不必要的转换。

### Q: 翻译文件没有生成？
A: 确保：
1. `langRootDir` 路径设置正确
2. 项目根目录有 `src/i18n/lang/` 目录结构
3. VS Code 有写入权限

### Q: 自动翻译不工作？
A: 检查腾讯云配置：
1. `tencentSecretId` 和 `tencentSecretKey` 设置正确
2. 腾讯云账户有翻译 API 权限
3. 网络连接正常

## 📄 许可证
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

## 📝 版本历史

- **v0.1.0**: 代码重构，优化用户体验，完善文档
- **v0.0.3**: 重构核心，修复损坏翻译文件；新增自动翻译、排序命令；增加翻译失败重试  
- **v0.0.2**: 修复重复保存导致的嵌套问题；新增防抖机制；支持手动修改时自动补齐翻译文件