# 单后台迁移报告

迁移日期：2026-08-05

## 目标

将 `my-blog-manager-v2` 设为唯一后台，使它不再读取上级目录的旧后台数据，并保留现有前台、预览、同步和发布能力。

## 已迁移数据

- `posts/`
- `chatters/`
- `moments/`
- `data/siteConfig.ts`
- `data/aiModels.json`
- `data/petProfiles.json`
- `data/albums.ts`
- `data/friends.ts`
- `data/projects.ts`
- `data/deploy_config.json`
- `siteConfig.ts`
- `assets/site/`
- `assets/pets/`
- `assets/backgrounds/`
- `assets/live2d/`
- `assets/legacy/`
- `data/live2dModels.json`

## 架构变化

旧结构中，v2 通过上级路径读取 `my-blog-manager`。迁移后，v2 使用自身目录作为数据根目录：

```text
my-blog-manager-v2/
├─ assets/
├─ chatters/
├─ data/
├─ moments/
├─ posts/
├─ public/
├─ siteConfig.ts
└─ server.js
```

服务端 API、备份、文档读写、设置读写、预览和发布同步均读取 v2 自身目录。同步到前台时，v2 的内容和素材映射到 `XHBlogs/`。

## 素材映射

- `assets/site/` -> `XHBlogs/public/assets/site/`
- `assets/pets/` -> `XHBlogs/public/assets/pets/`
- `assets/backgrounds/` -> `XHBlogs/public/backgrounds/`
- `assets/live2d/` -> `XHBlogs/public/live2d/`
- `assets/legacy/` -> `XHBlogs/public/assets/legacy/`

前台树页面的旧素材引用已改为 `/assets/legacy/...`，避免继续依赖前台根目录散落文件。

## Live2D 与 TTS

- 正式模型统一放在 `assets/live2d/models/<model-id>/`，宠物配置只保存 `modelId`。
- Cubism 4 Core 放在 `assets/live2d/runtime/cubism4/`，前台运行时从本地加载。
- `data/live2dModels.json` 保存模型入口、参数白名单、布局和本地表情预设。
- `/api/expression` 支持 OpenAI 兼容的表达 LLM；未配置或返回非法参数时自动回退到本地预设。
- `/api/tts` 支持 OpenAI 兼容的语音接口；未配置远程服务时回退到浏览器 `speechSynthesis`。
- AI 宠物在用户发言和 AI 回复后触发表情，AI 和 AI 宠物聊天框都提供语音开关。
- 未选入前台的模型保存在 `D:\7.16\references\live2d-model-library`，不参与同步和部署。

## 已移除内容

- 旧后台 Next.js 页面和组件
- 旧 Python/FastAPI 控制台
- 旧 Python 启动器和旧后台启动脚本
- 旧后台专用 npm 依赖和配置
- 旧自动更新脚本
- 旧配置修补脚本
- 旧 README 中关于双后台、旧控制台和旧部署流程的说明

## 保留行为

- 本地文章、杂谈、说说编辑
- 站点图形化配置
- AI 模型和 AI 宠物配置
- Live2D / Cubism 资源管理
- 本地前端实时预览
- 本地同步、GitHub 推送和 Vercel 部署入口
- 浏览器本地聊天记录和好感度存储

## 验证清单

- [x] v2 `server.js` 和控制台前端脚本语法检查
- [x] v2 控制台启动，健康接口返回 `manager-v2`
- [x] 本地预览启动并 ready
- [x] 首页、`/ai`、`/pet`、`/tree` 页面访问均返回 HTTP 200
- [x] 临时内容写入、同步到前台、删除及残留检查
- [x] 本地前端同步，数据和素材均从 v2 映射到 `XHBlogs/`
- [x] 前台生产构建通过，共生成 19 个路由
- [x] 旧后台目录删除后重新执行根目录启动器，v2 健康接口正常
- [x] 本地 Cubism Core、模型入口、表达接口和 TTS 浏览器降级接口访问正常
- [x] 本次新增文件专门 lint 通过

## 验证备注

- 当前工作区没有执行 GitHub 推送或 Vercel 正式部署。
- 构建保留一个既有的 Turbopack NFT 动态文件扫描警告，不影响编译和生成结果。
- 预览端口冲突由旧残留进程引起，已清理后由 v2 重新启动成功。
- 完整 `tsc --noEmit` 仍有改造前遗留的 `chatter`、`friends`、`SiteDashboard` 和 AI 模型类型错误，本次新增文件不在错误列表中。
- 完整 lint 仍有旧页面遗留问题；本地 Cubism Core 已加入 ESLint 忽略，新增文件的专门 lint 已通过。

GitHub 推送和 Vercel 正式部署不在迁移验证中自动执行。
