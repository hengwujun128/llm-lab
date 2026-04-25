<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

interface Todo {
  id: number
  text: string
  completed: boolean
  createdAt: number
}

const todos = ref<Todo[]>([])
const newTodo = ref('')
const filter = ref<'all' | 'active' | 'completed'>('all')
const editingId = ref<number | null>(null)
const editText = ref('')

// 从 localStorage 加载数据
onMounted(() => {
  const saved = localStorage.getItem('vue3-todos')
  if (saved) {
    try {
      todos.value = JSON.parse(saved)
    } catch (e) {
      todos.value = []
    }
  }
})

// 持久化到 localStorage
watch(todos, (val) => {
  localStorage.setItem('vue3-todos', JSON.stringify(val))
}, { deep: true })

// 筛选后的列表
const filteredTodos = computed(() => {
  switch (filter.value) {
    case 'active':
      return todos.value.filter(t => !t.completed)
    case 'completed':
      return todos.value.filter(t => t.completed)
    default:
      return todos.value
  }
})

// 统计信息
const totalCount = computed(() => todos.value.length)
const activeCount = computed(() => todos.value.filter(t => !t.completed).length)
const completedCount = computed(() => todos.value.filter(t => t.completed).length)

// 添加 todo
function addTodo() {
  const text = newTodo.value.trim()
  if (!text) return
  todos.value.unshift({
    id: Date.now(),
    text,
    completed: false,
    createdAt: Date.now()
  })
  newTodo.value = ''
}

// 删除 todo
function deleteTodo(id: number) {
  todos.value = todos.value.filter(t => t.id !== id)
}

// 切换完成状态
function toggleTodo(id: number) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) {
    todo.completed = !todo.completed
  }
}

// 开始编辑
function startEdit(todo: Todo) {
  editingId.value = todo.id
  editText.value = todo.text
}

// 保存编辑
function saveEdit() {
  if (editingId.value !== null && editText.value.trim()) {
    const todo = todos.value.find(t => t.id === editingId.value)
    if (todo) {
      todo.text = editText.value.trim()
    }
  }
  editingId.value = null
  editText.value = ''
}

// 取消编辑
function cancelEdit() {
  editingId.value = null
  editText.value = ''
}

// 清除已完成
function clearCompleted() {
  todos.value = todos.value.filter(t => !t.completed)
}
</script>

<template>
  <div class="app-container">
    <div class="todo-card">
      <header class="header">
        <h1>✨ Vue3 TodoList</h1>
        <p class="subtitle">高效管理你的每一天</p>
      </header>

      <!-- 添加区域 -->
      <div class="add-section">
        <input
          v-model="newTodo"
          @keyup.enter="addTodo"
          type="text"
          placeholder="添加新任务..."
          class="add-input"
        />
        <button @click="addTodo" class="add-btn">添加</button>
      </div>

      <!-- 筛选标签 -->
      <div class="filter-tabs">
        <button
          v-for="f in ['all', 'active', 'completed']"
          :key="f"
          :class="['filter-btn', { active: filter === f }]"
          @click="filter = f as any"
        >
          {{ f === 'all' ? '全部' : f === 'active' ? '进行中' : '已完成' }}
        </button>
      </div>

      <!-- 统计信息 -->
      <div class="stats">
        <span class="stat-item">📋 总计: <strong>{{ totalCount }}</strong></span>
        <span class="stat-item">⏳ 进行中: <strong>{{ activeCount }}</strong></span>
        <span class="stat-item">✅ 已完成: <strong>{{ completedCount }}</strong></span>
      </div>

      <!-- Todo 列表 -->
      <transition-group name="todo" tag="ul" class="todo-list">
        <li
          v-for="todo in filteredTodos"
          :key="todo.id"
          :class="['todo-item', { completed: todo.completed }]"
        >
          <div class="todo-content">
            <input
              type="checkbox"
              :checked="todo.completed"
              @change="toggleTodo(todo.id)"
              class="todo-checkbox"
            />
            <template v-if="editingId === todo.id">
              <input
                v-model="editText"
                @keyup.enter="saveEdit"
                @keyup.escape="cancelEdit"
                @blur="saveEdit"
                type="text"
                class="edit-input"
                autofocus
              />
            </template>
            <template v-else>
              <span
                class="todo-text"
                @dblclick="startEdit(todo)"
              >{{ todo.text }}</span>
            </template>
          </div>
          <div class="todo-actions">
            <button
              v-if="editingId !== todo.id"
              @click="startEdit(todo)"
              class="action-btn edit-btn"
              title="编辑"
            >✏️</button>
            <button
              @click="deleteTodo(todo.id)"
              class="action-btn delete-btn"
              title="删除"
            >🗑️</button>
          </div>
        </li>
      </transition-group>

      <!-- 空状态 -->
      <div v-if="filteredTodos.length === 0" class="empty-state">
        <p>🎯 {{ filter === 'all' ? '暂无任务，添加一个吧！' : filter === 'active' ? '所有任务都已完成！' : '还没有已完成的任务' }}</p>
      </div>

      <!-- 底部操作 -->
      <div v-if="completedCount > 0" class="footer-actions">
        <button @click="clearCompleted" class="clear-btn">
          清除已完成 ({{ completedCount }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.todo-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 30px;
  width: 100%;
  max-width: 600px;
  backdrop-filter: blur(10px);
}

.header {
  text-align: center;
  margin-bottom: 25px;
}

.header h1 {
  font-size: 2rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #666;
  margin-top: 5px;
  font-size: 0.9rem;
}

/* 添加区域 */
.add-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.add-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.add-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.add-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

/* 筛选标签 */
.filter-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.filter-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.filter-btn:hover {
  border-color: #667eea;
}

.filter-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: transparent;
}

/* 统计信息 */
.stats {
  display: flex;
  justify-content: space-around;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 10px;
  margin-bottom: 20px;
}

.stat-item {
  font-size: 0.85rem;
  color: #555;
}

.stat-item strong {
  color: #667eea;
}

/* Todo 列表 */
.todo-list {
  list-style: none;
  min-height: 100px;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  background: white;
  border: 1px solid #eee;
  border-radius: 10px;
  margin-bottom: 10px;
  transition: all 0.3s ease;
}

.todo-item:hover {
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  transform: translateX(5px);
}

.todo-item.completed {
  background: #f0f0f0;
  opacity: 0.8;
}

.todo-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.todo-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #667eea;
}

.todo-text {
  cursor: pointer;
  transition: all 0.3s ease;
}

.todo-text:hover {
  color: #667eea;
}

.completed .todo-text {
  text-decoration: line-through;
  color: #999;
}

.edit-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #667eea;
  border-radius: 6px;
  font-size: 1rem;
}

.todo-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 5px;
  border-radius: 5px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #f0f0f0;
  transform: scale(1.1);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

/* 底部操作 */
.footer-actions {
  margin-top: 20px;
  text-align: center;
}

.clear-btn {
  padding: 10px 20px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-btn:hover {
  background: #ee5a5a;
  transform: translateY(-2px);
}

/* 过渡动画 */
.todo-enter-active {
  transition: all 0.4s ease;
}

.todo-leave-active {
  transition: all 0.3s ease;
}

.todo-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.todo-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.todo-move {
  transition: transform 0.4s ease;
}
</style>
