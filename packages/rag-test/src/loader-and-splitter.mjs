/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-04-22 15:29:46
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-04-23 11:25:33
 * @Description: 使用CheerioWebBaseLoader 来加载一个网页,并使用默认的 splitter 进行分割
 * @FilePath: /rag-test/src/loader-and-splitter.mjs
 */
import 'dotenv/config'
import 'cheerio'
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

const cheerioLoader = new CheerioWebBaseLoader('https://juejin.cn/post/7233327509919547452', {
  // 选择器，选择文章的段落
  selector: '.main-area p',
})

const documents = await cheerioLoader.load()

// console.log(documents)

// documents 太大了, 需要进行分割
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 400, // 每个chunk的大小
  chunkOverlap: 50, // 每个chunk的overlap大小, 分块的时候需要重叠部分
  //
  separators: ['\n\n', '\n', '。', '，', '！', '？', '；', '：', '、', '。', '，', '！', '？', '；', '：', '、'], // 分隔符
})

const chunks = await splitter.splitDocuments(documents)

console.log(chunks)
