import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PathUtils, ChineseStringProcessor, I18nSyncer } from './i18nCore';

// 写入批处理：集中所有翻译文件写入，避免与用户未保存修改冲突
class WriteBatch {
  private tasks: Array<{file:string, transform:(oldContent:string)=>string|null}> = [];
  constructor(private log:(m:string)=>void){}
  queue(file:string, transform:(oldContent:string)=>string|null){
    this.tasks.push({file, transform});
  }
  async flush(){
    if(!this.tasks.length) return;
    // 合并针对同一文件的多个变换，按顺序执行
    const byFile = new Map<string, Array<(old:string)=>string|null>>();
    for(const t of this.tasks){
      if(!byFile.has(t.file)) byFile.set(t.file, []);
      byFile.get(t.file)!.push(t.transform);
    }
    this.tasks = [];
    const edit = new vscode.WorkspaceEdit();
    for(const [file, fns] of byFile.entries()){
      const uri = vscode.Uri.file(file);
      // 检查是否在编辑器中且 dirty，若 dirty 则跳过写入避免冲突
      const openDoc = vscode.workspace.textDocuments.find(d=> d.uri.fsPath === file);
      if(openDoc && openDoc.isDirty){
        this.log(`Skip write (dirty): ${PathUtils.getRelativeToWorkspace(file)}`);
        continue;
      }
      let oldContent='';
      try { oldContent = fs.existsSync(file) ? fs.readFileSync(file,'utf8') : ''; } catch { oldContent=''; }
      let current = oldContent;
      for(const fn of fns){
        const updated = fn(current);
        if(updated !== null && typeof updated === 'string') current = updated;
      }
      if(current === oldContent) continue; // 无变化
      // 若文件在工作区已打开则用编辑方式写入，否则直接写入磁盘后让 VS Code 发现变更
      if(openDoc){
        edit.replace(uri, new vscode.Range(0,0, openDoc.lineCount, 0), current);
      } else {
        // 直接写入磁盘（避免再触发保存冲突）。
        try { fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,current,'utf8'); this.log(`Wrote file: ${PathUtils.getRelativeToWorkspace(file)}`);} catch(err){ this.log('Write failed: '+String(err)); }
      }
    }
    if(edit.size){ await vscode.workspace.applyEdit(edit); }
  }
}

/**
 * i18n 自动同步扩展的主类
 */
class I18nAutoSyncExtension {
  private processor: ChineseStringProcessor;
  private syncer: I18nSyncer;
  private isEnabled: boolean = true; // 简化：默认开启
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private lastProcessTime: number = 0;

  constructor(context: vscode.ExtensionContext) {
    this.processor = new ChineseStringProcessor();
    
    const cfg = vscode.workspace.getConfiguration('i18n-auto-sync');
    this.syncer = new I18nSyncer(
      cfg.get('tencentSecretId',''),
      cfg.get('tencentSecretKey',''),
      'ap-beijing' // 固定使用默认区域
    );
    // 注入 writer (延迟生成实例在每次保存周期中临时使用)

    // 创建状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'i18n-auto-sync.toggleAutoSync';
    
    // 创建输出通道
    this.outputChannel = vscode.window.createOutputChannel('I18n Auto Sync');
    
    this.updateStatusBar();
    context.subscriptions.push(this.statusBarItem,this.outputChannel);
    
    // 监听配置变化
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e=>{
        if(e.affectsConfiguration('i18n-auto-sync')){
          this.updateTranslationCredentials();
          this.applyLangRootDir();
          this.ensureLangFiles();
          this.setupTriggerMode();
        }
      })
    );
  }

  private updateTranslationCredentials(){
    const cfg = vscode.workspace.getConfiguration('i18n-auto-sync');
    this.syncer.updateCredentials(
      cfg.get('tencentSecretId',''),
      cfg.get('tencentSecretKey',''),
      'ap-beijing' // 固定使用默认区域
    );
    this.log('Updated Tencent translation credentials');
  }

  /**
   * 初始化扩展
   */
  initialize() {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if(ws){ PathUtils.init(ws.uri.fsPath); this.log('I18n Auto Sync initialized'); }
    else this.log('No workspace folder');
    this.applyLangRootDir();
    this.ensureLangFiles();
    this.setupTriggerMode();
  }

  private applyLangRootDir(){
    const cfg = vscode.workspace.getConfiguration('i18n-auto-sync');
    const dir = cfg.get<string>('langRootDir','src/') || 'src/';
    try { PathUtils.updateLangRoot(dir); this.log(`Applied langRootDir: ${dir}`);} catch(err){ this.log('Failed to apply langRootDir: '+String(err)); }
  }

  private ensureLangFiles(){
    const p = PathUtils.paths;
    const ensure = (file:string)=>{ if(!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file),{recursive:true}); if(!fs.existsSync(file)) fs.writeFileSync(file,'export default {\n};\n','utf8'); };
    ensure(p.commonZhFile); 
    ensure(p.commonEnFile);
    
    // 确保 hooks 目录和文件存在
    const i18nDir = path.join(PathUtils.paths.langRoot, 'i18n');
    const hooksDir = path.join(i18nDir, 'hooks');
    
    // 创建 index.ts 主文件
    const indexFile = path.join(i18nDir, 'index.ts');
    if (!fs.existsSync(indexFile)) {
      const indexContent = `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCommon from './lang/zh/common';
import enCommon from './lang/en/common';

export type SupportedLanguage = 'zh' | 'en';

const resources = {
  zh: {
    common: zhCommon,
  },
  en: {
    common: enCommon,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
`;
      fs.mkdirSync(path.dirname(indexFile), {recursive: true});
      fs.writeFileSync(indexFile, indexContent, 'utf8');
      this.log(`Created i18n index file: ${PathUtils.getRelativeToWorkspace(indexFile)}`);
    }

    // 创建 utils.ts
    const utilsFile = path.join(i18nDir, 'utils.ts');
    if (!fs.existsSync(utilsFile)) {
      const utilsContent = `import { type SupportedLanguage } from './index';

const LANG_STORAGE_KEY = 'preferred-language';

export function getLang(): SupportedLanguage {
  if (typeof window === 'undefined') return 'zh';
  
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY) as SupportedLanguage;
    if (stored === 'zh' || stored === 'en') return stored;
    
    // 检测浏览器语言
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}

export function setLangStorage(lang: SupportedLanguage) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
}
`;
      fs.writeFileSync(utilsFile, utilsContent, 'utf8');
      this.log(`Created utils file: ${PathUtils.getRelativeToWorkspace(utilsFile)}`);
    }

    // 创建 hooks/useClientLanguageInit.ts
    const clientLangInitFile = path.join(hooksDir, 'useClientLanguageInit.ts');
    if (!fs.existsSync(clientLangInitFile)) {
      const clientLangInitContent = `import { useEffect, useState } from 'react';
import i18n from '../index';
import { getLang } from '../utils';

// 客户端语言初始化 hook
export function useClientLanguageInit() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 只在客户端执行语言检测和初始化
    const initializeLanguage = async () => {
      try {
        const detectedLang = getLang();
        
        // 设置语言但不等待资源加载，避免阻塞渲染
        if (detectedLang !== i18n.language) {
          await i18n.changeLanguage(detectedLang);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize language:', error);
        // 即使出错也标记为已初始化，使用默认语言
        setIsInitialized(true);
      }
    };

    initializeLanguage();
  }, []);

  return {
    isInitialized,
    currentLanguage: i18n.language,
  };
}
`;
      fs.mkdirSync(path.dirname(clientLangInitFile), {recursive: true});
      fs.writeFileSync(clientLangInitFile, clientLangInitContent, 'utf8');
      this.log(`Created useClientLanguageInit hook: ${PathUtils.getRelativeToWorkspace(clientLangInitFile)}`);
    }

    // 创建 hooks/useLanguageSwitch.ts
    const langSwitchFile = path.join(hooksDir, 'useLanguageSwitch.ts');
    if (!fs.existsSync(langSwitchFile)) {
      const langSwitchContent = `import { useCallback } from 'react';
import { setLangStorage } from '../utils';
import i18n, { type SupportedLanguage } from '../index';

// 语言切换 hook
export function useLanguageSwitch() {
  const switchLanguage = useCallback((lang: SupportedLanguage) => {
    // 设置存储和URL
    setLangStorage(lang);

    // 更新i18n实例
    i18n.changeLanguage(lang);
  }, []);

  return {
    switchLanguage,
  };
}
`;
      fs.mkdirSync(path.dirname(langSwitchFile), {recursive: true});
      fs.writeFileSync(langSwitchFile, langSwitchContent, 'utf8');
      this.log(`Created useLanguageSwitch hook: ${PathUtils.getRelativeToWorkspace(langSwitchFile)}`);
    }
  }
  private autoSaveDisposable: vscode.Disposable | null = null;
  private setupTriggerMode(){
    const cfg = vscode.workspace.getConfiguration('i18n-auto-sync');
    const mode = cfg.get<string>('triggerMode','manual');
    if(this.autoSaveDisposable){ this.autoSaveDisposable.dispose(); this.autoSaveDisposable=null; }
    if(mode === 'auto-save'){
      this.autoSaveDisposable = vscode.workspace.onDidSaveTextDocument(doc=> this.onDocumentSave(doc));
      this.log('TriggerMode: auto-save (registered onDidSaveTextDocument)');
    } else {
      this.log('TriggerMode: manual (use saveAndProcess command)');
    }
  }

  /** 重命名一个翻译 key (更新所有代码与 zh/en 文件) */
  async renameKey(){
    const editor = vscode.window.activeTextEditor;
    if(!editor){ vscode.window.showWarningMessage('No active editor'); return; }
    const doc = editor.document;
    const pos = editor.selection.active;
    const fullText = doc.getText();
    const cursorOffset = doc.offsetAt(pos);
    const windowStart = Math.max(0, cursorOffset - 2000);
    const windowEnd = Math.min(fullText.length, cursorOffset + 2000);
    const snippet = fullText.slice(windowStart, windowEnd);
    let foundKey: string | null = null;
    const tCallRe = /t\(\s*"([^"]+)"\s*\)/g;
    for(const m of snippet.matchAll(tCallRe)){
      const abs = windowStart + (m.index||0);
      if(abs <= cursorOffset && abs + m[0].length >= cursorOffset){ foundKey = m[1]; break; }
    }
    if(!foundKey){
      const objPairRe = /"([^"\\]+)"\s*:\s*"([^"\\]*)"/g;
      for(const m of snippet.matchAll(objPairRe)){
        const abs = windowStart + (m.index||0);
        if(abs <= cursorOffset && abs + m[0].length >= cursorOffset){ foundKey = m[1]; break; }
      }
    }
    if(!foundKey){ vscode.window.showWarningMessage('未定位到 t("key") 或翻译对象键'); return; }
    const newKey = await vscode.window.showInputBox({prompt:`重命名 key '${foundKey}' 为:`, value: foundKey, validateInput:(v)=> v.trim()? undefined : '新 key 不能为空'});
    if(!newKey || newKey === foundKey) return;
    const esc = (s:string)=> s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const tPattern = new RegExp(`t\\(\\s*"${esc(foundKey)}"\\s*\\)`, 'g');
    const kvPattern = new RegExp(`"${esc(foundKey)}"\s*:`, 'g');
    const edit = new vscode.WorkspaceEdit();
    const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}');
    for(const uri of files){
      let buf:Uint8Array; try{ buf = await vscode.workspace.fs.readFile(uri);}catch{ continue; }
      const code = buf.toString();
      let updated = code;
      let changed = false;
      // 替换 t("oldKey")
      updated = updated.replace(tPattern, m=> m.replace(foundKey!, newKey));
      if(updated !== code){ changed = true; }
      // 翻译文件里的 key 名
      if(/\/i18n\/lang\/(zh|en)\//.test(uri.fsPath)){
        const after = updated.replace(kvPattern, m=> m.replace(foundKey!, newKey));
        if(after !== updated){ updated = after; changed = true; }
      }
      if(changed){
        edit.replace(uri, new vscode.Range(new vscode.Position(0,0), new vscode.Position(code.split(/\r?\n/).length,0)), updated);
      }
    }
    if(edit.size === 0){ vscode.window.showInformationMessage('未发现需要更新的引用'); return; }
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage(`重命名完成: ${foundKey} -> ${newKey}`);
    this.log(`Renamed key ${foundKey} -> ${newKey}`);
  }

  /**
   * 处理文档保存事件
   */
  async onDocumentSave(document: vscode.TextDocument, opts: {force?:boolean} = {}){
  console.log('onDocumentSave called, force:', opts.force, 'file:', document.fileName);
  if(!this.isEnabled && !opts.force) {
    console.log('Extension disabled, skipping');
    return;
  }
  const cfg = vscode.workspace.getConfiguration('i18n-auto-sync');

    const filePath = document.fileName;
    console.log('Processing filePath:', filePath);
    console.log('PathUtils.paths:', PathUtils.paths);
    
    const translationFiles = [PathUtils.paths.commonZhFile, PathUtils.paths.commonEnFile];
    console.log('Translation files:', translationFiles);
    if(translationFiles.includes(filePath)){
      console.log('This is a translation file, handling separately');
      // 仅修复格式 & 同步，不做中文提取包装
      const batch = new WriteBatch(m=>this.log(m));
      this.syncer.setWriter(batch);
      this.syncer.fixCommas();
      await batch.flush();
      if(filePath === PathUtils.paths.commonZhFile){
        const autoTranslate = cfg.get('autoTranslate', true);
        await this.syncer.syncTranslationFiles(autoTranslate, m=>this.log(m));
        await batch.flush();
      }
      this.log('Handled translation file save (format+sync)');
      return;
    }
    
  // 检查文件类型
  const isSupported = PathUtils.isSupportedExtension(filePath);
  console.log('File extension supported:', isSupported);
  if(!isSupported) return;

    // 目录过滤：activeDirectories 语义
    //  - 'src'   => 只匹配工作区下 src 目录中的直接文件 (不含子目录)
    //  - 'src/*' => 匹配 src 下所有子文件(递归)
    //  - 为空数组 => 不限制
    const relPath = PathUtils.getRelativeToWorkspace(filePath).replace(/\\/g,'/');
    console.log('Relative path:', relPath);
    
    // 处理字符串格式的配置（逗号分隔）或数组格式（兼容旧版本）
    const activeDirsConfig = cfg.get('activeDirectories', 'src/*');
    let activeDirs: string[];
    if (Array.isArray(activeDirsConfig)) {
      // 如果是数组格式（旧版本兼容）
      activeDirs = activeDirsConfig.filter(Boolean);
    } else {
      // 如果是字符串格式（新格式）
      activeDirs = String(activeDirsConfig).split(',').map(s => s.trim()).filter(Boolean);
    }
    
    console.log('Active directories config:', activeDirs);
    if(activeDirs.length){
      const inAny = activeDirs.some(pattern=>{
        // 统一去掉首尾斜杠
        const p = pattern.replace(/^\/+/,'').replace(/\/+$/,'');
        if(!p) return true; // 空字符串视为全匹配
        const recursive = p.endsWith('/*');
        const base = recursive ? p.slice(0,-2) : p;
        console.log('Checking pattern:', pattern, 'base:', base, 'recursive:', recursive);
        if(recursive){
          const match = relPath === base || relPath.startsWith(base + '/');
          console.log('Recursive match result:', match);
          return match;
        } else {
          // 只允许直接在该目录下的文件（不包含子目录）
            if(!relPath.startsWith(base + '/')) return false;
            const remainder = relPath.slice(base.length+1); // 去掉 base + '/'
            const match = !remainder.includes('/');
            console.log('Non-recursive match result:', match);
            return match;
        }
      });
      console.log('Directory filter result - inAny:', inAny);
      if(!inAny) {
        console.log('File not in active directories, skipping');
        return; // 不在允许目录内
      }
    }
    // 不再强制 isInSrc 限制，交由 activeDirectories 配置控制
    if(PathUtils.isEnLangFile(filePath)) return; // skip en lang file itself

    // user exclude patterns (支持数组或字符串格式)
    const excludeConfig = cfg.get('excludePatterns', 'node_modules,.next,dist,build');
    let exclude: string[];
    if (Array.isArray(excludeConfig)) {
      // 如果是数组格式（旧版本兼容）
      exclude = excludeConfig.filter(Boolean);
    } else {
      // 如果是字符串格式（新格式，逗号分隔）
      exclude = String(excludeConfig).split(',').map(s => s.trim()).filter(Boolean);
    }
    if(exclude.some(p=>filePath.includes(p))) return;

    try {
      this.log(`Processing file: ${PathUtils.getRelativeToWorkspace(filePath)}`);
      await vscode.window.withProgress({location:vscode.ProgressLocation.Window,title:'Processing i18n...',cancellable:false}, async progress=>{
        // debounce
        if(!opts.force){
          const debounceMs = cfg.get('processDebounceMs',400);
            const now = Date.now();
            if(now - this.lastProcessTime < debounceMs){
              this.log(`Skip (debounced ${now - this.lastProcessTime}ms < ${debounceMs}ms)`);
              return;
            }
            this.lastProcessTime = now;
        }
        // optional cleanup
        // 初始化本轮写入批
        const batch = new WriteBatch(m=>this.log(m));
        this.syncer.setWriter(batch);
        const translationEditorFocused = vscode.window.activeTextEditor && [PathUtils.paths.commonZhFile, PathUtils.paths.commonEnFile].includes(vscode.window.activeTextEditor.document.fileName);
        if(cfg.get('cleanUnusedKeys',true) && !translationEditorFocused){
          progress.report({message:'Cleaning unused keys...'});
          await this.syncer.cleanUnusedKeys();
        } else if(translationEditorFocused){
          this.log('Skip cleanup (translation file focused)');
        }
        progress.report({message:'Transforming file...'});
        const content = document.getText();
        console.log('File content length:', content.length);
        console.log('File content preview:', content.substring(0, 200));
  const processExternal = cfg.get('processExternalConstants', false);
  const result = this.processor.processFileContent(content, { processExternalConstants: !!processExternal });
        console.log('Processing result:', {
          hasChanges: result.hasChanges,
          newTranslationsCount: Object.keys(result.newTranslations).length,
          newTranslations: result.newTranslations
        });
        if(result.hasChanges){
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri,new vscode.Range(document.positionAt(0),document.positionAt(content.length)), result.content);
          await vscode.workspace.applyEdit(edit);
          this.log('File updated with i18n wrappers');
          console.log('File updated successfully');
        } else {
          console.log('No changes needed');
        }
        // 先修复手动编辑造成的逗号缺失 (加入批处理)
        console.log('Fixing commas...');
        this.syncer.fixCommas();
        if(Object.keys(result.newTranslations).length){
          progress.report({message:'Appending zh keys...'});
          console.log('Adding zh keys:', result.newTranslations);
          this.syncer.ensureZhKeys(result.newTranslations);
        } else {
          console.log('No new translations to add');
        }
        // ensure existing t("...") keys
        progress.report({message:'Scanning t() keys...'});
        const allKeys = this.collectAllTKeys(result.content);
        console.log('Found t() keys:', Array.from(allKeys));
        if(allKeys.size) {
          console.log('Ensuring zh keys for existing t() calls');
          this.syncer.ensureZhKeysByKeySet(allKeys);
        }

        const autoTranslate = cfg.get('autoTranslate', true);
        // 先 flush 基础 zh 写入，确保翻译时读取到最新内容
        await batch.flush();
        if(autoTranslate){
          progress.report({message:'Translating new keys...'});
          await this.syncer.syncTranslationFiles(true, m=>this.log(m));
        } else {
          this.log('Auto translation disabled');
        }
        // flush 翻译阶段可能追加的写入
        await batch.flush();

        this.log('i18n processing done');
      });
    } catch(err){
      const msg = err instanceof Error? err.message : String(err);
      this.log(`Error: ${msg}`);
      vscode.window.showErrorMessage(`I18n processing failed: ${msg}`);
    }
  }

  /**
   * 处理当前文件
   */
  async processCurrentFile(){
    const ed = vscode.window.activeTextEditor; if(!ed){ vscode.window.showWarningMessage('No active editor'); return; }
    await this.onDocumentSave(ed.document,{force:true});
  }

  /**
   * 同步翻译文件
   */
  async syncTranslations(){
    const cfg = vscode.workspace.getConfiguration('i18n-auto-sync');
    const autoTranslate = cfg.get('autoTranslate', true);
    await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Syncing translations...'}, async()=>{
      await this.syncer.syncTranslationFiles(autoTranslate, m=>this.log(m));
    });
    vscode.window.showInformationMessage('Translation sync complete');
  }

  /**
   * 排序 zh/en 翻译文件中的键
   */
  async sortTranslationFiles(){
    try{
      const batch = new WriteBatch(m=>this.log(m));
      this.syncer.setWriter(batch);
      const files = [PathUtils.paths.commonZhFile, PathUtils.paths.commonEnFile];
      for(const file of files){
        batch.queue(file, old=>{
          if(!old || !/export\s+default\s+{/.test(old)) return null;
          const entries: Array<[string,string]> = [];
          const re = /"([^"\\]+)"\s*:\s*"([^"\\]*)"/g;
          let m:RegExpExecArray|null; while((m=re.exec(old))!==null){ entries.push([m[1],m[2]]); }
          if(!entries.length) return null;
          entries.sort((a,b)=> a[0].localeCompare(b[0],'zh-Hans-CN'));
          const lines = entries.map(([k,v])=>`  "${k}": "${v}",`);
          const result = `// sorted automatically\nexport default {\n${lines.join('\n')}\n};\n`;
          return result === old ? null : result;
        });
      }
      await batch.flush();
      vscode.window.showInformationMessage('Translation files sorted (batched)');
      this.log('Sorted translation files (batched)');
    }catch(err){
      const msg = err instanceof Error? err.message: String(err);
      this.log('Sort failed: '+msg);
      vscode.window.showErrorMessage('Sort translation files failed: '+msg);
    }
  }

  /**
   * 切换自动同步功能
   */
  toggleAutoSync(){ this.isEnabled=!this.isEnabled; this.updateStatusBar(); vscode.window.showInformationMessage(`I18n auto sync ${this.isEnabled? 'enabled':'disabled'}`); }
  private updateStatusBar(){ this.statusBarItem.text = `${this.isEnabled? '$(sync) I18n:ON':'$(sync-ignored) I18n:OFF'}`; this.statusBarItem.show(); }
  private log(msg:string){ const ts=new Date().toLocaleTimeString(); this.outputChannel.appendLine(`[${ts}] ${msg}`); }
  private collectAllTKeys(content:string){ const set=new Set<string>(); const r=/\b(?:t|i18n\.t)\(\s*['"]([^'"(){}<>]+)['"]\s*\)/g; let m:RegExpExecArray|null; while((m=r.exec(content))!==null){ set.add(m[1]); } return set; }
  dispose(){ this.statusBarItem.dispose(); this.outputChannel.dispose(); }
}

let extension: I18nAutoSyncExtension|undefined;

/**
 * 扩展激活函数
 */
export function activate(context: vscode.ExtensionContext) {
  // 创建扩展实例
  extension = new I18nAutoSyncExtension(context);
  extension.initialize();

  // 注册命令
  const commands = [
    vscode.commands.registerCommand('i18n-auto-sync.processCurrentFile', () => {
      extension?.processCurrentFile();
    }),
    vscode.commands.registerCommand('i18n-auto-sync.sortTranslationFiles', () => {
      extension?.sortTranslationFiles();
    }),
    vscode.commands.registerCommand('i18n-auto-sync.syncTranslations', () => {
      extension?.syncTranslations();
    }),
    vscode.commands.registerCommand('i18n-auto-sync.toggleAutoSync', () => {
      extension?.toggleAutoSync();
    }),
    vscode.commands.registerCommand('i18n-auto-sync.renameKey', () => {
      extension?.renameKey();
    }),
    vscode.commands.registerCommand('i18n-auto-sync.saveAndProcess', async ()=>{
      const ed = vscode.window.activeTextEditor;
      if(!ed){ vscode.window.showWarningMessage('No active editor'); return; }
      // 先保存，再处理（force=true 跳过防抖）
      await ed.document.save();
      await extension?.onDocumentSave(ed.document,{force:true});
    }),
    vscode.commands.registerCommand('i18n-auto-sync.pureSave', async ()=>{
      const ed = vscode.window.activeTextEditor; if(!ed) return; await ed.document.save(); vscode.window.setStatusBarMessage('已纯保存(未执行 i18n)',2000);
    })
  ];

  // 添加到订阅列表
  context.subscriptions.push(...commands);

  console.log('I18n Auto Sync extension activated successfully');
}

/**
 * 扩展停用函数
 */
export function deactivate() {
  extension?.dispose();
  extension = undefined;
  console.log('I18n Auto Sync extension deactivated');
}