<template>
    <div class="app-container" :class="{ 'is-compact': isCompact, 'is-narrow': isNarrow, 'floating-nav': isFloatingNav, 'merge-nav': isMergeNav, 'has-bg-image': !!settingsStore.backgroundImage, 'module-frosted': settingsStore.moduleFrosted, 'topbar-frosted': settingsStore.topBarEffect === 'frosted', 'topbar-float': settingsStore.topBarEffect === 'float' }" :style="{ '--module-opacity': settingsStore.moduleOpacity, '--topbar-opacity': settingsStore.topBarOpacity }">
    <!-- 背景图：覆盖状态栏以下区域 -->
    <div v-if="settingsStore.backgroundImage" class="bg-image" :style="{ backgroundImage: 'url(' + settingsStore.backgroundImage + ')', opacity: settingsStore.backgroundImageOpacity ?? 0.12 }"></div>
    <div v-else class="bg-overlay"></div>

    <!-- 已登录：侧边栏导航 + 主内容区 -->
    <template v-if="settingsStore.isLoggedIn">
    <!-- 侧边栏导航 -->
    <aside class="sidebar" v-if="!isMergeNav" :class="{ pinned: settingsStore.sidebarPinned, 'nav-floating': isFloatingNav }" :style="{ '--nav-opacity': settingsStore.navOpacity }">
      <nav class="sidebar-nav">
        <router-link
          v-for="r in mainRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-item"
          :class="{ active: $route.path === r.path }"
        >
          <span class="nav-icon"><AppIcon :name="r.meta.icon" :size="20" /></span>
          <span v-if="sidebarVisible || isFloatingNav" class="nav-label">{{ r.meta.title }}</span>
        </router-link>
      </nav>
      <!-- 底部：Logo + 版本号（悬浮岛式时隐藏，移至顶部状态栏） -->
      <div class="sidebar-bottom-brand" v-if="!isFloatingNav">
        <img class="sidebar-logo" src="/hean-logo.png" alt="牛马科技" />
        <span class="sidebar-brand-text">牛马科技</span>
        <span class="sidebar-version" :class="{ clickable: isTauri }" @click="isTauri && manualCheckUpdate()" :title="isTauri ? '检查更新' : ''">Version：{{ settingsStore.appVersion }}</span>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content" v-if="settingsStore.isLoggedIn" :style="{ '--sub-nav-opacity': settingsStore.subNavOpacity, '--module-opacity': settingsStore.moduleOpacity, '--topbar-opacity': settingsStore.topBarOpacity }">
      <!-- 顶部状态栏 -->
      <header class="top-bar" :class="{ 'has-floating-brand': isFloatingNav || isMergeNav }" data-tauri-drag-region @mousedown="onTitlebarDragStart">
        <span v-if="isFloatingNav || isMergeNav" class="topbar-brand" @click="$router.push('/')" title="牛马科技">
          <img class="topbar-logo" src="/hean-logo.png" alt="牛马科技" />
          <span class="topbar-brand-side">
            <span class="topbar-brand-text">牛马科技</span>
            <span class="topbar-version" :class="{ clickable: isTauri }" @click.stop="isTauri && manualCheckUpdate()" :title="isTauri ? '检查更新' : ''">v{{ settingsStore.appVersion }}</span>
          </span>
        </span>
        <div class="top-bar-left" data-tauri-drag-region>
          <span class="top-bar-title" data-tauri-drag-region>研究生工作平台</span>
        </div>
        <div class="top-bar-right">
          <div class="date-area" @click="toggleDatePicker" title="点击自定义日期和周数">
            <div class="status-item">
              <span class="status-label">今日</span>
              <span class="status-value">{{ displayDate }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">第</span>
              <span class="status-value">{{ semesterWeek }}周</span>
            </div>
            <AppIcon name="chevron-down" :size="12" class="date-arrow" :class="{ open: showDatePicker }" />
            <!-- 日期/周数选择弹窗 -->
            <div v-if="showDatePicker" class="date-picker-popup" @click.stop>
              <div class="date-picker-header">
                <span>日期与周数</span>
                <button class="date-reset-btn" @click="resetCustomDate" title="恢复为今天"><AppIcon name="rotate-ccw" :size="14" /> 恢复默认</button>
              </div>
              <!-- 月视图日历 -->
              <div class="month-calendar">
                <div class="month-nav">
                  <button class="month-nav-btn" @click="prevMonth"><AppIcon name="chevron-left" :size="16" /></button>
                  <span class="month-title">{{ calendarMonth.format('YYYY年M月') }}</span>
                  <button class="month-nav-btn" @click="nextMonth"><AppIcon name="chevron-right" :size="16" /></button>
                </div>
                <div class="weekday-row">
                  <span v-for="w in weekDays" :key="w" class="weekday-cell">{{ w }}</span>
                </div>
                <div class="calendar-grid">
                  <button
                    v-for="(d, idx) in calendarDays"
                    :key="idx"
                    class="calendar-day"
                    :class="{
                      'is-today': d && d.isToday,
                      'is-selected': d && d.isSelected,
                      'is-other-month': d && d.isOtherMonth,
                      'is-empty': !d
                    }"
                    :disabled="!d"
                    @click="d && pickCalendarDate(d.dateStr)"
                  >{{ d ? d.day : '' }}</button>
                </div>
              </div>
              <!-- 周数自定义 -->
              <div class="week-custom-row">
                <label class="week-label">自定义周数</label>
                <div class="week-input-group">
                  <button class="week-btn" @click="decrementWeek">−</button>
                  <input
                    type="number"
                    class="week-input"
                    :value="editingWeek"
                    min="1"
                    max="52"
                    @input="onWeekInput"
                  />
                  <button class="week-btn" @click="incrementWeek">+</button>
                </div>
              </div>
            </div>
          </div>
          <button class="message-center-btn" @click="openMessageCenter" title="消息中心">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span v-if="messageStore.unreadCount > 0" class="message-badge">{{ messageStore.unreadCount > 99 ? '99+' : messageStore.unreadCount }}</span>
          </button>
          <div class="avatar-area" @click="toggleLogoutMenu" title="当前账号: {{ settingsStore.loginUsername }}">
            <div class="avatar-icon">
              <img v-if="settingsStore.avatarImage" :src="settingsStore.avatarImage" alt="头像" class="avatar-icon-img" />
              <span v-else>{{ settingsStore.loginUsername?.charAt(0) || '?' }}</span>
            </div>
            <div v-if="showLogoutMenu" class="logout-menu" @click.stop>
              <div class="logout-user">{{ settingsStore.loginUsername }}</div>
              <div class="logout-session">
                <span>本次登录 {{ loginAtText }}</span>
                <span :class="{ warn: sessionExpiringSoon }">登录态剩余 {{ sessionRemainText }}</span>
              </div>
              <button class="menu-item" @click="openProfile"><AppIcon name="user" :size="16" class="menu-icon" />个人信息</button>
              <button class="menu-item" @click="openPlatformDoc"><AppIcon name="file-text" :size="16" class="menu-icon" />平台文档</button>
              <button class="menu-item" @click="openAbout"><AppIcon name="info" :size="16" class="menu-icon" />关于平台</button>
              <div class="menu-divider"></div>
              <button class="logout-btn" @click="doLogout">退出登录</button>
            </div>
          </div>
          <!-- 桌面端窗口控制按钮 -->
          <div v-if="isTauri" class="window-controls">
            <button class="window-ctrl-btn" @click="minimizeWindow" title="最小化">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"/></svg>
            </button>
            <button class="window-ctrl-btn" @click="maximizeWindow" title="最大化/还原">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
            </button>
            <button class="window-ctrl-btn window-close-btn" @click="closeWindow" title="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
            </button>
          </div>
        </div>
      </header>

      <!-- 路由视图 -->
      <div class="page-content">
        <!-- 融合态导航：一级导航条（水平居中） -->
        <div v-if="showLevel1Nav" class="merge-nav-bar merge-nav-l1">
          <div class="merge-nav-pill">
            <button
              v-for="r in mainRoutes"
              :key="r.path"
              class="merge-nav-btn"
              :class="{ active: $route.path === r.path }"
              @click="mergeNavClick(r.path)"
            >
              <span class="merge-nav-icon"><AppIcon :name="r.meta.icon" :size="18" /></span>
              <span class="merge-nav-label">{{ r.meta.title }}</span>
            </button>
          </div>
        </div>
        <!-- 融合态导航：二级导航条（含主页按钮） -->
        <div v-if="showLevel2Nav" class="merge-nav-bar merge-nav-l2">
          <div class="merge-nav-pill">
            <button class="merge-nav-home-btn" @click="mergeNavHome" title="返回主页导航">
              <AppIcon name="home" :size="16" />
              <span class="merge-nav-home-label">主页</span>
            </button>
            <span class="merge-nav-divider"></span>
            <button
              v-for="tab in currentSubTabs"
              :key="tab.id"
              class="merge-nav-btn"
              :class="{ active: currentActiveSubTab === tab.id }"
              @click="mergeNavSubTab(tab.id)"
            >
              {{ tab.name }}
            </button>
          </div>
        </div>
        <!-- 本地存储权限恢复提醒 -->
        <div v-if="needsStorageRegrant" class="storage-regrant-banner" @click="regrantStorage">
          <span><AppIcon name="folder-open" />  上次使用的本地存储文件夹「{{ storageFolderName }}」需要重新授权，点击恢复</span>
        </div>
        <!-- 未绑定本地文件夹提示：数据仅存浏览器缓存有丢失风险 -->
        <div v-if="showFileStorageHint" class="storage-hint-banner" @click="goSettings">
          <span><AppIcon name="alert-triangle" />  数据仅保存在浏览器缓存中，建议到「平台设置」绑定本地文件夹并启用自动备份，防止电脑关闭/清缓存导致数据丢失</span>
          <span class="storage-hint-arrow">前往设置 →</span>
        </div>
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </main>

    </template>

    <!-- 未登录 → 显示登录页 -->
    <LoginView v-else />

    <!-- 晨间强制弹窗（仅登录后显示） -->
    <MorningPopup v-if="settingsStore.isLoggedIn && showMorningPopup" @close="closeMorningPopup" />

    <!-- 操作日志弹窗 -->
    <div v-if="showLogModal" class="modal-overlay" @click.self="handleLogOverlay">
      <div class="modal-content" style="max-width: 640px; max-height: 80vh;">
        <div style="padding: 24px;">
          <div class="modal-header">
            <h3 class="modal-title"><AppIcon name="file-text" />  操作日志</h3>
            <div class="modal-header-actions">
              <button class="btn btn-sm btn-primary" @click="logStore.exportExcel()"><AppIcon name="download" />  导出Excel</button>
              <button class="soft-btn-close modal-close-inline" @click="showLogModal = false" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
          <div style="max-height: 50vh; overflow-y: auto;">
            <table class="log-table" v-if="logStore.logs.length > 0">
              <thead>
                <tr>
                  <th style="width:60px">编号</th>
                  <th style="width:140px">时间</th>
                  <th>操作记录</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in logStore.logs" :key="log.id">
                  <td class="log-id">{{ log.id }}</td>
                  <td class="log-time">{{ log.time }}</td>
                  <td class="log-action">{{ log.action }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state" style="padding: 32px;">
              <div class="empty-state-icon"><AppIcon name="file-text" /> </div>
              <p>暂无操作记录</p>
            </div>
          </div>
          <div v-if="logStore.logs.length > 0" style="display: flex; justify-content: flex-end; margin-top: 12px;">
            <button class="btn btn-sm btn-ghost" @click="logStore.clearLogs()">清空日志</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 消息中心弹窗 -->
    <div v-if="showMessageModal" class="modal-overlay" @click.self="handleMessageOverlay">
      <div class="modal-content" style="max-width: 560px; max-height: 80vh;">
        <div style="padding: 24px 24px 12px;">
          <div class="modal-header">
            <h3 class="modal-title"><AppIcon name="bell" />  消息中心 <span v-if="messageStore.unreadCount > 0" class="msg-unread-badge">{{ messageStore.unreadCount }} 条未读</span></h3>
            <div class="modal-header-actions">
              <button class="btn btn-sm btn-secondary" @click="messageStore.markAllRead()">全部已读</button>
              <button class="btn btn-sm btn-ghost" @click="messageStore.clearAll()">清空全部</button>
              <button class="soft-btn-close modal-close-inline" @click="showMessageModal = false" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
          <!-- 分类筛选 -->
          <div class="msg-tabs">
            <button class="msg-tab" :class="{ active: msgFilter === 'all' }" @click="msgFilter = 'all'">全部<span class="msg-tab-count">{{ messageStore.messages.length }}</span></button>
            <button class="msg-tab" :class="{ active: msgFilter === 'unread' }" @click="msgFilter = 'unread'">未读<span class="msg-tab-count">{{ messageStore.unreadCount }}</span></button>
            <button class="msg-tab" :class="{ active: msgFilter === 'read' }" @click="msgFilter = 'read'">已读<span class="msg-tab-count">{{ messageStore.messages.length - messageStore.unreadCount }}</span></button>
          </div>
          <div style="max-height: 48vh; overflow-y: auto;">
            <div v-if="filteredMessages.length > 0" class="message-list">
              <div v-for="msg in filteredMessages" :key="msg.id" class="message-item" :class="[{ unread: !msg.read }, msgCardClass(msg)]" @click="messageStore.markRead(msg.id)">
                <div class="message-icon"><AppIcon :name="msgIcon(msg)" :size="18" /></div>
                <div class="message-main">
                  <div class="message-header">
                    <span class="message-title">{{ msg.title }}<span v-if="!msg.read" class="msg-unread-dot"></span></span>
                    <span class="message-time">{{ msg.createdAt }}</span>
                  </div>
                  <div class="message-content">{{ msg.content }}</div>
                </div>
                <div class="message-actions">
                  <button v-if="msg.action === 'viewChangelog'" class="message-action-btn message-action-link" title="查看更新日志" @click.stop="showChangelogModal = true; messageStore.markRead(msg.id)">
                    <AppIcon name="scroll-text" :size="14" />
                  </button>
                  <button class="message-action-btn" title="标记已读" @click.stop="messageStore.markRead(msg.id)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button class="message-action-btn message-action-danger" title="删除" @click.stop="messageStore.deleteMessage(msg.id)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 32px;">
              <div class="empty-state-icon"><AppIcon name="bell" /> </div>
              <p>{{ msgFilter === 'all' ? '暂无消息' : (msgFilter === 'unread' ? '没有未读消息' : '没有已读消息') }}</p>
            </div>
          </div>
          <div class="msg-footer">
            <span class="msg-footer-hint">共 {{ messageStore.messages.length }} 条消息 · 未读 {{ messageStore.unreadCount }} 条</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 计划临近提醒弹窗 -->
    <div v-if="showDeadlineModal" class="modal-overlay" @click.self="handleDeadlineOverlay">
      <div class="modal-content" style="max-width: 520px; max-height: 80vh;">
        <div style="padding: 24px;">
          <div class="modal-header">
            <h3 class="modal-title"><AppIcon name="clock" />  计划任务临近提醒</h3>
            <button class="soft-btn-close modal-close-inline" @click="showDeadlineModal = false" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <p style="margin-bottom: 16px; color: var(--color-text-secondary); font-size: 13px;">
            以下任务距离结束时间还有 {{ planRemindDaysAhead }} 天或更短（剩 {{ planUrgentThreshold }} 天以内为紧急，红色标注），请及时处理：
          </p>
          <div style="max-height: 50vh; overflow-y: auto;">
            <div class="deadline-list">
              <div v-for="plan in deadlinePlans" :key="plan.id" class="deadline-item">
                <div class="deadline-main">
                  <span class="deadline-seq">#{{ plan.seq }}</span>
                  <span class="deadline-title">{{ plan.title }}</span>
                </div>
                <div class="deadline-meta">
                  <span class="deadline-end">截止：{{ formatDateTime(plan.endDate) }}</span>
                  <span class="deadline-days" :class="plan.daysLeft <= planUrgentThreshold ? 'urgent' : (plan.daysLeft <= planRemindDaysAhead ? 'warn' : '')">{{ plan.daysLeft === 0 ? '今天截止' : '还剩 ' + plan.daysLeft + ' 天' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 16px; gap: 8px;">
            <button class="btn btn-sm btn-ghost" @click="showDeadlineModal = false">我知道了</button>
            <button class="btn btn-sm btn-primary" @click="goToPlanCenter">前往计划中心</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 更新记录弹窗 -->
    <div v-if="showChangelogModal" class="modal-overlay" @click.self="handleChangelogOverlay">
      <div class="modal-content" style="max-width: 500px; max-height: 80vh;">
        <div style="padding: 24px;">
          <div class="modal-header">
            <h3 class="modal-title"><AppIcon name="scroll-text" />  版本更新记录</h3>
            <div class="modal-header-actions">
              <button v-if="!editingChangelog" class="btn-edit-changelog" @click="startEditChangelog" title="编辑更新时间">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                编辑
              </button>
              <template v-else>
                <button class="btn-edit-changelog btn-save-changelog" @click="saveChangelogEdits" title="保存修改">保存</button>
                <button class="btn-edit-changelog" @click="cancelChangelogEdits" title="取消">取消</button>
              </template>
              <button class="soft-btn-close modal-close-inline" @click="showChangelogModal = false; cancelChangelogEdits()" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
          <div style="max-height: 50vh; overflow-y: auto;">
            <div v-if="settingsStore.changelog.length > 0" class="changelog-timeline">
              <div v-for="(entry, idx) in settingsStore.changelog" :key="idx" class="changelog-item">
                <div class="changelog-dot" :class="{ latest: idx === 0 }"></div>
                <div class="changelog-body">
                  <div class="changelog-header">
                    <span class="changelog-version">{{ entry.version }}</span>
                    <input v-if="editingChangelog" class="changelog-time-edit" type="text" v-model="editTimes[idx]" :placeholder="entry.time" />
                    <span v-else class="changelog-time">{{ entry.time }}</span>
                  </div>
                  <div class="changelog-content" v-html="formatChangelog(entry.content)"></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 32px;">
              <div class="empty-state-icon"><AppIcon name="scroll-text" /> </div>
              <p>暂无更新记录</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 关于平台弹窗 -->
    <div v-if="showAboutModal" class="modal-overlay" @click.self="handleAboutOverlay">
      <div class="about-modal">
        <button class="soft-btn-close modal-close-corner" @click="closeAbout" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <div class="about-logo-wrap">
          <img src="/hean-logo.png" alt="平台 LOGO" class="about-logo-img" />
        </div>
        <h3 class="about-title">研究生工作管理平台</h3>
        <p class="about-version">Version:{{ settingsStore.appVersion }}</p>
        <div class="about-body">
          <p class="about-desc">一款面向研究生的全维度个人成长管理工具，覆盖科研、计划、文献、健康、财务与人际等维度，帮助你以「输入 → 执行 → 复盘 → 激励」的闭环持续精进。</p>
          <div class="about-features">
            <div class="about-feature"><span class="about-feature-icon"><AppIcon name="book" /> </span><span>科研中心 · 论文管理 · 组会纪要</span></div>
            <div class="about-feature"><span class="about-feature-icon"><AppIcon name="calendar" /> </span><span>计划中心 · 日历视图 · 任务看板</span></div>
            <div class="about-feature"><span class="about-feature-icon"><AppIcon name="bell" /> </span><span>消息中心 · 智能提醒 · 登录提醒</span></div>
            <div class="about-feature"><span class="about-feature-icon"><AppIcon name="lightbulb" /> </span><span>仿真中心 · 科研导航 · 自定义配置</span></div>
          </div>
        </div>
        <div class="about-actions">
          <button class="btn btn-primary" @click="showChangelogModal = true; showAboutModal = false"><AppIcon name="scroll-text" />  版本记录</button>
          <button class="btn btn-secondary" @click="showLogModal = true; showAboutModal = false"><AppIcon name="file-text" />  操作日志</button>
          <button v-if="isTauri" class="btn btn-secondary" @click="showAboutModal = false; manualCheckUpdate()"><AppIcon name="download-cloud" />  检查更新</button>
        </div>
        <div class="about-footer">
          <span>Copyright©2026 牛马科技 ALL Rights Reserved</span>
        </div>
      </div>
    </div>

    <!-- 平台文档弹窗 -->
    <div v-if="showPlatformDocModal" class="modal-overlay" @click.self="handlePlatformDocOverlay">
      <div class="about-modal platform-doc-modal">
        <button class="soft-btn-close modal-close-corner" @click="closePlatformDoc" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <h3 class="about-title"><AppIcon name="book" />  平台文档 · 使用与接手手册</h3>
        <p class="about-version">研究生工作管理平台 · Version:{{ settingsStore.appVersion }} · 共 14 章，涵盖架构、数据、主题、安全、开发与部署</p>
        <p class="about-version" style="margin-top: 2px; color: var(--color-text-tertiary); font-size: 12px;">文档最新修改时间：{{ platformDocUpdatedAt }}</p>
        <div class="doc-toolbar">
          <button class="btn btn-sm btn-secondary" @click="exportDocHtml" title="导出为 HTML 文件"><AppIcon name="file-text" />  导出 HTML</button>
          <button class="btn btn-sm btn-secondary" @click="exportDocPdf" title="导出为 PDF"><AppIcon name="printer" />  导出 PDF</button>
        </div>
        <div class="platform-doc-layout">
          <aside class="doc-sidebar">
            <div class="doc-nav-title">目录</div>
            <nav class="doc-nav" ref="platformDocNavRef">
              <a v-for="item in docToc" :key="item.id"
                 :href="'#' + item.id"
                 :class="{ active: activeTocId === item.id }"
                 @click.prevent="scrollToDocSection(item.id)">
                {{ item.title }}
              </a>
            </nav>
          </aside>
          <div class="about-body platform-doc-body" ref="platformDocBodyRef">
          <section id="doc-sec-1" class="doc-section">
            <h4>一、平台定位与设计理念</h4>
            <p>研究生工作管理平台（MasterWorkbench）是一款面向研究生群体的全维度个人成长管理工具，围绕「输入 → 执行 → 复盘 → 激励」的成长闭环设计，帮助用户统筹科研、计划、文献、健康、财务与人际关系，实现研究生生涯的精细化管理。</p>
            <p style="margin-top: 8px;">平台同时提供<strong>桌面端</strong>与<strong>浏览器端</strong>两种运行形态，二者共享同一套 Vue 3 前端代码，通过 <code>isTauriRuntime()</code> 在运行时自动区分环境并切换底层能力（详见第二章与第十一章）。</p>
            <p style="margin-top: 8px;"><strong>三条核心设计原则（二次开发时请务必遵循）：</strong></p>
            <ul>
              <li><strong>本地优先、零后端：</strong>平台没有任何服务端接口与数据库——桌面端数据落盘到本地文件系统，浏览器端数据存于 localStorage / IndexedDB，不上传云端，因此隐私可控、断网可用。</li>
              <li><strong>配置驱动：</strong>计划状态、优先级、分类、文献库字段与列、导航站点等均为「可在平台设置中自定义的数据」，而非写死的常量。新增业务维度时，优先考虑做成可配置项而不是硬编码。</li>
              <li><strong>渐进兼容：</strong>用户数据长期沉淀在本地，任何数据结构变更都必须做向后兼容（读取时补默认值 / 迁移旧键），不能让老用户升级后数据丢失。<code>settingsModuleOrder</code> 的兼容处理就是典型范例。</li>
            </ul>
          </section>
          <section id="doc-sec-2" class="doc-section">
            <h4>二、技术栈与依赖</h4>
            <p>平台以 Vue 3 前端为核心，桌面端通过 Tauri 2 封装为原生 Windows 应用，浏览器端则为纯前端 SPA。两套环境共用同一份源码，由运行时检测函数 <code>isTauriRuntime()</code>（位于 <code>src/utils/tauriFs.js</code>）做能力分支。</p>
            <ul>
              <li><strong>前端框架：</strong>Vue 3.4（Composition API / <code>&lt;script setup&gt;</code>）</li>
              <li><strong>桌面端框架：</strong>Tauri 2.x（Rust 后端 + WebView2 渲染内核），非 Electron——安装包体积仅约 7 MB</li>
              <li><strong>构建工具：</strong>Vite 5.4 + @vitejs/plugin-vue 5</li>
              <li><strong>状态管理：</strong>Pinia 2.1（Options API 风格的 <code>defineStore</code>）</li>
              <li><strong>路由：</strong>Vue Router 4.3，使用 <code>createWebHashHistory</code>（hash 路由）</li>
              <li><strong>图表组件：</strong>ECharts 5.5</li>
              <li><strong>日期处理：</strong>dayjs 1.11（含 <code>isoWeek</code> 插件，用于周数计算）</li>
              <li><strong>Excel 导入导出：</strong>SheetJS（xlsx 0.18.5），用于财务 CSV/Excel 导入导出</li>
              <li><strong>公式渲染：</strong>KaTeX 0.18.3，用于论文笔记中的数学公式</li>
              <li><strong>图标库：</strong>lucide-vue-next 1.0，提供轻量 SVG 图标</li>
              <li><strong>样式方案：</strong>原生 CSS + CSS 变量主题系统（无 UI 组件库、无 CSS 预处理器、无 Tailwind）</li>
              <li><strong>数据存储（桌面端）：</strong>通过 <code>@tauri-apps/plugin-fs</code> 进行原生文件系统读写，数据目录为 <code>C:\Users\xxx\AppData\Roaming\com.mastersworkbench.app\硕士工作台数据</code>（由 Rust 端 <code>default_data_dir</code> 命令自动创建）</li>
              <li><strong>数据存储（浏览器端）：</strong>localStorage（统一 <code>mw_</code> 前缀）+ File System Access API（Chrome/Edge 支持本地文件夹授权）+ IndexedDB（存储 PDF、图片等大文件，不占 localStorage 配额）</li>
              <li><strong>Tauri 插件：</strong><code>@tauri-apps/plugin-dialog</code>（文件/目录选择对话框）、<code>@tauri-apps/plugin-fs</code>（文件读写）、<code>@tauri-apps/plugin-shell</code>（Shell 命令）、<code>@tauri-apps/api</code>（核心 IPC 通信）</li>
              <li><strong>包管理：</strong>npm；无 TypeScript、无单元测试框架、无 ESLint 配置（保持零配置心智负担）</li>
            </ul>
          </section>
          <section id="doc-sec-3" class="doc-section">
            <h4>三、源码目录结构</h4>
            <pre style="background: var(--color-bg); padding: 10px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.6; overflow-x: auto;">研究生工作台/
  ├── index.html                 # SPA 入口 HTML（浏览器标签标题在此设置）
  ├── package.json               # 依赖与 npm 脚本（dev / build / preview）
  ├── vite.config.js             # Vite 配置：端口 5173、自动导出中间件
  ├── public/                    # 静态资源（favicon.svg、hean-logo.png）
  ├── src/                        # Vue 前端源码（浏览器端与桌面端共用）
  │   ├── main.js                # 应用入口：挂载 Vue / Pinia / Router / 全局样式
  │   ├── App.vue                # 顶层布局与全局逻辑（约 5900 行，最核心的文件）
  │   ├── router/index.js        # 路由表（新增页面在这里注册）
  │   ├── stores/index.js        # 全部 Pinia Store（约 3600 行，唯一的状态源）
  │   ├── styles/global.css      # 全局样式与 CSS 变量（颜色、圆角、阴影、间距）
  │   ├── utils/
  │   │   ├── storage.js          # 存储层封装：load / save / saveSync / 同步回调
  │   │   ├── fileStorage.js      # File System Access API：授权、目录结构、迁移
  │   │   ├── tauriFs.js          # Tauri 环境 FS 兼容层（模拟 FS Access API 句柄）
  │   │   ├── desktopBridge.js    # 桌面版桥接：openPath / openWithApp / printHtml
  │   │   ├── paperPdfStorage.js  # 论文 PDF 双通道存储（桌面端原生 FS / 浏览器 IndexedDB）
  │   │   ├── simImageStorage.js  # 仿真结果图片双通道存储（桌面端原生 FS / 浏览器 IndexedDB）
  │   │   ├── indexedDb.js        # IndexedDB 封装（浏览器端大文件存储）
  │   │   ├── autoExport.js       # 自动备份（localStorage 模式下的兜底）
  │   │   └── localBridge.js      # 本地桥接（遗留兼容）
  │   ├── composables/
  │   │   ├── useModalClose.js    # 弹窗关闭策略：单击空白不关、双击空白才关
  │   │   └── useScreenSize.js   # 屏幕自适应：isCompact(&lt;1100) / isNarrow(&lt;768)
  │   ├── components/
  │   │   ├── AppIcon.vue         # 全局 SVG 图标组件
  │   │   ├── common/ColorPresetPicker.vue  # 主题/标签取色器
  │   │   ├── layout/MorningPopup.vue       # 每日首次打开的晨间提醒弹窗
  │   │   ├── pdf/PdfReader.vue             # 内置 PDF 阅读器
  │   │   └── plan/PlanCalendar.vue         # 计划日历组件（月/年/周/双周视图）
  │   └── views/                 # 页面级组件，与 router 一一对应
  │       ├── Login.vue  Dashboard.vue  Research.vue  Simulation.vue
  │       ├── PaperCenter.vue  Plan.vue  Navigation.vue  PointsCenter.vue
  │       ├── Profile.vue  Settings.vue  Finance.vue
  └── src-tauri/                  # Tauri 桌面端（Rust 后端 + 构建配置）
      ├── tauri.conf.json        # Tauri 配置（窗口、NSIS 安装包、应用标识）
      ├── Cargo.toml             # Rust 依赖与 crate 元信息
      ├── Cargo.lock             # Rust 依赖版本锁定
      ├── build.rs               # Tauri 构建脚本
      ├── capabilities/default.json  # 权限配置（fs/dialog/shell 权限作用域）
      ├── nsis/                  # NSIS 安装器定制脚本与资源
      ├── icons/                 # 应用图标（各尺寸）
      └── src/
          ├── main.rs            # Rust 入口（隐藏控制台窗口、调用 lib::run()）
          └── lib.rs             # Tauri 主逻辑：窗口控制、文件打开、自动更新</pre>
            <p style="margin-top: 8px;"><strong>接手提示：</strong><code>App.vue</code> 与 <code>stores/index.js</code> 是两个「巨石文件」，承载了顶栏、侧边栏、右侧引导面板、各类全局弹窗、主题应用、版本更新日志以及全部状态定义。修改前建议先用编辑器的大纲/搜索定位，不要盲目重构拆分——大量样式依赖于 <code>App.vue</code> 内的 scoped 作用域。Rust 后端逻辑全部集中在 <code>src-tauri/src/lib.rs</code>（约 470 行），包含窗口控制、文件打开、GitHub 自动更新三大模块。</p>
          </section>
          <section id="doc-sec-4" class="doc-section">
            <h4>四、路由与页面模块清单</h4>
            <p>路由定义位于 <code>src/router/index.js</code>，采用 hash 模式，登录页与 Dashboard 为静态引入，其余全部为懒加载。侧边栏显示顺序由 <code>settingsStore.navOrder</code> 控制，用户可在平台设置中拖拽调整。</p>
            <ul>
              <li><code>/login</code> · <strong>登录页</strong> — 账号密码校验（当前为本地固定账号），登录态超时提示与窗口关闭重登提示。</li>
              <li><code>/</code> · <strong>信息预览 Dashboard</strong> — 今日待办、本周计划、计划状态占比图、专注计时、每日打卡与今日总结。</li>
              <li><code>/research</code> · <strong>科研中心</strong> — 论文管理（状态流转与「前世今生」时间线、滞留超 7 天自动提醒，支持自定义状态与颜色）、组会纪要、实验记录、培养节点（支持自定义阶段与弹窗编辑），以及「研究助手」四张向导卡片。</li>
              <li><code>/papers</code> · <strong>论文中心</strong> — 论文列表（自定义字段/列/排序、阅读状态计时与超时提醒）、PDF 阅读与批注、论文笔记与树状文件夹、easyScholar 影响因子查询。</li>
              <li><code>/plan</code> · <strong>计划中心</strong> — 计划总览、计划列表（筛选/排序/子任务填色）、日历视图（按日/周/月/年计划层级智能显示时段）、复盘记录。</li>
              <li><code>/navigation</code> · <strong>科研导航</strong> — 常用学术站点分类导航，支持自定义站点与分类。</li>
              <li><code>/simulation</code> · <strong>仿真中心</strong> — 仿真实验管理（总览 + 仿真列表），支持录入仿真初始信息与多条仿真记录，状态名称与颜色均可自定义，表格自定义列显隐，详情弹窗可增删改记录，仿真结果支持上传多张图片（大小不限）。</li>
              <li><code>/points</code> · <strong>积分激励</strong> — 积分获取与消费、每日任务赌注机制。</li>
              <li><code>/finance</code> · <strong>财务中心</strong> — 总览（收支统计、预算进度、分类占比、最近记录）与财务库（账目明细表格、搜索/筛选/排序、账本与币种管理、分类自定义、CSV/Excel 导入导出、批量编辑）；另含「信息库」Tab，统一管理软件订阅、团购、资产、卡证、手机套餐五类信息。</li>
              <li><code>/profile</code> · <strong>个人信息</strong> — 个人资料、头像、学业进度。</li>
              <li><code>/settings</code> · <strong>平台设置</strong> — 数据管理（导出/导入 JSON、备份与回退、清除数据）、偏好设置（PDF打开方式/主题配色/版本号）、easyScholar API 配置三个模块。</li>
            </ul>
            <p style="margin-top: 8px;"><strong>新增一个页面的完整步骤：</strong>① 在 <code>src/views/</code> 建立 <code>Xxx.vue</code>；② 在 <code>router/index.js</code> 追加路由并写好 <code>meta.title</code> 与 <code>meta.icon</code>；③ 在 <code>App.vue</code> 的 <code>icons</code> 对象中补充对应 SVG 图标；④ 在 <code>settingsStore.navOrder</code> 默认值中加入新路径（并做好老用户的兼容补齐）；⑤ 如需右侧引导面板提示，在 <code>App.vue</code> 的 <code>currentRouteTip</code> 中补一条文案。</p>
          </section>
          <section id="doc-sec-5" class="doc-section">
            <h4>五、状态管理：Pinia Store 与 localStorage 键位</h4>
            <p>所有 Store 集中定义在 <code>src/stores/index.js</code>（约 3600 行），统一通过 <code>utils/storage.js</code> 的 <code>load(key, default)</code> 初始化、<code>save(key, value)</code> 落盘。localStorage 中的真实键名是 <code>mw_</code> + 代码里的 key（例如 <code>load('plans')</code> 对应 <code>mw_plans</code>）。</p>
            <p style="margin-top: 8px;">共 18 个 Store，按功能模块列举如下：</p>
            <ul>
              <li><code>usePointsStore</code>（points）— 积分体系：<code>mw_totalPoints</code>、<code>mw_transactions</code>、<code>mw_dailyBet</code>、<code>mw_consumedItems</code></li>
              <li><code>useTasksStore</code>（tasks）— 今日任务：<code>mw_tasks</code>、<code>mw_taskCategories</code>、<code>mw_taskPriorities</code>、<code>mw_taskStates</code></li>
              <li><code>usePapersStore</code>（papers）— 科研中心论文：<code>mw_papers</code>、<code>mw_meetingNotes</code>、<code>mw_researchStages</code>、<code>mw_researchUrls</code></li>
              <li><code>usePaperLibraryStore</code>（paperLibrary）— 文献库：<code>mw_paperLibrary</code>、<code>mw_paperLibraryStatuses</code>、<code>mw_paperLibraryColumns</code>、<code>mw_paperLibraryFormFields</code>、<code>mw_paperLibraryCustomFields</code>、<code>mw_paperLibrarySortOrder/Field/Direction</code>、<code>mw_paperLibraryNextSeq</code></li>
              <li><code>usePaperReadingsStore</code>（paperReadings）— 论文阅读：<code>mw_paperReadings</code>、<code>mw_paperReadingsNextSeq</code>、<code>mw_paperReadingsColumns</code>、<code>mw_paperReadingsCustomFields</code>、<code>mw_paperReadingsSortField/Direction</code></li>
              <li><code>useTimerStore</code>（timer）— 番茄钟与专注统计：<code>mw_timerMode</code>、<code>mw_pomodoroDuration</code>、<code>mw_breakDuration</code>、<code>mw_todayFocusSeconds</code>、<code>mw_weekFocusSeconds</code>、<code>mw_streakDays</code>、<code>mw_lastFocusDate</code></li>
              <li><code>useResearchStore</code>（research）— 组会/实验/里程碑：<code>mw_meetings</code>、<code>mw_experiments</code>、<code>mw_milestones</code></li>
              <li><code>usePlanStore</code>（plan）— 计划与复盘：<code>mw_plans</code>、<code>mw_reviews</code>、<code>mw_planNextSeq</code>、<code>mw_planStatuses</code>、<code>mw_planCategories</code>、<code>mw_planLevels</code>、<code>mw_planPriorities</code>、<code>mw_planOverview</code></li>
              <li><code>useMessageStore</code>（message）— 消息中心：<code>mw_messages</code>。支持登录提醒、计划任务临近提醒（按剩余天数着色）、论文稿件滞留提醒、文献阅读超时提醒等类型</li>
              <li><code>useSimulationStore</code>（simulation）— 仿真中心：<code>mw_simulations</code>、<code>mw_simNextSeq</code>、<code>mw_simCustomSoftware</code></li>
              <li><code>useNavigationStore</code>（navigation）— 科研导航：<code>mw_navSites</code>、<code>mw_navCategories</code></li>
              <li><code>useSettingsStore</code>（settings）— 全局配置中枢：<code>mw_profile</code>、<code>mw_config</code>、<code>mw_theme</code>、<code>mw_appVersion</code>、<code>mw_changelog</code>、<code>mw_navOrder</code>、<code>mw_settingsModuleOrder</code>、<code>mw_avatarImage</code>、<code>mw_backgroundImage</code>、<code>mw_authLoggedIn</code>、<code>mw_authUsername</code>、<code>mw_authLoginAt</code>、<code>mw_customDate</code>、<code>mw_customWeek</code>、<code>mw_pdfOpener</code>、<code>mw_pdfOpenerPath</code>、计划/任务各类配置项、<code>mw_rollbackHistory</code> 等。另有 <code>sessionStorage</code> 的 <code>mw_sessionAlive</code> 标记当前会话活跃（关闭窗口后清除，强制重新登录）</li>
              <li><code>useLogStore</code>（log）— 操作日志：<code>mw_operationLogs</code></li>
              <li><code>usePaperNotesStore</code>（paperNotes）— 论文笔记：<code>mw_paperNotes</code>、<code>mw_paperNoteFolders</code></li>
              <li><code>useFinanceStore</code>（finance）— 财务中心：<code>mw_financeEntries</code>、<code>mw_financeNextSeq</code>、<code>mw_financeCategories</code>、<code>mw_financeLedgers</code>、<code>mw_financeCurrencies</code>、<code>mw_financeSortOrder/Direction</code>、<code>mw_financeMonthlyBudget</code>、<code>mw_financeCurrency</code></li>
              <li><code>useInfoStore</code>（info）— 信息库：<code>mw_infoSubscriptions</code>、<code>mw_infoSubNextSeq</code>、<code>mw_infoGroupbuys</code>、<code>mw_infoGroupNextSeq</code>、<code>mw_infoAssets</code>、<code>mw_infoAssetNextSeq</code>、<code>mw_infoCards</code>、<code>mw_infoCardNextSeq</code>、<code>mw_infoPlans</code>、<code>mw_infoPlanNextSeq</code>（软件订阅 / 团购 / 资产 / 卡证 / 手机套餐五类）</li>
            </ul>
            <p style="margin-top: 8px;"><strong>新增一个持久化字段的正确姿势：</strong>在对应 Store 的 <code>state</code> 中用 <code>load('yourKey', 默认值)</code> 声明，在修改它的 action 里调用 <code>save('yourKey', this.yourKey)</code>。切勿直接操作 <code>localStorage</code>——那样会绕过本地文件夹同步与自动备份回调。</p>
          </section>
          <section id="doc-sec-6" class="doc-section">
            <h4>六、数据存储、备份与迁移</h4>
            <p>平台采用「本地优先」策略，数据不上传至任何云端服务器。桌面端与浏览器端的存储机制有所不同，由运行时检测自动切换：</p>
            <p style="margin-top: 8px;"><strong>桌面端（Tauri）存储架构：</strong></p>
            <ul>
              <li><strong>业务数据：</strong>通过 <code>@tauri-apps/plugin-fs</code> 写入本地文件系统。默认数据目录为 <code>C:\Users\xxx\AppData\Roaming\com.mastersworkbench.app\硕士工作台数据</code>（由 Rust 端 <code>default_data_dir</code> 命令自动创建，开箱即用）。</li>
              <li><strong>大文件（PDF、图片）：</strong>论文 PDF 落盘到数据目录下「论文PDF」子文件夹，仿真结果图片落盘到「仿真图片」子文件夹，大小不限、不占 localStorage。</li>
              <li><strong>兼容层设计：</strong>Windows WebView2 不支持浏览器 File System Access API（<code>showDirectoryPicker</code> 等），因此 <code>src/utils/tauriFs.js</code> 用 Tauri 官方 <code>plugin-fs</code> / <code>plugin-dialog</code> 模拟出一套与 File System Access API 句柄接口兼容的适配层，使上层存储代码（<code>fileStorage.js</code>）零改动同时支持浏览器与桌面端。</li>
              <li><strong>自定义存储位置：</strong>用户可在平台设置中授权任意文件夹作为数据目录，也可「恢复默认」回到系统数据目录。</li>
            </ul>
            <p style="margin-top: 8px;"><strong>浏览器端存储架构：</strong></p>
            <ul>
              <li><strong>业务数据：</strong>localStorage（统一 <code>mw_</code> 前缀），同时通过 File System Access API 授权本地文件夹实现文件持久化（仅 Chrome/Edge 支持）。</li>
              <li><strong>大文件：</strong>IndexedDB（论文 PDF、仿真图片等），不占 localStorage 配额，大小不限。</li>
            </ul>
            <p style="margin-top: 8px;"><strong>本地文件夹结构（v5.0.100 起规范化）：</strong></p>
            <pre style="background: var(--color-bg); padding: 10px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.6; overflow-x: auto;">~/硕士工作台数据/
  ├── meta.json          # 元信息（版本、最后同步时间）
  ├── data/              # 按模块拆分的 JSON 数据
  │   ├── mw_tasks.json
  │   ├── mw_papers.json
  │   └── ...
  ├── backups/           # 自动备份历史
  ├── 论文PDF/            # 论文 PDF 文件
  ├── 仿真图片/           # 仿真结果图片
  └── exports/           # 手动导出的 JSON/Excel</pre>
            <p style="margin-top: 8px;"><strong>换电脑或重装系统后如何导入完整数据？</strong></p>
            <ul>
              <li><strong>方式一（推荐）：JSON 备份/恢复</strong><br/>在「平台设置 → 本地备份与恢复」中导出完整的 JSON 备份文件；在新设备上打开平台后，进入同一位置选择该 JSON 文件导入即可。此方法最稳定，不受环境限制。</li>
              <li><strong>方式二（桌面端）：复制数据目录</strong><br/>直接复制 <code>AppData\Roaming\com.mastersworkbench.app\硕士工作台数据</code> 整个文件夹到新电脑相同路径，重新安装桌面端后数据自动恢复。</li>
              <li><strong>方式三（浏览器端）：复制本地存储文件夹</strong><br/>如果之前已绑定本地文件夹，可直接复制该文件夹到新电脑，首次打开平台时重新授权该文件夹，平台会自动读取并恢复数据。</li>
            </ul>
          </section>
          <section id="doc-sec-7" class="doc-section">
            <h4>七、主题系统与界面布局</h4>
            <p>平台的配色由一套 CSS 变量驱动，基础变量定义在 <code>src/styles/global.css</code> 的 <code>:root</code> 中（<code>--color-primary</code>、<code>--color-bg</code>、<code>--color-text-primary</code>、<code>--radius-md</code>、<code>--shadow-lg</code> 等）。</p>
            <p style="margin-top: 8px;"><strong>导航主题色的工作原理：</strong>用户在「平台设置 → 主题配色」选择的颜色写入 <code>settingsStore.theme.navBgColor</code>；<code>App.vue</code> 中的 <code>applyTheme()</code> 读取该值，用 <code>getContrastColor()</code> 自动推算出可读的前景色，然后把下面这组变量写到 <code>document.documentElement</code> 上：</p>
            <pre style="background: var(--color-bg); padding: 10px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.6; overflow-x: auto;">--color-nav-bg            导航/状态栏/引导面板 背景色
--color-nav-text          主文字色
--color-nav-text-secondary 次级文字色
--color-nav-text-tertiary  弱化文字色
--color-nav-hover-bg      悬停背景
--color-nav-active-bg     选中背景
--color-nav-active-text   选中文字
--color-nav-border        分隔线颜色</pre>
            <p style="margin-top: 8px;"><code>applyTheme()</code> 通过 <code>watch(settingsStore.theme, ..., { deep: true })</code> 监听，主题一改立即生效，无需刷新。<strong>左侧导航栏、顶部状态栏、右侧 Guidance Panel 三者共用这同一组变量</strong>，因此视觉上完全连成一体；未设置自定义主题色时，这些变量会被移除并回退到 <code>--color-bg</code> 等默认值。新增需要跟随主题的区域时，请直接使用 <code>var(--color-nav-bg, var(--color-bg))</code> 这类带兜底的写法，不要硬编码颜色。</p>
            <p style="margin-top: 8px;"><strong>整体布局：</strong>桌面端为无边框窗口（<code>decorations: false</code>），自带自定义标题栏（最小化/最大化/关闭按钮通过 Rust 端 <code>minimize_window</code> / <code>maximize_window</code> / <code>close_window</code> 命令实现）。内容区布局为：左侧固定侧边栏 + 顶部状态栏 + 中间路由视图（<code>&lt;keep-alive&gt;</code> 缓存，切页不丢状态）+ 右侧 Guidance Panel（折叠 36px / 展开 260px，主内容区通过 <code>.page-content</code> 的 padding 让位，屏幕宽度小于 1100px 时自动隐藏）。响应式断点统一由 <code>useScreenSize()</code> 提供。</p>
            <p style="margin-top: 8px;"><strong>毛玻璃效果：</strong>弹窗遮罩层使用 <code>backdrop-filter: blur(4px)</code>，弹窗内容区在毛玻璃模式下使用 <code>backdrop-filter: blur(14px)</code>，登录页同样支持毛玻璃透明效果，可透出用户自定义背景图。</p>
          </section>
          <section id="doc-sec-8" class="doc-section">
            <h4>八、账号与登录安全</h4>
            <p>平台无后端，账号校验在前端完成（见 <code>src/views/Login.vue</code> 的 <code>doLogin()</code>），登录态保存在 <code>useSettingsStore</code> 中并持久化到 localStorage。这套机制的定位是「防止他人在你电脑上随手打开」，不是严格意义上的身份认证。</p>
            <ul>
              <li><strong>登录态字段：</strong><code>mw_authLoggedIn</code>（是否已登录）、<code>mw_authUsername</code>（账号名）、<code>mw_authLoginAt</code>（上次登录时间戳，毫秒）。另有 <code>sessionStorage</code> 的 <code>mw_sessionAlive</code> 标记当前会话活跃。</li>
              <li><strong>关闭窗口强制重登（v5.0.159 起）：</strong><code>login()</code> 时向 <code>sessionStorage</code> 写入 <code>mw_sessionAlive = '1'</code>。关闭应用窗口或标签页后 <code>sessionStorage</code> 会被自动清除，下次打开平台时 <code>checkSession()</code> 检测到该标记丢失即调用 <code>logout()</code> 并置 <code>sessionExpiredReason = 'window_closed'</code>，登录页据此显示「关闭窗口后需重新登录」提示。<strong>刷新页面不受影响</strong>（<code>sessionStorage</code> 在刷新时保留）。</li>
              <li><strong>24 小时强制下线（v5.0.103 起）：</strong>常量 <code>SESSION_MAX_AGE = 24 * 60 * 60 * 1000</code> 定义在 <code>src/stores/index.js</code>。<code>settingsStore.checkSession()</code> 会比较 <code>Date.now() - authLoginAt</code>，一旦超过 24 小时立即调用 <code>logout()</code> 并把 <code>sessionExpiredReason</code> 置为 <code>'expired_24h'</code>，登录页据此显示「登录状态已超过 24 小时有效期」的提示条。</li>
              <li><strong>校验时机：</strong><code>App.vue</code> 在应用挂载时校验一次（窗口关闭重登与 24 小时过期同时检查），此后每 60 秒轮询一次，并在窗口重新获得焦点时立即再校验，因此长时间挂机或隔夜再打开都会被准确拦截。</li>
              <li><strong>旧登录态处理：</strong>升级前遗留的、没有 <code>authLoginAt</code> 记录或没有 <code>sessionStorage</code> 标记的登录态一律视为已过期，需要重新登录一次以写入时间戳与会话标记。</li>
              <li><strong>剩余时长提示：</strong>顶部头像下拉菜单会显示「本次登录时间」与「登录态剩余时长」，剩余不足 1 小时时以红色高亮。</li>
              <li><strong>重要：</strong>强制下线只清除登录标记，<strong>不会删除任何业务数据</strong>；重新登录后所有内容原样恢复。</li>
              <li><strong>修改有效期：</strong>改动 <code>SESSION_MAX_AGE</code> 一处即可（例如改为 8 小时写作 <code>8 * 60 * 60 * 1000</code>）；修改账号密码则调整 <code>Login.vue</code> 中 <code>doLogin()</code> 的判断条件；关闭「窗口关闭重登」可注释 <code>checkSession()</code> 中的 <code>sessionStorage</code> 检查段。</li>
            </ul>
          </section>
          <section id="doc-sec-9" class="doc-section">
            <h4>九、二次开发指南</h4>
            <p><strong>本地启动（浏览器开发模式）：</strong></p>
            <pre style="background: var(--color-bg); padding: 10px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.6; overflow-x: auto;">npm install      # 首次拉取代码后安装依赖
npm run dev      # 启动 Vite 开发服务器，默认 http://localhost:5173（自动打开浏览器）</pre>
            <p style="margin-top: 8px;"><strong>桌面端开发与构建：</strong></p>
            <pre style="background: var(--color-bg); padding: 10px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.6; overflow-x: auto;"># 前置条件：安装 Rust 工具链 + Visual Studio C++ Build Tools
npx tauri dev    # 桌面端开发模式（启动 Tauri 窗口 + 热更新）
npx tauri build  # 桌面端生产构建，生成 NSIS 安装包</pre>
            <p style="margin-top: 8px;"><strong>版本发布标准流程（每次改动都请照做，否则用户看不到更新记录）：</strong></p>
            <ul>
              <li>① 同步更新四处版本号：<code>src-tauri/tauri.conf.json</code>、<code>src-tauri/Cargo.toml</code>、<code>src-tauri/Cargo.lock</code>、<code>src/stores/index.js</code> 中 <code>appVersion: load('appVersion', 'x.y.z')</code> 的默认值；</li>
              <li>② 在 <code>App.vue</code> 的 <code>onMounted</code> 版本播种区，<strong>在上一个版本块之前</strong>插入 <code>settingsStore.ensureAppVersion('x.y.z')</code> + <code>if (!versions.includes('x.y.z')) { settingsStore.addChangelog('x.y.z', '...') }</code>（列表按版本倒序排列，新版本在最上面）；</li>
              <li>③ 更新 <code>CHANGELOG.md</code>；</li>
              <li>④ 更新日志每行以 <code>• </code> 开头并用 <code>\n</code> 分隔，<code>iconForChangelogLine()</code> 会根据关键词自动匹配 emoji 图标；</li>
              <li>⑤ 版本号规则：功能性大改动进位第二段（如 4.9.x → 5.0.100），常规迭代仅递增第三段（5.0.264 → 5.0.265）；</li>
              <li>⑥ 构建后部署，并同步更新本文档中受影响的章节。</li>
            </ul>
            <p style="margin-top: 8px;"><strong>常见改动落点速查：</strong>顶栏/侧边栏/引导面板/全局弹窗 → <code>App.vue</code>；数据字段与业务动作 → <code>stores/index.js</code>；全局配色与通用类 → <code>styles/global.css</code>；浏览器端文件读写 → <code>utils/fileStorage.js</code>；桌面端文件读写 → <code>utils/tauriFs.js</code>；桌面端原生能力（打开文件、打印） → <code>utils/desktopBridge.js</code>；Rust 后端命令 → <code>src-tauri/src/lib.rs</code>；浏览器标签标题 → <code>index.html</code>。</p>
          </section>
          <section id="doc-sec-10" class="doc-section">
            <h4>十、构建与部署</h4>
            <p>平台支持两种构建方式，分别面向桌面端与浏览器端：</p>
            <ul>
              <li><strong>桌面端构建（主要发布渠道）：</strong>执行 <code>npx tauri build</code>，Tauri 会先调用 Vite 构建前端（端口 5174，输出到 <code>dist_tauri</code>），再编译 Rust 后端并打包为 NSIS 安装包。产物位于 <code>src-tauri/target/release/bundle/nsis/</code>，安装包约 7 MB。安装包命名格式为 <code>MasterWorkbench_5.0.X_x64-setup.exe</code>（无空格前缀）。窗口配置：1400×900 默认尺寸，最小 1024×700，无边框窗口，安装方式为 currentUser，界面语言简体中文。</li>
              <li><strong>桌面端发布流程：</strong>构建 → 复制安装包并重命名 → 创建 GitHub Release → 上传安装包。桌面端内置自动更新功能（Rust 端 <code>check_for_update</code> / <code>download_update</code> / <code>install_update</code> 三步），通过 GitHub Releases API 检查新版本并流式下载安装包，下载进度通过 <code>download-progress</code> 事件实时推送到前端。</li>
              <li><strong>浏览器端构建：</strong>执行 <code>npm run build</code>，产物在 <code>dist/</code>，可托管在任意静态服务器上。由于使用 hash 路由，<strong>无需为服务器配置 History 回退规则</strong>。</li>
              <li><strong>本机开发使用：</strong>可直接 <code>npm run dev</code>（浏览器端）或 <code>npx tauri dev</code>（桌面端）常驻使用，开发服务器支持全部功能。</li>
              <li><strong>注意：</strong>桌面端与浏览器端是两个独立的数据域，互不相通。跨环境迁移请用「平台设置 → 本地备份与恢复」的 JSON 导出/导入。</li>
            </ul>
          </section>
          <section id="doc-sec-11" class="doc-section">
            <h4>十一、运行环境与兼容性</h4>
            <p>平台有两种运行形态，环境要求各不相同：</p>
            <ul>
              <li><strong>桌面端（Tauri 2）：</strong>Windows 10/11 64 位系统，需安装 WebView2 Runtime（Windows 11 已内置）。安装包为 NSIS 格式，双击安装即可使用，无需配置浏览器或开发环境。数据自动落盘到系统数据目录，不依赖浏览器 localStorage 容量限制。</li>
              <li><strong>浏览器端：</strong>推荐使用最新版 Chrome、Edge 等 Chromium 内核浏览器。File System Access API（本地文件夹授权）仅 Chromium 桌面浏览器支持；Firefox、Safari 会自动降级为纯 localStorage + IndexedDB 模式，功能可用但无法写入本地硬盘文件。</li>
              <li><strong>浏览器端 localStorage 容量：</strong>一般限制在 5–10MB。头像、背景图等大文件在桌面端直接落盘不占配额；在浏览器端存入 IndexedDB，同样不占 localStorage。若出现「存储空间不足」弹窗，请按提示清理数据快照或导出 JSON 备份后清除旧数据。</li>
              <li><strong>浏览器端隐私模式：</strong>无痕窗口关闭后 localStorage 会被清空，请勿在无痕模式下长期使用。</li>
              <li><strong>自动更新（桌面端）：</strong>应用内置 GitHub Releases 自动更新功能。启动后自动检查是否有新版本，发现新版本后在应用内下载安装包（实时显示进度条），下载完成后弹出可见的 NSIS 安装向导，用户确认后完成升级并重启。</li>
            </ul>
          </section>
          <section id="doc-sec-12" class="doc-section">
            <h4>十二、常见问题排查</h4>
            <ul>
              <li><strong>打开后要求重新登录：</strong>两种原因——① 关闭应用窗口后重开，属「窗口关闭强制重登」保护；② 距上次登录超过 24 小时，属登录态过期保护。两种情况数据均不受影响，重新登录即可（详见第八章）。</li>
              <li><strong>浏览器端顶部出现「本地存储权限需要恢复」提示条：</strong>浏览器重启后文件夹授权失效，点击提示条重新授权同一文件夹即可，数据不会丢失。桌面端无此问题（数据目录持久化在本地文件系统）。</li>
              <li><strong>数据看起来「回退」了：</strong>先确认当前是不是换了浏览器、换了环境（桌面端 vs 浏览器端）或用了无痕窗口——这几种情况下数据是隔离的。可通过导入此前导出的 JSON 备份恢复。</li>
              <li><strong>弹窗点一下关不掉：</strong>这是刻意设计——单击遮罩不关闭，需双击遮罩或点右上角 ✕，避免误触丢失正在填写的内容（见 <code>useModalClose.js</code>）。</li>
              <li><strong>修改主题色后某处颜色没变：</strong>说明该区域的样式硬编码了颜色，请改用 <code>var(--color-nav-*)</code> 系列变量（见第七章）。</li>
              <li><strong>桌面端构建报错：</strong>确认已安装 Rust 工具链（<code>rustup</code>）和 Visual Studio C++ Build Tools，且 <code>Cargo.toml</code> 中版本号已同步更新。</li>
              <li><strong>影响因子查不出来：</strong>需先在「平台设置 → easyScholar API 配置」中填写 Secret Key。</li>
              <li><strong>桌面端自动更新失败：</strong>检查网络连接是否正常，GitHub 仓库是否为私有（私有仓库需 Token 认证，Token 已编译在 Rust 端）。更新日志文件位于 <code>%TEMP%\mw_update.log</code>，可据此排查。</li>
            </ul>
          </section>
          <section id="doc-sec-13" class="doc-section">
            <h4>十三、开源依赖与致谢</h4>
            <p>本平台在自研核心逻辑之外，使用了以下优秀的开源项目，特此致谢（点击链接可前往官方仓库/文档）：</p>
            <ul>
              <li><a href="https://vuejs.org/" target="_blank" rel="noopener noreferrer"><strong>Vue 3</strong></a>（MIT License）— 渐进式前端框架，支撑整体组件化架构</li>
              <li><a href="https://vitejs.dev/" target="_blank" rel="noopener noreferrer"><strong>Vite 5</strong></a>（MIT License）— 前端构建工具与开发服务器</li>
              <li><a href="https://tauri.app/" target="_blank" rel="noopener noreferrer"><strong>Tauri 2</strong></a>（MIT License / Apache 2.0）— 跨平台桌面应用框架，Rust 后端 + WebView 渲染，替代 Electron 方案</li>
              <li><a href="https://pinia.vuejs.org/" target="_blank" rel="noopener noreferrer"><strong>Pinia 2</strong></a>（MIT License）— 轻量级状态管理</li>
              <li><a href="https://router.vuejs.org/" target="_blank" rel="noopener noreferrer"><strong>Vue Router 4</strong></a>（MIT License）— 前端路由</li>
              <li><a href="https://echarts.apache.org/" target="_blank" rel="noopener noreferrer"><strong>ECharts 5</strong></a>（Apache License 2.0）— 数据可视化图表组件</li>
              <li><a href="https://day.js.org/" target="_blank" rel="noopener noreferrer"><strong>dayjs</strong></a>（MIT License）— 轻量日期处理库</li>
              <li><a href="https://sheetjs.com/" target="_blank" rel="noopener noreferrer"><strong>SheetJS (xlsx)</strong></a>（Apache License 2.0）— Excel/CSV 导入导出</li>
              <li><a href="https://katex.org/" target="_blank" rel="noopener noreferrer"><strong>KaTeX</strong></a>（MIT License）— 数学公式渲染</li>
              <li><a href="https://lucide.dev/" target="_blank" rel="noopener noreferrer"><strong>lucide-vue-next</strong></a>（ISC License）— SVG 图标库</li>
            </ul>
            <p style="margin-top: 8px;">除上述开源依赖外，平台的业务功能（科研 / 计划 / 文献 / 仿真 / 财务 / 本地存储等模块）、UI 主题系统、Rust 后端命令（窗口控制 / 文件操作 / 自动更新）及交互逻辑均为自研实现。</p>
          </section>
          <section id="doc-sec-14" class="doc-section">
            <h4>十四、附录：研究助手使用教程</h4>
            <p>「研究助手」位于<strong>科研中心</strong>内，是一套面向科研全流程的向导式工具，包含四张卡片，分别从选题、综述、写作推进、引用规范四个环节提供结构化支持：</p>
            <ul>
              <li><strong><AppIcon name="target" />  选题收窄向导：</strong>按「broad → narrow」逐步拆解研究方向。依次填写研究领域、初步兴趣、限定条件（方法 / 场景 / 对象），助手会生成可落到实验层面的具体选题建议，并提示可行性风险。</li>
              <li><strong><AppIcon name="file-edit" />  文献综述模板：</strong>提供结构化综述写作框架（背景—现状—空白—本文贡献）。可一键生成分段落草稿与引用占位，按「主题 / 方法 / 结论」归类已有文献，避免写成流水账。</li>
              <li><strong><AppIcon name="compass" />  论文阶段流水线：</strong>将论文写作拆解为「选题 → 文献 → 方法 → 实验 → 写作 → 投稿」阶段，每阶段给出待办清单与产出物（如实验记录、图表、初稿章节），帮助你掌握整体节奏。</li>
              <li><strong><AppIcon name="check-circle" />  引用自检清单：</strong>投稿前对照检查：参考文献格式是否统一、是否遗漏关键引用、是否有过度引用 / 自我引用风险、图表与正文编号是否一致，降低被退修的概率。</li>
            </ul>
            <p style="margin-top: 8px;">提示：研究助手为辅助写作与思路梳理工具，关键学术判断（如选题价值、方法正确性）仍需结合导师意见与自身研究独立判断。</p>
          </section>
          </div>
        </div>
        <div class="about-actions">
          <button class="btn btn-ghost" @click="closePlatformDoc">关闭</button>
        </div>
      </div>
    </div>

    <!-- 个人信息弹窗 -->
    <div v-if="showProfileModal" class="modal-overlay" @click.self="handleProfileOverlay">
      <div class="about-modal profile-modal">
        <button class="about-close" @click="closeProfile" title="关闭">✕</button>
        <h3 class="about-title"><AppIcon name="user" />  个人信息</h3>
        <p class="about-version">{{ settingsStore.loginUsername }} · Version:{{ settingsStore.appVersion }}</p>
        <div class="about-body profile-body">
          <div class="profile-avatar-wrap" @click="triggerProfileAvatarUpload" title="点击更换头像">
            <img v-if="profileForm.avatarImage" :src="profileForm.avatarImage" alt="头像" class="profile-avatar-img" />
            <span v-else class="profile-avatar-letter">{{ settingsStore.loginUsername?.charAt(0) || '?' }}</span>
            <div class="profile-avatar-hint"><AppIcon name="camera" /> </div>
          </div>
          <input ref="profileAvatarInput" type="file" accept="image/*" style="display:none" @change="handleProfileAvatarUpload" />
          <div class="profile-form">
            <div class="form-group">
              <label class="form-label">姓名</label>
              <input class="input" v-model="profileForm.profile.name" placeholder="你的名字" @input="markProfileDirty" />
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">学校</label>
                <input class="input" v-model="profileForm.profile.school" placeholder="学校名称" @input="markProfileDirty" />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">院系</label>
                <input class="input" v-model="profileForm.profile.department" placeholder="院系" @input="markProfileDirty" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">专业</label>
                <input class="input" v-model="profileForm.profile.major" placeholder="专业方向" @input="markProfileDirty" />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">年级</label>
                <input class="input" v-model="profileForm.profile.grade" placeholder="如：2024级" @input="markProfileDirty" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">入学日期</label>
              <input class="input" type="date" v-model="profileForm.profile.enrollDate" @input="markProfileDirty" />
            </div>
          </div>
        </div>
        <div class="about-actions">
          <button class="btn btn-primary" :disabled="!profileHasChanges" @click="saveProfile"><AppIcon name="save" />  保存更改</button>
          <button class="btn btn-ghost" @click="closeProfile">关闭</button>
        </div>
      </div>
    </div>

    <!-- 自动更新弹窗 -->
    <div v-if="showUpdateModal" class="modal-overlay" @click.self="dismissUpdateModal">
      <div class="modal-content" style="max-width: 460px;">
        <div style="padding: 24px;">
          <div class="modal-header">
            <h3 class="modal-title">
              <AppIcon name="download-cloud" />  {{ updateTitleText }}
            </h3>
            <button class="soft-btn-close modal-close-inline" @click="dismissUpdateModal" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <!-- 有新版本 -->
          <div v-if="updateInfo" class="update-modal-body">
            <div class="update-version-row">
              <span class="update-current-version">v{{ settingsStore.appVersion }}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary);"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <span class="update-new-version">v{{ updateInfo.version }}</span>
            </div>
            <div class="update-notes" v-if="updateInfo.releaseNotes">
              <div class="update-notes-title">更新内容：</div>
              <div class="update-notes-body" v-html="formatUpdateNotes(updateInfo.releaseNotes)"></div>
            </div>
            <!-- 下载中：进度条 -->
            <div v-if="updateDownloading" class="update-progress-area">
              <div class="update-progress-bar">
                <div class="update-progress-fill" :style="{ width: updateProgress + '%' }"></div>
              </div>
              <div class="update-progress-text">{{ updateProgress < 100 ? `正在下载更新... ${updateProgress}%` : '下载完成' }}</div>
            </div>
            <!-- 下载完成：选择现在更新还是稍后更新 -->
            <div v-if="updateDownloadDone" class="update-progress-area">
              <div class="update-download-done-text">
                <AppIcon name="check-circle" :size="18" />  安装包已下载完成
              </div>
              <div class="update-download-hint">点击「现在更新」将关闭软件并弹出安装向导，您可以在安装界面查看安装进度。</div>
              <div class="update-actions" style="justify-content: center;">
                <button class="btn btn-secondary" @click="doInstallLater">稍后更新</button>
                <button class="btn btn-primary" @click="doInstallNow">
                  <AppIcon name="monitor" :size="16" />  现在更新
                </button>
              </div>
            </div>
            <div v-if="updateError" class="update-error-text">{{ updateError }}</div>
            <div class="update-actions" v-if="!updateDownloading && !updateDownloadDone">
              <button class="btn btn-secondary" @click="dismissUpdateModal">稍后再说</button>
              <button class="btn btn-primary" @click="startUpdate">
                <AppIcon name="download" />  立即更新
              </button>
            </div>
          </div>
          <!-- 正在检查中 -->
          <div v-else-if="updateChecking" class="update-checking-text">
            <AppIcon name="loader" />  正在检查更新...
          </div>
          <!-- 无新版本 -->
          <div v-else-if="updateCheckDone && !updateInfo" class="update-checking-text">
            <AppIcon name="check-circle" />  当前已是最新版本
          </div>
          <!-- 检查失败 -->
          <div v-else-if="updateCheckError" class="update-error-text" style="padding: 20px 0;">
            <AppIcon name="alert-triangle" />  {{ updateCheckError }}
            <div class="update-actions" style="justify-content: center;">
              <button class="btn btn-secondary" @click="manualCheckUpdate">重试</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore, useLogStore, usePlanStore, useMessageStore, usePapersStore, usePaperLibraryStore, useResearchStore, useInfoStore, SESSION_MAX_AGE } from './stores'
import { useModalClose } from './composables/useModalClose'
import MorningPopup from './components/layout/MorningPopup.vue'
import LoginView from './views/Login.vue'
import { todayStr, save, saveTextToFile, compressImage, load, isFileStorageActive, reconcileWithFileStorage, migrateToFileStorage } from './utils/storage'
import { initFileStorage as _fsInit, getFolderName as _fsGetFolderName, regrantPermission as _fsRegrant, needsRegrant as _fsNeedsRegrant, initBackupStorage as _fsBackupInit, fileReadAll as _fsReadAll } from './utils/fileStorage'
import { initFileStorage as _eInit, getFolderName as _eGetFolderName, initBackupStorage as _eBackupInit, fileReadAll as _eReadAll } from './utils/electronFileStorage'
import { syncFromFileStorage } from './utils/storage'
import { printHtml as _printHtml } from './utils/desktopBridge'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
dayjs.extend(isoWeek)
import { useScreenSize } from './composables/useScreenSize'

// ===== 自动更新（仅桌面版 Tauri，全部重写） =====
const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__

// ===== 窗口控制（无边框窗口自定义标题栏） =====
async function minimizeWindow() {
  if (!isTauri) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('minimize_window')
}
async function maximizeWindow() {
  if (!isTauri) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('maximize_window')
}
async function closeWindow() {
  if (!isTauri) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('close_window')
}

/**
 * 窗口拖拽：data-tauri-drag-region 属性依赖 core:window:allow-start-dragging 权限，
 * 且 WebView2 下该属性需在 mousedown 阶段触发。这里做双保险：
 * 1. 属性方式（HTML data-tauri-drag-region，已存在）
 * 2. JS 方式：在拖拽区域 mousedown 时调用 Tauri startDragging 命令
 * 只有真正按下鼠标左键并落在拖拽区时才触发，不影响按钮/输入框等交互元素。
 */
async function onTitlebarDragStart(e) {
  if (!isTauri) return
  // 仅响应鼠标左键
  if (e.button !== 0) return
  // 只允许从声明了 data-tauri-drag-region 的元素或其自身开始拖拽
  const el = e.target
  if (!(el instanceof Element)) return
  // 逐级向上查找拖拽区域（最多 4 层），避免点击按钮/输入框时触发
  let node = el
  for (let i = 0; i < 4; i++) {
    if (!node) return
    if (node.hasAttribute && node.hasAttribute('data-tauri-drag-region')) {
      // 排除拖拽区域内需要交互的子元素（按钮/输入框/链接/可点击区域）
      const interactive = node.querySelectorAll('button, input, select, textarea, a, .date-area, .message-center-btn, .avatar-area, .topbar-brand')
      for (const c of interactive) {
        if (c === el || c.contains(el)) return
      }
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().startDragging()
      } catch (err) {
        // 忽略拖拽失败（如非主按钮或权限未配置）
      }
      return
    }
    node = node.parentElement
  }
}

// ---- 更新状态 ----
const showUpdateModal = ref(false)
const updateChecking = ref(false)
const updateDownloading = ref(false)
const updateDownloadDone = ref(false)
const updateInfo = ref(null)         // { version, downloadUrl, releaseNotes }
const updateProgress = ref(0)
const updateError = ref('')
const updateCheckDone = ref(false)
const updateCheckError = ref('')
let updateDismissed = false           // 用户点击"稍后"后本次启动不再弹窗
let downloadedInstallerPath = ''      // 下载完成的安装包路径（供"稍后更新"使用）
let progressUnlisten = null           // 下载进度事件监听器（用于取消监听）

const updateTitleText = computed(() => {
  if (updateChecking.value) return '检查更新'
  if (updateInfo.value) return '发现新版本'
  if (updateCheckError.value) return '检查失败'
  return '版本检查'
})

// ---- 核心逻辑 ----

/**
 * 检查 GitHub 是否有新版本
 * 调用 Rust check_for_update，返回 { version, downloadUrl, releaseNotes } 或 null
 */
async function checkForUpdate() {
  if (!isTauri || !settingsStore.isLoggedIn) return
  try {
    updateChecking.value = true
    updateCheckDone.value = false
    updateCheckError.value = ''
    updateInfo.value = null
    const { invoke } = await import('@tauri-apps/api/core')
    // 同步 GitHub Token 到 Rust 后端
    if (settingsStore.githubUpdateToken) {
      try { await invoke('set_github_token', { token: settingsStore.githubUpdateToken }) } catch {}
    }
    // 优先使用 Tauri getVersion() 获取真实安装版本，避免 localStorage appVersion 不准
    let realVersion = settingsStore.appVersion
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      realVersion = await getVersion()
      // 同步真实版本号到 store + localStorage，确保侧边栏显示一致
      if (realVersion && realVersion !== settingsStore.appVersion) {
        settingsStore.setAppVersion(realVersion)
      }
    } catch {}
    const result = await invoke('check_for_update', { currentVersion: realVersion })
    updateChecking.value = false
    updateCheckDone.value = true
    if (result) {
      updateInfo.value = result
      if (!updateDismissed) showUpdateModal.value = true
    }
  } catch (e) {
    updateChecking.value = false
    // 展示 Rust 返回的真实原因（如 HTTP 401/403/404），便于定位而非一律归咎于网络
    const raw = typeof e === 'string' ? e : (e && e.message) || ''
    updateCheckError.value = raw || '检查更新失败，请检查网络后重试'
    console.warn('[update] 检查更新失败:', e)
  }
}

/**
 * 开始下载安装包
 * 监听 download-progress 事件更新进度条，完成后缓存安装包路径
 */
async function startUpdate() {
  if (!updateInfo.value) return
  // 已有缓存的安装包，直接跳到安装选择
  if (downloadedInstallerPath) {
    updateDownloadDone.value = true
    updateDownloading.value = false
    updateProgress.value = 100
    return
  }
  updateDownloading.value = true
  updateDownloadDone.value = false
  updateProgress.value = 0
  updateError.value = ''
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    // 监听下载进度
    progressUnlisten = await listen('download-progress', (event) => {
      updateProgress.value = Number(event.payload) || 0
    })
    // Rust 端流式下载 + 进度推送
    const installerPath = await invoke('download_update', { downloadUrl: updateInfo.value.downloadUrl })
    if (progressUnlisten) { progressUnlisten(); progressUnlisten = null }
    updateProgress.value = 100
    updateDownloading.value = false
    updateDownloadDone.value = true
    downloadedInstallerPath = installerPath
  } catch (e) {
    updateDownloading.value = false
    updateError.value = '下载失败：' + String(e)
    console.error('[update] 下载失败:', e)
  }
}

/**
 * 立即安装：关闭软件，弹出可见的 NSIS 安装向导
 */
async function doInstallNow() {
  if (!downloadedInstallerPath) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('install_update', { installerPath: downloadedInstallerPath })
  } catch (e) {
    updateError.value = '启动安装失败：' + String(e)
    console.error('[update] 启动安装失败:', e)
  }
}

/**
 * 稍后更新：关闭弹窗，保留安装包路径
 */
function doInstallLater() {
  showUpdateModal.value = false
  updateDismissed = true
}

function dismissUpdateModal() {
  showUpdateModal.value = false
  updateDismissed = true
}

/**
 * 格式化更新说明（简单 markdown → HTML）
 */
function formatUpdateNotes(notes) {
  if (!notes) return ''
  return notes
    .split('\n')
    .map(line => {
      if (line.startsWith('## ')) return `<div style="font-weight:600;margin-top:8px;color:var(--color-text);">${line.slice(3)}</div>`
      if (line.startsWith('### ')) return `<div style="font-weight:600;margin-top:6px;color:var(--color-text);font-size:13px;">${line.slice(4)}</div>`
      if (line.trim().startsWith('- ')) return `<div style="padding-left:12px;color:var(--color-text-secondary);font-size:13px;">${line.trim().slice(2)}</div>`
      return `<div style="color:var(--color-text-secondary);font-size:13px;">${line}</div>`
    })
    .join('')
}

/**
 * 手动检查更新（左上角版本号点击 / 关于平台弹窗按钮）
 */
function manualCheckUpdate() {
  updateDismissed = false
  updateInfo.value = null
  updateCheckDone.value = false
  updateCheckError.value = ''
  updateDownloading.value = false
  updateDownloadDone.value = false
  updateProgress.value = 0
  updateError.value = ''
  showUpdateModal.value = true
  checkForUpdate()
}

const isElectron = !!(window.electronAPI && window.electronAPI.isElectron)

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const logStore = useLogStore()
const planStore = usePlanStore()
const messageStore = useMessageStore()
const papersStore = usePapersStore()
const paperLibraryStore = usePaperLibraryStore()
const researchStore = useResearchStore()
const infoStore = useInfoStore()

// 屏幕自适应：自动识别大屏/小屏，驱动布局优化
const { isCompact, isNarrow } = useScreenSize()

const showMorningPopup = ref(false)
const showLogModal = ref(false)
const needsStorageRegrant = ref(false)
const storageFolderName = ref('')
const showFileStorageHint = ref(false)
const showChangelogModal = ref(false)
const showMessageModal = ref(false)

// 平台文档最新修改时间（随版本迭代更新）
const platformDocUpdatedAt = ref('2026-08-28 20:30（v5.0.265）')

// 版本更新记录编辑模式
const editingChangelog = ref(false)
const editTimes = ref([])

function startEditChangelog() {
  editTimes.value = settingsStore.changelog.map(e => e.time || '')
  editingChangelog.value = true
}

function saveChangelogEdits() {
  settingsStore.changelog.forEach((entry, i) => {
    const newTime = (editTimes.value[i] || '').trim()
    if (newTime) entry.time = newTime
  })
  save('changelog', settingsStore.changelog)
  editingChangelog.value = false
}

function cancelChangelogEdits() {
  editingChangelog.value = false
  editTimes.value = []
}
const showDeadlineModal = ref(false)
const deadlinePlans = ref([])
const { handleOverlayClick: handleLogOverlay, closeBtnClick: closeLogBtn } = useModalClose(() => { showLogModal.value = false })
const { handleOverlayClick: handleChangelogOverlay, closeBtnClick: closeChangelogBtn } = useModalClose(() => { showChangelogModal.value = false })
const { handleOverlayClick: handleMessageOverlay, closeBtnClick: closeMessageBtn } = useModalClose(() => { showMessageModal.value = false })
const { handleOverlayClick: handleDeadlineOverlay, closeBtnClick: closeDeadlineBtn } = useModalClose(() => { showDeadlineModal.value = false })
const showAboutModal = ref(false)
const { handleOverlayClick: handleAboutOverlay, closeBtnClick: closeAboutBtn } = useModalClose(() => { showAboutModal.value = false })
function openAbout() {
  showLogoutMenu.value = false
  showAboutModal.value = true
}
function closeAbout() {
  showAboutModal.value = false
}
const showPlatformDocModal = ref(false)
const { handleOverlayClick: handlePlatformDocOverlay, closeBtnClick: closePlatformDocBtn } = useModalClose(() => { showPlatformDocModal.value = false })
function openPlatformDoc() {
  showLogoutMenu.value = false
  showPlatformDocModal.value = true
}
function closePlatformDoc() {
  showPlatformDocModal.value = false
}

// ===== 平台文档：目录导航与导出 =====
const platformDocBodyRef = ref(null)
const platformDocNavRef = ref(null)
const docToc = ref([])
const activeTocId = ref('')

function refreshDocToc() {
  nextTick(() => {
    const body = platformDocBodyRef.value
    if (!body) return
    const sections = body.querySelectorAll('section.doc-section')
    docToc.value = Array.from(sections).map(sec => {
      const h4 = sec.querySelector('h4')
      return { id: sec.id, title: h4 ? h4.textContent.trim() : sec.id }
    }).filter(item => item.id)
    observeDocSections()
  })
}

function scrollToDocSection(id) {
  const body = platformDocBodyRef.value
  if (!body) return
  const sec = body.querySelector('#' + id)
  if (sec) {
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

let docScrollObserver = null
function observeDocSections() {
  const body = platformDocBodyRef.value
  if (!body) return
  if (docScrollObserver) docScrollObserver.disconnect()
  const sections = body.querySelectorAll('section.doc-section')
  docScrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        activeTocId.value = entry.target.id
      }
    })
  }, { root: body, threshold: 0.1 })
  sections.forEach(sec => docScrollObserver.observe(sec))
}

watch(showPlatformDocModal, (val) => {
  if (val) {
    refreshDocToc()
  } else if (docScrollObserver) {
    docScrollObserver.disconnect()
  }
})

let docMutationObserver = null

function buildDocExportHtml() {
  const body = platformDocBodyRef.value
  const title = '研究生工作管理平台 · 使用与接手手册'
  const sections = body ? body.innerHTML : ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.7; color: #1f2937; max-width: 800px; margin: 40px auto; padding: 0 24px; }
h1 { text-align: center; font-size: 22px; margin-bottom: 8px; }
.version { text-align: center; color: #6b7280; font-size: 13px; margin-bottom: 32px; }
h4 { font-size: 16px; margin-top: 28px; padding-bottom: 8px; border-bottom: 1px dashed #e5e7eb; }
p, li { font-size: 14px; color: #4b5563; }
code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
pre { background: #f9fafb; padding: 12px; border-radius: 8px; overflow-x: auto; }
a { color: #2563eb; text-decoration: none; }
ul { padding-left: 20px; }
.doc-section { margin-bottom: 24px; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="version">Version: ${settingsStore.appVersion} · 共 ${docToc.value.length} 章</p>
${sections}
</body>
</html>`
}

function exportDocHtml() {
  const html = buildDocExportHtml()
  saveTextToFile(`研究生工作台_平台文档_${settingsStore.appVersion}.html`, html, 'text/html;charset=utf-8')
}

function exportDocPdf() {
  const html = buildDocExportHtml()
  _printHtml(html)
}

const showProfileModal = ref(false)
const { handleOverlayClick: handleProfileOverlay, closeBtnClick: closeProfileBtn } = useModalClose(() => { showProfileModal.value = false })
const profileForm = reactive({
  profile: { ...settingsStore.profile },
  avatarImage: settingsStore.avatarImage,
})
const profileHasChanges = ref(false)
const profileAvatarInput = ref(null)
function openProfile() {
  showLogoutMenu.value = false
  profileForm.profile = { ...settingsStore.profile }
  profileForm.avatarImage = settingsStore.avatarImage
  profileHasChanges.value = false
  showProfileModal.value = true
}
function closeProfile() {
  showProfileModal.value = false
}
function markProfileDirty() {
  profileHasChanges.value = true
}
function saveProfile() {
  settingsStore.updateProfile({ ...profileForm.profile })
  settingsStore.setAvatarImage(profileForm.avatarImage)
  profileHasChanges.value = false
  alert('个人信息已保存！')
}
function triggerProfileAvatarUpload() {
  profileAvatarInput.value?.click()
}
async function handleProfileAvatarUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    profileForm.avatarImage = await compressImage(reader.result, { maxSize: 256, quality: 0.8 })
    markProfileDirty()
  }
  reader.readAsDataURL(file)
}
const showLogoutMenu = ref(false)
function toggleLogoutMenu() {
  showLogoutMenu.value = !showLogoutMenu.value
}

// ===== 登录态有效期：距上次登录超过 24 小时强制下线 =====
const sessionTick = ref(Date.now())   // 每分钟自增，驱动剩余时长文案刷新
let sessionTimer = null

function sessionRemainMs() {
  sessionTick.value // 建立响应式依赖
  const t = Number(settingsStore.authLoginAt) || 0
  if (!t) return 0
  return t + SESSION_MAX_AGE - Date.now()
}
const loginAtText = computed(() => {
  const t = Number(settingsStore.authLoginAt) || 0
  return t ? dayjs(t).format('MM-DD HH:mm') : '—'
})
const sessionRemainText = computed(() => {
  const ms = sessionRemainMs()
  if (ms <= 0) return '已过期'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分`
})
const sessionExpiringSoon = computed(() => {
  const ms = sessionRemainMs()
  return ms > 0 && ms <= 3600000  // 剩余不足 1 小时
})

function enforceSession() {
  sessionTick.value = Date.now()
  if (settingsStore.checkSession()) {
    showLogoutMenu.value = false
    window.location.hash = '#/'
  }
}

onMounted(() => {
  enforceSession()                                  // 启动即校验
  sessionTimer = setInterval(enforceSession, 60000) // 运行期每分钟校验
  window.addEventListener('focus', enforceSession)  // 切回标签页立即校验
})
onBeforeUnmount(() => {
  if (sessionTimer) clearInterval(sessionTimer)
  window.removeEventListener('focus', enforceSession)
})

function doLogout() {
  settingsStore.logout()
  showLogoutMenu.value = false
  window.location.hash = '#/'
}
function goToSettings() {
  showLogoutMenu.value = false
  window.location.hash = '#/settings'
}
function iconForChangelogLine(text) {
  const t = text.toLowerCase()
  if (t.includes('弹窗') || t.includes('窗口') || t.includes('入口') || t.includes('菜单') || t.includes('下拉')) return ''
  if (t.includes('图标') || t.includes('样式') || t.includes('颜色') || t.includes('主题') || t.includes('配色') || t.includes('宽度') || t.includes('排版') || t.includes('布局') || t.includes('对齐')) return ''
  if (t.includes('日历') || t.includes('日期') || t.includes('年') || t.includes('月') || t.includes('周') || t.includes('计划中心')) return ''
  if (t.includes('论文') || t.includes('文献') || t.includes('科研') || t.includes('组会') || t.includes('导航')) return ''
  if (t.includes('pdf') || t.includes('文件')) return ''
  if (t.includes('笔记')) return ''
  if (t.includes('消息') || t.includes('通知') || t.includes('提醒')) return ''
  if (t.includes('删除') || t.includes('移除') || t.includes('清理')) return ''
  if (t.includes('修复') || t.includes('bug') || t.includes('卡顿') || t.includes('崩溃')) return ''
  if (t.includes('数据') || t.includes('备份') || t.includes('存储') || t.includes('恢复') || t.includes('迁移') || t.includes('导入')) return ''
  if (t.includes('屏幕') || t.includes('自适应') || t.includes('响应式') || t.includes('大小')) return ''
  if (t.includes('积分') || t.includes('奖励') || t.includes('等级')) return ''
  if (t.includes('设置') || t.includes('配置') || t.includes('后台管理')) return ''
  if (t.includes('版本') || t.includes('日志') || t.includes('更新记录')) return ''
  if (t.includes('平台文档') || t.includes('关于平台') || t.includes('文档')) return ''
  if (t.includes('新增') || t.includes('新')) return ''
  return ''
}
function formatChangelog(content) {
  return (content || '')
    .replace(/\\\\n/g, '\n')
    .split('\n')
    .map(line => {
      if (!line.trim().startsWith('•')) return line
      const rest = line.replace(/^•\s*/, '').replace(/^<AppIcon name="plus-circle" \/> \s*/, '')
      const firstCp = rest.codePointAt(0)
      if (firstCp >= 0x1F300 && firstCp <= 0x1F9FF) return '• ' + rest
      return '• ' + iconForChangelogLine(rest) + ' ' + rest
    })
    .join('\n')
}
const showDatePicker = ref(false)
const calendarMonth = ref(dayjs())

const routeDefinitions = {
  '/': { path: '/',     meta: { title: '信息预览', icon: 'home' } },
  '/research': { path: '/research', meta: { title: '科研中心', icon: 'flask' } },
  '/simulation': { path: '/simulation', meta: { title: '仿真中心', icon: 'cpu' } },
  '/papers': { path: '/papers', meta: { title: '论文中心', icon: 'book-open' } },
  '/plan': { path: '/plan', meta: { title: '计划中心', icon: 'calendar-check' } },
  '/navigation': { path: '/navigation', meta: { title: '科研导航', icon: 'compass' } },
  '/finance': { path: '/finance', meta: { title: '财务中心', icon: 'wallet' } },
  '/settings': { path: '/settings', meta: { title: '平台设置', icon: 'settings' } },
}

const mainRoutes = computed(() => {
  return settingsStore.navOrder.map(path => routeDefinitions[path]).filter(Boolean)
})

const sidebarVisible = computed(() => {
  return settingsStore.sidebarPinned
})

// 悬浮岛式导航：平台设置 → 导航栏样式 选择「悬浮岛式」时启用
const isFloatingNav = computed(() => {
  return settingsStore.theme?.navStyle === 'floating'
})

// ===== 融合态导航：一级导航水平居中，点击进入二级导航，主页按钮返回一级 =====
const isMergeNav = computed(() => {
  return settingsStore.theme?.navStyle === 'merge'
})

// 各页面的二级导航 Tab 定义（与各视图内部 tabs 定义保持一致）
const SUB_NAV_TABS = {
  '/research': [
    { id: 'papers', name: '论文管理' },
    { id: 'assistant', name: '研究助手' },
    { id: 'meetings', name: '组会纪要' },
    { id: 'milestones', name: '培养节点' },
  ],
  '/simulation': [
    { id: 'overview', name: '总览' },
    { id: 'library', name: '仿真列表' },
  ],
  '/papers': [
    { id: 'overview', name: '总览' },
    { id: 'reading', name: '论文阅读' },
    { id: 'library', name: '论文列表' },
    { id: 'notes', name: '论文笔记' },
  ],
  '/plan': [
    { id: 'overview', name: '总览' },
    { id: 'daily', name: '每日打卡' },
    { id: 'library', name: '计划列表' },
    { id: 'calendar', name: '日历视图' },
  ],
  '/navigation': [
    { id: 'overview', name: '总览' },
    { id: 'websites', name: '网站导航' },
    { id: 'subscription', name: '订阅中心' },
  ],
  '/finance': [
    { id: 'overview', name: '总览' },
    { id: 'library', name: '财务库' },
    { id: 'info', name: '信息库' },
  ],
}

// 当前路由页面的二级导航 Tab 列表
const currentSubTabs = computed(() => SUB_NAV_TABS[route.path] || [])

// 融合态导航层级：'l1' 显示一级导航条，'l2' 显示二级导航条
const navLevel = ref('l1')

// 融合态下是否显示一级导航条（无二级页面的路由始终显示一级；有二级页面进入后切到 l2）
const showLevel1Nav = computed(() => {
  if (!isMergeNav.value) return false
  // 无二级导航的页面（首页、平台设置）始终显示一级
  if (currentSubTabs.value.length === 0) return true
  // 有二级导航的页面，取决于 navLevel
  return navLevel.value === 'l1'
})

// 融合态下是否显示二级导航条
const showLevel2Nav = computed(() => {
  if (!isMergeNav.value) return false
  if (currentSubTabs.value.length === 0) return false
  return navLevel.value === 'l2'
})

// 当前选中的二级 Tab（从 store 读取，与各视图共享）
const currentActiveSubTab = computed(() => {
  return settingsStore.activeSubTabs[route.path] || (currentSubTabs.value[0]?.id ?? '')
})

// 点击一级导航项
function mergeNavClick(path) {
  if (SUB_NAV_TABS[path] && SUB_NAV_TABS[path].length > 0) {
    // 有二级导航：进入二级态
    navLevel.value = 'l2'
  } else {
    // 无二级导航（首页、平台设置）：保持一级
    navLevel.value = 'l1'
  }
  router.push(path)
}

// 点击主页按钮：回到一级导航条（保留当前页面内容）
function mergeNavHome() {
  navLevel.value = 'l1'
}

// 点击二级导航 Tab
function mergeNavSubTab(tabId) {
  settingsStore.setActiveSubTab(route.path, tabId)
}

// 路由变化时，若新页面无二级导航，自动回到 l1；有二级导航时保持当前层级
watch(() => route.path, (newPath) => {
  if (!isMergeNav.value) return
  if (!SUB_NAV_TABS[newPath] || SUB_NAV_TABS[newPath].length === 0) {
    navLevel.value = 'l1'
  }
})

const currentRouteTitle = computed(() => {
  const r = mainRoutes.value.find(r => r.path === route.path)
  if (r) return r.meta.title
  if (route.path === '/settings') return '平台设置'
  return '研究生工作台'
})

const currentDateStr = computed(() => {
  if (settingsStore.customDate) return settingsStore.customDate
  return dayjs().format('YYYY-MM-DD')
})

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const displayDate = computed(() => {
  const d = settingsStore.customDate ? dayjs(settingsStore.customDate) : dayjs()
  return d.format('MM月DD日') + ' ' + weekdays[d.day()]
})

const semesterWeek = computed(() => {
  // 自定义周数优先（兼容旧数据：null/undefined 都视为未自定义）
  if (settingsStore.customWeek !== null && settingsStore.customWeek !== undefined && settingsStore.customWeek !== '') {
    const w = Number(settingsStore.customWeek)
    if (!isNaN(w) && w >= 1 && w <= 52) return w
  }
  // 自动计算周数：基于自定义日期或今天的日期
  const dateStr = settingsStore.customDate ? settingsStore.customDate : dayjs().format('YYYY-MM-DD')
  const d = dayjs(dateStr)
  // 防御：无效日期回退到今天
  if (!d.isValid()) {
    return Math.max(1, dayjs().startOf('isoWeek').diff(dayjs('2026-08-08').startOf('isoWeek'), 'week') + 1)
  }
  // 定 2026-08-08 所在周为第 1 周（周一为周起始）
  // 2026-08-08 是周六，所在周的周一是 2026-08-03
  const semesterStart = dayjs('2026-08-08').startOf('isoWeek')
  // isoWeek: 周一=1..周日=7，startOf('isoWeek') 取周一
  const diff = d.startOf('isoWeek').diff(semesterStart, 'week')
  const week = Math.max(1, diff + 1)
  return isNaN(week) ? 1 : week
})

const editingWeek = computed(() => semesterWeek.value)

// 计划库消息中心提醒配置（供计划临近提醒弹窗文案/标注使用）
const planReminderCfg = computed(() => settingsStore.planReminder || {})
const planRemindDaysAhead = computed(() => {
  const v = planReminderCfg.value.remindDaysAhead
  return (typeof v === 'number' && v > 0) ? v : 8
})
const planUrgentThreshold = computed(() => Math.min(3, planRemindDaysAhead.value))

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const calendarDays = computed(() => {
  const startOfMonth = calendarMonth.value.startOf('month')
  const endOfMonth = calendarMonth.value.endOf('month')
  const startDay = startOfMonth.day() || 7 // Mon=1 ... Sun=7
  const daysInMonth = endOfMonth.date()
  const todayStr = dayjs().format('YYYY-MM-DD')
  const selectedStr = currentDateStr.value

  const cells = []
  // Leading empty cells
  for (let i = 1; i < startDay; i++) cells.push(null)
  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = startOfMonth.date(d)
    const dateStr = date.format('YYYY-MM-DD')
    cells.push({
      day: d,
      dateStr,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      isOtherMonth: false,
    })
  }
  // Fill trailing to complete 7-column grid
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
})

function prevMonth() {
  calendarMonth.value = calendarMonth.value.subtract(1, 'month')
}
function nextMonth() {
  calendarMonth.value = calendarMonth.value.add(1, 'month')
}

function pickCalendarDate(dateStr) {
  settingsStore.setCustomDate(dateStr)
}

function onWeekInput(e) {
  const val = parseInt(e.target.value)
  if (!isNaN(val)) {
    settingsStore.setCustomWeek(Math.max(1, Math.min(52, val)))
  }
}
function incrementWeek() {
  settingsStore.setCustomWeek(Math.min(52, semesterWeek.value + 1))
}
function decrementWeek() {
  settingsStore.setCustomWeek(Math.max(1, semesterWeek.value - 1))
}

function resetCustomDate() {
  settingsStore.setCustomDate(null)
  settingsStore.setCustomWeek(null)
  calendarMonth.value = dayjs()
  showDatePicker.value = false
}

function openMessageCenter() {
  showMessageModal.value = true
}

// 消息中心筛选：全部 / 未读 / 已读
const msgFilter = ref('all')
const filteredMessages = computed(() => {
  // 更新推送只显示最新版本：过滤掉历史版本 update- 残留消息（渲染层防线，防数据层旧残留被用户看到）
  const latestVersion = settingsStore.changelog.length > 0 ? settingsStore.changelog[0].version : null
  let list = messageStore.sortedMessages
  if (latestVersion) {
    list = list.filter(m => !(String(m.id || '').startsWith('update-') && m.id !== 'update-' + latestVersion))
  }
  if (msgFilter.value === 'unread') return list.filter(m => !m.read)
  if (msgFilter.value === 'read') return list.filter(m => m.read)
  return list
})
// 消息类型图标：按标题 / 类型区分业务类型，返回 Lucide 图标名
function msgIcon(msg) {
  const title = (msg.title || '').trim()
  if (title.includes('登录')) return 'user'
  if (title.includes('论文')) return 'file-text'
  if (title.includes('文献')) return 'book-open'
  if (msg.action === 'viewChangelog' || title.includes('更新')) return 'sparkles'
  if (msg.type === 'red' || msg.type === 'orange' || msg.type === 'deepred' || msg.type === 'purple') return 'clock'
  return 'bell'
}

// 消息卡片背景：按消息 type 着色（red→淡红、orange→淡橙、info→淡蓝），均为淡色不刺眼
function msgCardClass(msg) {
  if (msg.type === 'red') return 'msg-bg-red'
  if (msg.type === 'orange') return 'msg-bg-orange'
  if (msg.type === 'info') return 'msg-bg-info'
  if (msg.type === 'purple') return 'msg-bg-purple'
  if (msg.type === 'deepred') return 'msg-bg-deepred'
  return ''
}

function formatDateTime(dt) {
  if (!dt) return '-'
  return dayjs(dt).format('MM-DD HH:mm')
}

function goToPlanCenter() {
  showDeadlineModal.value = false
  window.location.hash = '#/plan'
}

function checkPlanDeadlines() {
  if (!settingsStore.isLoggedIn) return
  const today = dayjs().startOf('day')

  // 读取自定义提醒配置（兼容旧数据：缺失字段回退默认值）
  const cfg = settingsStore.planReminder || {}
  const remindDaysAhead = typeof cfg.remindDaysAhead === 'number' && cfg.remindDaysAhead > 0 ? cfg.remindDaysAhead : 8
  const colors = cfg.remindColors || {}
  const cNear = colors.near || '#F59E0B'
  const cUrgent = colors.urgent || '#EF4444'
  const cOverdue = colors.overdue || '#8B5CF6'
  const cSevere = colors.severe || '#DC2626'
  // 参与提醒的状态集合（默认：除已完成/放弃外的全部状态）
  const remindStatuses = Array.isArray(cfg.remindStatuses) && cfg.remindStatuses.length > 0
    ? cfg.remindStatuses
    : settingsStore.planStatuses.filter(s => s.id !== 'completed' && s.id !== 'abandoned').map(s => s.id)

  // 筛选：状态在提醒集合内 + 有结束日期 + 距结束 ≤ remindDaysAhead（含逾期）的计划
  const upcoming = planStore.plans
    .filter(p => remindStatuses.includes(p.status) && p.endDate)
    .map(p => {
      const end = dayjs(p.endDate).startOf('day')
      const daysLeft = end.diff(today, 'day')
      return { ...p, daysLeft }
    })
    // 距结束 ≤ remindDaysAhead（含逾期）的计划均纳入检测
    .filter(p => p.daysLeft <= remindDaysAhead)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  if (upcoming.length === 0) return

  deadlinePlans.value = upcoming
  showDeadlineModal.value = true

  // 同步到消息中心（去重：同一天同一任务只发一次，msgId 含日期；逾期后每天持续提醒直到状态变更）
  upcoming.forEach(plan => {
    const msgId = 'deadline-' + plan.id + '-' + today.format('YYYY-MM-DD')
    const exists = messageStore.messages.some(m => m.id === msgId)
    if (!exists) {
      // 颜色分级（颜色来自自定义配置）：
      //   逾期 ≥7 天  → severe（深红）
      //   逾期 ≥3 天  → overdue（淡紫）
      //   距结束 ≤3 天 → urgent（淡红）
      //   距结束 ≤remindDaysAhead 天 → near（淡橙）
      const urgentThreshold = Math.min(3, remindDaysAhead)
      let level, title
      if (plan.daysLeft < 0 && Math.abs(plan.daysLeft) >= 7) {
        level = 'deepred'
        title = '计划任务严重逾期提醒'
      } else if (plan.daysLeft < 0 && Math.abs(plan.daysLeft) >= 3) {
        level = 'purple'
        title = '计划任务逾期提醒'
      } else if (plan.daysLeft <= urgentThreshold) {
        level = 'red'
        title = '计划任务紧急提醒'
      } else {
        level = 'orange'
        title = '计划任务临近提醒'
      }
      const absDays = Math.abs(plan.daysLeft)
      const daysDesc = plan.daysLeft === 0
        ? '今天截止'
        : plan.daysLeft > 0
          ? `距离截止还有 ${absDays} 天`
          : `已逾期 ${absDays} 天`
      messageStore.addMessage({
        id: msgId,
        title,
        content: `「${plan.title}」${daysDesc}，请及时处理。`,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
        read: false,
        type: level,
        daysLeft: plan.daysLeft,
      })
    }
  })
}

/**
 * 论文稿件生命周期滞留提醒：每个状态停留超过 7 天提醒一次，之后每满 7 天再提醒，
 * 直到状态变更（msgId 含状态，状态一变旧 id 失效、新状态重新计时）；发表状态不提醒。
 */
function checkPaperStagnation() {
  if (!settingsStore.isLoggedIn) return
  const today = dayjs().startOf('day')
  const statusNameMap = {}
  papersStore.statuses.forEach(s => { statusNameMap[s.id] = s.name })
  papersStore.papers.forEach(p => {
    if (p.status === 'published') return
    const startDate = p.statusDates?.[p.status]
    if (!startDate) return
    const start = dayjs(startDate).startOf('day')
    if (!start.isValid()) return
    const days = today.diff(start, 'day')
    if (days < 7) return
    const weekIndex = Math.floor(days / 7)
    const msgId = `paper-${p.id}-${p.status}-w${weekIndex}`
    if (messageStore.messages.some(m => m.id === msgId)) return
    const statusName = statusNameMap[p.status] || p.status
    messageStore.addMessage({
      id: msgId,
      title: '论文稿件滞留提醒',
      content: `论文《${p.title}》在「${statusName}」状态已停留 ${days} 天（自 ${startDate} 起），建议尽快推进到下一阶段。`,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      read: false,
      type: 'orange',
    })
  })
}

/**
 * 文献阅读超时提醒：论文库标记「正在阅读」后开始计时，超过一周发送提醒，
 * 之后每满 7 天再提醒，直到状态改为非「正在阅读」。
 */
function checkReadingTimeout() {
  if (!settingsStore.isLoggedIn) return
  const today = dayjs().startOf('day')
  paperLibraryStore.papers.forEach(p => {
    if (p.status !== 'reading') return
    // 旧数据没有阅读开始时间：以当前时间回填，从今天开始计时（避免历史文献突然弹提醒）
    if (!p.readingStartedAt) {
      p.readingStartedAt = dayjs().format('YYYY-MM-DD HH:mm')
      save('paperLibrary', paperLibraryStore.papers)
    }
    const start = dayjs(p.readingStartedAt).startOf('day')
    if (!start.isValid()) return
    const days = today.diff(start, 'day')
    if (days < 7) return
    const weekIndex = Math.floor(days / 7)
    const msgId = `reading-${p.id}-w${weekIndex}`
    if (messageStore.messages.some(m => m.id === msgId)) return
    messageStore.addMessage({
      id: msgId,
      title: '文献阅读超时提醒',
      content: `文献《${p.title}》标记「正在阅读」已 ${days} 天（自 ${p.readingStartedAt.slice(0, 10)} 起），请尽快完成阅读或调整状态。`,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      read: false,
      type: 'orange',
    })
  })
}

/**
 * 每日底线任务提醒：当天 22:00 后检查，如有未完成任务推送提醒（每天一次）。
 */
function checkDailyCheckin() {
  if (!settingsStore.isLoggedIn) return
  const now = dayjs()
  if (now.hour() < 22) return
  const date = now.format('YYYY-MM-DD')
  const remindedKey = 'mw_dailyCheckinReminded_' + date
  if (localStorage.getItem(remindedKey)) return

  const c = planStore.dailyCheckins.find(x => x.date === date)
  if (!c || c.tasks.length === 0) return

  const undone = c.tasks.filter(t => !t.completed)
  if (undone.length === 0) return

  const msgId = 'daily-checkin-' + date
  if (!messageStore.messages.some(m => m.id === msgId)) {
    messageStore.addMessage({
      id: msgId,
      title: '每日底线任务未完成',
      content: `今天还有 ${undone.length} 项底线任务未完成，请及时完成并填写今日总结。`,
      createdAt: now.format('YYYY-MM-DD HH:mm'),
      read: false,
      type: 'red',
    })
  }
  localStorage.setItem(remindedKey, '1')
}

/**
 * 每周总结提醒：每周日 20:00 后检查，如未填写本周总结则推送提醒。
 */
function checkWeeklySummary() {
  if (!settingsStore.isLoggedIn) return
  const now = dayjs()
  if (now.day() !== 0 || now.hour() < 20) return
  const weekStart = now.startOf('week').add(1, 'day').format('YYYY-MM-DD')
  const remindedKey = 'mw_weeklySummaryReminded_' + weekStart
  if (localStorage.getItem(remindedKey)) return

  const s = planStore.weeklySummaries.find(x => x.weekStart === weekStart)
  if (s && s.writtenAt) return

  const msgId = 'weekly-summary-' + weekStart
  if (!messageStore.messages.some(m => m.id === msgId)) {
    messageStore.addMessage({
      id: msgId,
      title: '本周总结待填写',
      content: '周日已到，请前往计划中心「每日打卡」填写本周总结，回顾一周进展。',
      createdAt: now.format('YYYY-MM-DD HH:mm'),
      read: false,
      type: 'orange',
    })
  }
  localStorage.setItem(remindedKey, '1')
}

/**
 * 信息库到期提醒：订阅/团购/卡证到期前 3 天、1 天、当天各提醒一次（消息中心）。
 * msgId 格式：info-expire-{typeId}-{itemId}-{daysLeft}，daysLeft 为 3/1/0。
 */
function checkInfoExpiry() {
  if (!settingsStore.isLoggedIn) return
  const today = dayjs().startOf('day')

  // 收集所有有到期日期的信息项
  const items = []
  // 订阅
  infoStore.subscriptions.forEach(s => {
    if (s.expireDate) items.push({ type: 'subscription', typeLabel: '软件订阅', id: s.id, name: s.name, expireDate: s.expireDate })
  })
  // 团购
  infoStore.groupbuys.forEach(g => {
    if (g.status === '未使用' && g.availableTime) {
      // 团购可用时间可能是日期范围，取结束日期
      const dates = String(g.availableTime).split('~').map(d => d.trim())
      const end = dates.length > 1 ? dates[dates.length - 1] : dates[0]
      if (end) items.push({ type: 'groupbuy', typeLabel: '团购', id: g.id, name: g.name, expireDate: end })
    }
  })
  // 卡证（非永久有效）
  infoStore.cards.forEach(c => {
    if (!c.permanent && c.expireDate) items.push({ type: 'card', typeLabel: '卡证', id: c.id, name: c.name, expireDate: c.expireDate })
  })

  items.forEach(item => {
    const expire = dayjs(item.expireDate).startOf('day')
    if (!expire.isValid()) return
    const daysLeft = expire.diff(today, 'day')
    // 到期前 3 天、1 天、当天各提醒一次
    if (![3, 1, 0].includes(daysLeft)) return

    const msgId = `info-expire-${item.type}-${item.id}-${daysLeft}`
    if (messageStore.messages.some(m => m.id === msgId)) return

    const dayText = daysLeft === 0 ? '今天到期' : `还剩 ${daysLeft} 天到期`
    const level = daysLeft === 0 ? 'red' : (daysLeft === 1 ? 'red' : 'orange')
    messageStore.addMessage({
      id: msgId,
      title: `${item.typeLabel}到期提醒`,
      content: `「${item.name}」${dayText}（到期日：${item.expireDate}），请及时处理。`,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      read: false,
      type: level,
      daysLeft,
    })
  })
}

/**
 * 数据自检自愈：检测 localStorage 中被污染的核心数据键
 * （值为 'null'/'undefined'/空串/损坏 JSON），优先从本地文件存储恢复，无文件数据则清除该键，
 * 让各 Store 回退到默认值，杜绝「页面读不到数据」与「继续写坏数据」。
 */
async function healPollutedData() {
  const prefix = 'mw_'
  const CORE_KEYS = ['plans', 'reviews', 'paperLibrary', 'simulations', 'notes', 'messages', 'logs', 'changelog', 'rollbackHistory', 'settings', 'profile', 'planNextSeq', 'simNextSeq']
  const polluted = []
  for (const key of CORE_KEYS) {
    const raw = localStorage.getItem(prefix + key)
    if (raw === null) continue
    if (raw === 'null' || raw === 'undefined' || raw.trim() === '') { polluted.push(key); continue }
    try { JSON.parse(raw) } catch { polluted.push(key) }
  }
  if (polluted.length === 0) return false
  console.warn('[heal] 检测到损坏的数据键:', polluted)

  // 优先从本地文件存储恢复（文件是双写备份，最可能保留完整数据）
  if (isFileStorageActive()) {
    try {
      const readAllFn = isElectron ? _eReadAll : _fsReadAll
      const fileData = await readAllFn()
      let restored = 0
      for (const key of polluted) {
        const fileVal = fileData[key]
        if (fileVal !== undefined && fileVal !== null) {
          localStorage.setItem(prefix + key, typeof fileVal === 'string' ? fileVal : JSON.stringify(fileVal))
          restored++
          console.log(`[heal] 已从文件恢复「${key}」`)
        } else {
          localStorage.removeItem(prefix + key)
          console.warn(`[heal] 文件无「${key}」数据，已清除损坏键`)
        }
      }
      useLogStore().addLog(`数据自愈：从本地文件夹恢复 ${restored} 个损坏模块（${polluted.join('、')}）`)
      return restored > 0
    } catch (e) {
      console.warn('[heal] 从文件恢复失败，回退为清除损坏键:', e)
    }
  }
  // 无文件存储或恢复失败 → 直接清除污染键，Store 回退默认值，页面保持可用
  polluted.forEach(key => localStorage.removeItem(prefix + key))
  useLogStore().addLog(`数据自愈：已清除损坏的数据键（${polluted.join('、')}）`)
  return false
}

function toggleDatePicker() {
  if (settingsStore.customDate) {
    calendarMonth.value = dayjs(settingsStore.customDate)
  } else {
    calendarMonth.value = dayjs()
  }
  showDatePicker.value = !showDatePicker.value
}

// 将 HEX 转为 RGB 对象
function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  if (clean.length === 3) {
    const r = (bigint >> 8) & 0xF
    const g = (bigint >> 4) & 0xF
    const b = bigint & 0xF
    return { r: r * 17, g: g * 17, b: b * 17 }
  }
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

// 计算背景亮度（0-1）
function getLuminance(rgb) {
  const a = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

// 根据背景亮度返回高对比度前景色（黑/白）；支持多色（渐变时取平均色）
function getContrastColor(hex) {
  const list = Array.isArray(hex) ? hex : [hex]
  const rgb = list.reduce((acc, h) => {
    const c = hexToRgb(h)
    acc.r += c.r
    acc.g += c.g
    acc.b += c.b
    return acc
  }, { r: 0, g: 0, b: 0 })
  rgb.r = Math.round(rgb.r / list.length)
  rgb.g = Math.round(rgb.g / list.length)
  rgb.b = Math.round(rgb.b / list.length)
  return getLuminance(rgb) > 0.5 ? '#1F2937' : '#FFFFFF'
}

// 解析主题背景值：支持单色（#RRGGBB）与渐变（gradient:#C1:#C2）
// 返回 { background: CSS 背景值, colors: [hex...] }
function parseThemeBg(val) {
  if (typeof val === 'string' && val.startsWith('gradient:')) {
    const [, c1, c2] = val.split(':')
    return { background: `linear-gradient(135deg, ${c1}, ${c2})`, colors: [c1, c2] }
  }
  return { background: val, colors: [val] }
}

// 应用主题配色（强调色层）：读取导航色，推算前景色，写入 --color-nav-*
function applyTheme() {
  const root = document.documentElement
  const navBg = settingsStore.theme?.navBgColor || ''
  if (navBg) {
    const { background, colors } = parseThemeBg(navBg)
    const contrast = getContrastColor(colors)
    const c = hexToRgb(contrast)
    root.style.setProperty('--color-nav-bg', background)
    root.style.setProperty('--color-nav-text', contrast)
    root.style.setProperty('--color-nav-text-secondary', `rgba(${c.r}, ${c.g}, ${c.b}, 0.78)`)
    root.style.setProperty('--color-nav-text-tertiary', `rgba(${c.r}, ${c.g}, ${c.b}, 0.55)`)
    root.style.setProperty('--color-nav-hover-bg', `rgba(${c.r}, ${c.g}, ${c.b}, 0.12)`)
    root.style.setProperty('--color-nav-active-bg', `rgba(${c.r}, ${c.g}, ${c.b}, 0.18)`)
    root.style.setProperty('--color-nav-active-text', contrast)
    root.style.setProperty('--color-nav-border', `rgba(${c.r}, ${c.g}, ${c.b}, 0.14)`)
  } else {
    root.style.removeProperty('--color-nav-bg')
    root.style.removeProperty('--color-nav-text')
    root.style.removeProperty('--color-nav-text-secondary')
    root.style.removeProperty('--color-nav-text-tertiary')
    root.style.removeProperty('--color-nav-hover-bg')
    root.style.removeProperty('--color-nav-active-bg')
    root.style.removeProperty('--color-nav-active-text')
    root.style.removeProperty('--color-nav-border')
  }
}

// 监听主题变化（导航强调色）
watch(() => settingsStore.theme, () => {
  applyTheme()
}, { deep: true })

// 同步毛玻璃模式到 body（使 Teleport to body 的弹层如 cell-picker 也能匹配毛玻璃样式）
watch(() => [settingsStore.moduleFrosted, settingsStore.moduleOpacity], ([frosted, opacity]) => {
  if (frosted) {
    document.body.classList.add('module-frosted')
  } else {
    document.body.classList.remove('module-frosted')
  }
  document.body.style.setProperty('--module-opacity', String(opacity))
}, { immediate: true })

// 欢迎弹窗：仅在登录状态下、当天首次出现时显示
watch(() => settingsStore.isLoggedIn, (loggedIn) => {
  if (loggedIn && settingsStore.morningPopupShown !== todayStr()) {
    showMorningPopup.value = true
  }
}, { immediate: true })

onMounted(async () => {
  // 桌面端：第一时间用 Tauri getVersion() 同步真实版本号到 localStorage
  // 避免 localStorage 残留旧版本号导致侧边栏显示错误 + 检查更新误报
  if (isTauri) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      const realVer = await getVersion()
      if (realVer && realVer !== settingsStore.appVersion) {
        settingsStore.setAppVersion(realVer)
      }
    } catch {}
  }
  // 防刷新死循环：同一会话内最多允许 2 次自动 reload（heal + reconcile）
  try {
    const reloadCount = parseInt(sessionStorage.getItem('mw_reloadGuard') || '0', 10)
    if (reloadCount >= 2) {
      console.warn('[reloadGuard] 已达到本会话最大自动刷新次数，跳过 heal/reconcile')
      sessionStorage.removeItem('mw_reloadGuard')
    } else {
      sessionStorage.setItem('mw_reloadGuard', String(reloadCount + 1))
    }
  } catch {}
  // 数据自愈：检测并修复被污染的 localStorage 键（损坏时优先从本地文件夹恢复）
  const healed = await healPollutedData()
  if (healed) {
    window.location.reload()
    return
  }
  // 应用主题配色 + 初始化更新记录
  applyTheme()
  // 启动时同步 GitHub 更新令牌到 Rust 后端（如有自定义令牌）
  if (isTauri && settingsStore.githubUpdateToken) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('set_github_token', { token: settingsStore.githubUpdateToken })
    } catch {}
  }
  const cl = settingsStore.changelog || []
  const versions = cl.map(e => e.version)
  if (!versions.includes('2.0.106')) {
    settingsStore.addChangelog('2.0.106', '优化状态栏显示，增加导航栏排序功能')
  }
  if (!versions.includes('2.0.107')) {
    settingsStore.addChangelog('2.0.107', '新增数据资产管理中心（数据总览、在线快照存档与恢复）；修正导出逻辑确保头像等大文件完整备份')
  }
  if (!versions.includes('2.0.108')) {
    settingsStore.addChangelog('2.0.108', '状态栏日期支持自定义选择，可切换至任意日期查看对应周数')
  }
  if (!versions.includes('2.0.109')) {
    settingsStore.addChangelog('2.0.109', '日期选择器升级为月视图日历（月份切换+点击选日）；周数支持独立自定义（+/-按钮/手动输入）；"恢复默认"一键重置日期和周数')
  }
  if (!versions.includes('2.0.110')) {
    settingsStore.addChangelog('2.0.110', '版本号自动同步：更新日志新增版本后状态栏自动跟随，无需手动修改；后台管理仍可手动覆盖版本号')
  }
  if (!versions.includes('2.0.111')) {
    settingsStore.addChangelog('2.0.111', '修复数据快照递归膨胀BUG（快照复制自身导致存储配额爆满，影响组会模板等其他数据写入）；快照上限从20个降为5个；新增存储空间不足时的弹窗提醒')
  }
  if (!versions.includes('2.1.110')) {
    settingsStore.addChangelog('2.1.110', '新增 JSON 自动导出功能：后台管理开启后，每次修改/新增数据自动导出备份文件到 F:\\AppData\\WorkBuddy 路径，无需手动操作')
  }
  if (!versions.includes('2.1.111')) {
    settingsStore.addChangelog('2.1.111', '修复计划中心新建任务不同步到日历视图的BUG（日历现在同时展示任务和计划）；云端自动导出升级为双模式（本地存文件，云端存浏览器备份+一键下载）')
  }
  if (!versions.includes('2.1.112')) {
    settingsStore.addChangelog('2.1.112', '修复组会纪要自定义模板修改后页面刷新（或版本更新）数据丢失的BUG（根因：保存时未调用 localStorage 持久化）')
  }
  if (!versions.includes('2.1.113')) {
    settingsStore.addChangelog('2.1.113', '待办和计划新增编辑/删除按钮（点击<AppIcon name="pencil" /> 修改内容，<AppIcon name="trash" /> 删除确认）；新增本地硬盘存储功能（后台管理→选择文件夹→数据直接存在所选目录，不依赖浏览器 localStorage，需 Chrome/Edge）')
  }
  if (!versions.includes('2.1.114')) {
    settingsStore.addChangelog('2.1.114', '重构数据资产管理中心：移除冗余的JSON自动导出/数据快照/数据总览模块（数据已存储在本地硬盘）；新增本地文件夹文件列表展示（文件名/类型/大小/修改时间）；支持更换存储文件夹并自动同步数据')
  }
  if (!versions.includes('2.1.115')) {
    settingsStore.addChangelog('2.1.115', '修复云端页面无限刷新严重BUG（根因：每次加载从文件同步到localStorage后无条件reload导致死循环）；优化页面加载时不再自动同步文件数据（save()本身就是双写，无需回灌）')
  }
  if (!versions.includes('2.2.117')) {
    settingsStore.addChangelog('2.2.117', '个人信息独立页面（头像下拉菜单→个人信息跳转独立页面，不再混在后台管理中）；后台管理精简布局（移除登录人员管理模块，其余卡片合理排列减少空白）；侧边栏固定模式重构（仅两种状态：常驻全部显示/常驻仅图标，取消悬停展开交互）；侧边栏底部新增「牛马科技」品牌文字（宋体居中）；状态栏时间/周数/头像左移优化，头像下拉菜单居中显示')
  }
  if (!versions.includes('2.2.118')) {
    settingsStore.addChangelog('2.2.118', '头像下拉菜单选项文字居中；后台管理模块重排；左侧导航栏6个选项垂直居中')
  }
  if (!versions.includes('3.0.100')) {
    settingsStore.addChangelog('3.0.100',
      '• 科研导航：每个网站分类支持删除，手动排序支持网站分类排序\n' +
      '• 后台管理：删除"展示在主页标题下方"描述，删除番茄钟时长/联系提醒天数/导航使用时长三个冗余配置\n' +
      '• 背景管理：新增主题选项，支持莫兰迪色系等12种预设配色 + 自定义颜色（颜色球+参数面板），可自定义导航栏与状态栏连体背景色'
    )
  }
  if (!versions.includes('3.0.101')) {
    settingsStore.addChangelog('3.0.101',
      '• 顶部连体导航：导航栏与状态栏字体、图标自动根据背景色切换黑/白，确保任意主题下都清晰可读\n' +
      '• 去除分割：导航栏与状态栏之间的白色分隔线已移除，两个区域完全连成一体\n' +
      '• 后台管理：主题配色选项已合并到「其他配置」卡片中，配置更集中'
    )
  }
  if (!versions.includes('3.1.101')) {
    settingsStore.addChangelog('3.1.101',
      '• 晨间弹窗重构：去掉昨日积分播报、应答助手使用、今日积分押注，改为展示学业进度总览与论文概览，底部统一为「开启美好一天」按钮\n' +
      '• 新增论文中心：导航栏科研中心下方新增论文中心入口，内含总览、论文库两个子模块，顶部切换\n' +
      '• 论文库：Excel式文献表格，支持状态（待整理/正在阅读/已阅读，可在后台管理自定义与排序）、论文题目、年份、单位、期刊名称、影响、主要内容、可借鉴创新点等自定义输入\n' +
      '• 论文总览：左侧状态占比饼图（鼠标悬停显示部分文献），右侧展示具体文献数据'
    )
  }
  if (!versions.includes('3.1.102')) {
    settingsStore.addChangelog('3.1.102',
      '• 论文中心优化：表格标题居中显示\n' +
      '• 添加文献窗口精简：去掉阅读级别选择，简化录入流程\n' +
      '• 新增链接识别：粘贴知网链接自动识别论文题目、作者、单位、期刊、年份、摘要并填充\n' +
      '• 搜索界面优化：全部期刊、全部年份、全部状态改为一行三列显示，支持标题+作者联合搜索'
    )
  }
  if (!versions.includes('3.1.103')) {
    settingsStore.addChangelog('3.1.104',
      '• 论文中心优化：表格信息居中显示，状态改为鲜艳彩色徽章+点击弹出菜单切换\n' +
      '• 移除表格"级别"列（泛读/精读），简化界面\n' +
      '• 后台管理新增「论文库表格列显示」：可自定义隐藏/显示状态、题目、作者、年份、期刊、标签列\n' +
      '• 搜索筛选选项关联实际论文数据（期刊/年份下拉动态更新）\n' +
      '• 知网链接识别优化：新增多个CORS代理 + 手动粘贴源码回退方案\n' +
      '• easyScholar 自动识别：输入期刊名称后自动查询影响因子并填入「影响」字段'
    )
  }
  if (!versions.includes('3.1.105')) {
    settingsStore.addChangelog('3.1.105',
      '• 移除添加文献中的链接识别功能（知网CORS问题无法彻底解决）\n' +
      '• 新增 PDF 导入自动识别：上传 PDF 文件自动解析题目/作者/期刊/年份/DOI/摘要\n' +
      '• 后台管理「论文库表格列显示」扩展：新增单位/影响/主要内容/创新点列选项\n' +
      '• 添加文献表单字段全面自定义：后台管理可自由开关各模块（DOI/作者/年份/期刊/单位/影响/标签/主要内容/创新点/状态）\n' +
      '• easyScholar 影响因子格式调整：IF=影响因子（替代 IF: 影响因子）\n' +
      '• 论文库表格宽度扩展：min-width 从 700px 增至 900px，容纳更多列信息'
    )
  }
  if (!versions.includes('3.1.106')) {
    settingsStore.addChangelog('3.1.106',
      '• 添加文献弹窗自动草稿恢复：意外关闭后再次打开可恢复已填写的内容\n' +
      '• 修复后台管理页面约3秒延迟问题：CSS column-count 改为 grid 布局，即点即开\n' +
      '• 论文库操作逻辑优化：单击行查看只读详情弹窗，双击行或点击编辑按钮进入编辑\n' +
      '• 新增 PDF 本地链接功能：表格操作列新增 <AppIcon name="file-text" />  图标，点击直接打开关联的 PDF 文件\n' +
      '• 论文 PDF 本地化存储：后台管理可配置 PDF 存放目录，上传 PDF 时自动保存到该目录\n' +
      '• PDF 文件持久化管理：后续所有 PDF 操作（打开/查看）均从本地存放目录读取'
    )
  }
  if (!versions.includes('3.1.107')) {
    settingsStore.addChangelog('3.1.107',
      '• 修复 PDF 文件名不一致问题：上传 PDF 时保留原始文件名，不再自动重命名\n' +
      '• 后台管理模块支持拖拽排序：每个模块左上角新增 ☰ 拖拽手柄，可自由调整模块位置\n' +
      '• 主题配色融合：莫兰迪色系与自定义颜色合并为统一色系选择器，新增清新亮色、深邃暗色、暖色系、冷色系、中性灰 5 个色系预设\n' +
      '• 色系切换标签页：点击切换不同色系，预设色卡和自定义颜色球联动显示当前选中色'
    )
  }
  if (!versions.includes('3.1.108')) {
    settingsStore.addChangelog('3.1.108',
      '• 后台管理模块拖拽升级：支持自由插入摆放（非替换式交换），拖动模块靠近其他模块时产生磁吸吸引效果\n' +
      '• 后台管理左侧新增模块导航栏：点击标题快速跳转到对应模块位置，当前模块高亮显示'
    )
  }
  if (!versions.includes('3.1.109')) {
    settingsStore.addChangelog('3.1.109',
      '• 后台管理模块布局改为 Masonry 瀑布流：高度不同的模块自动紧密贴合，彻底消除两列 Grid 造成的横向/纵向空白\n' +
      '• 拖拽排序后模块位置自动重新计算，始终保持紧凑排列'
    )
  }
  if (!versions.includes('3.1.110')) {
    settingsStore.addChangelog('3.1.110',
      '• PDF 打开方式自定义：后台管理新增三种打开方式（浏览器内置 / Edge 浏览器 / 自定义软件路径），论文库点击 <AppIcon name="file-text" />  按钮按配置打开 PDF\n' +
      '• DOI 自动识别增强：自动识别作者、单位（第一作者所属机构）、期刊名称并自动查询影响因子\n' +
      '• 论文摘要智能提炼：DOI 获取摘要后自动提取关键句，提炼结果填入「主要内容」字段'
    )
  }
  if (!versions.includes('3.1.111')) {
    settingsStore.addChangelog('3.1.111',
      '• PDF 打开方式中「自定义软件」改为文件选择器，可直接浏览选择 exe 文件\n' +
      '• 论文库表格宽度根据显示列自动适应，状态列文字始终横向显示不换行\n' +
      '• 论文库表格支持列宽拖拽调整：鼠标放在两列之间可左右拖动改变宽度\n' +
      '• 后台管理所有模块标题居中显示\n' +
      '• 文献库配置合并：表格列显示与添加文献表单字段合并为一个模块，支持自定义添加字段（如页数）\n' +
      '• 论文 PDF 存放位置合并到数据资产管理中心，本地文件列表新增「主要作用」列\n' +
      '• 论文库新增自动编号与排序功能：可按创建时间/字母/自定义排序，不影响 PDF 文件名\n' +
      '• 论文中心新增「论文笔记」子版块，支持 Markdown 格式笔记编辑\n' +
      '• 笔记编辑器含固定格式栏（加粗/斜体/标题等），意外关闭后自动恢复草稿'
    )
  }
  if (!versions.includes('3.1.112')) {
    settingsStore.addChangelog('3.1.112',
      '• 修复论文笔记「新建笔记」按钮点击无反应的问题（编辑器面板未正确显示）'
    )
  }
  if (!versions.includes('3.1.113')) {
    settingsStore.addChangelog('3.1.113',
      '• 新增内置 PDF 阅读器：点击论文 PDF 按钮在平台内直接阅读，支持缩放、页码跳转\\n' +
      '• PDF 阅读器支持批注功能：高亮、下划线、删除线、便签标记\\n' +
      '• PDF 阅读器支持划词翻译：选中英文文本自动弹出中文翻译\\n' +
      '• 批注数据自动保存，按文献独立存储，下次打开自动恢复\\n' +
      '• 修复：云端部署后首次打开 PDF 提示未配置文件夹的问题（PaperCenter 启动时主动恢复 IndexedDB 句柄）'
    )
  }
  if (!versions.includes('3.2.110')) {
    settingsStore.addChangelog('3.2.110',
      '• <AppIcon name="plus-circle" />  全新 WebDAV 云端备份功能：支持将全部数据（文献、笔记、任务、计划、组会纪要等）自动备份到 WebDAV 云存储\n' +
      '• 支持坚果云、Nextcloud、InfiniCLOUD 等主流 WebDAV 服务，配置后可一键手动备份或开启定时自动上传\n' +
      '• 支持从云端恢复：列出所有备份文件，选择恢复或删除任意版本\n' +
      '• 自动备份间隔可配置：5分钟到24小时，保存后自动生效'
    )
  }
  if (!versions.includes('3.2.113')) {
    settingsStore.addChangelog('3.2.113',
      '• <AppIcon name="plus-circle" />  计划中心全面改版：分为「总览」和「计划库」两大板块，UI 对齐论文中心设计\n' +
      '• 总览页新增任务状态占比饼图（已完成/进行中/已逾期）+ 6 项统计卡片（总任务、已完成、未完成、已逾期、今日需完成、本周新增），彩色数字醒目展示\n' +
      '• 计划库新增多条件搜索筛选：可按状态、分类、层级、优先级联合筛选，支持关键词搜索主题、描述和子任务\n' +
      '• 计划表格大幅扩展至 14 列：编号、状态、任务主题、接受任务时间（年月日时分）、任务结束时间、分类（学业/科研/行政/班级/其他）、层级、优先级、子任务1~6、操作\n' +
      '• 表格支持滚轮横向滚动，宽度最大化展示；添加/编辑计划表单同步扩展，支持编辑全部字段'
    )
  }
  if (!versions.includes('3.2.114')) {
    settingsStore.addChangelog('3.2.114',
      '• <AppIcon name="plus-circle" />  计划中心 Tab 栏改为居中胶囊样式，蓝色选中态白字高亮，视觉统一论文中心\n' +
      '• <AppIcon name="plus-circle" />  总览统计卡片改为两行三列布局，高度对齐左侧饼图卡片，空间利用率更高\n' +
      '• <AppIcon name="plus-circle" />  总览下方新增「近期任务」列表，展示前 6 条待完成计划（今日截止优先），点击跳转编辑\n' +
      '• <AppIcon name="plus-circle" />  计划库新增自动编号（固定序号不随增删变化）+ 多维排序（按接受时间/结束时间/分类/优先级 + 升/降序切换），排序控件置于筛选行最左侧\n' +
      '• <AppIcon name="plus-circle" />  计划库筛选行末显示当前计划总数（共 X 项）\n' +
      '• <AppIcon name="plus-circle" />  后台管理新增「计划/任务配置」模块：可自定义计划状态/分类/层级/优先级的名称和颜色，以及主页任务看板的分类和优先级，支持增删排序与一键恢复默认\n' +
      '• <AppIcon name="plus-circle" />  主页任务看板分类和优先级标签联动后台管理配置，不再硬编码\n' +
      '• 修复：升级后部分页面路由切换无响应的问题（keep-alive 缓存残留事件监听 + onDeactivated 兜底清理）'
    )
  }
  if (!versions.includes('3.2.120')) {
    settingsStore.addChangelog('3.2.120',
      '• <AppIcon name="plus-circle" />  计划中心「计划库」表格子任务支持颜色填充：单击子任务单元格弹出颜色选择弹窗，选中后该单元格背景填充所选颜色\n' +
      '• <AppIcon name="plus-circle" />  子任务填充色可在「设置 - 计划/任务配置 - 子任务填充色」中自定义（增删、改名、改色、恢复默认），并可临时选自定义颜色\n' +
      '• <AppIcon name="plus-circle" />  子任务单元格选中颜色后，文字自动适配深/浅背景色以保证可读性'
    )
  }
  if (!versions.includes('3.2.121')) {
    settingsStore.addChangelog('3.2.121',
      '• <AppIcon name="plus-circle" />  日历视图交互优化：单击任务仅弹出只读详情，需点击「编辑」按钮才能修改任务内容\n' +
      '• <AppIcon name="plus-circle" />  修复页面切换卡顿问题，并修复主页面「计划中心状态占比」环形图切换后消失的 BUG\n' +
      '• <AppIcon name="plus-circle" />  后台管理「计划/任务配置」7 大模块改为三行三列网格布局，缩短单板块长度\n' +
      '• <AppIcon name="plus-circle" />  后台管理「组会纪要自定义模板」与「论文库状态管理」改为左右并列排版\n' +
      '• <AppIcon name="plus-circle" />  后台管理「其他配置」色系由两行六列改为单行排列\n' +
      '• <AppIcon name="plus-circle" />  右上角头像下拉菜单新增「关于平台」入口，点击弹出关于窗口\n' +
      '• <AppIcon name="plus-circle" />  科研导航页面宽度增加，与论文中心保持一致'
    )
  }
  if (!versions.includes('3.2.122')) {
    settingsStore.addChangelog('3.2.122',
      '• <AppIcon name="plus-circle" />  科研导航页面宽度进一步加大\n' +
      '• <AppIcon name="plus-circle" />  关于平台弹窗新增平台 LOGO 与底部版权信息\n' +
      '• <AppIcon name="plus-circle" />  后台管理「其他配置」主题配色改为左右排版：左侧预设颜色（多行多列），右侧自定义颜色\n' +
      '• <AppIcon name="plus-circle" />  后台管理将「组会纪要自定义模板」「论文库状态管理」「导航栏排序」合并为「偏好设置」，左中右三栏展示\n' +
      '• <AppIcon name="plus-circle" />  版本更新记录中的 NEW 标签改为红色闪动特效\n' +
      '• <AppIcon name="bug" />  修复论文笔记中选中文字后点击文字颜色工具栏无反应的问题'
    )
  }
  if (!versions.includes('3.2.123')) {
    settingsStore.addChangelog('3.2.123',
      '• 科研导航页面宽度进一步加大，并与论文中心保持一致\n' +
      '• 科研导航中收藏的网址支持从一个分类拖拽到另一个分类\n' +
      '• 关于平台弹窗精简版本号文字，仅展示当前版本号\n' +
      '• 后台管理「偏好设置」中组会纪要自定义模板与论文库状态管理改为上下排版，避免输入文字被遮挡\n' +
      '• 后台管理将「平台版本号」从其他配置移入「偏好设置」，置于导航栏排序下方\n' +
      '• 后台管理「其他配置」重命名为「主题配色」，自定义颜色图形置于上方、参数置于下方\n' +
      '• 后台管理左侧模块导航栏随实际模块内容自动同步（含旧版模块迁移）\n' +
      '• 版本更新记录去除 NEW 标记，改为纯文本展示'
    )
  }
  if (!versions.includes('3.2.124')) {
    settingsStore.addChangelog('3.2.124',
      '• 计划库默认按照「接受任务时间」排序，后添加的条目自动排列在后面（升序）\n' +
      '• 版本号升至 3.2.124'
    )
  }
  if (!versions.includes('5.0.140')) {
    settingsStore.addChangelog('5.0.140',
      '• <AppIcon name="trash" />  删除导师应答模块：移除路由、页面、自定义场景与用量统计，导航栏不再显示\n' +
      '• <AppIcon name="refresh-cw" />  仿真数据模型重构：仿真对象顶层仅保留初始信息（编号、主题、状态、开始仿真、关联计划、备注），其他字段迁入新增的 records 数组，每条 record 包含软件版本、仿真细节、仿真时间、仿真结果、文件存放位置\n' +
      '• <AppIcon name="file-text" />  仿真详情弹窗重构：上部分显示仿真初始信息（只读），下部分改为「仿真记录」列表；右上角按钮改为「新增仿真记录」\n' +
      '• <AppIcon name="pencil" />  新增/编辑仿真记录：每条记录可独立增删改，包含 5 个字段\n' +
      '• <AppIcon name="refresh-cw" />  数据自动迁移：旧版仿真记录自动将原本的 detail/software/result/fileLocation 合并为第一条仿真记录\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.140'
    )
  }
  if (!versions.includes('5.0.146')) {
    settingsStore.addChangelog('5.0.146',
      '• <AppIcon name="image" />  修复上传头像提示「浏览器存储空间不足」的问题：头像上传后自动压缩至 256×256 JPEG 0.8，大幅降低 base64 体积，避免占满 localStorage\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.146'
    )
  }
  // 一次性补拍：5.0.151~5.0.159 版本播种块漏掉了 snapshotForRollback 调用，
  // 对已升级到这些版本但从未生成过快照的用户，在这里补拍一份当前数据快照（仅执行一次）
  if (!localStorage.getItem('mw_snapshotCatchup160') && versions.includes('5.0.159')) {
    settingsStore.snapshotForRollback('恢复快照机制（5.0.160 升级前自动补拍）')
    localStorage.setItem('mw_snapshotCatchup160', '1')
  }

  const changelog152 = settingsStore.changelog.find(e => e.version === '5.0.152')
  if (!versions.includes('5.0.152') || !changelog152 || !changelog152.content.includes('「截止时间」')) {
    settingsStore.addChangelog('5.0.152',
      '• <AppIcon name="calendar" />  子任务新增截止时间：点击计划库子任务单元格，在颜色选择器的「自定义」下方新增「截止时间」选择，支持年月日时分秒，用横线与下方「清除填充」隔开，结构清晰，选择后时间以淡色小字显示在单元格底部，格式 MM-DD HH:mm\n' +
      '• <AppIcon name="palette" />  单元格适配填充色：子任务单元格高度从 28px 增加到 44px，容纳任务名 + 时间；已填充背景色时，文字和时间自动根据背景亮度切换深/浅色，确保任意填充色下都能看清',
      '2026-08-12 21:08'
    )
  }
  if (!versions.includes('5.0.153') || !settingsStore.changelog.some(e => e.version === '5.0.153' && e.content.includes('保持窗口在最上面'))) {
    settingsStore.addChangelog('5.0.153',
      '• <AppIcon name="monitor" />  修复计划中心计划库子任务弹窗保持窗口在最上面，现在会出现被遮挡现象',
      '2026-08-12 21:16'
    )
  }
  if (!versions.includes('5.0.154')) {
    settingsStore.addChangelog('5.0.154',
      '• <AppIcon name="save" />  自动备份改为可开关：平台设置「自动备份」新增开关，默认开启，数据修改后 3 秒防抖自动写入 backups/ 目录\n' +
      '• <AppIcon name="palette" />  PWA 安装版窗口顶部标题栏颜色改为 #F0F8FF（AliceBlue），替换原深蓝色',
      '2026-08-13 15:45'
    )
  }
  if (!versions.includes('5.0.155')) {
    settingsStore.addChangelog('5.0.155',
      '• <AppIcon name="rocket" />  修复 PWA 安装版后台放置较久后切回前台，点击左侧导航没反应、约 1 分钟才跳转的问题\n' +
      '  · 专注/倒计时计时器改为时间补偿：后台冻结期间不再堆积 tick 与写盘任务，恢复前台按实际流逝时间一次性补计\n' +
      '  · 本地文件夹写入改为合并队列：同一数据高频写入只落盘一次并串行执行，避免写盘堆积卡住界面\n' +
      '  · 自动备份改在浏览器空闲时执行，不再抢占恢复瞬间的主线程\n' +
      '  · 主页面改为预加载，恢复前台无需等待网络请求',
      '2026-08-13 16:35'
    )
  }
  if (!versions.includes('5.0.156')) {
    settingsStore.addChangelog('5.0.156',
      '• <AppIcon name="palette" />  仿真中心仿真库状态自定义：状态名称与颜色均可自定义\n' +
      '  · 工具栏「+ 添加仿真」旁新增「状态设置」入口：可修改内置状态（已完成/仿真中/待开始/取消）的名称与颜色，也可新增自定义状态、删除自定义状态、一键恢复默认\n' +
      '  · 修改立即生效：总览统计卡片、状态分布图、仿真库表格、详情页与添加/编辑弹窗同步更新，不影响已有仿真的状态数据',
      '2026-08-14 15:35'
    )
  }
  if (!versions.includes('5.0.159')) {
    settingsStore.addChangelog('5.0.159',
      '• <AppIcon name="lock" />  登录安全增强：关闭浏览器窗口后必须重新登录\n' +
      '  · 登录时写入 sessionStorage 会话标记，关闭窗口/标签页后标记自动清除\n' +
      '  · 下次打开平台检测到标记丢失即强制下线，登录页显示「关闭窗口后需重新登录」提示\n' +
      '  · 刷新页面不受影响（sessionStorage 在刷新时保留），原有 24 小时强制下线机制不变\n' +
      '• <AppIcon name="book" />  平台文档同步更新：功能卡片新增消息中心、各模块描述补充新能力（论文滞留/阅读超时提醒、日历层级显示、仿真状态自定义）、登录安全章节补充窗口关闭重登说明、云端部署地址更新为当前 bj7 域名',
      '2026-08-14 19:10'
    )
  }
  if (!versions.includes('5.0.158')) {
    settingsStore.addChangelog('5.0.158',
      '• <AppIcon name="bell" />  消息中心计划任务提醒升级：按截止剩余天数自动着色\n' +
      '  · 距离截止 ≤3 天：消息卡片填充淡红色\n' +
      '  · 距离截止 ≤10 天：消息卡片填充淡橙色\n' +
      '• <AppIcon name="calendar" />  计划中心日历视图按计划层级展示时段：\n' +
      '  · 日计划：只在截止日期当天显示\n' +
      '  · 周计划：在截止日期所在的一周内显示\n' +
      '  · 月计划：在截止日期所在的一个月内显示（年计划以此类推）',
      '2026-08-14 19:00'
    )
  }
  // 兜底：确保老用户 localStorage 残留的旧版本号强制升至 5.0.159（load 默认值对已有键不生效）
  if (!versions.includes('5.0.160')) {
    // 升级前自动保存快照（恢复 5.0.151 起漏掉的快照机制）
    settingsStore.snapshotForRollback('升级至 5.0.160 前（自动快照）')
    settingsStore.addChangelog('5.0.160',
      '• <AppIcon name="refresh-cw" />  数据管理优化：合并「版本回滚」与「自动备份」为统一备份界面\n' +
      '  · 移除独立的版本回滚区块，快照与自动备份统一在「备份与回退」列表展示\n' +
      '  · 升级/导入前自动快照机制恢复正常（5.0.151~5.0.159 期间漏掉了快照调用，本次补拍并修复）\n' +
      '  · 快照在备份列表中以「<AppIcon name="package" />  升级/导入快照」标签区分，可一键恢复或删除',
      '2026-08-14 20:30'
    )
  }
  // 兜底：确保老用户 localStorage 拋留的旧版本号强制升至 5.0.160（load 默认值对已有键不生效）
  settingsStore.ensureAppVersion('5.0.160')
  if (!versions.includes('5.0.161')) {
    settingsStore.snapshotForRollback('升级至 5.0.161 前（自动快照）')
    settingsStore.addChangelog('5.0.161',
      '• <AppIcon name="home" />  主页全新改版：\n' +
      '  · 顶部「学业进度总览」宽度自适应，保持原有格式\n' +
      '  · 新增四列概览卡片：论文概览、最近仿真、最近论文、最近组会\n' +
      '  · 底部左侧保留「最近计划」周日历网格，右侧为「计划完成情况」环形占比图\n' +
      '  · 各卡片点击可快速跳转对应模块',
      '2026-08-14 21:30'
    )
  }
  if (!versions.includes('5.0.162')) {
    settingsStore.snapshotForRollback('升级至 5.0.162 前（自动快照）')
    settingsStore.addChangelog('5.0.162',
      '• <AppIcon name="bug" />  修复 PWA 登录界面无限刷新问题：\n' +
      '  · 根因：reconcileWithFileStorage 将文件中旧的 auth 字段拉回缓存，触发 reload 死循环\n' +
      '  · 修复：auth 相关键不参与文件合并；PWA standalone 模式跳过 sessionStorage 检查；新增 reload 防护计数器',
      '2026-08-15 18:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.162')
  if (!versions.includes('5.0.163')) {
    settingsStore.snapshotForRollback('升级至 5.0.163 前（自动快照）')
    settingsStore.addChangelog('5.0.163',
      '• <AppIcon name="palette" />  仿真中心总览数字字体改为 Arial',
      '2026-08-15 20:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.163')
  if (!versions.includes('5.0.164')) {
    settingsStore.snapshotForRollback('升级至 5.0.164 前（自动快照）')
    settingsStore.addChangelog('5.0.164',
      '• <AppIcon name="pin" />  计划中心新增「每日打卡」模块（位于总览与计划库之间）：\n' +
      '  · 每日底线任务：可从计划库关联计划，也可添加临时任务；全部完成即底线达成\n' +
      '  · 每日总结：今日进展、遇到的问题、明日计划\n' +
      '  · 每周总结：本周七天达成情况、达成率、最长连续天数、完成底线任务数\n' +
      '  · 历史记录：底部浮起卡片，可切换日总结/周总结\n' +
      '  · 顶部 Tab 切换改为胶囊型紫色高亮，任务列表行样式与近期任务列表保持一致\n' +
      '• <AppIcon name="bell" />  消息中心新增每日底线任务提醒（22:00 后未完成的底线任务）和每周总结提醒（周日 20:00 后未填写）\n' +
      '• <AppIcon name="bar-chart" />  计划中心总览新增「连续打卡」和「本周达成率」统计卡片',
      '2026-08-16 10:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.164')
  if (!versions.includes('5.0.165')) {
    settingsStore.snapshotForRollback('升级至 5.0.165 前（自动快照）')
    // v5.0.165：清除 localStorage 中残留的旧版本回滚快照，释放浏览器存储空间
    // 升级/导入前的数据保护已由本地文件夹 snapshot_*.json 接管，代码版本回退由 GitHub tag 管理
    try {
      localStorage.removeItem('mw_rollbackHistory')
      settingsStore.rollbackHistory = []
    } catch (_) {}
    settingsStore.addChangelog('5.0.165',
      '• <AppIcon name="sparkles" />  移除「升级/导入快照（浏览器缓存）」功能：\n' +
      '  · 升级/导入前仍自动写快照到本地文件夹（snapshot_*.json，保留 10 份）\n' +
      '  · 代码版本回退由 GitHub tag 管理（git checkout v5.0.16X → 重新构建部署）\n' +
      '  · 清除 localStorage 中残留的旧快照数据，释放浏览器存储空间\n' +
      '• <AppIcon name="pin" />  每日打卡底线任务优化：关联计划时主题可自由输入，列表行以底色标签显示关联计划名\n' +
      '• <AppIcon name="monitor" />  底线任务新增详情弹窗（点击任务行打开，可查看描述/关联计划信息/直接切换完成状态）',
      '2026-08-16 14:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.166')
  if (!versions.includes('5.0.166')) {
    settingsStore.addChangelog('5.0.166',
      '• <AppIcon name="bar-chart" />  论文库表格优化：\n' +
      '  · 论文题目列宽度调整（16字标题+左右各3字余量）\n' +
      '  · 影响列改为徽章显示（IF/JCR/中科院分区），中科院大类名称自动缩写\n' +
      '  · 操作列仅保留编辑和删除\n' +
      '  · 标签支持自定义颜色（点击标签前圆点切换10种预设色）',
      '2026-08-16 15:30'
    )
  }
  if (!versions.includes('5.0.167')) {
    settingsStore.addChangelog('5.0.167',
      '• <AppIcon name="bar-chart" />  论文库优化：\n' +
      '  · 「论文库配置」入口移至表格右上角「添加文献」左侧\n' +
      '  · 新增标签颜色管理：配置弹窗中通过颜色选择器自定义标签颜色\n' +
      '  · 论文题目列最大宽度 16 个字符，超出部分隐藏显示省略号\n' +
      '  · 点击文献行打开详情弹窗（右上角编辑按钮）',
      '2026-08-16 19:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.167')
  if (!versions.includes('5.0.168')) {
    settingsStore.addChangelog('5.0.168',
      '• <AppIcon name="bar-chart" />  论文库题目列宽度改为与「基于制动特性的路面附着状态识别研究」等宽，超出隐藏\n' +
      '• <AppIcon name="mouse" />  修复论文库表格行单击无法打开详情弹窗的问题\n' +
      '• <AppIcon name="palette" />  论文库右上角按钮重绘为图标+文字风格（论文库配置 / 导出 / 添加文献）\n' +
      '• <AppIcon name="pencil" />  文献详情弹窗右上角编辑按钮改为紫色描边+图标+文字风格，关闭按钮改为灰色圆角X',
      '2026-08-16 20:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.168')
  if (!versions.includes('5.0.169')) {
    settingsStore.addChangelog('5.0.169',
      '• <AppIcon name="bar-chart" />  论文库影响列新增中文期刊级别显示：CSSCI / 北大核心 / CSCD',
      '2026-08-16 17:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.169')
  if (!versions.includes('5.0.170')) {
    settingsStore.addChangelog('5.0.170',
      '• <AppIcon name="palette" />  论文库配置弹窗改为 2×2 网格布局：状态管理、表单字段、表格列显示、标签颜色四模块并列展示\n' +
      '• <AppIcon name="image" />  论文库配置四个模块标题图标重绘为简笔画线条风格',
      '2026-08-16 18:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.171')
  if (!versions.includes('5.0.171')) {
    settingsStore.addChangelog('5.0.171',
      '• <AppIcon name="palette" />  仿真库头部 UI 重绘：列设置与状态设置合并为「仿真库配置」，新增「导出」按钮，统一为白色圆角底图标按钮 + 紫色主按钮风格\n' +
      '• <AppIcon name="palette" />  计划库头部新增「计划/任务配置」与「导出」按钮，配置入口从添加计划弹窗移出到表格 header',
      '2026-08-16 20:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.172')
  if (!versions.includes('5.0.172')) {
    settingsStore.addChangelog('5.0.172',
      '• <AppIcon name="palette" />  计划/任务配置弹窗图标重绘为简笔画线条风格（日历页 / 待办清单），移除重复提示文字\n' +
      '• <AppIcon name="calendar" />  日历月视图重新设计：日期数字加大加粗，增加星期简写副标签，计划条改为通栏圆角色块，浅色主题',
      '2026-08-16 20:20'
    )
  }
  settingsStore.ensureAppVersion('5.0.175')
  if (!versions.includes('5.0.175')) {
    settingsStore.addChangelog('5.0.175',
      '• <AppIcon name="palette" />  每日打卡顶部「计划底线库」模块增加独立白色卡片底层，与下方内容分隔',
      '2026-08-16 22:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.182')
  if (!versions.includes('5.0.182')) {
    settingsStore.addChangelog('5.0.182',
      '• <AppIcon name="calendar" />  每日打卡三个添加弹窗（底线任务/今日总结/本周总结）右上角保存左侧新增日期/周选择器，可补录往日或提前安排；底线任务添加仅新增模式可选日期\n' +
      '• <AppIcon name="link" />  今日总结「明日计划」保存后，自动按行生成次日「今日底线任务」，并在任务行标注「来自昨日明日计划」；重复保存不累积',
      '2026-08-18 09:10'
    )
  }
  settingsStore.ensureAppVersion('5.0.183')
  if (!versions.includes('5.0.183')) {
    settingsStore.addChangelog('5.0.183',
      '• <AppIcon name="palette" />  全平台图标统一为 Lucide SVG 图标库，移除全部装饰性 Emoji；导航、消息中心、日期选择器箭头与刷新、站点与积分商店等图标统一尺寸、线宽与 currentColor 配色；全局注册 AppIcon 组件\n' +
      '• <AppIcon name="smartphone" />  各业务视图改为响应式布局：桌面多列、平板减列、手机单列，文字/图片/操作区完整显示不溢出',
      '2026-08-18 10:50'
    )
  }
  settingsStore.ensureAppVersion('5.0.184')
  if (!versions.includes('5.0.184')) {
    settingsStore.addChangelog('5.0.184',
      '• <AppIcon name="sparkles" />  欢迎页面逻辑优化：未登录时不显示，当天首次登录成功后才弹出欢迎\n' +
      '• <AppIcon name="scroll-text" />  每次版本更新后消息中心自动推送更新提醒，附带跳转更新日志按钮',
      '2026-08-18 14:15'
    )
  }
  settingsStore.ensureAppVersion('5.0.187')
  if (!versions.includes('5.0.187')) {
    settingsStore.addChangelog('5.0.187',
      '• <AppIcon name="shield-check" />  修复推送版本号错误问题：更新推送强制只显示最新版本（如 5.0.187），历史残留的旧版本推送（3.0 等）启动时自动清理，渲染层二次过滤确保永不显示旧版本更新消息\n' +
      '• <AppIcon name="bell-ring" />  推送前校验最新版本 + 消息去重：重复/低版本推送源头丢弃，消息中心不再出现多条版本号不一致的更新推送',
      '2026-08-18 17:25'
    )
  }
  settingsStore.ensureAppVersion('5.0.281')
  if (!versions.includes('5.0.281')) {
    settingsStore.addChangelog('5.0.281',
      '• <AppIcon name="layout-grid" />  信息预览页全面改版：顶部改为「学业进度总览（缩窄）+ 论文概览 + 计划完成情况」三列布局，第二行改为「最近仿真 / 最近论文 / 最近组会」一行三列；内容过长自动省略但状态/日期等关键信息始终可见，点击卡片或列表项即可跳转对应页面\n' +
      '• <AppIcon name="mouse" />  计划完成情况圆环升级交互：单击彩色色块弹出该状态全部任务详情（标题/数量/占比/截止时间），双击圆环直达计划中心「计划列表」；圆环下方不再显示图例文字\n' +
      '• <AppIcon name="pencil" />  学业进度总览编辑按钮图标重绘为便签+铅笔线性风格，编辑功能保持不变\n' +
      '• <AppIcon name="eraser" />  移除信息预览页「最近计划」周历模块\n' +
      '• <AppIcon name="tag" />  全局名称调整：仿真库→仿真列表、论文阅读库→论文阅读列表、论文库→论文列表、计划库→计划列表（含二级导航、模块标题、配置弹窗与导出文件名）\n' +
      '• <AppIcon name="users" />  修复信息预览页「最近组会」参与人员显示乱码（显示 JSON 原文）的问题：参与人员现统一显示为彩色标签对应的人名列表，兼容新旧数据格式\n' +
      '• <AppIcon name="wrench" />  修复科研中心组会纪要中旧版手动输入参与人员的记录无法编辑的问题：编辑时自动兼容旧字符串格式，历史人员可正常回显、取消与保存',
      '2026-09-01 14:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.280')
  if (!versions.includes('5.0.280')) {
    settingsStore.addChangelog('5.0.280',
      '• <AppIcon name="bell-ring" />  计划库消息中心提醒全配置化：计划/任务配置弹窗新增「消息中心提醒设置」区块，可自定义提前提醒天数（默认 8 天）、4 档提醒颜色（临近/紧急/逾期/严重逾期）、参与提醒的计划状态（多选，默认排除已完成/放弃），逾期任务每天持续提醒直到状态变更为已完成\n' +
      '• <AppIcon name="wrench" />  修复顶部状态栏周数偶尔显示 null 的问题：增强日期解析防御逻辑',
      '2026-09-01 10:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.279')
  if (!versions.includes('5.0.279')) {
    settingsStore.addChangelog('5.0.279',
      '• <AppIcon name="users" />  组会纪要参与人员分组管理：支持将人员按分组管理（增删改排序分组、人员归组），记录纪要时按分组多选参与人员\n' +
      '• <AppIcon name="palette" />  参与人员颜色优化：模板配置中颜色改为圆点展示，点击圆点弹窗可选系统颜色或自定义颜色',
      '2026-08-31 16:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.278')
  if (!versions.includes('5.0.278')) {
    settingsStore.addChangelog('5.0.278',
      '• <AppIcon name="users" />  组会纪要参与人员标签化：支持在模板配置中自定义常参与人员（增删改排序+颜色），记录纪要时多选参与人员，每个人不同底色标签展示\n' +
      '• <AppIcon name="shield-check" />  彻底修复版本号显示不同步：根因是 changelog 播种后第 4017 行将 appVersion 覆盖为 changelog[0].version，但 getVersion() 同步的版本号被覆盖；改为桌面端不再从 changelog 取版本号，仅用 Tauri getVersion() 真实版本号\n' +
      '• <AppIcon name="refresh-cw" />  计划库子任务下拉菜单时间自动清空：打开面板时截止时间输入框自动置空，改为 :value + @input 显式绑定避免 v-model 冲突',
      '2026-08-31 14:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.276')
  if (!versions.includes('5.0.276')) {
    settingsStore.addChangelog('5.0.276',
      '• <AppIcon name="shield-check" />  修复版本号显示不同步：桌面端启动时第一时间用 Tauri getVersion() 获取真实安装版本号并同步到 localStorage，侧边栏与检查更新统一使用真实版本号\n' +
      '• <AppIcon name="refresh-cw" />  计划库子任务下拉菜单时间自动清空：每次打开子任务选择面板时截止时间输入框自动置空，便于快速选择新的状态和时间',
      '2026-08-31 10:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.275')
  if (!versions.includes('5.0.275')) {
    settingsStore.addChangelog('5.0.275',
      '• <AppIcon name="bell-ring" />  计划到期提醒改为每次登录都检查：移除每日只提醒一次的拦截，同一天同一任务通过 msgId 含日期去重确保只发一条消息；≤3天临期+≤3天逾期范围内每天登录都会提醒',
      '2026-08-31 01:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.274')
  if (!versions.includes('5.0.274')) {
    settingsStore.addChangelog('5.0.274',
      '• <AppIcon name="wrench" />  彻底修复 GlassSelect 尺寸异常：根因是全局 .input 样式污染了根 div（双重 padding/border），改为将 selectClass 拆分为布局类（filter-select/filter-select-col 绑根 div）和外观类（input/batch-input 等绑 trigger）\n' +
      '• <AppIcon name="layers" />  修复状态弹窗毛玻璃失效：弹窗 Teleport 到 body 后脱离 .app-container DOM 树，新增 body.module-frosted .status-popup 规则\n' +
      '• <AppIcon name="shield-check" />  修复检查更新无法检测到新版本：GitHub API 将安装包文件名中空格替换为点（MasterWorkbench.5_），Rust extract_version 新增该前缀匹配；Release 查询数量从 30 提升到 100',
      '2026-08-31 00:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.273')
  if (!versions.includes('5.0.273')) {
    settingsStore.addChangelog('5.0.273',
      '• <AppIcon name="wrench" />  修复 GlassSelect 自定义下拉组件尺寸异常：移除根元素强制 width:100%，添加非 scoped 全局样式块响应 filter-select/filter-select-col/wt-btn-select/note-meta-select/status-select/batch-input 等外部 class 的宽度与 padding 规则\n' +
      '• <AppIcon name="eye" />  修复论文库状态弹窗定位错乱：弹窗改用 Teleport 渲染到 body 避免被表格 overflow-x:auto 裁剪，表格滚动时自动关闭弹窗',
      '2026-08-30 23:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.272')
  if (!versions.includes('5.0.272')) {
    settingsStore.addChangelog('5.0.272',
      '• <AppIcon name="layers" />  全平台原生下拉菜单替换为自定义组件：论文管理/计划中心/仿真中心/财务中心/论文阅读/导航/日历/研究等模块共 64 处原生 select 全部替换为自定义 GlassSelect 组件，下拉面板完美适配毛玻璃效果\n' +
      '• <AppIcon name="shield-check" />  修复检查更新失效：改用 Tauri getVersion() 获取真实安装版本号，不再依赖 localStorage 中可能被提前更新的 appVersion',
      '2026-08-30 22:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.271')
  if (!versions.includes('5.0.271')) {
    settingsStore.addChangelog('5.0.271',
      '• <AppIcon name="layers" />  全平台自定义弹出层毛玻璃适配：论文中心状态弹窗/导出菜单、仿真中心导出菜单/评价浮层、计划中心导出菜单/状态浮层/单元格选择器、财务中心导出菜单\n' +
      '• <AppIcon name="wrench" />  修复论文库列表状态下拉菜单错位：添加视口边界裁剪，弹窗不再超出屏幕',
      '2026-08-30 21:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.270')
  if (!versions.includes('5.0.270')) {
    settingsStore.addChangelog('5.0.270',
      '• <AppIcon name="shield-check" />  修复检查更新功能失效：Rust 后端内置 GitHub 令牌已过期（401 未经授权），替换为当前有效令牌\n' +
      '• <AppIcon name="layers" />  恢复顶部状态栏三种效果设置（不透明/毛玻璃/融合态）及状态栏透明度独立调节\n' +
      '• <AppIcon name="eye" />  补充财务中心颜色选择器、设置页渐变选择器、论文富文本下拉框毛玻璃适配',
      '2026-08-30 19:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.269')
  if (!versions.includes('5.0.269')) {
    settingsStore.addChangelog('5.0.269',
      '• <AppIcon name="layers" />  设置页 UI 重构：毛玻璃相关设置整合为统一开关（不透明/毛玻璃两种），透明度滑块统一控制导航栏、二级导航栏、状态栏、模块内容区\n' +
      '• <AppIcon name="layout" />  导航栏样式选择器改为一行三列布局，预览图缩小更紧凑\n' +
      '• <AppIcon name="tag" />  版本号与 GitHub 更新令牌独立为新卡片模块，移至左列 easyScholar 下方',
      '2026-08-30 17:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.268')
  if (!versions.includes('5.0.268')) {
    settingsStore.addChangelog('5.0.268',
      '• <AppIcon name="key" />  修复 GitHub 更新令牌每次重启后丢失的 BUG：保存一次后持久生效，无需重复输入',
      '2026-08-30 14:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.267')
  if (!versions.includes('5.0.267')) {
    settingsStore.addChangelog('5.0.267',
      '• <AppIcon name="layers" />  全平台下拉菜单/弹出层全面适配毛玻璃效果：颜色预设选择器、公式输入面板、PDF阅读器浮层、图片预览框、日历详情遮罩、财务批量编辑区等\n' +
      '• <AppIcon name="settings" />  全局原生 select 下拉框毛玻璃适配提升为全局，覆盖所有页面\n' +
      '• <AppIcon name="eye" />  各类弹窗遮罩层在毛玻璃模式下统一淡化',
      '2026-08-30 12:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.266')
  if (!versions.includes('5.0.266')) {
    settingsStore.addChangelog('5.0.266',
      '• <AppIcon name="bell-ring" />  消息中心计划到期提醒4级颜色分级：≤3天淡红、≤8天淡橙、逾期≥3天淡紫、逾期≥7天深红，状态变更为已完成/放弃后停止检测\n' +
      '• <AppIcon name="layers" />  计划库状态/分类/层级/优先级下拉菜单支持毛玻璃效果，透明度跟随设置联动；修复 Teleport 弹层毛玻璃选择器不生效问题',
      '2026-08-30 10:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.265')
  if (!versions.includes('5.0.265')) {
    settingsStore.addChangelog('5.0.265',
      '• <AppIcon name="book" />  平台文档全部 14 章重写：技术栈补充 Tauri 2 桌面端框架描述，修正目录结构、行数、数据存储、构建部署、运行环境等过时内容，致谢新增 Tauri/SheetJS/KaTeX/lucide 等依赖',
      '2026-08-28 20:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.264')
  if (!versions.includes('5.0.264')) {
    settingsStore.addChangelog('5.0.264',
      '• <AppIcon name="plus-circle" />  每日打卡设置与计划/任务配置「+ 添加」改为弹窗内行内追加：无需浏览器弹窗，新增后直接编辑名称/颜色/数值，修改即时生效\n' +
      '• <AppIcon name="align-left" />  所有今日总结弹窗与总览最近打卡排版优化：标题加粗单独一行，内容完整换行展示\n' +
      '• <AppIcon name="settings" />  「恢复默认」按钮统一为浅色圆角样式，适配平台整体风格',
      '2026-08-28 19:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.263')
  if (!versions.includes('5.0.263')) {
    settingsStore.addChangelog('5.0.263',
      '• <AppIcon name="settings" />  每日打卡新增「每日打卡设置」按钮：可自定义底线任务打卡状态名称、颜色、排序\n' +
      '• <AppIcon name="file-text" />  每日打卡新增「查看所有今日总结」按钮：弹窗展示全部历史总结\n' +
      '• <AppIcon name="layout" />  总览页面布局改造：左半侧近期任务、右半侧最近打卡（今日总结）',
      '2026-08-28 18:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.262')
  if (!versions.includes('5.0.262')) {
    settingsStore.addChangelog('5.0.262',
      '• <AppIcon name="folder-edit" />  仿真结果图片存放位置支持自定义：可点击「自定义」按钮选择任意文件夹，也可「恢复默认」回到系统数据目录',
      '2026-08-28 17:10'
    )
  }
  settingsStore.ensureAppVersion('5.0.261')
  if (!versions.includes('5.0.261')) {
    settingsStore.addChangelog('5.0.261',
      '• <AppIcon name="image" />  仿真库新增仿真记录支持上传结果图片：可多选、大小不限\n' +
      '• <AppIcon name="folder" />  桌面端图片自动落盘到本地数据目录「仿真结果」文件夹，浏览器端存 IndexedDB，不占 localStorage\n' +
      '• <AppIcon name="zoom-in" />  仿真详情中结果图片可点击放大预览，支持删除记录/仿真时同步清理图片文件',
      '2026-08-28 16:50'
    )
  }
  settingsStore.ensureAppVersion('5.0.260')
  if (!versions.includes('5.0.260')) {
    settingsStore.addChangelog('5.0.260',
      '• <AppIcon name="shield-check" />  修复版本号显示错误与更新日志缺失：新增 5.0.257-5.0.259 更新记录，老用户升级后版本号正确更新\n' +
      '• <AppIcon name="image" />  登录页面适配毛玻璃透明效果：支持显示自定义背景图片，登录卡片半透明毛玻璃样式',
      '2026-08-28 09:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.259')
  if (!versions.includes('5.0.259')) {
    settingsStore.addChangelog('5.0.259',
      '• <AppIcon name="layout-dashboard" />  修复融合态导航模式下顶部状态栏左侧不显示 Logo、牛马科技、版本号的问题（品牌区扩展至融合态模式显示）',
      '2026-08-27 21:40'
    )
  }
  settingsStore.ensureAppVersion('5.0.258')
  if (!versions.includes('5.0.258')) {
    settingsStore.addChangelog('5.0.258',
      '• <AppIcon name="wrench" />  彻底修复融合态和悬浮岛式导航下论文中心、计划中心页面内容不显示的问题\n' +
      '• <AppIcon name="database" />  修复 stores 编码损坏导致的多处 state 属性丢失：论文阅读列设置、标签颜色、每日打卡、登录超时标记、组会纪要字段、版本回滚快照',
      '2026-08-27 21:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.257')
  if (!versions.includes('5.0.257')) {
    settingsStore.addChangelog('5.0.257',
      '• <AppIcon name="bug" />  修复融合态和悬浮岛式导航下部分页面内容不显示的问题（activeTab 改用 ref + watch 同步 store）',
      '2026-08-27 18:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.256')
  if (!versions.includes('5.0.256')) {
    settingsStore.addChangelog('5.0.256',
      '• <AppIcon name="layout-dashboard" />  导航栏样式新增「融合态」：一级导航与二级导航融为一体，水平居中显示在原二级导航栏位置，取消左侧竖排侧栏\n' +
      '• <AppIcon name="home" />  点击一级导航项进入二级导航条，最左侧「主页」按钮可返回一级导航；无二级导航的页面保持一级条显示\n' +
      '• <AppIcon name="bookmark" />  二级导航 Tab 选择自动记忆，再次进入该页面时恢复上次选中的 Tab',
      '2026-08-27 17:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.255')
  if (!versions.includes('5.0.255')) {
    settingsStore.addChangelog('5.0.255',
      '• <AppIcon name="check-square" />  底线任务状态交互优化：移除任务右侧状态下拉框，改为点击左侧状态标签弹出三态菜单（已完成/未完成/放弃，各带填充底色，文字居中）\n' +
      '• <AppIcon name="layers" />  状态菜单浮层适配毛玻璃透明度联动',
      '2026-08-27 16:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.254')
  if (!versions.includes('5.0.254')) {
    settingsStore.addChangelog('5.0.254',
      '• <AppIcon name="layout-dashboard" />  信息预览页面适配毛玻璃透明效果：学业进度/论文概览/最近仿真/最近论文/最近组会/最近计划/完成情况等卡片全部跟随透明度滑杆联动\n' +
      '• <AppIcon name="check-square" />  底线任务状态从两按钮改为三态下拉菜单：未完成（橙）/完成（绿）/放弃（红），放弃不再阻碍底线达成',
      '2026-08-27 14:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.253')
  if (!versions.includes('5.0.253')) {
    settingsStore.addChangelog('5.0.253',
      '• <AppIcon name="layers" />  全平台弹窗/浮层统一毛玻璃透明度：仿真中心/科研导航/顶部状态栏/论文中心/订阅中心/计划中心等弹窗全部跟随透明度滑杆联动\n' +
      '• <AppIcon name="layout" />  计划底线库操作排去除底色，直接显示在主页面模块上，仅保留微显边框',
      '2026-08-27 11:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.252')
  if (!versions.includes('5.0.252')) {
    settingsStore.addChangelog('5.0.252',
      '• <AppIcon name="wrench" />  修复所有弹窗半透明后整体发灰的问题，毛玻璃模式下弹窗透出真实背景图',
      '2026-08-27 11:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.251')
  if (!versions.includes('5.0.251')) {
    settingsStore.addChangelog('5.0.251',
      '• <AppIcon name="wrench" />  修复消息中心弹窗半透明后透出黑色遮罩导致发灰的问题\n' +
      '• <AppIcon name="layers" />  计划底线库模块透明度统一跟随模块透明度滑杆联动',
      '2026-08-27 10:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.250')
  if (!versions.includes('5.0.250')) {
    settingsStore.addChangelog('5.0.250',
      '• <AppIcon name="wrench" />  修复消息中心弹窗整体背景仍为不透明白底的问题，毛玻璃模式下弹窗本体也跟随透明度滑杆联动',
      '2026-08-27 10:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.249')
  if (!versions.includes('5.0.249')) {
    settingsStore.addChangelog('5.0.249',
      '• <AppIcon name="wrench" />  修复消息中心毛玻璃透明度不生效的问题',
      '2026-08-27 09:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.248')
  if (!versions.includes('5.0.248')) {
    settingsStore.addChangelog('5.0.248',
      '• <AppIcon name="bell-ring" />  消息中心卡片透明度与保存栏一致的毛玻璃效果\n' +
      '• <AppIcon name="layout" />  计划底线库操作排更透明，与主页面相近但不融合',
      '2026-08-27 09:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.247')
  if (!versions.includes('5.0.247')) {
    settingsStore.addChangelog('5.0.247',
      '• <AppIcon name="wrench" />  修复顶部状态栏三种效果切换后实际都返回不透明的问题',
      '2026-08-26 22:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.246')
  if (!versions.includes('5.0.246')) {
    settingsStore.addChangelog('5.0.246',
      '• <AppIcon name="wrench" />  修复顶部状态栏效果切换后保存无响应的问题',
      '2026-08-26 22:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.245')
  if (!versions.includes('5.0.245')) {
    settingsStore.addChangelog('5.0.245',
      '• <AppIcon name="layout-top" />  顶部状态栏效果改为三态切换：不透明、毛玻璃（可调透明度+渐变融合带加宽）、融合态（去掉底色直接悬浮在背景图上）',
      '2026-08-26 21:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.244')
  if (!versions.includes('5.0.244')) {
    settingsStore.addChangelog('5.0.244',
      '• <AppIcon name="layout-top" />  顶部状态栏新增毛玻璃开关：平台设置新增「顶部状态栏效果」，毛玻璃模式下背景图延伸至状态栏区域，底部与内容区自然渐变融合\n' +
      '• <AppIcon name="bell-ring" />  消息中心卡片透明度降低，更透出背景图',
      '2026-08-26 21:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.243')
  if (!versions.includes('5.0.243')) {
    settingsStore.addChangelog('5.0.243',
      '• <AppIcon name="check-circle" />  计划库添加计划时子任务自动标记"待处理"状态\n' +
      '• <AppIcon name="layers" />  登录界面适配毛玻璃效果\n' +
      '• <AppIcon name="bell-ring" />  消息中心毛玻璃完善：未读+类型组合态、hover 态全部半透明',
      '2026-08-26 20:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.242')
  if (!versions.includes('5.0.242')) {
    settingsStore.addChangelog('5.0.242',
      '• <AppIcon name="layers" />  计划中心每日打卡「计划底线库」顶部操作排适配毛玻璃效果，不再纯白填充\n' +
      '• <AppIcon name="layout" />  每日打卡各版块边界清晰化：底线任务/今日总结/本周总结改为半透明白底+可见边框\n' +
      '• <AppIcon name="settings" />  平台设置三大模块适配毛玻璃效果，与全局风格统一',
      '2026-08-26 19:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.241')
  if (!versions.includes('5.0.241')) {
    settingsStore.addChangelog('5.0.241',
      '• <AppIcon name="layout" />  统一窗口设计规范：减小模块内容上方空白，整体内容上移，所有二级导航栏所属窗口统一\n' +
      '• <AppIcon name="database" />  仿真库列表增加标题栏：「仿真库」标题 + 设置/导出/添加按钮同一行，布局与计划库/论文阅读库一致\n' +
      '• <AppIcon name="wrench" />  修复更新流程：安装过程中旧窗口不再重新打开，改用 start /WAIT 等待安装完成',
      '2026-08-26 18:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.240')
  if (!versions.includes('5.0.240')) {
    settingsStore.addChangelog('5.0.240',
      '• <AppIcon name="layers" />  全面毛玻璃适配：消息中心、科研中心（论文卡片/组会纪要/节点圆点）、仿真中心（弹窗/评价浮层/详情内层）、论文中心（状态弹窗/标签/符号/公式弹窗及输入区）、订阅中心弹窗、计划中心日历详情、财务中心类型切换、导出下拉统一半透明毛玻璃效果\n' +
      '• <AppIcon name="wrench" />  内层卡片同步半透明化，避免卡片套卡片；弹窗透明度固定较高，保持内容可读、边界清晰\n' +
      '• <AppIcon name="calendar" />  顶部状态栏「自定义日期与周数」改名为「日期与周数」',
      '2026-08-26 17:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.239')
  if (!versions.includes('5.0.239')) {
    settingsStore.addChangelog('5.0.239',
      '• <AppIcon name="wrench" />  修复弹窗变灰：弹窗透明度与内容区解耦，不再受「模块内容透明度」影响，避免透出遮罩发暗\n' +
      '• <AppIcon name="layers" />  顶部状态栏组件适配毛玻璃：日期弹窗、头像下拉、关于平台、平台文档、个人信息统一半透明效果',
      '2026-08-26 15:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.238')
  if (!versions.includes('5.0.238')) {
    settingsStore.addChangelog('5.0.238',
      '• <AppIcon name="wrench" />  修复计划库单元格弹窗错位：状态/分类/优先级下拉菜单不在对应位置，改用 Teleport 修复\n' +
      '• <AppIcon name="wrench" />  修复订阅中心添加订阅弹窗位置偏移：被二级导航栏遮挡，改用 Teleport + position:relative 修复\n' +
      '• <AppIcon name="layout" />  日历视图适配透明UI：9 处硬编码白色改为透明/半透明\n' +
      '• <AppIcon name="sliders" />  新增主页面「毛玻璃/不透明」效果切换开关，不透明模式恢复纯白底色\n' +
      '• <AppIcon name="layers" />  弹窗适配：毛玻璃模式下弹窗也呈现半透明效果',
      '2026-08-26 14:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.237')
  if (!versions.includes('5.0.237')) {
    settingsStore.addChangelog('5.0.237',
      '• <AppIcon name="layout" />  全部模块内容区改为悬浮独立模块：圆角+毛玻璃+阴影，与二级导航栏风格一致\n' +
      '• <AppIcon name="sliders" />  平台设置新增「模块内容透明度」滑杆（默认 88%），可透出背景图\n' +
      '• <AppIcon name="layers" />  内部卡片透明化避免「卡片套卡片」，由内容区统一承载悬浮外观',
      '2026-08-26 11:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.236')
  if (!versions.includes('5.0.236')) {
    settingsStore.addChangelog('5.0.236',
      '• <AppIcon name="layout" />  压缩二级导航栏整体高度：上下留白由 14px 减至 9px（约减 1/3），更紧凑\n' +
      '• <AppIcon name="move" />  二级导航栏更贴近顶部状态栏：上方留白减半，悬浮模块与状态栏间距更近',
      '2026-08-26 10:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.235')
  if (!versions.includes('5.0.235')) {
    settingsStore.addChangelog('5.0.235',
      '• <AppIcon name="layout" />  二级导航栏悬浮独立模块样式修复：改用独立非 scoped 样式块，毛玻璃+圆角+阴影在所有页面真正生效\n' +
      '• <AppIcon name="pin" />  二级导航栏吸顶固定：页面滚动时 Tab 栏固定在视口顶部下方，始终可见\n' +
      '• <AppIcon name="move" />  顶部状态栏拖拽修复：新增 core:window:allow-start-dragging 权限 + 前端 startDragging 兜底，窗口缩小后仍可拖动',
      '2026-08-26 10:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.234')
  if (!versions.includes('5.0.234')) {
    settingsStore.addChangelog('5.0.234',
      '• <AppIcon name="layout" />  二级导航栏悬浮样式修复：强制覆盖各视图 scoped 样式，圆角胶囊+毛玻璃+阴影效果在所有页面生效\n' +
      '• <AppIcon name="wrench" />  修复更新安装时弹出 PowerShell/cmd 控制台窗口：改用 CREATE_NO_WINDOW 标志隐藏控制台，仅显示 NSIS 安装向导\n' +
      '• <AppIcon name="move" />  修复窗口缩小后无法拖动顶部状态栏移动窗口：标题区域补充拖拽属性',
      '2026-08-25 19:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.233')
  if (!versions.includes('5.0.233')) {
    settingsStore.addChangelog('5.0.233',
      '• <AppIcon name="layout" />  二级导航栏（Tab 栏）改为独立悬浮模块：圆角胶囊+毛玻璃+阴影，不与主页面连为一体\n' +
      '• <AppIcon name="sliders" />  平台设置新增二级导航栏透明度滑杆，可独立调节 Tab 栏透明度',
      '2026-08-25 18:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.232')
  if (!versions.includes('5.0.232')) {
    settingsStore.addChangelog('5.0.232',
      '• <AppIcon name="refresh-cw" />  检查更新功能全部重写：GitHub Release API 检查最新版本，支持下载进度显示与可见安装向导\n' +
      '• <AppIcon name="rotate-ccw" />  回退 v5.0.231 透明度设置改动，恢复仅导航栏透明度可控',
      '2026-08-25 16:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.230')
  if (!versions.includes('5.0.230')) {
    settingsStore.addChangelog('5.0.230',
      '• <AppIcon name="refresh-cw" />  修复检查更新失效：兼容无空格安装包文件名前缀 MasterWorkbench_ 的版本号提取\n' +
      '• <AppIcon name="list-ordered" />  计划库列表排序优化：进行中置顶、已完成置底、其他状态居中，各组内按结束时间升序',
      '2026-08-25 15:10'
    )
  }
  settingsStore.ensureAppVersion('5.0.229')
  if (!versions.includes('5.0.229')) {
    settingsStore.addChangelog('5.0.229',
      '• <AppIcon name="check-circle" />  修复计划库状态选择弹窗在窗口底部被任务栏遮挡：参考子任务弹窗定位逻辑，预留任务栏空间，空间不足时自动向上弹出',
      '2026-08-25 11:45'
    )
  }
  settingsStore.ensureAppVersion('5.0.228')
  if (!versions.includes('5.0.228')) {
    settingsStore.addChangelog('5.0.228',
      '• <AppIcon name="check-circle" />  修复计划库状态选择弹窗在窗口底部时被任务栏遮挡的问题：自动检测剩余空间，空间不足时在徽章上方弹出',
      '2026-08-25 11:15'
    )
  }
  settingsStore.ensureAppVersion('5.0.227')
  if (!versions.includes('5.0.227')) {
    settingsStore.addChangelog('5.0.227',
      '• <AppIcon name="app-window" />  桌面快捷方式名称和 Windows 软件目录名称统一为 MasterWorkbench',
      '2026-08-25 11:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.226')
  if (!versions.includes('5.0.226')) {
    settingsStore.addChangelog('5.0.226',
      '• <AppIcon name="monitor" />  更新流程改为两步：下载完成后弹出选择（现在更新/稍后更新），选择「现在更新」关闭软件并弹出可见安装向导界面\n' +
      '• <AppIcon name="download" />  下载与安装分离：选择「稍后更新」后安装包保留，下次点击更新可直接安装',
      '2026-08-25 10:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.225')
  if (!versions.includes('5.0.225')) {
    settingsStore.addChangelog('5.0.225',
      '• <AppIcon name="calendar" />  全局日期选择器 UI 改为 Ant Design DatePicker 风格：白底圆角边框、悬停蓝色高亮、聚焦阴影环\n' +
      '• <AppIcon name="palette" />  消息中心按消息类型使用不同淡色底色：紧急淡红、警告淡橙、普通淡蓝，区分更清晰',
      '2026-08-25 09:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.224')
  if (!versions.includes('5.0.224')) {
    settingsStore.addChangelog('5.0.224',
      '• <AppIcon name="table" />  计划库配置弹窗新增「表格列显示」区块：可勾选显示/隐藏各列并拖拽排序（参考论文库模式）\n' +
      '• <AppIcon name="wrench" />  修复更新下载进度不刷新问题：改用 spawn_blocking 异步下载，进度事件正常推送\n' +
      '• <AppIcon name="wrench" />  更新流程改为弹出安装向导界面，用户可直观完成升级',
      '2026-08-25 03:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.223')
  if (!versions.includes('5.0.223')) {
    settingsStore.addChangelog('5.0.223',
      '• <AppIcon name="message-square" />  消息中心各消息卡片增加边框和阴影，与背景底色更易区分\n' +
      '• <AppIcon name="table" />  计划库新增「列设置」功能：可自由显示/隐藏各列（编号、状态、主题、时间、分类、子任务等）\n' +
      '• <AppIcon name="layout" />  平台设置备份与回退控件改为横向排列，窄列下不再竖排挤压',
      '2026-08-25 02:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.222')
  if (!versions.includes('5.0.222')) {
    settingsStore.addChangelog('5.0.222',
      '• <AppIcon name="layout" />  平台设置调整：easyScholar API 配置模块移至数据管理模块下方\n' +
      '• <AppIcon name="layout" />  数据管理列加宽，两栏布局更均衡\n' +
      '• <AppIcon name="wrench" />  修复自定义颜色 R/G/B 输入框数字被遮挡问题\n' +
      '• <AppIcon name="wrench" />  修复更新安装流程：恢复静默安装方案，点击「立即更新」后自动完成升级并重启',
      '2026-08-25 01:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.221')
  if (!versions.includes('5.0.221')) {
    settingsStore.addChangelog('5.0.221',
      '• <AppIcon name="wrench" />  修复主题配色区域自定义颜色溢出卡片边界问题\n' +
      '• <AppIcon name="wrench" />  修复更新流程安装窗口不显示问题（改用 VBS 独立进程启动更新脚本）',
      '2026-08-25 01:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.220')
  if (!versions.includes('5.0.220')) {
    settingsStore.addChangelog('5.0.220',
      '• <AppIcon name="sliders" />  平台设置新增导航栏透明度滑杆：背景图模式下可自由调节悬浮导航透明度，平衡背景可见性与文字清晰度\n' +
      '• <AppIcon name="layout" />  平台设置页改为左右两栏布局：数据管理在左，偏好设置与 API 配置在右\n' +
      '• <AppIcon name="monitor" />  窗口较窄时自动回退为上下布局，兼容小屏',
      '2026-08-25 00:10'
    )
  }
  settingsStore.ensureAppVersion('5.0.219')
  if (!versions.includes('5.0.219')) {
    settingsStore.addChangelog('5.0.219',
      '• <AppIcon name="layout" />  平台设置页改为左右两栏布局：数据管理在左，偏好设置与 API 配置在右\n' +
      '• <AppIcon name="monitor" />  窗口较窄时自动回退为上下布局，兼容小屏',
      '2026-08-24 23:40'
    )
  }
  settingsStore.ensureAppVersion('5.0.218')
  if (!versions.includes('5.0.218')) {
    settingsStore.addChangelog('5.0.218',
      '• <AppIcon name="refresh-cw" />  进一步加固更新流程：等待旧进程完全退出后再弹出安装向导（最多 20 秒，超时自动强杀）\n' +
      '• <AppIcon name="file-text" />  更新过程写入日志 %TEMP%\\mw_update.log，安装异常时可定位问题\n' +
      '• <AppIcon name="info" />  下载完成后弹窗明确提示「即将弹出安装窗口」',
      '2026-08-24 23:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.217')
  if (!versions.includes('5.0.217')) {
    settingsStore.addChangelog('5.0.217',
      '• <AppIcon name="refresh-cw" />  修复更新完成后无安装界面问题：改为等待旧进程退出后显示安装向导，用户仅需点击「下一步 / 安装」即可完成升级\n' +
      '• <AppIcon name="trash-2" />  升级过程自动卸载旧版本并安装新版本，无需手动处理\n' +
      '• <AppIcon name="wrench" />  修复更新说明中部分文字乱码问题',
      '2026-08-24 21:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.216')
  if (!versions.includes('5.0.216')) {
    settingsStore.addChangelog('5.0.216',
      '• <AppIcon name="wrench" />  修复背景图模式下顶部状态栏布局错位问题（改用层叠上下文方案，不影响悬浮岛模式定位）',
      '2026-08-24 19:40'
    )
  }
  settingsStore.ensureAppVersion('5.0.215')
  if (!versions.includes('5.0.215')) {
    settingsStore.addChangelog('5.0.215',
      '• <AppIcon name="image" />  修复页面背景图片功能不可用问题（z-index 层级导致背景图被遮挡）',
      '2026-08-24 15:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.214')
  if (!versions.includes('5.0.214')) {
    settingsStore.addChangelog('5.0.214',
      '• <AppIcon name="key" />  设置页新增 GitHub 更新令牌入口：令牌过期后可直接在设置中更新，无需重新发版\n' +
      '• <AppIcon name="refresh-cw" />  更新流程简化为一键替换：下载完成后自动静默安装并重启应用，无需手动操作\n' +
      '• <AppIcon name="wrench" />  修复登录页账号与密码输入框宽度不一致问题\n' +
      '• <AppIcon name="wrench" />  修复背景图模式下左上角侧边栏区域空白问题',
      '2026-08-24 10:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.213')
  if (!versions.includes('5.0.213')) {
    settingsStore.addChangelog('5.0.213',
      '• <AppIcon name="palette" />  主题配色新增自定义渐变：可选择两个颜色组成渐变作为导航栏/状态栏背景\n' +
      '• <AppIcon name="image" />  新增页面背景图片功能：支持上传自定义图片作为平台背景，覆盖状态栏以下所有区域，可调节透明度\n' +
      '• <AppIcon name="layout" />  登录页优化：移除会话过期提示文字，账号/密码标签改为左右排列\n' +
      '• <AppIcon name="align-center" />  悬浮岛模式品牌区调整：牛马科技文字相对版本号水平居中对齐',
      '2026-08-24 12:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.212')
  if (!versions.includes('5.0.212')) {
    settingsStore.addChangelog('5.0.212',
      '• <AppIcon name="rotate-ccw" />  恢复 NSIS 默认安装界面，移除自定义安装页面\n' +
      '• <AppIcon name="calendar" />  周数计算修正：以 2026-08-08 所在周为第 1 周（周一为起始），自动检测当前周数\n' +
      '• <AppIcon name="user" />  头像下拉菜单相对头像居中显示\n' +
      '• <AppIcon name="align-center" />  日期/周数弹窗居中显示，自定义周数行居中布局',
      '2026-08-24 00:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.211')
  if (!versions.includes('5.0.211')) {
    settingsStore.addChangelog('5.0.211',
      '• <AppIcon name="wrench" />  修复安装界面"快速安装"按钮点击无反应：改用 PostMessage 模拟原生 Next 按钮触发页面流转\n' +
      '• <AppIcon name="wrench" />  修复安装界面 Finish 页面无法退出：新增"完成"按钮触发离开事件\n' +
      '• <AppIcon name="wrench" />  Next 按钮从隐藏改为移出屏幕外，保留 NSIS 内部页面导航逻辑完整性',
      '2026-08-23 23:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.210')
  if (!versions.includes('5.0.210')) {
    settingsStore.addChangelog('5.0.210',
      '• <AppIcon name="palette" />  安装界面全面修复：背景图铺满整个窗口、隐藏所有原生控件、文字对比度增强\n' +
      '• <AppIcon name="calendar" />  周数计算修正：以 2026-08-08 所在周为第 1 周（周一为起始），自动检测当前周数\n' +
      '• <AppIcon name="user" />  头像下拉菜单相对头像居中显示\n' +
      '• <AppIcon name="align-center" />  日期/周数弹窗居中显示，自定义周数行居中布局',
      '2026-08-23 22:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.209')
  if (!versions.includes('5.0.209')) {
    settingsStore.addChangelog('5.0.209',
      '• <AppIcon name="palette" />  全新自定义安装界面：替换 NSIS 默认向导为个性化安装页面\n' +
      '• <AppIcon name="image" />  欢迎页：壁纸背景 + 居中标题 + 快速安装按钮 + 自定义安装路径\n' +
      '• <AppIcon name="loader" />  安装页：进度圆环动画 + 实时文件拷贝状态\n' +
      '• <AppIcon name="check-circle" />  完成页：创建桌面快捷方式 + 打开应用选项',
      '2026-08-23 22:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.208')
  if (!versions.includes('5.0.208')) {
    settingsStore.addChangelog('5.0.208',
      '• <AppIcon name="package" />  信息库资产字段扩展：新增质保时间、购买渠道（可自定义）、资产状态（可自定义+自定义填充色）\n' +
      '• <AppIcon name="window" />  桌面端窗口标题栏与应用状态栏统一：无边框窗口+自定义标题栏，可拖拽移动、最小化/最大化/关闭\n' +
      '• <AppIcon name="bug" />  修复信息库每次更新后数据丢失问题（移除 v5.0.205 过时的数据清除逻辑）',
      '2026-08-24 02:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.207')
  if (!versions.includes('5.0.207')) {
    settingsStore.addChangelog('5.0.207',
      '• <AppIcon name="bug" />  修复信息库编号显示 Rundefined 的问题（编号前缀与序号拼接逻辑修复）\n' +
      '• <AppIcon name="sliders-horizontal" />  团购状态支持自定义：可在信息库配置弹窗中新增、删除、排序团购状态选项',
      '2026-08-24 01:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.206')
  if (!versions.includes('5.0.206')) {
    settingsStore.addChangelog('5.0.206',
      '• <AppIcon name="list-ordered" />  信息库编号自动生成带前缀：软件订阅 R1/R2、团购 T1/T2、资产 Z1/Z2、卡证 K1/K2、手机套餐 P1/P2\n' +
      '• <AppIcon name="settings" />  信息库配置独立弹窗：添加按钮左侧新增齿轮配置入口，可管理各分类的自定义选项\n' +
      '• <AppIcon name="sliders-horizontal" />  自定义选项支持删除、上下排序、修改预置名称（预置项至少保留 1 个）\n' +
      '• <AppIcon name="arrow-down-narrow-wide" />  信息库所有分类列表默认按到期日期最近排序（永久有效、无日期排最后）',
      '2026-08-24 00:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.205')
  if (!versions.includes('5.0.205')) {
    settingsStore.addChangelog('5.0.205',
      '• <AppIcon name="layout-dashboard" />  顶部状态栏品牌区布局优化：版本号与"牛马科技"间距增大不再重叠，品牌区整体垂直居中；"研究生工作平台"标题在所有模式下左右居中显示\n' +
      '• <AppIcon name="home" />  导航栏"主页面"更名为"信息预览"\n' +
      '• <AppIcon name="align-horizontal-justify-center" />  仿真中心二级导航高度与其它页面统一对齐\n' +
      '• <AppIcon name="calendar" />  周数计算基准改为 2026年8月8日所在周为第 1 周，保留自定义周数功能\n' +
      '• <AppIcon name="list-checks" />  信息预览最近计划显示逻辑与计划中心日历视图一致（日/周/月/年计划按层级显示）\n' +
      '• <AppIcon name="subscriptions" />  信息库软件订阅字段重构：编号、订阅名称、会员等级（VIP/SVIP 可自定义）、订阅分类（日会员/月会员/年续包月/年会员/连续包年/永久会员可自定义）、付费周期（可自定义）、订阅金额、开通日期、到期日期\n' +
      '• <AppIcon name="users" />  信息库团购字段重构：编号、团购名称、商家名称、所属平台（美团/抖音/大众点评/京东/淘宝/支付宝可自定义）、可用时间、团购券码、金额、状态（未使用/已使用/已过期）\n' +
      '• <AppIcon name="credit-card" />  信息库卡证字段重构：编号、名称、类型（会员卡/银行卡/交通卡/储蓄卡/礼品卡/身份证/驾驶证可自定义）、金额、办理日期、到期日期（含永久有效选项）\n' +
      '• <AppIcon name="bell-ring" />  信息库到期提醒：订阅/团购/卡证到期前 3 天、1 天、当天各推送一次消息中心提醒',
      '2026-08-23 23:50'
    )
  }
  settingsStore.ensureAppVersion('5.0.203')
  if (!versions.includes('5.0.203')) {
    settingsStore.addChangelog('5.0.203',
      '• <AppIcon name="align-vertical-justify-center" />  悬浮岛式导航修复：顶部状态栏绝对定位导致二级页面（总览、仿真库等）被遮挡，已为内容区补充 56px 顶部留白\n' +
      '• <AppIcon name="chevron-down" />  品牌区版本号下移，消除与"牛马科技"文字重叠',
      '2026-08-23 23:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.202')
  if (!versions.includes('5.0.202')) {
    settingsStore.addChangelog('5.0.202',
      '• <AppIcon name="download" />  下载更新实时显示进度百分比，流式分块下载替代一次性内存读取\n' +
      '• <AppIcon name="layout-dashboard" />  悬浮岛式导航布局修复：状态栏绝对定位横跨全宽，消除多余蓝色条；Logo 放大居最左、牛马科技在 Logo 下方、版本号在 Logo 右侧上下居中',
      '2026-08-23 23:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.201build2')
  if (!versions.includes('5.0.201build2')) {
    settingsStore.addChangelog('5.0.201build2',
      '• <AppIcon name="layout-dashboard" />  悬浮岛式导航视觉优化：侧边栏背景与主页面内容区融为一体，顶部占位条与状态栏同色无缝衔接\n' +
      '• <AppIcon name="layout" />  品牌区调整：Logo 放大居最左，牛马科技文字缩小，版本号移至状态栏中央',
      '2026-08-23 22:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.201')
  if (!versions.includes('5.0.201')) {
    settingsStore.addChangelog('5.0.201',
      '• <AppIcon name="layout-dashboard" />  悬浮岛式导航布局优化：悬浮岛高度自适应 8 个导航项并垂直居中，四周留白更自然，卡片底色与内容区一致\n' +
      '• <AppIcon name="layout" />  顶部状态栏品牌区调整：Logo 与版本号移至最左侧，牛马科技置于 Logo 下方',
      '2026-08-23 21:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.200')
  if (!versions.includes('5.0.200')) {
    settingsStore.addChangelog('5.0.200',
      '• <AppIcon name="layout-dashboard" />  新增导航栏样式选择（平台设置 → 主题配色 → 导航栏样式）：经典侧边栏 / 悬浮岛式。悬浮岛式导航四周留白、圆角阴影、半透明毛玻璃效果，Logo 与版本号移至顶部状态栏左侧\n' +
      '• <AppIcon name="refresh-cw" />  彻底修复检查更新误报：版本比较兼容 5.0.199build3（无 + 号）与 5.0.199+build3（带 + 号）两种格式，已是最新版本不再误弹更新提示',
      '2026-08-23 20:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.199build3')
  if (!versions.includes('5.0.199build3')) {
    settingsStore.addChangelog('5.0.199build3',
      '• <AppIcon name="refresh-cw" />  修复检查更新误报：build 版本号（如 5.0.199+build2）在解析时丢失 build 序号，导致已是最新版本仍弹窗提示更新\n' +
      '• <AppIcon name="download" />  修复更新下载 404：安装包下载改用 GitHub asset API 端点，避免 build 后缀文件名下载链接失效\n' +
      '• <AppIcon name="bug" />  版本号比较全面支持 build 序号：5.0.199 < 5.0.199+build1 < 5.0.199+build2，更新判断更准确',
      '2026-08-23 18:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.199build2')
  if (!versions.includes('5.0.199build2')) {
    settingsStore.addChangelog('5.0.199build2',
      '• <AppIcon name="download" />  一键覆盖安装：更新时自动跳过卸载选择页面，直接覆盖安装，无需用户手动卸载\n' +
      '• <AppIcon name="refresh-cw" />  修复检查更新失效：build 后缀版本号无法被正确解析比较，现已修复版本号提取与比较逻辑\n' +
      '• <AppIcon name="palette" />  安装页面去除自定义主题配色，恢复 NSIS 默认外观',
      '2026-08-23 16:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.199build')
  if (!versions.includes('5.0.199build')) {
    settingsStore.addChangelog('5.0.199build',
      '• <AppIcon name="book" />  论文笔记修复三项问题：①A4 页面顶部内容被遮挡（flex 居中溢出裁剪根因修复）；②关闭按钮 UI 异常（去除多余文字）；③工具栏点击无反应（防止按钮抢夺 contenteditable 焦点）\n' +
      '• <AppIcon name="database" />  财务中心新增「信息库」Tab：统一管理软件订阅、团购、资产、卡证、手机套餐五类信息，每类独立列表与编号，支持添加/编辑/删除/搜索\n' +
      '• <AppIcon name="file-text" />  平台文档新增「最新修改时间」展示，同步更新路由清单与 Store 键位表\n' +
      '• <AppIcon name="download" />  桌面端自动更新修复：私有仓库 GitHub API 返回 404，补充 Bearer Token 认证头',
      '2026-08-23 15:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.199')
  if (!versions.includes('5.0.199')) {
    settingsStore.addChangelog('5.0.199',
      '• <AppIcon name="database" />  财务中心新增「信息库」Tab：统一管理软件订阅、团购、资产、卡证、手机套餐五类信息，每类独立列表与编号，支持添加/编辑/删除/搜索\n' +
      '• <AppIcon name="file-text" />  平台文档新增「最新修改时间」展示，同步更新路由清单（补充财务中心与信息库模块）、Store 键位表（新增 useFinanceStore / useInfoStore 条目）\n' +
      '• <AppIcon name="book" />  论文笔记 A4 模式修复：100% 缩放时上半部分内容不显示的问题已解决（修复 flex 居中导致的溢出裁剪，编辑区改为 overflow:visible 让内容自然增长）\n' +
      '• <AppIcon name="download" />  桌面端自动更新修复：私有仓库 GitHub API 返回 404 导致检查更新提示「网络异常」，现已对 check_for_update 与下载请求补充 Bearer Token 认证头',
      '2026-08-23 12:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.198')
  if (!versions.includes('5.0.198')) {
    settingsStore.addChangelog('5.0.198',
      '• <AppIcon name="refresh-cw" />  更新检查状态反馈完善：搜索中、无新版本、网络错误、发现新版本四种状态清晰提示\n' +
      '• <AppIcon name="mouse-pointer-click" />  左下角版本号支持点击跳转至版本检查弹窗\n' +
      '• <AppIcon name="palette" />  渐变色预设整体调浅，确保导航文字清晰可读',
      '2026-08-23 20:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.197')
  if (!versions.includes('5.0.197')) {
    settingsStore.addChangelog('5.0.197',
      '• <AppIcon name="palette" />  主题配色新增 5 组渐变色系预设（暖阳/深蓝乳白/奶黄青/森绿/清波），渐变同时应用于左侧导航、顶部状态栏与右侧引导面板\n' +
      '• <AppIcon name="lock" />  登录界面新增「记住账号 / 记住密码」选项（居中显示），下次登录自动填充\n' +
      '• <AppIcon name="shield" />  登录前不再展示任何平台内信息（晨间提醒、自动更新、任务提醒等均仅在登录后触发）\n' +
      '• <AppIcon name="download" />  安装程序界面全中文显示，消除中英文混杂',
      '2026-08-23 18:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.196')
  if (!versions.includes('5.0.196')) {
    settingsStore.addChangelog('5.0.196',
      '• <AppIcon name="download-cloud" />  桌面版新增自动更新功能：启动后自动检查 GitHub Release 版本号，发现新版本弹出更新提示弹窗（含版本号对比、更新内容预览），点击「立即更新」自动下载安装包并覆盖安装\n' +
      '• <AppIcon name="refresh-cw" />  支持手动检查更新：关于页面可手动触发更新检查',
      '2026-08-21 14:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.195')
  if (!versions.includes('5.0.195')) {
    settingsStore.addChangelog('5.0.195',
      '• <AppIcon name="pencil-edit" />  Excel 导入新增批量编辑弹窗：导入后不直接写入，先展示在编辑弹窗中，支持全选/单选、批量设置字段（类型/分类/账本/币种/日期/备注）、逐行编辑、删除行，确认后批量保存\n' +
      '• <AppIcon name="table" />  财务库表格列宽自适应优化：非备注列不换行显示，备注列超长内容自动截断省略',
      '2026-08-21 11:50'
    )
  }
  settingsStore.ensureAppVersion('5.0.194')
  if (!versions.includes('5.0.194')) {
    settingsStore.addChangelog('5.0.194',
      '• <AppIcon name="wallet" />  新增「财务中心」模块：总览页含本月支出/收入/结余统计、分类支出占比、最近记录\n' +
      '• <AppIcon name="table" />  财务库表格：编号/时间/账本/分类/类型/金额/币种/备注，支持搜索与多维度筛选排序\n' +
      '• <AppIcon name="tags" />  分类支持二级分类（如三餐-早餐），表格显示"一级-二级"格式\n' +
      '• <AppIcon name="download" />  支持导入导出 CSV 和 Excel(xlsx) 格式，Excel 导入自动识别列名\n' +
      '• <AppIcon name="book" />  支持自定义账本（日常账本/生活费/奖学金等）和多币种（CNY/USD/EUR/JPY/GBP）',
      '2026-08-21 11:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.193')
  if (!versions.includes('5.0.193')) {
    settingsStore.addChangelog('5.0.193',
      '• <AppIcon name="search" />  设置 → 自定义软件新增「自动检测」：一键扫描本机已装的 PDF 阅读器（SumatraPDF/Adobe/Foxit/WPS/Edge/Chrome 等）并填入完整路径\n' +
      '• <AppIcon name="check-circle" />  新增「验证」按钮：保存前实时校验软件路径是否有效，无效时给出明确指引\n' +
      '• <AppIcon name="bug" />  修复「软件不存在」问题：网页端浏览选文件只能拿到文件名、拿不到完整路径；现支持软件名/完整路径/带引号路径/环境变量的智能解析，并支持 .lnk 快捷方式',
      '2026-08-19 16:20'
    )
  }
  settingsStore.ensureAppVersion('5.0.192')
  if (!versions.includes('5.0.192')) {
    settingsStore.addChangelog('5.0.192',
      '• <AppIcon name="wrench" />  修复本地桥接服务启动器乱码报错（cho/?echo 不是内部或外部命令）：启动脚本改为 GBK 编码，Windows 可直接双击运行\n' +
      '• <AppIcon name="folder-open" />  桥接服务脚本改名 server.cjs，兼容项目 type:module 环境\n' +
      '• <AppIcon name="save" />  PDF 保存目录支持自定义：设置页填写绝对路径即可，也可手动编辑 bridge-config.json（默认 文档/WorkbenchPDF）',
      '2026-08-19 15:50'
    )
  }
  settingsStore.ensureAppVersion('5.0.191')
  if (!versions.includes('5.0.191')) {
    settingsStore.addChangelog('5.0.191',
      '• <AppIcon name="tags" />  标签选择面板改为输入框下方下拉：聚焦即弹出，支持筛选已有标签与创建新标签\n' +
      '• <AppIcon name="trash" />  论文库配置新增「删除标签」；阅读设置新增「阅读标签管理」（颜色/上移下移/删除），标签排序全局生效\n' +
      '• <AppIcon name="book-open" />  论文阅读新增排序选项（时间/标题/年份+升降序）与标签筛选，默认规则不变；添加阅读记录支持选择已有标签\n' +
      '• <AppIcon name="check-circle" />  每日打卡底线任务新增「未完成」按钮（位于标记完成之后）\n' +
      '• <AppIcon name="external-link" />  新增「本地桥接服务」：浏览器安全限制下也能一键调用本地软件打开 PDF（设置页可下载脚本）',
      '2026-08-19 15:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.190')
  if (!versions.includes('5.0.190')) {
    settingsStore.addChangelog('5.0.190',
      '• <AppIcon name="tags" />  添加/编辑文献的「标签」支持选择已有标签：聚焦或输入时弹出已有标签面板，点击即可快速关联\n' +
      '• <AppIcon name="plus" />  输入未存在的标签并回车仍创建新标签（自动分配默认颜色），面板底部给出「创建标签」入口；已选标签自动隐藏、输入实时筛选',
      '2026-08-19 11:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.189')
  if (!versions.includes('5.0.189')) {
    settingsStore.addChangelog('5.0.189',
      '• <AppIcon name="file-text" />  论文库新增「PDF 本地关联」：添加/编辑文献时可选择 PDF，自动存入设置的存放目录（未配置则存入浏览器 IndexedDB），列表行与详情均可一键打开\n' +
      '• <AppIcon name="external-link" />  「打开方式」支持跳转自定义阅读软件：桌面版直接启动本地 exe，网页版下载后由系统关联程序打开\n' +
      '• <AppIcon name="wrench" />  修复手动添加文献无法打开 PDF 的问题：补齐独立 PDF 关联字段，支持关联/移除/重新选择',
      '2026-08-19 11:00'
    )
  }
  settingsStore.ensureAppVersion('5.0.186')
  if (!versions.includes('5.0.186')) {
    settingsStore.addChangelog('5.0.186',
      '• <AppIcon name="bell-ring" />  修复更新推送问题：现在只推送最新版本的更新内容，不再一次性推送大量历史更新；已积压的历史更新消息会在启动时自动清理',
      '2026-08-18 17:15'
    )
  }
  settingsStore.ensureAppVersion('5.0.185')
  if (!versions.includes('5.0.185')) {
    settingsStore.addChangelog('5.0.185',
      '• <AppIcon name="book-open" />  论文中心新增「论文阅读」模块：记录阅读论文的研究对象/目的/方法/创新点/可借鉴思路，支持链接论文库、搜索与升降序排序、列显示与自定义字段、详情弹窗、导出 Markdown/PDF\n' +
      '• <AppIcon name="type" />  研究对象/研究目的/研究方法支持多行输入；阅读记录详情长文本自动换行，不再遮挡标题',
      '2026-08-18 16:40'
    )
  }
  settingsStore.ensureAppVersion('5.0.181')
  settingsStore.ensureAppVersion('5.0.180')
  settingsStore.ensureAppVersion('5.0.179')
  if (!versions.includes('5.0.179')) {
    settingsStore.addChangelog('5.0.179',
      '• <AppIcon name="flask" />  组会纪要单条展示改为竖向卡片一行五列，字段标题置顶、内容区独立，更接近手写纪要分区\n' +
      '• <AppIcon name="compass" />  培养节点顶部删除「+ 添加节点」按钮，节点统一通过「阶段配置」管理',
      '2026-08-17 10:54'
    )
  }
  settingsStore.ensureAppVersion('5.0.178')
  if (!versions.includes('5.0.178')) {
    settingsStore.addChangelog('5.0.178',
      '• <AppIcon name="flask" />  科研中心：论文管理新增「论文状态」自定义（增删改状态与颜色、排序）、列表/纪要/培养节点均新增导出（Markdown/PDF）；组会纪要改为一行五列展示；培养节点改为弹窗编辑并支持自定义阶段\n' +
      '• <AppIcon name="compass" />  网站导航顶部重绘为统一头部（标题 + 手动排序/新建分类/添加网站按钮），统计数字下移为独立卡片\n' +
      '• <AppIcon name="trash" />  移除「灵感捕捉」功能及其页面、积分项与平台文档相关描述',
      '2026-08-17 11:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.177')
  if (!versions.includes('5.0.177')) {
    settingsStore.addChangelog('5.0.177',
      '• <AppIcon name="palette" />  计划中心日历月视图：本月以外的日期数字与星期副标签颜色进一步淡化（改用三级灰文字 + 降低透明度），不再抢占本月日期视觉；计划条目保持原色仍可辨识',
      '2026-08-17 09:34'
    )
  }
  settingsStore.ensureAppVersion('5.0.176')
  if (!versions.includes('5.0.176')) {
    settingsStore.addChangelog('5.0.176',
      '• <AppIcon name="pencil" />  已添加的底线任务支持编辑（任务主题、描述、关联计划），任务行与详情弹窗均新增编辑入口',
      '2026-08-17 09:30'
    )
  }
  settingsStore.ensureAppVersion('5.0.174')
  if (!versions.includes('5.0.174')) {
    settingsStore.addChangelog('5.0.174',
      '• <AppIcon name="wrench" />  修复今日总结 / 本周总结弹窗残留上次填写内容的问题，每次打开均为空白表单\n' +
      '• <AppIcon name="pen-tool" />  三个快捷按钮移至同一行右侧，左侧新增「计划底线库」标题\n' +
      '• <AppIcon name="calendar" />  今日底线任务、今日总结支持前后天切换查看历史；本周总结支持前后周切换查看历史周数据',
      '2026-08-16 21:10'
    )
  }
  settingsStore.ensureAppVersion('5.0.173')
  if (!versions.includes('5.0.173')) {
    settingsStore.addChangelog('5.0.173',
      '• <AppIcon name="palette" />  每日打卡顶部新增快捷按钮行：今日底线任务添加 / 今日总结添加 / 本周总结添加，均为简笔画图标 + 文字\n' +
      '• <AppIcon name="file-edit" />  今日总结与本周总结区域改为信息展示，原输入框内容移至弹窗内填写\n' +
      '• <AppIcon name="trash" />  移除每日打卡底部历史记录区域',
      '2026-08-16 20:40'
    )
  }
  settingsStore.ensureAppVersion('5.0.171')
  if (!versions.includes('5.0.157')) {
    settingsStore.addChangelog('5.0.157',
      '• <AppIcon name="bell" />  消息中心新增提醒项：\n' +
      '  · 登录提醒：每次登录自动推送「登录人 + 登录时间」\n' +
      '  · 论文稿件滞留提醒：科研中心论文在某个状态停留满 7 天提醒一次，之后每满 7 天再提醒，直到状态变更（发表状态不提醒）\n' +
      '  · 文献阅读超时提醒：论文库标记「正在阅读」满 7 天提醒一次，之后每满 7 天再提醒，直到改为其他状态\n' +
      '• <AppIcon name="palette" />  消息中心界面全新升级：\n' +
      '  · 新增全部 / 未读 / 已读分类筛选\n' +
      '  · 消息卡片改为无边框融合式设计，左侧类型图标（登录 <AppIcon name="user" />  / 计划 <AppIcon name="clock" />  / 论文 <AppIcon name="file-edit" />  / 文献 <AppIcon name="book-open" />  / 紧急 <AppIcon name="alert-triangle" /> ）无底色\n' +
      '  · 时间统一为「YYYY-MM-DD HH:mm」完整格式，操作按钮竖排，未读消息以红点标记',
      '2026-08-14 17:40'
    )
  }
  // 兜底：确保老用户 localStorage 残留的旧版本号强制升至 5.0.157（load 默认值对已有键不生效）
  settingsStore.ensureAppVersion('5.0.157')
  if (!versions.includes('5.0.151') || !settingsStore.changelog.some(e => e.version === '5.0.151')) {
    settingsStore.addChangelog('5.0.151',
      '• <AppIcon name="wrench" />  修复：编辑仿真记录时，在输入框内拖选文本、鼠标移到左侧空白处松手不再误关弹窗（按下与松开都需在弹窗外空白处才会关闭）；新增 / 编辑仿真弹窗同步修复'
    )
  }
  if (!versions.includes('5.0.150') || !settingsStore.changelog.some(e => e.version === '5.0.150')) {
    // 升级前自动保存快照（仅当从未记录过 5.0.150 时才创建，避免每次加载重复快照）
    if (!versions.includes('5.0.150')) {
      settingsStore.snapshotForRollback('升级至 5.0.150 前（自动快照）')
    }
    settingsStore.addChangelog('5.0.150',
      '• <AppIcon name="shield" />  仿真详情输入更安全：新增 / 编辑仿真记录时，只要表单里有未保存的修改，单击弹窗外面的空白处不再关闭窗口，只有右上角「×」才能关闭\n' +
      '• <AppIcon name="file-edit" />  仿真记录新增「标注理由」字段：在「标注」与「编辑」之间的中间区域以预览方式展示，点击右侧「编辑」可填写，说明这条仿真记录为什么标记保留 / 舍弃 / 暂定\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.150'
    )
  }
  if (!versions.includes('5.0.149')) {
    // 升级前自动保存快照（localStorage 瘦身版 + 本地文件夹全量版双写）
    settingsStore.snapshotForRollback('升级至 5.0.149 前（自动快照）')
    settingsStore.addChangelog('5.0.149',
      '• <AppIcon name="folder" />  数据管理全面重构：主存储与备份合并为「单文件夹」方案（data/ 存当前数据、backups/ 自动备份、attachments/ 附件、exports/ 导出留档）\n' +
      '• <AppIcon name="save" />  自动备份内置：每次修改数据自动备份到 backups/ 目录（保留 20 份），无需单独配置备份文件夹\n' +
      '• <AppIcon name="refresh-cw" />  启动智能合并：本地文件夹与浏览器缓存双向取更全的一侧，任何一侧损坏/清空都不会拖累另一侧，杜绝数据丢失\n' +
      '• ↩️ 文件版回退：历史备份列表一键恢复，恢复前自动快照当前数据防误操作\n' +
      '• <AppIcon name="upload" />  导出详情：导出结果弹窗展示每个模块的条数与体积，明确知道导出了什么\n' +
      '• <AppIcon name="shield" />  未绑定文件夹提示：数据仅存浏览器缓存时顶部横幅提醒，防止电脑关闭/清缓存导致丢失\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.149'
    )
  }
  if (!versions.includes('5.0.148')) {
    // 升级前自动保存快照（已瘦身：排除头像/PDF/日志等大字段，防止占满浏览器存储）
    settingsStore.snapshotForRollback('升级至 5.0.148 前（自动快照）')
    settingsStore.addChangelog('5.0.148',
      '• <AppIcon name="shield" />  修复计划数据丢失根因：版本回滚快照不再包含头像/PDF/日志等大字段，避免快照滚雪球占满浏览器存储、导致后续所有保存失败\n' +
      '• <AppIcon name="save" />  新增「数据自愈」：启动时自动检测损坏的数据键，优先从本地文件夹恢复，恢复不了则清除坏数据并回退默认值，页面不再空白\n' +
      '• <AppIcon name="trash" />  版本回滚快照支持单独删除（释放存储空间）\n' +
      '• <AppIcon name="shield" />  导入 JSON 时值为空的模块自动跳过，不再用空值覆盖现有数据\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.148'
    )
  }
  if (!versions.includes('5.0.147')) {
    // 升级前自动保存上一版本完整数据快照，供「版本回滚」使用（数据不丢失）
    settingsStore.snapshotForRollback('升级至 5.0.147 前（自动快照）')
    settingsStore.addChangelog('5.0.147',
      '• <AppIcon name="receipt" />  新增「版本回滚」：每次升级版本与导入 JSON 前自动保存完整数据快照，可在平台设置中一键回退，数据不丢失\n' +
      '• <AppIcon name="upload" />  导入 JSON 后新增结果确认弹窗：明确显示成功/失败模块与数量，导入文件中没有的模块原样保留（不再清空删除）\n' +
      '• <AppIcon name="bug" />  修复计划中心数据丢失：导入改为合并模式、文件夹同步改为「只补缺不覆盖」，旧文件不会再覆盖新数据\n' +
      '• <AppIcon name="bug" />  修复论文中心数据刷新不出来：与导入/文件夹同步共用同一数据安全修复，文献数据不再被意外清空\n' +
      '• <AppIcon name="tag" />  仿真记录新增评价标签：标题处可点击标注「保留（绿）/舍弃（黑）/暂定（黄）」，选择后显示彩色评价标签，随时可改\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.147'
    )
  }
  if (!versions.includes('5.0.145')) {
    settingsStore.addChangelog('5.0.145',
      '• <AppIcon name="save" />  修复「JSON 自动备份」导出的 auto_backup_*.json 导入后数据不回来的问题：自动备份与「导出 JSON」格式现已统一，且导入兼容无前缀键备份文件\n' +
      '• <AppIcon name="upload" />  从今起仅维护云端平台，EXE 桌面版停止更新\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.145'
    )
  }
  if (!versions.includes('5.0.144')) {
    settingsStore.addChangelog('5.0.144',
      '• <AppIcon name="save" />  修复桌面版（EXE）导出 JSON 备份不可用的问题：改用原生「另存为」对话框保存，浏览器与桌面端均可正常导出\n' +
      '• <AppIcon name="upload" />  操作日志 CSV 导出、平台文档 HTML 导出同步支持桌面端原生保存\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.144'
    )
  }
  if (!versions.includes('5.0.143')) {
    settingsStore.addChangelog('5.0.143',
      '• <AppIcon name="file-edit" />  仿真记录「仿真结果」支持多行换行与长文本输入（与仿真细节一致）\n' +
      '• <AppIcon name="shield" />  修复新增/编辑仿真记录时点击弹窗空白处导致未保存内容丢失的问题\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.143'
    )
  }
  if (!versions.includes('5.0.142')) {
    settingsStore.addChangelog('5.0.142',
      '• <AppIcon name="compass" />  平台设置移至左侧导航栏「科研导航」下方，可通过侧边栏直接进入\n' +
      '• <AppIcon name="file-text" />  平台设置页面精简：「数据资产管理中心」更名为「数据管理」；移除左侧模块导航栏，改为垂直卡片布局\n' +
      '• <AppIcon name="palette" />  偏好设置整合：PDF 打开方式（仅保留浏览器内置/自定义软件）与主题配色（仅保留冷色系+自定义颜色）移入偏好设置\n' +
      '• <AppIcon name="trash" />  移除偏好设置中「导航栏排序」功能（导航栏顺序现由左侧导航栏直接体现）\n' +
      '• <AppIcon name="user" />  头像下拉菜单中移除「平台设置」入口（已由侧边栏导航取代）\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.142'
    )
  }
  if (!versions.includes('5.0.141')) {
    settingsStore.addChangelog('5.0.141',
      '• <AppIcon name="palette" />  仿真详情弹窗中「仿真记录」卡片 UI 重构：左侧圆形编号徽章 + 顶部标题/时间条 + 右上角操作按钮，仿真结果以主题色渐变高亮块展示，仿真软件改为 chip 标签阵列，文件位置使用等宽字体，仿真细节仅在有内容时显示并自带段落背景\n' +
      '• <AppIcon name="pencil" />  记录列表独立滚动区域，避免长记录撑高弹窗\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.141'
    )
  }
  if (!versions.includes('5.0.139')) {
    settingsStore.addChangelog('5.0.139',
      '• <AppIcon name="bar-chart" />  仿真库列设置扩展为全字段可选：新增「仿真细节备注」「仿真软件」「仿真截止」「文件存放位置」「关联计划」「备注」列，可在列设置中自由勾选显隐\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.139'
    )
  }
  if (!versions.includes('5.0.138')) {
    settingsStore.addChangelog('5.0.138',
      '• <AppIcon name="bug" />  修复仿真库「列设置」按钮点击无反应：按钮增加 click.stop 阻止事件冒泡，优化弹窗关闭监听器注册逻辑\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.138'
    )
  }
  if (!versions.includes('5.0.137')) {
    settingsStore.addChangelog('5.0.137',
      '• <AppIcon name="pencil" />  仿真编辑逻辑优化：编辑已有仿真时仅保留「仿真主题」「编号」「关联计划」「开始仿真时间」四项核心字段，其余字段重置为空，便于重新填写实验数据\n' +
      '• <AppIcon name="bar-chart" />  仿真库表格支持自定义展示列：「列设置」按钮（位于「添加仿真」左侧），可自由勾选编号/状态/仿真主题/仿真时间/仿真结果等列的显隐，设置自动持久化\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.137'
    )
  }
  if (!versions.includes('5.0.136')) {
    settingsStore.addChangelog('5.0.136',
      '• <AppIcon name="bug" />  修复组会纪要模板配置弹窗标题栏贴边问题：为弹窗头部增加 padding（18px 24px 0），标题与关闭按钮不再紧贴边缘\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.136'
    )
  }
  if (!versions.includes('5.0.135')) {
    settingsStore.addChangelog('5.0.135',
      '• <AppIcon name="bug" />  修复组会纪要模板配置弹窗底部操作按钮被遮挡问题：将「恢复默认」「完成」按钮移至独立底部固定区域（flex-shrink:0），不再随内容滚动\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.135'
    )
  }
  if (!versions.includes('5.0.134')) {
    settingsStore.addChangelog('5.0.134',
      '• <AppIcon name="file-edit" />  组会纪要模板配置从「平台设置 → 偏好设置」迁移至「科研中心 → 组会纪要」页面，位置在「记录纪要」按钮左侧\n' +
      '• <AppIcon name="settings" />  模板配置弹窗采用齿轮图标标题风格，支持字段增删改、排序、启用/禁用、类型切换，修改即时生效并持久化\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.134'
    )
  }
  if (!versions.includes('5.0.133')) {
    settingsStore.addChangelog('5.0.133',
      '• <AppIcon name="pencil" />  版本更新记录弹窗新增「编辑」按钮：可手动修改每条记录的更新时间，保存后即时生效\n' +
      '• <AppIcon name="refresh-cw" />  新增 JSON 自动备份功能：在平台管理中选择本地文件夹作为备份位置，每次数据修改后自动导出完整 JSON 备份（防抖 30 秒，保留最近 20 个备份）\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.133'
    )
  }
  if (!versions.includes('5.0.132')) {
    settingsStore.addChangelog('5.0.132',
      '• <AppIcon name="save" />  修复「连接同一本地文件夹数据不恢复」问题：连接文件夹时先同步磁盘已有数据回内存，再写回磁盘，避免清空复制数据\n' +
      '• <AppIcon name="refresh-cw" />  完善跨设备恢复体验：换浏览器/电脑后，打开同一云端地址并重新选择复制的文件夹即可恢复全部本地数据\n' +
      '• <AppIcon name="package" />  明确数据架构：localStorage 为实时工作副本，本地文件夹为磁盘镜像，JSON 导出为可移植备份（三者关系与恢复方式已在平台文档说明）\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.132'
    )
  }
  if (!versions.includes('5.0.131')) {
    settingsStore.addChangelog('5.0.131',
      '• <AppIcon name="hash" />  公式弹窗改为左右分栏：左侧常用公式符号/结构，右侧 LaTeX 代码输入\n' +
      '• <AppIcon name="hash" />  修复公式弹窗结构按钮断码/重叠问题，按钮只显示符号预览\n' +
      '• <AppIcon name="search" />  缩放按钮移至右下角，水平排列\n' +
      '• <AppIcon name="pen-tool" />  A4 编辑区改用 zoom 缩放，确保居中稳定\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.131'
    )
  }
  if (!versions.includes('5.0.130')) {
    settingsStore.addChangelog('5.0.130',
      '• <AppIcon name="wrench" />  修复论文笔记工具栏按钮垂直错位问题（CSS 类名匹配）\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.130'
    )
  }
  if (!versions.includes('5.0.129')) {
    settingsStore.addChangelog('5.0.129',
      '• <AppIcon name="wrench" />  修复公式弹窗与工具栏显示重叠问题，提升 z-index\n' +
      '• <AppIcon name="pen-tool" />  A4 编辑区样式完善：固定纸张尺寸、页边距、右下角缩放控制\n' +
      '• <AppIcon name="compass" />  修复科研导航订阅中心下方多余空白模块\n' +
      '• <AppIcon name="shield" />  修复导入备份后仿真中心数据兼容性导致页面空白/打不开\n' +
      '• <AppIcon name="search" />  修复科研导航点击总览页面变空白的问题\n' +
      '• <AppIcon name="file-text" />  论文笔记大纲目录样式统一：左对齐文本、居中面板、移除底部关闭\n' +
      '• <AppIcon name="palette" />  工具栏图标与布局进一步精调\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.129'
    )
  }
  if (!versions.includes('5.0.127')) {
    settingsStore.addChangelog('5.0.127',
      '• <AppIcon name="save" />  保存按钮移至关闭按钮左侧，两者紧贴\n' +
      '• <AppIcon name="type" />  标题 H1-H5 支持自定义大小、格式，参考 Word 字体对话框风格\n' +
      '• <AppIcon name="pen-tool" />  删除线图标重绘为 ab 带删除线样式\n' +
      '• ∑ 公式支持双模式：LaTeX 代码输入 + 所见所得 WYSIWYG 符号/结构面板\n' +
      '• <AppIcon name="pen-tool" />  文档目录左对齐居中显示，移除底部关闭按钮\n' +
      '• <AppIcon name="wrench" />  工具栏与元信息分离：论文标题、关联论文、分类移至顶部独立行，工具栏仅保留格式工具\n' +
      '• <AppIcon name="palette" />  论文笔记工具栏按 Word 风格全面重绘\n' +
      '• <AppIcon name="file-text" />  正文编辑区改为 A4 纸大小，带页边距，右下角新增缩放调节\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.127'
    )
  }
  if (!versions.includes('5.0.126')) {
    settingsStore.addChangelog('5.0.126',
      '• ∑ 论文笔记公式功能修复：LaTeX 公式可正常插入与渲染（renderNoteHtml 放行 data-latex/class 属性，渲染时调用 katex）\n' +
      '• <AppIcon name="file-text" />  无序列表遮挡修复：增大 padding-left + list-style-position:outside，列表项不再被裁切\n' +
      '• <AppIcon name="circle" />  笔记编辑区重构：删除底部「取消/保存笔记」按钮，头部左侧新增「<AppIcon name="save" />  保存」+ 右侧「× 关闭」，统一弹窗格式\n' +
      '• <AppIcon name="type" />  字号选择器改为 Word 风格：初号/小初/一号…八号 + 对应 pt/px 值\n' +
      '• <AppIcon name="pen-tool" />  笔记区三栏布局：左侧笔记管理 + 中间标题导航（自动提取 h1-h6）+ 右侧编辑区，缩小左右空白\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.126'
    )
  }
  if (!versions.includes('5.0.125')) {
    settingsStore.addChangelog('5.0.125',
      '• <AppIcon name="circle" />  全平台弹窗关闭按钮与标题文字严格垂直居中对齐\n' +
      '• ✓ 添加论文 / 添加仿真 / 记录组会纪要等弹窗：右上角统一「✓ 添加」+「× 关闭」按钮，移除底部取消/添加按钮\n' +
      '• <AppIcon name="save" />  论文笔记支持输入自动保存，每次编辑后防抖保存并显示「已保存于 HH:mm:ss」\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.125'
    )
  }
  if (!versions.includes('5.0.124')) {
    settingsStore.addChangelog('5.0.124',
      '• <AppIcon name="wrench" />  修复添加文献 / 编辑计划弹窗右上角「配置」按钮与关闭按钮重叠的问题\n' +
      '• <AppIcon name="wrench" />  修复计划 / 任务配置弹窗被编辑计划弹窗遮挡（z-index 提升至 2100）\n' +
      '• <AppIcon name="graduation-cap" />  培养节点编辑按钮移至时间轴标题栏右侧，统一管理整条时间轴的编辑状态\n' +
      '• <AppIcon name="bug" />  修复笔记中无序列表 / 有序列表左侧 bullet 被裁剪的遮挡问题\n' +
      '• <AppIcon name="pen-tool" />  论文笔记支持自定义字号（极小 / 小 / 中 / 大 / 特大 / 超大）\n' +
      '• <AppIcon name="arrow-left" />  论文笔记支持左对齐 / 居中对齐 / 右对齐\n' +
      '• <AppIcon name="type" />  论文笔记支持希腊字母、数学符号、箭头等特殊符号面板\n' +
      '• ∑ 论文笔记支持 LaTeX 公式输入与 KaTeX 渲染（行内 + 块级）\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.124'
    )
  }
  if (!versions.includes('5.0.123')) {
    settingsStore.addChangelog('5.0.123',
      '• <AppIcon name="sparkles" />  仿真中心总览四张状态数字卡片文字与数字均居中，数字改用更粗字体\n' +
      '• <AppIcon name="circle" />  全平台弹窗关闭按钮统一为浅色底 × 图标样式（操作日志 / 消息中心 / 计划临近提醒 / 更新记录 / 关于平台 / 平台文档 / 论文管理 / 添加论文 / 编辑组会纪要 / 论文详情 / 编辑计划等）\n' +
      '• <AppIcon name="bug" />  修复组会纪要「记录纪要」会带出上一次已添加内容的 BUG（关闭弹窗时正确重置表单）\n' +
      '• <AppIcon name="graduation-cap" />  培养节点时间轴编辑从「平台设置」移除，改为在「科研中心 → 培养节点」内直接编辑（名称 / 状态 / 日期），并统一编辑按钮图标\n' +
      '• <AppIcon name="settings" />  计划 / 任务配置从「平台设置」移除，改为在「计划中心 → 计划库 → 添加计划」处点击「配置」弹窗设置\n' +
      '• <AppIcon name="book" />  论文库配置（表单字段 + 表格列）与论文库状态管理从「平台设置」移除，改为在「论文中心 → 论文库 → 添加文献」处点击「配置」弹窗设置\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.123'
    )
  }
  if (!versions.includes('5.0.122')) {
    settingsStore.addChangelog('5.0.122',
      '• <AppIcon name="clock" />  仿真中心新增「前世今生」编辑记录：每次编辑仿真都会自动留痕，详情弹窗底部以时间线展示每次修改的时间、修改项数量以及每个字段的「修改前 → 修改后」对照\n' +
      '• <AppIcon name="file-text" />  仿真库列表文字全部居中显示，操作列编辑/删除按钮改为统一的浅色底图标按钮\n' +
      '• <AppIcon name="sliders" />  仿真库工具栏顺序调整为「排序（最左）→ 搜索 → 添加仿真（最右）」，操作动线更顺\n' +
      '• <AppIcon name="box" />  仿真详情弹窗右上角编辑按钮统一为浅色底样式，并新增统一的关闭按钮\n' +
      '• <AppIcon name="save" />  添加/编辑仿真弹窗改版：移除右下角「取消 / 添加」，改为右上角「添加（保存）+ 关闭」按钮\n' +
      '• <AppIcon name="wrench" />  仿真软件版本 MATLAB 名称补全版本前缀 R（MATLAB R2022b / MATLAB R2024b）\n' +
      '• <AppIcon name="plus" />  「仿真软件版本（可多选）」小标题右侧新增「自定义」按钮，可自行添加软件名称并作为可多选标签长期保存\n' +
      '• <AppIcon name="bug" />  修复仿真库按「仿真软件」搜索时的取值错误\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.122'
    )
  }
  if (!versions.includes('5.0.121')) {
    settingsStore.addChangelog('5.0.121',
      '• <AppIcon name="compass" />  科研导航「总览」页视觉统一：左右两栏（常用网站 / 订阅动态）各加上半透明面板背景与边框圆角，与其他页面区块风格一致\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.121'
    )
  }
  if (!versions.includes('5.0.120')) {
    settingsStore.addChangelog('5.0.120',
      '• <AppIcon name="compass" />  科研导航「总览」页布局优化：左侧常用网站改为多行多列网格展示，减少空白并提高信息密度\n' +
      '• <AppIcon name="book" />  订阅动态展示升级：每个期刊卡片下方从只展示 1 篇最新文献升级为展示最近 3 篇文献（标题 + 年月日时分秒日期），便于快速浏览多个期刊动态\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.120'
    )
  }
  if (!versions.includes('5.0.119')) {
    settingsStore.addChangelog('5.0.119',
      '• <AppIcon name="compass" />  科研导航「总览」页不再空白：左侧展示最近常用网站导航（按点击次数排序），右侧展示订阅中心常见订阅及简略信息（期刊名、最新文献标题、格式化日期）\n' +
      '• <AppIcon name="calendar" />  订阅中心文献日期展示优化：将 RSS 自带的英文日期格式（如 Thu, 06 Aug 2026 16:00:00 GMT）识别并转换为「YYYY-MM-DD HH:mm:ss」的 年月日时分秒 形式，无法识别时回退原文\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.119'
    )
  }
  if (!versions.includes('5.0.118')) {
    settingsStore.addChangelog('5.0.118',
      '• <AppIcon name="wifi" />  订阅中心 XML 导入优化：增强 RSS/Atom 解析器，兼容 CDATA、带属性的 <link>、命名空间标签（dc:date / dc:creator）等常见格式\n' +
      '• <AppIcon name="file-edit" />  优化导入引导：明确说明需复制浏览器「查看网页源代码」里的 XML 原文，而不是渲染后的页面文字；新增「复制源代码链接」按钮，可一键复制 view-source: 地址到浏览器打开\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.118'
    )
  }
  if (!versions.includes('5.0.117')) {
    settingsStore.addChangelog('5.0.117',
      '• <AppIcon name="wifi" />  订阅中心改为「在 Zotero 订阅、平台展示」模式：移除无效的知网自动抓取（公共代理长期被拦截），改为用户粘贴 / 上传 RSS 原文后平台解析展示\n' +
      '• <AppIcon name="folder" />  新增「上传文件」按钮，可直接导入浏览器或 Zotero 导出的 .xml/.txt 文献清单；新增 Zotero 使用步骤引导，复制链接后可在 Zotero 添加 feed、浏览器打开复制清单、粘回平台展示\n' +
      '• <AppIcon name="save" />  订阅原文随订阅一并保存，支持「重新解析全部 / 单个」一键刷新展示内容\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.117'
    )
  }
  if (!versions.includes('5.0.116')) {
    settingsStore.addChangelog('5.0.116',
      '• <AppIcon name="file-edit" />  订阅中心文案与交互优化：RSS 地址提示改为白话说明，新增「复制链接」按钮（一键复制 RSS 地址，便于在浏览器打开后手动粘贴文献清单），「粘贴 RSS 原文」改名为「手动粘贴文献清单」更易懂\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.116'
    )
  }

  if (!versions.includes('5.0.115')) {
    settingsStore.addChangelog('5.0.115',
      '• <AppIcon name="wifi" />  更新知网期刊 RSS 预设地址为 Zotero 可识别的标准格式：https://rss.cnki.net/knavi/rss/{期刊码}?pcode=CJFD,CCJD；修正《汽车工程》为 QCGC、《汽车安全与节能学报》为 QCAN，与 Zotero 订阅一致\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.115'
    )
  }

  if (!versions.includes('5.0.114')) {
    settingsStore.addChangelog('5.0.114',
      '• <AppIcon name="bug" />  修复订阅中心知网 RSS 获取失败（HTTP 400/500）：公共 CORS 代理被知网拦截，现增加多代理自动回退；同时支持「粘贴 RSS / Atom XML 原文」作为兜底方案，可绕过跨域限制直接导入文献\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.114'
    )
  }
  if (!versions.includes('5.0.113')) {
    settingsStore.addChangelog('5.0.113',
      '• <AppIcon name="bug" />  修复订阅中心「添加 / 编辑订阅」弹窗背景透明：弹窗白框（.sc-modal）此前仅有尺寸、缺少背景色导致整体透出页面内容，现已补白色背景 + 圆角 + 阴影，与仿真弹窗视觉一致\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.113'
    )
  }
  if (!versions.includes('5.0.112')) {
    settingsStore.addChangelog('5.0.112',
      '• <AppIcon name="wrench" />  修正理解偏差：上版误将「总览/网站导航/订阅中心」改版加在了「科研中心」，本版改到正确的「科研导航」（计划中心下方入口）\n' +
      '• <AppIcon name="compass" />  科研导航改版：顶级页签改为「总览 / 网站导航 / 订阅中心」；原学术站点导航归入「网站导航」，总览暂空白占位\n' +
      '• <AppIcon name="wifi" />  订阅中心（恢复）：支持添加知网等期刊 RSS/Atom 订阅（预设《汽车工程》《汽车技术》《机械工程学报》等），经公共代理拉取最新文献，可展开查看并跳转原文；获取失败有兜底提示\n' +
      '• <AppIcon name="bookmark" />  科研中心保持原始 5 个页签不变（论文管理/研究助手/组会纪要/培养节点/灵感捕捉）\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.112'
    )
  }
  if (!versions.includes('5.0.111')) {
    settingsStore.addChangelog('5.0.111',
      '• <AppIcon name="bug" />  修复仿真中心「添加 / 编辑 / 详情」弹窗背景透明：弹窗本体（.sim-modal）此前仅有尺寸、缺少背景色导致整体透出页面内容，现已补白色背景 + 圆角 + 阴影，弹窗不再透明\n' +
      '• <AppIcon name="bookmark" />  科研中心维持原始 5 个页签布局（论文管理 / 研究助手 / 组会纪要 / 培养节点 / 灵感捕捉），按用户确认不恢复订阅中心改版\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.111'
    )
  }
  if (!versions.includes('5.0.110')) {
    settingsStore.addChangelog('5.0.110',
      '• <AppIcon name="chevron-left" />  取消科研中心订阅中心改版，恢复原始 5 个页签：论文管理 / 研究助手 / 组会纪要 / 培养节点 / 灵感捕捉\n' +
      '• <AppIcon name="image" />  修复仿真弹窗背景透明：遮罩加深为半透明深色，弹窗与背景视觉层级更分明\n' +
      '• <AppIcon name="box" />  仿真中心顶部状态栏对齐论文中心风格：改为胶囊切换按钮组\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.110'
    )
  }
  if (!versions.includes('5.0.109')) {
    settingsStore.addChangelog('5.0.109',
      '• <AppIcon name="bug" />  修复仿真中心不显示：为已存 localStorage 的老用户补充 navOrder 迁移，把「仿真中心」注入到科研中心之后，升级后侧边栏即可看到入口\n' +
      '• <AppIcon name="bug" />  修复计划库自动完成：改为「已填写内容的子任务全部填充<AppIcon name="circle" /> 完成(绿)色即自动标记完成」，忽略留空槽位、且至少填写一个子任务，不再因空槽位卡住\n' +
      '• <AppIcon name="bookmark" />  科研中心改版：顶级页签改为「总览 / 网站导航 / 订阅中心」；原论文管理/研究助手/组会纪要/培养节点/灵感捕捉整体归入「网站导航」\n' +
      '• <AppIcon name="wifi" />  新增订阅中心：支持添加知网等期刊 RSS/Atom 订阅（预设《汽车工程》《汽车技术》《机械工程学报》等），经公共代理拉取最新文献，可展开查看并跳转原文；获取失败有兜底提示\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.109'
    )
  }
  if (!versions.includes('5.0.108')) {
    settingsStore.addChangelog('5.0.108',
      '• <AppIcon name="file-text" />  计划库自动完成：子任务全部填写内容并填充「完成（绿色）」时，计划状态自动标记为已完成\n' +
      '• <AppIcon name="flask" />  新增仿真中心：科研中心下、论文中心上新增入口，含「总览」「仿真库」两个子页面\n' +
      '• <AppIcon name="bar-chart" />  仿真总览：状态统计卡 + 环形图展示仿真中/已完成/待开始/取消分布，最近仿真列表可查看详情并跳转计划库\n' +
      '• <AppIcon name="folder" />  仿真库：添加仿真（编号=年月日时分秒+序号，可自定义）、软件版本多选、起止时间、结果/文件位置/备注；支持按仿真时间/软件搜索、按时间/状态排序（默认时间由远到近）；列表单击看只读详情、双击或编辑按钮进入编辑\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.108'
    )
  }
  if (!versions.includes('5.0.107')) {
    settingsStore.addChangelog('5.0.107',
      '• <AppIcon name="bar-chart" />  论文中心布局优化：总览页「各状态文献占比」卡片取消 Grid 自动拉伸，改为顶部对齐，消除饼图下方空白\n' +
      '• <AppIcon name="bell" />  消息中心操作按钮改为竖向常驻：单条消息右侧的「标记已读」「删除」图标按钮改为两行一列排列，并取消悬停显示改为常驻可见\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.107'
    )
  }
  if (!versions.includes('5.0.106')) {
    settingsStore.addChangelog('5.0.106',
      '• <AppIcon name="sparkles" />  导师应答布局优化：改为左右双栏独立排列，彻底消除 2×2 网格产生的跨行空白\n' +
      '• <AppIcon name="bell" />  消息中心操作按钮图标化：单条消息的「标记已读」「删除」改为右侧图标按钮（Feather 风格），悬停显示\n' +
      '• <AppIcon name="compass" />  消息中心「清空全部」按钮移至弹窗右上角，与「全部已读」并列，底部不再单独放置\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.106'
    )
  }
  if (!versions.includes('5.0.105')) {
    settingsStore.addChangelog('5.0.105',
      '• <AppIcon name="bug" />  修复平台文档左侧目录为空的问题：补全缺失的 nextTick 导入，章节导航现在会正常显示并支持跳转\n' +
      '• <AppIcon name="pen-tool" />  导师应答页面重构为两行两列布局：输入区 / 识别结果 / 话术原则 / 场景话术库四大模块呈 2×2 网格排列\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.105'
    )
  }
  if (!versions.includes('5.0.104')) {
    settingsStore.addChangelog('5.0.104',
      '• <AppIcon name="book" />  平台文档新增左侧导航目录：根据章节自动生成目录，点击即可跳转，内容变化时目录自动同步\n' +
      '• <AppIcon name="download" />  平台文档支持一键导出为 PDF 与 HTML，便于存档或分享\n' +
      '• <AppIcon name="palette" />  统一编辑按钮样式：主页面「学业进度总览」与科研导航网站卡片编辑按钮统一为简洁的 SVG 铅笔图标\n' +
      '• <AppIcon name="pen-tool" />  导师应答「话术库核心原则」改为更稳固的两行两列网格布局\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.104'
    )
  }
  if (!versions.includes('5.0.103')) {
    settingsStore.addChangelog('5.0.103',
      '• <AppIcon name="lock" />  新增账号安全策略：登录态有效期 24 小时，距上次登录超过 24 小时后自动强制下线，需重新输入账号密码登录\n' +
      '• <AppIcon name="clock" />  顶部头像下拉菜单新增「本次登录时间」与「登录态剩余有效期」显示，过期前 1 小时以红色提醒\n' +
      '• <AppIcon name="refresh-cw" />  登录页新增会话过期提示条：因超时被强制下线时会明确告知原因，避免误以为数据丢失\n' +
      '• <AppIcon name="book" />  平台文档全面重写为「接手手册」：新增源码目录结构、路由与页面清单、Pinia Store 与 localStorage 键位对照表、主题系统说明、账号与登录机制、二次开发与版本发布流程、部署说明、常见问题排查等章节\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.103'
    )
  }
  if (!versions.includes('5.0.102')) {
    settingsStore.addChangelog('5.0.102',
      '• <AppIcon name="palette" />  顶部状态栏、右侧 Guidance Panel 与左侧导航栏主题色完全连贯：折叠状态下的 Guidance Panel 也使用 --color-nav-bg，头像区域移至更靠近右边缘\n' +
      '• <AppIcon name="user" />  顶部头像及下拉菜单整体右移，减小与屏幕右侧的留白\n' +
      '• <AppIcon name="calendar" />  顶部状态栏日期弹窗支持点击外部区域关闭\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.102'
    )
  }
  if (!versions.includes('5.0.101')) {
    settingsStore.addChangelog('5.0.101',
      '• <AppIcon name="tag" />  「后台管理」正式更名为「平台设置」（导航、状态栏、路由标题、各提示文案统一更新）\n' +
      '• <AppIcon name="palette" />  右侧 Guidance Panel 与左侧导航栏、上方状态栏融为一体：统一使用平台主题配色，修改「平台设置」主题颜色时实时同步变化\n' +
      '• <AppIcon name="book" />  平台文档新增「研究助手使用教程」章节：选题收窄向导、文献综述模板、论文阶段流水线、引用自检清单四张卡片的用法说明\n' +
      '• <AppIcon name="save" />  平台文档补充「本地数据架构」子目录自动创建说明：首次授权 / 重新授权 / 切换文件夹时自动建立 data/attachments/backups/exports/ 子目录\n' +
      '• <AppIcon name="bookmark" />  版本号升至 5.0.101'
    )
  }
  if (!versions.includes('5.0.100')) {
    settingsStore.addChangelog('5.0.100',
      '• <AppIcon name="plus-circle" />  大版本升级至 5.0.100\n' +
      '• <AppIcon name="tag" />  浏览器标签标题简化为「研究生工作台」，并新增平台 LOGO（favicon）\n' +
      '• <AppIcon name="file-text" />  科研中心新增「研究助手」子模块：选题收窄向导、文献综述模板、论文阶段流水线、引用自检清单\n' +
      '• <AppIcon name="message-square" />  导师应答助手新增学术专用场景：选题收窄、模拟审稿、数据来源质疑核查\n' +
      '• <AppIcon name="save" />  本地数据架构规范化：存储文件夹自动建立 data/attachments/backups/exports/ 子目录与 meta.json 元信息，并自动迁移旧版根目录数据\n' +
      '• <AppIcon name="pin" />  新增右侧 Guidance Panel：展示今日待读文献、高优先级计划、导师最近留言、消息中心与当前页面操作提示'
    )
  }
  if (!versions.includes('3.2.133')) {
    settingsStore.addChangelog('3.2.133',
      '• <AppIcon name="pen-tool" />  头像下拉菜单再向右微调：在保持文字一行四字与图标的前提下，减小头像区右侧外边距，让头像更靠近右边界且仍居中于菜单\n' +
      '• <AppIcon name="monitor" />  统一弹窗标题栏：「版本更新记录」「操作日志」「计划任务临近提醒」「消息中心」标题、按钮、关闭按钮统一使用 modal-header 布局并垂直居中对齐\n' +
      '• <AppIcon name="link" />  平台文档「开源依赖与致谢」为 Vue/Vite/Pinia/Vue Router/ECharts/dayjs 等项目补充官方仓库/文档链接'
    )
  }
  if (!versions.includes('3.2.132')) {
    settingsStore.addChangelog('3.2.132',
      '• <AppIcon name="pen-tool" />  头像下拉菜单位置再优化：缩短菜单宽度并拉近头像与右边缘距离，菜单仍以头像为中点居中\n' +
      '• <AppIcon name="monitor" />  「关于平台」弹窗移除底部「关闭」按钮，原「查看更新记录/查看操作日志」更名为「版本记录/操作日志」并保持居中\n' +
      '• <AppIcon name="book" />  平台文档新增「开源依赖与致谢」章节，标注 Vue/Vite/Pinia/Vue Router/ECharts/dayjs 等开源组件来源（自研模块同步注明）\n' +
      '• <AppIcon name="bell" />  消息中心标题栏「消息中心 / 全部已读 / 关闭」三者改为同一行齐平对齐；排查其余弹窗确认一致\n' +
      '• <AppIcon name="calendar" />  重写计划提醒逻辑：计划结束日期（仅年月日）距今剩 10 天 → 消息中心橙色提醒；剩 3 天 → 红色提醒；未读小红点保持不变\n' +
      '• <AppIcon name="palette" />  论文管理各状态颜色改为更鲜艳明快的配色\n' +
      '• <AppIcon name="wrench" />  统一编辑/删除图标：论文管理行内操作按钮改为与计划中心一致的 SVG 线性图标'
    )
  }
  if (!versions.includes('3.2.131')) {
    settingsStore.addChangelog('3.2.131',
      '• <AppIcon name="map-pin" />  优化状态栏头像下拉菜单位置，菜单以头像为中点水平居中，头像位于下拉菜单正中间\n' +
      '• <AppIcon name="monitor" />  同步微调头像与右侧间距，避免下拉菜单贴近或溢出屏幕右缘'
    )
  }
  if (!versions.includes('3.2.130')) {
    settingsStore.addChangelog('3.2.130',
      '• <AppIcon name="monitor" />  头像下拉菜单恢复为原下拉形式；点击「个人信息」改为弹出与「关于平台」风格一致的居中弹窗\n' +
      '• <AppIcon name="scroll-text" />  将「更新记录」和「操作日志」入口移入「关于平台」弹窗，侧边栏顶部工具栏移除对应按钮\n' +
      '• <AppIcon name="x-circle" />  移除左侧导航栏切换全显示/半显示的按钮，侧边栏保持固定展开状态'
    )
  }
  if (!versions.includes('3.2.129')) {
    settingsStore.addChangelog('3.2.129',
      '• <AppIcon name="monitor" />  顶部头像下拉菜单改为居中弹窗形式，与「关于平台」弹窗风格统一\n' +
      '• <AppIcon name="palette" />  版本更新记录每条前面增加对应图标，阅读更直观\n' +
      '• <AppIcon name="circle" />  统一所有弹窗右上角关闭按钮样式为圆形浅底 ×\n' +
      '• <AppIcon name="book" />  平台文档补充数据迁移说明：换电脑时可通过 JSON 备份/恢复或复制本地存储文件夹完成数据导入'
    )
  }
  if (!versions.includes('3.2.128')) {
    settingsStore.addChangelog('3.2.128',
      '• <AppIcon name="plus-circle" />  顶部头像下拉菜单新增「平台文档」入口，点击弹出平台说明弹窗\n' +
      '• <AppIcon name="palette" />  计划中心计划库操作列图标与论文中心论文库统一为 SVG 线性图标（编辑/删除）\n' +
      '• <AppIcon name="calendar" />  计划中心日历视图年份选择器加宽，「2026年」等年份文字完整显示，避免被遮挡\n' +
      '• <AppIcon name="book" />  新增平台文档：介绍平台定位、技术栈、功能模块与数据存储方式'
    )
  }
  if (!versions.includes('3.2.127')) {
    settingsStore.addChangelog('3.2.127',
      '• <AppIcon name="file-text" />  科研中心论文管理：状态新增「想法」（最靠前），添加/编辑论文时日期按所选状态对应记录（如选「想法」记想法日期、选「草稿/修改中」记对应日期），其余信息可暂定\n' +
      '• <AppIcon name="scroll-text" />  科研中心论文：单击论文记录弹出「前世今生」详情窗口，以时间线展示论文在各状态下的日期与流转\n' +
      '• ↔️ 论文中心各子页面宽度与计划中心保持一致，横向几乎占满空间\n' +
      '• <AppIcon name="calendar" />  计划中心日历视图：新增年份 / 月份直接选择器，可一键跳转查看任意年月的计划'
    )
  }
  if (!versions.includes('3.2.126')) {
    settingsStore.addChangelog('3.2.126',
      '• <AppIcon name="plus-circle" />  新增屏幕自适应：自动识别屏幕大小，由大屏幕切换到小屏幕时内容自动优化排版（缩小内边距、收起侧边栏标签、顶栏与卡片重排），避免出现内容在显示器之外\n' +
      '• <AppIcon name="trash" />  删除 WebDAV 云端备份功能及后台管理对应模块，数据仅保存在本地（localStorage + 本地硬盘），彻底去除云端同步能力'
    )
  }
  if (!versions.includes('3.2.125')) {
    settingsStore.addChangelog('3.2.125',
      '• 右上角头像下拉菜单「个人信息」「后台管理」「关于平台」三项新增图标\n' +
      '• 顶部状态栏日期显示周几改为中文（如 周五），去除英文缩写\n' +
      '• 顶部状态栏日期与消息中心图标间距拉近，视觉更紧凑\n' +
      '• 修复 WebDAV 同步（方案B）：代理模式下前端已正确携带账号鉴权头，并修正 CORS 代理教程中的 Worker 代码（预检先行、非写入方法不带 body），云端版可正常连接/备份/恢复'
    )
  }
  if (!versions.includes('3.2.119')) {
    settingsStore.addChangelog('3.2.119',
      '• <AppIcon name="plus-circle" />  主页面「本周计划」改为周历网格样式：周日到周六横向排列，日期数字置顶，今日日期高亮蓝色圆底，任务以分类彩色药丸展示在对应日期下方\n' +
      '• <AppIcon name="plus-circle" />  主页面「计划中心状态占比」从堆叠条升级为与计划中心一致的 ECharts 环形图（圆弧 45%-72%），联动实时数据\n' +
      '• <AppIcon name="plus-circle" />  主页面本周计划点击任务仅弹出详情窗口，右上角保留「前往任务中心」按钮跳转计划中心'
    )
  }
  if (!versions.includes('3.2.118')) {
    settingsStore.addChangelog('3.2.118',
      '• <AppIcon name="plus-circle" />  科研中心顶部导航栏升级为与计划中心一致的居中胶囊样式（蓝色选中态白字高亮）\n' +
      '• <AppIcon name="plus-circle" />  更新日志记录中的 NEW 标志改为彩色胶囊徽章，更醒目美观\n' +
      '• <AppIcon name="plus-circle" />  主页面「本周计划」改为精简的周一到周五任务清单：去掉时间段，点击任务弹窗查看详情，新增「前往任务中心」按钮跳转计划中心\n' +
      '• <AppIcon name="plus-circle" />  主界面右侧「极速闪念捕捉」精简为单一蓝色按钮（去除多余留白）；「今日待办」替换为「计划中心状态占比」，实时联动计划数据'
    )
  }
  if (!versions.includes('3.2.117')) {
    settingsStore.addChangelog('3.2.117',
      '• <AppIcon name="plus-circle" />  计划中心总览统计卡片支持单击查看明细：点击「总任务/已完成/未完成/已逾期/今日需完成/本周新增」任意卡片，弹出对应计划列表，含状态标签与截止日期，点击条目可直接编辑\n' +
      '• <AppIcon name="plus-circle" />  主页面布局改版：删除「组会概览」，原位置替换为「本周计划」周日历视图（数据关联计划中心）；「今日待办」移动至「极速闪念捕捉」下方，左侧周日历高度撑满与右侧今日待办底部对齐\n' +
      '• <AppIcon name="plus-circle" />  论文中心顶部导航栏升级为与计划中心一致的居中胶囊样式（蓝色选中态白字高亮）'
    )
  }
  if (!versions.includes('3.2.116')) {
    settingsStore.addChangelog('3.2.116',
      '• <AppIcon name="plus-circle" />  删除独立「日历视图」页面，将日历功能集中到计划中心，新增「日历视图」Tab，与总览、计划库并列\n' +
      '• <AppIcon name="plus-circle" />  计划中心日历支持月视图、年视图、周视图、多周视图（2周）四种模式，数据直接关联计划库中的计划\n' +
      '• <AppIcon name="plus-circle" />  计划库已完成任务不再显示删除线，保持表格清爽可读\n' +
      '• <AppIcon name="plus-circle" />  后台管理颜色选择器弹窗增加 viewport 边界检测，自动翻转避免超出窗口\n' +
      '• <AppIcon name="plus-circle" />  后台管理模块拖拽排序恢复：仅左上角 ☰ 手柄可触发拖动，点击模块文字不移动\n' +
      '• <AppIcon name="plus-circle" />  左侧导航栏主页面图标与下方导航图标垂直对齐'
    )
  }
  if (!versions.includes('3.2.115')) {
    settingsStore.addChangelog('3.2.115',
      '• 更新日志统一加上 <AppIcon name="plus-circle" />  前缀，功能更新更醒目\n' +
      '• 计划库编号全面修复：所有计划按固定序号 1/2/3… 显示，旧数据自动补号；状态/分类/层级/优先级列改为可点击切换，操作体验和论文中心一致\n' +
      '• 计划状态/分类/层级/优先级切换弹窗文字居中显示\n' +
      '• 后台管理模块拖拽优化：只有按住左上角 ☰ 手柄时才触发排序，点击模块其他区域不再误拖动\n' +
      '• 后台管理所有颜色选择器新增 Office 风格预设色板（主题色 + 标准色），保留自定义颜色入口\n' +
      '• 新增消息中心：顶部头像左侧铃铛图标，内置消息列表与已读/未读功能，未读消息显示红点\n' +
      '• 计划任务临近提醒：结束时间距今 ≤5 天的未完成任务，每天首次打开时强制弹窗提醒，并同步推送消息中心\n' +
      '• 修复若干交互细节'
    )
  }
  if (!versions.includes('3.2.112')) {
    settingsStore.addChangelog('3.2.112',
      '• WebDAV CORS 代理教程更新：Deno Deploy 停止新用户注册，改为推荐 Cloudflare Workers 免费方案\n' +
      '• Cloudflare Workers 代理代码完整给出，支持 123云盘、坚果云、Nextcloud 等常见 WebDAV 服务'
    )
  }
  if (!versions.includes('3.2.111')) {
    settingsStore.addChangelog('3.2.111',
      '• WebDAV 新增 CORS 代理支持：解决浏览器跨域限制导致无法直连的问题\n' +
      '• 设置页新增「CORS 代理地址」输入框，填写代理后所有请求通过代理转发\n' +
      '• 内置 CORS 代理部署教程（Deno Deploy / Node.js），一键部署免费代理'
    )
  }
  if (!versions.includes('3.1.124')) {
    settingsStore.addChangelog('3.1.124',
      '• 修复论文库表格序号在更新后出现重复的Bug：序号改用纯行号显示，不再与内部编码冲突\n' +
      '• 左侧导航栏主页图标重新绘制（Feather风格），视觉上与其他图标对齐更统一\n' +
      '• 去除添加文献弹窗的自动草稿恢复：解决添加完一篇文献后再点添加会误提示"上次未保存"的问题'
    )
  }
  if (!versions.includes('3.1.123')) {
    settingsStore.addChangelog('3.1.123',
      '• 论文笔记编辑器全面升级为所见即所得（WYSIWYG）模式：移除预览面板，输入区域直接渲染 HTML 格式，像 Word 一样编辑即所见'
    )
  }
  if (!versions.includes('3.1.122')) {
    settingsStore.addChangelog('3.1.122',
      '• 论文笔记工具栏全面按 Word 风格重绘：按钮改为带边框/背景的矩形样式，分组使用竖线分隔，关联文献与分类下拉与工具栏合并为一行\n' +
      '• 文字颜色与高亮颜色选择器升级为 Office 风格色板：包含自动色、主题色网格、标准色行、自定义颜色与其他颜色入口\n' +
      '• 论文笔记正式移除 Markdown 支持：改为 HTML 富文本格式，工具栏按钮直接插入对应 HTML 标签，编辑器与详情页按 HTML 渲染'
    )
  }
  if (!versions.includes('3.1.121')) {
    settingsStore.addChangelog('3.1.121',
      '• 论文库表格操作按钮图标全面优化：编辑/打开PDF/批注/删除四个按钮改为简洁 SVG 图标，消除重复的 <AppIcon name="pencil" />  图标\n' +
      '• 论文笔记工具栏参考 Word 风格重新设计：按钮有清晰的边框和背景色，视觉分组更明确，操作区更舒适\n' +
      '• 论文笔记文件夹支持展开/合并：点击箭头展开或收起子文件夹，未分类也支持此操作\n' +
      '• 新建文件夹和新建笔记按钮改为无底色图标样式，更简洁美观\n' +
      '• 论文中心总览最近笔记交互优化：单击弹出详情预览窗口，新增编辑按钮可跳转到笔记编辑窗口'
    )
  }
  if (!versions.includes('3.1.120')) {
    settingsStore.addChangelog('3.1.120',
      '• 全局弹窗交互优化：单击空白遮罩不再关闭弹窗，需双击空白或点击右上角 ✕ 按钮关闭，防止误触丢失数据\n' +
      '• 论文库表格支持鼠标滚轮横向滚动：鼠标放在表格区域滚动滚轮即可左右查看各列内容\n' +
      '• 论文笔记全面重构：左侧树状文件夹结构（支持新建/重命名/二级文件夹），右侧全高内容展示区，笔记管理更有序\n' +
      '• 笔记编辑器增强：工具栏新增文字颜色选择器；修复有序列表只显示 "1." 不递增的问题；工具栏改为图标化展示'
    )
  }
  if (!versions.includes('3.1.119')) {
    settingsStore.addChangelog('3.1.119',
      '• 论文库表格列支持自定义排序：后台管理 → 论文库配置 → 表格列显示，可通过拖拽调整列的显示顺序\n' +
      '• 修复更新日志格式：每条更新内容独立一行显示，阅读更清晰'
    )
  }
  if (!versions.includes('3.1.118')) {
    settingsStore.addChangelog('3.1.118',
      '• 修复：论文库状态下拉菜单改用 fixed 定位，彻底解决被表格 overflow 裁剪遮挡的问题\\n' +
      '• 修复：后台管理模块导航过滤掉无效条目，不再显示 raw key 名称（如 paper-form-fields）'
    )
  }
  if (!versions.includes('3.1.117')) {
    settingsStore.addChangelog('3.1.117',
      '• 后台管理面板再放宽，修改时间列完整显示，无需横向滚动\\n' +
      '• 论文库表格列宽进一步增加，更多字段直接可见\\n' +
      '• 论文中心总览重构：最近笔记独立整行卡片（展示标题+内容预览），状态占比与文献数据并排一行'
    )
  }
  if (!versions.includes('3.1.116')) {
    settingsStore.addChangelog('3.1.116',
      '• 后台管理面板宽度增加，数据资产管理中心文件列表不再出现竖排文字\\n' +
      '• 论文库表格列宽大幅增加，数据不再拥挤\\n' +
      '• 文献编号固定不变：添加文献后编号永久锁定，不受排序/筛选影响\\n' +
      '• 文献库排序增加升序/降序切换按钮\\n' +
      '• 修复：状态选择弹窗被遮挡问题，z-index 提升至最上层\\n' +
      '• 论文库搜索维度选项移至筛选行，与期刊/年份/状态同行多列展示，新增搜索刷新按钮\\n' +
      '• 论文中心总览：最近笔记与文献数据分离为独立模块卡片'
    )
  }
  if (!versions.includes('3.1.115')) {
    settingsStore.addChangelog('3.1.115',
      '• PDF 按钮拆分为「打开 PDF」（外部软件）和「平台批注」（内置阅读器）两个独立按钮\\n' +
      '• 论文库搜索新增维度选择：可限定标题/作者/期刊/单位/标签/DOI 范围搜索\\n' +
      '• 论文笔记交互优化：单击查看详情（只读弹窗），双击进入编辑模式\\n' +
      '• 导航栏切换性能优化：使用 keep-alive 缓存页面，消除切换延迟'
    )
  }
  if (!versions.includes('3.1.114')) {
    settingsStore.addChangelog('3.1.114',
      '• 修复 PDF 阅读器文本层选区重影问题：选中文本时不再显示重复文字\\n' +
      '• 翻译改为工具栏开关：开启后选中英文段落才弹出翻译浮窗\\n' +
      '• 高亮/下划线/删除线改为选中文字后弹出操作菜单，不再常驻工具栏\\n' +
      '• 批注支持删除：右键点击高亮/下划线/删除线即可删除\\n' +
      '• PDF 阅读器左侧新增缩略图栏，点击可快速跳转页面'
    )
  }
  // 更新记录按版本号倒序排列（最新版本在最上面）
  try { settingsStore.sortChangelog() } catch (e) { console.warn('[changelog] sortChangelog 失败:', e) }
  // 版本号：桌面端已在 onMounted 早期通过 getVersion() 同步真实版本号，
  // 这里不再从 changelog[0] 覆盖，避免覆盖 Tauri 真实版本号
  // （浏览器端 fallback 到 changelog[0]）
  if (!isTauri && settingsStore.changelog.length > 0) {
    settingsStore.appVersion = settingsStore.changelog[0].version
    try { save('appVersion', settingsStore.changelog[0].version) } catch (e) { console.warn('[changelog] 保存 appVersion 失败:', e) }
  }
  // 清理历史版本更新提醒：播种/数据恢复后只保留最新版本的一条推送，避免消息中心积压旧版本更新内容
  if (settingsStore.changelog.length > 0) {
    try { messageStore.pruneUpdateMessages(settingsStore.changelog[0].version) } catch (e) { console.warn('[changelog] pruneUpdateMessages 失败:', e) }
  }
  // 导航栏排序迁移：确保论文中心在科研中心之后
  if (!settingsStore.navOrder.includes('/papers')) {
    const idx = settingsStore.navOrder.indexOf('/research')
    const insertAt = idx >= 0 ? idx + 1 : settingsStore.navOrder.length
    const newOrder = [...settingsStore.navOrder]
    newOrder.splice(insertAt, 0, '/papers')
    settingsStore.navOrder = newOrder
    save('navOrder', newOrder)
  }
  // 导航栏迁移：确保仿真中心在科研中心之后、论文中心之前（老用户 localStorage 中可能缺失）
  if (!settingsStore.navOrder.includes('/simulation')) {
    const idx = settingsStore.navOrder.indexOf('/research')
    const insertAt = idx >= 0 ? idx + 1 : settingsStore.navOrder.length
    const newOrder = [...settingsStore.navOrder]
    newOrder.splice(insertAt, 0, '/simulation')
    settingsStore.navOrder = newOrder
    save('navOrder', newOrder)
  }
  // 导航栏迁移：移除已删除的日历视图入口
  if (settingsStore.navOrder.includes('/calendar')) {
    const newOrder = settingsStore.navOrder.filter(p => p !== '/calendar')
    settingsStore.navOrder = newOrder
    save('navOrder', newOrder)
  }
  // 导航栏迁移：确保平台设置在科研导航之后
  if (!settingsStore.navOrder.includes('/settings')) {
    const idx = settingsStore.navOrder.indexOf('/navigation')
    const insertAt = idx >= 0 ? idx + 1 : settingsStore.navOrder.length
    const newOrder = [...settingsStore.navOrder]
    newOrder.splice(insertAt, 0, '/settings')
    settingsStore.navOrder = newOrder
    save('navOrder', newOrder)
  }
  // 导航栏迁移：确保财务中心在科研导航之后、平台设置之前
  if (!settingsStore.navOrder.includes('/finance')) {
    const idx = settingsStore.navOrder.indexOf('/navigation')
    const insertAt = idx >= 0 ? idx + 1 : settingsStore.navOrder.length
    const newOrder = [...settingsStore.navOrder]
    newOrder.splice(insertAt, 0, '/finance')
    settingsStore.navOrder = newOrder
    save('navOrder', newOrder)
  }

  // 计划编号迁移：为旧数据中没有 seq 的计划补发固定序号
  if (planStore.plans.some(p => !p.seq)) {
    const sorted = [...planStore.plans].sort((a, b) => {
      const ta = String(a.acceptTime || a.createdAt || '')
      const tb = String(b.acceptTime || b.createdAt || '')
      return ta.localeCompare(tb)
    })
    let next = planStore.nextSeq
    sorted.forEach(p => {
      if (!p.seq) {
        p.seq = next
        next++
      }
    })
    planStore.nextSeq = next
    save('planNextSeq', next)
    save('plans', planStore.plans)
  }
  // 子任务数据迁移：将旧字符串 subtasks 迁移为 {text, color, date} 对象
  let needSubtaskMigrate = false
  planStore.plans.forEach(p => {
    if (Array.isArray(p.subtasks) && p.subtasks.some(s => typeof s === 'string' || (s && s.date === undefined))) {
      p.subtasks = p.subtasks.map(s => {
        if (typeof s === 'string') return { text: s, color: '', date: '' }
        return { text: s.text || '', color: s.color || '', date: s.date || '' }
      })
      needSubtaskMigrate = true
    }
  })
  if (needSubtaskMigrate) save('plans', planStore.plans)
  // 初始化本地文件存储（不触发 sync/reload，因为 save() 本身就是双写）
  const fsInit = isElectron ? _eInit : _fsInit
  fsInit().then(async result => {
    if (result === 'prompt') {
      storageFolderName.value = isElectron ? _eGetFolderName() : _fsGetFolderName()
      needsStorageRegrant.value = true
    }
    // 未绑定本地文件夹 → 显示提示条（数据仅存浏览器缓存有丢失风险）
    showFileStorageHint.value = !isFileStorageActive() && !needsStorageRegrant.value
    // 文件存储已激活（含 Tauri 自动默认目录）：先把 localStorage 全量迁移到本地文件，
    // 确保旧数据（曾仅存于 WebView2 缓存）一次性落盘，之后由 save() 双写保持同步。
    if (isFileStorageActive()) {
      try {
        const migrated = await migrateToFileStorage()
        if (migrated > 0) console.log('[fileStorage] 已全量迁移 localStorage 数据到本地文件，共', migrated, '个模块')
      } catch (e) {
        console.warn('[fileStorage] 全量迁移失败（不影响后续双写）:', e)
      }
    }
    // 启动智能合并：文件(主存储)与缓存(渲染镜像)双向取更全的一侧，任何一侧损坏不拖累另一侧
    if (isFileStorageActive()) {
      try {
        const { pulled } = await reconcileWithFileStorage()
        if (pulled > 0) {
          // 防刷新死循环：检查 reloadGuard
          let canReload = true
          try {
            const reloadCount = parseInt(sessionStorage.getItem('mw_reloadGuard') || '0', 10)
            if (reloadCount >= 2) {
              canReload = false
              console.warn('[reconcile] 已达到本会话最大自动刷新次数，跳过 reload（pulled=' + pulled + '）')
              sessionStorage.removeItem('mw_reloadGuard')
            }
          } catch {}
          if (canReload) {
            console.log('[reconcile] 已从本地文件夹回灌', pulled, '个模块到缓存，刷新页面生效')
            window.location.reload()
          }
        } else {
          // reconcile 无需刷新 → 清除 reloadGuard
          try { sessionStorage.removeItem('mw_reloadGuard') } catch {}
        }
      } catch (e) {
        console.warn('[reconcile] 智能合并失败:', e)
      }
    }
  })

  // 初始化自动备份存储（恢复上次授权的备份文件夹）
  const backupInit = isElectron ? _eBackupInit : _fsBackupInit
  backupInit()

  // 检查计划任务临近提醒（每次登录都检查，同一天同一任务只发一条消息）
  checkPlanDeadlines()
  // 论文稿件滞留 + 文献阅读超时提醒（每次打开都检查，内部按 msgId 去重）
  checkPaperStagnation()
  checkReadingTimeout()
  // 每日底线任务 + 每周总结提醒
  checkDailyCheckin()
  checkWeeklySummary()
  // 信息库到期提醒（订阅/团购/卡证）
  checkInfoExpiry()


  // 桌面版自动检查更新（延迟 3 秒，避免启动期网络拥挤）
  if (isTauri) {
    setTimeout(() => { checkForUpdate() }, 3000)
  }
})

function closeMorningPopup() {
  showMorningPopup.value = false
  settingsStore.markMorningPopupShown()
}

async function regrantStorage() {
  const ok = isElectron ? true : await _fsRegrant()
  if (ok) {
    needsStorageRegrant.value = false
    // 权限恢复 → 从文件同步最新数据
    const count = await syncFromFileStorage()
    if (count > 0) {
      window.location.reload()
    }
  } else {
    alert('授权失败，请重新选择文件夹或检查浏览器设置。')
    needsStorageRegrant.value = false
  }
}

function goSettings() {
  route.router.push('/settings')
}

// 点击页面其他区域关闭头像下拉菜单和日期选择弹窗
function onPageClick(e) {
  if (showLogoutMenu.value && !e.target.closest('.avatar-area')) {
    showLogoutMenu.value = false
  }
  if (showDatePicker.value && !e.target.closest('.date-area')) {
    showDatePicker.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', onPageClick)
  nextTick(() => {
    if (platformDocBodyRef.value) {
      docMutationObserver = new MutationObserver(() => refreshDocToc())
      docMutationObserver.observe(platformDocBodyRef.value, { childList: true, subtree: true })
    }
  })
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onPageClick)
  if (docScrollObserver) docScrollObserver.disconnect()
  if (docMutationObserver) docMutationObserver.disconnect()
})
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100%;
  position: relative;
  z-index: 0;
}

/* 背景图：覆盖状态栏以下所有区域 */
.bg-image {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  top: 56px;
  z-index: -1;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
}

.bg-overlay {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: rgba(248, 249, 251, 0.85);
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--color-nav-bg, var(--color-bg));
  border-right: none;
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal);
  overflow: hidden;
  flex-shrink: 0;
}
.sidebar.pinned {
  width: max-content;
}

/* ===== 悬浮岛式导航 ===== */
/* 悬浮岛模式下，top-bar 绝对定位横跨全宽（覆盖侧边栏上方），侧边栏顶部留出 56px 空间 */
.app-container.floating-nav {
  position: relative;
}
.app-container.floating-nav .top-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 30;
}
/* 悬浮岛模式：top-bar 绝对定位脱离文档流，main-content 需留出 56px 顶部空间避免内容被遮挡 */
.app-container.floating-nav .main-content {
  padding-top: 56px;
}
.sidebar.nav-floating {
  background: var(--color-bg-card); /* 白色，与主页面内容区一致 */
  width: auto;
  padding: 56px 0 12px 16px;        /* 顶部 56px 留给 top-bar 覆盖 */
  overflow: visible;
  position: relative;
  z-index: 20;
  justify-content: center; /* 垂直居中 */
}
.sidebar.nav-floating .sidebar-nav {
  background: rgba(248, 249, 251, 0.92); /* 浅灰半透明，在白色侧栏背景上有层次感 */
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 18px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.55);
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
  width: auto;
  min-width: 62px;
  flex: 0 0 auto;          /* 高度由内容决定（8个导航项 + 留白），不撑满全屏 */
  max-height: none;
  overflow: visible;
}
.sidebar.nav-floating .sidebar-nav::-webkit-scrollbar { width: 4px; }
.sidebar.nav-floating .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }
.sidebar.nav-floating .nav-item {
  justify-content: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  transition: all var(--transition-fast);
}
.sidebar.nav-floating .nav-item:hover {
  background: rgba(59, 130, 246, 0.10);
  color: var(--color-primary);
}
.sidebar.nav-floating .nav-item.active {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.30);
}
.sidebar.nav-floating .nav-icon {
  width: 22px;
  height: 22px;
}
.sidebar.nav-floating .nav-label {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
}
/* 悬浮岛在窄屏时只显示图标 */
@media (max-width: 1100px) {
  .sidebar.nav-floating .nav-label { display: none; }
  .sidebar.nav-floating .sidebar-nav { min-width: 54px; padding: 14px 8px; }
  .sidebar.nav-floating .nav-item { justify-content: center; padding: 10px; }
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 10px 16px 10px 14px;
  border-radius: var(--radius-md);
  color: var(--color-nav-text-secondary, var(--color-text-secondary));
  text-decoration: none;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.nav-item:hover { background: var(--color-nav-hover-bg, var(--color-bg-hover)); color: var(--color-nav-text, var(--color-text-primary)); }
.nav-item.active { background: var(--color-nav-active-bg, var(--color-primary-bg)); color: var(--color-nav-active-text, var(--color-primary)); }
.nav-icon {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 20px; flex-shrink: 0;
  color: currentColor;
}
.nav-icon svg { color: currentColor; }
.nav-label { font-size: 14px; font-weight: 500; }

/* 侧边栏底部品牌区 */
.sidebar-bottom-brand {
  padding: 12px 8px;
  border-top: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.sidebar-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}
.sidebar-logo:hover { opacity: 1; }
.sidebar-brand-text {
  font-size: 11px;
  color: var(--color-nav-text-tertiary, var(--color-text-tertiary));
  white-space: nowrap;
  font-family: 'SimSun', '宋体', serif;
  font-weight: 400;
  letter-spacing: 1px;
}
.sidebar-version {
  font-size: 10px;
  color: var(--color-nav-text-tertiary, var(--color-text-tertiary));
  white-space: nowrap;
  font-family: var(--font-mono);
}
.sidebar-version.clickable {
  cursor: pointer;
  transition: color var(--transition-fast);
}
.sidebar-version.clickable:hover {
  color: var(--color-nav-text, var(--color-text-primary));
  text-decoration: underline;
}
/* 日志表格 */
.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.log-table th {
  text-align: left;
  padding: 8px 12px;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-weight: 600;
  border-bottom: 2px solid var(--color-border);
  position: sticky;
  top: 0;
}
.log-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
}
.log-table tr:hover td {
  background: var(--color-bg-hover);
}
.log-id {
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  font-size: 12px;
  text-align: center;
}
.log-time {
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.log-action {
  color: var(--color-text-primary);
}

/* 更新记录 */
.changelog-timeline {
  position: relative;
  padding-left: 24px;
}
.changelog-timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-border);
}
.changelog-item {
  position: relative;
  margin-bottom: 20px;
}
.changelog-item:last-child { margin-bottom: 0; }
.changelog-dot {
  position: absolute;
  left: -18px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-border);
  border: 2px solid var(--color-bg);
  z-index: 1;
}
.changelog-dot.latest {
  background: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.changelog-body { padding-left: 4px; }
.changelog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.changelog-version {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
  font-family: var(--font-mono);
}
.changelog-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.changelog-content {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  white-space: pre-line;
}

/* 版本更新记录编辑按钮 */
.btn-edit-changelog {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm, 6px);
  background: var(--color-bg);
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  transition: all .15s;
  height: 32px;
}
.btn-edit-changelog:hover {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg));
  border-color: var(--color-primary);
}
.btn-save-changelog {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.btn-save-changelog:hover {
  background: var(--color-primary-dark, #1d4ed8);
  border-color: var(--color-primary-dark, #1d4ed8);
}

/* 编辑模式下时间输入框 */
.changelog-time-edit {
  display: inline-block;
  width: 150px;
  padding: 2px 6px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  font-size: 11px;
  font-family: var(--font-mono, 'Consolas', monospace);
  color: var(--color-text-primary);
  background: var(--color-bg);
  outline: none;
  line-height: 1.4;
}
.new-badge {
  display: inline-block;
  padding: 1px 7px;
  margin-right: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: #fff;
  background: linear-gradient(135deg, #FF2E2E 0%, #FF6B6B 50%, #FF2E2E 100%);
  background-size: 200% 200%;
  border-radius: 6px;
  vertical-align: middle;
  box-shadow: 0 0 8px rgba(255, 46, 46, 0.55), 0 1px 4px rgba(255, 46, 46, 0.35);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-transform: uppercase;
  animation: new-badge-shine 1.6s ease-in-out infinite, new-badge-pulse 1.1s ease-in-out infinite;
}
@keyframes new-badge-shine {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes new-badge-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(255, 46, 46, 0.55); }
  50% { transform: scale(1.08); box-shadow: 0 0 14px rgba(255, 46, 46, 0.85); }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  height: 56px;
  background: var(--color-nav-bg, var(--color-bg));
  border-bottom: none;
  display: grid;
  position: relative;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 24px;
  flex-shrink: 0;
}
.top-bar.has-floating-brand {
  padding: 0 20px;
}

/* ===== 顶部状态栏效果：毛玻璃模式 ===== */
.app-container.topbar-frosted.has-bg-image .bg-image,
.app-container.topbar-float.has-bg-image .bg-image {
  top: 0;
}
/* 毛玻璃模式：半透明 + blur + 渐变融合带 */
.app-container.topbar-frosted .top-bar {
  background: rgba(255, 255, 255, var(--topbar-opacity, 0.78)) !important;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.app-container.topbar-frosted .top-bar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(-24px * (1 - var(--topbar-opacity, 0.78)));
  height: calc(24px * (1 - var(--topbar-opacity, 0.78)) + 12px);
  background: linear-gradient(to bottom, rgba(255, 255, 255, var(--topbar-opacity, 0.78)), rgba(255, 255, 255, 0));
  pointer-events: none;
  z-index: 0;
}

/* ===== 顶部状态栏效果：融合态 ===== */
.app-container.topbar-float .top-bar {
  background: transparent !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.app-container.topbar-float .top-bar::after {
  display: none;
}

.top-bar-left {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}
/* 悬浮岛式：顶部状态栏左侧品牌区 — Logo 最左，品牌整体垂直居中，标题始终在状态栏左右居中 */
.topbar-brand {
  grid-column: 1;
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}
.topbar-brand:hover { background: var(--color-nav-hover-bg, var(--color-bg-hover)); }
.topbar-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
}
.topbar-brand-side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
}
.topbar-brand-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-nav-text, var(--color-text-primary));
  white-space: nowrap;
  font-family: 'SimSun', '宋体', serif;
  letter-spacing: 1px;
  line-height: 1.2;
}
.topbar-version {
  font-size: 11px;
  color: var(--color-nav-text-tertiary, var(--color-text-tertiary));
  white-space: nowrap;
  font-family: var(--font-mono);
  padding: 1px 7px;
  border-radius: 20px;
  background: var(--color-nav-hover-bg, var(--color-bg-hover));
  line-height: 1.2;
}
.topbar-version.clickable {
  cursor: pointer;
  transition: color var(--transition-fast);
}
.topbar-version.clickable:hover {
  color: var(--color-nav-text, var(--color-text-primary));
  text-decoration: underline;
}
.top-bar-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-nav-text, var(--color-text-primary));
  white-space: nowrap;
}
.top-bar-right { grid-column: 3; justify-self: end; display: flex; align-items: center; gap: 20px; padding-right: 0; }

/* 窗口控制按钮（桌面端无边框窗口） */
.window-controls { display: flex; align-items: center; gap: 8px; margin-left: 16px; padding-left: 16px; border-left: 1px solid var(--color-nav-border, rgba(0,0,0,0.06)); -webkit-app-region: no-drag; }
.window-ctrl-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: var(--radius-md); background: transparent; color: var(--color-nav-text, var(--color-text-secondary)); cursor: pointer; transition: all var(--transition-fast); }
.window-ctrl-btn:hover { background: rgba(0,0,0,0.06); }
.window-close-btn:hover { background: #FEF3F2; color: #EF4444; }
/* top-bar 子元素取消拖拽，确保可点击 */
.top-bar .topbar-brand, .top-bar .date-area, .top-bar .message-center-btn, .top-bar .avatar-area, .top-bar button, .top-bar input, .top-bar select, .top-bar a { -webkit-app-region: no-drag; }
.status-item { display: flex; align-items: center; gap: 4px; }
.status-label { font-size: 12px; color: var(--color-nav-text-tertiary, var(--color-text-tertiary)); }
.status-value { font-size: 14px; font-weight: 600; color: var(--color-nav-text, var(--color-text-primary)); }

.date-area {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  position: relative;
}
.date-area:hover { background: var(--color-nav-hover-bg, var(--color-bg-hover)); }
.date-area .status-item { display: flex; align-items: center; gap: 4px; }
.date-area .status-label { font-size: 12px; color: var(--color-nav-text-tertiary, var(--color-text-tertiary)); }
.date-area .status-value { font-size: 14px; font-weight: 600; color: var(--color-nav-text, var(--color-text-primary)); }
.date-arrow {
  font-size: 10px;
  color: var(--color-nav-text-tertiary, var(--color-text-tertiary));
  transition: transform var(--transition-fast);
  margin-left: -6px;
}
.date-arrow.open { transform: rotate(180deg); }

.date-picker-popup {
  position: absolute;
  top: calc(100% + 8px);
  right: auto;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  padding: 16px;
  z-index: 100;
  min-width: 270px;
}
.date-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.date-reset-btn {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.date-reset-btn:hover { background: var(--color-primary-bg); }

/* 月视图日历 */
.month-calendar { margin-bottom: 12px; }
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.month-nav-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 14px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.month-nav-btn:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }
.month-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 4px;
}
.weekday-cell {
  font-size: 11px;
  color: var(--color-text-tertiary);
  padding: 4px 0;
  font-weight: 500;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.calendar-day {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.calendar-day:hover:not(:disabled) { background: var(--color-primary-bg); }
.calendar-day.is-today {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 700;
  border: 1px solid var(--color-primary);
}
.calendar-day.is-selected {
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
}
.calendar-day.is-selected.is-today { border-color: transparent; }
.calendar-day.is-other-month { color: var(--color-text-tertiary); opacity: 0.3; }
.calendar-day.is-empty { cursor: default; }

/* 自定义周数 */
.week-custom-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}
.week-label { font-size: 13px; color: var(--color-text-secondary); font-weight: 500; }
.week-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.week-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 16px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.week-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.week-input {
  width: 48px;
  height: 28px;
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  outline: none;
  font-family: inherit;
}
.week-input:focus { border-color: var(--color-primary); }
/* remove old date-picker-input */
.date-picker-input { display: none; }
/* 消息中心 */
.message-center-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-left: -8px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-nav-text, var(--color-text-secondary));
  cursor: pointer;
  transition: background var(--transition-fast);
}
.message-center-btn:hover { background: var(--color-nav-hover-bg, rgba(0,0,0,0.05)); }
.message-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #EF4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.message-list { display: flex; flex-direction: column; gap: 8px; }
/* 分类筛选 */
.msg-tabs {
  display: flex;
  gap: 2px;
  margin: 14px 0 12px;
  border-bottom: 1px solid var(--color-border-light);
}
.msg-tab {
  padding: 7px 14px;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.msg-tab:hover { color: var(--color-text-primary); }
.msg-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 600; }
.msg-tab-count { font-size: 11px; margin-left: 5px; opacity: .7; }
/* 消息卡片：去掉边框颜色，背景与消息框融合 */
.message-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--color-surface, rgba(255,255,255,0.85));
  border: 1px solid var(--color-border-light, rgba(0,0,0,0.06));
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.message-item:hover { background: var(--color-bg-hover); border-color: var(--color-border, rgba(0,0,0,0.1)); }
.message-item.unread { background: var(--color-surface, rgba(255,255,255,0.92)); border-color: var(--color-primary-bg, rgba(59,130,246,0.15)); }
/* 消息卡片按类型着色（均为淡色底，不刺眼） */
.message-item.msg-bg-red { background: #FFF1F0; border-color: #FFCCC7; }
.message-item.msg-bg-orange { background: #FFF7E6; border-color: #FFD591; }
.message-item.msg-bg-info { background: #E6F4FF; border-color: #BAE0FF; }
.message-item.msg-bg-purple { background: #F5F0FF; border-color: #D3C5FF; }
.message-item.msg-bg-deepred { background: #FFE0DE; border-color: #FF9999; }
.message-item.msg-bg-red:hover { background: #FFE7E5; }
.message-item.msg-bg-orange:hover { background: #FFEFCD; }
.message-item.msg-bg-info:hover { background: #D6E8FF; }
.message-item.msg-bg-purple:hover { background: #EDE5FF; }
.message-item.msg-bg-deepred:hover { background: #FFD4D1; }
.message-item.unread.msg-bg-red { background: #FFE8E6; }
.message-item.unread.msg-bg-orange { background: #FFF0D9; }
.message-item.unread.msg-bg-info { background: #D1E7FF; }
.message-item.unread.msg-bg-purple { background: #E8DEFF; }
.message-item.unread.msg-bg-deepred { background: #FFD1CE; }
/* 类型图标：无底色，与消息框融为一体 */
.message-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  background: transparent;
  flex-shrink: 0;
  margin-top: 1px;
}
.message-main { flex: 1; min-width: 0; }
.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 8px;
}
.message-title {
  font-weight: 600;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  flex-shrink: 0;
  box-shadow: 0 0 0 2px var(--color-danger-bg);
}
.message-time { font-size: 11px; color: var(--color-text-tertiary); flex-shrink: 0; }
.message-content {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.message-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-top: 1px;
}
.message-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.message-action-btn:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }
.message-action-btn.message-action-danger:hover { background: var(--color-danger-bg); color: var(--color-danger); }
.message-action-btn.message-action-link { color: var(--color-primary); }
.message-action-btn.message-action-link:hover { background: var(--color-primary-bg); color: var(--color-primary); }
.msg-unread-badge {
  font-size: 12px;
  color: var(--color-danger);
  margin-left: 6px;
  font-weight: 500;
}
.msg-footer {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  border-top: 1px solid var(--color-border-light);
  margin-top: 10px;
}
.msg-footer-hint { font-size: 11px; color: var(--color-text-tertiary); }

/* 计划临近提醒 */
.deadline-list { display: flex; flex-direction: column; gap: 10px; }
.deadline-item {
  padding: 14px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-warning);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.deadline-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.deadline-seq {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  min-width: 32px;
}
.deadline-title {
  font-weight: 600;
  font-size: 14px;
}
.deadline-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.deadline-days {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-weight: 500;
}
.deadline-days.urgent {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
.deadline-days.warn {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

/* 登录头像 */
.avatar-area {
  position: relative;
  cursor: pointer;
  margin-left: 8px;
  margin-right: 0;
}
.avatar-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  user-select: none;
  overflow: hidden;
  transition: transform var(--transition-fast);
}
.avatar-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-area:hover .avatar-icon {
  transform: scale(1.05);
}
/* 关于平台弹窗 */
.about-modal {
  position: relative;
  width: 480px; max-width: calc(100vw - 32px); background: #fff;
  border-radius: var(--radius-lg, 16px); box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  overflow: hidden; animation: about-pop 0.22s ease;
  text-align: center; padding: 36px 32px 24px;
}
@keyframes about-pop {
  from { transform: translateY(12px) scale(0.97); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.about-close {
  position: absolute; top: 12px; right: 14px;
  border: none; background: var(--color-bg, #F4F6FB); color: var(--color-text-secondary); font-size: 16px; line-height: 1;
  width: 32px; height: 32px; border-radius: 50%; cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.about-close:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }
.about-logo-wrap {
  width: 88px; height: 88px; margin: 0 auto 16px;
  border-radius: 18px; background: var(--color-bg, #F4F6FB);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
.about-logo-img {
  width: 60px; height: 60px; object-fit: contain;
}
.about-title { margin: 0; font-size: 20px; font-weight: 700; color: var(--color-text-primary); }
.about-version {
  margin: 8px 0 0; font-size: 13px; color: var(--color-text-secondary);
}
.about-body { padding: 24px 0 6px; text-align: left; }
.about-desc { margin: 0 0 16px; font-size: 13px; line-height: 1.7; color: var(--color-text-secondary); }
.about-features { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.about-feature {
  display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-primary);
  background: var(--color-bg, #F4F6FB); border-radius: 10px; padding: 10px 12px;
}
.about-feature-icon { font-size: 15px; flex-shrink: 0; }
.about-actions {
  display: flex; justify-content: center; gap: 10px;
  padding: 6px 0 18px; border-bottom: 1px solid var(--color-border-light);
}
.about-footer {
  padding-top: 14px; font-size: 12px; color: var(--color-text-tertiary);
  text-align: center;
}

/* 平台文档弹窗 */
.platform-doc-modal {
  width: 840px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 48px);
  min-height: 460px;
  display: flex; flex-direction: column;
  padding: 32px 32px 24px;
}
.platform-doc-body {
  overflow-y: auto;
  flex: 1;
  padding: 4px 4px 8px 8px;
  text-align: left;
}
.doc-section { margin-bottom: 18px; }
.doc-section h4 {
  margin: 0 0 10px; font-size: 14px; font-weight: 600;
  color: var(--color-text-primary);
}
.doc-section p {
  margin: 0; font-size: 13px; line-height: 1.7;
  color: var(--color-text-secondary);
}
.doc-section ul {
  margin: 0; padding-left: 18px;
  font-size: 13px; line-height: 1.8;
  color: var(--color-text-secondary);
}
.doc-section li { margin-bottom: 4px; }
.doc-section strong { color: var(--color-text-primary); font-weight: 500; }
.doc-section:not(:last-child) {
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--color-border-light);
}
.doc-section code {
  background: var(--color-bg, #F4F6FB);
  border: 1px solid var(--color-border-light);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  color: var(--color-text-primary);
  word-break: break-all;
}
.doc-section pre {
  margin: 8px 0 0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  color: var(--color-text-primary);
  white-space: pre;
}
.doc-section pre code { background: none; border: none; padding: 0; }
.doc-section a { color: var(--color-primary); text-decoration: none; }
.doc-section a:hover { text-decoration: underline; }

/* 平台文档工具栏 */
.doc-toolbar {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 0 0 14px;
  border-bottom: 1px solid var(--color-border-light);
}

/* 平台文档左右布局 */
.platform-doc-layout {
  display: flex;
  gap: 16px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

/* 平台文档左侧目录 */
.doc-sidebar {
  width: 168px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border-light);
  padding: 16px 12px 16px 0;
  overflow-y: auto;
}
.doc-nav-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 10px;
  padding-left: 10px;
}
.doc-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.doc-nav a {
  display: block;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);
  border-left: 3px solid transparent;
}
.doc-nav a:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}
.doc-nav a.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-left-color: var(--color-primary);
  font-weight: 600;
}

/* 头像下拉菜单 */
.logout-menu {
  position: absolute;
  top: 42px;
  right: auto;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 12px;
  min-width: 172px;
  z-index: 200;
}
.logout-user {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  text-align: center;
}
.logout-session {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}
.logout-session .warn {
  color: var(--color-danger);
  font-weight: 600;
}
.menu-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  flex-shrink: 0;
}
.menu-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-primary);
}
.menu-divider {
  height: 1px;
  background: var(--color-border-light);
  margin: 4px 0;
}
.logout-btn {
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}
.logout-btn:hover {
  background: var(--color-danger);
  color: white;
}

/* 个人信息弹窗 */
.profile-modal {
  width: 520px; max-width: calc(100vw - 32px);
  padding: 32px 32px 24px;
}
.profile-body {
  text-align: left;
  padding: 20px 0 10px;
}
.profile-avatar-wrap {
  width: 80px; height: 80px; border-radius: 50%;
  background: var(--color-primary);
  color: white; font-size: 28px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; margin: 0 auto 20px;
  position: relative; cursor: pointer; transition: opacity var(--transition-fast);
}
.profile-avatar-wrap:hover { opacity: 0.85; }
.profile-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.profile-avatar-letter { font-size: 28px; font-weight: 600; }
.profile-avatar-hint {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 20px; background: rgba(0,0,0,0.3); color: white; opacity: 0;
  transition: opacity var(--transition-fast);
}
.profile-avatar-wrap:hover .profile-avatar-hint { opacity: 1; }
.profile-form .form-group { margin-bottom: 14px; }
.profile-form .form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 5px; color: var(--color-text-secondary); }
.profile-form .form-row { display: flex; gap: 12px; }
.profile-form .flex-1 { flex: 1; }

.status-value.highlight { color: var(--color-primary); }

.page-content {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg-card);
}

.storage-regrant-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  margin-bottom: 12px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  color: #92400e;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.storage-regrant-banner:hover {
  background: #fde68a;
}
.storage-hint-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  margin-bottom: 12px;
  background: #e0f2fe;
  border: 1px solid #38bdf8;
  border-radius: 8px;
  color: #075985;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.storage-hint-banner:hover {
  background: #bae6fd;
}
.storage-hint-arrow {
  flex-shrink: 0;
  font-weight: 600;
  white-space: nowrap;
}

/* 右侧面板移除后，page-content 恢复统一内边距 */
.page-content {
  padding: 10px 24px 24px;
}

/* 有背景图时：内容区透明以显示背景图 */
.app-container.has-bg-image .page-content {
  background: transparent;
}
.app-container.has-bg-image .main-content {
  background: transparent;
}
.app-container.has-bg-image .sidebar.nav-floating {
  background: transparent;
}
.app-container.has-bg-image .sidebar.nav-floating .sidebar-nav {
  background: rgba(255, 255, 255, var(--nav-opacity, 0.78));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
/* 非悬浮岛模式下有背景图时，侧边栏半透明 */
.app-container.has-bg-image:not(.floating-nav) .sidebar {
  background: var(--color-nav-bg, rgba(248, 249, 251, 0.82));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* 有背景图时：卡片半透明白色以保留可读性同时显示背景 */
.app-container.has-bg-image .card {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.app-container.has-bg-image .modal-content {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

@media (max-width: 1100px) {
  .page-content { padding-right: 24px; }
}

/* 手机端：单列、收窄内边距、弹窗自适应宽度 */
@media (max-width: 768px) {
  .page-content { padding: 14px 12px; }
  .modal-content {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
  }
  .about-features { grid-template-columns: 1fr; }
  .date-area { gap: 4px; }
}

/* ===== 自动更新弹窗 ===== */
.update-modal-body {
  margin-top: 16px;
}
.update-version-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.update-current-version {
  font-size: 15px;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.update-new-version {
  font-size: 18px;
  color: var(--color-primary);
  font-weight: 700;
}
.update-notes {
  background: var(--color-bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
}
.update-notes-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}
.update-notes-body {
  line-height: 1.6;
}
.update-progress-area {
  margin: 12px 0;
}
.update-progress-bar {
  width: 100%;
  height: 6px;
  background: var(--color-bg-secondary, #e9ecef);
  border-radius: 3px;
  overflow: hidden;
}
.update-progress-fill {
  height: 100%;
  background: var(--color-primary, #4f46e5);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.update-progress-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 8px;
  text-align: center;
}
.update-progress-hint {
  font-size: 12px;
  color: var(--color-primary, #4f46e5);
  margin-top: 6px;
  text-align: center;
  line-height: 1.5;
}
.update-download-done-text {
  font-size: 14px;
  color: var(--color-success, #22c55e);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  margin-bottom: 8px;
}
.update-download-hint {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
  text-align: center;
  line-height: 1.6;
  margin-bottom: 12px;
}
.update-error-text {
  color: var(--color-danger, #ef4444);
  font-size: 13px;
  margin: 8px 0;
  text-align: center;
}
.update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.update-checking-text {
  padding: 24px 0;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.update-checking-text svg {
  margin-right: 4px;
  color: var(--color-success, #22c55e);
}

</style>

<style>
/* ===== 二级导航栏（tab-bar）悬浮独立模块样式 ===== */
/* 与左侧悬浮导航栏（.sidebar.nav-floating .sidebar-nav）保持完全一致的视觉参数：
   同款毛玻璃背景、18px 圆角、阴影、边框、内边距；透明度由 --sub-nav-opacity 独立控制 */
/* 独立非 scoped 块：避免 scoped 选择器 .tab-pill[data-v-xxx] 附带 data-v 限定而无法命中子组件元素 */
.main-content .tab-bar {
  position: sticky !important;   /* 吸顶：页面滚动时二级导航栏固定在视口顶部下方，始终可见 */
  top: 0 !important;
  z-index: 30 !important;
  display: flex !important;
  justify-content: center !important;
  padding: 5px 0 2px !important; /* 上留白较之前减半，更贴近顶部状态栏 */
  margin-bottom: 8px !important;
}
.main-content .tab-pill {
  background: rgba(248, 249, 251, var(--sub-nav-opacity, 0.92)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 18px !important;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  padding: 9px 10px !important; /* 上下留白从 14px 减至 9px（约减 1/3），压缩整体高度 */
  gap: 4px !important;
}
.main-content .tab-pill .tab-btn {
  border-radius: 14px !important;
}
.main-content .tab-pill .tab-btn.active {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.30) !important;
}
/* 有背景图时：二级导航栏与左侧导航栏一样，用白底 + 透明度透出背景图 */
.app-container.has-bg-image .main-content .tab-pill {
  background: rgba(255, 255, 255, var(--sub-nav-opacity, 0.78)) !important;
}

/* ===== 内容区（tab-content）悬浮独立模块样式 ===== */
/* 仅在「毛玻璃」模式下生效：圆角+毛玻璃+阴影+透明度
   透明度由 --module-opacity 独立控制（默认 0.88）
   !important 覆盖各视图 scoped 样式中 .tab-content 的默认定义 */
.app-container.module-frosted .main-content .tab-content {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 18px !important;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  padding: 20px !important;
  margin-bottom: 14px !important;
}
/* 毛玻璃模式下：内容区内部 .card 透明化，避免「卡片套卡片」 */
.app-container.module-frosted .main-content .tab-content .card {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
/* 毛玻璃模式下：.stat-card 保留轻微底色以区分层级 */
.app-container.module-frosted .main-content .tab-content .stat-card {
  background: rgba(255, 255, 255, 0.5) !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
}

/* ===== 弹窗适配：毛玻璃模式下弹窗也半透明 ===== */
/* 毛玻璃模式下遮罩层极淡且不虚化背景，弹窗半透明后透出的是真实背景图而非灰色 */
.app-container.module-frosted .modal-overlay {
  background: rgba(0, 0, 0, 0.05) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
/* 弹窗透明度跟随模块透明度滑杆联动，比内容区稍高 0.07 保证可读性 */
.app-container.module-frosted .modal-content {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
.app-container.module-frosted .cell-picker {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* 顶部状态栏弹层：日期选择弹窗、头像下拉菜单 */
.app-container.module-frosted .date-picker-popup,
.app-container.module-frosted .logout-menu {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* 关于平台 / 平台文档 / 个人信息 弹窗 */
.app-container.module-frosted .about-modal {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}

/* ===== 各业务中心弹窗 / 浮层统一毛玻璃适配 ===== */
/* 通用导出下拉菜单 */
.app-container.module-frosted .export-menu {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* 消息中心卡片（与 save-bar 一致的毛玻璃效果） */
.app-container.module-frosted .message-item {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}
.app-container.module-frosted .message-item.msg-bg-red { background: rgba(255, 241, 240, var(--module-opacity, 0.88)) !important; }
.app-container.module-frosted .message-item.msg-bg-orange { background: rgba(255, 247, 230, var(--module-opacity, 0.88)) !important; }
.app-container.module-frosted .message-item.msg-bg-info { background: rgba(230, 244, 255, var(--module-opacity, 0.88)) !important; }
.app-container.module-frosted .message-item.msg-bg-purple { background: rgba(245, 240, 255, var(--module-opacity, 0.88)) !important; }
.app-container.module-frosted .message-item.msg-bg-deepred { background: rgba(255, 224, 222, var(--module-opacity, 0.88)) !important; }
.app-container.module-frosted .message-item.unread { background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important; }
/* 消息中心：unread + 类型组合 & hover 态 */
.app-container.module-frosted .message-item.unread.msg-bg-red { background: rgba(255, 232, 230, calc(var(--module-opacity, 0.88) + 0.07)) !important; }
.app-container.module-frosted .message-item.unread.msg-bg-orange { background: rgba(255, 240, 217, calc(var(--module-opacity, 0.88) + 0.07)) !important; }
.app-container.module-frosted .message-item.unread.msg-bg-info { background: rgba(209, 231, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important; }
.app-container.module-frosted .message-item.unread.msg-bg-purple { background: rgba(232, 222, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important; }
.app-container.module-frosted .message-item.unread.msg-bg-deepred { background: rgba(255, 209, 206, calc(var(--module-opacity, 0.88) + 0.07)) !important; }
.app-container.module-frosted .message-item.msg-bg-red:hover { background: rgba(255, 231, 229, calc(var(--module-opacity, 0.88) + 0.1)) !important; }
.app-container.module-frosted .message-item.msg-bg-orange:hover { background: rgba(255, 239, 205, calc(var(--module-opacity, 0.88) + 0.1)) !important; }
.app-container.module-frosted .message-item.msg-bg-info:hover { background: rgba(214, 232, 255, calc(var(--module-opacity, 0.88) + 0.1)) !important; }
.app-container.module-frosted .message-item.msg-bg-purple:hover { background: rgba(237, 229, 255, calc(var(--module-opacity, 0.88) + 0.1)) !important; }
.app-container.module-frosted .message-item.msg-bg-deepred:hover { background: rgba(255, 212, 209, calc(var(--module-opacity, 0.88) + 0.1)) !important; }
.app-container.module-frosted .message-item:hover { background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.1)) !important; }

/* 登录界面毛玻璃适配 */
.app-container.module-frosted .login-card {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.72) * 0.9)) !important;
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}
.app-container.module-frosted .login-page-mask {
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
  background: rgba(248, 249, 251, 0.25) !important;
}

/* 科研中心：论文卡片、组会纪要卡片、节点圆点、时间线圆点 */
.app-container.module-frosted .paper-item {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}
.app-container.module-frosted .meeting-item {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}
.app-container.module-frosted .milestone-marker {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}
.app-container.module-frosted .life-dot {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.75) !important;
}

/* 仿真中心：.sim-modal 弹窗、评价浮层、详情内层卡片 */
.app-container.module-frosted .sim-modal {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
.app-container.module-frosted .record-eval-popup {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
.app-container.module-frosted .record-card-head,
.app-container.module-frosted .record-block-text,
.app-container.module-frosted .record-software-chip {
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}
.app-container.module-frosted .record-block-result .record-block-content {
  background: linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.45)) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}

/* 论文中心：状态弹窗、标签建议、颜色面板、符号面板、公式弹窗 */
/* status-popup 已 Teleport 到 body，需同时匹配 .app-container 内和 body 上的规则 */
.app-container.module-frosted .status-popup,
body.module-frosted .status-popup,
.app-container.module-frosted .tag-suggest-panel,
.app-container.module-frosted .office-color-panel,
.app-container.module-frosted .symbol-panel,
.app-container.module-frosted .formula-modal {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* 论文中心弹窗内层：标签输入框、笔记正文、按钮等（保持可读性，半透明） */
.app-container.module-frosted .tag-input-wrap,
.app-container.module-frosted .note-editor-contenteditable,
.app-container.module-frosted .tree-rename-input,
.app-container.module-frosted .note-meta-select,
.app-container.module-frosted .wt-btn,
.app-container.module-frosted .fw-symbol-btn,
.app-container.module-frosted .fw-structure-btn {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
}
/* 公式弹窗左侧编辑区 */
.app-container.module-frosted .formula-modal-left {
  background: rgba(250, 250, 250, 0.65) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
}

/* 订阅中心：添加/编辑订阅弹窗 */
.app-container.module-frosted .sc-modal {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}

/* 计划中心：日历详情弹窗、导出菜单内部 */
.app-container.module-frosted .detail-modal {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}

/* 财务中心：类型切换选中、批量编辑区 */
.app-container.module-frosted .type-switch-btn.active {
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
}

/* ===== 计划中心每日打卡：毛玻璃适配 ===== */
/* 「计划底线库」顶部操作排：去除底色，直接显示在主页面模块上，边框微显避免融合 */
.app-container.module-frosted .daily-top-actions {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
}
/* 底线任务条目：半透明白底 + 可见边框，避免边界不清 */
.app-container.module-frosted .daily-task-item {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-left-width: 3px !important;
}
.app-container.module-frosted .daily-task-item:hover { background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important; }
/* 每日打卡展示框（今日总结/本周总结正文） */
.app-container.module-frosted .daily-display-box {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}
/* 周历格子（本周总结） */
.app-container.module-frosted .weekly-day-cell {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}
.app-container.module-frosted .weekly-day-cell.today { border-color: var(--color-primary) !important; }
/* 周统计块（目前无边界，补半透明白底 + 边框） */
.app-container.module-frosted .weekly-stat {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}
/* 进度条、切换按钮底同步半透明 */
.app-container.module-frosted .daily-progress-bar,
.app-container.module-frosted .view-switch-btn {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) - 0.3)) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}

/* ===== 信息预览 Dashboard：卡片适配毛玻璃（无 .tab-content 容器，单独覆盖） ===== */
.app-container.module-frosted .dashboard .card.section-card {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 18px !important;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05) !important;
}
/* 信息预览内层列表项 / 周历格子：半透明白 + 清晰边框 */
.app-container.module-frosted .dashboard .simple-item,
.app-container.module-frosted .dashboard .paper-mini-item,
.app-container.module-frosted .dashboard .meeting-compact-item,
.app-container.module-frosted .dashboard .week-calendar-day {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
}
.app-container.module-frosted .dashboard .simple-item:hover,
.app-container.module-frosted .dashboard .paper-mini-item:hover,
.app-container.module-frosted .dashboard .meeting-compact-item:hover {
  background: rgba(255, 255, 255, 0.65) !important;
}
.app-container.module-frosted .dashboard .week-calendar-day.today {
  border-color: var(--color-primary) !important;
}
/* Dashboard 弹窗（计划详情 / 编辑学业进度）由通用 .modal-content 覆盖，无需单独处理 */

/* ===== 平台设置页：三大模块卡片适配毛玻璃（无 .tab-content 容器，单独覆盖） ===== */
.app-container.module-frosted .settings-page .section-card {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 18px !important;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05) !important;
}
/* 平台设置保存栏同步毛玻璃 */
.app-container.module-frosted .settings-page .save-bar {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
.app-container.module-frosted .settings-page .save-bar.dirty {
  background: rgba(255, 244, 230, 0.88) !important;
}
/* 平台设置内部子块：浅灰底 → 半透明白 + 清晰边框 */
.app-container.module-frosted .settings-page .subsection-box,
.app-container.module-frosted .settings-page .theme-section {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(124, 58, 237, 0.15) !important;
}

/* ===== 计划中心：底线任务状态浮层毛玻璃适配 ===== */
.app-container.module-frosted .dt-state-menu {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.09)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}

/* ===== 全局原生 select 下拉框毛玻璃适配 ===== */
/* Plan.vue 已有局部适配，此处提升为全局，覆盖所有页面的 select.input / select.filter-select */
.app-container.module-frosted select.input,
.app-container.module-frosted select.filter-select,
.app-container.module-frosted select.filter-select-col,
.app-container.module-frosted select.note-meta-select,
.app-container.module-frosted select.cal-nav-select,
.app-container.module-frosted select.cal-view-select,
.app-container.module-frosted select.status-select,
.app-container.module-frosted select.input-sm,
.app-container.module-frosted select.batch-input {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}
/* 弹窗内的 select 也适配（modal-overlay 内的 select） */
.app-container.module-frosted .modal-overlay select.input,
.app-container.module-frosted .plan-modal-overlay select.input,
.app-container.module-frosted .plan-config-overlay select.input,
.app-container.module-frosted .batch-modal-overlay select.input,
.app-container.module-frosted .info-config-overlay select.input,
.app-container.module-frosted .formula-modal-overlay select.input {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}

/* ===== GlassSelect 自定义下拉组件（毛玻璃适配） ===== */
.app-container.module-frosted .glass-select-trigger {
  background: rgba(255, 255, 255, var(--module-opacity, 0.88)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}
body.module-frosted .glass-select-dropdown {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}

/* ===== 颜色预设选择器浮层（ColorPresetPicker） ===== */
.app-container.module-frosted .color-popover {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}

/* ===== 论文中心：公式输入面板（absolute 浮层） ===== */
.app-container.module-frosted .formula-input-panel {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
}

/* ===== 论文中心：公式弹窗遮罩层（毛玻璃模式下淡化） ===== */
.app-container.module-frosted .formula-modal-overlay {
  background: rgba(0, 0, 0, 0.05) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* ===== PDF 阅读器浮层毛玻璃适配 ===== */
/* PDF 选中文本操作浮窗 */
.app-container.module-frosted .selection-popup {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* PDF 右键菜单 */
.app-container.module-frosted .context-menu {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* PDF 翻译浮窗 */
.app-container.module-frosted .translate-popup {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* PDF 翻译结果区 & 原文区保持半透明 */
.app-container.module-frosted .translate-original {
  background: rgba(245, 245, 245, 0.6) !important;
}
.app-container.module-frosted .translate-result {
  background: rgba(232, 245, 233, 0.6) !important;
}
/* PDF 便签弹窗 */
.app-container.module-frosted .note-detail-popup {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* PDF 全屏遮罩（毛玻璃模式下淡化，与全局 .modal-overlay 一致） */
.app-container.module-frosted .pdf-reader-overlay {
  background: rgba(0, 0, 0, 0.05) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* ===== 仿真中心：图片预览框毛玻璃适配 ===== */
.app-container.module-frosted .img-preview-box {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
/* 图片预览遮罩层淡化 */
.app-container.module-frosted .img-preview-overlay {
  background: rgba(0, 0, 0, 0.05) !important;
}

/* ===== 计划日历：详情遮罩层淡化（毛玻璃模式下） ===== */
.app-container.module-frosted .detail-mask {
  background: rgba(0, 0, 0, 0.05) !important;
}

/* ===== 财务中心：批量编辑区域内层毛玻璃适配 ===== */
.app-container.module-frosted .batch-set-area {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
}

/* ===== 财务中心：状态颜色选择器毛玻璃 ===== */
.app-container.module-frosted .cfg-color-picker {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
}

/* ===== 设置页：自定义渐变选择器毛玻璃 ===== */
.app-container.module-frosted .custom-gradient-picker {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}

/* ===== 论文中心：富文本下拉框强化毛玻璃 ===== */
.app-container.module-frosted .wt-btn-select {
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
}

/* ===== 不透明模式：内容区恢复纯白底色 ===== */
.app-container:not(.module-frosted) .main-content .tab-content {
  background: var(--color-bg-card, #fff) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: 1px solid var(--color-border-light) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-sm) !important;
  padding: 20px !important;
  margin-bottom: 14px !important;
}

/* ===== 融合态导航样式 ===== */
/* 融合态下隐藏各视图内部的 tab-bar（由全局导航条接管） */
.app-container.merge-nav .main-content .tab-bar {
  display: none !important;
}
/* 融合态导航条容器：sticky 吸顶，与原二级导航栏位置一致 */
.merge-nav-bar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 5px 0 2px;
  margin-bottom: 8px;
}
/* 导航胶囊：与悬浮岛式侧栏 + 二级导航栏完全一致的毛玻璃参数 */
.merge-nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(248, 249, 251, var(--sub-nav-opacity, 0.92));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 18px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05);
  padding: 9px 10px;
}
/* 有背景图时：白底 + 透明度透出背景图 */
.app-container.has-bg-image .merge-nav-pill {
  background: rgba(255, 255, 255, var(--sub-nav-opacity, 0.78));
}
/* 毛玻璃模式下：merge-nav-pill 跟随 module-opacity */
.app-container.module-frosted .merge-nav-pill {
  background: rgba(255, 255, 255, calc(var(--module-opacity, 0.88) + 0.07)) !important;
}
/* 导航按钮 */
.merge-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}
.merge-nav-btn:hover {
  color: var(--color-text-primary);
  background: rgba(0, 0, 0, 0.03);
}
.merge-nav-btn.active {
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.30);
}
.merge-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.merge-nav-label {
  font-size: 14px;
  font-weight: 500;
}
/* 主页按钮 */
.merge-nav-home-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}
.merge-nav-home-btn:hover {
  color: var(--color-primary);
  background: rgba(59, 130, 246, 0.10);
}
.merge-nav-home-label {
  font-size: 14px;
  font-weight: 500;
}
/* 分隔线 */
.merge-nav-divider {
  width: 1px;
  height: 24px;
  background: rgba(0, 0, 0, 0.08);
  margin: 0 4px;
  flex-shrink: 0;
}
/* 融合态下：窄屏适配，隐藏文字只显示图标 */
@media (max-width: 1100px) {
  .merge-nav-label { display: none; }
  .merge-nav-home-label { display: none; }
  .merge-nav-btn { padding: 8px 12px; }
  .merge-nav-home-btn { padding: 8px 12px; }
}
</style>

