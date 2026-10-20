# 本地工作台规则

资源声明位于 resources/*.mjs，core 提供通用能力，commands 编排 CLI。新增资源后运行 schema、sync、check。使用纯 ESM .mjs + JSDoc，不增加依赖。所有写入必须经过 safe-write；不得读取 .env、密钥，不处理 public 素材，不执行 Git、部署、HTTP 服务或预览。
