import { defineStore } from 'pinia'
import { load, save, uid, todayStr, nowStr, saveTextToFile, isFileStorageActive, migrateToFileStorage, writeSnapshotBackup, readBackupFile } from '../utils/storage'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
dayjs.extend(isoWeek)

// 版本号比较：返回 -1 / 0 / 1，用于更新记录��序排序
// 支持 build 后缀�?5.0.199+build2"�?5.0.199build2" �?主版本相同则比较 build 序号
function compareVersions(a, b) {
  const parse = (s) => {
    const str = String(s)
    const m = str.match(/^(\d+(?:\.\d+)*)(?:[+]?(build\d*)?)?$/i)
    if (!m) return { nums: [], build: 0 }
    const main = m[1] || ''
    const nums = main.split('.').map(n => parseInt(n, 10) || 0)
    const bld = (m[2] || '').replace(/build/i, '')
    return { nums, build: bld === '' ? 0 : (parseInt(bld, 10) || 0) }
  }
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.nums.length, pb.nums.length)
  for (let i = 0; i < len; i++) {
    const va = pa.nums[i] || 0
    const vb = pb.nums[i] || 0
    if (va !== vb) return va - vb
  }
  if (pa.build !== pb.build) return pa.build - pb.build
  return 0
}

// 更新提醒延迟结算：一次同步调用批次（�?onMounted 版本播种循环）中只推送最高版本，
// 避免历史版本补种/数据恢复后消息中心一次��涌入几十条历史更新推��?
let _pendingNotifyVersion = null
let _pendingNotifyTimer = null
function scheduleUpdateNotify(version) {
  if (!_pendingNotifyVersion || compareVersions(version, _pendingNotifyVersion) > 0) {
    _pendingNotifyVersion = version
  }
  if (_pendingNotifyTimer) return
  _pendingNotifyTimer = setTimeout(() => {
    _pendingNotifyTimer = null
    const v = _pendingNotifyVersion
    _pendingNotifyVersion = null
    if (!v) return
    try {
      // 朢�终防线：结算时若 changelog 中已存在更高版本，则丢弃本次推��，
      // 确保任何时序/异常场景下都绝不可能推��非朢�新版本的更新消息
      const settings = useSettingsStore()
      if (settings.changelog.length > 0 && compareVersions(settings.changelog[0].version, v) > 0) {
        console.warn('[updateNotify] 丢弃非最新版本推送:', v, '当前最新:', settings.changelog[0].version)
        return
      }
      useMessageStore().addMessage({
        id: 'update-' + v,
        title: '平台更新 ' + v,
        content: '平台已更新至 ' + v + '，点击右侧按钮查看更新日志',
        type: 'info',
        action: 'viewChangelog',
      })
    } catch (e) {}
  }, 0)
}

// 数据模块中文名映射（用于导入结果弹窗 / 版本回滚展示�?
const MODULE_NAMES = {
  plans: '计划', reviews: '复盘', planNextSeq: '计划编号',
  paperLibrary: '文献', paperLibraryStatuses: '文献状态', paperLibraryColumns: '文献列设置',
  paperLibraryFormFields: '文献表单', paperLibraryCustomFields: '文献自定义字段',
  paperLibrarySortOrder: '文献排序', paperLibrarySortField: '文献排序字段',
  paperLibrarySortDirection: '文献排序方向', paperLibraryNextSeq: '文献编号',
  simulations: '仿真', simNextSeq: '仿真编号', simCustomSoftware: '自定义软件',
  tasks: '任务', papers: '论文', meetingNotes: '组会纪要', researchStages: '培养节点',
  researchUrls: '科研网址', points: '积分', pointRecords: '积分记录', logs: '操作日志',
  messages: '消息', notes: '论文笔记', profile: '个人信息', config: '系统配置',
  paperReadings: '论文阅读', paperReadingsNextSeq: '论文阅读编号', paperReadingsColumns: '论文阅读列设置',
  paperReadingsCustomFields: '论文阅读自定义字段', paperReadingsSortDirection: '论文阅读排序方向',
  paperReadingsSortField: '论文阅读排序字段',
  avatarImage: '头像', backgroundImage: '背景图', theme: '主题配色', navOrder: '导航顺序',
  subscriptions: '订阅', subscriptionRecords: '订阅记录',
  appVersion: '版本号', changelog: '更新记录', customDate: '自定义日期', customWeek: '自定义周数',
  planStatuses: '计划状态', planCategories: '计划分类', planLevels: '计划层级', planPriorities: '计划优先级',
  subtaskColors: '子任务颜色', taskCategories: '任务分类', taskPriorities: '任务优先级', taskStates: '打卡状态',
  academicProgress: '学业进度', academicBreakdown: '学业构成', academicLastModified: '学业进度时间',
  planOverview: '总览配置', morningPopupShown: '早安弹窗', sidebarPinned: '侧栏固定',
  pdfOpener: 'PDF 打开方式', pdfOpenerPath: 'PDF 软件路径', settingsModuleOrder: '设置模块顺序',
  easyscholarKey: 'easyScholar 密钥', authLoggedIn: '登录态', authUsername: '用户名', authLoginAt: '登录时间',
  rollbackHistory: '回滚快照', customMeetingFields: '组会字段',
  financeEntries: '财务', financeNextSeq: '财务编号', financeCategories: '财务分类',
  financeSortOrder: '财务排序', financeSortDirection: '财务排序方向',
  financeMonthlyBudget: '月度预算', financeCurrency: '货币符号',
  infoSubscriptions: '信息�?软件订阅', infoSubNextSeq: '信息�?订阅编号',
  infoGroupbuys: '信息�?团购', infoGroupNextSeq: '信息�?团购编号',
  infoAssets: '信息�?资产', infoAssetNextSeq: '信息�?资产编号',
  infoCards: '信息�?卡证', infoCardNextSeq: '信息�?卡证编号',
  infoPlans: '信息�?手机套餐', infoPlanNextSeq: '信息�?套餐编号',
}
function moduleNameOf(key) {
  return MODULE_NAMES[key] || key
}

// ============================================================
// 积分系统
// ============================================================
export const usePointsStore = defineStore('points', {
  state: () => ({
    totalPoints: load('totalPoints', 0),
    transactions: load('transactions', []),
    dailyBet: load('dailyBet', null), // { date, taskId, amount, status: 'pending'|'won'|'lost' }
    consumedItems: load('consumedItems', []), // 积分消费记录
  }),
  getters: {
    todayPoints() {
      const today = todayStr()
      return this.transactions
        .filter(t => t.date === today && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0)
    },
    weekPoints() {
      const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')
      return this.transactions
        .filter(t => t.date >= weekStart && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0)
    },
    level() {
      const pts = this.totalPoints
      if (pts >= 10000) return { name: '大佬', level: 5, min: 10000, max: Infinity, color: '#7C3AED' }
      if (pts >= 5000) return { name: '大牛', level: 4, min: 5000, max: 10000, color: '#DC2626' }
      if (pts >= 2000) return { name: '骨干', level: 3, min: 2000, max: 5000, color: '#2563EB' }
      if (pts >= 500) return { name: '熟手', level: 2, min: 500, max: 2000, color: '#059669' }
      return { name: '起步', level: 1, min: 0, max: 500, color: '#6B7280' }
    },
    levelProgress() {
      const lv = this.level
      if (lv.max === Infinity) return 100
      const range = lv.max - lv.min
      const current = this.totalPoints - lv.min
      return Math.min(100, Math.round((current / range) * 100))
    },
    pointsToNextLevel() {
      const lv = this.level
      if (lv.max === Infinity) return 0
      return lv.max - this.totalPoints
    },
    todayBet() {
      if (this.dailyBet && this.dailyBet.date === todayStr()) return this.dailyBet
      return null
    },
  },
  actions: {
    addPoints(amount, reason, category = 'earn') {
      this.totalPoints += amount
      this.transactions.unshift({
        id: uid(),
        date: todayStr(),
        time: nowStr(),
        amount,
        reason,
        category,
        balance: this.totalPoints,
      })
      save('totalPoints', this.totalPoints)
      save('transactions', this.transactions)
    },
    spendPoints(amount, reason) {
      if (this.totalPoints < amount) return false
      this.totalPoints -= amount
      this.transactions.unshift({
        id: uid(),
        date: todayStr(),
        time: nowStr(),
        amount: -amount,
        reason,
        category: 'spend',
        balance: this.totalPoints,
      })
      this.consumedItems.unshift({ id: uid(), date: todayStr(), amount, reason })
      save('totalPoints', this.totalPoints)
      save('transactions', this.transactions)
      save('consumedItems', this.consumedItems)
      return true
    },
    placeBet(taskId, amount = 50) {
      this.dailyBet = { date: todayStr(), taskId, amount, status: 'pending' }
      save('dailyBet', this.dailyBet)
    },
    settleBet(won) {
      if (!this.dailyBet || this.dailyBet.date !== todayStr()) return
      if (this.dailyBet.status !== 'pending') return
      if (won) {
        this.addPoints(this.dailyBet.amount, `押注成功返还（翻倍）`, 'bet')
        this.dailyBet.status = 'won'
      } else {
        this.totalPoints -= this.dailyBet.amount
        this.transactions.unshift({
          id: uid(),
          date: todayStr(),
          time: nowStr(),
          amount: -this.dailyBet.amount,
          reason: '押注失败扣除',
          category: 'bet',
          balance: this.totalPoints,
        })
        this.dailyBet.status = 'lost'
        save('totalPoints', this.totalPoints)
        save('transactions', this.transactions)
      }
      save('dailyBet', this.dailyBet)
    },
  },
})

// ============================================================
// 任务管理
// ============================================================
const TASK_CATEGORIES = [
  { id: 'core_research', name: '核心科研', color: '#5B5FEF' },
  { id: 'literature', name: '文献阅读', color: '#3B82F6' },
  { id: 'writing', name: '论文写作', color: '#8B5CF6' },
  { id: 'skill', name: '技能学习', color: '#059669' },
  { id: 'daily', name: '日常事务', color: '#6B7280' },
  { id: 'mentor', name: '导师项目', color: '#F59E0B' },
]

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: load('tasks', []),
    categories: load('taskCategories', TASK_CATEGORIES),
  }),
  getters: {
    todayTasks() {
      const today = todayStr()
      return this.tasks
        .filter(t => t.date === today || (!t.date && !t.completed))
        .sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority
          return 0
        })
    },
    pendingTasks() {
      return this.tasks.filter(t => !t.completed)
    },
    completedToday() {
      const today = todayStr()
      return this.tasks.filter(t => t.completed && t.completedDate === today)
    },
    tasksByDate() {
      return (date) => this.tasks.filter(t => t.date === date)
    },
  },
  actions: {
    addTask(task) {
      this.tasks.unshift({
        id: uid(),
        title: task.title,
        description: task.description || '',
        category: task.category || 'daily',
        priority: task.priority || 1, // 3=high, 2=medium, 1=low
        date: task.date || todayStr(),
        deadline: task.deadline || null,
        progress: 0,
        completed: false,
        completedDate: null,
        createdAt: nowStr(),
      })
      save('tasks', this.tasks)
      useLogStore().addLog(`添加任务：��?{task.title}》`)
    },
    updateTask(id, updates) {
      const task = this.tasks.find(t => t.id === id)
      if (task) {
        Object.assign(task, updates)
        save('tasks', this.tasks)
        useLogStore().addLog(`更新任务：��?{task.title}》`)
      }
    },
    completeTask(id) {
      const task = this.tasks.find(t => t.id === id)
      if (task && !task.completed) {
        task.completed = true
        task.completedDate = todayStr()
        task.progress = 100
        save('tasks', this.tasks)
        useLogStore().addLog(`完成任务：��?{task.title}》`)
      }
    },
    uncompleteTask(id) {
      const task = this.tasks.find(t => t.id === id)
      if (task && task.completed) {
        task.completed = false
        task.completedDate = null
        save('tasks', this.tasks)
      }
    },
    deleteTask(id) {
      const task = this.tasks.find(t => t.id === id)
      const title = task?.title || id
      this.tasks = this.tasks.filter(t => t.id !== id)
      save('tasks', this.tasks)
      useLogStore().addLog(`删除任务：��?{title}》`)
    },
    setProgress(id, progress) {
      const task = this.tasks.find(t => t.id === id)
      if (task) {
        task.progress = Math.max(0, Math.min(100, progress))
        if (task.progress === 100 && !task.completed) {
          this.completeTask(id)
        }
        save('tasks', this.tasks)
      }
    },
  },
})

// ============================================================
// 论文管理
// ============================================================
const DEFAULT_PAPER_STATUSES = [
  { id: 'idea', name: '想法', color: '#A855F7', order: 0 },
  { id: 'draft', name: '草稿', color: '#0EA5E9', order: 1 },
  { id: 'revising', name: '修改中', color: '#F97316', order: 2 },
  { id: 'submitted', name: '已投', color: '#2563EB', order: 3 },
  { id: 'revision', name: '返修', color: '#EC4899', order: 4 },
  { id: 'proof', name: '校样', color: '#06B6D4', order: 5 },
  { id: 'published', name: '发表', color: '#22C55E', order: 6 },
]

export const usePapersStore = defineStore('papers', {
  state: () => {
    const papers = load('papers', [])
    // 迁移：确保每篇论文存�?statusDates（按状��记录日期），兼容旧数据
    for (const p of papers) {
      if (!p.statusDates) p.statusDates = {}
      if (Array.isArray(p.statusHistory) && p.statusHistory.length) {
        for (const h of p.statusHistory) {
          if (h.status && !p.statusDates[h.status]) p.statusDates[h.status] = h.date
        }
      }
      if (!p.statusDates[p.status] && p.deadline) p.statusDates[p.status] = p.deadline
    }
    return { papers, statuses: load('paperStatuses', [...DEFAULT_PAPER_STATUSES]) }
  },
  getters: {
    activePapers() {
      return this.papers.filter(p => p.status !== 'published')
    },
    paperStatusSummary() {
      const summary = {}
      for (const s of this.statuses) {
        summary[s.id] = { name: s.name, color: s.color, count: 0 }
      }
      for (const p of this.papers) {
        if (summary[p.status]) summary[p.status].count++
      }
      return summary
    },
  },
  actions: {
    addPaper(paper) {
      const status = paper.status || 'idea'
      const statusDates = { ...(paper.statusDates || {}) }
      statusDates[status] = paper.statusDate || todayStr()
      this.papers.unshift({
        id: uid(),
        title: paper.title,
        journal: paper.journal || '',
        doi: paper.doi || '',
        submitId: paper.submitId || '',
        status,
        deadline: paper.deadline || null,
        topic: paper.topic || '',
        createdAt: nowStr(),
        statusDates,
        statusHistory: [{ status, date: statusDates[status], time: nowStr() }],
      })
      save('papers', this.papers)
      useLogStore().addLog(`添加论文：��?{paper.title}》`)
    },
    updatePaper(id, updates) {
      const paper = this.papers.find(p => p.id === id)
      if (paper) {
        if (!paper.statusDates) paper.statusDates = {}
        const statusChanged = updates.status && updates.status !== paper.status
        // 状��日期：切换状��或显式传入日期时，写入对应状��的日期
        if (updates.statusDate !== undefined || statusChanged) {
          const target = updates.status || paper.status
          const d = updates.statusDate || todayStr()
          paper.statusDates[target] = d
          updates.statusDates = { ...paper.statusDates }
        }
        if (statusChanged) {
          paper.statusHistory.push({ status: updates.status, date: paper.statusDates[updates.status] || todayStr(), time: nowStr() })
        }
        Object.assign(paper, updates)
        save('papers', this.papers)
        useLogStore().addLog(`更新论文：��?{paper.title}》`)
      }
    },
    deletePaper(id) {
      const paper = this.papers.find(p => p.id === id)
      const title = paper?.title || id
      this.papers = this.papers.filter(p => p.id !== id)
      save('papers', this.papers)
      useLogStore().addLog(`删除论文：��?{title}》`)
    },
    updateStatuses(statuses) {
      this.statuses = statuses
      save('paperStatuses', this.statuses)
      useLogStore().addLog('更新论文状态配置')
    },
  },
})

// ============================================================
// 论文库（文献阅读管理�?// ============================================================
const DEFAULT_PAPER_LIBRARY_STATUSES = [
  { id: 'pending', name: '待整理', color: '#F59E0B', order: 0 },
  { id: 'reading', name: '正在阅读', color: '#3B82F6', order: 1 },
  { id: 'read', name: '已阅读', color: '#10B981', order: 2 },
]

// 添加文献弹窗可用字段定义
const ALL_PAPER_FORM_FIELDS = [
  { key: 'title', label: '论文题目', type: 'text', required: true, fixed: true },
  { key: 'authors', label: '作者', type: 'text', required: false },
  { key: 'year', label: '年份', type: 'text', groupWith: 'journal', required: false },
  { key: 'journal', label: '期刊名称', type: 'journal-if', groupWith: 'year', required: false },
  { key: 'unit', label: '单位', type: 'text', groupWith: 'impact', required: false },
  { key: 'impact', label: '影响', type: 'text', groupWith: 'unit', required: false },
  { key: 'doi', label: 'DOI', type: 'doi', required: false },
  { key: 'tags', label: '研究主题标签', type: 'tags', required: false },
  { key: 'mainContent', label: '主要内容', type: 'textarea', required: false },
  { key: 'innovation', label: '可借鉴创新点', type: 'textarea', required: false },
  { key: 'status', label: '状态', type: 'status', required: false },
]

// 表格全部可��列
const ALL_TABLE_COLUMNS = [
  { key: 'status', label: '状态' },
  { key: 'title', label: '论文题目' },
  { key: 'authors', label: '作者' },
  { key: 'year', label: '年份' },
  { key: 'journal', label: '期刊' },
  { key: 'unit', label: '单位' },
  { key: 'impact', label: '影响' },
  { key: 'mainContent', label: '主要内容' },
  { key: 'innovation', label: '创新点' },
  { key: 'tags', label: '标签' },
]

export const usePaperLibraryStore = defineStore('paperLibrary', {
  state: () => ({
    papers: load('paperLibrary', []),
    statuses: load('paperLibraryStatuses', [...DEFAULT_PAPER_LIBRARY_STATUSES]),
    visibleColumns: load('paperLibraryColumns', ['status', 'title', 'authors', 'year', 'journal', 'unit', 'impact', 'mainContent', 'innovation', 'tags']),
    formFields: load('paperLibraryFormFields', ALL_PAPER_FORM_FIELDS.map(f => ({ ...f, enabled: true }))),
    customFields: load('paperLibraryCustomFields', []),   // 用户自定义字段，如"页数"
    sortOrder: load('paperLibrarySortOrder', 'created'),  // 'created' | 'alpha' | 'custom'
    sortField: load('paperLibrarySortField', 'title'),    // 排序字段
    sortDirection: load('paperLibrarySortDirection', 'desc'), // 'asc' | 'desc'
    nextSeq: load('paperLibraryNextSeq', 1),              // 固定编号计数器
    tagColors: load('paperLibraryTagColors', {}),         // 标签自定义颜色 { tagName: '#hexcolor' }
    tagOrder: load('paperLibraryTagOrder', []),           // 标签自定义顺序（在设置中调整）
  }),
  getters: {
    statusSummary() {
      const summary = {}
      for (const s of this.statuses) {
        summary[s.id] = { ...s, count: 0, papers: [] }
      }
      for (const p of this.papers) {
        if (summary[p.status]) {
          summary[p.status].count++
          summary[p.status].papers.push(p)
        }
      }
      return summary
    },
    sortedStatuses() {
      return [...this.statuses].sort((a, b) => a.order - b.order)
    },
    sortedPapers() {
      let papers = [...this.papers]
      const dir = this.sortDirection === 'asc' ? 1 : -1
      // 按排序方�?
      if ( this.sortOrder === 'alpha') {
        papers.sort((a, b) => {
          const field = this.sortField || 'title'
          const va = (a[field] || '').toString().toLowerCase()
          const vb = (b[field] || '').toString().toLowerCase()
          return dir * va.localeCompare(vb, 'zh-CN')
        })
      } else if (this.sortOrder === 'custom') {
        // 按自定义顺序（��过 paper.order 字段�?
        papers.sort((a, b) => dir * ((a.order ?? 9999) - (b.order ?? 9999)))
      } else {
        // 默认按创建时�?
        papers.sort((a, b) => dir * (a.createdAt || '').localeCompare(b.createdAt || ''))
      }
      return papers
    },
    formFieldsWithCustom() {
      // 合并系统字段和用户自定义字段
      const sys = this.formFields.map(f => ({ ...f, custom: false }))
      const custom = (this.customFields || []).map(f => ({ ...f, type: f.type || 'text', custom: true }))
      return [...sys, ...custom]
    },
  },
  actions: {
    allTags() {
      const tags = new Set()
      this.papers.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) p.tags.forEach(t => tags.add(t))
      })
      const order = this.tagOrder || []
      const ordered = order.filter(t => tags.has(t))
      const rest = [...tags].filter(t => !order.includes(t)).sort((a, b) => a.localeCompare(b, 'zh-CN'))
      return [...ordered, ...rest]
    },
    moveTag(tag, dir) {
      const order = [...(this.tagOrder || [])]
      const idx = order.indexOf(tag)
      if (idx < 0) order.push(tag)
      const list = [...new Set(order.filter(t => t !== tag))]
      const pos = Math.min(Math.max(idx < 0 ? list.length : idx + dir, 0), list.length)
      list.splice(pos, 0, tag)
      this.tagOrder = list
      save('paperLibraryTagOrder', list)
    },
    allJournals() {
      const journals = new Set()
      this.papers.forEach(p => { if (p.journal) journals.add(p.journal) })
      return [...journals].sort()
    },
    allYears() {
      const years = new Set()
      this.papers.forEach(p => { if (p.year) years.add(String(p.year)) })
      return [...years].sort((a, b) => b - a)
    },
    addPaper(paper) {
      const seq = this.nextSeq
      this.nextSeq = seq + 1
      save('paperLibraryNextSeq', this.nextSeq)
      this.papers.unshift({
        id: uid(),
        seq,
        title: paper.title || '',
        year: paper.year || '',
        unit: paper.unit || '',
        journal: paper.journal || '',
        impact: paper.impact || '',
        mainContent: paper.mainContent || '',
        innovation: paper.innovation || '',
        status: paper.status || 'pending',
        authors: paper.authors || '',
        doi: paper.doi || '',
        tags: paper.tags || [],
        readingStartedAt: paper.status === 'reading' ? nowStr() : '',
        readingLevel: paper.readingLevel || 'skim',
        coreConclusion: paper.coreConclusion || '',
        personalInsight: paper.personalInsight || '',
        followUpAction: paper.followUpAction || '',
        pdfFileName: paper.pdfFileName || '',
        createdAt: nowStr(),
      })
      save('paperLibrary', this.papers)
      useLogStore().addLog(`添加文献：��?{paper.title}》`)
    },
    updatePaper(id, updates) {
      const paper = this.papers.find(p => p.id === id)
      if (paper) {
        // 阅读计时：状态切到��正在阅读��记录开始时间；离开该状态清除计�?
        if (updates.status && updates.status !== paper.status) {
          if (updates.status === 'reading') {
            if (!paper.readingStartedAt) paper.readingStartedAt = nowStr()
          } else if (paper.status === 'reading') {
            paper.readingStartedAt = ''
          }
        }
        Object.assign(paper, updates)
        save('paperLibrary', this.papers)
        useLogStore().addLog(`更新文献：��?{paper.title}》`)
      }
    },
    deletePaper(id) {
      const paper = this.papers.find(p => p.id === id)
      const title = paper?.title || id
      this.papers = this.papers.filter(p => p.id !== id)
      save('paperLibrary', this.papers)
      useLogStore().addLog(`删除文献：��?{title}》`)
    },
    addStatus(status) {
      const newStatus = {
        id: 'status_' + uid().slice(0, 8),
      name: status.name || '新状态',
        color: status.color || '#6B7280',
        order: this.statuses.length,
      }
      this.statuses.push(newStatus)
      save('paperLibraryStatuses', this.statuses)
      return newStatus
    },
    updateStatus(id, updates) {
      const s = this.statuses.find(x => x.id === id)
      if (s) {
        Object.assign(s, updates)
        save('paperLibraryStatuses', this.statuses)
      }
    },
    deleteStatus(id) {
      const hasPapers = this.papers.some(p => p.status === id)
      if (hasPapers) {
        // 将使用该状��的文献移到第一个状�?
        const fallback = this.statuses[0]?.id || 'pending'
        this.papers.forEach(p => { if (p.status === id) p.status = fallback })
        save('paperLibrary', this.papers)
      }
      this.statuses = this.statuses.filter(s => s.id !== id)
      // 重新计算 order
      this.statuses.forEach((s, i) => { s.order = i })
      save('paperLibraryStatuses', this.statuses)
    },
    reorderStatuses(fromIndex, toIndex) {
      const list = [...this.statuses]
      if (fromIndex < 0 || fromIndex >= list.length) return
      if (toIndex < 0 || toIndex >= list.length) return
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      list.forEach((s, i) => { s.order = i })
      this.statuses = list
      save('paperLibraryStatuses', this.statuses)
    },
    setVisibleColumns(columns) {
      this.visibleColumns = columns
      save('paperLibraryColumns', columns)
    },
    setFormFields(fields) {
      this.formFields = fields
      save('paperLibraryFormFields', fields)
    },
    addCustomField(field) {
      const newField = {
        key: 'custom_' + uid().slice(0, 8),
      label: field.label || '新字段',
        type: field.type || 'text',
        required: false,
        enabled: true,
      }
      this.customFields.push(newField)
      // 自动添加到可见列
      if (!this.visibleColumns.includes(newField.key)) {
        this.visibleColumns = [...this.visibleColumns, newField.key]
        save('paperLibraryColumns', this.visibleColumns)
      }
      save('paperLibraryCustomFields', this.customFields)
      return newField
    },
    updateCustomField(key, updates) {
      const f = this.customFields.find(cf => cf.key === key)
      if (f) { Object.assign(f, updates); save('paperLibraryCustomFields', this.customFields) }
    },
    deleteCustomField(key) {
      this.customFields = this.customFields.filter(cf => cf.key !== key)
      // 同时从可见列中移�?
      this.visibleColumns = this.visibleColumns.filter(c => c !== key)
      save('paperLibraryColumns', this.visibleColumns)
      save('paperLibraryCustomFields', this.customFields)
    },
    updateCustomFieldsOrder(fields) {
      this.customFields = fields
      save('paperLibraryCustomFields', this.customFields)
    },
    setSortOrder(order, field) {
      this.sortOrder = order
      if (field) this.sortField = field
      save('paperLibrarySortOrder', order)
      save('paperLibrarySortField', this.sortField)
    },
    setSortDirection(dir) {
      this.sortDirection = dir
      save('paperLibrarySortDirection', dir)
    },
    setTagColor(tag, color) {
      if (!tag) return
      if (color) {
        this.tagColors[tag] = color
      } else {
        delete this.tagColors[tag]
      }
      save('paperLibraryTagColors', this.tagColors)
    },
    getTagColor(tag) {
      return this.tagColors[tag] || ''
    },
    deleteTag(tag) {
      if (!tag) return
      this.papers.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) {
          p.tags = p.tags.filter(t => t !== tag)
        }
      })
      if (this.tagColors[tag]) delete this.tagColors[tag]
      save('paperLibrary', this.papers)
      save('paperLibraryTagColors', this.tagColors)
    },
    reorderPaper(paperId, toIndex) {
      const papers = [...this.papers]
      const fromIdx = papers.findIndex(p => p.id === paperId)
      if (fromIdx < 0) return
      const [moved] = papers.splice(fromIdx, 1)
      papers.splice(toIndex, 0, moved)
      papers.forEach((p, i) => { p.order = i })
      this.papers = papers
      save('paperLibrary', this.papers)
    },
  },
})

// ============================================================
// 计时器
// ============================================================
export const useTimerStore = defineStore('timer', {
  state: () => ({
    mode: load('timerMode', 'pomodoro'), // pomodoro | stopwatch | countdown
    isRunning: false,
    elapsed: 0, // 秒
    remaining: 25 * 60, // 倒计时剩余秒
    pomodoroDuration: load('pomodoroDuration', 25), // 分钟
    breakDuration: load('breakDuration', 5),
    isBreak: false,
    todayFocusSeconds: load('todayFocusSeconds', 0),
    todayFocusDate: load('todayFocusDate', todayStr()),
    weekFocusSeconds: load('weekFocusSeconds', 0),
    weekFocusWeek: load('weekFocusWeek', dayjs().format('YYYY-WW')),
    streakDays: load('streakDays', 0),
    lastFocusDate: load('lastFocusDate', null),
    intervalId: null,
    lastTickAt: 0, // 最近一次 tick 时间戳，用于后台冻结后时间补偿
  }),
  getters: {
    todayFocusDisplay() {
      const h = Math.floor(this.todayFocusSeconds / 3600)
      const m = Math.floor((this.todayFocusSeconds % 3600) / 60)
      return `${h}h${String(m).padStart(2, '0')}m`
    },
    weekFocusDisplay() {
      const h = Math.floor(this.weekFocusSeconds / 3600)
      const m = Math.floor((this.weekFocusSeconds % 3600) / 60)
      return `${h}h${String(m).padStart(2, '0')}m`
    },
    displayTime() {
      if (this.mode === 'stopwatch') {
        const m = Math.floor(this.elapsed / 60)
        const s = this.elapsed % 60
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      }
      // pomodoro or countdown
      const m = Math.floor(this.remaining / 60)
      const s = this.remaining % 60
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    },
    statusText() {
      if (!this.isRunning) return '未开始'
      if (this.isBreak) return '休息中'
      return '专注中'
    },
  },
  actions: {
    start() {
      if (this.isRunning) return
      // 棢�查日期重�?
      if ( this.todayFocusDate !== todayStr()) {
        this.todayFocusSeconds = 0
        this.todayFocusDate = todayStr()
      }
      const currentWeek = dayjs().format('YYYY-WW')
      if (this.weekFocusWeek !== currentWeek) {
        this.weekFocusSeconds = 0
        this.weekFocusWeek = currentWeek
      }
      this.isRunning = true
      this.lastTickAt = Date.now()
      this.intervalId = setInterval(() => {
        this.tick()
      }, 1000)
    },
    pause() {
      this.isRunning = false
      this.lastTickAt = 0
      if (this.intervalId) {
        clearInterval(this.intervalId)
        this.intervalId = null
      }
    },
    reset() {
      this.pause()
      this.elapsed = 0
      this.remaining = this.pomodoroDuration * 60
    },
    /**
     * 按实际经过秒数一次��补偿计时进度��?     * 后台被冻结时 interval 不执行，恢复前台后第丢��?tick 会带睢�大差值进来，
     * 在这里集中补偿，避免积压数百�?tick/save 占满主线程��?     */
    applyElapsed(seconds) {
      let remain = seconds
      let guard = 0
      while (remain > 0 && guard++ < 20) {
        if (this.mode === 'stopwatch') {
          this.elapsed += remain
          remain = 0
        } else if (this.remaining > remain) {
          this.remaining -= remain
          if (!this.isBreak) {
            this.todayFocusSeconds += remain
            this.weekFocusSeconds += remain
          }
          remain = 0
        } else {
          remain -= this.remaining
          if (this.mode === 'pomodoro') {
            if (!this.isBreak) {
              // 专注阶段结束 - 记录连续打卡
              this.todayFocusSeconds += this.remaining
              this.weekFocusSeconds += this.remaining
              const today = todayStr()
              if (this.lastFocusDate !== today) {
                const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
                if (this.lastFocusDate === yesterday) {
                  this.streakDays++
                } else {
                  this.streakDays = 1
                }
                this.lastFocusDate = today
                save('streakDays', this.streakDays)
                save('lastFocusDate', this.lastFocusDate)
              }
              this.isBreak = true
              this.remaining = this.breakDuration * 60
            } else {
              // 休息阶段结束 - 进入下一轮专�?
              this.isBreak = false
              this.remaining = this.pomodoroDuration * 60
            }
          } else {
            // countdown 归零 - 停止
            this.remaining = 0
            this.pause()
            remain = 0
          }
        }
      }
      save('todayFocusSeconds', this.todayFocusSeconds)
      save('weekFocusSeconds', this.weekFocusSeconds)
    },
    tick() {
      const now = Date.now()
      const delta = Math.min(Math.floor((now - (this.lastTickAt || now)) / 1000), 3600)
      this.lastTickAt = now
      if (delta > 0) this.applyElapsed(delta)
    },
    setMode(mode) {
      this.pause()
      this.mode = mode
      this.elapsed = 0
      this.isBreak = false
      if (mode === 'pomodoro') {
        this.remaining = this.pomodoroDuration * 60
      } else if (mode === 'countdown') {
        this.remaining = 45 * 60
      } else {
        this.remaining = 0
      }
      save('timerMode', mode)
    },
    setPomodoroDuration(minutes) {
      this.pomodoroDuration = minutes
      if (!this.isRunning && this.mode === 'pomodoro') {
        this.remaining = minutes * 60
      }
      save('pomodoroDuration', minutes)
    },
  },
})

// ============================================================
// 科研 - 组会纪要/实验/培养节点
// ============================================================
const DEFAULT_MILESTONE_STAGES = [
  { id: 'enroll', name: '入学', color: '#22C55E' },
  { id: 'gradyear1', name: '研一', color: '#0EA5E9' },
  { id: 'proposal', name: '开题', color: '#F59E0B' },
  { id: 'midterm', name: '中期考核', color: '#F97316' },
  { id: 'predefense', name: '预答辩', color: '#EC4899' },
  { id: 'review', name: '送审', color: '#8B5CF6' },
  { id: 'defense', name: '答辩', color: '#06B6D4' },
  { id: 'graduate', name: '毕业', color: '#10B981' },
]

export const useResearchStore = defineStore('research', {
  state: () => ({
    meetings: load('meetings', []), // 组会纪要
    experiments: load('experiments', []), // 实验记录
    milestones: load('milestones', defaultMilestones()),
    milestoneStages: load('milestoneStages', [...DEFAULT_MILESTONE_STAGES]),
  }),
  getters: {
    lastMeeting() {
      return this.meetings.length > 0 ? this.meetings[0] : null
    },
    nextMeetingDate() {
      if (this.meetings.length === 0) return null
      const dates = this.meetings.map(m => dayjs(m.date)).sort((a, b) => b.unix() - a.unix())
      const lastDate = dates[0]
      return lastDate.add(7, 'day').format('YYYY-MM-DD')
    },
  },
  actions: {
    addMeeting(meeting) {
      this.meetings.unshift({
        id: uid(),
        date: meeting.date || todayStr(),
        timePeriod: meeting.timePeriod || '', // 时间段，如 "14:00-15:30"
        participants: meeting.participants || '', // 参与人员
        gains: meeting.gains || '', // 收获了什么
        doubts: meeting.doubts || '', // 哪里有疑问
        nextSteps: meeting.nextSteps || '', // 下周具体干什么
        relatedPaperId: meeting.relatedPaperId || null,
        customData: meeting.customData || {}, // 自定义模板字段
        createdAt: nowStr(),
      })
      save('meetings', this.meetings)
      useLogStore().addLog(`添加组会纪要：${meeting.date || todayStr()}`)
    },
    deleteMeeting(id) {
      const meeting = this.meetings.find(m => m.id === id)
      const date = meeting?.date || id
      this.meetings = this.meetings.filter(m => m.id !== id)
      save('meetings', this.meetings)
      useLogStore().addLog(`删除组会纪要：${date}`)
    },
    updateMeeting(id, updates) {
      const meeting = this.meetings.find(m => m.id === id)
      if (meeting) {
        Object.assign(meeting, updates)
        save('meetings', this.meetings)
        useLogStore().addLog(`编辑组会纪要：${meeting.date}`)
      }
    },
    addExperiment(exp) {
      this.experiments.unshift({
        id: uid(),
        date: exp.date || todayStr(),
        name: exp.name || '',
        dataPath: exp.dataPath || '',
        repoUrl: exp.repoUrl || '',
        commitId: exp.commitId || '',
        params: exp.params || '',
        notes: exp.notes || '',
        createdAt: nowStr(),
      })
      save('experiments', this.experiments)
    },
    deleteExperiment(id) {
      this.experiments = this.experiments.filter(e => e.id !== id)
      save('experiments', this.experiments)
    },
    updateMilestone(id, updates) {
      const m = this.milestones.find(m => m.id === id)
      if (m) {
        Object.assign(m, updates)
        save('milestones', this.milestones)
        useLogStore().addLog(`更新培养节点：${m.name}`)
      }
    },
    updateAllMilestones(milestones) {
      this.milestones = milestones
      save('milestones', this.milestones)
      useLogStore().addLog('批量更新培养节点')
    },
    updateMilestoneStages(stages) {
      this.milestoneStages = stages
      save('milestoneStages', this.milestoneStages)
      useLogStore().addLog('更新培养阶段配置')
    },
    resetMilestoneStages() {
      this.milestoneStages = [...DEFAULT_MILESTONE_STAGES]
      save('milestoneStages', this.milestoneStages)
      useLogStore().addLog('恢复培养阶段默认配置')
    },
  },
})

function defaultMilestones() {
  return [
    { id: 'enroll', name: '入学', status: 'completed', date: '', plannedDate: '' },
    { id: 'gradyear1', name: '研一', status: 'pending', date: '', plannedDate: '' },
    { id: 'proposal', name: '开题', status: 'pending', date: '', plannedDate: '' },
    { id: 'midterm', name: '中期考核', status: 'pending', date: '', plannedDate: '' },
    { id: 'predefense', name: '预答辩', status: 'pending', date: '', plannedDate: '' },
    { id: 'review', name: '送审', status: 'pending', date: '', plannedDate: '' },
    { id: 'defense', name: '答辩', status: 'pending', date: '', plannedDate: '' },
    { id: 'graduate', name: '毕业', status: 'pending', date: '', plannedDate: '' },
  ]
}

// ============================================================
// 计划与复�?// ============================================================
export const usePlanStore = defineStore('plan', {
  state: () => ({
    plans: load('plans', []), // 多维计划
    reviews: load('reviews', []), // 复盘记录
    nextSeq: load('planNextSeq', 1), // 固定编号计数器
    dailyCheckins: load('dailyCheckins', []), // 每日底线任务打卡
    dailySummaries: load('dailySummaries', []), // 每日总结
    weeklySummaries: load('weeklySummaries', []), // 每周总结
  }),
  getters: {
    plansByLevel() {
      return (level) => this.plans.filter(p => p.level === level)
    },
    getCheckin() {
      return (date) => this.dailyCheckins.find(c => c.date === date)
    },
    getDailySummary() {
      return (date) => this.dailySummaries.find(s => s.date === date)
    },
    getWeeklySummary() {
      return (weekStart) => this.weeklySummaries.find(s => s.weekStart === weekStart)
    },
  },
  actions: {
    addPlan(plan) {
      const seq = this.nextSeq
      this.nextSeq = seq + 1
      save('planNextSeq', this.nextSeq)
      this.plans.unshift({
        id: uid(),
        seq,
        level: plan.level || 'day', // day|week|month|quarter|halfyear|year
        title: plan.title || '',
        description: plan.description || '',
        category: plan.category || 'other',
        priority: plan.priority || 2,
        startDate: plan.startDate || todayStr(),
        endDate: plan.endDate || '',
        acceptTime: plan.acceptTime || nowStr(),
        subtasks: plan.subtasks || [
          { text: '', color: '', date: '' }, { text: '', color: '', date: '' },
          { text: '', color: '', date: '' }, { text: '', color: '', date: '' },
          { text: '', color: '', date: '' }, { text: '', color: '', date: '' },
        ],
        progress: 0,
        status: 'active', // active|completed|overdue
        createdAt: nowStr(),
      })
      save('plans', this.plans)
      useLogStore().addLog(`添加计划：��?{plan.title}》`)
    },
    updatePlan(id, updates) {
      const plan = this.plans.find(p => p.id === id)
      if (plan) {
        Object.assign(plan, updates)
        // 用户显式将状态改为非「已完成」时，跳过自动完成��辑，允许手动改�?
        const explicitUncomplete = updates.status && updates.status !== 'completed'
        if (!explicitUncomplete) {
          // 计划库自动完成：已填写内容的子任务全部填充为「完成（绿色）��色时，自动标记完成
          // 留空的子任务槽位忽略，不阻断完成判定；要求至少有丢�个已填写子任�?
          const subs = plan.subtasks || []
          const greenHex = (useSettingsStore().subtaskColors.find(c => c.id === 'green') || {}).color || '#10B981'
          const filled = subs.filter(s => {
            const text = typeof s === 'string' ? s : (s.text || '')
            return text.trim() !== ''
          })
          if (filled.length > 0) {
            const allDone = filled.every(s => {
              const color = typeof s === 'string' ? '' : (s.color || '')
              return color === greenHex
            })
            if (allDone) { plan.status = 'completed'; plan.progress = 100 }
          }
          if (updates.progress === 100) plan.status = 'completed'
        }
        save('plans', this.plans)
        useLogStore().addLog(`更新计划：��?{plan.title}》`)
      }
    },
    deletePlan(id) {
      const plan = this.plans.find(p => p.id === id)
      const title = plan?.title || id
      this.plans = this.plans.filter(p => p.id !== id)
      save('plans', this.plans)
      useLogStore().addLog(`删除计划：��?{title}》`)
    },
    addReview(review) {
      this.reviews.unshift({
        id: uid(),
        type: review.type || 'week', // week|month
        period: review.period || '',
        achievements: review.achievements || '',
        wastedTime: review.wastedTime || '',
        stopDoing: review.stopDoing || '',
        createdAt: nowStr(),
      })
      save('reviews', this.reviews)
    },

    // ===== 每日打卡 =====
    getOrCreateCheckin(date) {
      let c = this.dailyCheckins.find(x => x.date === date)
      if (!c) {
        c = { id: uid(), date, tasks: [], createdAt: nowStr() }
        this.dailyCheckins.push(c)
        save('dailyCheckins', this.dailyCheckins)
      }
      return c
    },
    addCheckinTask(date, task) {
      const c = this.getOrCreateCheckin(date)
      c.tasks.push({
        id: uid(),
        planId: task.planId || '',
        title: task.title || '',
        description: task.description || '',
        completed: false,
        state: 'pending',
        completedAt: '',
        source: task.source || '',
        sourceDate: task.sourceDate || '',
      })
      save('dailyCheckins', this.dailyCheckins)
    },
    updateCheckinTask(date, taskId, updates) {
      const c = this.getCheckin(date)
      if (!c) return
      const t = c.tasks.find(x => x.id === taskId)
      if (t) {
        Object.assign(t, updates)
        save('dailyCheckins', this.dailyCheckins)
      }
    },
    deleteCheckinTask(date, taskId) {
      const c = this.getCheckin(date)
      if (!c) return
      c.tasks = c.tasks.filter(x => x.id !== taskId)
      save('dailyCheckins', this.dailyCheckins)
    },
    toggleCheckinTask(date, taskId) {
      const c = this.getCheckin(date)
      if (!c) return
      const t = c.tasks.find(x => x.id === taskId)
      if (t) {
        const newCompleted = !t.completed
        t.completed = newCompleted
        t.state = newCompleted ? 'completed' : 'pending'
        t.completedAt = newCompleted ? nowStr() : ''
        save('dailyCheckins', this.dailyCheckins)
      }
    },
    setCheckinTaskStatus(date, taskId, completed) {
      const c = this.getCheckin(date)
      if (!c) return
      const t = c.tasks.find(x => x.id === taskId)
      if (t) {
        t.completed = completed
        t.state = completed ? 'completed' : 'pending'
        t.completedAt = completed ? nowStr() : ''
        save('dailyCheckins', this.dailyCheckins)
      }
    },
    // 三��：pending（未完成�? completed（完成）/ abandoned（放弃）
    setCheckinTaskState(date, taskId, state) {
      const c = this.getCheckin(date)
      if (!c) return
      const t = c.tasks.find(x => x.id === taskId)
      if (t) {
        t.state = state
        t.completed = state === 'completed'
        t.completedAt = state === 'completed' ? nowStr() : ''
        save('dailyCheckins', this.dailyCheckins)
      }
    },

    // ===== 每日总结 =====
    setDailySummary(date, payload) {
      let s = this.dailySummaries.find(x => x.date === date)
      if (!s) {
        s = { id: uid(), date }
        this.dailySummaries.push(s)
      }
      s.progress = payload.progress ?? s.progress ?? ''
      s.problems = payload.problems ?? s.problems ?? ''
      s.tomorrow = payload.tomorrow ?? s.tomorrow ?? ''
      s.writtenAt = nowStr()
      save('dailySummaries', this.dailySummaries)
    },

    // ===== 每周总结 =====
    setWeeklySummary(weekStart, payload) {
      let s = this.weeklySummaries.find(x => x.weekStart === weekStart)
      if (!s) {
        s = { id: uid(), weekStart }
        this.weeklySummaries.push(s)
      }
      s.weekEnd = payload.weekEnd || s.weekEnd || ''
      s.progress = payload.progress ?? s.progress ?? ''
      s.nextWeek = payload.nextWeek ?? s.nextWeek ?? ''
      s.writtenAt = nowStr()
      save('weeklySummaries', this.weeklySummaries)
    },
  },
})

// ============================================================
// 仿真中心
// ============================================================
export const SIM_SOFTWARE_OPTIONS = [
  { id: 'carsim2020', name: 'carsim 2020' },
  { id: 'carsim2024', name: 'carsim 2024' },
  { id: 'matlab2022b', name: 'MATLAB R2022b' },
  { id: 'matlab2024b', name: 'MATLAB R2024b' },
]

// 仿真字段中文名（用于编辑历史 diff 展示�?
export
 const SIM_FIELD_LABELS = {
  code: '仿真编号',
  status: '仿真状态',
  subject: '仿真主题',
  detail: '细节备注',
  software: '仿真软件',
  startTime: '开始仿真',
  endTime: '仿真截止',
  result: '仿真结果',
  fileLocation: '文件位置',
  linkedPlanId: '关联计划',
  notes: '备注',
}

export const SIM_STATUS_OPTIONS = [
  { id: 'completed', name: '已完成', color: '#22C55E' },
  { id: 'running', name: '仿真中', color: '#3B82F6' },
  { id: 'pending', name: '待开始', color: '#F59E0B' },
  { id: 'canceled', name: '取消', color: '#9CA3AF' },
]

// ============================================================
// 订阅中心（知网等期刊 RSS/Atom 订阅�?// ============================================================
export const SUBSCRIPTION_PRESETS = [
  { name: '汽车工程', url: 'https://rss.cnki.net/knavi/rss/QCGC?pcode=CJFD,CCJD' },
  { name: '汽车工程', url: 'https://rss.cnki.net/knavi/rss/QCKJ?pcode=CJFD,CCJD' },
  { name: '机械工程学报', url: 'https://rss.cnki.net/knavi/rss/JXXB?pcode=CJFD,CCJD' },
  { name: '中国公路学报', url: 'https://rss.cnki.net/knavi/rss/ZGGL?pcode=CJFD,CCJD' },
  { name: '汽车安全与节能学报', url: 'https://rss.cnki.net/knavi/rss/QCAN?pcode=CJFD,CCJD' },
]

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    subscriptions: load('subscriptions', []),
  }),
  getters: {
    totalItems(state) {
      if (!Array.isArray(state.subscriptions)) return 0
      return state.subscriptions.reduce((n, s) => n + (s && s.items ? s.items.length : 0), 0)
    },
  },
  actions: {
    addSubscription(sub) {
      const item = {
        id: uid(),
      name: sub.name || '未命名订阅',
        url: sub.url || '',
        category: sub.category || '',
        enabled: sub.enabled !== false,
        rawContent: sub.rawContent || '',
        lastFetched: '',
        items: [],
        createdAt: nowStr(),
      }
      this.subscriptions.unshift(item)
      save('subscriptions', this.subscriptions)
      useLogStore().addLog(`添加订阅：${sub.name || '未命名'}》`)
      return item
    },
    updateSubscription(id, updates) {
      const s = this.subscriptions.find(x => x.id === id)
      if (s) { Object.assign(s, updates); save('subscriptions', this.subscriptions) }
    },
    deleteSubscription(id) {
      const s = this.subscriptions.find(x => x.id === id)
      const name = s ? s.name : id
      this.subscriptions = this.subscriptions.filter(x => x.id !== id)
      save('subscriptions', this.subscriptions)
      useLogStore().addLog(`删除订阅：${name}》`)
    },
    setItems(id, items) {
      const s = this.subscriptions.find(x => x.id === id)
      if (s) {
        s.items = items
        s.lastFetched = nowStr()
        save('subscriptions', this.subscriptions)
      }
    },
  },
})

export const useSimulationStore = defineStore('simulation', {
  state: () => {
    const rawSims = load('simulations', [])
    const sims = Array.isArray(rawSims) ? rawSims : []
    // 丢�次��数据迁移：旧版字段迁到 records 数组
    sims.forEach(s => {
      if (s && typeof s === 'object' && !Array.isArray(s.records)) {
        const hasLegacy = s.detail || (Array.isArray(s.software) && s.software.length) || s.result || s.fileLocation
        const r = {
          id: uid(),
          software: Array.isArray(s.software) ? s.software : [],
          detail: s.detail || '',
          recordTime: s.endTime || s.startTime || '',
          result: s.result || '',
          fileLocation: s.fileLocation || '',
          createdAt: s.createdAt || nowStr(),
        }
        s.records = hasLegacy ? [r] : []
        delete s.detail
        delete s.software
        delete s.endTime
        delete s.result
        delete s.fileLocation
        delete s.history
      } else if (s && Array.isArray(s.records)) {
        delete s.detail
        delete s.software
        delete s.endTime
        delete s.result
        delete s.fileLocation
        delete s.history
      }
    })
    return {
      simulations: sims,
      nextSeq: load('simNextSeq', 1),
      customSoftware: load('simCustomSoftware', []), // [{ id, name }] 用户自定义软件
      // 状态配置：内置 4 个（可改名/改色）+ 用户自定义；用户改过才持久化，未改过用内置默认
      statusConfig: (load('simStatusConfig', null) || SIM_STATUS_OPTIONS.map(s => ({ ...s, builtin: true }))),
    }
  },
  getters: {
    statusOptions() {
      return Array.isArray(this.statusConfig) && this.statusConfig.length
        ? this.statusConfig
        : SIM_STATUS_OPTIONS.map(s => ({ ...s, builtin: true }))
    },
    statusCounts() {
      const base = {}
      this.statusOptions.forEach(s => { base[s.id] = 0 })
      if (!Array.isArray(this.simulations)) return base
      this.simulations.forEach(s => { if (s && s.status && base[s.status] !== undefined) base[s.status]++ })
      return base
    },
    recent() {
      if (!Array.isArray(this.simulations)) return []
      return [...this.simulations]
        .filter(s => s && typeof s === 'object')
        .sort((a, b) => String(b.startTime || b.createdAt || '').localeCompare(String(a.startTime || a.createdAt || '')))
        .slice(0, 8)
    },
  },
  actions: {
    genCode(seq) {
      const d = dayjs()
      const p = n => String(n).padStart(2, '0')
      const ts = `${d.year()}${p(d.month() + 1)}${p(d.date())}${p(d.hour())}${p(d.minute())}${p(d.second())}`
      return `${ts}${seq}`
    },
    // ---- 自定义软�?----
    allSoftwareOptions() {
      return [...SIM_SOFTWARE_OPTIONS, ...this.customSoftware]
    },
    addCustomSoftware(name) {
      const n = String(name || '').trim()
      if (!n) return null
      const exist = this.allSoftwareOptions().find(s => s.name === n)
      if (exist) return exist
      const item = { id: 'custom_' + uid(), name: n }
      this.customSoftware.push(item)
      save('simCustomSoftware', this.customSoftware)
      return item
    },
    removeCustomSoftware(id) {
      this.customSoftware = this.customSoftware.filter(s => s.id !== id)
      save('simCustomSoftware', this.customSoftware)
    },
    softwareLabel(ids) {
      if (!ids || !ids.length) return ''
      const all = this.allSoftwareOptions()
      return ids.map(id => (all.find(s => s.id === id) || {}).name || id).join('、')
    },
    // ---- 自定义状态（名称 / 颜色�?----
    updateStatus(id, patch) {
      const st = this.statusConfig.find(s => s.id === id)
      if (!st) return
      if (patch.name !== undefined && String(patch.name).trim()) st.name = String(patch.name).trim()
      if (patch.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(String(patch.color))) st.color = patch.color
      save('simStatusConfig', this.statusConfig)
    },
    addCustomStatus(name, color) {
      const n = String(name || '').trim()
      if (!n) return null
      if (this.statusConfig.some(s => s.name === n)) return null
      const item = { id: 'custom_' + uid(), name: n, color: color || '#6B7280', builtin: false }
      this.statusConfig.push(item)
      save('simStatusConfig', this.statusConfig)
      return item
    },
    removeCustomStatus(id) {
      this.statusConfig = this.statusConfig.filter(s => s.id !== id)
      save('simStatusConfig', this.statusConfig)
    },
    resetStatusConfig() {
      this.statusConfig = SIM_STATUS_OPTIONS.map(s => ({ ...s, builtin: true }))
      save('simStatusConfig', this.statusConfig)
    },
    // ---- 数据迁移：旧版（详情/软件等在顶层）→ 新版（records 数组�?----
    _migrateSimIfNeeded(sim) {
      if (!sim || typeof sim !== 'object') return sim
      if (!Array.isArray(sim.records)) {
        // 旧版：detail/software/endTime/result/fileLocation 挪到第一条记�?
        const r = {
          id: uid(),
          software: Array.isArray(sim.software) ? sim.software : [],
          detail: sim.detail || '',
          recordTime: sim.endTime || sim.startTime || '',
          result: sim.result || '',
          fileLocation: sim.fileLocation || '',
          createdAt: sim.createdAt || nowStr(),
        }
        sim.records = (sim.detail || sim.software?.length || sim.result || sim.fileLocation) ? [r] : []
        delete sim.detail
        delete sim.software
        delete sim.endTime
        delete sim.result
        delete sim.fileLocation
        delete sim.history
      } else {
        // 已迁移过：清理旧字段残留
        delete sim.detail
        delete sim.software
        delete sim.endTime
        delete sim.result
        delete sim.fileLocation
        delete sim.history
      }
      return sim
    },
    addSimulation(sim) {
      const seq = this.nextSeq
      this.nextSeq = seq + 1
      save('simNextSeq', this.nextSeq)
      const newSim = {
        id: uid(),
        seq,
        code: sim.code || this.genCode(seq),
        subject: sim.subject || '',
        startTime: sim.startTime || '',
        status: sim.status || 'pending',
        linkedPlanId: sim.linkedPlanId || '',
        notes: sim.notes || '',
        createdAt: nowStr(),
        records: [],
      }
      this._migrateSimIfNeeded(newSim)
      this.simulations.unshift(newSim)
      save('simulations', this.simulations)
      useLogStore().addLog(`添加仿真：${sim.subject || '未命名'}》`)
    },
    updateSimulation(id, updates) {
      const sim = this.simulations.find(s => s.id === id)
      if (sim) {
        this._migrateSimIfNeeded(sim)
        // 仅允许修改顶�?初始信息"字段
        const allowed = ['code', 'subject', 'startTime', 'status', 'linkedPlanId', 'notes']
        const safe = {}
        allowed.forEach(k => { if (k in updates) safe[k] = updates[k] })
        Object.assign(sim, safe)
        save('simulations', this.simulations)
      useLogStore().addLog(`更新仿真：${sim.subject || '未命名'}》`)
      }
    },
    addSimulationRecord(simId, record) {
      const sim = this.simulations.find(s => s.id === simId)
      if (!sim) return null
      this._migrateSimIfNeeded(sim)
      const newRecord = {
        id: uid(),
        software: Array.isArray(record.software) ? record.software : [],
        detail: record.detail || '',
        recordTime: record.recordTime || '',
        result: record.result || '',
        fileLocation: record.fileLocation || '',
        evaluation: record.evaluation || '', // 评价标签：keep 保留 / discard 舍弃 / pending 暂定
        reason: record.reason || '', // 标注理由：为什么标记保留/舍弃/暂定
        resultImages: Array.isArray(record.resultImages) ? record.resultImages : [], // 仿真结果图片文件名
        createdAt: nowStr(),
      }
      sim.records = sim.records || []
      sim.records.unshift(newRecord)
      save('simulations', this.simulations)
      useLogStore().addLog(`为仿真《${sim.subject || '未命名'}》新增仿真记录`)
      return newRecord
    },
    updateSimulationRecord(simId, recordId, updates) {
      const sim = this.simulations.find(s => s.id === simId)
      if (!sim || !Array.isArray(sim.records)) return
      const r = sim.records.find(x => x.id === recordId)
      if (!r) return
      Object.assign(r, updates)
      save('simulations', this.simulations)
      useLogStore().addLog(`更新仿真记录：《${sim.subject || '未命名'}》`)
    },
    deleteSimulationRecord(simId, recordId) {
      const sim = this.simulations.find(s => s.id === simId)
      if (!sim || !Array.isArray(sim.records)) return
      sim.records = sim.records.filter(r => r.id !== recordId)
      save('simulations', this.simulations)
      useLogStore().addLog(`删除仿真记录：《${sim.subject || '未命名'}》`)
    },
    deleteSimulation(id) {
      const sim = this.simulations.find(s => s.id === id)
      const title = sim?.subject || id
      // 同步清理该仿真下所有记录的结果图片文件
      if (sim && Array.isArray(sim.records)) {
        const names = []
        sim.records.forEach(r => {
          if (Array.isArray(r.resultImages)) names.push(...r.resultImages)
        })
        if (names.length) {
          // 动态引入避免循环依赖（simImageStorage 不依赖 store）
          import('../utils/simImageStorage').then(m => m.deleteSimImages(names)).catch(() => {})
        }
      }
      this.simulations = this.simulations.filter(s => s.id !== id)
      save('simulations', this.simulations)
      useLogStore().addLog(`删除仿真：${title}》`)
    },
  },
})

// ============================================================
// 消息中心
// ============================================================
export const useMessageStore = defineStore('message', {
  state: () => ({
    messages: load('messages', []),
  }),
  getters: {
    unreadCount() {
      return this.messages.filter(m => !m.read).length
    },
    sortedMessages() {
      return [...this.messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
  },
  actions: {
    addMessage(message) {
      const id = message.id || uid()
      // 更新推��幂等：�?id �?update- 消息已存在时先移除旧条（防重复推�?旧版本残留覆盖）
      if (String(id).startsWith('update-')) {
        this.messages = this.messages.filter(m => m.id !== id)
      }
      this.messages.unshift({
        id,
        title: message.title || '通知',
        content: message.content || '',
        type: message.type || 'info',
        read: message.read === true ? true : false,
        createdAt: message.createdAt || nowStr(),
        action: message.action || null,
        daysLeft: message.daysLeft != null ? message.daysLeft : null,
      })
      save('messages', this.messages)
    },
    markRead(id) {
      const msg = this.messages.find(m => m.id === id)
      if (msg) {
        msg.read = true
        save('messages', this.messages)
      }
    },
    markAllRead() {
      this.messages.forEach(m => { m.read = true })
      save('messages', this.messages)
    },
    deleteMessage(id) {
      this.messages = this.messages.filter(m => m.id !== id)
      save('messages', this.messages)
    },
    // 清理历史版本更新提醒：只保留朢�新版本的 update- 消息（用于播�?数据恢复后清掉积压的旧版本推送）
    pruneUpdateMessages(latestVersion) {
      const keepId = 'update-' + latestVersion
      const before = this.messages.length
      this.messages = this.messages.filter(m => !(String(m.id || '').startsWith('update-') && m.id !== keepId))
      if (this.messages.length !== before) save('messages', this.messages)
    },
    clearAll() {
      this.messages = []
      save('messages', [])
    },
  },
})

// ============================================================
// 导师应答助手 - 话术�?// ============================================================
// ============================================================
// 科研导航
// ============================================================
const DEFAULT_NAV_SITES = [
  { id: 'cnki', name: '中国知网', url: 'https://www.cnki.net', category: '文献检索', icon: 'book', clicks: 0 },
  { id: 'wos', name: 'Web of Science', url: 'https://www.webofscience.com', category: '文献检索', icon: 'search', clicks: 0 },
  { id: 'scholar', name: 'Google Scholar', url: 'https://scholar.google.com', category: '文献检索', icon: 'graduation-cap', clicks: 0 },
  { id: 'pubmed', name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov', category: '文献检索', icon: 'heart-pulse', clicks: 0 },
  { id: 'arxiv', name: 'arXiv', url: 'https://arxiv.org', category: '文献检索', icon: 'file-text', clicks: 0 },
  { id: 'letpub', name: 'LetPub', url: 'https://www.letpub.com.cn', category: '期刊投稿', icon: 'mail', clicks: 0 },
  { id: 'medsci', name: 'MedSci', url: 'https://www.medsci.cn', category: '期刊投稿', icon: 'bar-chart', clicks: 0 },
  { id: 'biorender', name: 'BioRender', url: 'https://biorender.com', category: '绘图可视化', icon: 'palette', clicks: 0 },
  { id: 'processon', name: 'ProcessOn', url: 'https://www.processon.com', category: '绘图可视化', icon: 'pencil', clicks: 0 },
  { id: 'drawio', name: 'Draw.io', url: 'https://app.diagrams.net', category: '绘图可视化', icon: 'pen-tool', clicks: 0 },
  { id: 'kaggle', name: 'Kaggle', url: 'https://www.kaggle.com', category: '数据分析', icon: 'line-chart', clicks: 0 },
  { id: 'github', name: 'GitHub', url: 'https://github.com', category: '数据分析', icon: 'monitor', clicks: 0 },
  { id: 'colab', name: 'Google Colab', url: 'https://colab.research.google.com', category: '数据分析', icon: 'hash', clicks: 0 },
  { id: 'researchgate', name: 'ResearchGate', url: 'https://www.researchgate.net', category: '学术社交', icon: 'microscope', clicks: 0 },
  { id: 'zotero', name: 'Zotero Web', url: 'https://www.zotero.org', category: '实用工具', icon: 'folder', clicks: 0 },
  { id: 'grammarly', name: 'Grammarly', url: 'https://www.grammarly.com', category: '实用工具', icon: 'pen-tool', clicks: 0 },
  { id: 'deepl', name: 'DeepL', url: 'https://www.deepl.com', category: '实用工具', icon: 'globe', clicks: 0 },
  { id: 'overleaf', name: 'Overleaf', url: 'https://www.overleaf.com', category: '实用工具', icon: 'file-edit', clicks: 0 },
]

export const useNavigationStore = defineStore('navigation', {
  state: () => ({
    sites: load('navSites', DEFAULT_NAV_SITES),
    categories: load('navCategories', ['文献检索', '期刊投稿', '绘图可视化', '数据分析', '学术社交', '实用工具', '数据库']),
  }),
  getters: {
    sitesByCategory() {
      const map = {}
      const sites = Array.isArray(this.sites) ? this.sites : []
      for (const cat of (Array.isArray(this.categories) ? this.categories : [])) {
        map[cat] = sites.filter(s => s && s.category === cat)
      }
      return map
    },
    todayClicks() {
      const today = todayStr()
      const sites = Array.isArray(this.sites) ? this.sites : []
      return sites.reduce((sum, s) => sum + (s && s.clickDates ? s.clickDates.filter(d => d === today).length : 0), 0)
    },
  },
  actions: {
    addSite(site) {
      this.sites.push({
        id: uid(),
        name: site.name,
        url: site.url,
        category: site.category || '实用工具',
        icon: site.icon || 'link',
        clicks: 0,
        clickDates: [],
      })
      save('navSites', this.sites)
    },
    updateSite(id, updates) {
      const site = this.sites.find(s => s.id === id)
      if (site) {
        Object.assign(site, updates)
        save('navSites', this.sites)
      }
    },
    deleteSite(id) {
      this.sites = this.sites.filter(s => s.id !== id)
      save('navSites', this.sites)
    },
    recordClick(id) {
      const site = this.sites.find(s => s.id === id)
      if (site) {
        site.clicks++
        if (!site.clickDates) site.clickDates = []
        site.clickDates.push(todayStr())
        // 只保留最�?0�?
        if (site.clickDates.length > 100) site.clickDates = site.clickDates.slice(-100)
        save('navSites', this.sites)
      }
    },
    addCategory(name) {
      if (!this.categories.includes(name)) {
        this.categories.push(name)
        save('navCategories', this.categories)
      }
    },
    deleteCategory(name) {
      this.categories = this.categories.filter(c => c !== name)
      this.sites = this.sites.filter(s => s.category !== name)
      save('navCategories', this.categories)
      save('navSites', this.sites)
    },
    reorderCategories(fromIndex, toIndex) {
      if (fromIndex < 0 || fromIndex >= this.categories.length) return
      if (toIndex < 0 || toIndex >= this.categories.length) return
      const cats = [...this.categories]
      const [moved] = cats.splice(fromIndex, 1)
      cats.splice(toIndex, 0, moved)
      this.categories = cats
      save('navCategories', this.categories)
    },
    reorderSites(category, fromIndex, toIndex) {
      const catSites = this.sites.filter(s => s.category === category)
      if (fromIndex < 0 || fromIndex >= catSites.length) return
      if (toIndex < 0 || toIndex >= catSites.length) return
      // Get global indices
      const allIndices = this.sites.map((s, i) => s.category === category ? i : -1).filter(i => i >= 0)
      const globalFrom = allIndices[fromIndex]
      const globalTo = allIndices[toIndex]
      const [moved] = this.sites.splice(globalFrom, 1)
      this.sites.splice(globalTo, 0, moved)
      save('navSites', this.sites)
    },
    moveSiteToCategory(siteId, toCategory) {
      const site = this.sites.find(s => s.id === siteId)
      if (site && this.categories.includes(toCategory) && site.category !== toCategory) {
        site.category = toCategory
        save('navSites', this.sites)
      }
    },
  },
})

// ============================================================
// 全局设置
// ============================================================
const DEFAULT_MEETING_FIELDS = [
  { id: 'gains', key: 'gains', label: '收获了什么', type: 'textarea', enabled: true, sortOrder: 0 },
  { id: 'doubts', key: 'doubts', label: '哪里有疑问', type: 'textarea', enabled: true, sortOrder: 1 },
  { id: 'nextSteps', key: 'nextSteps', label: '下周具体干什么', type: 'textarea', enabled: true, sortOrder: 2 },
]

const PARTICIPANT_COLORS = [
  '#4F8DF7', '#EF6D6D', '#F5A623', '#42B883', '#9B59B6',
  '#1ABC9C', '#E67E22', '#3498DB', '#E91E63', '#8E44AD',
]
const DEFAULT_MEETING_PARTICIPANTS = []
const DEFAULT_PARTICIPANT_GROUPS = []

const DEFAULT_ACADEMIC_BREAKDOWN = [
  { name: '学位课', value: 80, color: '#A5A8F0' },
  { name: '科研', value: 35, color: '#7DA8E8' },
  { name: '论文', value: 20, color: '#A78BFA' },
  { name: '实践', value: 60, color: '#6DBE8A' },
]

const DEFAULT_PLAN_OVERVIEW = [
  { name: '主线课题推进', value: 0, color: '#5B5FEF' },
  { name: '导师项目', value: 0, color: '#F59E0B' },
  { name: '智能学术', value: 0, color: '#059669' },
  { name: '日常事务', value: 0, color: '#6B7280' },
]

const DEFAULT_PLAN_STATUSES = [
  { id: 'active', name: '进行中', color: '#3B82F6', order: 0 },
  { id: 'completed', name: '已完成', color: '#10B981', order: 1 },
  { id: 'overdue', name: '已逾期', color: '#F59E0B', order: 2 },
]

const DEFAULT_PLAN_CATEGORIES = [
  { id: 'academic', name: '学业任务', color: '#3B82F6', order: 0 },
  { id: 'research', name: '科研任务', color: '#8B5CF6', order: 1 },
  { id: 'admin', name: '行政任务', color: '#F59E0B', order: 2 },
  { id: 'class', name: '班级任务', color: '#EC4899', order: 3 },
  { id: 'other', name: '其他', color: '#6B7280', order: 4 },
]

const DEFAULT_PLAN_LEVELS = [
  { id: 'day', name: '日计划', color: '#3B82F6', order: 0 },
  { id: 'week', name: '周计划', color: '#8B5CF6', order: 1 },
  { id: 'month', name: '月计划', color: '#10B981', order: 2 },
  { id: 'quarter', name: '季度计划', color: '#F59E0B', order: 3 },
  { id: 'halfyear', name: '半年计划', color: '#EC4899', order: 4 },
  { id: 'year', name: '年度计划', color: '#06B6D4', order: 5 },
]

const DEFAULT_PLAN_PRIORITIES = [
  { id: 'p3', name: '高', color: '#DC2626', value: 3, order: 0 },
  { id: 'p2', name: '中', color: '#D97706', value: 2, order: 1 },
  { id: 'p1', name: '低', color: '#6B7280', value: 1, order: 2 },
]

const DEFAULT_SUBTASK_COLORS = [
  { id: 'green', name: '完成', color: '#10B981', order: 0 },
  { id: 'blue', name: '进行中', color: '#3B82F6', order: 1 },
  { id: 'yellow', name: '待处理', color: '#F59E0B', order: 2 },
  { id: 'red', name: '受阻', color: '#EF4444', order: 3 },
  { id: 'purple', name: '已委派', color: '#8B5CF6', order: 4 },
  { id: 'gray', name: '已搁置', color: '#9CA3AF', order: 5 },
]

const DEFAULT_TASK_PRIORITIES = [
  { id: 'p3', name: '高', color: '#DC2626', value: 3, order: 0 },
  { id: 'p2', name: '中', color: '#D97706', value: 2, order: 1 },
  { id: 'p1', name: '低', color: '#6B7280', value: 1, order: 2 },
]

const DEFAULT_TASK_STATES = [
  { id: 'pending',   name: '未完成', color: '#F59E0B', order: 0 },
  { id: 'completed', name: '已完成', color: '#10B981', order: 1 },
  { id: 'abandoned', name: '放弃',   color: '#9CA3AF', order: 2 },
]

// 计划库消息中心提醒配置：提前提醒天数、4 档提醒颜色、参与提醒的计划状态
// remindDaysAhead: 任务结束时间距今日多少天内开始提醒（默认 8）
// remindColors:   4 档颜色 { near, urgent, overdue, severe }（默认与 v5.0.266 分级一致）
// remindStatuses: 哪些计划状态参与提醒（默认：除已完成/放弃外的全部状态）
const DEFAULT_PLAN_REMINDER = {
  remindDaysAhead: 8,
  remindColors: {
    near: '#F59E0B',      // 距结束 ≤8 天 → 淡橙
    urgent: '#EF4444',    // 距结束 ≤3 天 → 淡红
    overdue: '#8B5CF6',   // 逾期 ≥3 天 → 淡紫
    severe: '#DC2626',    // 逾期 ≥7 天 → 深红
  },
  remindStatuses: ['active', 'overdue'],
}

// 登录态最长有效期�?4 小时（毫秒）。超过该时长强制下线，需重新登录�?
export
 const SESSION_MAX_AGE = 24 * 60 * 60 * 1000

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    profile: load('profile', {
      name: '',
      school: '',
      department: '',
      major: '',
      grade: '',
      enrollDate: '',
    }),
    config: load('config', {
      defaultBetAmount: 50,
      contactReminderDays: 14,
      pomodoroDuration: 25,
      emotionThreshold: 3,
      noExerciseDays: 3,
      navStayDuration: 30,
      fortuneEnabled: true,
    }),
    sidebarPinned: load('sidebarPinned', true),
    backgroundImage: load('backgroundImage', ''),
    backgroundImageOpacity: load('backgroundImageOpacity', 0.12),
    navOpacity: load('navOpacity', 0.78),
    subNavOpacity: load('subNavOpacity', 0.92),
    moduleOpacity: load('moduleOpacity', 0.88),
    moduleFrosted: load('moduleFrosted', true),
    topBarEffect: load('topBarEffect', 'opaque'),
    topBarOpacity: load('topBarOpacity', 0.78),
    customMeetingFields: load('customMeetingFields', [...DEFAULT_MEETING_FIELDS]),
    meetingParticipants: load('meetingParticipants', [...DEFAULT_MEETING_PARTICIPANTS]),
    participantGroups: load('participantGroups', [...DEFAULT_PARTICIPANT_GROUPS]),
    academicProgress: load('academicProgress', 46),
    academicBreakdown: load('academicBreakdown', [...DEFAULT_ACADEMIC_BREAKDOWN]),
    academicLastModified: load('academicLastModified', null),
    planOverview: load('planOverview', [...DEFAULT_PLAN_OVERVIEW]),
    planStatuses: load('planStatuses', [...DEFAULT_PLAN_STATUSES]),
    planCategories: load('planCategories', [...DEFAULT_PLAN_CATEGORIES]),
    planLevels: load('planLevels', [...DEFAULT_PLAN_LEVELS]),
    planPriorities: load('planPriorities', [...DEFAULT_PLAN_PRIORITIES]),
    subtaskColors: load('subtaskColors', [...DEFAULT_SUBTASK_COLORS]),
    planVisibleColumns: load('planVisibleColumns', ['seq', 'status', 'title', 'acceptTime', 'endDate', 'category', 'level', 'priority', 'subtask1', 'subtask2', 'subtask3', 'subtask4', 'subtask5', 'subtask6', 'actions']),
    planReminder: load('planReminder', { ...DEFAULT_PLAN_REMINDER }),
    taskPriorities: load('taskPriorities', [...DEFAULT_TASK_PRIORITIES]),
    taskCategories: load('taskCategories', [...TASK_CATEGORIES]),
    taskStates: load('taskStates', [...DEFAULT_TASK_STATES]),
    morningPopupShown: load('morningPopupShown', null), // date string
    appVersion: load('appVersion', '5.0.282'),
    changelog: load('changelog', []),
    autoBackupEnabled: load('autoBackupEnabled', true),
    // 版本回滚快照历史（每次升�?导入前自动保存，朢��?3 个）
    rollbackHistory: load('rollbackHistory', []),
    customDate: load('customDate', null),
    customWeek: load('customWeek', null),
    navOrder: load('navOrder', ['/', '/research', '/simulation', '/papers', '/plan', '/navigation', '/finance', '/settings']),
    // 融合态导航：记录各路由页面最后选中的二级 Tab（如 { '/plan': 'daily', '/research': 'papers' }）
    activeSubTabs: load('activeSubTabs', {}),
    authLoggedIn: load('authLoggedIn', false),
    authUsername: load('authUsername', ''),
    authLoginAt: load('authLoginAt', 0),      // 上次登录时间戳（ms），用于 24 小时强制下线
    sessionExpiredNotice: false,               // 瞬时标记：是否因超时被强制下线（不持久化）
    sessionExpiredReason: null,                 // 瞬时标记：下线原因 'expired_24h' | 'window_closed'（不持久化）
    avatarImage: load('avatarImage', ''),
    theme: load('theme', { navBgColor: '', navStyle: 'sidebar' }),
    settingsModuleOrder: (() => {
      const DEFAULT_MODULES = ['data-assets', 'preferences', 'easyscholar']
      const DEPRECATED = ['milestones', 'plan-task-config', 'paper-config', 'meeting-template', 'nav-order', 'paper-status', 'other-config']
      let order = load('settingsModuleOrder', [...DEFAULT_MODULES])
      // 兼容旧版本：剔除已废弃模块（含迁移到各业务中心的配置模块），补上新增模块
      if (order.some(k => DEPRECATED.includes(k)) || !DEFAULT_MODULES.every(k => order.includes(k))) {
        order = DEFAULT_MODULES.filter(k => order.includes(k))
        DEFAULT_MODULES.forEach(k => { if (!order.includes(k)) order.push(k) })
      }
      return order
    })(),
    pdfOpener: load('pdfOpener', 'browser'), // 'browser' | 'edge' | 'custom'
    pdfOpenerPath: load('pdfOpenerPath', ''),  // 自定义软件路径
    bridgeSaveDir: load('bridgeSaveDir', ''),  // 本地桥接服务 PDF 保存目录（空 = 默认 文档/WorkbenchPDF）
    githubUpdateToken: load('githubUpdateToken', ''),  // GitHub 更新令牌（检查更新/下载安装包用）
  }),
  getters: {
    isLoggedIn() { return this.authLoggedIn },
    loginUsername() { return this.authUsername },
    // 登录态剩余有效毫秒数（未登录或无记录时为 0�?
        sessionRemainingMs() {
      if (!this.authLoggedIn || !this.authLoginAt) return 0
      return Math.max(0, this.authLoginAt + SESSION_MAX_AGE - Date.now())
    },
  },
  actions: {
    login(username) {
      this.authLoggedIn = true
      this.authUsername = username
      this.authLoginAt = Date.now()
      this.sessionExpiredNotice = false
      this.sessionExpiredReason = null
      save('authLoggedIn', true)
      save('authUsername', username)
      save('authLoginAt', this.authLoginAt)
      // 标记当前浏览器会话活跃（关闭窗口/标签页后 sessionStorage 被清除，下次打开需重新登录）
      try { sessionStorage.setItem('mw_sessionAlive', '1') } catch {}
      // 消息中心推送登录提醒（每次登录一条，id 唯一）
      try {
        useMessageStore().addMessage({
          id: 'login-' + this.authLoginAt,
          title: '登录提醒',
      content: `用户「${username}」已于 ${nowStr()} 登录系统`,
          type: 'info',
        })
      } catch (e) {}
    },
    logout() {
      this.authLoggedIn = false
      this.authUsername = ''
      this.authLoginAt = 0
      save('authLoggedIn', false)
      save('authUsername', '')
      save('authLoginAt', 0)
      try { sessionStorage.removeItem('mw_sessionAlive') } catch {}
    },
    /**
     * 校验登录态是否有效：
     * 1) 关闭窗口/标签页后重开（sessionStorage 会话标记丢失）→ 必须重新登录；
     * 2) 距上次登录超�?24 小时 �?自动强制下线�?     * 旧版本没�?authLoginAt 记录的登录��一律视为过期，要求重新登录�?     * @returns {boolean} true 表示已失效并已强制下�?     */
    checkSession() {
      if (!this.authLoggedIn) return false
      // PWA standalone 模式棢��?
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone === true
      // �?窗口会话棢�查：关闭浏览器窗口后 sessionStorage 会被清空，重弢�必须重新登录
      //    PWA 模式下跳过（PWA 每次启动 sessionStorage 都是空的，靠 24h 超时兜底�?
      if (!isStandalone) {
        let alive = true
        try { alive = !!sessionStorage.getItem('mw_sessionAlive') } catch {}
        if (!alive) {
          this.logout()
          this.sessionExpiredNotice = true
          this.sessionExpiredReason = 'window_closed'
      try { useLogStore().addLog('检测到浏览器窗口已关闭，登录态已失效，需重新登录') } catch {}
          return true
        }
      }
      // �?24 小时有效期检�?
      const loginAt = Number(this.authLoginAt) || 0
      if (!loginAt || Date.now() - loginAt > SESSION_MAX_AGE) {
        this.logout()
        this.sessionExpiredNotice = true
        this.sessionExpiredReason = 'expired_24h'
        try { useLogStore().addLog('登录态超过 24 小时，已自动强制下线') } catch {}
        return true
      }
      return false
    },
    updateProfile(updates) {
      Object.assign(this.profile, updates)
      save('profile', this.profile)
      useLogStore().addLog('更新个人信息')
    },
    updateConfig(updates) {
      Object.assign(this.config, updates)
      save('config', this.config)
      useLogStore().addLog('更新系统配置')
    },
    markMorningPopupShown() {
      this.morningPopupShown = todayStr()
      save('morningPopupShown', this.morningPopupShown)
    },
    setBackgroundImage(imageData) {
      this.backgroundImage = imageData
      save('backgroundImage', imageData)
      useLogStore().addLog(imageData ? '设置背景图片' : '移除背景图片')
    },
    setBackgroundImageOpacity(opacity) {
      const val = Math.max(0, Math.min(1, Number(opacity) || 0))
      this.backgroundImageOpacity = val
      save('backgroundImageOpacity', val)
    },
    setNavOpacity(opacity) {
      const val = Math.max(0, Math.min(1, Number(opacity) || 0))
      this.navOpacity = val
      save('navOpacity', val)
    },
    setSubNavOpacity(opacity) {
      const val = Math.max(0.3, Math.min(1, Number(opacity) || 0.92))
      this.subNavOpacity = val
      save('subNavOpacity', val)
    },
    setModuleOpacity(opacity) {
      const val = Math.max(0.3, Math.min(1, Number(opacity) || 0.88))
      this.moduleOpacity = val
      save('moduleOpacity', val)
    },
    setModuleFrosted(frosted) {
      this.moduleFrosted = !!frosted
      save('moduleFrosted', this.moduleFrosted)
    },
    setTopBarEffect(effect) {
      this.topBarEffect = ['opaque', 'frosted', 'float'].includes(effect) ? effect : 'opaque'
      save('topBarEffect', this.topBarEffect)
    },
    setTopBarOpacity(opacity) {
      const val = Math.max(0.2, Math.min(1, Number(opacity) || 0.78))
      this.topBarOpacity = val
      save('topBarOpacity', val)
    },
    setGithubUpdateToken(token) {
      this.githubUpdateToken = token || ''
      save('githubUpdateToken', this.githubUpdateToken)
    },
    updateMeetingField(id, updates) {
      const field = this.customMeetingFields.find(f => f.id === id)
      if (field) {
        Object.assign(field, updates)
        save('customMeetingFields', this.customMeetingFields)
        useLogStore().addLog(`修改组会字段：${field.label}`)
      }
    },
    addMeetingField(field) {
      const newField = {
        id: uid(),
        key: field.key || ('custom_' + uid().slice(0, 6)),
      label: field.label || '新字段',
        type: field.type || 'textarea',
        enabled: true,
        sortOrder: this.customMeetingFields.length,
      }
      this.customMeetingFields.push(newField)
      save('customMeetingFields', this.customMeetingFields)
      useLogStore().addLog(`添加组会字段：${newField.label}`)
      return newField
    },
    reorderMeetingFields(fromIndex, toIndex) {
      const fields = this.customMeetingFields
      if (fromIndex < 0 || fromIndex >= fields.length) return
      if (toIndex < 0 || toIndex >= fields.length) return
      const [moved] = fields.splice(fromIndex, 1)
      fields.splice(toIndex, 0, moved)
      // 重新分配 sortOrder
      fields.forEach((f, i) => { f.sortOrder = i })
      save('customMeetingFields', fields)
    },
    deleteMeetingField(id) {
      const field = this.customMeetingFields.find(f => f.id === id)
      const label = field?.label || id
      this.customMeetingFields = this.customMeetingFields.filter(f => f.id !== id)
      save('customMeetingFields', this.customMeetingFields)
      useLogStore().addLog(`删除组会字段：${label}`)
    },
    resetMeetingFields() {
      this.customMeetingFields = [...DEFAULT_MEETING_FIELDS]
      save('customMeetingFields', this.customMeetingFields)
      useLogStore().addLog('恢复组会默认模板')
    },
    addMeetingParticipant(name) {
      if (!name || !name.trim()) return null
      name = name.trim()
      if (this.meetingParticipants.some(p => p.name === name)) return null
      const colorIndex = this.meetingParticipants.length % PARTICIPANT_COLORS.length
      const person = {
        id: uid(),
        name,
        color: PARTICIPANT_COLORS[colorIndex],
        sortOrder: this.meetingParticipants.length,
      }
      this.meetingParticipants.push(person)
      save('meetingParticipants', this.meetingParticipants)
      useLogStore().addLog(`添加参与人员：${name}`)
      return person
    },
    deleteMeetingParticipant(id) {
      const person = this.meetingParticipants.find(p => p.id === id)
      const name = person?.name || id
      this.meetingParticipants = this.meetingParticipants.filter(p => p.id !== id)
      this.meetingParticipants.forEach((p, i) => { p.sortOrder = i })
      save('meetingParticipants', this.meetingParticipants)
      useLogStore().addLog(`删除参与人员：${name}`)
    },
    updateMeetingParticipant(id, updates) {
      const person = this.meetingParticipants.find(p => p.id === id)
      if (person) {
        Object.assign(person, updates)
        save('meetingParticipants', this.meetingParticipants)
      }
    },
    reorderMeetingParticipants(fromIndex, toIndex) {
      const list = this.meetingParticipants
      if (fromIndex < 0 || fromIndex >= list.length) return
      if (toIndex < 0 || toIndex >= list.length) return
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      list.forEach((p, i) => { p.sortOrder = i })
      save('meetingParticipants', list)
    },
    addParticipantGroup(name) {
      if (!name || !name.trim()) return null
      name = name.trim()
      const group = {
        id: uid(),
        name,
        sortOrder: this.participantGroups.length,
      }
      this.participantGroups.push(group)
      save('participantGroups', this.participantGroups)
      useLogStore().addLog(`添加参与人员分组：${name}`)
      return group
    },
    deleteParticipantGroup(id) {
      const group = this.participantGroups.find(g => g.id === id)
      const name = group?.name || id
      // 将该组下人员的 groupId 清空
      this.meetingParticipants.forEach(p => {
        if (p.groupId === id) p.groupId = null
      })
      save('meetingParticipants', this.meetingParticipants)
      this.participantGroups = this.participantGroups.filter(g => g.id !== id)
      this.participantGroups.forEach((g, i) => { g.sortOrder = i })
      save('participantGroups', this.participantGroups)
      useLogStore().addLog(`删除参与人员分组：${name}`)
    },
    updateParticipantGroup(id, updates) {
      const group = this.participantGroups.find(g => g.id === id)
      if (group) {
        Object.assign(group, updates)
        save('participantGroups', this.participantGroups)
      }
    },
    reorderParticipantGroups(fromIndex, toIndex) {
      const list = this.participantGroups
      if (fromIndex < 0 || fromIndex >= list.length) return
      if (toIndex < 0 || toIndex >= list.length) return
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      list.forEach((g, i) => { g.sortOrder = i })
      save('participantGroups', list)
    },
    saveAcademicProgress(progress, breakdown) {
      this.academicProgress = progress
      this.academicBreakdown = breakdown
      this.academicLastModified = nowStr()
      save('academicProgress', progress)
      save('academicBreakdown', breakdown)
      save('academicLastModified', this.academicLastModified)
      useLogStore().addLog('更新学业进度')
    },
    setAppVersion(version) {
      this.appVersion = version
      save('appVersion', version)
      useLogStore().addLog(`设置版本号：${version}`)
    },
    // 静默兜底升级：仅当目标版本高于当前版本号时才更新（不写操作日志）�?    // 用于修复老用�? localStorage 残留旧版本号、load 默认值不生效的问�?
    ensureAppVersion(version) {
      if (compareVersions(version, this.appVersion) > 0) {
        this.appVersion = version
        save('appVersion', version)
      }
    },
    setAutoBackupEnabled(enabled) {
      this.autoBackupEnabled = !!enabled
      save('autoBackupEnabled', this.autoBackupEnabled)
      useLogStore().addLog(`自动备份${this.autoBackupEnabled ? '开启' : '关闭'}`)
    },
    addChangelog(version, content, time) {
      const existing = this.changelog.find(e => e.version === version)
      if (existing) {
        // 幂等：同版本已存在时只更新内容，避免重复条目；显式传�?time 时同步更新时�?        existing.content = content
        if (time) existing.time = time
      } else {
        this.changelog.unshift({
          version,
          time: time || nowStr(),
          content,
        })
        if (this.changelog.length > 100) this.changelog = this.changelog.slice(0, 100)
        // 新版本写入：延迟结算，仅推��本批次中的朢�高版本（避免历史版本补种/播种时消息中心刷屏）
        scheduleUpdateNotify(version)
      }
      // 按版本号倒序排列（最新版本在朢�上面�?
      this.changelog.sort((a, b) => compareVersions(b.version, a.version))
      try {
        save('changelog', this.changelog)
      } catch (e) {
        console.warn('[addChangelog] 保存 changelog 失败（可能存储配额不足）:', e)
      }
      // 自动同步状��栏版本号为朢�高更新版本（避免旧版本播种覆盖新版本号）
      if (compareVersions(version, this.appVersion) > 0) {
        this.appVersion = version
        try {
          save('appVersion', version)
        } catch (e) {
          console.warn('[addChangelog] 保存 appVersion 失败（可能存储配额不足）:', e)
        }
      }
    },
    // 对现有更新记录按版本号��序排列
    sortChangelog() {
      this.changelog.sort((a, b) => compareVersions(b.version, a.version))
      save('changelog', this.changelog)
    },
    setCustomDate(dateStr) {
      this.customDate = dateStr
      save('customDate', dateStr)
    },
    setCustomWeek(weekNum) {
      this.customWeek = weekNum
      save('customWeek', weekNum)
    },
    updateTheme(themeUpdates) {
      Object.assign(this.theme, themeUpdates)
      save('theme', this.theme)
      useLogStore().addLog('更新主题配色')
    },
    // 融合态导航：记录/更新某个路由页面的二�?Tab 选择
    setActiveSubTab(path, tabId) {
      if (!path || !tabId) return
      this.activeSubTabs = { ...this.activeSubTabs, [path]: tabId }
      save('activeSubTabs', this.activeSubTabs)
    },
    setAvatarImage(imageData) {
      this.avatarImage = imageData
      save('avatarImage', imageData)
      useLogStore().addLog(imageData ? '更新个人头像' : '移除个人头像')
    },
    reorderNav(fromIndex, toIndex) {
      const order = [...this.navOrder]
      if (fromIndex < 0 || fromIndex >= order.length) return
      if (toIndex < 0 || toIndex >= order.length) return
      const [moved] = order.splice(fromIndex, 1)
      order.splice(toIndex, 0, moved)
      this.navOrder = order
      save('navOrder', order)
      useLogStore().addLog('调整导航栏排序')
    },
    reorderSettingsModules(fromIndex, toIndex) {
      const order = [...this.settingsModuleOrder]
      if (fromIndex < 0 || fromIndex >= order.length) return
      if (toIndex < 0 || toIndex >= order.length) return
      const [moved] = order.splice(fromIndex, 1)
      order.splice(toIndex, 0, moved)
      this.settingsModuleOrder = order
      save('settingsModuleOrder', order)
    },
    setPdfOpener(opener) {
      this.pdfOpener = opener
      save('pdfOpener', opener)
    },
    setPdfOpenerPath(path) {
      this.pdfOpenerPath = path
      save('pdfOpenerPath', path)
    },
    setBridgeSaveDir(dir) {
      this.bridgeSaveDir = dir
      save('bridgeSaveDir', dir)
    },
    savePlanOverview(overview) {
      this.planOverview = overview
      save('planOverview', overview)
    },
    // 计划中心自定义配�?
        setPlanStatuses(statuses) {
      this.planStatuses = statuses
      save('planStatuses', statuses)
    },
    setPlanCategories(categories) {
      this.planCategories = categories
      save('planCategories', categories)
    },
    setPlanLevels(levels) {
      this.planLevels = levels
      save('planLevels', levels)
    },
    setPlanPriorities(priorities) {
      this.planPriorities = priorities
      save('planPriorities', priorities)
    },
    resetPlanConfig() {
      this.planStatuses = [...DEFAULT_PLAN_STATUSES]
      this.planCategories = [...DEFAULT_PLAN_CATEGORIES]
      this.planLevels = [...DEFAULT_PLAN_LEVELS]
      this.planPriorities = [...DEFAULT_PLAN_PRIORITIES]
      this.subtaskColors = [...DEFAULT_SUBTASK_COLORS]
      this.planReminder = { ...DEFAULT_PLAN_REMINDER }
      save('planStatuses', this.planStatuses)
      save('planCategories', this.planCategories)
      save('planLevels', this.planLevels)
      save('planPriorities', this.planPriorities)
      save('subtaskColors', this.subtaskColors)
      save('planReminder', this.planReminder)
    },
    // 子任务填充色自定义配�?
        setSubtaskColors(colors) {
      this.subtaskColors = colors
      save('subtaskColors', colors)
    },
    resetSubtaskColors() {
      this.subtaskColors = [...DEFAULT_SUBTASK_COLORS]
      save('subtaskColors', this.subtaskColors)
    },
    setPlanVisibleColumns(columns) {
      this.planVisibleColumns = columns
      save('planVisibleColumns', columns)
    },
    // 计划库消息中心提醒配置
    setPlanReminder(patch) {
      this.planReminder = { ...this.planReminder, ...patch }
      save('planReminder', this.planReminder)
    },
    resetPlanReminder() {
      this.planReminder = { ...DEFAULT_PLAN_REMINDER }
      save('planReminder', this.planReminder)
    },
    // 任务板块自定义配�?
        setTaskCategories(categories) {
      this.taskCategories = categories
      save('taskCategories', categories)
    },
    setTaskPriorities(priorities) {
      this.taskPriorities = priorities
      save('taskPriorities', priorities)
    },
    setTaskStates(states) {
      this.taskStates = states
      save('taskStates', states)
    },
    resetTaskConfig() {
      this.taskCategories = [...TASK_CATEGORIES]
      this.taskPriorities = [...DEFAULT_TASK_PRIORITIES]
      this.taskStates = [...DEFAULT_TASK_STATES]
      save('taskCategories', this.taskCategories)
      save('taskPriorities', this.taskPriorities)
      save('taskStates', this.taskStates)
    },
    // 数据导出 - 导出全部 localStorage 数据为 JSON
    // 直接使用原始 localStorage 字符串，避免 JSON.parse/JSON.stringify
    // 二次编码导致大字段（如 base64 头像）损坏
    // @returns {Object} { exportedAt, version, data, detail: { totalModules, totalSize, modules: [{key,name,count,size}] } }
    exportAllData() {
      const allData = {}
      const prefix = 'mw_'
      const modules = []
      let totalSize = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key.startsWith(prefix)) {
          const raw = localStorage.getItem(key)
          allData[key] = raw
          const bare = key.slice(prefix.length)
          let count = 1
          try {
            const v = JSON.parse(raw)
            if (Array.isArray(v)) count = v.length
            else if (v && typeof v === 'object') count = Object.keys(v).length
          } catch {}
          totalSize += (raw || '').length
          modules.push({ key: bare, name: moduleNameOf(bare), count, size: (raw || '').length })
        }
      }
      modules.sort((a, b) => b.size - a.size)
      return {
        exportedAt: nowStr(),
        version: '1.0',
        data: allData,
        detail: { totalModules: modules.length, totalSize, modules },
      }
    },
    // ===== 版本回滚：快照与恢复 =====
    /**
     * 升级/导入前自动保护：写入本地文件夹快照备份。��?     *
     * v5.0.165 起：
     * - 不再写入 localStorage rollbackHistory（易占满浏览器存储导致保存失败）；
     * @param {string} label 快照说明，如「升级至 5.0.165 前（自动快照）」
     */
    snapshotForRollback(label) {
      try {
        // 文件存储濢�活时，写丢�份完整快照到本地文件�?backups/
        if (isFileStorageActive()) {
          writeSnapshotBackup(label || '快照').catch(() => {})
        }
        return { id: uid(), label: label || '快照', at: nowStr(), data: {} }
      } catch (e) {
        console.warn('[rollback] 创建快照失败:', e)
        return null
      }
    },
    /**
     * 删除单个回滚快照（释�?localStorage 空间�?     */
    deleteSnapshot(id) {
      const history = load('rollbackHistory', [])
      const rest = history.filter(s => s.id !== id)
      saveSync('rollbackHistory', rest)
      this.rollbackHistory = rest
      useLogStore().addLog(`删除版本回滚快照：${id}`)
      return { ok: true }
    },
    /**
     * 回���到指定快照：恢复快照中记录的扢�有模块，快照未包含的当前数据保留不删�?     * @param {string} id 快照 id
     */
    rollbackToSnapshot(id) {
      const history = load('rollbackHistory', [])
      const snap = history.find(s => s.id === id)
      if (!snap) return { ok: false, reason: '未找到该快照' }
      try {
        const prefix = 'mw_'
        const data = snap.data || {}
        let count = 0
        for (const [key, raw] of Object.entries(data)) {
          // 防御：跳�?null / undefined 值，避免把目标键写成 'null' 造成数据污染
          if (raw === null || raw === undefined || raw === 'null' || raw === 'undefined') continue
          const finalKey = key.startsWith(prefix) ? key : prefix + key
          localStorage.setItem(finalKey, String(raw))
          count++
        }
        // 回滚后版本号跟随快照，状态栏显示回���到的版本
        if (snap.version && snap.version !== '未知') {
          localStorage.setItem(prefix + 'appVersion', JSON.stringify(snap.version))
          this.appVersion = snap.version
        }
        // 移除已使用的快照，避免重复回逢�造成困惑
        const rest = history.filter(s => s.id !== id)
        localStorage.setItem(prefix + 'rollbackHistory', JSON.stringify(rest))
        this.rollbackHistory = rest
        useLogStore().addLog(`版本回滚：恢复快照「${snap.label}」（${count} 个模块）`)
        const reload = () => window.location.reload()
        if (isFileStorageActive()) {
          migrateToFileStorage().then(reload, reload)
        } else {
          reload()
        }
        return { ok: true, count }
      } catch (e) {
        console.error('[rollback] 回滚失败:', e)
        return { ok: false, reason: e.message }
      }
    },
    /**
     * 从本地文件夹 backups/ 中的备份文件恢复（v3 单文件夹方案主回退通道）
     * @param {string} name 备份文件名（�?auto_backup_2026-08-12T10-30-00.json�?     */
    async restoreFromFileBackup(name) {
      const backup = await readBackupFile(name)
      if (!backup || !backup.data || typeof backup.data !== 'object') {
        return { ok: false, reason: '无法读取备份文件或备份内容无效' }
      }
      // 恢复前自动保存当前数据（可反悔）
      this.snapshotForRollback('回退备份前（自动快照）')
      const result = this.importAllData(backup)
      if (result.ok && isFileStorageActive()) {
        await migrateToFileStorage().catch(e => console.warn('[rollback] 文件同步失败:', e))
      }
      useLogStore().addLog(`从文件备份恢复：「${name}」（${result.success} 个模块）`)
      return { ...result, fromFile: name }
    },
    // 数据导入 - 从 JSON 对象导入数据（合并式，不删除导入文件中没有的模块）
    // 兼容两种格式：包装格式 { exportedAt, data: {...} } 和扁平格式 { mw_xxx: "..." }
    importAllData(jsonData) {
      const emptyResult = { ok: false, total: 0, success: 0, failed: 0, modules: [], keptModules: [] }
      if (!jsonData) return emptyResult
      // 判断格式：包装格式有 .data 属��，扁平格式直接�?mw_ 弢�头的�?
      let importData = null
      if (jsonData.data && typeof jsonData.data === 'object') {
        importData = jsonData.data
      } else {
        // 扁平格式：取扢��?mw_ 弢�头的�?        importData = {}
        for (const [key, value] of Object.entries(jsonData)) {
          if (key.startsWith('mw_')) importData[key] = value
        }
      }
      if (Object.keys(importData).length === 0) return emptyResult
      try {
        // 导入前自动创建回滚快照：即使导入异常，也能一键恢复导入前数据
        this.snapshotForRollback('导入 JSON 前（自动快照）')
        const prefix = 'mw_'
        const result = { ok: true, total: Object.keys(importData).length, success: 0, failed: 0, skipped: 0, modules: [], keptModules: [] }
        // 记录当前已存在的键，导入后未被覆盖的模块将原样保留（不再清空删除，杜绝数据丢失）
        const existingKeys = new Set()
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(prefix)) existingKeys.add(key)
        }
        for (const [key, value] of Object.entries(importData)) {
          // 键统丢�补上 mw_ 前缀，避免写入后应用读取不到
          const finalKey = key.startsWith(prefix) ? key : prefix + key
          const moduleKey = finalKey.slice(prefix.length)
          // 防御：��为 null / undefined / 空串 时跳过不覆盖，避免把现有数据覆盖�?'null' 造成丢失
          if (value === null || value === undefined || value === '') {
            result.modules.push({ key: moduleKey, name: moduleNameOf(moduleKey), status: 'skipped', reason: '值为空，已跳过（保留现有数据）' })
            result.skipped++
            continue
          }
          try {
            // 值统丢�转为序列化字符串�?            // - 对象/数组 �?JSON.stringify
            // - 字符串已是合�?JSON（如 "abc"、{...}、[...]）→ 原样保留
            // - 普��字符串（自动备份格式解析后的裸字符串）�?包一层引号再�?
            let stored
            if (typeof value === 'string') {
              try { JSON.parse(value); stored = value } catch { stored = JSON.stringify(value) }
            } else {
              stored = JSON.stringify(value)
            }
            localStorage.setItem(finalKey, stored)
            result.modules.push({ key: moduleKey, name: moduleNameOf(moduleKey), status: 'success' })
            result.success++
            existingKeys.delete(finalKey)
          } catch (e) {
            result.modules.push({ key: moduleKey, name: moduleNameOf(moduleKey), status: 'failed', reason: e.message || '写入失败' })
            result.failed++
          }
        }
        // 未被导入文件覆盖的原有模块：保留不删除，避免导入部分备份时丢失其他数据
        result.keptModules = [...existingKeys].map(k => ({ key: k.slice(prefix.length), name: moduleNameOf(k.slice(prefix.length)) }))
        // 若已绑定本地存储文件夹，同步导入后的数据到硬盘（不阻塞，reload 由调用方控制�?
        if (isFileStorageActive()) {
          migrateToFileStorage().catch(e => console.warn('[import] 文件存储同步失败:', e))
        }
        return result
      } catch (e) {
        console.error('数据导入失败:', e)
        return { ...emptyResult, error: e.message || '导入异常' }
      }
    },
    // 清除扢�有数�?
        clearAllData() {
      const prefix = 'mw_'
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key.startsWith(prefix)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
      window.location.reload()
    },
  },
})

// ============================================================
// 雷达图数据计�?// ============================================================
export function useRadarData() {
  const pointsStore = usePointsStore()
  const tasksStore = useTasksStore()
  const papersStore = usePapersStore()
  const researchStore = useResearchStore()

  const today = todayStr()
  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')

  // 科研进度
  const weekMeetings = researchStore.meetings.filter(m => m.date >= weekStart).length
  const activePapers = papersStore.activePapers.length
  const researchScore = Math.min(100, weekMeetings * 15 + activePapers * 25)

  // 其他维度暂用默认值，后续版本扩展
  return [
    { name: '科研进度', value: researchScore },
    { name: '身体健康', value: 60 },
    { name: '人际联系', value: 50 },
    { name: '兴趣输入', value: 40 },
  { name: '智能提升', value: 55 },
    { name: '财务状况', value: 65 },
  ]
}

// ============================================================
// 操作日志
// ============================================================
export const useLogStore = defineStore('log', {
  state: () => ({
    logs: load('operationLogs', []),
  }),
  actions: {
    addLog(action) {
      this.logs.unshift({
        id: this.logs.length + 1,
        time: nowStr(),
        action,
      })
      // 只保留最�?00�?
      if ( this.logs.length > 500) {
        this.logs = this.logs.slice(0, 500)
      }
      save('operationLogs', this.logs)
    },
    clearLogs() {
      this.logs = []
      save('operationLogs', [])
    },
    exportExcel() {
      // 生成 CSV（Excel可直接打弢��?
      const header = '\uFEFF编号,时间,操作记录\n'
      const rows = this.logs.map(log =>
        `${log.id},${log.time},"${log.action.replace(/"/g, '""')}"`
      ).join('\n')
      const csv = header + rows
      saveTextToFile(`操作日志_${todayStr()}.csv`, csv, 'text/csv;charset=utf-8')
    },
  },
})

// ============================================================
// 论文笔记（含文件夹）
// ============================================================
export const usePaperNotesStore = defineStore('paperNotes', {
  state: () => ({
    notes: load('paperNotes', []),
    folders: load('paperNoteFolders', []),
  }),
  getters: {
    notesByPaperId() {
      return (paperId) => this.notes.filter(n => n.paperId === paperId).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
    },
    recentNotes() {
      return [...this.notes].sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')).slice(0, 5)
    },
    // 根文件夹
    rootFolders() {
      return this.folders.filter(f => !f.parentId).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    },
    // 子文件夹
    childFolders() {
      return (parentId) => this.folders.filter(f => f.parentId === parentId).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    },
    // 指定文件夹下的笔�?
        notesInFolder() {
      return (folderId) => {
        if (folderId === '__uncategorized') return this.notes.filter(n => !n.folderId).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
        // 递归获取子文件夹ID
        const childIds = new Set()
        const collect = (pid) => {
          this.folders.filter(f => f.parentId === pid).forEach(f => { childIds.add(f.id); collect(f.id) })
        }
        collect(folderId)
        return this.notes.filter(n => n.folderId === folderId || childIds.has(n.folderId)).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
      }
    },
  },
  actions: {
    // ---- 笔记 CRUD ----
    addNote(note) {
      const newNote = {
        id: uid(),
        paperId: note.paperId || '',
        folderId: note.folderId || '',
      title: note.title || '无标题',
        content: note.content || '',
        createdAt: nowStr(),
        updatedAt: nowStr(),
      }
      this.notes.unshift(newNote)
      save('paperNotes', this.notes)
      useLogStore().addLog(`添加论文笔记：《${note.title}》`)
      return newNote
    },
    updateNote(id, updates) {
      const note = this.notes.find(n => n.id === id)
      if (note) {
        Object.assign(note, updates)
        note.updatedAt = nowStr()
        save('paperNotes', this.notes)
        useLogStore().addLog(`更新论文笔记：《${note.title}》`)
      }
    },
    deleteNote(id) {
      const note = this.notes.find(n => n.id === id)
      const title = note?.title || id
      this.notes = this.notes.filter(n => n.id !== id)
      save('paperNotes', this.notes)
      useLogStore().addLog(`删除论文笔记：《${title}》`)
    },
    // ---- 文件�?CRUD ----
    addFolder(name, parentId = '') {
      const folder = { id: uid(), name, parentId: parentId || '', createdAt: nowStr() }
      this.folders.push(folder)
      save('paperNoteFolders', this.folders)
      return folder
    },
    renameFolder(id, name) {
      const f = this.folders.find(x => x.id === id)
      if (f) { f.name = name; save('paperNoteFolders', this.folders) }
    },
    deleteFolder(id) {
      // 子文件夹和笔记移到根目录
      this.folders.filter(f => f.parentId === id).forEach(f => { f.parentId = '' })
      this.notes.filter(n => n.folderId === id).forEach(n => { n.folderId = '' })
      this.folders = this.folders.filter(f => f.id !== id)
      save('paperNoteFolders', this.folders)
      save('paperNotes', this.notes)
    },
    moveNote(noteId, targetFolderId) {
      const note = this.notes.find(n => n.id === noteId)
      if (note) {
        note.folderId = targetFolderId || ''
        note.updatedAt = nowStr()
        save('paperNotes', this.notes)
      }
    },
  },
})

// ============================================================
// 论文阅读（v5.0.185 新增：记录阅读论文的细节、笔记）
// ============================================================
export const usePaperReadingsStore = defineStore('paperReadings', {
  state: () => ({
    readings: load('paperReadings', []),
    nextSeq: load('paperReadingsNextSeq', 1),                    // 固定编号计数器
    visibleColumns: load('paperReadingsColumns', ['title', 'year', 'researchObject', 'researchPurpose', 'researchMethod', 'innovation', 'referenceIdeas']),
    customFields: load('paperReadingsCustomFields', []),         // 用户自定义字段
    sortDirection: load('paperReadingsSortDirection', 'desc'),   // desc = 后添加的放上面（默认）
    sortField: load('paperReadingsSortField', 'createdAt'),      // 排序字段，默认按添加时间
  }),
  getters: {
    sortedReadings() {
      const list = [...this.readings]
      const dir = this.sortDirection === 'asc' ? 1 : -1
      const field = this.sortField || 'createdAt'
      list.sort((a, b) => {
        const va = (a[field] || '').toString()
        const vb = (b[field] || '').toString()
        return dir * va.localeCompare(vb, 'zh-CN')
      })
      return list
    },
  },
  actions: {
    allTags() {
      const tags = new Set()
      this.readings.forEach(r => {
        if (r.tags && Array.isArray(r.tags)) r.tags.forEach(t => tags.add(t))
      })
      return [...tags].sort()
    },
    addReading(reading) {
      const seq = this.nextSeq
      this.nextSeq = seq + 1
      save('paperReadingsNextSeq', this.nextSeq)
      const newRecord = {
        id: uid(),
        seq,
        paperId: reading.paperId || '',
        title: reading.title || '',
        year: reading.year || '',
        researchObject: reading.researchObject || '',
        researchPurpose: reading.researchPurpose || '',
        researchMethod: reading.researchMethod || '',
        innovation: reading.innovation || '',
        referenceIdeas: reading.referenceIdeas || '',
        tags: reading.tags || [],
        createdAt: nowStr(),
        updatedAt: nowStr(),
      }
      this.readings.unshift(newRecord)
      save('paperReadings', this.readings)
      useLogStore().addLog(`添加论文阅读记录：《${newRecord.title}》`)
      return newRecord
    },
    updateReading(id, updates) {
      const rec = this.readings.find(r => r.id === id)
      if (rec) {
        Object.assign(rec, updates)
        rec.updatedAt = nowStr()
        save('paperReadings', this.readings)
        useLogStore().addLog(`更新论文阅读记录：《${rec.title}》`)
      }
    },
    deleteReading(id) {
      const rec = this.readings.find(r => r.id === id)
      const title = rec?.title || id
      this.readings = this.readings.filter(r => r.id !== id)
      save('paperReadings', this.readings)
      useLogStore().addLog(`删除论文阅读记录：《${title}》`)
    },
    setVisibleColumns(columns) {
      this.visibleColumns = columns
      save('paperReadingsColumns', columns)
    },
    setSortDirection(dir) {
      this.sortDirection = dir
      save('paperReadingsSortDirection', dir)
    },
    setSortField(field) {
      this.sortField = field
      save('paperReadingsSortField', field)
    },
    deleteTag(tag) {
      if (!tag) return
      this.readings.forEach(r => {
        if (r.tags && Array.isArray(r.tags)) {
          r.tags = r.tags.filter(t => t !== tag)
        }
      })
      save('paperReadings', this.readings)
    },
    addCustomField(field) {
      const newField = {
        key: 'custom_' + uid().slice(0, 8),
      label: field.label || '新字段',
        type: field.type || 'text',
        required: false,
        enabled: true,
      }
      this.customFields.push(newField)
      // 自动添加到可见列
      if (!this.visibleColumns.includes(newField.key)) {
        this.visibleColumns = [...this.visibleColumns, newField.key]
        save('paperReadingsColumns', this.visibleColumns)
      }
      save('paperReadingsCustomFields', this.customFields)
      return newField
    },
    updateCustomField(key, updates) {
      const f = this.customFields.find(cf => cf.key === key)
      if (f) { Object.assign(f, updates); save('paperReadingsCustomFields', this.customFields) }
    },
    deleteCustomField(key) {
      this.customFields = this.customFields.filter(cf => cf.key !== key)
      // 同时从可见列中移�?
      this.visibleColumns = this.visibleColumns.filter(c => c !== key)
      save('paperReadingsColumns', this.visibleColumns)
      save('paperReadingsCustomFields', this.customFields)
    },
  },
})

// ============================================================
// 财务中心（v5.0.194 新增�?// ============================================================
const DEFAULT_FINANCE_CATEGORIES = [
  { id: 'food',          name: '餐饮',   color: '#F97316', icon: 'coffee',
    children: [
      { id: 'food_breakfast', name: '早餐', color: '#F97316', icon: 'coffee' },
      { id: 'food_lunch',      name: '午餐', color: '#F97316', icon: 'coffee' },
      { id: 'food_dinner',     name: '晚餐', color: '#F97316', icon: 'coffee' },
      { id: 'food_snack',      name: '零食', color: '#F97316', icon: 'coffee' },
    ]
  },
  { id: 'transport',     name: '交通',   color: '#3B82F6', icon: 'car',
    children: [
      { id: 'transport_bus',     name: '公交',  color: '#3B82F6', icon: 'car' },
      { id: 'transport_subway',   name: '地铁',  color: '#3B82F6', icon: 'car' },
      { id: 'transport_taxi',     name: '打车',  color: '#3B82F6', icon: 'car' },
      { id: 'transport_fuel',    name: '加油',  color: '#3B82F6', icon: 'car' },
    ]
  },
  { id: 'study',         name: '学习',   color: '#8B5CF6', icon: 'book',
    children: [
      { id: 'study_book',      name: '书籍',  color: '#8B5CF6', icon: 'book' },
      { id: 'study_course',    name: '课程',  color: '#8B5CF6', icon: 'book' },
      { id: 'study_stationery',name: '文具',  color: '#8B5CF6', icon: 'book' },
    ]
  },
  { id: 'daily',         name: '生活',   color: '#10B981', icon: 'shopping-bag',
    children: [
  { id: 'daily_grocery',  name: '日用品', color: '#10B981', icon: 'shopping-bag' },
      { id: 'daily_clothing', name: '服饰',   color: '#10B981', icon: 'shopping-bag' },
      { id: 'daily_rent',     name: '房租',   color: '#10B981', icon: 'shopping-bag' },
      { id: 'daily_utility', name: '水电',   color: '#10B981', icon: 'shopping-bag' },
    ]
  },
  { id: 'entertainment', name: '娱乐',   color: '#EC4899', icon: 'gamepad-2',
    children: [
      { id: 'ent_movie', name: '电影',  color: '#EC4899', icon: 'gamepad-2' },
      { id: 'ent_game',  name: '游戏',  color: '#EC4899', icon: 'gamepad-2' },
      { id: 'ent_travel',name: '旅行',  color: '#EC4899', icon: 'gamepad-2' },
    ]
  },
  { id: 'medical',      name: '医疗',   color: '#EF4444', icon: 'heart-pulse', children: [] },
  { id: 'other',         name: '其他',   color: '#6B7280', icon: 'wallet', children: [] },
]

export const useFinanceStore = defineStore('finance', {
  state: () => ({
    // 账目列表：{ id, seq, category, subCategory, amount, type, date, ledger, currency, note, createdAt }
    entries: load('financeEntries', []),
    nextSeq: load('financeNextSeq', 1),
    categories: load('financeCategories', [...DEFAULT_FINANCE_CATEGORIES]),
    // 默认账本
    ledgers: load('financeLedgers', ['日常账本', '生活费', '奖学金', '兼职收入']),
    // 默认币种列表
    currencies: load('financeCurrencies', ['CNY', 'USD', 'EUR', 'JPY', 'GBP']),
    sortOrder: load('financeSortOrder', 'date'),       // 'date' | 'amount' | 'category' | 'createdAt'
    sortDirection: load('financeSortDirection', 'desc'), // 'asc' | 'desc'
    // 预算配置：月度预算上限（0 = 不限制）
    monthlyBudget: load('financeMonthlyBudget', 0),
    // 货币符号（全局默认，单条记录可覆盖）
    currency: load('financeCurrency', '¥'),
  }),
  getters: {
    sortedEntries() {
      const list = [...this.entries]
      const dir = this.sortDirection === 'asc' ? 1 : -1
      const field = this.sortOrder || 'date'
      list.sort((a, b) => {
        if (field === 'amount') return dir * (Number(a.amount) - Number(b.amount))
        if (field === 'category') return dir * (a.category || '').localeCompare(b.category || '', 'zh-CN')
        const va = String(a[field] || '')
        const vb = String(b[field] || '')
        return dir * va.localeCompare(vb, 'zh-CN')
      })
      return list
    },
    // 当月支出
    monthExpense() {
      const month = dayjs().format('YYYY-MM')
      return this.entries
        .filter(e => e.type !== 'income' && String(e.date || '').startsWith(month))
        .reduce((sum, e) => sum + Number(e.amount) || 0, 0)
    },
    // 当月收入
    monthIncome() {
      const month = dayjs().format('YYYY-MM')
      return this.entries
        .filter(e => e.type === 'income' && String(e.date || '').startsWith(month))
        .reduce((sum, e) => sum + Number(e.amount) || 0, 0)
    },
    // 本周支出
    weekExpense() {
      const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')
      return this.entries
        .filter(e => e.type !== 'income' && String(e.date || '') >= weekStart)
        .reduce((sum, e) => sum + Number(e.amount) || 0, 0)
    },
    // 总支�?
        totalExpense() {
      return this.entries
        .filter(e => e.type !== 'income')
        .reduce((sum, e) => sum + Number(e.amount) || 0, 0)
    },
    // 总收�?
        totalIncome() {
      return this.entries
        .filter(e => e.type === 'income')
        .reduce((sum, e) => sum + Number(e.amount) || 0, 0)
    },
    // 凢�结余
    balance() {
      return this.totalIncome - this.totalExpense
    },
    // 按分类汇总支�?
        categorySummary() {
      const summary = {}
      for (const cat of this.categories) {
        summary[cat.id] = { ...cat, amount: 0, count: 0 }
      }
      for (const e of this.entries) {
        if (e.type === 'income') continue
        if (summary[e.category]) {
          summary[e.category].amount += Number(e.amount) || 0
          summary[e.category].count++
        } else {
          // 兜底分类
          summary[e.category] = { id: e.category, name: e.category, color: '#6B7280', amount: Number(e.amount) || 0, count: 1 }
        }
      }
      return Object.values(summary).sort((a, b) => b.amount - a.amount)
    },
    // 无参的分类查找移到 actions 中（见下：getCategory / getSubCategory / getCategoryDisplayName / getCategoryColor / getCategoryIcon）
    // 预算使用率
    budgetUsage() {
      if (!this.monthlyBudget || this.monthlyBudget <= 0) return 0
      return Math.round((this.monthExpense / this.monthlyBudget) * 100)
    },
    // 预算剩余
    budgetRemaining() {
      if (!this.monthlyBudget || this.monthlyBudget <= 0) return 0
      return this.monthlyBudget - this.monthExpense
    },
    // 朢��?N �?
        recentEntries() {
      return (n = 5) => [...this.entries]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, n)
    },
  },
  actions: {
    // 分类查找（一级），支持带子分�?
        getCategory(id) {
      for (const c of this.categories) {
        if (c.id === id) return c
        if (c.children) {
          const sub = c.children.find(s => s.id === id)
          if (sub) return { ...sub, parentName: c.name, parentColor: c.color }
        }
      }
      return { id, name: id, color: '#6B7280', icon: 'wallet' }
    },
    // 子分类查�?
        getSubCategory(parentId, subId) {
      const parent = this.categories.find(c => c.id === parentId)
      if (parent && parent.children) {
        return parent.children.find(s => s.id === subId) || null
      }
      return null
    },
    // 获取分类的显示名（含二级分类�?
        getCategoryDisplayName(entry) {
      const cat = this.getCategory(entry.category)
      if (entry.subCategory) {
        const sub = this.getSubCategory(entry.category, entry.subCategory)
        if (sub) return `${cat.name}-${sub.name}`
      }
      return cat.name || entry.category
    },
    // 获取分类颜色
    getCategoryColor(entry) {
      if (entry.subCategory) {
        const sub = this.getSubCategory(entry.category, entry.subCategory)
        if (sub) return sub.color
      }
      const cat = this.getCategory(entry.category)
      return cat.color || '#6B7280'
    },
    // 获取分类图标
    getCategoryIcon(entry) {
      const cat = this.getCategory(entry.category)
      return cat.icon || 'wallet'
    },
    addEntry(entry) {
      const seq = this.nextSeq
      this.nextSeq = seq + 1
      save('financeNextSeq', this.nextSeq)
      this.entries.unshift({
        id: uid(),
        seq,
        category: entry.category || 'other',
        subCategory: entry.subCategory || '',
        amount: Number(entry.amount) || 0,
        type: entry.type || 'expense',
        date: entry.date || todayStr(),
        ledger: entry.ledger || this.ledgers[0] || '日常账本',
        currency: entry.currency || 'CNY',
        note: entry.note || '',
        createdAt: nowStr(),
      })
      save('financeEntries', this.entries)
      useLogStore().addLog(`添加账目${entry.type === 'income' ? '收入' : '支出'} ${entry.amount}元`)
    },
    updateEntry(id, updates) {
      const entry = this.entries.find(e => e.id === id)
      if (entry) {
        Object.assign(entry, updates)
        if (updates.amount !== undefined) entry.amount = Number(updates.amount) || 0
        save('financeEntries', this.entries)
      useLogStore().addLog(`更新账目${entry.note || entry.category}`)
      }
    },
    deleteEntry(id) {
      this.entries = this.entries.filter(e => e.id !== id)
      save('financeEntries', this.entries)
      useLogStore().addLog('删除账目记录')
    },
    addCategory(cat) {
      // 如果指定�?parentId，添加为二级分类
      if (cat.parentId) {
        const parent = this.categories.find(c => c.id === cat.parentId)
        if (parent) {
          if (!parent.children) parent.children = []
          const newSub = {
            id: 'sub_' + uid().slice(0, 8),
      name: cat.name || '新分类',
            color: cat.color || parent.color || '#6B7280',
            icon: cat.icon || parent.icon || 'wallet',
          }
          parent.children.push(newSub)
          save('financeCategories', this.categories)
          return newSub
        }
      }
      // 否则添加丢�级分�?
      const newCat = {
        id: 'cat_' + uid().slice(0, 8),
      name: cat.name || '新分类',
        color: cat.color || '#6B7280',
        icon: cat.icon || 'wallet',
        children: [],
      }
      this.categories.push(newCat)
      save('financeCategories', this.categories)
      return newCat
    },
    updateCategory(id, updates) {
      const cat = this.categories.find(c => c.id === id)
      if (cat) { Object.assign(cat, updates); save('financeCategories', this.categories) }
      else {
        // 可能在子分类�?
        for ( const parent of this.categories) {
          if (parent.children) {
            const sub = parent.children.find(s => s.id === id)
            if (sub) { Object.assign(sub, updates); save('financeCategories', this.categories); break }
          }
        }
      }
    },
    deleteCategory(id) {
      // 先检查是否是丢�级分�?
      const idx = this.categories.findIndex(c => c.id === id)
      if (idx >= 0) {
        // 将使用该分类的账目移到��其他��?
        this.entries.forEach(e => { if (e.category === id) { e.category = 'other'; e.subCategory = '' } })
        this.categories.splice(idx, 1)
      } else {
        // 删除二级分类
        for (const parent of this.categories) {
          if (parent.children) {
            const subIdx = parent.children.findIndex(s => s.id === id)
            if (subIdx >= 0) {
              this.entries.forEach(e => { if (e.subCategory === id) e.subCategory = '' })
              parent.children.splice(subIdx, 1)
              break
            }
          }
        }
      }
      save('financeCategories', this.categories)
      save('financeEntries', this.entries)
    },
    // 账本管理
    addLedger(name) {
      if (!this.ledgers.includes(name)) {
        this.ledgers.push(name)
        save('financeLedgers', this.ledgers)
      }
    },
    removeLedger(name) {
      this.ledgers = this.ledgers.filter(l => l !== name)
      save('financeLedgers', this.ledgers)
    },
    // 币种管理
    addCurrency(code) {
      if (!this.currencies.includes(code)) {
        this.currencies.push(code)
        save('financeCurrencies', this.currencies)
      }
    },
    removeCurrency(code) {
      this.currencies = this.currencies.filter(c => c !== code)
      save('financeCurrencies', this.currencies)
    },
    setSortOrder(order) {
      this.sortOrder = order
      save('financeSortOrder', order)
    },
    setSortDirection(dir) {
      this.sortDirection = dir
      save('financeSortDirection', dir)
    },
    setMonthlyBudget(amount) {
      this.monthlyBudget = Number(amount) || 0
      save('financeMonthlyBudget', this.monthlyBudget)
    },
    setCurrency(symbol) {
      this.currency = symbol
      save('financeCurrency', symbol)
    },
    // 解析 CSV 为条目数组（不保存）
    parseCSVToEntries(text) {
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) return { entries: [], skipped: 0 }
      lines[0] = lines[0].replace(/^\uFEFF/, '')
      const header = lines[0].split(',').map(h => h.trim())
      const entries = [], skipped = []
      for (let i = 1; i < lines.length; i++) {
        try {
          const cells = this._parseCSVLine(lines[i])
          if (cells.length < 5) { skipped.push(i); continue }
          const catName = cells[1]
          const subCatName = cells[2] || ''
          const typeName = cells[3]
          const amount = parseFloat(cells[4]) || 0
          const currency = cells[5] || 'CNY'
          const date = cells[6] || todayStr()
          const ledger = cells[7] || ''
          const note = cells[8] || ''
          const { catId, subCatId } = this._resolveCategory(catName, subCatName)
          entries.push({
            type: typeName === '收入' ? 'income' : 'expense',
            amount, category: catId, subCategory: subCatId,
            date, ledger: ledger || this.ledgers[0] || '日常账本',
            currency: currency || 'CNY', note,
          })
        } catch { skipped.push(i) }
      }
      return { entries, skipped: skipped.length }
    },
    // 解析 Excel 为条目数组（不保存）
    async parseExcelToEntries(file) {
      try {
        const XLSX = await import('xlsx')
        const data = await file.arrayBuffer()
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        if (rows.length < 2) return { entries: [], skipped: 0 }
        const header = rows[0].map(h => String(h || '').trim())
        const colMap = {}
        header.forEach((h, i) => {
          if (h.includes('分类')) colMap.category = i
          else if (h.includes('二级')) colMap.subCategory = i
          else if (h.includes('类型')) colMap.type = i
          else if (h.includes('金额')) colMap.amount = i
          else if (h.includes('币种')) colMap.currency = i
          else if (h.includes('时间') || h.includes('日期')) colMap.date = i
          else if (h.includes('账本')) colMap.ledger = i
          else if (h.includes('备注') || h.includes('说明')) colMap.note = i
        })
        const entries = [], skipped = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue
          try {
            const catName = colMap.category !== undefined ? String(row[colMap.category] || '').trim() : ''
            const subCatName = colMap.subCategory !== undefined ? String(row[colMap.subCategory] || '').trim() : ''
            const typeName = colMap.type !== undefined ? String(row[colMap.type] || '').trim() : ''
            const amount = colMap.amount !== undefined ? parseFloat(row[colMap.amount]) || 0 : 0
            const currency = colMap.currency !== undefined ? String(row[colMap.currency] || '').trim() : 'CNY'
            const date = colMap.date !== undefined ? String(row[colMap.date] || '').trim() : todayStr()
            const ledger = colMap.ledger !== undefined ? String(row[colMap.ledger] || '').trim() : ''
            const note = colMap.note !== undefined ? String(row[colMap.note] || '').trim() : ''
            if (!catName && !amount) { skipped.push(i); continue }
            const { catId, subCatId } = this._resolveCategory(catName, subCatName)
            entries.push({
              type: typeName.includes('收入') ? 'income' : 'expense',
              amount, category: catId, subCategory: subCatId,
              date, ledger: ledger || this.ledgers[0] || '日常账本',
              currency: currency || 'CNY', note,
            })
          } catch { skipped.push(i) }
        }
        return { entries, skipped: skipped.length }
      } catch (e) {
        console.error('[parseExcelToEntries] Error:', e)
        return { entries: [], skipped: 0, error: String(e) }
      }
    },
    // 批量添加条目
    batchAddEntries(entryList) {
      let added = 0
      for (const entry of entryList) {
        this.entries.unshift({
          id: uid(),
          seq: this.nextSeq,
          category: entry.category || 'other',
          subCategory: entry.subCategory || '',
          amount: Number(entry.amount) || 0,
          type: entry.type || 'expense',
          date: entry.date || todayStr(),
          ledger: entry.ledger || this.ledgers[0] || '日常账本',
          currency: entry.currency || 'CNY',
          note: entry.note || '',
          createdAt: nowStr(),
        })
        this.nextSeq++
        added++
      }
      save('financeEntries', this.entries)
      save('financeNextSeq', this.nextSeq)
      useLogStore().addLog(`批量导入 ${added} 条财务记录`)
      return { added }
    },
    // 内部：按分类名解析为 id
    _resolveCategory(catName, subCatName) {
      let catId = 'other', subCatId = ''
      const found = this.categories.find(c => c.name === catName || c.id === catName)
      if (found) {
        catId = found.id
        if (subCatName && found.children) {
          const sub = found.children.find(s => s.name === subCatName)
          if (sub) subCatId = sub.id
        }
      }
      return { catId, subCatId }
    },
    exportCSV() {
      const header = '\uFEFF编号,分类,二级分类,类型,金额,币种,日期,账本,备注\n'
      const rows = this.sortedEntries.map(e => {
        const catName = this.getCategory(e.category).name || e.category
        const subCatName = e.subCategory ? (this.getSubCategory(e.category, e.subCategory)?.name || '') : ''
        const typeName = e.type === 'income' ? '收入' : '支出'
        return `${e.seq},${catName},${subCatName},${typeName},${e.amount},${e.currency || 'CNY'},${e.date},${e.ledger || ''},"${(e.note || '').replace(/"/g, '""')}"`
      }).join('\n')
      const csv = header + rows
      saveTextToFile(`财务记录_${todayStr()}.csv`, csv, 'text/csv;charset=utf-8')
    },
    importCSV(text) {
      // 箢��?CSV 解析：支持从导出�?CSV 重新导入
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) return { added: 0, skipped: 0 }
      // 跳过 BOM
      lines[0] = lines[0].replace(/^\uFEFF/, '')
      const header = lines[0].split(',').map(h => h.trim())
      let added = 0, skipped = 0
      for (let i = 1; i < lines.length; i++) {
        try {
          const cells = this._parseCSVLine(lines[i])
          if (cells.length < 5) { skipped++; continue }
          const seq = parseInt(cells[0], 10) || this.nextSeq
          const catName = cells[1]
          const subCatName = cells[2] || ''
          const typeName = cells[3]
          const amount = parseFloat(cells[4]) || 0
          const currency = cells[5] || 'CNY'
          const date = cells[6]
          const ledger = cells[7] || ''
          const note = cells[8] || ''
          // 按分类名�?id
          let catId = 'other', subCatId = ''
          const found = this.categories.find(c => c.name === catName)
          if (found) {
            catId = found.id
            if (subCatName && found.children) {
              const sub = found.children.find(s => s.name === subCatName)
              if (sub) subCatId = sub.id
            }
          }
          this.entries.unshift({
            id: uid(),
            seq: this.nextSeq,
            category: catId,
            subCategory: subCatId,
            amount,
            type: typeName === '收入' ? 'income' : 'expense',
            date,
            ledger: ledger || this.ledgers[0] || '日常账本',
            currency: currency || 'CNY',
            note,
            createdAt: nowStr(),
          })
          this.nextSeq++
          added++
        } catch { skipped++ }
      }
      save('financeEntries', this.entries)
      save('financeNextSeq', this.nextSeq)
      return { added, skipped }
    },
    async importExcel(file) {
      try {
        const XLSX = await import('xlsx')
        const data = await file.arrayBuffer()
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        if (rows.length < 2) return { added: 0, skipped: 0 }
        // 读取表头做列映射
        const header = rows[0].map(h => String(h || '').trim())
        const colMap = {}
        header.forEach((h, i) => {
          if (h.includes('分类')) colMap.category = i
          else if (h.includes('二级')) colMap.subCategory = i
          else if (h.includes('类型')) colMap.type = i
          else if (h.includes('金额')) colMap.amount = i
          else if (h.includes('币种')) colMap.currency = i
          else if (h.includes('时间') || h.includes('日期')) colMap.date = i
          else if (h.includes('账本')) colMap.ledger = i
          else if (h.includes('备注') || h.includes('说明')) colMap.note = i
        })
        let added = 0, skipped = 0
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue
          try {
            const catName = colMap.category !== undefined ? String(row[colMap.category] || '').trim() : ''
            const subCatName = colMap.subCategory !== undefined ? String(row[colMap.subCategory] || '').trim() : ''
            const typeName = colMap.type !== undefined ? String(row[colMap.type] || '').trim() : ''
            const amount = colMap.amount !== undefined ? parseFloat(row[colMap.amount]) || 0 : 0
            const currency = colMap.currency !== undefined ? String(row[colMap.currency] || '').trim() : 'CNY'
            const date = colMap.date !== undefined ? String(row[colMap.date] || '').trim() : todayStr()
            const ledger = colMap.ledger !== undefined ? String(row[colMap.ledger] || '').trim() : ''
            const note = colMap.note !== undefined ? String(row[colMap.note] || '').trim() : ''
            if (!catName && !amount) { skipped++; continue }
            let catId = 'other', subCatId = ''
            const found = this.categories.find(c => c.name === catName || c.id === catName)
            if (found) {
              catId = found.id
              if (subCatName && found.children) {
                const sub = found.children.find(s => s.name === subCatName)
                if (sub) subCatId = sub.id
              }
            }
            this.entries.unshift({
              id: uid(),
              seq: this.nextSeq,
              category: catId,
              subCategory: subCatId,
              amount,
              type: typeName.includes('收入') ? 'income' : 'expense',
              date,
              ledger: ledger || this.ledgers[0] || '日常账本',
              currency: currency || 'CNY',
              note,
              createdAt: nowStr(),
            })
            this.nextSeq++
            added++
          } catch { skipped++ }
        }
        save('financeEntries', this.entries)
        save('financeNextSeq', this.nextSeq)
        return { added, skipped }
      } catch (e) {
        console.error('[importExcel] Error:', e)
        return { added: 0, skipped: 0, error: String(e) }
      }
    },
    async exportExcel() {
      try {
        const XLSX = await import('xlsx')
        const data = this.sortedEntries.map(e => {
          const catName = this.getCategory(e.category).name || e.category
          const subCatName = e.subCategory ? (this.getSubCategory(e.category, e.subCategory)?.name || '') : ''
          return {
            '编号': e.seq,
            '分类': catName,
            '二级分类': subCatName,
            '类型': e.type === 'income' ? '收入' : '支出',
            '金额': e.amount,
            '币种': e.currency || 'CNY',
            '时间': e.date,
            '账本': e.ledger || '',
            '备注': e.note || '',
          }
        })
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '财务记录')
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `财务记录_${todayStr()}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch (e) {
        console.error('[exportExcel] Error:', e)
        alert('导出 Excel 失败: ' + e)
      }
    },
    _parseCSVLine(line) {
      const result = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"') {
            if (line[i + 1] === '"') { cur += '"'; i++ }
            else inQuotes = false
          } else cur += ch
        } else {
          if (ch === '"') inQuotes = true
          else if (ch === ',') { result.push(cur); cur = '' }
          else cur += ch
        }
      }
      result.push(cur)
      return result
    },
  },
})

// ============================================================
// 信息库（v5.0.199 新增，v5.0.205 字段重构，v5.0.206 编号前缀+自定义配置升级）
// 五大类：软件订阅 subscriptions / 团购 groupbuys / 资产 assets / 卡证 cards / 手机套餐 plans
// 每类独立集合 + 独立编号，统丢�提供增删改查
// ============================================================
export const INFO_TYPES = [
  { id: 'subscription', name: '软件订阅', icon: 'subscriptions', prefix: 'R' },
  { id: 'groupbuy',     name: '团购',     icon: 'users',          prefix: 'T' },
  { id: 'asset',        name: '资产',     icon: 'package',        prefix: 'Z' },
  { id: 'card',         name: '卡证',     icon: 'credit-card',    prefix: 'K' },
  { id: 'plan',         name: '手机套餐', icon: 'smartphone',      prefix: 'P' },
]

// 各类型编号前缢�映射
export const INFO_PREFIX_MAP = {
  subscription: 'R',
  groupbuy: 'T',
  asset: 'Z',
  card: 'K',
  plan: 'P',
}

// 各类型在 store 中的 state key �? localStorage key 映射
//（state �?seq key 是缩写如 subNextSeq，localStorage key �?infoSubNextSeq�?
const INFO_STORE_MAP = {
  subscription: { listKey: 'subscriptions', seqKey: 'subNextSeq',   storageList: 'infoSubscriptions', storageSeq: 'infoSubNextSeq' },
  groupbuy:     { listKey: 'groupbuys',     seqKey: 'groupNextSeq', storageList: 'infoGroupbuys',   storageSeq: 'infoGroupNextSeq' },
  asset:        { listKey: 'assets',        seqKey: 'assetNextSeq', storageList: 'infoAssets',      storageSeq: 'infoAssetNextSeq' },
  card:         { listKey: 'cards',         seqKey: 'cardNextSeq',  storageList: 'infoCards',       storageSeq: 'infoCardNextSeq' },
  plan:         { listKey: 'plans',         seqKey: 'planNextSeq',  storageList: 'infoPlans',       storageSeq: 'infoPlanNextSeq' },
}

// 各类型可自定义��项的默认��（用户可新�?删除/排序/修改名称，持久化�? localStorage�?// 存储格式：{ key: [{ id, name, isPreset }] }，预置项 isPreset=true，自定义�?isPreset=false
// 部分选项支持自定义颜色（如资产状态），存储为 { id, name, isPreset, color }
export const INFO_CUSTOM_DEFAULTS = {
  // 会员等级
  subLevel: ['VIP', 'SVIP'],
  // 订阅分类：日会员 / 月会�?/ 年续包月 / 年会�?/ 连续包年 / 永久会员
  subCategory: ['日会员', '月会员', '年续包月', '年会员', '连续包年', '永久会员'],
  // 付费周期：单次付 / 日付 / 月付 / 年付
  subCycle: ['单次买', '日付', '月付', '年付'],
  groupPlatform: ['美团', '抖音', '大众点评', '京东', '淘宝', '支付宝'],
  // 团购状态
  groupStatus: ['未使用', '已使用', '已过期'],
  // 卡证类型,
  // 卡证类型
  cardType: ['会员卡', '银行卡', '交通卡', '储蓄卡', '礼品卡', '身份证', '驾驶证'],
  // 资产购买渠道
  assetStatus: ['服役中', '已淘汰', '维修中', '已报废', '闲置中'],
}

// 霢�要自定义颜色的��项及其默认颜色映射
const INFO_CUSTOM_COLORS = {
  assetStatus: {
  '服役中': '#10B981',
  '已淘汰': '#6B7280',
  '维修中': '#F59E0B',
  '已报废': '#EF4444',
  '闲置中': '#3B82F6',
  },
}

// 兼容旧导�?
export
 const INFO_CUSTOM_OPTIONS = INFO_CUSTOM_DEFAULTS

export const useInfoStore = defineStore('info', {
  state: () => ({
    // 软件订阅：{ id, seq, name, level, category, cycle, amount, startDate, expireDate, remind, note, createdAt }
    subscriptions: load('infoSubscriptions', []),
    subNextSeq: load('infoSubNextSeq', 1),
    // 团购：{ id, seq, name, merchant, platform, availableTime, couponCode, amount, status, remind, note, createdAt }
    groupbuys: load('infoGroupbuys', []),
    groupNextSeq: load('infoGroupNextSeq', 1),
    // 资产：{ id, seq, name, brand, model, purchaseDate, warrantyDate, price, channel, status, location, note, createdAt }
    assets: load('infoAssets', []),
    assetNextSeq: load('infoAssetNextSeq', 1),
    // 卡证：{ id, seq, name, type, amount, issueDate, expireDate, permanent, remind, note, createdAt }
    cards: load('infoCards', []),
    cardNextSeq: load('infoCardNextSeq', 1),
    // 手机套餐：{ id, seq, name, carrier, planType, price, data, expireDate, note, createdAt }
    plans: load('infoPlans', []),
    planNextSeq: load('infoPlanNextSeq', 1),
    // 自定义��项（按 key 存储，对象数组格�?{ id, name, isPreset }�?    // v5.0.206：从纯字符串数组迁移为对象数组，预置项可改名�?
    customOptions: load('infoCustomOptions', null),
    // 当前濢�活的类型（页面切换）
    activeType: 'subscription',
  }),
  getters: {
    // 当前类型的中文名
    typeName() {
      const t = INFO_TYPES.find(t => t.id === this.activeType)
      return t ? t.name : '软件订阅'
    },
    // 当前类型对应的数据列表（按到期日期升序，朢�近的在前�?
        currentList() {
      const m = INFO_STORE_MAP[this.activeType]
      const list = (m ? this[m.listKey] : this[this.activeType + 's']) || []
      // 霢��?：默认按到期日期升序（永久有效排朢�后，无日期排朢�后）
      return [...list].sort((a, b) => {
        const aPermanent = a.permanent
        const bPermanent = b.permanent
        if (aPermanent && !bPermanent) return 1
        if (!aPermanent && bPermanent) return -1
        if (aPermanent && bPermanent) return 0
        const aDate = a.expireDate || a.availableTime || ''
        const bDate = b.expireDate || b.availableTime || ''
        if (!aDate && !bDate) return 0
        if (!aDate) return 1
        if (!bDate) return -1
        return aDate.localeCompare(bDate)
      })
    },
    // 当前类型对应编号
    nextSeq() {
      const m = INFO_STORE_MAP[this.activeType]
      return m ? this[m.seqKey] : this[this.activeType + 'NextSeq']
    },
    // 某��项 key 的完整��项列表（对象数组，含预置和自定义）
    // 首次访问时自动从旧格式迁移或初始化默认值
    optionList() {
    return (key) => {
        this._ensureOptions(key)
        return this.customOptions[key] || []
      }
    },
    // 某选项 key 的名称列表（纯字符串，供 select 渲染）
    optionNames() {
    return (key) => {
        this._ensureOptions(key)
        return (this.customOptions[key] || []).map(o => o.name)
      }
    },
  },
  actions: {
    // ===== 内部：初始化/迁移自定义��项 =====
     _ensureOptions(key) {
      if (!this.customOptions) this.customOptions = {}
      const existing = this.customOptions[key]
      // 已是对象数组格式
      if (Array.isArray(existing) && existing.length > 0 && typeof existing[0] === 'object') {
        // 回填颜色：已有对象但缺少 color 字段（从旧版本升级时�?
        const colorMap = INFO_CUSTOM_COLORS[key]
        if (colorMap) {
          let changed = false
          existing.forEach(item => {
            if (!item.color && colorMap[item.name]) {
              item.color = colorMap[item.name]
              changed = true
            }
          })
          if (changed) save('infoCustomOptions', this.customOptions)
        }
        return
      }
      // 旧格式（纯字符串数组）或空，迁移/初始�?
      const defaults = INFO_CUSTOM_DEFAULTS[key] || []
      const oldCustom = (Array.isArray(existing) && existing.length > 0 && typeof existing[0] === 'string') ? existing : []
      const colorMap = INFO_CUSTOM_COLORS[key]
      const items = defaults.map((name, i) => {
        const item = { id: 'preset_' + key + '_' + i, name, isPreset: true }
        if (colorMap && colorMap[name]) item.color = colorMap[name]
        return item
      })
      oldCustom.forEach((name, i) => { if (!defaults.includes(name)) items.push({ id: 'custom_' + key + '_' + i, name, isPreset: false }) })
      this.customOptions[key] = items
      save('infoCustomOptions', this.customOptions)
    },
    // ===== 自定义��项管理 =====
     addCustomOption(key, value) {
      const v = String(value || '').trim()
      if (!v) return false
      this._ensureOptions(key)
      if ((this.customOptions[key] || []).some(o => o.name === v)) return false
      const newItem = { id: uid(), name: v, isPreset: false }
      // 支持颜色的��项默认给灰�?
      if (INFO_CUSTOM_COLORS[key]) newItem.color = '#6B7280'
      this.customOptions[key].push(newItem)
      save('infoCustomOptions', this.customOptions)
      return true
    },
    updateOptionColor(key, id, color) {
      this._ensureOptions(key)
      const item = (this.customOptions[key] || []).find(o => o.id === id)
      if (item) { item.color = color; save('infoCustomOptions', this.customOptions) }
    },
    updateOptionName(key, id, newName) {
      const v = String(newName || '').trim()
      if (!v) return
      this._ensureOptions(key)
      const item = (this.customOptions[key] || []).find(o => o.id === id)
      if (item) { item.name = v; save('infoCustomOptions', this.customOptions) }
    },
    deleteOption(key, id) {
      this._ensureOptions(key)
      const list = this.customOptions[key] || []
      // 预置项至少保�?1 �?
      const presetCount = list.filter(o => o.isPreset).length
      const item = list.find(o => o.id === id)
      if (!item) return
      if (item.isPreset && presetCount <= 1) return false
      this.customOptions[key] = list.filter(o => o.id !== id)
      save('infoCustomOptions', this.customOptions)
      return true
    },
    moveOption(key, fromIndex, toIndex) {
      this._ensureOptions(key)
      const list = this.customOptions[key] || []
      if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return
      const [item] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, item)
      save('infoCustomOptions', this.customOptions)
    },
    // ===== 通用增删�?=====
    addItem(type, data) {
      const m = INFO_STORE_MAP[type]
      if (!m) return
      const prefix = INFO_PREFIX_MAP[type] || ''
      const seq = this[m.seqKey]
      this[m.seqKey] = seq + 1
      const item = {
        id: uid(),
        seq,
        seqLabel: prefix + seq,
        ...data,
        createdAt: nowStr(),
      }
      this[m.listKey].unshift(item)
      save(m.storageList, this[m.listKey])
      save(m.storageSeq, this[m.seqKey])
      useLogStore().addLog(`添加任务：《${task.title}》`)
      return item
    },
    updateItem(type, id, updates) {
      const m = INFO_STORE_MAP[type]
      if (!m) return
      const item = this[m.listKey].find(i => i.id === id)
      if (item) {
        Object.assign(item, updates)
        save(m.storageList, this[m.listKey])
        useLogStore().addLog(`更新任务：《${task.title}》`)
      }
    },
    deleteItem(type, id) {
      const m = INFO_STORE_MAP[type]
      if (!m) return
      this[m.listKey] = this[m.listKey].filter(i => i.id !== id)
      save(m.storageList, this[m.listKey])
      useLogStore().addLog(`删除${moduleNameOf(m.storageList)}`)
    },
    setActiveTab(type) {
      this.activeType = type
    },
  },
})
