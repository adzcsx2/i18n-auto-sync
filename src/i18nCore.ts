// Single clean implementation for i18n core (previous duplicates removed)
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as crypto from 'crypto';

export class PathUtils {
  private static root = '';
  private static src = '';
  private static zhDir = '';
  private static enDir = '';
  private static langRoot = '';
  static init(workspaceRoot: string, langRootDir?: string) {
    this.root = workspaceRoot;
    this.src = path.join(workspaceRoot, 'src');
    this.updateLangRoot(langRootDir || 'src/');
  }
  static updateLangRoot(langRootDir: string){
    // langRootDir 相对工作区根；规范化去掉前后斜杠
    const clean = langRootDir.replace(/^\\+|^\/+/,'').replace(/\\+$|\/+$/,'');
    this.langRoot = path.join(this.root, clean);
    const lang = path.join(this.langRoot, 'i18n', 'lang');
    this.zhDir = path.join(lang, 'zh');
    this.enDir = path.join(lang, 'en');
  }
  static get paths() {
    return {
      projectRoot: this.root,
      srcDir: this.src,
      langRoot: this.langRoot,
      zhDir: this.zhDir,
      enDir: this.enDir,
      commonZhFile: path.join(this.zhDir, 'common.ts'),
      commonEnFile: path.join(this.enDir, 'common.ts'),
    };
  }
  static isSupportedExtension(f: string) { return ['.tsx','.ts','.jsx','.js'].includes(path.extname(f)); }
  static shouldExcludeDir(dir: string) { return ['node_modules','.next','dist','scripts','.git','build'].includes(dir); }
  static isInSrc(f: string) { return f.startsWith(this.src + path.sep); }
  static isEnLangFile(f: string) { return f.startsWith(this.enDir + path.sep); }
  static getRelativeToWorkspace(f: string) { return path.relative(this.root, f); }
}

export class ChineseStringProcessor {
  private zhRe = /[\u4e00-\u9fa5]+/g;
  private newTranslations: Record<string,string> = {};
  
  // 检测是否在组件外部使用了t函数
  private detectOutsideComponentTUsage(code: string): boolean {
    const lines = code.split('\n');
    let inComponent = false;
    let braceDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 检测组件函数开始
      if (line.match(/^(export\s+default\s+)?function\s+\w+/i) ||
          line.match(/^const\s+\w+[:\s]*=.*=>/i)) {
        inComponent = true;
        braceDepth = 0;
      }
      
      // 计算大括号深度来判断是否还在组件内
      if (inComponent) {
        for (const char of line) {
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
        }
        
        // 如果回到顶层，说明组件结束
        if (braceDepth === 0 && line.includes('}')) {
          inComponent = false;
        }
      }
      
      // 如果不在组件内，检查是否有t函数调用
      if (!inComponent && line.includes('t(')) {
        return true;
      }
    }
    
    return false;
  }
  
  // 检测是否需要进行组件作用域处理
  private needsComponentScopeHandling(code: string): boolean {
    // 检查是否有组件外部的常量定义（如 const ITEM = [...] 这样的模式）
    const constantPatterns = [
      /^const\s+[A-Z_][A-Z0-9_]*\s*=\s*\[/m,  // const ITEM = [
      /^const\s+[a-z][a-zA-Z0-9]*Items?\s*=/m, // const menuItems =
      /^const\s+[a-z][a-zA-Z0-9]*Config\s*=/m  // const appConfig =
    ];
    
    return constantPatterns.some(pattern => pattern.test(code));
  }
  
  // 检测指定位置是否在组件作用域内
  private isInComponentScope(fullText: string, offset: number): boolean {
    // 从当前位置向前查找，确定是否在组件函数内部
    const beforeText = fullText.slice(0, offset);
    const lines = beforeText.split('\n');
    
    let inComponent = false;
    let braceDepth = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 检测组件函数开始
      if (trimmedLine.match(/^(export\s+default\s+)?function\s+\w+/i) ||
          trimmedLine.match(/^const\s+\w+[:\s]*=.*=>/i)) {
        inComponent = true;
        braceDepth = 0;
      }
      
      // 计算大括号深度
      if (inComponent) {
        for (const char of line) {
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
        }
        
        // 如果回到顶层，组件结束
        if (braceDepth === 0 && line.includes('}')) {
          inComponent = false;
        }
      }
    }
    
    return inComponent && braceDepth > 0;
  }
  processFileContent(content: string, opts?: {processExternalConstants?: boolean}): { content: string; hasChanges: boolean; newTranslations: Record<string,string> } {
    let changed = false;
    let code = this.ensureImport(content);
    if (code !== content) changed = true;
    this.newTranslations = {};
    
    // 首先检测是否在组件外部有常量定义需要处理
    const needsComponentScopeDetection = this.needsComponentScopeHandling(code);
    
  const strRe = /(["'`])((?:(?!\1)[^\\]|\\.)*)(\1)/g;
    code = code.replace(strRe,(m,q,inner,_q2,offset,full)=>{
      const before = full.slice(Math.max(0, offset-8), offset);
      if (/t\(\s*$/.test(before)) return m; // already t("...") param
      if(!this.shouldProcess(inner)) return m;
      
      // 如果需要检测作用域，检查是否在组件内部
      if (needsComponentScopeDetection && !this.isInComponentScope(full, offset)) {
        // 若启用了 processExternalConstants，则使用 i18n.t(...) 替换（安全，不依赖 hook）
        if (opts && opts.processExternalConstants) {
          const key = this.genKey(inner);
          this.newTranslations[key] ||= inner;
          changed = true;
          // 返回 i18n.t("key")，import 插入将会在后续步骤统一处理
          return `i18n.t("${key}")`;
        }
        return m; // 不处理组件外部的字符串
      }
      
      const key = this.genKey(inner);
      this.newTranslations[key] ||= inner;
      changed = true;
      
      // 检查是否是JSX属性值，如果是则需要添加花括号
      const beforeContext = full.slice(Math.max(0, offset-30), offset);
      
      // 检查是否是JSX属性赋值模式：属性名=
      if (/\w+\s*=\s*$/.test(beforeContext)) {
        return `{t("${key}")}`;
      }
      
      return `t("${key}")`;
    });
    const jsxText = />([^<{]*[\u4e00-\u9fa5][^<{]*)</g;
    code = code.replace(jsxText,(m,txt)=>{
      const raw = txt.trim();
      if(!this.shouldProcess(raw)) return m;
      const key = this.genKey(raw); this.newTranslations[key] ||= raw; changed = true;
      return `>{t("${key}")}<`;
    });
    // collapse nested forms
    const collapse = [/t\(\s*t\("([^"\\]+)"\)\s*\)/g,/{\s*t\(\s*t\("([^"\\]+)"\)\s*\)\s*}/g];
    let prev; do { prev = code; collapse.forEach(r=> code = code.replace(r,(_m,k)=>`t("${k}")`)); } while(prev!==code);
    
    // 修复JSX属性中缺少花括号的 t() 调用 - 这个步骤独立运行，不受shouldProcess限制
    // 匹配模式：属性名= t("key") 转换为 属性名={t("key")}
    const beforeFixBraces = code;
    // 更宽松的匹配，处理有空格的情况
    code = code.replace(/(\w+\s*=\s*)t\s*\(\s*"([^"\\]+)"\s*\)/g, '$1{t("$2")}');
    // 也处理没有空格的情况  
    code = code.replace(/(\w+\s*=)t\("([^"\\]+)"\)/g, '$1{t("$2")}');
    if (code !== beforeFixBraces) changed = true;
    
    code = code.replace(/>(\s*)t\("([^"\\]+)"\)(\s*)</g,(_m,p1,k,p3)=>`>${p1}{t("${k}")}${p3}<`);

    // 如果在处理外部常量时产生了 i18n.t(...) 的使用，确保在文件顶部插入 import i18n
    if (opts && opts.processExternalConstants && /\bi18n\.t\(/.test(code)) {
      if (!/import\s+i18n\s+from\s+['"]@\/i18n['"]/.test(code)) {
        code = this.ensureI18nImport(code);
        changed = true;
      }
    }

    return { content: code, hasChanges: changed, newTranslations: { ...this.newTranslations } };
  }
  private shouldProcess(str: string){ return !!str && str.length>1 && this.zhRe.test(str) && !str.includes('t('); }
  private genKey(text: string){ return text.trim().replace(/\s+/g,'_').replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g,'').slice(0,60); }
  private ensureImport(code: string){
    // 始终使用 @/i18n/hooks 路径，这是项目的标准结构
    const correctImportPath = '@/i18n/hooks';
    
    // 清理所有现有的 useTranslation 导入
    let lines = code.split('\n');
    const filteredLines = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // 移除所有包含 useTranslation 的 import 行，但排除注释行
      if (trimmedLine.startsWith('import') && trimmedLine.includes('useTranslation') && !trimmedLine.includes('//')) {
        // 跳过这行，不添加到 filteredLines
        continue;
      }
      filteredLines.push(line);
    }
    
    lines = filteredLines;
    
    // 检查是否已经有正确的导入
    const correctImportExists = lines.some(line => 
      line.includes(`import { useTranslation } from "${correctImportPath}"`)
    );
    
    if (!correctImportExists) {
      // 找到最后一个 import 语句的位置
      let lastImportIndex = -1;
      lines.forEach((line, index) => {
        if (line.trim().startsWith('import ') && !line.includes('//')) {
          lastImportIndex = index;
        }
      });
      
      // 在最后一个 import 后插入正确的导入
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, `import { useTranslation } from "${correctImportPath}";`);
      } else {
        // 如果没有其他 import，在"use client"或文件开头后插入
        let insertIndex = 0;
        if (lines[0] && lines[0].includes('"use client"')) {
          insertIndex = 1;
        }
        lines.splice(insertIndex, 0, `import { useTranslation } from "${correctImportPath}";`);
      }
    }
    
    // 确保组件中有 useTranslation hook 调用
    const codeText = lines.join('\n');
    const updatedCode = this.ensureUseTranslationHook(codeText);
    
    return updatedCode;
  }
  
  // 确保文件导入 i18n 实例（用于在组件外调用 i18n.t()）
  private ensureI18nImport(code: string) {
    const lines = code.split('\n');
    // 如果已经存在则直接返回
    if (lines.some(l=> /import\s+i18n\s+from\s+['"]@\/i18n['"]/.test(l))) return code;
    // 找到最后一个 import 插入
    let lastImportIndex = -1;
    lines.forEach((line, idx)=>{ if (line.trim().startsWith('import ') && !line.includes('//')) lastImportIndex = idx; });
    const insertAt = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
    lines.splice(insertAt, 0, `import i18n from "@/i18n";`);
    return lines.join('\n');
  }
  
  private ensureUseTranslationHook(code: string): string {
    // 检查是否已经有 useTranslation hook 调用
    if (code.includes('const { t }') || code.includes('const {t}')) {
      return code;
    }
    
    // 查找组件函数的开始位置（函数组件或箭头函数）
    const lines = code.split('\n');
    let hookInsertIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 匹配函数组件模式：function ComponentName 或 const ComponentName = 或 export default function
      if (trimmedLine.match(/^(export\s+default\s+)?function\s+\w+/i) ||
          trimmedLine.match(/^const\s+\w+[:\s]*=.*=>/i) ||
          trimmedLine.match(/^export\s+default\s+function/i)) {
        
        // 查找真正的函数体开始位置 - 需要找到完整的函数签名结束后的第一个 {
        let j = i;
        let braceCount = 0;
        let inFunctionSignature = true;
        
        while (j < lines.length) {
          const currentLine = lines[j];
          
          // 计算当前行的括号数量来判断是否还在函数签名中
          for (const char of currentLine) {
            if (char === '(') {
              braceCount++;
            } else if (char === ')') {
              braceCount--;
              if (braceCount === 0) {
                inFunctionSignature = false;
              }
            } else if (char === '{' && !inFunctionSignature) {
              // 找到函数体开始的 {
              hookInsertIndex = j + 1;
              break;
            }
          }
          
          if (hookInsertIndex >= 0) break;
          j++;
        }
        break;
      }
    }
    
    // 如果找到了组件函数，在函数体开始处插入 hook 调用
    if (hookInsertIndex >= 0) {
      // 获取缩进 - 查看函数体内的第一个非空行的缩进
      let indent = '   '; // 默认缩进
      for (let k = hookInsertIndex; k < lines.length; k++) {
        const line = lines[k];
        if (line.trim()) {
          const match = line.match(/^(\s*)/);
          if (match) {
            indent = match[1];
          }
          break;
        }
      }
      
      lines.splice(hookInsertIndex, 0, `${indent}const { t } = useTranslation();`);
    }
    
    return lines.join('\n');
  }
}

export class TencentTranslationService {
  private retryCount = 3; // 固定重试次数
  constructor(private secretId: string='', private secretKey: string='', private region: string='ap-beijing'){}
  updateCredentials(id:string,key:string,region:string){ this.secretId=id; this.secretKey=key; this.region=region; }
  async translateText(text: string): Promise<string> {
    if(!this.secretId || !this.secretKey) return '';
    try{
      const ts = Math.floor(Date.now()/1000);
      const params: Record<string,string|number> = { Action:'TextTranslate', Version:'2018-03-21', SourceText:text, Source:'zh', Target:'en', ProjectId:0 };
      const auth = this.auth(params, ts); const res = await this.request(params, auth, ts); const data = JSON.parse(res); return data?.Response?.TargetText || '';
    }catch{ return ''; }
  }
  async translateBatch(tasks: Array<{key:string,text:string}>){
    const out: Record<string,string>={};
    for(const t of tasks){
      let attempt = 0; let translated = '';
      while(attempt <= this.retryCount){
        translated = await this.translateText(t.text);
        if(translated) break;
        attempt++;
        if(attempt <= this.retryCount) await new Promise(r=>setTimeout(r, 300 * attempt));
      }
      out[t.key] = translated || t.text; // fallback to original to avoid empty string
      await new Promise(r=>setTimeout(r,180));
    }
    return out;
  }
  private auth(params: Record<string,string|number>, ts: number){
    const payload=JSON.stringify(params); const hashedPayload=crypto.createHash('sha256').update(payload).digest('hex');
    const canonicalHeaders='content-type:application/json; charset=utf-8\nhost:tmt.tencentcloudapi.com\nx-tc-action:texttranslate\n';
    const canonicalRequest=['POST','/','',canonicalHeaders,'content-type;host;x-tc-action',hashedPayload].join('\n');
    const algorithm='TC3-HMAC-SHA256'; const date=new Date(ts*1000).toISOString().slice(0,10); const service='tmt'; const scope=`${date}/${service}/tc3_request`;
    const hashedCanonical=crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign=[algorithm,String(ts),scope,hashedCanonical].join('\n');
    const kDate=crypto.createHmac('sha256','TC3'+this.secretKey).update(date).digest();
    const kService=crypto.createHmac('sha256',kDate).update(service).digest();
    const kSigning=crypto.createHmac('sha256',kService).update('tc3_request').digest();
    const signature=crypto.createHmac('sha256',kSigning).update(stringToSign).digest('hex');
    return `${algorithm} Credential=${this.secretId}/${scope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;
  }
  private request(params: Record<string,string|number>, authorization: string, ts: number){
    return new Promise<string>((resolve,reject)=>{ const body=JSON.stringify(params); const req=https.request({ hostname:'tmt.tencentcloudapi.com', path:'/', method:'POST', port:443, headers:{ 'Authorization':authorization,'Content-Type':'application/json; charset=utf-8','Host':'tmt.tencentcloudapi.com','X-TC-Action':'TextTranslate','X-TC-Timestamp':ts,'X-TC-Version':'2018-03-21','X-TC-Region':this.region,'Content-Length':Buffer.byteLength(body) } },res=>{ let data=''; res.on('data',c=>data+=c); res.on('end',()=>resolve(data)); }); req.on('error',reject); req.write(body); req.end(); });
  }
}

export class I18nSyncer {
  private translator: TencentTranslationService;
  private writer: { queue:(file:string, transform:(oldContent:string)=>string|null)=>void } | null = null;
  constructor(secretId?:string, secretKey?:string, region?:string){ this.translator = new TencentTranslationService(secretId, secretKey, region); }
  updateCredentials(id:string,key:string,region:string){ this.translator.updateCredentials(id,key,region); }
  setWriter(writer:{ queue:(file:string, transform:(oldContent:string)=>string|null)=>void }){ this.writer = writer; }
  ensureZhKeys(newTranslations: Record<string,string>){
    if(!newTranslations||!Object.keys(newTranslations).length || !this.writer) return;
    const zh=PathUtils.paths.commonZhFile;
    this.writer.queue(zh, (old)=>{
      let content = old && old.trim().length ? old : 'export default {\n};\n';
      const existing=this.extract(content); let add='';
      for(const [k,v] of Object.entries(newTranslations)){
        if(!this.valid(k)||existing[k]) continue; add+=`  "${k}": "${(v??k).replace(/"/g,'\\"')}",\n`;
      }
      if(!add) return null; content=this.insert(content,add); return this.clean(content);
    });
  }
  ensureZhKeysByKeySet(keys:Set<string>){
    if(!keys.size || !this.writer) return;
    const zh=PathUtils.paths.commonZhFile;
    this.writer.queue(zh, old=>{
      let content = old && old.trim().length ? old : 'export default {\n};\n';
      const existing=this.extract(content); let add='';
      keys.forEach(k=>{ if(this.valid(k)&&!existing[k]) add+=`  "${k}": "${k}",\n`; });
      if(!add) return null; content=this.insert(content,add); return this.clean(content);
    });
  }
  async cleanUnusedKeys(){
    if(!this.writer) return;
    const zh=PathUtils.paths.commonZhFile; const en=PathUtils.paths.commonEnFile;
    if(!fs.existsSync(zh)||!fs.existsSync(en)) return;
    const used=this.collectUsed(PathUtils.paths.srcDir);
    await this.cleanFileQueued(zh,used); await this.cleanFileQueued(en,used);
  }
  private collectUsed(dir:string, acc:Set<string>=new Set()):Set<string>{ let items:string[]=[]; try{ items=fs.readdirSync(dir);}catch{return acc;} for(const it of items){ const full=path.join(dir,it); let st:fs.Stats; try{ st=fs.statSync(full);}catch{continue;} if(st.isDirectory()){ if(!PathUtils.shouldExcludeDir(it)) this.collectUsed(full,acc);} else if(st.isFile() && PathUtils.isSupportedExtension(full) && PathUtils.isInSrc(full) && !PathUtils.isEnLangFile(full)){ const code=fs.readFileSync(full,'utf8'); const re=/t\(\s*["']([^"']+)["']\s*\)/g; let m:RegExpExecArray|null; while((m=re.exec(code))!==null) acc.add(m[1]); } } return acc; }
  private async cleanFileQueued(file:string, used:Set<string>){
    if(!this.writer) return;
    this.writer.queue(file, old=>{
      if(!old) return null;
      const keys=this.extract(old); let updated=old; let removed=0;
      for(const k of Object.keys(keys)){
        if(!used.has(k)){
          const reg=new RegExp(`\n?\s*"${k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}":\s*"[^"]*",?`);
          updated=updated.replace(reg,''); removed++;
        }
      }
      if(!removed) return null; return this.clean(updated);
    });
  }
  async syncTranslationFiles(autoTranslate:boolean, log?:(m:string)=>void){ if(!autoTranslate){ log?.('Skip translation (autoTranslate=false)'); return; } const zh=PathUtils.paths.commonZhFile; const en=PathUtils.paths.commonEnFile; if(!fs.existsSync(zh)){ log?.('Zh file missing'); return; } const zhContent=fs.readFileSync(zh,'utf8'); const zhKeys=this.extract(zhContent); const enContent=fs.existsSync(en)?fs.readFileSync(en,'utf8'):'export default {\n};\n'; const enKeys=this.extract(enContent); const need=Object.keys(zhKeys).filter(k=>!enKeys[k]); if(!need.length){ log?.('No new keys to translate'); return; } log?.(`Translating ${need.length} keys ...`); const tasks=need.map(k=>({key:k,text:zhKeys[k]})); const translated=await this.translator.translateBatch(tasks); this.updateEnglish(en,translated); log?.('Translation sync finished'); }
  /** 修复手动编辑遗漏的逗号 */
  fixCommas(){
    if(!this.writer) return;
    const queueFix = (file:string)=>{
      this.writer!.queue(file, old=>{
        if(!old || !/export\s+default\s+{/.test(old)) return null;
        const match = old.match(/export\s+default\s+{([\s\S]*?)};?\s*$/);
        if(!match) return null;
        const body = match[1];
        const pairRegex = /"([^"\\]+)"\s*:\s*"([^"\\]*)"/g;
        const pairs: Array<{k:string,v:string}> = [];
        let m:RegExpExecArray|null; while((m=pairRegex.exec(body))!==null){ pairs.push({k:m[1],v:m[2]}); }
        const ordered: Array<{k:string,v:string}> = [];
        const seen=new Set<string>();
        for(let i=pairs.length-1;i>=0;i--){ if(seen.has(pairs[i].k)) continue; seen.add(pairs[i].k); ordered.unshift(pairs[i]); }
        const rebuilt = 'export default {\n' + ordered.map(p=>`  "${p.k}": "${p.v.replace(/"/g,'\\"')}",`).join('\n') + '\n};\n';
        // 如果原内容缺少逗号，rebuilt 会不同；否则保持不写
        if(rebuilt === old) return null; return rebuilt;
      });
    };
    queueFix(PathUtils.paths.commonZhFile);
    queueFix(PathUtils.paths.commonEnFile);
  }
  private extract(content:string):Record<string,string>{ const map:Record<string,string>={}; const re=/"([^"\\]+)"\s*:\s*"([^"\\]*)"/g; let m:RegExpExecArray|null; while((m=re.exec(content))!==null) map[m[1]]=m[2]; return map; }
  private updateEnglish(file:string, translations:Record<string,string>){
    if(!this.writer) return;
    this.writer.queue(file, old=>{
      let content = old && old.trim().length ? old : 'export default {\n};\n';
      let add='';
      for(const [k,v] of Object.entries(translations)){
        if(!v) continue; if(new RegExp(`"${k}"\s*:`).test(content)) continue; add+=`  "${k}": "${v.replace(/"/g,'\\"')}",\n`;
      }
      if(!add) return null; content=this.insert(content,add); return this.clean(content);
    });
  }
  private ensureFile(file:string){ if(!fs.existsSync(file)){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,'export default {\n};\n','utf8'); } }
  private insert(content:string, block:string){ const pos=content.lastIndexOf('}'); if(pos===-1) return content+'\n'+block+'}\n'; const before=content.slice(0,pos); const after=content.slice(pos); return before+(before.endsWith('\n')?'':'\n')+block+after; }
  // 保留每个键行尾部逗号（便于追加 diff 简单化）
  private clean(c:string){
    // 先标准化换行，再确保最后一个键后也有逗号然后再在 }; 前移除多余换行
    const lines = c.split(/\r?\n/);
    // 不强行移除每行末尾逗号，主要修复：缺少逗号的相邻行
    for(let i=0;i<lines.length-1;i++){
      if(/"\s*:\s*".*"$/.test(lines[i]) && !lines[i].trim().endsWith(',')){
        lines[i] = lines[i].replace(/$/g,',');
      }
    }
    return lines.join('\n');
  }
  private valid(k:string){ return !!k && k.trim()!==','; }
}
