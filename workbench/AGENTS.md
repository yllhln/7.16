# 本地工作台规则

资源声明位于 resources/*.mjs，core 提供通用能力，commands 编排 CLI。新增资源后运行 schema、sync、check。使用纯 ESM .mjs + JSDoc，不增加依赖。所有项目内容写入必须经过 safe-write；不得读取 .env*、环境变量凭据、API key、密码或私钥，不执行 Git、部署、HTTP 服务或预览。站点配置工作台模板允许明文读取、显示和写回 `siteConfig.ts` 中已登记的全部属性（包括 social、gitalkConfig、counts、footerBadges、icpConfig）；此授权仅限该配置对象，不扩展到 .env 或密钥文件。交互式编辑使用 Notepad（可由 WORKBENCH_EDITOR 覆盖），模板位于 workbench/templates，ASCII Art 位于 workbench/assets/ascii；校验通过并确认后才写入。
