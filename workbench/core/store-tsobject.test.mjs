import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readTsProperties, replaceTsProperties } from './store-tsobject.mjs';
import { resource } from '../resources/site-config.mjs';

test('siteConfig can be read and rendered without changing unrelated code',async()=>{const file=path.resolve('siteConfig.ts');const raw=await fs.readFile(file,'utf8');const keys=resource.fields.map(f=>f.name);const values=await readTsProperties(raw,'siteConfig',keys,'siteConfig.ts');assert.equal(typeof values.title,'string');const changed=await replaceTsProperties(raw,'siteConfig',{...values,title:values.title},keys,'siteConfig.ts');assert.deepEqual(await readTsProperties(changed,'siteConfig',keys,'siteConfig.ts'),values)});
