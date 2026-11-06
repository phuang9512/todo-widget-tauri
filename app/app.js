(() => {
  'use strict';

  const TASKS_KEY = 'desk-todo.tasks.v1';
  const TRASH_KEY = 'desk-todo.trash.v1';
  const THEME_KEY = 'desk-todo.theme';
  const MAX_TEXT = 500;

  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  const $ = (selector, root = document) => root.querySelector(selector);

  const app = $('#app');
  const taskList = $('#taskList');
  const emptyState = $('#emptyState');
  const todayText = $('#todayText');
  const themeBtn = $('#themeBtn');
  const copyBtn = $('#copyBtn');
  const copyLabel = $('#copyLabel');
  const progressText = $('#progressText');
  const progressTrack = $('#progressTrack');
  const progressFill = $('#progressFill');
  const summaryText = $('#summaryText');
  const selectionBar = $('#selectionBar');
  const selectedCountEl = $('#selectedCount');
  const selectionTip = $('#selectionTip');
  const selectAllBtn = $('#selectAllBtn');
  const cancelSelectBtn = $('#cancelSelectBtn');
  const composer = $('#composer');
  const newTaskInput = $('#newTaskInput');
  const addBtn = $('#addBtn');
  const composerDateBtn = $('#composerDateBtn');
  const composerDateLabel = $('#composerDateLabel');
  const emptyAddBtn = $('#emptyAddBtn');
  const emptyTitle = $('#emptyTitle');
  const emptyCopy = $('#emptyCopy');
  const emptyIconUse = $('#emptyIconUse');

  const filterBtn = $('#filterBtn');
  const filterLabel = $('#filterLabel');
  const filterMenu = $('#filterMenu');
  const filterOptions = $('#filterOptions');
  const filterClose = $('#filterClose');

  const trashBtn = $('#trashBtn');
  const trashCount = $('#trashCount');
  const trashOverlay = $('#trashOverlay');
  const trashClose = $('#trashClose');
  const trashList = $('#trashList');
  const trashEmpty = $('#trashEmpty');
  const trashSub = $('#trashSub');

  const calendar = $('#calendar');
  const calTitle = $('#calTitle');
  const calGrid = $('#calGrid');
  const calPrev = $('#calPrev');
  const calNext = $('#calNext');
  const calToday = $('#calToday');
  const calClear = $('#calClear');

  const toast = $('#toast');
  const toastText = $('#toastText');
  const toastAction = $('#toastAction');
  const toastIconUse = $('#toastIcon use');

  const state = {
    tasks: [],
    trash: [],
    theme: 'light',
    selectionMode: false,
    selected: new Set(),
    composerDate: null,
    filterDate: null,
    filterMenuOpen: false,
    filterTimer: 0,
    trashOpen: false,
    trashTimer: 0,
    copying: false,
    newTaskId: null,
    saveTimer: 0,
    toastTimer: 0,
    toastAction: null,
    storageFailed: false,
    lastToday: '',
    calendar: {
      open: false,
      target: null,
      selected: null,
      view: null,
      hideTimer: 0,
      outsideBound: false,
    },
  };

  /* -------------------------------------------------------
     Small utilities
     ------------------------------------------------------- */

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function isValidISO(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function fromISO(value) {
    if (!isValidISO(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function todayISO() {
    return toISO(new Date());
  }

  function daysFromToday(value) {
    const date = fromISO(value);
    if (!date) return NaN;
    const now = new Date();
    const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((a - b) / 86400000);
  }

  function relativeDate(value) {
    const diff = daysFromToday(value);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === -1) return '昨天';
    const date = fromISO(value);
    if (!date) return '';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return `${sameYear ? '' : `${date.getFullYear()}年`}${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function fullDate(value) {
    const date = fromISO(value);
    if (!date) return '';
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[char];
    });
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function findTask(id) {
    return state.tasks.find((task) => task.id === id) || null;
  }

  function findTrash(id) {
    return state.trash.find((task) => task.id === id) || null;
  }

  function findRow(id) {
    return Array.from(taskList.children).find((row) => row.dataset.id === id) || null;
  }

  function compareTasks(a, b) {
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    if (a.date && b.date && a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return (a.createdAt - b.createdAt) || String(a.id).localeCompare(String(b.id));
  }

  function sortTasks() {
    state.tasks.sort(compareTasks);
  }

  function visibleTasks() {
    return state.filterDate
      ? state.tasks.filter((task) => task.date === state.filterDate)
      : state.tasks;
  }

  function formatDeletedAtExact(value) {
    const date = new Date(Number(value) || Date.now());
    return `${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function isOverdue(task) {
    return Boolean(task.date && !task.done && task.date < todayISO());
  }

  function autoGrow(textarea) {
    if (!textarea || !textarea.isConnected) return;
    textarea.style.height = '0px';
    const height = Math.max(22, Math.min(textarea.scrollHeight, 112));
    textarea.style.height = `${height}px`;
    textarea.style.overflowY = textarea.scrollHeight > 112 ? 'auto' : 'hidden';
  }

  /* -------------------------------------------------------
     Storage
     ------------------------------------------------------- */

  function writeTasks(silent = false) {
    state.saveTimer = 0;
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
      state.storageFailed = false;
      return true;
    } catch (error) {
      if (!silent && !state.storageFailed) {
        state.storageFailed = true;
        showToast('无法保存到本机，请检查浏览器的存储权限', {
          tone: 'error',
          duration: 5000,
        });
      }
      return false;
    }
  }

  function persistTasks(immediate = false) {
    clearTimeout(state.saveTimer);
    if (immediate) {
      writeTasks(false);
      return;
    }
    state.saveTimer = setTimeout(() => writeTasks(false), 260);
  }

  function writeTrash(silent = false) {
    try {
      localStorage.setItem(TRASH_KEY, JSON.stringify(state.trash));
      return true;
    } catch (error) {
      if (!silent) {
        showToast('垃圾桶暂时无法保存，请检查浏览器存储权限', {
          tone: 'error',
          duration: 5000,
        });
      }
      return false;
    }
  }

  function persistTrash() {
    writeTrash(false);
  }

  function loadTasks() {
    let raw;
    try {
      raw = localStorage.getItem(TASKS_KEY);
    } catch (_) {
      return [];
    }
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const seen = new Set();
      return parsed
        .filter((item) => {
          if (!item || typeof item !== 'object') return false;
          if (typeof item.id !== 'string' || !item.id) return false;
          if (typeof item.text !== 'string') return false;
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .map((item) => ({
          id: item.id,
          text: item.text.slice(0, MAX_TEXT),
          date: isValidISO(item.date) ? item.date : null,
          done: Boolean(item.done),
          createdAt: Number(item.createdAt) || Date.now(),
        }))
        .sort(compareTasks);
    } catch (_) {
      return [];
    }
  }

  function loadTrash() {
    let raw;
    try {
      raw = localStorage.getItem(TRASH_KEY);
    } catch (_) {
      return [];
    }
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const seen = new Set();
      return parsed
        .filter((item) => {
          if (!item || typeof item !== 'object') return false;
          if (typeof item.id !== 'string' || !item.id) return false;
          if (typeof item.text !== 'string') return false;
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .map((item) => ({
          id: item.id,
          text: item.text.slice(0, MAX_TEXT),
          date: isValidISO(item.date) ? item.date : null,
          done: Boolean(item.done),
          createdAt: Number(item.createdAt) || Date.now(),
          deletedAt: Number(item.deletedAt) || Date.now(),
        }))
        .sort((a, b) => b.deletedAt - a.deletedAt);
    } catch (_) {
      return [];
    }
  }

  /* -------------------------------------------------------
     Rendering
     ------------------------------------------------------- */

  function taskMarkup(task, animateNew) {
    const selected = state.selectionMode && state.selected.has(task.id);
    const overdue = isOverdue(task);
    const classes = ['task'];
    if (task.done) classes.push('is-done');
    if (selected) classes.push('is-selected');
    if (animateNew && task.id === state.newTaskId) classes.push('is-new');

    const dateClasses = ['date-chip'];
    if (task.date) dateClasses.push('has-date');
    if (overdue) dateClasses.push('is-overdue');

    const checkLabel = state.selectionMode
      ? selected
        ? '取消选择'
        : '选择任务'
      : task.done
        ? '标记为未完成'
        : '标记完成';

    const checkPressed = state.selectionMode ? selected : task.done;
    const dateText = task.date ? relativeDate(task.date) : '添加日期';
    const dateTitle = task.date ? fullDate(task.date) : '设置日期';
    const lock = state.selectionMode;

    return `
      <article class="${classes.join(' ')}" data-id="${escapeHTML(task.id)}" role="listitem">
        <button class="check" type="button" data-action="toggle"
                aria-label="${checkLabel}" aria-pressed="${checkPressed}">
          <svg class="icon"><use href="#i-check"></use></svg>
        </button>
        <div class="task-body">
          <textarea class="task-text" rows="1" maxlength="${MAX_TEXT}" spellcheck="false"
                    placeholder="任务内容" aria-label="任务内容"
                    ${lock ? 'readonly tabindex="-1"' : ''}>${escapeHTML(task.text)}</textarea>
          <div class="task-meta">
            <button class="${dateClasses.join(' ')}" type="button" data-action="date"
                    title="${escapeHTML(dateTitle)}" aria-label="${escapeHTML(dateTitle)}"
                    aria-haspopup="dialog" ${lock ? 'disabled' : ''}>
              <svg class="icon"><use href="#i-calendar"></use></svg>
              <span>${escapeHTML(dateText)}</span>
            </button>
            ${overdue ? '<span class="overdue-flag">已逾期</span>' : ''}
          </div>
        </div>
        <button class="task-delete" type="button" data-action="delete"
                aria-label="移入垃圾桶" title="移入垃圾桶" ${lock ? 'disabled' : ''}>
          <svg class="icon"><use href="#i-trash"></use></svg>
        </button>
      </article>
    `;
  }

  function updateEmptyState() {
    if (state.filterDate) {
      emptyState.dataset.mode = 'filter';
      emptyTitle.textContent = '这一天还没有任务';
      emptyCopy.innerHTML = '换个日期看看，<br>或者回到全部任务。';
      emptyAddBtn.textContent = '查看全部';
      emptyIconUse.setAttribute('href', '#i-calendar');
    } else {
      emptyState.dataset.mode = 'add';
      emptyTitle.textContent = '今天还很轻';
      emptyCopy.innerHTML = '写下第一件想做的事，<br>让今天有一个清晰的开始。';
      emptyAddBtn.textContent = '添加第一项';
      emptyIconUse.setAttribute('href', '#i-check');
    }
  }

  function renderTasks(options = {}) {
    const { animateNew = false } = options;
    const visible = visibleTasks();

    if (!visible.length) {
      taskList.innerHTML = '';
      taskList.hidden = true;
      emptyState.hidden = false;
      app.classList.add('is-empty');
      updateEmptyState();
      return;
    }

    taskList.hidden = false;
    emptyState.hidden = true;
    app.classList.remove('is-empty');

    taskList.innerHTML = visible
      .map((task) => taskMarkup(task, animateNew))
      .join('');

    taskList.querySelectorAll('.task-text').forEach(autoGrow);
  }

  function render(options = {}) {
    const { preserveScroll = true, animateNew = false } = options;
    const scrollTop = taskList.scrollTop;

    renderTasks({ animateNew });
    updateChrome();

    if (preserveScroll) {
      taskList.scrollTop = scrollTop;
    }
  }

  function updateChrome() {
    const visible = visibleTasks();
    const total = visible.length;
    const allTotal = state.tasks.length;
    const done = visible.filter((task) => task.done).length;
    const remaining = total - done;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const dayLabel = state.filterDate ? relativeDate(state.filterDate) : '';

    progressText.textContent = `${done} / ${total}`;
    progressFill.style.width = `${percent}%`;
    progressTrack.setAttribute('aria-valuemax', String(total));
    progressTrack.setAttribute('aria-valuenow', String(done));
    progressTrack.setAttribute(
      'aria-valuetext',
      total ? `${total} 项中已完成 ${done} 项` : '暂无任务'
    );

    if (!total) {
      summaryText.textContent = state.filterDate
        ? `${dayLabel}还没有任务。`
        : '从一件小事开始。';
    } else if (!remaining) {
      summaryText.textContent = '都完成了，给自己一点掌声。';
    } else if (remaining === total) {
      summaryText.textContent = state.filterDate
        ? `${dayLabel}有 ${remaining} 件事，一件件来。`
        : `今天有 ${remaining} 件事，一件件来。`;
    } else {
      summaryText.textContent = `还有 ${remaining} 件事，慢慢来。`;
    }

    const selectedCount = state.selected.size;
    const selecting = state.selectionMode;

    app.classList.toggle('selecting', selecting);
    app.classList.toggle('is-empty', total === 0);
    app.classList.toggle('is-filter-empty', Boolean(state.filterDate) && total === 0);
    copyBtn.classList.toggle('active', selecting);
    copyBtn.disabled = total === 0;
    copyLabel.textContent = selecting && selectedCount ? `复制 ${selectedCount} 项` : '复制';
    copyBtn.setAttribute('aria-pressed', selecting ? 'true' : 'false');
    copyBtn.title = selecting
      ? '将所选任务复制到剪贴板，每项一行'
      : '进入多选复制模式，把任务逐行复制到剪贴板';

    selectionBar.hidden = !selecting;
    selectedCountEl.textContent = String(selectedCount);
    selectionTip.textContent = selectedCount
      ? '再点「复制」完成'
      : '点击任务进行选择';
    selectAllBtn.textContent =
      selecting && total > 0 && selectedCount === total ? '取消全选' : '全选';

    filterBtn.disabled = selecting || allTotal === 0;
    filterBtn.classList.toggle('active', Boolean(state.filterDate));
    filterLabel.textContent = state.filterDate ? relativeDate(state.filterDate) : '全部';
    filterBtn.title = state.filterDate
      ? `当前筛选：${fullDate(state.filterDate)}`
      : '按日期筛选任务';
    filterBtn.setAttribute(
      'aria-label',
      state.filterDate
        ? `按日期筛选任务，当前为${fullDate(state.filterDate)}`
        : '按日期筛选任务，当前显示全部'
    );

    const trashTotal = state.trash.length;
    trashBtn.disabled = selecting;
    trashCount.hidden = trashTotal === 0;
    trashCount.textContent = trashTotal > 99 ? '99+' : String(trashTotal);
    trashBtn.title = trashTotal ? `垃圾桶（${trashTotal}）` : '垃圾桶';
    trashBtn.setAttribute(
      'aria-label',
      trashTotal ? `打开垃圾桶，${trashTotal} 项已删除` : '打开垃圾桶'
    );

    const lock = selecting;
    newTaskInput.disabled = lock;
    composerDateBtn.disabled = lock;
    addBtn.disabled = lock || !newTaskInput.value.trim();
    composer.classList.toggle('is-disabled', lock);

    taskList.hidden = total === 0;
    emptyState.hidden = total > 0;

    const filterSuffix = state.filterDate ? ` · ${dayLabel}` : '';
    document.title = selecting
      ? '选择要复制的任务'
      : remaining > 0
        ? `待办清单 · ${remaining}${filterSuffix}`
        : `待办清单${filterSuffix}`;
  }

  function syncSelectionRow(id) {
    const row = findRow(id);
    if (!row) return;
    const selected = state.selected.has(id);
    row.classList.toggle('is-selected', selected);
    const check = $('.check', row);
    if (check) {
      check.setAttribute('aria-pressed', String(selected));
      check.setAttribute('aria-label', selected ? '取消选择' : '选择任务');
    }
  }

  function updateComposerDate() {
    if (state.composerDate) {
      composerDateLabel.textContent = relativeDate(state.composerDate);
      composerDateBtn.classList.add('has-date');
      composerDateBtn.title = `新任务日期：${fullDate(state.composerDate)}`;
      composerDateBtn.setAttribute(
        'aria-label',
        `新任务日期：${fullDate(state.composerDate)}，点击修改`
      );
    } else {
      composerDateLabel.textContent = '日期';
      composerDateBtn.classList.remove('has-date');
      composerDateBtn.title = '设置日期';
      composerDateBtn.setAttribute('aria-label', '设置新任务日期');
    }
  }

  /* -------------------------------------------------------
     Date filter / trash
     ------------------------------------------------------- */

  function renderFilterMenu() {
    const dates = new Set();
    state.tasks.forEach((task) => {
      if (task.date) dates.add(task.date);
    });
    if (state.filterDate) dates.add(state.filterDate);

    const options = [
      `<button type="button" class="filter-option${state.filterDate ? '' : ' is-active'}"
               data-filter-date="" role="menuitem">
         <span class="filter-date">全部任务</span>
         <span class="filter-count">${state.tasks.length}</span>
       </button>`,
    ];

    Array.from(dates)
      .sort((a, b) => (a < b ? 1 : -1))
      .forEach((date) => {
        const count = state.tasks.filter((task) => task.date === date).length;
        const active = state.filterDate === date ? ' is-active' : '';
        options.push(
          `<button type="button" class="filter-option${active}" data-filter-date="${date}"
                   title="${escapeHTML(fullDate(date))}" role="menuitem">
             <span class="filter-date">${escapeHTML(relativeDate(date))}</span>
             <span class="filter-count">${count}</span>
           </button>`
        );
      });

    if (!dates.size) {
      options.push('<p class="filter-hint">还没有设置日期的任务。</p>');
    }

    filterOptions.innerHTML = options.join('');
  }

  function positionFilterMenu() {
    const rect = filterBtn.getBoundingClientRect();
    const width = filterMenu.offsetWidth || 226;
    const height = filterMenu.offsetHeight || 240;
    const margin = 12;
    const gap = 8;

    let left = Math.min(rect.right - width, window.innerWidth - width - margin);
    left = Math.max(margin, left);

    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - margin) {
      top = rect.top - height - gap;
    }
    if (top < margin) top = margin;

    filterMenu.style.left = `${Math.round(left)}px`;
    filterMenu.style.top = `${Math.round(top)}px`;
  }

  function openFilterMenu() {
    if (state.selectionMode || !state.tasks.length) return;
    if (state.filterMenuOpen) {
      closeFilterMenu();
      return;
    }

    closeCalendar();
    hideToast();
    clearTimeout(state.filterTimer);
    state.filterMenuOpen = true;
    renderFilterMenu();
    filterMenu.hidden = false;
    filterBtn.setAttribute('aria-expanded', 'true');
    positionFilterMenu();

    requestAnimationFrame(() => {
      if (!state.filterMenuOpen) return;
      filterMenu.classList.add('is-open');
      const active = filterOptions.querySelector('.filter-option.is-active');
      if (active) active.focus({ preventScroll: true });
    });
  }

  function closeFilterMenu(options = {}) {
    if (!state.filterMenuOpen) return;
    const { focusButton = false } = options;
    state.filterMenuOpen = false;
    filterMenu.classList.remove('is-open');
    filterBtn.setAttribute('aria-expanded', 'false');
    clearTimeout(state.filterTimer);
    state.filterTimer = setTimeout(() => {
      if (!state.filterMenuOpen) filterMenu.hidden = true;
    }, 160);
    if (focusButton) filterBtn.focus({ preventScroll: true });
  }

  function setFilterDate(date) {
    if (date && !isValidISO(date)) return;
    state.filterDate = date || null;
    closeFilterMenu({ focusButton: true });
    render({ preserveScroll: false });
  }

  function trashItemMarkup(task) {
    const dateText = task.date ? relativeDate(task.date) : '无日期';
    const dateTitle = task.date ? fullDate(task.date) : '无日期';
    return `
      <article class="trash-item" data-id="${escapeHTML(task.id)}">
        <p class="trash-text">${escapeHTML(task.text || '（无内容）')}</p>
        <div class="trash-meta">
          <span title="${escapeHTML(dateTitle)}">
            <svg class="icon"><use href="#i-calendar"></use></svg>${task.date ? `原定 ${escapeHTML(dateText)}` : '无日期'}
          </span>
          <span>· 删除于 ${escapeHTML(formatDeletedAtExact(task.deletedAt))}</span>
        </div>
        <div class="trash-actions">
          <button type="button" class="trash-restore" data-trash-action="restore"
                  aria-label="恢复任务" title="恢复到原来的日期位置">
            <svg class="icon"><use href="#i-restore"></use></svg>恢复
          </button>
          <button type="button" class="trash-clear" data-trash-action="clear"
                  aria-label="永久清除任务" title="直接清除，不再显示">
            清除
          </button>
        </div>
      </article>
    `;
  }

  function renderTrash() {
    const count = state.trash.length;
    const badge = count > 99 ? '99+' : String(count);

    trashCount.hidden = count === 0;
    trashCount.textContent = badge;
    trashSub.textContent = count
      ? `共 ${count} 项 · 恢复后回到原来的日期位置`
      : '删除的任务会留在这里，直到清除。';

    if (!count) {
      trashList.innerHTML = '';
      trashList.hidden = true;
      trashEmpty.hidden = false;
      return;
    }

    trashList.hidden = false;
    trashEmpty.hidden = true;
    trashList.innerHTML = state.trash.map(trashItemMarkup).join('');
  }

  function openTrash() {
    if (state.selectionMode || state.trashOpen) return;
    closeCalendar();
    closeFilterMenu();
    hideToast();
    state.trashOpen = true;
    renderTrash();
    trashOverlay.hidden = false;
    app.inert = true;
    requestAnimationFrame(() => {
      if (state.trashOpen) trashOverlay.classList.add('is-open');
    });
    setTimeout(() => trashClose.focus({ preventScroll: true }), 0);
  }

  function closeTrash() {
    if (!state.trashOpen) return;
    state.trashOpen = false;
    clearTimeout(state.trashTimer);
    trashOverlay.classList.remove('is-open');
    app.inert = false;
    state.trashTimer = setTimeout(() => {
      if (!state.trashOpen) trashOverlay.hidden = true;
    }, 180);
    trashBtn.focus({ preventScroll: true });
  }

  function restoreTaskFromTrash(id) {
    const index = state.trash.findIndex((task) => task.id === id);
    if (index < 0) return false;

    const [record] = state.trash.splice(index, 1);
    const task = {
      id: record.id,
      text: record.text,
      date: record.date,
      done: record.done,
      createdAt: record.createdAt,
    };
    if (findTask(task.id)) task.id = uid();

    state.tasks.push(task);
    sortTasks();
    if (state.filterDate && task.date !== state.filterDate) {
      state.filterDate = null;
    }

    persistTasks(true);
    persistTrash();
    render({ preserveScroll: false });
    if (state.trashOpen) renderTrash();
    showToast('已恢复任务', { duration: 2200 });

    const row = findRow(task.id);
    if (row) row.scrollIntoView({ block: 'nearest' });
    return true;
  }

  function clearTrashTask(id) {
    const index = state.trash.findIndex((task) => task.id === id);
    if (index < 0) return;
    state.trash.splice(index, 1);
    persistTrash();
    renderTrash();
    updateChrome();
    showToast('已清除，无法恢复', { duration: 2200 });
  }

  /* -------------------------------------------------------
     Task actions
     ------------------------------------------------------- */

  function toggleDone(id) {
    const task = findTask(id);
    if (!task) return;

    task.done = !task.done;
    persistTasks(true);
    render({ preserveScroll: true });

    const row = findRow(id);
    if (row) {
      const check = $('.check', row);
      if (check) check.focus({ preventScroll: true });
    }

    if (task.done && state.tasks.length && state.tasks.every((item) => item.done)) {
      showToast('全部完成，今天辛苦了。', { duration: 2600 });
    }
  }

  function deleteTask(id) {
    const index = state.tasks.findIndex((task) => task.id === id);
    if (index < 0) return;

    const [task] = state.tasks.splice(index, 1);
    state.selected.delete(id);
    state.trash.unshift({ ...task, deletedAt: Date.now() });

    persistTasks(true);
    persistTrash();
    render({ preserveScroll: true });

    showToast('已移入垃圾桶', {
      actionLabel: '撤销',
      duration: 5000,
      onAction: () => {
        if (restoreTaskFromTrash(task.id)) return;
        showToast('这项任务已经不在垃圾桶里', { tone: 'error', duration: 2200 });
      },
    });
  }

  function enterSelectionMode() {
    if (!visibleTasks().length) {
      showToast('当前没有可复制的任务', { duration: 1800 });
      return;
    }

    closeCalendar();
    closeFilterMenu();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    state.selectionMode = true;
    state.selected.clear();
    render({ preserveScroll: true });
    copyBtn.focus({ preventScroll: true });
  }

  function exitSelectionMode(options = {}) {
    if (!state.selectionMode) return;
    const { focusCopy = true } = options;

    state.selectionMode = false;
    state.selected.clear();
    render({ preserveScroll: true });

    if (focusCopy) {
      copyBtn.focus({ preventScroll: true });
    }
  }

  function toggleSelection(id) {
    if (!state.selectionMode) return;
    if (state.selected.has(id)) {
      state.selected.delete(id);
    } else {
      state.selected.add(id);
    }
    syncSelectionRow(id);
    updateChrome();
  }

  function toggleSelectAll() {
    if (!state.selectionMode) return;
    const visible = visibleTasks();
    const allSelected =
      visible.length > 0 && visible.every((task) => state.selected.has(task.id));

    state.selected = allSelected
      ? new Set()
      : new Set(visible.map((task) => task.id));

    visible.forEach((task) => syncSelectionRow(task.id));
    updateChrome();
  }

  /* -------------------------------------------------------
     Clipboard
     ------------------------------------------------------- */

  function legacyCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_) {
      ok = false;
    }
    textarea.remove();
    return ok;
  }

  async function writeClipboard(text) {
    // Tauri 使用系统剪贴板，不受 WebView 的 file:// 权限限制
    if (
      window.__TAURI__ &&
      window.__TAURI__.core &&
      typeof window.__TAURI__.core.invoke === 'function'
    ) {
      try {
        await window.__TAURI__.core.invoke('write_clipboard', { text });
        return true;
      } catch (_) {
        // 命令不可用时继续尝试 Web API
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // 文件页面或无权限时回退到旧版复制
      }
    }
    return legacyCopy(text);
  }

  async function copySelection() {
    if (!state.selectionMode || state.copying) return;

    if (!state.selected.size) {
      showToast('请先选择要复制的任务', { duration: 1800 });
      return;
    }

    const lines = visibleTasks()
      .filter((task) => state.selected.has(task.id))
      .map((task) => task.text.replace(/\r?\n+/g, ' ').trim())
      .filter(Boolean);

    if (!lines.length) {
      showToast('所选任务没有文字内容', { tone: 'error', duration: 2200 });
      return;
    }

    state.copying = true;
    copyBtn.disabled = true;

    const ok = await writeClipboard(lines.join('\n'));
    state.copying = false;

    if (!ok) {
      updateChrome();
      showToast('复制失败，请再试一次', { tone: 'error', duration: 2600 });
      return;
    }

    const count = lines.length;
    exitSelectionMode();
    showToast(`已复制 ${count} 项到剪贴板，每项一行`, { duration: 3000 });
  }

  /* -------------------------------------------------------
     Adding tasks
     ------------------------------------------------------- */

  function addTaskFromComposer() {
    if (state.selectionMode) return;

    const text = newTaskInput.value.replace(/\s+/g, ' ').trim();
    if (!text) {
      newTaskInput.focus();
      return;
    }

    const task = {
      id: uid(),
      text: text.slice(0, MAX_TEXT),
      date: state.composerDate,
      done: false,
      createdAt: Date.now(),
    };

    state.tasks.push(task);
    sortTasks();
    const filterCleared = Boolean(state.filterDate && task.date !== state.filterDate);
    if (filterCleared) state.filterDate = null;
    state.newTaskId = task.id;
    state.composerDate = todayISO();
    newTaskInput.value = '';
    addBtn.disabled = true;
    updateComposerDate();
    persistTasks(true);
    render({ preserveScroll: false, animateNew: true });

    const row = findRow(task.id);
    if (row) row.scrollIntoView({ block: 'nearest' });
    if (filterCleared) {
      showToast('已添加，切回全部任务', { duration: 1800 });
    }
    newTaskInput.focus({ preventScroll: true });
  }

  /* -------------------------------------------------------
     Calendar
     ------------------------------------------------------- */

  function sameCalendarTarget(target) {
    if (!target || !state.calendar.target) return false;
    if (target.type === 'composer') return state.calendar.target.type === 'composer';
    return (
      state.calendar.target.type === 'task' &&
      state.calendar.target.id === target.id
    );
  }

  function openCalendar(anchor, target) {
    if (state.calendar.open && sameCalendarTarget(target)) {
      closeCalendar();
      return;
    }

    closeFilterMenu();
    clearTimeout(state.calendar.hideTimer);
    state.calendar.hideTimer = 0;

    state.calendar.target = target;
    state.calendar.selected = target.date || null;
    const base = state.calendar.selected ? fromISO(state.calendar.selected) : new Date();
    state.calendar.view = new Date(base.getFullYear(), base.getMonth(), 1);
    state.calendar.open = true;

    renderCalendar();
    calendar.hidden = false;
    calendar.classList.remove('is-open');
    positionCalendar(anchor);

    requestAnimationFrame(() => {
      if (!state.calendar.open) return;
      calendar.classList.add('is-open');
      const focusDay = calGrid.querySelector('.cal-day[tabindex="0"]');
      if (focusDay) focusDay.focus({ preventScroll: true });
    });

    if (!state.calendar.outsideBound) {
      state.calendar.outsideBound = true;
      setTimeout(() => {
        if (state.calendar.open) {
          document.addEventListener('pointerdown', handleOutsideCalendar, true);
        }
      }, 0);
    }
  }

  function closeCalendar() {
    if (!state.calendar.open && calendar.hidden) return;

    state.calendar.open = false;
    state.calendar.target = null;
    calendar.classList.remove('is-open');
    document.removeEventListener('pointerdown', handleOutsideCalendar, true);
    state.calendar.outsideBound = false;

    clearTimeout(state.calendar.hideTimer);
    state.calendar.hideTimer = setTimeout(() => {
      if (!state.calendar.open) calendar.hidden = true;
    }, 170);
  }

  function handleOutsideCalendar(event) {
    if (!state.calendar.open) return;
    if (calendar.contains(event.target)) return;
    if (event.target.closest && event.target.closest('[data-action="date"], #composerDateBtn')) {
      return;
    }
    closeCalendar();
  }

  function positionCalendar(anchor) {
    const rect = anchor.getBoundingClientRect();
    const width = calendar.offsetWidth || 286;
    const height = calendar.offsetHeight || 330;
    const margin = 12;
    const gap = 8;

    const appRect = app.getBoundingClientRect();
    const appPadding = parseFloat(getComputedStyle(app).paddingLeft) || 0;
    const minLeft = Math.max(margin, Math.round(appRect.left + appPadding));
    const maxLeft = Math.max(minLeft, window.innerWidth - width - margin);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    let top = rect.bottom + gap;
    let origin = 'top center';

    if (top + height > window.innerHeight - margin) {
      top = rect.top - height - gap;
      origin = 'bottom center';
    }
    if (top < margin) {
      top = margin;
      origin = 'center center';
    }

    calendar.style.left = `${Math.round(left)}px`;
    calendar.style.top = `${Math.round(top)}px`;
    calendar.style.transformOrigin = origin;
  }

  function renderCalendar() {
    const view = state.calendar.view || new Date();
    const year = view.getFullYear();
    const month = view.getMonth();
    const selected = state.calendar.selected;
    const today = todayISO();

    calTitle.textContent = `${year}年 ${month + 1}月`;

    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);

    const focusCandidate =
      selected && isValidISO(selected)
        ? selected
        : today;

    let focusAssigned = false;
    const parts = [];

    for (let index = 0; index < 42; index += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const iso = toISO(day);
      const outside = day.getMonth() !== month;
      const classes = ['cal-day'];
      if (outside) classes.push('is-outside');
      if (iso === today) classes.push('is-today');
      if (iso === selected) classes.push('is-selected');
      if (day.getDay() === 0 || day.getDay() === 6) classes.push('is-weekend');

      let tabIndex = -1;
      if (!focusAssigned) {
        const inView = day.getMonth() === month;
        if (iso === focusCandidate && inView) {
          tabIndex = 0;
          focusAssigned = true;
        }
      }

      const label = `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 星期${WEEKDAYS[day.getDay()]}`;
      parts.push(
        `<button type="button" class="${classes.join(' ')}" data-date="${iso}"
                 tabindex="${tabIndex}" aria-label="${label}"
                 aria-pressed="${iso === selected}"${iso === today ? ' aria-current="date"' : ''}>
           <span>${day.getDate()}</span>
         </button>`
      );
    }

    calGrid.innerHTML = parts.join('');
    if (!focusAssigned) {
      const firstInView = calGrid.querySelector('.cal-day:not(.is-outside)');
      if (firstInView) firstInView.setAttribute('tabindex', '0');
    }

    calClear.disabled = !selected;
  }

  function shiftCalendarMonth(delta) {
    const view = state.calendar.view || new Date();
    state.calendar.view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    renderCalendar();
    const focusDay = calGrid.querySelector('.cal-day[tabindex="0"]');
    if (focusDay) focusDay.focus({ preventScroll: true });
  }

  function setTargetDate(iso) {
    const target = state.calendar.target;
    if (!target) return;

    if (target.type === 'composer') {
      state.composerDate = iso;
      updateComposerDate();
      closeCalendar();
      newTaskInput.focus({ preventScroll: true });
      return;
    }

    const task = findTask(target.id);
    if (!task) {
      closeCalendar();
      return;
    }

    task.date = iso;
    sortTasks();
    if (state.filterDate && task.date !== state.filterDate) {
      state.filterDate = null;
    }
    persistTasks(true);
    render({ preserveScroll: true });
    closeCalendar();
    const row = findRow(task.id);
    if (row) row.scrollIntoView({ block: 'nearest' });
    const chip = row ? $('.date-chip', row) : null;
    if (chip) chip.focus({ preventScroll: true });
  }

  /* -------------------------------------------------------
     Theme & clock
     ------------------------------------------------------- */

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme;
    themeBtn.setAttribute(
      'aria-label',
      state.theme === 'light' ? '切换到深色模式' : '切换到浅色模式'
    );
    themeBtn.title = state.theme === 'light' ? '切换到深色模式' : '切换到浅色模式';

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', state.theme === 'dark' ? '#191b17' : '#f3eee4');
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, state.theme);
    } catch (_) {
      // 主题偏好写入失败也不影响使用
    }
    applyTheme();
  }

  function updateTodayLabel() {
    const now = new Date();
    todayText.textContent = `${now.getMonth() + 1}月${now.getDate()}日 · 星期${WEEKDAYS[now.getDay()]}`;
  }

  function tickClock() {
    const current = todayISO();
    updateTodayLabel();
    if (current !== state.lastToday) {
      state.lastToday = current;
      if (!(document.activeElement instanceof HTMLElement) ||
          !document.activeElement.classList.contains('task-text')) {
        render({ preserveScroll: true });
      }
    }
  }

  /* -------------------------------------------------------
     Toast
     ------------------------------------------------------- */

  function hideToast() {
    clearTimeout(state.toastTimer);
    state.toastTimer = 0;
    toast.classList.remove('is-visible');
    state.toastAction = null;
  }

  function showToast(message, options = {}) {
    const {
      actionLabel = null,
      onAction = null,
      duration = 3000,
      tone = 'success',
    } = options;

    clearTimeout(state.toastTimer);
    toastText.textContent = message;
    toast.classList.toggle('is-error', tone === 'error');
    toastIconUse.setAttribute('href', tone === 'error' ? '#i-alert' : '#i-check');

    toastAction.hidden = !actionLabel;
    toastAction.textContent = actionLabel || '';
    state.toastAction = typeof onAction === 'function' ? onAction : null;

    toast.classList.add('is-visible');
    if (duration > 0) {
      state.toastTimer = setTimeout(hideToast, duration);
    }
  }

  /* -------------------------------------------------------
     Events
     ------------------------------------------------------- */

  function handleTaskListClick(event) {
    const row = event.target.closest('.task');
    if (!row) return;

    const id = row.dataset.id;
    const task = findTask(id);
    if (!task) return;

    if (state.selectionMode) {
      toggleSelection(id);
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) {
      if (!event.target.closest('textarea')) {
        const textarea = $('.task-text', row);
        if (textarea) {
          textarea.focus({ preventScroll: true });
          const end = textarea.value.length;
          textarea.setSelectionRange(end, end);
        }
      }
      return;
    }

    const action = actionButton.dataset.action;

    if (action === 'toggle') {
      toggleDone(id);
      return;
    }

    if (action === 'delete') {
      deleteTask(id);
      return;
    }

    if (action === 'date') {
      const target = { type: 'task', id, date: task.date };
      if (state.calendar.open && sameCalendarTarget(target)) {
        closeCalendar();
      } else {
        openCalendar(actionButton, target);
      }
    }
  }

  function handleTaskListInput(event) {
    const textarea = event.target.closest('.task-text');
    if (!textarea) return;
    const row = textarea.closest('.task');
    const task = row ? findTask(row.dataset.id) : null;
    if (!task) return;

    task.text = textarea.value.slice(0, MAX_TEXT);
    autoGrow(textarea);
    persistTasks(false);
  }

  function handleTaskListKeydown(event) {
    const textarea = event.target.closest('.task-text');
    if (!textarea) return;

    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      textarea.blur();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      textarea.blur();
    }
  }

  function handleTaskListPaste(event) {
    const textarea = event.target.closest('.task-text');
    if (!textarea) return;

    const text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
    if (!text || !/[\r\n]/.test(text)) return;

    event.preventDefault();
    const flattened = text.replace(/\s*\r?\n+\s*/g, ' ');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(flattened, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function handleTaskListFocusOut(event) {
    const textarea = event.target.closest('.task-text');
    if (!textarea) return;
    const row = textarea.closest('.task');
    const task = row ? findTask(row.dataset.id) : null;
    if (!task) return;

    const trimmed = textarea.value.replace(/\s+/g, ' ').trim();
    if (trimmed && trimmed !== textarea.value) {
      textarea.value = trimmed;
      autoGrow(textarea);
    }
    if (trimmed !== task.text) {
      task.text = trimmed;
      persistTasks(true);
    }
  }

  function handleNewTaskInput() {
    addBtn.disabled = state.selectionMode || !newTaskInput.value.trim();
  }

  function handleNewTaskKeydown(event) {
    if (event.key !== 'Enter') return;
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    addTaskFromComposer();
  }

  function handleComposerDateClick() {
    if (state.selectionMode) return;
    const target = { type: 'composer', date: state.composerDate };
    if (state.calendar.open && sameCalendarTarget(target)) {
      closeCalendar();
    } else {
      openCalendar(composerDateBtn, target);
    }
  }

  function bindEvents() {
    copyBtn.addEventListener('click', () => {
      if (!state.selectionMode) {
        enterSelectionMode();
      } else {
        copySelection();
      }
    });

    themeBtn.addEventListener('click', toggleTheme);
    selectAllBtn.addEventListener('click', toggleSelectAll);
    cancelSelectBtn.addEventListener('click', () => exitSelectionMode());
    emptyAddBtn.addEventListener('click', () => {
      if (emptyState.dataset.mode === 'filter') {
        setFilterDate(null);
        return;
      }
      newTaskInput.focus({ preventScroll: true });
    });

    filterBtn.addEventListener('click', openFilterMenu);
    filterClose.addEventListener('click', () => closeFilterMenu({ focusButton: true }));
    filterOptions.addEventListener('click', (event) => {
      const option = event.target.closest('[data-filter-date]');
      if (!option) return;
      setFilterDate(option.dataset.filterDate || null);
    });

    trashBtn.addEventListener('click', openTrash);
    trashClose.addEventListener('click', closeTrash);
    trashOverlay.addEventListener('click', (event) => {
      if (event.target === trashOverlay) closeTrash();
    });
    trashList.addEventListener('click', (event) => {
      const action = event.target.closest('[data-trash-action]');
      if (!action) return;
      const item = action.closest('.trash-item');
      if (!item) return;
      if (action.dataset.trashAction === 'restore') {
        restoreTaskFromTrash(item.dataset.id);
      } else if (action.dataset.trashAction === 'clear') {
        clearTrashTask(item.dataset.id);
      }
    });

    addBtn.addEventListener('click', addTaskFromComposer);
    newTaskInput.addEventListener('input', handleNewTaskInput);
    newTaskInput.addEventListener('keydown', handleNewTaskKeydown);
    composerDateBtn.addEventListener('click', handleComposerDateClick);

    taskList.addEventListener('click', handleTaskListClick);
    taskList.addEventListener('input', handleTaskListInput);
    taskList.addEventListener('keydown', handleTaskListKeydown);
    taskList.addEventListener('paste', handleTaskListPaste);
    taskList.addEventListener('focusout', handleTaskListFocusOut);
    taskList.addEventListener(
      'scroll',
      () => {
        closeCalendar();
        closeFilterMenu();
      },
      { passive: true }
    );

    calPrev.addEventListener('click', () => shiftCalendarMonth(-1));
    calNext.addEventListener('click', () => shiftCalendarMonth(1));
    calToday.addEventListener('click', () => setTargetDate(todayISO()));
    calClear.addEventListener('click', () => setTargetDate(null));

    calGrid.addEventListener('click', (event) => {
      const day = event.target.closest('.cal-day');
      if (!day) return;
      setTargetDate(day.dataset.date);
    });

    calGrid.addEventListener('keydown', (event) => {
      const offsets = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7,
      };
      if (!(event.key in offsets)) return;

      const day = event.target.closest('.cal-day');
      if (!day) return;

      event.preventDefault();
      const date = fromISO(day.dataset.date);
      if (!date) return;
      date.setDate(date.getDate() + offsets[event.key]);

      const view = state.calendar.view || new Date();
      if (
        date.getFullYear() !== view.getFullYear() ||
        date.getMonth() !== view.getMonth()
      ) {
        state.calendar.view = new Date(date.getFullYear(), date.getMonth(), 1);
        renderCalendar();
      }

      const next = calGrid.querySelector(`.cal-day[data-date="${toISO(date)}"]`);
      if (next) next.focus({ preventScroll: true });
    });

    toastAction.addEventListener('click', () => {
      const action = state.toastAction;
      hideToast();
      if (action) action();
    });

    document.addEventListener('pointerdown', (event) => {
      if (!state.filterMenuOpen) return;
      if (filterMenu.contains(event.target) || filterBtn.contains(event.target)) {
        return;
      }
      closeFilterMenu();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (state.trashOpen) {
          closeTrash();
          return;
        }
        if (state.filterMenuOpen) {
          closeFilterMenu({ focusButton: true });
          return;
        }
        if (state.calendar.open) {
          closeCalendar();
          return;
        }
        if (state.selectionMode) {
          exitSelectionMode();
          return;
        }
        if (document.activeElement instanceof HTMLElement &&
            document.activeElement.classList.contains('task-text')) {
          document.activeElement.blur();
        }
        return;
      }

      if (
        state.selectionMode &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'c' &&
        state.selected.size &&
        !(document.activeElement instanceof HTMLInputElement)
      ) {
        event.preventDefault();
        copySelection();
      }
    });

    window.addEventListener('resize', () => {
      if (state.calendar.open) closeCalendar();
      if (state.filterMenuOpen) closeFilterMenu();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.saveTimer) writeTasks(true);
    });

    window.addEventListener('beforeunload', () => {
      if (state.saveTimer) {
        clearTimeout(state.saveTimer);
        writeTasks(true);
      }
    });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = (event) => {
      let stored = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch (_) {
        stored = null;
      }
      if (!stored) {
        state.theme = event.matches ? 'dark' : 'light';
        applyTheme();
      }
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onMediaChange);
    }
  }

  /* -------------------------------------------------------
     Init
     ------------------------------------------------------- */

  function init() {
    state.tasks = loadTasks();
    const liveIds = new Set(state.tasks.map((task) => task.id));
    state.trash = loadTrash().filter((task) => !liveIds.has(task.id));
    state.theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    state.lastToday = todayISO();
    state.composerDate = todayISO();

    applyTheme();
    updateTodayLabel();
    updateComposerDate();
    bindEvents();
    renderTrash();
    render({ preserveScroll: false });

    newTaskInput.focus({ preventScroll: true });
    window.setInterval(tickClock, 60000);
  }

  init();
})();
