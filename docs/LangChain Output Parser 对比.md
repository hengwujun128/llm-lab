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

### 非流式（结构化输出）

| 文件 | 方式 | 类型安全 | 自动解析 | 推荐度 |
|------|------|----------|----------|--------|
| `normal.mjs` | 手动 `JSON.parse` | ❌ | ❌ | ⭐ |
| `json-output-parser.mjs` | `JsonOutputParser` | ❌ | ✅ | ⭐⭐ |
| `structured-output-parser.mjs` | `StructuredOutputParser.fromNamesAndDescriptions` | △ | ✅ | ⭐⭐⭐ |
| `structured-output-parser2.mjs` | `StructuredOutputParser.fromZodSchema` | ✅ | ✅ | ⭐⭐⭐⭐ |
| `tool-call-args.mjs` | `bindTools` + 手动取 `tool_calls[0].args` | ✅ | △ | ⭐⭐⭐ |
| `with-structured-output.mjs` | `withStructuredOutput` | ✅ | ✅ | ⭐⭐⭐⭐⭐ |

### 流式（streaming）

| 文件 | 方式 | 实时输出 | 结构化 | 场景 |
|------|------|----------|--------|------|
| `stream-normal.mjs` | `model.stream` + `for await...of` | ✅ 逐字 | ❌ | 纯文本流式显示 |
| `stream-structured-partial.mjs` | `model.stream` + 全量拼接后再 `parser.parse` | ✅ 逐字 | ✅ 最终一次 | 流式显示 + 最终结构化 |
| `with-structured-output-stream.mjs` | `structuredModel.stream` | ✅ 逐块 | ✅ 逐步填充 | 结构化字段渐进输出 |
| `stream-tool-calls-raw.mjs` | `modelWithTool.stream` 直接打印 `tool_call_chunks` | ✅ 原始 chunk | △ 手动拼接 | 调试 / 观察底层数据 |
| `stream-tool-calls-parser.mjs` | `modelWithTool.pipe(JsonOutputToolsParser).stream` | ✅ 增量 | ✅ 自动解析 | 流式 tool calling 推荐方式 |

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

## 流式方式详解

### 7. `stream-normal.mjs` — 纯文本流式

最基础的流式示例，逐字符实时显示模型输出，不做任何结构化处理。

```js
const stream = await model.stream('你的问题')

for await (const chunk of stream) {
  process.stdout.write(chunk.content)
}
```

---

### 8. `stream-structured-partial.mjs` — 流式文本 + 最终解析

用 `StructuredOutputParser` 注入格式指令，流式收集全量文本，完成后一次性解析为结构化对象。适合既想实时显示进度、又需要最终结构化结果的场景。

```js
const parser = StructuredOutputParser.fromZodSchema(schema)
const prompt = `你的问题\n\n${parser.getFormatInstructions()}`

const stream = await model.stream(prompt)

let fullContent = ''
for await (const chunk of stream) {
  fullContent += chunk.content
  process.stdout.write(chunk.content)  // 实时显示
}

const result = await parser.parse(fullContent)  // 流结束后一次解析
```

**优点：** 用户实时看到输出，最终仍有结构化对象。  
**缺点：** 流式过程中无法按字段访问数据；依赖 prompt 注入，结构不如 function calling 可靠。

---

### 9. `with-structured-output-stream.mjs` — 结构化流式（逐步填充）

`withStructuredOutput` 同样支持 `.stream()`，每个 chunk 是**逐步填充的部分对象**（字段从 `undefined` 到完整值）。最后一个 chunk 就是完整的结构化结果。

```js
const structuredModel = model.withStructuredOutput(schema, {
  method: 'functionCalling',
})

const stream = await structuredModel.stream('详细介绍莫扎特的信息。')

let result = null
for await (const chunk of stream) {
  result = chunk  // 每个 chunk 是当前填充状态的对象
  console.log(JSON.stringify(chunk, null, 2))
}

// result 即最终完整对象
console.log(result.name, result.birth_year)
```

**chunk 示例（逐渐填充）：**

```json
// chunk 1
{ "name": "沃尔夫冈·阿马德乌斯·莫扎特" }

// chunk 2
{ "name": "沃尔夫冈·阿马德乌斯·莫扎特", "birth_year": 1756 }

// 最终 chunk
{ "name": "...", "birth_year": 1756, "death_year": 1791, "nationality": "奥地利", ... }
```

**优点：** 结构化 + 流式两全，字段一到就可用。  
**注意：** 需要 `enable_thinking: false`（同非流式版本）。

---

### 10. `stream-tool-calls-raw.mjs` — 原始 tool_call_chunks

`bindTools` 后直接流式，每个 chunk 包含 `tool_call_chunks`，里面是 JSON 参数的**字符串片段**（需手动拼接）。适合调试和了解底层数据结构。

```js
const modelWithTool = model.bindTools([{ name: 'extract_scientist_info', schema }])
const stream = await modelWithTool.stream('详细介绍牛顿')

for await (const chunk of stream) {
  console.log(chunk)
  // chunk.tool_call_chunks[0].args 是 JSON 字符串的片段
  // 需手动累积后 JSON.parse
}
```

**chunk 结构示例：**

```js
AIMessageChunk {
  tool_call_chunks: [{ index: 0, id: '...', name: 'extract_scientist_info', args: '{"name":"' }]
}
```

**用途：** 调试专用，生产中使用 `stream-tool-calls-parser.mjs`。

---

### 11. `stream-tool-calls-parser.mjs` — JsonOutputToolsParser 流式解析（推荐）

将 `bindTools` 模型通过 `.pipe(JsonOutputToolsParser)` 组成 chain，流式输出**已解析的增量对象**，无需手动拼接 JSON。

```js
import { JsonOutputToolsParser } from '@langchain/core/output_parsers/openai_tools'

const parser = new JsonOutputToolsParser()
const chain = modelWithTool.pipe(parser)

const stream = await chain.stream('详细介绍牛顿')

for await (const chunk of stream) {
  if (chunk.length > 0) {
    console.log(chunk[0])  // { type: 'extract_scientist_info', args: { name: '...', ... } }
  }
}
```

**优点：** 流式 + 自动解析，无需手动处理 JSON 拼接。  
**与 `with-structured-output-stream` 的区别：** 返回的是 `[{ type, args }]` 数组格式，而非直接的对象。

---

## 流式方式对比小结

```
model.stream()                              → 纯文本 chunks，最灵活
model.stream() + 全量拼接 + parser.parse() → 流式显示 + 最终结构化（stream-structured-partial）
structuredModel.stream()                    → 逐步填充的部分对象（with-structured-output-stream）
modelWithTool.stream()                      → 原始 tool_call_chunks 字符串片段（stream-tool-calls-raw）
modelWithTool.pipe(parser).stream()         → 已解析的增量工具调用对象（stream-tool-calls-parser）
```

---

## 综合应用：mini-cursor（流式 Agent）

`test/mini-cursor.mjs` 展示了如何将流式 tool calling 用于真实 Agent 场景：在流式输出过程中实时解析并预览 `write_file` 的内容，同时将完整的 `AIMessageChunk` 拼接后存入消息历史。

**核心模式：**

```js
const rawStream = await modelWithTools.stream(messages)
let fullAIMessage = null
const toolParser = new JsonOutputToolsParser()

for await (const chunk of rawStream) {
  // 1. 累积完整消息（用于存历史）
  fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk

  // 2. 尝试增量解析工具调用（JSON 不完整时捕获异常继续累积）
  let parsedTools = null
  try {
    parsedTools = await toolParser.parseResult([{ message: fullAIMessage }])
  } catch (e) { /* JSON 还不完整，忽略 */ }

  // 3. 流式预览 write_file 内容
  if (parsedTools?.[0]?.type === 'write_file') {
    process.stdout.write(newContent)
  }
}

// 流结束后存入历史，执行工具调用
await history.addMessage(fullAIMessage)
```

**关键技巧：**
- `AIMessageChunk.concat(chunk)` 可安全累积 chunk，得到完整的 `AIMessage`
- `JsonOutputToolsParser` 在 JSON 不完整时会抛异常，用 try/catch 忽略即可
- `printedLengths` Map 记录每个工具调用已输出的长度，避免重复打印

---

## `for await...of`（异步迭代）

本包所有流式文件均使用该方法消费 `model.stream`。语法、场景与注意点见独立说明：[for-await-of.md](./for-await-of.md)。
