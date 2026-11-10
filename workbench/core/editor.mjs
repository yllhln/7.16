import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

export async function editTemplateFile({ file, text }) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
  const command = process.env.WORKBENCH_EDITOR || 'notepad.exe';
  await new Promise((resolve, reject) => {
    const child = spawn(command, [file], { stdio: 'inherit', shell: Boolean(process.env.WORKBENCH_EDITOR) });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} 退出码 ${code}`)));
  });
  return fs.readFile(file, 'utf8');
}

export function tempTemplatePath(resourceId, id = 'new') {
  const safe = String(id).replace(/[^a-z0-9_-]/gi, '_');
  return path.join(os.tmpdir(), 'xinghuisama-workbench', `${resourceId}-${safe}.txt`);
}
