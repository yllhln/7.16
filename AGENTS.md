## 本地工作台同步规则

工作台资源在 `workbench/resources/*.mjs` 中声明。修改内容目录、Markdown front matter、TS 数据结构、当前 AI 配置 JSON schema/字段/引用关系或新增文件读取页面时，必须同步检查资源注册表，并运行：
`node workbench/wb.mjs sync`
`node workbench/wb.mjs check`

改工作台前先读 `workbench/AGENTS.md`。工作台只写文件，不执行 Git、部署或预览。

## 面向 AI/Agent 的本地工作台使用指南

### 1. 工作职责边界

本项目的本地工作台是 Agent 操作项目内容的安全文件层，不是网站运行服务器，也不是 Git 发布工具。

- 工作台入口：`node workbench/wb.mjs`。
- 工作台只读写当前项目中由注册表授权的内容文件。
- 工作台不启动 Next.js、HTTP 服务、预览服务，不执行部署。
- 工作台本身不执行 Git 命令、不自动 commit、push 或发布到 GitHub。
- Agent 可以在用户明确要求“提交/推送 GitHub”时，在工作台操作完成后单独执行 Git 流程；必须先检查 diff 和验证结果，并在有风险时向用户确认。
- 禁止读取、打印、修改或备份 .env*、API key、密码、私钥和真实联系方式；配置中只能记录环境变量名称。
- 禁止复制、上传、删除或重建 `public/` 中的 Live2D、背景和其他素材。Live2D 工作台只登记已有路径和元数据。

### 2. Agent 接到内容任务时的标准流程

Agent 不要直接编辑文章、JSON 或 TS 文件。先把自然语言需求转换成工作台资源和命令，再执行以下流程：

1. 读取本文件和 `workbench/AGENTS.md`。
2. 运行 `node workbench/wb.mjs schema <resource>`，确认资源字段、存储位置和支持的操作。
3. 运行 `node workbench/wb.mjs list <resource> --json` 或 `get`，确认现有内容、ID 和引用关系。
4. 对复杂正文、`systemPrompt`、`parameters`、`emotions`、照片数组等内容，先在项目根生成 UTF-8 临时 `--data-file`；不要在 PowerShell 命令中内联复杂 JSON。
5. 先使用 `--dry-run` 生成 diff；检查目标文件、字段、未知字段、正文和引用是否符合需求。
6. 只有用户明确要求落盘，或用户的原始任务明确要求实际修改时，才使用 `--yes` 写入。
7. 写入后重新运行 `node workbench/wb.mjs check` 和 `node workbench/wb.mjs sync`。
8. 检查 `git diff --stat`、`git diff -- <目标文件>`，确认没有修改禁区文件或无关代码。
9. 如果用户要求提交 GitHub，再单独执行：查看状态 → 验证 → 提交 → 推送；不要让工作台隐式执行这些动作。
10. 汇报实际执行的命令、退出码、修改文件、备份位置、验证结果和未完成限制；不得把 dry-run 说成已写入，不得把本地配置写入说成网站运行时已经接入。

### 3. 常见 Agent 任务模板

#### 添加文章

推荐提示词：

> 请通过本项目本地工作台新增一篇文章，不要直接编辑 `posts/`。先读取 `workbench/AGENTS.md`，查询 `post` schema 和现有文章 ID；根据以下内容生成 UTF-8 临时数据文件，执行 `new post <英文slug> --data-file <文件> --body-file <正文文件> --dry-run`，检查 diff 后再使用 `--yes`。写入后运行 `check`、`sync`，最后检查目标文件 diff。除非我明确要求，不要执行 Git。文章日期必须是字符串，slug 必须是小写英文、数字、下划线或短横线。

文章完成后如需发布到 GitHub，追加要求：

> 文章工作台写入和检查都通过后，查看 Git diff，只提交本次文章相关文件；不要提交 `workbench/.backup/`、临时数据文件、密钥或无关改动。提交前向我报告将要提交的文件和 commit message，得到确认后再 commit/push。

#### 修改文章元数据

> 请使用 `edit post <slug>`，只修改我指定的 front matter 字段，保留正文、未知 front matter 字段和原文件换行格式。先 dry-run，确认 diff 只包含目标字段后再写入；不要整文件重写。

#### 新增或修改说说、杂谈和关于页

- 说说只写 `moments/`，不得写入 `posts/moments/`。
- 杂谈使用 `chatter` 资源，不要把它当文章处理。
- 关于页只允许修改元数据，不得新建或删除 `app/about/about.md`。
- 多行正文使用 `--body-file`，不要在 PowerShell 中拼接多行字符串。

#### 修改站点配置

> 先运行 `schema site-config`，只能修改白名单属性。禁止接触 `social`、`gitalkConfig`、`footerBadges`、`icpConfig`、`counts` 和任何未登记字段。颜色数组、背景数组等复杂值使用 `--data-file`。修改后运行 check、sync，并检查 siteConfig.ts 的局部 diff。

#### 管理 AI 角色和配置

> 先读取当前六个 JSON 配置和 `lib/characterProfiles.ts`，再通过 `character`、`live2d-model`、`background`、`ai-profile`、`tts-profile`、`behavior-profile` schema 操作。新增角色前确认五个关联 ID 已存在；删除配置前检查角色引用。长 `systemPrompt`、`parameters`、`emotions` 必须使用 UTF-8 `--data-file`。只记录环境变量名，绝不读取或输出密钥。修改后重新读取 JSON，运行 check 和 sync。不要因为 profile 的 enabled=false 就擅自判定配置无效，也不要声称网页已经接通 LLM/TTS。

#### 添加网站新功能

当用户提出“新增页面/组件/数据源/配置类型”等功能时，Agent 必须先判断这是“网站运行时代码”还是“工作台资源管理能力”：

1. 如果只是管理已有内容，优先新增或修改 `workbench/resources/<id>.mjs`，复用 core 存储层，不修改网站页面。
2. 如果网站新增了新的 Markdown 目录、`data/*.ts`、`data/*.json` 或新的读取路径，先实现网站功能，再同步新增对应资源声明或 `resources/_ignore.mjs` 的逐项忽略说明；不得为了让 sync 通过而忽略整个 data 目录。
3. 新资源必须只加入资源声明；不要在 core/commands 中硬编码资源 ID、路径或字段。
4. 新增存储类型时才扩展 core store，并为其补充路径授权、备份、原子写、回读验证、回滚和 schema 检查。
5. 新增后运行 `schema`、`sync`、`check`，并补充 dry-run/写入/回滚测试。
6. 工作台功能和网站运行时功能分开验收：工作台能编辑配置不代表页面已经使用了该配置；需要另行检查页面、API 和运行时调用。

### 4. GitHub 提交流程提示词

当用户明确要求把工作台修改提交到 GitHub 时，Agent 应使用以下流程：

> 先不要直接 push。运行工作台 check/sync，确认通过后查看 git status 和 git diff；只选择本次任务相关文件，排除 `workbench/.backup/`、`.env*`、密钥、临时 JSON 和 public 素材。向我列出待提交文件、变更摘要和 commit message，确认后再执行 git add、git commit、git push。推送完成后报告分支、commit hash 和远程结果。

如果用户没有明确要求 GitHub 操作，只完成本地文件修改和验证，不执行 Git。

### 5. Agent 汇报格式

每次工作台任务完成后，用以下结构汇报：

- **目标**：实际处理的资源和项目功能。
- **工作台命令**：逐条列出实际执行的 schema/list/get/new/edit/delete/check/sync 命令及退出码。
- **修改文件**：只列本次相关文件。
- **安全结果**：是否生成备份、是否执行 dry-run、是否接触 Git/.env/public。
- **验证结果**：check、sync、lint、build 的真实结果；区分基线失败、依赖缺失和本次引入问题。
- **GitHub 状态**：未要求时写“未执行 Git”；要求时写分支、commit 和 push 结果。
- **限制和后续操作**：明确需要用户安装依赖、确认 push、手动放置素材或另立任务的部分。

禁止声称“已发布”“网站已接入”“已提交 GitHub”或“验证通过”，除非对应操作确实执行并成功。

