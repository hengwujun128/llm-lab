import 'dotenv/config'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  // 禁用思考模式，否则 tool_choice 和 json_object 均不可用
  modelKwargs: {
    enable_thinking: false,
  },
})

// 定义结构化输出的 schema
const scientistSchema = z.object({
  name: z.string().describe('科学家的全名'),
  birth_year: z.number().describe('出生年份'),
  nationality: z.string().describe('国籍'),
  fields: z.array(z.string()).describe('研究领域列表'),
})

// 使用 withStructuredOutput 方法
const structuredModel = model.withStructuredOutput(scientistSchema, {
  method: 'functionCalling',
})

// 调用模型
const result = await structuredModel.invoke('介绍一下李政道')

console.log('结构化结果:', JSON.stringify(result, null, 2))
console.log(`\n姓名: ${result.name}`)
console.log(`出生年份: ${result.birth_year}`)
console.log(`国籍: ${result.nationality}`)
console.log(`研究领域: ${result.fields.join(', ')}`)
