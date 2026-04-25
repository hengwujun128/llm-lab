import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'

// dotenv 的作用就是读取 .env 文件，设置到环境变量里
dotenv.config({ path: '.env', debug: true })

// 初始化模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME || '',
  apiKey: process.env.OPENAI_API_KEY || '',
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL || '',
  },
})

// 调用模型
const response = await model.invoke('介绍下自己, 名字叫什么? 哪个版本?')
console.log(response.content)
