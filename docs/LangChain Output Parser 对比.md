# LangChain Output Parser 对比测试

本包演示了在 LangChain JS 中获取结构化输出的多种方式，从最原始的手动解析到最高级的 `withStructuredOutput`，并附带流式 `for await...of` 示例。

## 环境配置

在 `.env` 中配置以下变量：

```env
MODEL_NAME=qwen3.6-plus
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## 方式对比

| 文件 | 方式 | 类型安全 | 自动解析 | 推荐度 |
|------|------|----------|----------|--------|
| `normal.mjs` | 手动 `JSON.parse` | ❌ | ❌ | ⭐ |
| `json-output-parser.mjs` | `JsonOutputParser` | ❌ | ✅ | ⭐⭐ |
| `structured-output-parser.mjs` | `StructuredOutputParser.fromNamesAndDescriptions` | △ | ✅ | ⭐⭐⭐ |
| `structured-output-parser2.mjs` | `StructuredOutputParser.fromZodSchema` | ✅ | ✅ | ⭐⭐⭐⭐ |
| `tool-call-args.mjs` | `bindTools` + 手动取 `tool_calls[0].args` | ✅ | △ | ⭐⭐⭐ |
| `with-structured-output.mjs` | `withStructuredOutput` | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| `stream-normal.mjs` | `model.stream` + `for await...of` | — | — | 流式文本示例 |

---

## 各方式详解

### 1. `normal.mjs` — 手动解析

最原始的方式：在 prompt 里要求模型返回 JSON，然后手动 `JSON.parse`。

```js
const response = await model.invoke(question)
const jsonResult = JSON.parse(response.content)
```

**缺点：** 模型不保证格式，`JSON.parse` 容易抛错，无类型提示。

---

### 2. `json-output-parser.mjs` — JsonOutputParser

使用 `JsonOutputParser`，通过 `getFormatInstructions()` 自动在 prompt 中注入格式要求，并自动解析返回内容。

```js
import { JsonOutputParser } from '@langchain/core/output_parsers'

const parser = new JsonOutputParser()
const question = `你的问题\n\n${parser.getFormatInstructions()}`

const response = await model.invoke(question)
const result = await parser.parse(response.content)
```

**优点：** 自动解析，无需手写 `JSON.parse`。  
**缺点：** 无 Schema 约束，字段名/类型不可校验。

---

### 3. `structured-output-parser.mjs` — StructuredOutputParser（字段描述）

用字段名+描述定义结构，自动生成格式指令并注入 prompt。

```js
import { StructuredOutputParser } from '@langchain/core/output_parsers'

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  name: '姓名',
  birth_year: '出生年份',
  nationality: '国籍',
})

const question = `你的问题\n\n${parser.getFormatInstructions()}`
const response = await model.invoke(question)
const result = await parser.parse(response.content)
```

**优点：** 结构明确，字段有描述。  
**缺点：** 所有字段都是 `string` 类型，无法约束数字、数组、嵌套对象。

---

### 4. `structured-output-parser2.mjs` — StructuredOutputParser（Zod Schema）

用 Zod 定义复杂结构，支持嵌套对象、数组、可选字段、类型校验。

```js
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'

const schema = z.object({
  name: z.string().describe('科学家的全名'),
  birth_year: z.number().describe('出生年份'),
  awards: z.array(z.object({
    name: z.string(),
    year: z.number(),
  })).describe('获得的奖项'),
})

const parser = StructuredOutputParser.fromZodSchema(schema)
const question = `你的问题\n\n${parser.getFormatInstructions()}`
const response = await model.invoke(question)
const result = await parser.parse(response.content)  // 自动做 Zod 校验
```

**优点：** 强类型，支持复杂嵌套，自动 Zod 校验。  
**缺点：** 仍依赖 prompt 注入，模型不一定严格遵守。

---

### 5. `tool-call-args.mjs` — bindTools

将 Schema 注册为 Tool，让模型通过 function calling 返回结构化参数，从 `tool_calls[0].args` 中取结果。

```js
const modelWithTool = model.bindTools([{
  name: 'extract_scientist_info',
  description: '提取科学家信息',
  schema: scientistSchema,
}])

const response = await modelWithTool.invoke('介绍一下爱因斯坦')
const result = response.tool_calls[0].args
```

**优点：** 利用 function calling，结构更可靠。  
**缺点：** 需要手动从 `tool_calls` 中取值，稍显繁琐。

> ⚠️ **注意：** 思考模式（thinking mode）下不支持 `tool_choice: required`，需禁用思考模式。

---

### 6. `with-structured-output.mjs` — withStructuredOutput（推荐）

LangChain 对 function calling 的高级封装，直接返回解析好的对象，无需手动处理 `tool_calls`。

```js
import { z } from 'zod'

const schema = z.object({
  name: z.string().describe('科学家的全名'),
  birth_year: z.number().describe('出生年份'),
  nationality: z.string().describe('国籍'),
  fields: z.array(z.string()).describe('研究领域列表'),
})

const structuredModel = model.withStructuredOutput(schema, {
  method: 'functionCalling',
})

const result = await structuredModel.invoke('介绍一下爱因斯坦')
// result 直接是 { name, birth_year, nationality, fields }
```

**优点：** 最简洁，强类型，直接得到结构化对象。  
**推荐作为生产环境首选方案。**

---

## 常见问题

### 使用思考模式（Thinking Mode）模型时报错

以 Qwen3 为例，`withStructuredOutput` 在思考模式下会遇到两个**独立**的错误，需要同时解决：

| 错误 | 触发原因 | 解决方案 |
|------|---------|---------|
| `messages must contain the word 'json'` | 默认方法是 `jsonMode`，使用 `response_format: json_object`，Qwen API 强制要求 prompt 含 "json"——与思考模式**无关** | 指定 `method: 'functionCalling'` |
| `tool_choice does not support required in thinking mode` | `functionCalling` 会设置 `tool_choice: required`，思考模式不支持 | `enable_thinking: false` |

两个问题**完全独立**，缺一不可：

- 禁用思考模式**不能**解决 `jsonMode` 的问题——只要 prompt 里没有 "json"，`jsonMode` 就报错
- 不指定 `functionCalling`，默认 `jsonMode` 在 prompt 不含 "json" 时永远失败

完整修复如下：

```js
const model = new ChatOpenAI({
  // ...
  modelKwargs: {
    enable_thinking: false,  // 禁用 Qwen3 思考模式，允许 function calling
  },
})

const structuredModel = model.withStructuredOutput(schema, {
  method: 'functionCalling',  // 绕过 jsonMode 对 prompt 含 "json" 的要求
})
```

> 注意：LangChain JS 使用 `modelKwargs`（驼峰），不是 Python 的 `model_kwargs`。

---

## `for await...of`（异步迭代）

本包 `stream-normal.mjs` 使用该方法消费 `model.stream`。语法、场景与注意点见独立说明：[for-await-of.md](./for-await-of.md)。
