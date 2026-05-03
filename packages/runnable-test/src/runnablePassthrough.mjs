/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-05-03 19:04:19
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-05-03 19:29:00
 * @Description:
 * @FilePath: /llm-lab/packages/runnable-test/src/runnablePassthrough.mjs
 */
import 'dotenv/config'
import { RunnablePassthrough, RunnableLambda, RunnableSequence, RunnableMap } from '@langchain/core/runnables'

// const chain = RunnableSequence.from([
//   // 自定义 RunnableLambda, 将输入转换为对象
//   RunnableLambda.from((input) => ({ concept: input })),
//   // 使用 RunnableMap 并行执行多个 Runnable
//   RunnableMap.from({
//     // original 用 RunnablePassthrough 拿到原始值
//     original: new RunnablePassthrough(),

//     // processed 用 RunnableLambda 将对象转换为大写和长度
//     processed: RunnableLambda.from((obj) => ({
//       concept: input,
//       upper: obj.concept.toUpperCase(),
//       length: obj.concept.length,
//     })),
//   }),
// ])

const chain = RunnableSequence.from([
  // 自定义 RunnableLambda, 将输入转换为对象
  (input) => ({ concept: input }),
  {
    // original 用 RunnablePassthrough 拿到原始值
    original: new RunnablePassthrough(),

    // processed 用 RunnableLambda 将对象转换为大写和长度
    processed: (obj) => ({
      concept: input,
      upper: obj.concept.toUpperCase(),
      length: obj.concept.length,
    }),
  },
])

const input = '神说要有光'
const result = await chain.invoke(input)
console.log(result)
