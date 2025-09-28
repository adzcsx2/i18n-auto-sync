# I18n Auto Sync - VS Code Extension

[🇨🇳 中文](README.md) | [🇺🇸 English](README-en.md)

Automatically convert Chinese strings to `t("key")` format and maintain translation files with one click.

## ✨ Core Features

- 🚀 **Auto Convert**: Transform `"Hello World"` into `{t("Hello World")}`
- 📝 **Auto Import**: Automatically add `import { useTranslation } from "@/i18n/hooks"`
- 🎯 **Auto Hook**: Automatically add `const { t } = useTranslation()`
- 📁 **File Sync**: Auto update `zh/common.ts` and `en/common.ts` translation files
- 🌍 **Auto Translate**: Optional Tencent Cloud automatic English translation

> ⚠️ **Important Notice**: Currently, the extension only processes strings containing Chinese characters. Pure English or other language strings will not be converted.

## 👤 User Guide

If you just want to use this extension, follow these steps:

### 1️⃣ Install Extension
1. Download `i18n-auto-sync-0.1.0.vsix` file
2. In VS Code, press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
3. Type `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file

### 2️⃣ Project Setup
Ensure your project has the following structure:
```
src/
  i18n/
    lang/
      zh/
        common.ts
      en/
        common.ts
```

### 3️⃣ Usage
- **Auto Mode**: Automatically convert on file save (default)
- **Manual Mode**: 
  - `Ctrl+Shift+I`: Process current file
  - `Ctrl+Shift+R`: Rename translation key
  - `Ctrl+Alt+S`: Save and process

### 4️⃣ Extension Settings
Search `i18n-auto-sync` in VS Code settings to configure:
- Trigger mode (auto/manual)
- Translation file path
- Target directory filtering
- Tencent Cloud translation (optional)

## 🛠️ Developer Guide

If you're a developer who needs to modify or test the extension:

### 1️⃣ Clone Project

```bash
git clone <repository-url>
cd i18n-auto-sync
npm install
```

### 2️⃣ Development Environment

```bash
# Compile TypeScript
npm run compile

# Watch file changes (recommended for development)
npm run watch
```

### 3️⃣ Debug Mode

1. Open the extension project in VS Code
2. Press `F5` to start the Extension Development Host
3. Test extension functionality in the new VS Code window

### 4️⃣ Package & Release

```bash
# Package as VSIX file
npm run package

# Install to VS Code
code --install-extension i18n-auto-sync-0.1.0.vsix
```

## ⚙️ Configuration Options

Search `i18n-auto-sync` in VS Code settings to configure:

### Basic Configuration
- `triggerMode`: Trigger mode (`auto-save` | `manual`)
- `langRootDir`: Language file root directory (default: `src/`)
- `activeDirectories`: Active directory filter (default: `src/*`)
- `cleanUnusedKeys`: Clean unused translation keys

### Advanced Configuration  
- `autoTranslate`: Enable automatic translation
- `tencentSecretId`: Tencent Cloud Translation API ID
- `tencentSecretKey`: Tencent Cloud Translation API Key
- `excludePatterns`: File patterns to exclude

Example configuration:
```json
{
  "i18n-auto-sync.triggerMode": "manual",
  "i18n-auto-sync.langRootDir": "src/",
  "i18n-auto-sync.activeDirectories": "src/app/*,src/components/*",
  "i18n-auto-sync.autoTranslate": true
}
```

## 📖 Usage Examples

### Before Processing
```tsx
export default function LoginPage() {
  return (
    <Form.Item
      label="Username"
      name="username"
      rules={[{ required: true, message: "Please enter username" }]}
    >
      <Input placeholder="Please enter username" />
    </Form.Item>
  );
}
```

### After Processing
```tsx
import { useTranslation } from "@/i18n/hooks";

export default function LoginPage() {
  const { t } = useTranslation("common");
  return (
    <Form.Item
      label={t("Username")}
      name="username"
      rules={[{ required: true, message: t("Please enter username") }]}
    >
      <Input placeholder={t("Please enter username")} />
    </Form.Item>
  );
}
```

### Auto-generated Translation Files

The extension automatically generates and updates translation files:

```typescript
// src/i18n/lang/zh/common.ts
export default {
  "Username": "用户名",
  "Please enter username": "请输入用户名",
};

// src/i18n/lang/en/common.ts  
export default {
  "Username": "Username",
  "Please enter username": "Please enter username",
};
```

## 🎯 Keyboard Shortcuts

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Ctrl+Alt+S` | Save and Process | Save file and process Chinese strings |
| `Ctrl+Shift+I` | Process Current File | Process Chinese strings in current file only |
| `Ctrl+Shift+R` | Rename Key | Rename translation key |

## 📁 Required Project Structure

The extension requires the following basic project structure:

```
your-project/
├── src/
│   ├── i18n/
│   │   ├── hooks.ts          # useTranslation hook
│   │   └── lang/
│   │       ├── zh/
│   │       │   └── common.ts # Chinese translation file
│   │       └── en/
│   │           └── common.ts # English translation file
│   ├── components/           # Your components
│   └── ...
└── ...
```

## 🔧 Troubleshooting

### Q: Extension doesn't automatically process Chinese strings?
A: Check the following settings:
1. Ensure `triggerMode` is set correctly
2. Check if `activeDirectories` includes current file directory  
3. Make sure to save the file before manually triggering
4. **Note**: Only strings containing Chinese characters will be processed

### Q: English strings are not being converted?
A: This is by design. The extension currently only processes strings that contain Chinese characters (汉字). Pure English strings will be ignored to avoid unnecessary conversions.

### Q: Translation files not generated?
A: Ensure:
1. `langRootDir` path is set correctly
2. Project root has `src/i18n/lang/` directory structure
3. VS Code has write permissions

### Q: Auto translation not working?
A: Check Tencent Cloud configuration:
1. `tencentSecretId` and `tencentSecretKey` are set correctly
2. Tencent Cloud account has translation API permissions
3. Network connection is normal

## 📄 License

MIT License

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📝 Version History

- **v0.1.0**: Code refactoring, improved user experience, comprehensive documentation
- **v0.0.3**: Core refactoring, fixed broken translation files; added auto-translate, sort commands; added translation retry mechanism  
- **v0.0.2**: Fixed nested issues from repeated saves; added debounce mechanism; support auto-completion when manually modifying translation files