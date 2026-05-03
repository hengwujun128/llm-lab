/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-05-03 20:37:52
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-05-03 20:39:20
 * @Description:
 * @FilePath: /llm-lab/packages/runnable-test/src/runablePick.mjs
 */
import 'dotenv/config'
import { RunnablePick, RunnableSequence } from '@langchain/core/runnables'

const inputData = {
  name: 'martin',
  age: 30,
  city: 'shanghai',
  country: 'china',
  email: 'martin@example.com',
  phone: '+86-13800138000',
}

const chain = RunnableSequence.from([
  (input) => ({
    ...input,
    fullInfo: `${input.name}，${input.age}岁，来自${input.city}`,
  }),
  new RunnablePick(['name', 'fullInfo']),
])

const result = await chain.invoke(inputData)
console.log(result)
