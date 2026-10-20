import fs from 'node:fs/promises';
import path from 'node:path';
export async function readCollection(root,r){const file=path.join(root,r.storage.file);const doc=JSON.parse(await fs.readFile(file,'utf8'));const list=doc[r.storage.collectionKey];if(!Array.isArray(list))throw new Error('集合不是数组: '+r.id);return {file,doc,list};}
export function renderJson(doc){return JSON.stringify(doc,null,2)+'\n';}
