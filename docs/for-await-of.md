# `for await...of` 异步迭代

## 语法与含义

```js
for await (const item of asyncIterable) {
  // 每次循环：等待「下一个」元素就绪后再进入下一轮
}
```

- **`for...of`**：遍历实现了 `[Symbol.iterator]` 的**同步可迭代**对象，`next()` 同步返回值。
- **`for await...of`**：遍历**异步可迭代**对象（`[Symbol.asyncIterator]`），或遍历同步可迭代时把每个元素当作 `Promise` 去 `await`。

典型用途：数据**分块、分条、分事件**到达时，按顺序消费（LLM 流式 token、文件块、网络流等），避免一次加载全部进内存。

本仓库中与 LangChain 配套的示例：`packages/output-parser-test/src/stream-normal.mjs`（`model.stream` 的返回值）。

---

## 常见使用场景

### 1. LLM 流式输出

模型每生成一小段就推送一块，`for await` 逐块处理，适合打字机效果或边下边解析。

```js
const stream = await model.stream('请用两句话介绍相对论')

for await (const chunk of stream) {
  // LangChain：chunk 多为 AIMessageChunk，文本一般在 chunk.content
  process.stdout.write(chunk.content ?? '')
}
```

### 2. 读取文件流（按块）

大文件不要 `readFile` 一次读入，用可读流按块读取。

```js
import { createReadStream } from 'node:fs'

const stream = createReadStream('large-file.txt', { encoding: 'utf8' })

for await (const chunk of stream) {
  console.log('收到一块:', chunk.length)
}
```

### 3. 按行读取文件

适合日志、CSV 一行一行处理。

```js
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const rl = createInterface({
  input: createReadStream('file.txt', { encoding: 'utf8' }),
  crlfDelay: Infinity,
})

for await (const line of rl) {
  console.log(line)
}
```

### 4. 异步生成器（`async function*`）

自己用 `yield` 产出异步步骤的结果，调用方用 `for await` 消费。

```js
async function* fetchPages(urls) {
  for (const url of urls) {
    const res = await fetch(url)
    yield await res.json()
  }
}

for await (const data of fetchPages(['https://api.example.com/a', 'https://api.example.com/b'])) {
  console.log(data)
}
```

> 注意：多个 URL 在这里是**串行**——前一个 `fetch` 完成后才请求下一个，不是并发。

### 5. HTTP 响应体（ReadableStream）

在 Node 18+ 或浏览器等支持 `fetch` 且 `body` 可异步迭代的环境下，可按块读响应：

```js
const response = await fetch('https://example.com/large.json')

for await (const chunk of response.body) {
  console.log('chunk bytes:', chunk.byteLength)
}
```

---

## 注意事项

### 1. 必须在 `async` 函数内（或 ESM 顶层 `await`）

`for await` 产生隐式 `await`，只能出现在 `async function` 或 ES Module 顶层：

```js
// ❌ 语法错误：普通函数内不能写 for await
function bad() {
  for await (const x of stream) {} // SyntaxError
}

// ✅ async 函数或 .mjs 顶层
async function good() {
  for await (const x of stream) {}
}
```

### 2. 用 `try/catch` 包住：流中途可能抛错

网络断开、对端重置、编码错误都会在迭代过程中抛出：

```js
try {
  for await (const chunk of stream) {
    process.stdout.write(chunk.content ?? '')
  }
} catch (err) {
  console.error('流处理失败:', err)
}
```

### 3. 本质是串行，不是并发

`for await` 每轮只推进**一步**，若要同时发多个请求，应用 `Promise.all`：

```js
// 串行：逐个等待
for await (const data of fetchPages(urls)) {}

// 并发：同时发起
const results = await Promise.all(urls.map(url => fetch(url).then(r => r.json())))
```

对**普通 Promise 数组**写 `for await (const x of [p1, p2, p3])`，规范会按顺序依次 `await`，仍然是串行，不会并发。

### 4. 右侧必须是异步可迭代对象

需实现 `[Symbol.asyncIterator]`，普通 `Promise` 数组**不是**异步可迭代，不能直接 `for await`。

```js
// ❌ 错误用法：数组里放 Promise，不等于异步可迭代
for await (const res of [fetch(url1), fetch(url2)]) {}
```

### 5. 提前 `break` 需注意资源清理

`break` 后规范会调用迭代器的 `return()` 做收尾；**自己写的异步迭代器**若持有文件句柄或 socket，务必在 `return()` 里释放，避免泄漏。

---

## 与 `for...of` 对比

|  | `for...of` | `for await...of` |
|---|---|---|
| 迭代协议 | `[Symbol.iterator]` | `[Symbol.asyncIterator]` |
| `next()` 返回 | 同步值 | `Promise` |
| 典型场景 | 数组、Map、Set 等同步集合 | 流、异步生成器、分块 IO |

---

## 延伸阅读

- [MDN：`for await...of`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/for-await...of)
