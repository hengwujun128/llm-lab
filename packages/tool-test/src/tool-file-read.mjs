/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-04-17 16:03:20
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-04-18 14:37:24
 * @Description:
 * @FilePath: /tool-test/src/tool-file-read.mjs
 */

import 'dotenv/config'

import { ChatOpenAI } from '@langchain/openai'
import { tool } from '@langchain/core/tools'
import { HumanMessage, SystemMessage, ToolMessage, AIMessage } from '@langchain/core/messages'
import fs from 'node:fs/promises'
import { z } from 'zod'

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME || 'qwen-coder-turbo',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0, // 温度，也就是 ai 的创造性，设置为 0，让它严格按照指令来做事情，不要自己发挥
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

// 定义tool
const readFileTool = tool(
  // 1. 函数
  async ({ filePath }) => {
    const content = await fs.readFile(filePath, 'utf-8')
    console.log(`  [工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`)
    return `文件内容:\n${content}`
  },
  // 2. 名称,描述, 参数格式: 因为是给大模型用的, 所以需要描述这个工具是干什么用的
  {
    name: 'read_file',
    description:
      '用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。',
    schema: z.object({
      // 用 zod 包来定义参数格式,就是传入一个 object
      filePath: z.string().describe('要读取的文件路径'),
    }),
  },
)

const tools = [readFileTool]

const modelWithTools = model.bindTools(tools)

const messages = [
  // 1. 系统消息: 告诉大模型你是谁, 做什么的
  new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。

  工作流程：
  1. 用户要求读取文件时，立即调用 read_file 工具
  2. 等待工具返回文件内容
  3. 基于文件内容进行分析和解释

  可用工具：
  - read_file: 读取文件内容（使用此工具来获取文件内容）
  `),
  // 2. 用户消息: 用户的问题,用户输入的消息
  new HumanMessage('请读取 src/tool-file-read.mjs 文件内容并解释代码'),
  // 3. 工具消息: 工具返回的结果: 调用工具并返回结果
  // new ToolMessage(readFileTool.invoke({ filePath: 'src/tool-file-read.mjs' })),
  // 4. 回答消息: 大模型的回答
  // new AIMessage('文件内容: \n' + readFileTool.invoke({ filePath: 'src/tool-file-read.mjs' })),
]

let response = await modelWithTools.invoke(messages)
// console.log(response)
// console.log('===============================================')

// console.log(response.tool_calls)
// console.log('===============================================')
// 把 ai 返回的信息放到messages 中, 也就是对话记录
messages.push(response)

while (response.tool_calls && response.tool_calls.length > 0) {
  console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`)

  // 执行所有工具调用
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const tool = tools.find((t) => t.name === toolCall.name)
      if (!tool) {
        return `错误: 找不到工具 ${toolCall.name}`
      }

      console.log(`  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`)
      try {
        const result = await tool.invoke(toolCall.args)
        return result
      } catch (error) {
        return `错误: ${error.message}`
      }
    }),
  )

  // 将工具结果添加到消息历史
  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index],
        tool_call_id: toolCall.id,
      }),
    )
  })

  // 再次调用模型，传入工具结果
  response = await modelWithTools.invoke(messages)
}

console.log('\n[最终回复]')
console.log(response.content)
