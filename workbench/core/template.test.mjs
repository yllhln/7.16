import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplate, parseTemplate } from './template.mjs';
import { replaceTsProperties, readTsProperties } from './store-tsobject.mjs';

const post={id:'post',storage:{idField:'id'},template:{body:'正文'},fields:[{name:'id',type:'string',required:true},{name:'title',type:'string',required:true},{name:'tags',type:'string[]'}]};

test('template round trips typed values and multiline body with new format',()=>{
  // 使用新格式：字段名: "值"  # 说明
  const source = `# Workbench resource: post
id: "hello"  # 字符串，必填（固定 ID，不可修改）
title: "标题"  # 字符串，必填
tags: ["a","b"]  # 字符串数组，如 ["a","b"]，必填
#正文 BEGIN
文本 {花括号}
第二行
#正文 END
`;
  const result=parseTemplate(source,post,{original:{id:'hello'}});
  assert.equal(result.title,'标题');
  assert.deepEqual(result.tags,['a','b']);
  assert.equal(result.__body,'文本 {花括号}\n第二行');
});

test('template rejects unknown and missing fields',()=>{
  assert.throws(()=>parseTemplate('unknown: ""  # bad',post,{isNew:true}),/未登记字段/);
  const source = `# Workbench resource: post
id: ""  # 字符串，必填
title: ""  # 字符串，必填
`;
  assert.throws(()=>parseTemplate(source,post,{isNew:true}),/模板缺少字段/);
});

test('TS object properties preserve file structure and nested values',async()=>{
  const raw='export const siteConfig = {\n  title: "old",\n  social: { github: "https://example.com", visible: true },\n};\n';
  const fields=['title','social'];
  const values=await readTsProperties(raw,'siteConfig',fields);
  assert.equal(values.social.github,'https://example.com');
  const changed=await replaceTsProperties(raw,'siteConfig',{title:'new',social:{github:'https://example.com',visible:false}},fields);
  assert.match(changed,/title: "new"/);
  assert.deepEqual(await readTsProperties(changed,'siteConfig',fields),{title:'new',social:{github:'https://example.com',visible:false}})
});