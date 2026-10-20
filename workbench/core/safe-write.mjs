import fs from 'node:fs/promises';
import path from 'node:path';

export function resolveAuthorized(root, relative) {
  const normalized = String(relative).replaceAll('\\','/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..') || normalized.split('/').some(x => x === '.env' || x.startsWith('.env.'))) throw new Error('未授权路径: '+normalized);
  const base = path.resolve(root), target = path.resolve(base, normalized);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error('目标路径越界');
  return target;
}
export function showDiff(before, after, relative) {
  if (before === after) return '无变化: '+relative;
  return ['--- '+relative, before === null ? '(新文件)' : '(原文件)', after === null ? '(将删除)' : after.slice(0,12000)].join('\n');
}
export async function safeWrite({root, relative, content, validate, yes=false, dryRun=false, remove=false}) {
  const target=resolveAuthorized(root,relative);
  const old=await fs.readFile(target,'utf8').catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
  const next=remove?null:content;
  console.error(showDiff(old,next,relative));
  if (dryRun || !yes || old===next) return {changed:false,dryRun:true,relative};
  const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  const backupRel=path.posix.join('workbench/.backup',stamp,relative.replaceAll('\\','/'));
  if(old!==null){await fs.mkdir(path.dirname(resolveAuthorized(root,backupRel)),{recursive:true}); await fs.writeFile(resolveAuthorized(root,backupRel),old,'utf8');}
  const tmp=target+'.wbtmp';
  try { if(next===null){await fs.rm(target,{force:true});} else {await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(tmp,next,'utf8'); await fs.rename(tmp,target);} if(validate) await validate(await fs.readFile(target,'utf8')); await prune(root); return {changed:true,relative,backup:old===null?null:backupRel}; }
  catch(e){ await fs.rm(tmp,{force:true}).catch(()=>{}); if(old===null) await fs.rm(target,{force:true}).catch(()=>{}); else await fs.writeFile(target,old,'utf8').catch(()=>{}); throw new Error('写入失败，已回滚 '+relative+': '+e.message); }
}
async function prune(root){const dir=path.join(root,'workbench','.backup');const xs=await fs.readdir(dir,{withFileTypes:true}).catch(()=>[]);for(const x of xs.filter(y=>y.isDirectory()).sort((a,b)=>b.name.localeCompare(a.name)).slice(100))await fs.rm(path.join(dir,x.name),{recursive:true,force:true});}