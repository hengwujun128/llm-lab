/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-05-03 20:41:11
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-05-03 21:36:58
 * @Description:
 * @FilePath: /llm-lab/packages/runnable-test/src/runnableWithMessageHistory.mjs
 */
import 'dotenv/config'
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history'
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.3,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

// ChatPromptTemplate 构建提示词
const prompt = ChatPromptTemplate.fromMessages([
  ['system', '你是一个简洁、有帮助的中文助手，会用 1-2 句话回答用户问题，重点给出明确、有用的信息。'],
  new MessagesPlaceholder('history'),
  ['human', '{question}'],
])

// 构建链
const simpleChain = prompt.pipe(model).pipe(new StringOutputParser())

// 创建消息历史记录
const messageHistories = new Map()

// 获取消息历史记录
const getMessageHistory = (sessionId) => {
  if (!messageHistories.has(sessionId)) {
    messageHistories.set(sessionId, new InMemoryChatMessageHistory())
  }
  return messageHistories.get(sessionId)
}

// RunnableWithMessageHistory 创建带消息历史的链, 外壳
const chain = new RunnableWithMessageHistory({
  // 给simpleChain加记忆功能, 它本身不知道"历史"是什么，只知道根据 prompt 出答案
  runnable: simpleChain,

  // 获取消息历史记录,外壳每次调用时会传入 sessionId
  getMessageHistory: (sessionId) => getMessageHistory(sessionId),

  // 外壳每次调用时会传入 question, 当invoke({ question: 'xxx' }) 时，外壳会把 question 字段当作"用户这一轮说的话"，调用结束后写进历史里 (addUserMessage)。
  // 必须和你 prompt 里 ['human', '{question}'] 的变量名一致。
  inputMessagesKey: 'question', // 输入消息键, 本轮用户消息从输入哪个字段拿

  // 历史消息要塞进 prompt 的哪个占位符
  // 外壳把读出来的历史消息数组，注入到 prompt 模板里名为 history 的位置
  // 必须和你 prompt 里 new MessagesPlaceholder('history') 的名字一致。
  historyMessagesKey: 'history', // 历史消息键
})

// 测试：第一次对话
console.log('--- 第一次对话（提供信息） ---')
const result1 = await chain.invoke(
  {
    question: '我的名字是 martin，我来自shanghai，我喜欢编程、写作、金铲铲。',
  },
  {
    configurable: {
      sessionId: 'user-123',
    },
  },
)
console.log('问题: 我的名字是martin，我来自shanghai，我喜欢编程、写作、金铲铲。')
console.log('回答:', result1)
console.log()

// 测试：第二次对话
console.log('--- 第二次对话（询问之前的信息） ---')
const result2 = await chain.invoke(
  {
    question: '我刚才说我来自哪里？',
  },
  {
    configurable: {
      sessionId: 'user-123',
    },
  },
)
console.log('问题: 我刚才说我来自哪里？')
console.log('回答:', result2)
console.log()

// 测试：第三次对话
console.log('--- 第三次对话（继续询问） ---')
const result3 = await chain.invoke(
  {
    question: '我的爱好是什么？',
  },
  {
    configurable: {
      sessionId: 'user-123',
    },
  },
)
console.log('问题: 我的爱好是什么？')
console.log('回答:', result3)
console.log()
