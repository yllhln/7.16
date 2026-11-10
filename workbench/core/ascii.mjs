import fs from 'node:fs/promises';
import path from 'node:path';

export async function renderAscii(root, name, columns = process.stdout.columns || 80) {
  const file = path.join(root, 'workbench', 'assets', 'ascii', `${name}.txt`);
  let text;
  try { text = await fs.readFile(file, 'utf8'); }
  catch { return `[ ${name.toUpperCase()} ]`; }
  const width = Math.max(20, Math.min(80, columns));
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => [...line].slice(0, width).join('')).join('\n');
}
