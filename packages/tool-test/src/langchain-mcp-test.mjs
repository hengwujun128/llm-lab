/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-04-20 17:26:09
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-04-21 10:31:04
 * @Description:
 * @FilePath: /tool-test/src/langchain-mcp-test.mjs
 */
import 'dotenv/config'
import { fileURLToPath } from 'node:url'

import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { ChatOpenAI } from '@langchain/openai'
import chalk from 'chalk'
import { HumanMessage, ToolMessage } from '@langchain/core/messages'

// 1. 创建模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

// 2. 创建 MCP Client
const mcpClient = new MultiServerMCPClient({
  // 写法和 cursor 中添加 mcp 类似
  mcpServers: {
    'my-mcp-server': {
      command: 'node',
      args: [fileURLToPath(new URL('./my-mcp-server.mjs', import.meta.url))],
    },
  },
})

// 3. 通过 MCP Client 获取工具
const tools = await mcpClient.getTools()

// 4. 绑定工具到模型
const modelWithTools = model.bindTools(tools)

// 5. 执行 Agent
async function runAgentWithTools(query, maxIterations = 30) {
  // step one: 获取用户输入的消息
  const messages = [new HumanMessage(query)]
  // step two: AI 开始思考, 循环调用模型, 直到没有工具调用为止
  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`))
    const response = await modelWithTools.invoke(messages)
    messages.push(response) // 检查是否有工具调用

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`)
      return response.content
    }

    console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`))
    console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(', ')}`)) // 执行工具调用
    for (const toolCall of response.tool_calls) {
      // 要找到当前 agent 的自己的 tools, 而不是其他 agent 的 tools
      const foundTool = tools.find((t) => t.name === toolCall.name)
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args)
        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          }),
        )
      }
    }
  }

  return messages[messages.length - 1].content
}

// await runAgentWithTools('查一下用户 002 的信息')

console.log('===============================================')
const resources = await mcpClient.listResources()
console.log(resources)
console.log('===============================================')
await mcpClient.close()
