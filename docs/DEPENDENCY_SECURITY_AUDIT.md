# 依赖安全审计记录与后续处理指南

## 审计基线

- 项目：`XHBlogs`
- 审计时间：2026-09-05
- 使用命令：`npm audit --json`
- 当前依赖安装状态：以 `package-lock.json` 为准

当前完整依赖树报告 **21 项漏洞**：

| 严重性 | 数量 |
| --- | ---: |
| Critical | 2 |
| High | 16 |
| Moderate | 2 |
| Low | 1 |

只审计生产依赖（`npm audit --omit=dev`）仍有 **17 项**：2 Critical、14 High、1 Moderate。

## 主要问题

### 1. `pixi-live2d-display@0.4.0`（Critical）

- 依赖链：`pixi-live2d-display -> gh-pages`
- 当前版本：`0.4.0`
- npm 提示的自动修复版本：`0.3.1`，属于降级/破坏性变更，不能直接执行。
- 代码使用位置：`lib/live2dRuntime.ts`

后续处理顺序：

1. 先确认项目是否仍需要 `pixi-live2d-display` 的运行时能力。
2. 如果继续使用，评估升级到维护中的 Live2D/Pixi 方案，或隔离发布工具依赖。
3. 如果不再使用，删除该直接依赖，再执行 `npm install` 和构建验证。
4. 不要仅为消除审计数字直接降级到 `0.3.1`。

### 2. `gitalk@1.8.0` 引入的旧依赖（High）

依赖链包含：

`gitalk -> axios@0.19.2`

`gitalk -> react-flip-move -> react-dom@15.7.0 -> fbjs -> isomorphic-fetch -> node-fetch@1.7.3`

这些版本过旧，涉及 SSRF、CSRF、原型污染、请求头泄露等公告；npm 当前没有无破坏性自动修复。

后续处理顺序：

1. 检查 `gitalk` 是否实际被页面使用。
2. 如果未使用，移除 `gitalk` 并重新安装依赖。
3. 如果仍使用，优先迁移到维护中的评论方案；不要直接强制覆盖其内部 React/Axios 版本。

### 3. `next@16.2.1` 及其依赖（High）

Next.js 当前版本会带入受影响的 `postcss` 和 `sharp`，同时存在 App Router、Server Actions、Middleware、图片优化等安全公告。

- 当前版本：`next@16.2.1`
- `eslint-config-next` 当前版本：`16.2.1`
- npm 建议修复版本：`next@16.3.4`

这是优先级最高的常规升级项。升级时应同时更新 `next` 与 `eslint-config-next`，然后执行构建和页面回归测试。

### 4. 开发工具链间接依赖

审计还报告了 `brace-expansion`、`picomatch`、`fflate`、`@humanfs/node`、`@babel/*`、`postcss` 等间接依赖漏洞。多数可通过重新生成锁文件获得补丁版本，但需要检查 ESLint、Tailwind 和 Next.js 版本兼容性。

## 建议处理顺序

按以下顺序分批修改，每批都单独提交，便于回退：

1. 先升级 `next` 与 `eslint-config-next` 到 npm audit 给出的安全版本或更高的稳定补丁版本。
2. 执行 `npm install` 更新 `package-lock.json`。
3. 移除未使用的 `gitalk`；若必须保留，先安排替代方案，不要使用 `--force` 覆盖子依赖。
4. 评估 `pixi-live2d-display`：删除、替换或单独隔离其 `gh-pages` 发布依赖。
5. 处理剩余开发依赖补丁版本。
6. 最后再考虑 `npm audit fix`；不要直接使用 `npm audit fix --force`。

## 每次修改后的验证

在项目目录 `XHBlogs` 执行：

```powershell
npm install
npm audit
npm audit --omit=dev
npm run lint
npm run build
```

检查依赖树和变更范围：

```powershell
npm ls pixi-live2d-display gh-pages gitalk axios node-fetch next postcss sharp
git diff -- package.json package-lock.json
```

如果升级导致构建失败，先恢复该批次的 `package.json` 和 `package-lock.json`，再逐个升级，避免一次性引入多个不相关变量。

## 当前结论

本次只完成审计和记录，**没有修改依赖版本**。在处理 `pixi-live2d-display` 和 `gitalk` 前，应先确认它们是否仍是网站功能所必需；`next` 升级则可以作为下一批独立变更优先进行。
