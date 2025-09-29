# 插件安装/卸载脚本使用说明

## 📋 可用脚本

### PowerShell 脚本 (推荐)
- `install.ps1` - 安装插件
- `uninstall.ps1` - 卸载插件

### 批处理脚本
- `install.bat` - 安装插件  
- `uninstall.bat` - 卸载插件

### NPM 脚本
- `npm run install` - 通过 npm 安装插件
- `npm run uninstall` - 通过 npm 卸载插件

## 🚀 使用方法

### 方法一：直接运行脚本文件
```bash
# 在插件目录下双击运行，或在终端中执行：
.\install.ps1     # 安装插件
.\uninstall.ps1   # 卸载插件

# 或者运行批处理文件：
install.bat       # 安装插件
uninstall.bat     # 卸载插件
```

### 方法二：使用 npm 命令
```bash
npm run install    # 安装插件
npm run uninstall  # 卸载插件
```

## ⚙️ 安装流程

1. **编译插件**
   ```bash
   npm run compile
   ```

2. **打包插件**
   ```bash
   npm run package
   ```

3. **安装插件**
   ```bash
   npm run install
   # 或直接运行: .\install.ps1
   ```

## 📝 注意事项

- 安装脚本会自动查找目录中最新的 `.vsix` 文件
- 安装前会先卸载旧版本避免冲突
- 安装完成后可能需要重启 VS Code
- 如果 PowerShell 执行策略限制，可以使用批处理文件

## 🔧 开发流程

```bash
# 1. 修改代码后重新编译
npm run compile

# 2. 打包新版本
npm run package

# 3. 安装到 VS Code
npm run install
```