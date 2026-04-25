/*
 * @Author: 张泽全 hengwujun128@gmail.com
 * @Date: 2026-04-18 18:54:57
 * @LastEditors: 张泽全 hengwujun128@gmail.com
 * @LastEditTime: 2026-04-21 14:41:18
 * @Description: spawn 卵(鱼,青蛙),产卵
 * @FilePath: /tool-test/src/node-exec.mjs
 */
import { spawn } from 'node:child_process'

// const cmd = 'ls'
// const args = ['-la']

const command = 'echo -e "n\nn" | pnpm create vite vue3-todo-app --template vue-ts'

const [cmd, ...args] = command.split(' ')
const cwd = process.cwd()

const child = spawn(cmd, args, {
  cwd, // 子进程的工作目录
  stdio: 'inherit', // 实时输出到控制台
  shell: true,
})

let errorMsg = ''

child.on('error', (error) => {
  errorMsg = error.message
})

child.on('close', (code) => {
  if (code === 0) {
    process.exit(0)
  } else {
    if (errorMsg) {
      console.error(`错误: ${errorMsg}`)
    }
    process.exit(code || 1)
  }
})
