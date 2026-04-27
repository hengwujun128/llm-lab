import 'dotenv/config'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { executeCommandTool, listDirectoryTool, readFileTool, writeFileTool } from './all-tools.mjs'
import chalk from 'chalk'

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0, // 不要让 ai 随意发挥
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

// 工具集合, 然后绑定到模型
const tools = [readFileTool, writeFileTool, executeCommandTool, listDirectoryTool]

// 绑定工具到模型
const modelWithTools = model.bindTools(tools)

// Agent 执行函数
async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(`你是一个项目管理助手，使用工具完成任务。

      当前工作目录: ${process.cwd()}

      工具：
      1. read_file: 读取文件
      2. write_file: 写入文件
      3. execute_command: 执行命令（支持 workingDirectory 参数）
      4. list_directory: 列出目录

      重要规则 - execute_command：
      - workingDirectory 参数会自动切换到指定目录
      - 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
      - 错误示例: { command: "cd vue3-todo-app && pnpm install", workingDirectory: "vue3-todo-app" }
      这是错误的！因为 workingDirectory 已经在 vue3-todo-app 目录了，再 cd vue3-todo-app 会找不到目录
      - 正确示例: { command: "pnpm install", workingDirectory: "vue3-todo-app" }
      这样就对了！workingDirectory 已经切换到 vue3-todo-app，直接执行命令即可

      回复要简洁，只说做了什么`),
    new HumanMessage(query),
  ]

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen('⏳ 正在等待 AI 思考...'))

    const response = await modelWithTools.invoke(messages)
    messages.push(response) 
    
    // 检查是否有工具调用
    // 如果没用工具调用, 则返回结果
    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`)
      return response.content
    }

    // 执行工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name)
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args)
        // 把工具调用的结果添加到消息历史中
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

const case1 = `创建一个功能丰富的 Vue TodoList 应用：

1. 创建项目：echo -e "n\nn" | pnpm create vite vue3-todo-app --template vue-ts
2. 修改 src/App.vue，实现完整功能的 TodoList：
 - 添加、删除、编辑、标记完成
 - 分类筛选（全部/进行中/已完成）
 - 统计信息显示
 - localStorage 数据持久化
3. 添加复杂样式：
 - 渐变背景（蓝到紫）
 - 卡片阴影、圆角
 - 悬停效果
4. 添加动画：
 - 添加/删除时的过渡动画
 - 使用 CSS transitions
5. 列出目录确认

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果

之后在 vue3-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run dev 启动服务器
`
try {
  await runAgentWithTools(case1)
} catch (error) {
  console.error(`\n❌ 错误: ${error.message}\n`)
}
