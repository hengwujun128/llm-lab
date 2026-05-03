/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-05-03 18:12:39
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-05-03 18:12:52
 * @Description:
 * @FilePath: /llm-lab/packages/runnable-test/src/RunnableLambda.mjs
 */
import 'dotenv/config'
import { RunnableLambda, RunnableSequence } from '@langchain/core/runnables'

const addOne = RunnableLambda.from((input) => {
  console.log(`输入: ${input}`)
  return input + 1
})

const multiplyTwo = RunnableLambda.from((input) => {
  console.log(`输入: ${input}`)
  return input * 2
})

const chain = RunnableSequence.from([addOne, multiplyTwo, addOne])

const result = await chain.invoke(5)
console.log(result)
