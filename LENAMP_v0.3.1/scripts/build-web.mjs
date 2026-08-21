import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'www');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of ['index.html', 'css', 'js', 'assets']) {
  const source = path.join(root, entry);
  if (!existsSync(source)) throw new Error(`Arquivo/pasta obrigatório ausente: ${entry}`);
  await cp(source, path.join(out, entry), { recursive: true });
}

await writeFile(path.join(out, '.lenamp-build'), `LENAMP web build ${new Date().toISOString()}\n`, 'utf8');
console.log('LENAMP: build web concluído em www/.');
