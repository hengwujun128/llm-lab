# llm-lab

基于 pnpm workspace 的 AI/LLM 实验性 monorepo，集中管理 LangChain、RAG、向量数据库、MCP 工具调用等相关实验项目。

---

## 目录结构

```
llm-lab/
├── package.json            # workspace 根包（private，不发布）
├── pnpm-workspace.yaml     # workspace 包路径 + catalog 版本集中管理
├── .npmrc                  # pnpm 行为配置
├── pnpm-lock.yaml          # 所有子包统一 lock 文件（自动生成，勿手动修改）
├── README.md
└── packages/               # 所有子项目放在此目录下
    ├── milvus-test/        # Milvus 向量数据库 + LangChain RAG 实验
    ├── rag-test/           # 网页文档加载 + 文本切分实验
    └── tool-test/          # LangChain 工具调用 + MCP 服务端/客户端 + Agent
        └── vue3-todo-app/  # Vue 3 + Vite 前端示例（tool-test 内嵌子项目）
```

---

## 子项目说明

| 包名 | 路径 | 描述 |
|------|------|------|
| `milvus-test` | `packages/milvus-test` | Milvus 向量库的增删改查、RAG 流程、EPUB 电子书入库与检索 |
| `rag-test` | `packages/rag-test` | 网页 HTML 加载（Cheerio）、RecursiveCharacterTextSplitter 文本切分实验 |
| `tool-test` | `packages/tool-test` | LangChain 工具定义、MCP Server/Client、mini agent 循环调用实验 |
| `vue3-todo-app` | `packages/tool-test/vue3-todo-app` | Vite 8 + Vue 3 + TypeScript 的前端示例，与 tool-test 配套 |

---

## 关键设计决策

### 1. pnpm workspace 而非独立项目

所有子项目共享同一个 `pnpm-lock.yaml`，保证依赖版本一致，避免各项目之间的版本漂移。
根目录的 `node_modules` 通过硬链接共享包内容，节省磁盘空间。

### 2. Catalog 集中版本管理

`pnpm-workspace.yaml` 中的 `catalog:` 字段统一声明所有共享依赖的版本范围。
子项目的 `package.json` 使用 `"catalog:"` 引用，无需各自维护版本号：

```json
// packages/milvus-test/package.json
{
  "dependencies": {
    "@langchain/core": "catalog:",
    "@langchain/openai": "catalog:"
  }
}
```

升级共享依赖时只需修改一处（`pnpm-workspace.yaml`），然后运行 `pnpm update`。

### 3. 统一使用 ESM（`"type": "module"`）

三个 Node 脚本类子项目均已设为 `"type": "module"`，与源码文件（`.mjs`）保持一致，
避免 CommonJS/ESM 混用导致的解析歧义。

### 4. 包路径使用通配符

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'                          # 自动识别 packages/ 下所有直接子目录
  - 'packages/tool-test/vue3-todo-app'   # 嵌套子项目需显式声明
```

新增子项目只需在 `packages/` 下创建目录，无需修改 workspace 配置。

### 5. 构建脚本白名单

`@zilliz/milvus2-sdk-node` 依赖 `protobufjs`，后者需要运行 postinstall 脚本。
在 `pnpm-workspace.yaml` 中通过 `onlyBuiltDependencies` 显式允许：

```yaml
onlyBuiltDependencies:
  - protobufjs
  - esbuild
```

---

## 注意事项

> [!IMPORTANT]
> - **不要在子项目目录下单独运行 `pnpm install`**，始终在 `llm-lab/` 根目录执行，
>   以保持统一的 `pnpm-lock.yaml`。
> - **`pnpm-lock.yaml` 不要手动修改**，由 pnpm 自动维护。
> - 各子项目的 `.env` 文件包含 API Key 等敏感信息，已由各自的 `.gitignore` 排除，
>   **请勿提交**。
> - Peer dependency 警告（`ws`、`@browserbasehq/stagehand`）来自 `@langchain/*` 上游依赖，
>   属于预知问题，不影响实验脚本的正常运行。
> - `vue3-todo-app` 有独立的 `tsconfig.json` 和 `vite.config.ts`，
>   开发时在其目录下运行 `pnpm dev` 即可。

---

## 常用命令

```bash
# 在 llm-lab/ 根目录执行

# 安装所有子项目依赖
pnpm install

# 对所有子项目并行执行 dev（仅适用于有 dev 脚本的包）
pnpm -r --parallel run dev

# 只对指定子项目执行命令
pnpm --filter milvus-test run test
pnpm --filter vue3-todo-app run dev

# 升级某个 catalog 依赖到最新版
pnpm update @langchain/core --recursive

# 查看所有 workspace 包
pnpm list -r --depth 0
```

---

## 常见问题

### Q: 根目录执行 `pnpm run dev`，为什么终端输出是 `packages/tool-test/vue3-todo-app dev$ vite`？

`pnpm -r --parallel run dev` 会递归扫描 workspace 中所有子包，找到定义了 `dev` 脚本的包并**并行执行**。
`vue3-todo-app` 的 `dev` 脚本是 `vite`，因此输出 `packages/tool-test/vue3-todo-app dev$ vite`。

输出格式为 `<包路径> <脚本名>$ <实际命令>`，是 pnpm `--parallel` 模式的标准前缀，用于区分多个包的日志。

如果只想对单个包执行，使用：

```bash
pnpm --filter vue3-todo-app run dev
```

### Q: 输出显示 `Scope: 4 of 5 workspace projects`，为什么是 5 个而不是 4 个？

workspace 共包含 **5** 个项目（含根目录本身）：

| # | 路径 |
|---|------|
| 1 | `/`（根包 `llm-lab`） |
| 2 | `packages/milvus-test` |
| 3 | `packages/rag-test` |
| 4 | `packages/tool-test` |
| 5 | `packages/tool-test/vue3-todo-app` |

`4 of 5` 表示根目录作为命令触发者被排除，其余 4 个子包被执行。

---

## 新增子项目

```bash
# 1. 在 packages/ 下创建新目录并初始化
mkdir packages/my-new-project
cd packages/my-new-project
pnpm init

# 2. 编辑 package.json，将共享依赖改为 "catalog:" 引用
#    如有新的共享依赖，在根目录 pnpm-workspace.yaml 的 catalog: 中添加版本

# 3. 回到根目录安装
cd ../../
pnpm install

# 注意：packages/* 通配符会自动识别新目录，无需修改 pnpm-workspace.yaml
```

---

## 技术栈概览

| 类别 | 包 |
|------|----|
| LLM 框架 | `@langchain/core`, `@langchain/openai`, `@langchain/community` |
| 文档处理 | `@langchain/textsplitters`, `@langchain/classic`, `cheerio`, `epub2` |
| 向量数据库 | `@zilliz/milvus2-sdk-node`（Milvus） |
| MCP | `@modelcontextprotocol/sdk`, `@langchain/mcp-adapters` |
| 工具库 | `dotenv`, `zod`, `chalk` |
| 前端 | `vue@3`, `vite@8`, `vue-tsc`, `typescript` |
