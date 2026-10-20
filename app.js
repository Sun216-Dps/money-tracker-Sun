(function () {
  'use strict';

  // ================= 常量 =================
  var STORAGE_KEY = 'jizhang-data-v1';
  var COLORS = ['#e85d5d', '#e8a33d', '#e8d33d', '#7fb545', '#3da5a5', '#3d8be8', '#7b5be8', '#d15be8', '#e85da0', '#9a9a9a'];

  var DEFAULT_CATEGORIES = {
    expense: [
      ['餐饮', '#e85d5d'], ['交通', '#3d8be8'], ['购物', '#e85da0'], ['居住', '#e8a33d'],
      ['娱乐', '#7b5be8'], ['医疗', '#3da5a5'], ['教育', '#e8d33d'], ['通讯', '#7fb545'], ['其他', '#9a9a9a']
    ],
    income: [
      ['工资', '#7fb545'], ['奖金', '#3da5a5'], ['兼职', '#3d8be8'],
      ['投资', '#e8a33d'], ['红包', '#e85da0'], ['其他', '#9a9a9a']
    ]
  };
  var DEFAULT_SOURCES = ['现金', '微信', '支付宝', '银行卡'];
  var DEFAULT_RECORDERS = ['我'];

  // ================= 工具 =================
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtMoney(n) { return '¥' + Number(n || 0).toFixed(2); }
  function toLocalDateTime(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function fmtDate(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ================= 数据层 =================
  function createDefaultState(seed) {
    var st = {
      version: 1,
      categories: { expense: [], income: [] },
      sources: [],
      recorders: [],
      transactions: []
    };
    ['expense', 'income'].forEach(function (type) {
      DEFAULT_CATEGORIES[type].forEach(function (pair) {
        st.categories[type].push({ id: uid(), name: pair[0], color: pair[1] });
      });
    });
    DEFAULT_SOURCES.forEach(function (name) { st.sources.push({ id: uid(), name: name }); });
    DEFAULT_RECORDERS.forEach(function (name) { st.recorders.push({ id: uid(), name: name }); });
    if (seed !== false) seedDemo(st);
    return st;
  }

  function seedDemo(state) {
    var now = new Date();
    function find(list, name) {
      for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
      return list[0];
    }
    function t(type, amount, catName, dayOffset, hour, minute, sourceName, recorderName, note) {
      var cats = state.categories[type];
      var d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hour, minute, 0, 0);
      state.transactions.push({
        id: uid(),
        type: type,
        amount: amount,
        categoryId: find(cats, catName).id,
        sourceId: find(state.sources, sourceName).id,
        recorderId: find(state.recorders, recorderName).id,
        note: note || '',
        dateTime: toLocalDateTime(d),
        createdAt: Date.now()
      });
    }
    t('income', 8500, '工资', -6, 9, 0, '银行卡', '我', '本月工资');
    t('expense', 25.5, '餐饮', -1, 12, 30, '微信', '我', '午饭');
    t('expense', 18, '交通', -1, 8, 10, '支付宝', '我', '地铁');
    t('expense', 299, '购物', -2, 20, 15, '微信', '我', '日用品');
    t('expense', 35, '餐饮', 0, 12, 0, '支付宝', '我', '午饭');
    t('expense', 12, '通讯', -3, 10, 0, '微信', '我', '话费');
    t('expense', 120, '居住', -10, 9, 0, '银行卡', '我', '水电费');
    t('expense', 58, '娱乐', -5, 19, 30, '微信', '我', '电影');
    t('income', 200, '红包', -4, 21, 0, '微信', '我', '红包');
    t('expense', 45, '医疗', -8, 15, 0, '支付宝', '我', '药品');
  }

  function normalizeState(s) {
    var st = {
      version: 1,
      categories: { expense: [], income: [] },
      sources: [],
      recorders: [],
      transactions: []
    };
    ['expense', 'income'].forEach(function (type) {
      var arr = (s.categories && s.categories[type]) || [];
      st.categories[type] = arr.map(function (c) {
        return { id: c.id || uid(), name: c.name || '未命名', color: c.color || COLORS[0] };
      });
    });
    (Array.isArray(s.sources) ? s.sources : []).forEach(function (x) {
      st.sources.push({ id: x.id || uid(), name: x.name || '未命名' });
    });
    (Array.isArray(s.recorders) ? s.recorders : []).forEach(function (x) {
      st.recorders.push({ id: x.id || uid(), name: x.name || '未命名' });
    });
    (Array.isArray(s.transactions) ? s.transactions : []).forEach(function (t) {
      st.transactions.push({
        id: t.id || uid(),
        type: t.type === 'income' ? 'income' : 'expense',
        amount: Number(t.amount) || 0,
        categoryId: t.categoryId || null,
        sourceId: t.sourceId || null,
        recorderId: t.recorderId || null,
        note: t.note || '',
        dateTime: t.dateTime || toLocalDateTime(new Date()),
        createdAt: t.createdAt || Date.now()
      });
    });
    return st;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.version === 1) return normalizeState(s);
      }
    } catch (e) { /* 忽略 */ }
    return createDefaultState(true);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* 忽略 */ }
  }

  var state = loadState();

  // ================= DOM 引用 =================
  var $ = function (id) { return document.getElementById(id); };
  var sumIncome = $('sumIncome');
  var sumExpense = $('sumExpense');
  var sumBalance = $('sumBalance');
  var recordList = $('recordList');
  var typeFilter = $('typeFilter');
  var statsIncome = $('statsIncome');
  var statsExpense = $('statsExpense');
  var statsBalance = $('statsBalance');
  var chartHint = $('chartHint');
  var barChart = $('barChart');
  var donut = $('donut');
  var donutTotal = $('donutTotal');
  var donutLegend = $('donutLegend');
  var donutType = $('donutType');
  var periodToggle = $('periodToggle');
  var catListExpense = $('catListExpense');
  var catListIncome = $('catListIncome');
  var sourceList = $('sourceList');
  var recorderList = $('recorderList');
  var modalMask = $('modalMask');
  var modalTitle = $('modalTitle');
  var typeToggle = $('typeToggle');
  var fAmount = $('fAmount');
  var fCategory = $('fCategory');
  var fDateTime = $('fDateTime');
  var fSource = $('fSource');
  var fRecorder = $('fRecorder');
  var fNote = $('fNote');
  var btnDeleteRecord = $('btnDeleteRecord');
  var toastEl = $('toast');

  // ================= 视图状态 =================
  var currentTab = 'record';
  var recordFilter = 'all';
  var statsPeriod = 'week';
  var donutTypeValue = 'expense';
  var editingId = null;
  var formState = null;

  // ================= 通用 =================
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toastEl.classList.add('hidden'); }, 1800);
  }

  function findCategory(type, id) {
    var list = state.categories[type] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function findSource(id) {
    for (var i = 0; i < state.sources.length; i++) if (state.sources[i].id === id) return state.sources[i];
    return null;
  }
  function findRecorder(id) {
    for (var i = 0; i < state.recorders.length; i++) if (state.recorders[i].id === id) return state.recorders[i];
    return null;
  }

  // ================= 顶部概览（本月） =================
  function renderHeader() {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    var end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    var income = 0, expense = 0;
    state.transactions.forEach(function (t) {
      var tm = new Date(t.dateTime).getTime();
      if (tm < start || tm >= end) return;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    sumIncome.textContent = fmtMoney(income);
    sumExpense.textContent = fmtMoney(expense);
    sumBalance.textContent = fmtMoney(income - expense);
  }

  // ================= 账目列表 =================
  function renderRecordList() {
    var list = state.transactions.slice();
    if (recordFilter !== 'all') {
      list = list.filter(function (t) { return t.type === recordFilter; });
    }
    list.sort(function (a, b) {
      var ta = new Date(a.dateTime).getTime();
      var tb = new Date(b.dateTime).getTime();
      if (tb !== ta) return tb - ta;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (list.length === 0) {
      recordList.innerHTML = '<div class="empty">还没有账目，点击右下角 ＋ 记一笔</div>';
      return;
    }

    // 按日期分组
    var groups = [];
    var curDate = null;
    list.forEach(function (t) {
      var day = t.dateTime.slice(0, 10);
      if (day !== curDate) {
        curDate = day;
        groups.push({ day: day, items: [] });
      }
      groups[groups.length - 1].items.push(t);
    });

    var html = '';
    groups.forEach(function (g) {
      var d = new Date(g.day + 'T00:00');
      var weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      var income = 0, expense = 0;
      g.items.forEach(function (t) {
        if (t.type === 'income') income += t.amount; else expense += t.amount;
      });
      var daySum = [];
      if (income > 0) daySum.push('收 ' + fmtMoney(income));
      if (expense > 0) daySum.push('支 ' + fmtMoney(expense));

      html += '<div class="rec-group">';
      html += '<div class="rec-date"><span>' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + weekday + '</span><span>' + (daySum.join(' · ') || '—') + '</span></div>';

      g.items.forEach(function (t) {
        var cat = findCategory(t.type, t.categoryId);
        var src = findSource(t.sourceId);
        var rec = findRecorder(t.recorderId);
        var sign = t.type === 'income' ? '+' : '-';
        var time = t.dateTime.slice(11, 16);
        var title = t.note || (cat ? cat.name : '未分类');
        var sub = (cat ? cat.name : '未分类') + ' · ' + (src ? src.name : '未指定') + ' · ' + (rec ? rec.name : '未指定') + ' · ' + time;

        html += '<button class="rec-item" type="button" data-id="' + t.id + '">' +
          '<span class="rec-dot" style="background:' + (cat ? cat.color : '#9a9a9a') + '"></span>' +
          '<span class="rec-main">' +
          '<span class="rec-title">' + escapeHtml(title) + '</span>' +
          '<span class="rec-sub">' + escapeHtml(sub) + '</span>' +
          '</span>' +
          '<span class="rec-amount ' + t.type + '">' + sign + fmtMoney(t.amount) + '</span>' +
          '</button>';
      });

      html += '</div>';
    });
    recordList.innerHTML = html;
  }

  // ================= 周期计算 =================
  function getPeriod(period) {
    var now = new Date();
    var today = startOfDay(now);

    if (period === 'week') {
      var dow = today.getDay();
      var diff = dow === 0 ? -6 : 1 - dow;
      var monday = addDays(today, diff);
      var names = ['一', '二', '三', '四', '五', '六', '日'];
      var buckets = [];
      for (var i = 0; i < 7; i++) {
        var s = addDays(monday, i);
        var e = addDays(monday, i + 1);
        buckets.push({ label: names[i], start: s.getTime(), end: e.getTime(), showLabel: true });
      }
      return {
        start: monday.getTime(),
        end: addDays(monday, 7).getTime(),
        buckets: buckets,
        hint: '本周（' + fmtDate(monday) + ' ~ ' + fmtDate(addDays(monday, 6)) + '）'
      };
    }

    if (period === 'month') {
      var y = now.getFullYear(), m = now.getMonth();
      var days = new Date(y, m + 1, 0).getDate();
      var bs = [];
      for (var d = 1; d <= days; d++) {
        var s2 = new Date(y, m, d);
        var e2 = new Date(y, m, d + 1);
        bs.push({ label: String(d), start: s2.getTime(), end: e2.getTime(), showLabel: d === 1 || d % 5 === 0 });
      }
      return {
        start: new Date(y, m, 1).getTime(),
        end: new Date(y, m + 1, 1).getTime(),
        buckets: bs,
        hint: y + '年' + (m + 1) + '月'
      };
    }

    // year
    var yy = now.getFullYear();
    var ybs = [];
    for (var mm = 0; mm < 12; mm++) {
      ybs.push({
        label: (mm + 1) + '月',
        start: new Date(yy, mm, 1).getTime(),
        end: new Date(yy, mm + 1, 1).getTime(),
        showLabel: true
      });
    }
    return {
      start: new Date(yy, 0, 1).getTime(),
      end: new Date(yy + 1, 0, 1).getTime(),
      buckets: ybs,
      hint: yy + '年'
    };
  }

  function bucketSums(period) {
    var p = getPeriod(period);
    var sums = p.buckets.map(function () { return { income: 0, expense: 0 }; });
    state.transactions.forEach(function (t) {
      var tm = new Date(t.dateTime).getTime();
      if (tm < p.start || tm >= p.end) return;
      for (var i = 0; i < p.buckets.length; i++) {
        var b = p.buckets[i];
        if (tm >= b.start && tm < b.end) {
          sums[i][t.type] += t.amount;
          return;
        }
      }
    });
    return { period: p, sums: sums };
  }

  // ================= 统计渲染 =================
  function renderStats() {
    var data = bucketSums(statsPeriod);
    var p = data.period;
    var sums = data.sums;

    var income = 0, expense = 0;
    sums.forEach(function (s) { income += s.income; expense += s.expense; });

    statsIncome.textContent = fmtMoney(income);
    statsExpense.textContent = fmtMoney(expense);
    statsBalance.textContent = fmtMoney(income - expense);
    statsBalance.classList.toggle('neg', income - expense < 0);

    renderBarChart(p, sums);
    renderDonut(p);
  }

  function renderBarChart(p, sums) {
    var max = 0;
    sums.forEach(function (s) { max = Math.max(max, s.income, s.expense); });
    if (max === 0) {
      barChart.innerHTML = '<div class="chart-empty">本期暂无收支记录</div>';
      chartHint.textContent = p.hint;
      return;
    }

    var W = 360, H = 190, PL = 8, PR = 8, PT = 14, PB = 30;
    var graphW = W - PL - PR, graphH = H - PT - PB;
    var n = sums.length;
    var step = graphW / n;
    var barW = Math.max(2.5, Math.min(16, step * 0.3));
    var gap = 1.2;
    var baseY = PT + graphH;
    var parts = [];

    parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">');
    parts.push('<line x1="' + PL + '" y1="' + baseY + '" x2="' + (W - PR) + '" y2="' + baseY + '" stroke="#2a3441" stroke-width="1"/>');

    sums.forEach(function (s, i) {
      var cx = PL + step * i + step / 2;
      var hi = graphH * s.income / max;
      var he = graphH * s.expense / max;

      parts.push('<rect x="' + (cx - barW - gap / 2).toFixed(2) + '" y="' + (baseY - hi).toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + hi.toFixed(2) + '" rx="1.5" fill="#4cc38a"/>');
      parts.push('<rect x="' + (cx + gap / 2).toFixed(2) + '" y="' + (baseY - he).toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + he.toFixed(2) + '" rx="1.5" fill="#f0605d"/>');

      var b = p.buckets[i];
      if (b.showLabel) {
        parts.push('<text x="' + cx.toFixed(2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="9" fill="#8b98a9">' + b.label + '</text>');
      }
    });

    parts.push('</svg>');
    barChart.innerHTML = parts.join('');
    chartHint.textContent = p.hint;
  }

  function renderDonut(p) {
    var type = donutTypeValue;
    var map = {};
    var total = 0;

    state.transactions.forEach(function (t) {
      if (t.type !== type) return;
      var tm = new Date(t.dateTime).getTime();
      if (tm < p.start || tm >= p.end) return;
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
      total += t.amount;
    });

    var slices = Object.keys(map).map(function (cid) {
      var cat = findCategory(type, cid);
      return {
        name: cat ? cat.name : '未分类',
        color: cat ? cat.color : '#9a9a9a',
        amount: map[cid]
      };
    }).sort(function (a, b) { return b.amount - a.amount; });

    if (total === 0) {
      donut.style.background = 'conic-gradient(#2a3441 0% 100%)';
      donutTotal.innerHTML = '<span>暂无</span>';
      donutLegend.innerHTML = '<div class="legend-empty">本期暂无' + (type === 'expense' ? '支出' : '收入') + '记录</div>';
      return;
    }

    var acc = 0;
    var stops = slices.map(function (s) {
      var from = acc / total * 100;
      var to = (acc + s.amount) / total * 100;
      acc += s.amount;
      return s.color + ' ' + from.toFixed(2) + '% ' + to.toFixed(2) + '%';
    });
    donut.style.background = 'conic-gradient(' + stops.join(', ') + ')';
    donutTotal.innerHTML = '<span>合计</span><b>' + fmtMoney(total) + '</b>';

    donutLegend.innerHTML = slices.map(function (s) {
      var pct = s.amount / total * 100;
      return '<div class="legend-row">' +
        '<span class="dot" style="background:' + s.color + '"></span>' +
        '<span class="legend-name">' + escapeHtml(s.name) + '</span>' +
        '<span class="legend-pct">' + (pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)) + '%</span>' +
        '<span class="legend-amt">' + fmtMoney(s.amount) + '</span>' +
        '</div>';
    }).join('');
  }

  // ================= 分类管理 =================
  function renderCategories() {
    renderCatList(catListExpense, 'expense');
    renderCatList(catListIncome, 'income');
  }

  function renderCatList(container, type) {
    var list = state.categories[type];
    if (list.length === 0) {
      container.innerHTML = '<div class="empty" style="padding:16px 0">暂无分类，点击上方「＋ 添加」</div>';
      return;
    }
    container.innerHTML = list.map(function (cat) {
      return '<div class="cat-row" data-cat-id="' + cat.id + '" data-cat-type="' + type + '">' +
        '<span class="dot" style="background:' + cat.color + '"></span>' +
        '<span class="cat-name">' + escapeHtml(cat.name) + '</span>' +
        '<span class="cat-actions">' +
        '<button class="btn-icon" data-act="edit" type="button">改名</button>' +
        '<button class="btn-icon danger" data-act="del" type="button">删除</button>' +
        '</span></div>';
    }).join('');
  }

  function addCategory(type) {
    var name = window.prompt('新' + (type === 'expense' ? '支出' : '收入') + '分类名称');
    if (name === null) return;
    name = name.trim();
    if (!name) { toast('分类名称不能为空'); return; }
    if (state.categories[type].some(function (c) { return c.name === name; })) {
      toast('该分类已存在');
      return;
    }
    var color = COLORS[state.categories[type].length % COLORS.length];
    state.categories[type].push({ id: uid(), name: name, color: color });
    saveState();
    renderAll();
    toast('已添加分类「' + name + '」');
  }

  function editCategory(type, id) {
    var cat = findCategory(type, id);
    if (!cat) return;
    var name = window.prompt('修改分类名称', cat.name);
    if (name === null) return;
    name = name.trim();
    if (!name) { toast('分类名称不能为空'); return; }
    if (state.categories[type].some(function (c) { return c.id !== id && c.name === name; })) {
      toast('该分类已存在');
      return;
    }
    cat.name = name;
    saveState();
    renderAll();
    toast('已改名');
  }

  function deleteCategory(type, id) {
    var cat = findCategory(type, id);
    if (!cat) return;
    var used = state.transactions.filter(function (t) { return t.type === type && t.categoryId === id; }).length;
    var msg = '确定删除分类「' + cat.name + '」吗？';
    if (used > 0) msg += '\n该分类下有 ' + used + ' 笔记录，将被归入其他分类。';
    if (!window.confirm(msg)) return;

    var rest = state.categories[type].filter(function (c) { return c.id !== id; });
    if (rest.length === 0) { toast('至少保留一个分类'); return; }
    var fallback = null;
    for (var i = 0; i < rest.length; i++) if (rest[i].name === '其他') { fallback = rest[i]; break; }
    if (!fallback) fallback = rest[0];
    state.transactions.forEach(function (t) {
      if (t.type === type && t.categoryId === id) t.categoryId = fallback.id;
    });
    state.categories[type] = rest;
    saveState();
    renderAll();
    toast('已删除分类');
  }

  // ================= 资金来源 / 记账人 =================
  function renderSettings() {
    renderSimpleList(sourceList, state.sources, 'source');
    renderSimpleList(recorderList, state.recorders, 'recorder');
  }

  function renderSimpleList(container, list, kind) {
    if (list.length === 0) {
      container.innerHTML = '<div class="empty" style="padding:16px 0">暂无，点击上方「＋ 添加」</div>';
      return;
    }
    container.innerHTML = list.map(function (item) {
      return '<div class="simple-row" data-id="' + item.id + '" data-kind="' + kind + '">' +
        '<span class="cat-name">' + escapeHtml(item.name) + '</span>' +
        '<button class="btn-icon danger" data-act="del" type="button">删除</button></div>';
    }).join('');
  }

  function addSource() {
    var name = window.prompt('新资金来源名称（如：招商银行、花呗）');
    if (name === null) return;
    name = name.trim();
    if (!name) { toast('名称不能为空'); return; }
    if (state.sources.some(function (s) { return s.name === name; })) { toast('已存在'); return; }
    state.sources.push({ id: uid(), name: name });
    saveState();
    renderSettings();
    toast('已添加');
  }

  function addRecorder() {
    var name = window.prompt('新记账人名称');
    if (name === null) return;
    name = name.trim();
    if (!name) { toast('名称不能为空'); return; }
    if (state.recorders.some(function (r) { return r.name === name; })) { toast('已存在'); return; }
    state.recorders.push({ id: uid(), name: name });
    saveState();
    renderSettings();
    toast('已添加');
  }

  function deleteSimple(kind, id) {
    var list = kind === 'source' ? state.sources : state.recorders;
    var item = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { item = list[i]; break; }
    if (!item) return;
    if (!window.confirm('确定删除「' + item.name + '」吗？')) return;
    var rest = list.filter(function (x) { return x.id !== id; });
    if (rest.length === 0) { toast('至少保留一项'); return; }
    var fallback = rest[0];
    state.transactions.forEach(function (t) {
      if (kind === 'source' && t.sourceId === id) t.sourceId = fallback.id;
      if (kind === 'recorder' && t.recorderId === id) t.recorderId = fallback.id;
    });
    if (kind === 'source') state.sources = rest;
    else state.recorders = rest;
    saveState();
    renderSettings();
    toast('已删除');
  }

  // ================= 记账弹窗 =================
  function openRecordModal(record) {
    editingId = record ? record.id : null;
    modalTitle.textContent = record ? '编辑账目' : '记一笔';
    btnDeleteRecord.classList.toggle('hidden', !record);

    if (record) {
      formState = {
        type: record.type,
        amount: String(record.amount),
        categoryId: record.categoryId,
        dateTime: record.dateTime,
        sourceId: record.sourceId,
        recorderId: record.recorderId,
        note: record.note || ''
      };
    } else {
      var expCats = state.categories.expense;
      formState = {
        type: 'expense',
        amount: '',
        categoryId: expCats.length ? expCats[0].id : null,
        dateTime: toLocalDateTime(new Date()),
        sourceId: state.sources.length ? state.sources[0].id : null,
        recorderId: state.recorders.length ? state.recorders[0].id : null,
        note: ''
      };
    }

    fAmount.value = formState.amount;
    fDateTime.value = formState.dateTime;
    fNote.value = formState.note;
    setFormType(formState.type);
    renderFormChoices();
    modalMask.classList.remove('hidden');
  }

  function closeRecordModal() {
    modalMask.classList.add('hidden');
    editingId = null;
    formState = null;
  }

  function setFormType(type) {
    formState.type = type;
    var btns = typeToggle.querySelectorAll('.ft-btn');
    btns.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-type') === type); });

    var cats = state.categories[type] || [];
    var exists = cats.some(function (c) { return c.id === formState.categoryId; });
    if (!exists) formState.categoryId = cats.length ? cats[0].id : null;
  }

  function renderFormChoices() {
    // 分类
    var cats = state.categories[formState.type] || [];
    fCategory.innerHTML = cats.map(function (c) {
      return '<button class="choice' + (c.id === formState.categoryId ? ' active' : '') + '" type="button" data-cat-id="' + c.id + '">' + escapeHtml(c.name) + '</button>';
    }).join('');

    // 资金来源
    fSource.innerHTML = state.sources.map(function (s) {
      return '<button class="choice' + (s.id === formState.sourceId ? ' active' : '') + '" type="button" data-source-id="' + s.id + '">' + escapeHtml(s.name) + '</button>';
    }).join('');

    // 记账人
    fRecorder.innerHTML = state.recorders.map(function (r) {
      return '<button class="choice' + (r.id === formState.recorderId ? ' active' : '') + '" type="button" data-recorder-id="' + r.id + '">' + escapeHtml(r.name) + '</button>';
    }).join('');
  }

  function selectChoice(container, selector, id) {
    var btns = container.querySelectorAll('.choice');
    btns.forEach(function (b) {
      var matched = b.getAttribute(selector) === id;
      b.classList.toggle('active', matched);
    });
  }

  function saveRecord() {
    var amount = Number(fAmount.value);
    if (!isFinite(amount) || amount <= 0) { toast('请输入正确的金额'); return; }
    if (!formState.categoryId) { toast('请选择分类'); return; }
    if (!fDateTime.value) { toast('请选择日期时间'); return; }

    var record = {
      id: editingId || uid(),
      type: formState.type,
      amount: Math.round(amount * 100) / 100,
      categoryId: formState.categoryId,
      sourceId: formState.sourceId,
      recorderId: formState.recorderId,
      note: fNote.value.trim(),
      dateTime: fDateTime.value.length === 16 ? fDateTime.value : (fDateTime.value + ':00').slice(0, 16),
      createdAt: Date.now()
    };

    var isEdit = !!editingId;
    if (isEdit) {
      for (var i = 0; i < state.transactions.length; i++) {
        if (state.transactions[i].id === editingId) {
          state.transactions[i] = record;
          break;
        }
      }
    } else {
      state.transactions.push(record);
    }
    saveState();
    closeRecordModal();
    renderAll();
    toast(isEdit ? '已保存修改' : '已记账');
  }

  function deleteRecord() {
    if (!editingId) return;
    if (!window.confirm('确定删除这笔账目吗？')) return;
    state.transactions = state.transactions.filter(function (t) { return t.id !== editingId; });
    saveState();
    closeRecordModal();
    renderAll();
    toast('已删除');
  }

  // ================= 数据管理 =================
  // 保存 Blob：Android WebView 内优先走原生桥（存到「下载」目录），浏览器内走普通下载
  function saveBlob(blob, filename) {
    if (window.AndroidBridge && typeof window.AndroidBridge.saveFile === 'function') {
      var reader = new FileReader();
      reader.onloadend = function () {
        var result = String(reader.result || '');
        var base64 = result.indexOf(',') >= 0 ? result.split(',')[1] : result;
        try { window.AndroidBridge.saveFile(filename, base64); }
        catch (e) { toast('保存失败：' + ((e && e.message) || '未知错误')); }
      };
      reader.readAsDataURL(blob);
      return true;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return false;
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var viaBridge = saveBlob(blob, 'jizhang-backup-' + toLocalDateTime(new Date()).slice(0, 10) + '.json');
    toast(viaBridge ? '正在保存备份到手机…' : '已导出备份文件');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var s = JSON.parse(reader.result);
        if (!s || s.version !== 1 || !s.categories || !s.transactions) throw new Error('bad');
        state = normalizeState(s);
        saveState();
        renderAll();
        toast('数据导入成功');
      } catch (e) {
        toast('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    if (!window.confirm('确定清空所有数据吗？此操作不可撤销。')) return;
    state = createDefaultState(false);
    saveState();
    renderAll();
    toast('已清空所有数据');
  }

  // ================= Excel 导入 / 导出 =================
  function exportExcel() {
    var rows = state.transactions.slice().sort(function (a, b) {
      return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
    }).map(function (t) {
      var cat = findCategory(t.type, t.categoryId);
      var src = findSource(t.sourceId);
      var rec = findRecorder(t.recorderId);
      return [
        t.dateTime.replace('T', ' '),
        t.type === 'income' ? '收入' : '支出',
        t.amount,
        cat ? cat.name : '',
        src ? src.name : '',
        rec ? rec.name : '',
        t.note || ''
      ];
    });

    var bytes = XlsxLite.buildXlsxBytes(rows);
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var viaBridge = saveBlob(blob, '账目-' + toLocalDateTime(new Date()).slice(0, 10) + '.xlsx');
    toast(viaBridge ? '正在保存 Excel 到手机…' : '已导出 Excel：' + rows.length + ' 条记录');
  }

  function cellValue(cell, shared) {
    var t = cell.getAttribute('t');
    var vEl = cell.getElementsByTagName('v')[0];
    var v = vEl ? vEl.textContent : '';
    if (t === 's') {
      var idx = parseInt(v, 10);
      return isNaN(idx) ? '' : (shared[idx] !== undefined ? shared[idx] : '');
    }
    if (t === 'inlineStr') {
      var isEl = cell.getElementsByTagName('is')[0];
      if (!isEl) return '';
      var ts = isEl.getElementsByTagName('t');
      var out = '';
      for (var i = 0; i < ts.length; i++) out += ts[i].textContent;
      return out;
    }
    return v;
  }

  function readRows(doc, shared) {
    var rows = [];
    var rowEls = doc.getElementsByTagName('row');
    for (var r = 0; r < rowEls.length; r++) {
      var cells = rowEls[r].getElementsByTagName('c');
      var arr = [];
      for (var c = 0; c < cells.length; c++) {
        var cell = cells[c];
        var ref = cell.getAttribute('r');
        var idx = ref ? XlsxLite.colIndex(ref) : arr.length;
        if (idx < 0) idx = arr.length;
        while (arr.length < idx) arr.push('');
        arr[idx] = cellValue(cell, shared);
      }
      rows.push(arr);
    }
    return rows;
  }

  async function findSheetPath(entries) {
    try {
      var wbBytes = await XlsxLite.entryBytes(entries, 'xl/workbook.xml');
      var relsBytes = await XlsxLite.entryBytes(entries, 'xl/_rels/workbook.xml.rels');
      if (wbBytes && relsBytes) {
        var wbDoc = new DOMParser().parseFromString(XlsxLite.decodeText(wbBytes), 'application/xml');
        var sheets = wbDoc.getElementsByTagName('sheet');
        if (sheets.length) {
          var rid = sheets[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
            sheets[0].getAttribute('r:id');
          var relsDoc = new DOMParser().parseFromString(XlsxLite.decodeText(relsBytes), 'application/xml');
          var relEls = relsDoc.getElementsByTagName('Relationship');
          for (var i = 0; i < relEls.length; i++) {
            if (relEls[i].getAttribute('Id') === rid) {
              var target = String(relEls[i].getAttribute('Target') || '');
              if (target) {
                var p = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target;
                if (entries[p]) return p;
              }
              break;
            }
          }
        }
      }
    } catch (e) { /* 忽略，走兜底 */ }

    var names = Object.keys(entries);
    for (var k = 0; k < names.length; k++) {
      if (/^xl\/worksheets\/[^/]+\.xml$/i.test(names[k])) return names[k];
    }
    throw new Error('未找到工作表');
  }

  async function parseSheetRows(file) {
    var buffer = await file.arrayBuffer();
    var entries = XlsxLite.unzipEntries(buffer);

    var shared = [];
    var sharedBytes = await XlsxLite.entryBytes(entries, 'xl/sharedStrings.xml');
    if (sharedBytes) {
      var sdoc = new DOMParser().parseFromString(XlsxLite.decodeText(sharedBytes), 'application/xml');
      var sis = sdoc.getElementsByTagName('si');
      for (var i = 0; i < sis.length; i++) {
        var ts = sis[i].getElementsByTagName('t');
        var str = '';
        for (var j = 0; j < ts.length; j++) str += ts[j].textContent;
        shared.push(str);
      }
    }

    var sheetPath = await findSheetPath(entries);
    var sheetBytes = await XlsxLite.entryBytes(entries, sheetPath);
    if (!sheetBytes) throw new Error('未找到工作表');
    var doc = new DOMParser().parseFromString(XlsxLite.decodeText(sheetBytes), 'application/xml');
    return readRows(doc, shared);
  }

  function parseCsvText(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var rows = [], row = [], cur = '', inQuote = false, i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (inQuote) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
          inQuote = false; i++; continue;
        }
        cur += ch; i++; continue;
      }
      if (ch === '"') { inQuote = true; i++; continue; }
      if (ch === ',') { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += ch; i++;
    }
    if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
    return rows;
  }

  var HEADER_DEFS = {
    dateTime: ['日期时间', '日期', '时间', '交易时间', 'datetime', 'date'],
    type: ['类型', '收支类型', '收支', 'type'],
    amount: ['金额', '数额', 'amount'],
    category: ['分类', '类别', '分类名称', 'category'],
    source: ['资金来源', '来源', '账户', '支付方式', 'source'],
    recorder: ['记账人', '记录人', '用户', 'recorder'],
    note: ['备注', '说明', 'remark', 'note']
  };

  function mapHeaders(row) {
    var map = {};
    (row || []).forEach(function (h, i) {
      var name = String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, '');
      if (!name) return;
      var keys = Object.keys(HEADER_DEFS);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (map[key] !== undefined) continue;
        var syns = HEADER_DEFS[key];
        for (var s = 0; s < syns.length; s++) {
          if (name.indexOf(syns[s].toLowerCase()) >= 0) { map[key] = i; break; }
        }
        if (map[key] !== undefined) break;
      }
    });
    return map;
  }

  function parseAmount(raw) {
    var s = String(raw == null ? '' : raw).replace(/[¥￥,，\s元]/g, '');
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }

  function parseType(raw) {
    var s = String(raw == null ? '' : raw).trim().toLowerCase();
    if (s.indexOf('收入') >= 0 || s.indexOf('income') >= 0 || s === '收' || s === 'in') return 'income';
    return 'expense';
  }

  function parseDateTime(raw) {
    var s = String(raw == null ? '' : raw).trim();
    var fallback = toLocalDateTime(new Date());
    if (!s) return fallback;

    // Excel 序列号（如 46000.5）
    if (/^\d+(\.\d+)?$/.test(s)) {
      var serial = parseFloat(s);
      if (serial > 20000 && serial < 80000) {
        var utc = new Date((serial - 25569) * 86400000);
        var d = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes());
        return toLocalDateTime(d);
      }
    }

    var m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})[日]?(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (m) {
      var d2 = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, 0, 0);
      return toLocalDateTime(d2);
    }

    var d3 = new Date(s);
    if (!isNaN(d3.getTime())) return toLocalDateTime(d3);
    return fallback;
  }

  function ensureCategory(type, name) {
    var list = state.categories[type];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    var c = { id: uid(), name: name, color: COLORS[list.length % COLORS.length] };
    list.push(c);
    return c;
  }

  function ensureSource(name) {
    for (var i = 0; i < state.sources.length; i++) if (state.sources[i].name === name) return state.sources[i];
    var s = { id: uid(), name: name };
    state.sources.push(s);
    return s;
  }

  function ensureRecorder(name) {
    for (var i = 0; i < state.recorders.length; i++) if (state.recorders[i].name === name) return state.recorders[i];
    var r = { id: uid(), name: name };
    state.recorders.push(r);
    return r;
  }

  function importRows(rows) {
    var headerIdx = -1;
    var map = null;
    var scan = Math.min(rows.length, 5);
    for (var i = 0; i < scan; i++) {
      var m = mapHeaders(rows[i]);
      if (m.amount !== undefined) { headerIdx = i; map = m; break; }
    }
    if (!map) {
      headerIdx = -1;
      map = { dateTime: 0, type: 1, amount: 2, category: 3, source: 4, recorder: 5, note: 6 };
    }

    var imported = 0, skipped = 0;
    for (var r = headerIdx + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.length === 0) continue;

      var amount = parseAmount(map.amount !== undefined ? row[map.amount] : '');
      if (!(amount > 0)) { skipped++; continue; }

      var type = parseType(map.type !== undefined ? row[map.type] : '');
      var catName = String(map.category !== undefined ? (row[map.category] || '') : '').trim() || '其他';
      var srcName = String(map.source !== undefined ? (row[map.source] || '') : '').trim() || '现金';
      var recName = String(map.recorder !== undefined ? (row[map.recorder] || '') : '').trim() || '我';
      var note = String(map.note !== undefined ? (row[map.note] || '') : '').trim();
      var dt = parseDateTime(map.dateTime !== undefined ? row[map.dateTime] : '');

      var cat = ensureCategory(type, catName);
      var src = ensureSource(srcName);
      var rec = ensureRecorder(recName);
      state.transactions.push({
        id: uid(),
        type: type,
        amount: amount,
        categoryId: cat.id,
        sourceId: src.id,
        recorderId: rec.id,
        note: note,
        dateTime: dt,
        createdAt: Date.now()
      });
      imported++;
    }

    saveState();
    return { imported: imported, skipped: skipped };
  }

  async function handleExcelImport(file) {
    try {
      var rows;
      if (/\.csv$/i.test(file.name)) {
        rows = parseCsvText(await file.text());
      } else {
        if (/\.xls$/i.test(file.name)) throw new Error('不支持旧版 .xls，请用 Excel 另存为 .xlsx 或 .csv');
        rows = await parseSheetRows(file);
      }
      if (!rows || rows.length === 0) { toast('文件中没有数据'); return; }
      var res = importRows(rows);
      renderAll();
      if (res.imported > 0) {
        toast('导入成功：' + res.imported + ' 条' + (res.skipped ? '（跳过 ' + res.skipped + ' 行）' : ''));
      } else {
        toast('未识别到有效记录，请检查列名与金额');
      }
    } catch (e) {
      console.error(e);
      toast('导入失败：' + ((e && e.message) || '文件格式不正确'));
    }
  }

  // ================= 视图切换 =================
  function switchTab(tab) {
    currentTab = tab;
    var views = ['record', 'stats', 'categories', 'settings'];
    views.forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== tab);
    });
    var tabs = document.querySelectorAll('#tabbar .tab');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  }

  // ================= 总渲染 =================
  function renderAll() {
    renderHeader();
    renderRecordList();
    renderStats();
    renderCategories();
    renderSettings();
  }

  // ================= 事件绑定 =================
  document.getElementById('tabbar').addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (btn) switchTab(btn.getAttribute('data-tab'));
  });

  document.getElementById('fabAdd').addEventListener('click', function () {
    openRecordModal(null);
  });

  modalMask.addEventListener('click', function (e) {
    if (e.target === modalMask) closeRecordModal();
  });
  document.getElementById('modalClose').addEventListener('click', closeRecordModal);

  typeToggle.addEventListener('click', function (e) {
    var btn = e.target.closest('.ft-btn');
    if (!btn) return;
    setFormType(btn.getAttribute('data-type'));
    renderFormChoices();
  });

  fCategory.addEventListener('click', function (e) {
    var btn = e.target.closest('.choice');
    if (!btn) return;
    formState.categoryId = btn.getAttribute('data-cat-id');
    selectChoice(fCategory, 'data-cat-id', formState.categoryId);
  });

  fSource.addEventListener('click', function (e) {
    var btn = e.target.closest('.choice');
    if (!btn) return;
    formState.sourceId = btn.getAttribute('data-source-id');
    selectChoice(fSource, 'data-source-id', formState.sourceId);
  });

  fRecorder.addEventListener('click', function (e) {
    var btn = e.target.closest('.choice');
    if (!btn) return;
    formState.recorderId = btn.getAttribute('data-recorder-id');
    selectChoice(fRecorder, 'data-recorder-id', formState.recorderId);
  });

  document.getElementById('btnSaveRecord').addEventListener('click', saveRecord);
  btnDeleteRecord.addEventListener('click', deleteRecord);

  // 账目列表点击编辑
  recordList.addEventListener('click', function (e) {
    var item = e.target.closest('.rec-item');
    if (!item) return;
    var id = item.getAttribute('data-id');
    var record = null;
    for (var i = 0; i < state.transactions.length; i++) {
      if (state.transactions[i].id === id) { record = state.transactions[i]; break; }
    }
    if (record) openRecordModal(record);
  });

  // 类型筛选
  typeFilter.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    recordFilter = chip.getAttribute('data-filter');
    var chips = typeFilter.querySelectorAll('.chip');
    chips.forEach(function (c) { c.classList.toggle('active', c === chip); });
    renderRecordList();
  });

  // 统计周期
  periodToggle.addEventListener('click', function (e) {
    var btn = e.target.closest('.pt-btn');
    if (!btn) return;
    statsPeriod = btn.getAttribute('data-period');
    var btns = periodToggle.querySelectorAll('.pt-btn');
    btns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    renderStats();
  });

  // 环形图类型
  donutType.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    donutTypeValue = chip.getAttribute('data-dtype');
    var chips = donutType.querySelectorAll('.chip');
    chips.forEach(function (c) { c.classList.toggle('active', c === chip); });
    renderStats();
  });

  // 分类增删改
  document.querySelectorAll('[data-add-cat]').forEach(function (btn) {
    btn.addEventListener('click', function () { addCategory(btn.getAttribute('data-add-cat')); });
  });

  catListExpense.addEventListener('click', function (e) {
    handleCatAction(e, 'expense');
  });
  catListIncome.addEventListener('click', function (e) {
    handleCatAction(e, 'income');
  });

  function handleCatAction(e, type) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var row = btn.closest('.cat-row');
    if (!row) return;
    var id = row.getAttribute('data-cat-id');
    var act = btn.getAttribute('data-act');
    if (act === 'edit') editCategory(type, id);
    else if (act === 'del') deleteCategory(type, id);
  }

  // 资金来源 / 记账人
  document.getElementById('btnAddSource').addEventListener('click', addSource);
  document.getElementById('btnAddRecorder').addEventListener('click', addRecorder);

  sourceList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act="del"]');
    if (!btn) return;
    var row = btn.closest('.simple-row');
    if (row) deleteSimple('source', row.getAttribute('data-id'));
  });

  recorderList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act="del"]');
    if (!btn) return;
    var row = btn.closest('.simple-row');
    if (row) deleteSimple('recorder', row.getAttribute('data-id'));
  });

  // 数据管理
  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImport').addEventListener('click', function () {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (file) importData(file);
    this.value = '';
  });
  document.getElementById('btnClear').addEventListener('click', clearAll);

  // Excel 导入 / 导出
  document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
  document.getElementById('btnImportExcel').addEventListener('click', function () {
    document.getElementById('fileImportExcel').click();
  });
  document.getElementById('fileImportExcel').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (file) handleExcelImport(file);
    this.value = '';
  });

  // ================= 启动 =================
  saveState();
  renderAll();
  switchTab('record');
})();
