/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-04-21 10:47:59
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-04-21 14:50:29
 * @Description: 测试 mcp 服务
 * @FilePath: /tool-test/src/mcp-test.mjs
 */

import 'dotenv/config'

import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { ChatOpenAI } from '@langchain/openai'
import chalk from 'chalk'
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { fileURLToPath } from 'node:url'

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    'my-mcp-server': {
      command: 'node',
      args: [fileURLToPath(new URL('./my-mcp-server.mjs', import.meta.url))],
    },
    'amap-maps-streamableHTTP': {
      url: 'https://mcp.amap.com/mcp?key=' + process.env.AMAP_MAPS_API_KEY,
    },
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem@latest', ...(process.env.ALLOWED_PATHS?.split(',') || '')],
    },

    'chrome-devtools': {
      command: 'npx',
      args: ['-y', 'chrome-devtools-mcp@latest', '--isolated'],
    },
  },
})

const tools = await mcpClient.getTools()
const modelWithTools = model.bindTools(tools)

async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(
      [
        '工具使用约束：',
        '1) filesystem 仅用于本地绝对路径，不可传入 http/https URL。',
        '2) 远程图片 URL 应使用浏览器相关工具（如 new_page）打开，而不是 read_media_file。',
        '3) 任一工具失败后请根据错误信息调整工具选择并继续任务。',
      ].join('\n'),
    ),
    new HumanMessage(query),
  ]

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
      const foundTool = tools.find((t) => t.name === toolCall.name)
      if (foundTool) {
        let contentStr = ''
        try {
          const toolResult = await foundTool.invoke(toolCall.args)
          // 确保 toolResult 是字符串, 如果是 object, 则解析 text 字段
          if (typeof toolResult === 'string') {
            contentStr = toolResult
          } else if (toolResult && toolResult.text) {
            // 如果返回对象有 text 字段，优先使用
            contentStr = toolResult.text
          } else {
            contentStr = JSON.stringify(toolResult)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          // 把工具错误反馈给模型，避免整个流程被异常中断
          contentStr = `工具调用失败：${message}`
        }

        messages.push(
          new ToolMessage({
            content: contentStr,
            tool_call_id: toolCall.id,
          }),
        )
      }
    }
  }

  return messages[messages.length - 1].content
}

// await runAgentWithTools('北京南站附近的酒店，以及去的路线')
// await runAgentWithTools(
//   '惠阳淡水保利阳光城附近的5个酒店，以及从保利阳光城去的路线，路线规划生成文档保存到 /Users/martin/Desktop 的一个 md 文件',
// )
await runAgentWithTools(
  '惠阳淡水保利阳光城附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名',
)

await mcpClient.close()
