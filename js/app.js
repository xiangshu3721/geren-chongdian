/* 个人充电 · 界面：三个页面（hash 路由）+ localStorage。计算全部来自 engine.js / rules.js */
(function () {
  "use strict";
  var R = window.RULES, E = window.Engine;
  var KEY = "gcd.v1", KEEP = 30;
  var view = document.getElementById("view");
  var memStore = null, storageOK = true, storageNote = "";
  var RK = window.ResultKit;
  if (RK) RK.configure({
    id: "gcd", title: "个人充电", onRestart: function () { restartTest(); },
    // 导出图片 / 历史里导出：把「今日耗电地图」页上的全部内容画进长图（只在地图页才抓取，避免抓到别的页）
    capture: function () {
      if (view.getAttribute("data-ready") !== "map") return null;
      var foot = document.querySelector(".foot");
      return RK.capture(view, { skip: ".btn,.btn-row,a.btn" }).concat(foot ? RK.capture(foot) : []);
    }
  });
  /* 重新测试：清掉当前作答，回到第一问（历史记录不动） */
  function restartTest() {
    if (RK) RK.nickReset();
    draft = null; initDraft(null);
    if (location.hash === "#/aware") renderAware(); else location.hash = "#/aware";
  }
  /* 交给「历史 / 导出图片」的摘要 */
  function summaryOf(rec) {
    var r = calc(rec), toneOf = function (v) { return v >= 60 ? "high" : v >= 35 ? "mid" : "ok"; };
    var notes = [];
    if (r.stage) { var c = R.chain.filter(function (x) { return x.key === r.stage; })[0]; if (c) { notes.push(c.now); notes.push(c.cut); } }
    notes.push(R.insights.shift);
    return {
      headline: "今天的电量 " + r.score + " / 100 · " + r.band.label,
      sub: r.band.tagline,
      who: "你说的状态：" + r.stateLabel,
      metrics: [{ label: "今日电量", value: r.score + " / 100", frac: r.score / 100, tone: r.score >= 60 ? "ok" : r.score >= 35 ? "mid" : "high" }].concat(
        R.dims.map(function (d) { return { label: d.name + "（越高漏得越多）", value: r.dims[d.key] + " · " + E.dimLevel(r.dims[d.key]), frac: r.dims[d.key] / 100, tone: toneOf(r.dims[d.key]) }; })
      ),
      notes: notes.slice(0, 4)
    };
  }

  /* ---------- 存储（带错误兜底） ---------- */
  function emptyData() { return { v: 1, records: [] }; }
  function load() {
    if (memStore) return memStore;
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); }
    catch (e) { storageOK = false; storageNote = "这个浏览器不让保存数据（可能开了无痕模式）。这次的内容关掉页面就没了。"; memStore = emptyData(); return memStore; }
    if (!raw) return emptyData();
    try {
      var d = JSON.parse(raw);
      if (!d || !Array.isArray(d.records)) throw new Error("bad");
      d.records = d.records.filter(validRecord);
      return d;
    } catch (e) {
      storageNote = "之前保存的数据读不出来了，已经帮你重新开始。";
      try { window.localStorage.removeItem(KEY); } catch (e2) {}
      return emptyData();
    }
  }
  function validRecord(r) {
    if (!r || typeof r.date !== "string" || !Array.isArray(r.sourceIds)) return false;
    try {
      E.compute({ stateId: r.stateId || null, customText: r.customText || "", sourceIds: r.sourceIds });
      return true;
    } catch (e) { return false; }
  }
  function save(d) {
    d.records.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    d.records = d.records.slice(-KEEP);
    memStore = d;
    try { window.localStorage.setItem(KEY, JSON.stringify(d)); storageOK = true; }
    catch (e) { storageOK = false; storageNote = "没能保存到本机（存储空间不够或被禁用）。这次的内容关掉页面就没了。"; }
  }
  function today() { var n = new Date(); return n.getFullYear() + "-" + p2(n.getMonth() + 1) + "-" + p2(n.getDate()); }
  function p2(n) { return n < 10 ? "0" + n : "" + n; }
  function dayIndex(date) { var p = date.split("-"); return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
  function todayRecord(d) { var t = today(); for (var i = 0; i < d.records.length; i++) if (d.records[i].date === t) return d.records[i]; return null; }
  function calc(rec) { return E.compute({ stateId: rec.stateId || null, customText: rec.customText || "", sourceIds: rec.sourceIds, dayIndex: dayIndex(rec.date) }); }

  /* ---------- 小工具 ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var toastT;
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2400); }
  function banner() { return storageNote ? '<div class="banner" role="alert">' + esc(storageNote) + "</div>" : ""; }
  function fillText(s, n) { return s.replace("{n}", n); }
  function dateLabel() { var n = new Date(); return (n.getMonth() + 1) + " 月 " + n.getDate() + " 日 · 周" + "日一二三四五六".charAt(n.getDay()); }
  document.getElementById("topDate").textContent = dateLabel();

  /* ---------- 组件 ---------- */
  function batterySVG(score) {
    var w = Math.max(0, Math.min(100, score)) * 1.72; // 内部最大 172
    var band = E.bandOf(score).key;
    var color = { low: "#a8553f", drain: "#c4803a", recover: "#4a7c64", full: "#2f5d4a" }[band];
    return '<svg viewBox="0 0 200 96" role="img" aria-label="今日电量 ' + score + ' 分">' +
      '<rect x="3" y="8" width="182" height="80" rx="20" fill="#fffdf6" stroke="#2f5d4a" stroke-width="3"/>' +
      '<rect x="188" y="34" width="9" height="28" rx="4" fill="#2f5d4a"/>' +
      '<clipPath id="bc"><rect x="9" y="14" width="170" height="68" rx="15"/></clipPath>' +
      '<g clip-path="url(#bc)"><rect x="9" y="14" width="' + (w * 170 / 172) + '" height="68" fill="' + color + '" opacity=".28"/>' +
      '<rect x="9" y="14" width="' + (w * 170 / 172) + '" height="10" fill="' + color + '" opacity=".25"/></g></svg>';
  }
  function bandsBar(score) {
    return '<div class="bands" aria-hidden="true">' + R.bands.map(function (b) {
      return '<div class="' + (score >= b.min && score <= b.max ? "on" : "") + '">' + b.label + "</div>";
    }).join("") + "</div>";
  }
  function radarSVG(dims) {
    var cx = 150, cy = 120, rad = 82, pts = [], axes = "", labels = "";
    var ang = [-90, 0, 90, 180]; // 上右下左：身体、情绪、关系、世界
    R.dims.forEach(function (d, i) {
      var a = ang[i] * Math.PI / 180, v = dims[d.key] / 100;
      pts.push((cx + Math.cos(a) * rad * Math.max(v, 0.04)).toFixed(1) + "," + (cy + Math.sin(a) * rad * Math.max(v, 0.04)).toFixed(1));
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * rad) + '" y2="' + (cy + Math.sin(a) * rad) + '" stroke="#d9d1b6" stroke-width="1"/>';
      var lx = cx + Math.cos(a) * (rad + 22), ly = cy + Math.sin(a) * (rad + 22) + 4;
      var anchor = i === 1 ? "start" : i === 3 ? "end" : "middle";
      if (i === 1) lx -= 14; if (i === 3) lx += 14;
      labels += '<text x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '" font-size="13" fill="#25362e">' + d.short + " " + dims[d.key] + "</text>";
    });
    var rings = [0.33, 0.66, 1].map(function (k) {
      var p = ang.map(function (a) { a = a * Math.PI / 180; return (cx + Math.cos(a) * rad * k) + "," + (cy + Math.sin(a) * rad * k); }).join(" ");
      return '<polygon points="' + p + '" fill="none" stroke="#e2dac2" stroke-width="1"/>';
    }).join("");
    return '<svg class="radar" viewBox="0 0 300 240" role="img" aria-label="四维耗电地图">' + rings + axes +
      '<polygon points="' + pts.join(" ") + '" fill="#c9a050" fill-opacity=".35" stroke="#b8862f" stroke-width="2" stroke-linejoin="round"/>' + labels + "</svg>";
  }
  function emptyState(title, text) {
    return '<section class="card empty fade"><svg viewBox="0 0 120 90" aria-hidden="true"><circle cx="86" cy="24" r="12" fill="#d9b46a" opacity=".3"/>' +
      '<path d="M0 78 C20 52 34 44 50 56 C64 66 72 40 90 42 C104 44 112 56 120 52 L120 90 L0 90Z" fill="#2f5d4a" opacity=".16"/>' +
      '<path d="M0 84 C26 68 46 66 66 76 C86 86 104 72 120 74 L120 90 L0 90Z" fill="#2f5d4a" opacity=".22"/></svg>' +
      "<h2>" + title + "</h2><p>" + text + '</p><a class="btn" href="#/aware">去做今日觉察</a></section>';
  }

  /* ---------- 页面 1：今日觉察 ---------- */
  var draft = null;
  function initDraft(rec) {
    draft = rec ? { stateId: rec.stateId || null, custom: !rec.stateId, customText: rec.customText || "", sourceIds: rec.sourceIds.slice() }
                : { stateId: null, custom: false, customText: "", sourceIds: [] };
  }
  function renderAware() {
    // 昵称门槛：打开「今日觉察」（含直接打开链接、刷新、重新选一次）就要先有昵称；点「返回」去看地图
    if (RK) RK.guard(true, function () { location.hash = "#/map"; });
    var data = load(), rec = todayRecord(data);
    if (!draft) initDraft(rec);
    var html = banner();
    html += '<h1>先看一眼，现在的你</h1><p class="sub">只要两个问题，30 秒。选完就能看到今天的电量。</p>';
    if (rec) html += '<div class="banner">今天已经记录过啦。可以直接去看<a href="#/map"> 耗电地图 </a>，或者重新选一次覆盖。</div>';
    // Q1
    html += '<section class="card" aria-labelledby="q1"><div class="q">第 1 问 · 单选</div><h2 id="q1">你现在的状态是？</h2><p class="hint">选最像的一个，没有对错。</p><div class="opts" role="radiogroup" aria-labelledby="q1">';
    R.states.forEach(function (s) {
      html += '<button type="button" class="opt radio" role="radio" data-state="' + s.id + '" aria-checked="' + (draft.stateId === s.id && !draft.custom) + '"><span class="mark"></span><span>' + esc(s.label) + "</span></button>";
    });
    html += '<button type="button" class="opt radio" role="radio" data-state="__custom" aria-checked="' + draft.custom + '"><span class="mark"></span><span>都不太像，我自己写</span></button>';
    html += "</div>";
    if (draft.custom) html += '<input id="customIn" class="custom-in" type="text" maxlength="' + R.formula.customMaxLen + '" placeholder="用一句话说说，比如：有点烦，又有点累" value="' + esc(draft.customText) + '" aria-label="自己写当前状态">';
    html += "</section>";
    // Q2
    var n = draft.sourceIds.length, hasNone = draft.sourceIds.indexOf("none") !== -1, cnt = hasNone ? 0 : n;
    html += '<section class="card" aria-labelledby="q2"><div class="q">第 2 问 · 最多选 3 个 <span class="counter ' + (cnt >= R.formula.maxSources ? "full" : "") + '" id="counter">' + cnt + " / " + R.formula.maxSources + '</span></div><h2 id="q2">现在，主要是什么在耗你的电？</h2><p class="hint">挑最影响你的，最多 3 个。</p><div class="opts">';
    R.sources.forEach(function (s) {
      var on = draft.sourceIds.indexOf(s.id) !== -1;
      html += '<button type="button" class="opt check ' + (!on && cnt >= R.formula.maxSources ? "dim" : "") + '" role="checkbox" data-src="' + s.id + '" aria-checked="' + on + '"><span class="mark"></span><span>' + esc(s.label) + "</span></button>";
    });
    html += '<button type="button" class="opt check" role="checkbox" data-src="none" aria-checked="' + hasNone + '"><span class="mark"></span><span>' + esc(R.noneSource.label) + "</span></button>";
    html += '</div></section><div class="err-msg" id="err" role="alert"></div><button class="btn" id="submit" type="button">看看我的电量</button>';
    if (RK) html += '<div class="btn-row" style="margin-top:12px">' + RK.historyButton({ className: "btn ghost", always: true }) + "</div>";
    view.innerHTML = html;
    view.className = "fade";

    view.querySelectorAll("[data-state]").forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute("data-state");
        if (v === "__custom") { draft.custom = true; draft.stateId = null; } else { draft.custom = false; draft.stateId = v; }
        var y = window.scrollY; renderAware(); window.scrollTo(0, y);
        if (draft.custom) { var i = document.getElementById("customIn"); if (i) i.focus({ preventScroll: true }); }
      };
    });
    var ci = document.getElementById("customIn");
    if (ci) ci.oninput = function () { draft.customText = ci.value; };
    view.querySelectorAll("[data-src]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-src"), i = draft.sourceIds.indexOf(id);
        if (id === "none") { draft.sourceIds = i === -1 ? ["none"] : []; }
        else if (i !== -1) { draft.sourceIds.splice(i, 1); }
        else {
          draft.sourceIds = draft.sourceIds.filter(function (x) { return x !== "none"; });
          if (draft.sourceIds.length >= R.formula.maxSources) { toast("最多选 3 个哦，先取消一个再换～"); return; }
          draft.sourceIds.push(id);
        }
        var y = window.scrollY; renderAware(); window.scrollTo(0, y);
      };
    });
    document.getElementById("submit").onclick = function () {
      if (RK && !RK.nick.confirmed()) { RK.ensureNick(function () { document.getElementById("submit").onclick(); }, { onCancel: function () { location.hash = "#/map"; } }); return; }
      var err = document.getElementById("err");
      if (!draft.stateId && !(draft.custom && draft.customText.trim())) { err.textContent = draft.custom ? "写一句你现在的状态吧，几个字也行。" : "先选一下你现在的状态～"; return; }
      if (!draft.sourceIds.length) { err.textContent = "再选一下耗电的来源；如果没有，就选最后一项。"; return; }
      var rec2 = { date: today(), ts: Date.now(), stateId: draft.custom ? null : draft.stateId, customText: draft.custom ? draft.customText.trim().slice(0, R.formula.customMaxLen) : "",
                   sourceIds: draft.sourceIds.filter(function (x) { return x !== "none"; }), done: [] };
      var d = load(), old = todayRecord(d);
      if (old) d.records = d.records.filter(function (r) { return r !== old; });
      d.records.push(rec2); save(d);
      try { if (RK) RK.save(summaryOf(rec2)); } catch (e) { if (window.console) console.error(e); }
      draft = null; location.hash = "#/map";
    };
  }

  /* ---------- 页面 2：今日耗电地图 ---------- */
  function renderMap() {
    var data = load(), rec = todayRecord(data);
    if (!rec) { view.innerHTML = banner() + emptyState("今天还没有电量", data.records.length ? "今天还没做觉察。先花 30 秒选两个问题，就能看到今天的电量和耗电地图。" : "还没有任何记录。先花 30 秒回答两个问题，这里就会出现你的电量和耗电地图。"); return; }
    var r = calc(rec), h = banner();
    h += '<h1>今天的电量</h1>';
    h += '<section class="card hero soft"><div class="battery">' + batterySVG(r.score) + '<div class="num">' + r.score + "<small>/ 100</small></div></div>" +
      '<span class="pill ' + r.band.key + '">' + r.band.label + "</span>" + bandsBar(r.score) +
      '<p class="tagline">' + esc(r.band.tagline) + "</p>" +
      '<p class="you-said">你说的状态：' + esc(r.stateLabel) + (r.customUnmatched ? "（没认出具体意思，按中间值 " + r.base + " 起算）" : "") + "</p></section>";
    // 四维
    h += '<section class="card"><h2>四维耗电地图</h2><p class="hint">数字越大，这一块漏得越多。</p>' + radarSVG(r.dims);
    R.dims.forEach(function (d) {
      h += '<div class="dim-row"><b>' + d.name + (d.key === r.topDim && r.sources.length ? '<span class="top-tag">漏得最多</span>' : "") + '</b><div class="bar" role="img" aria-label="' + d.name + ' ' + r.dims[d.key] + '"><i style="width:' + r.dims[d.key] + '%"></i></div><em>' + r.dims[d.key] + " · " + E.dimLevel(r.dims[d.key]) + "</em></div>" +
        '<p class="dim-desc">' + d.desc + "</p>";
    });
    if (r.sources.length) h += '<div class="src-tags">' + r.sources.map(function (s) { return '<span class="tag">' + esc(s.label.split("：")[0]) + "</span>"; }).join("") + "</div>";
    h += "</section>";
    // 耗电链路
    h += '<section class="card"><h2>耗电链路：你现在落在哪一环</h2><p class="hint">匮乏 → 纠缠 → 关系抢电 → 情绪失控 → 世界变窄</p><div class="chain" role="list">';
    var si = r.stage ? R.chain.findIndex(function (c) { return c.key === r.stage; }) : -1;
    R.chain.forEach(function (c, i) {
      h += '<div class="node ' + (i === si ? "on" : "") + '" role="listitem"' + (i === si ? ' aria-current="step"' : "") + '><div class="dot">' + (i + 1) + "</div>" + c.name + "</div>";
    });
    h += '</div><div class="chain-text">';
    if (si >= 0) { var c = R.chain[si]; h += "<p>" + c.now + "</p><p>" + c.next + '</p><p class="cut">' + c.cut + "</p>"; }
    else h += "<p>今天你的电没有明显落在耗电链路上，不用硬找问题，保持节奏就好。</p>";
    h += "</div></section>";
    // 洞察
    var I = R.insights, stKey = r.stage || "none";
    h += '<section class="card insight"><h2>今日洞察</h2><p>' + fillText(I.band[r.band.key], r.score) + "</p>";
    h += "<p>" + (r.sources.length ? I.dim[r.topDim] : I.noDrain) + '</p><p class="check-q">' + I.check[stKey] + "</p><p>" + I.shift + '</p><p class="disc">' + I.disclaimer + "</p></section>";
    h += '<a class="btn gold" href="#/repair">马上修复一下（3 分钟）</a>';
    if (RK) h += RK.bar(summaryOf(rec));
    // 近 7 天
    var recent = data.records.slice(-7);
    if (recent.length > 1) {
      h += '<section class="card" style="margin-top:16px"><h3>最近几天的电量</h3><div class="hist hist-wrap">' + recent.map(function (x) {
        var s = calc(x).score; return '<div class="' + (x.date === rec.date ? "today" : "") + '" style="height:' + Math.max(s, 6) + '%" title="' + x.date + ' ' + s + '"><small>' + x.date.slice(5).replace("-", "/") + "</small></div>";
      }).join("") + "</div></section>";
    }
    view.innerHTML = h; view.className = "fade";
  }

  /* ---------- 页面 3：今日修复 ---------- */
  function renderRepair() {
    var data = load(), rec = todayRecord(data);
    if (!rec) { view.innerHTML = banner() + emptyState("今天还没有修复建议", "先做一下今日觉察，我才知道你今天漏电在哪，才给得出合适的小动作。"); return; }
    var r = calc(rec), h = banner();
    var minutes = r.actions.reduce(function (a, x) { return a + x.minutes; }, 0);
    h += '<h1>今天的 3 分钟修复</h1><p class="sub">不用全做。挑一个现在就能做的，做完就算赢。' + (r.low ? "你今天电量很低，我只留了最轻的几个。" : "") + "</p>";
    // 6 步
    var stepsOn = r.actions.map(function (a) { return a.step; });
    h += '<section class="card"><h3>六步修复路径</h3><p class="hint">今天用到的步骤已经亮起来。</p><div class="steps6">' + R.steps.map(function (s) {
      return '<div class="' + (stepsOn.indexOf(s.n) !== -1 ? "on" : "") + '"><b>第 ' + s.n + " 步</b>" + s.name + "</div>";
    }).join("") + "</div></section>";
    // 动作
    h += '<section class="card"><h2>马上能做的 ' + r.actions.length + ' 个小动作</h2><p class="hint">合起来大约 ' + minutes + " 分钟，一个一个来也行。</p>";
    r.actions.forEach(function (a, i) {
      var done = rec.done && rec.done.indexOf(a.id) !== -1, st = R.steps[a.step - 1], cs = R.chargeSources[a.src];
      h += '<div class="item"><div class="item-head"><span class="num">' + (i + 1) + "</span><div><h3>" + a.title + '</h3><div class="badges"><span class="badge gold">约 ' + a.minutes + ' 分钟</span><span class="badge">第 ' + a.step + " 步 · " + st.name + '</span><span class="badge">充电来源 · ' + cs.name + "</span></div></div></div><ol>" +
        a.how.map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ol><p class="why">为什么：' + a.why + '</p><button type="button" class="chk" data-done="' + a.id + '" aria-pressed="' + done + '">' + (done ? "✓ 已做" : "我做了") + "</button></div>";
    });
    h += "</section>";
    // 场域
    h += '<section class="card"><h2>今天适合去的「好场」 </h2><p class="hint">第 3 步「选择好场」：靠近让你稳的地方，少待让你耗的。最多推荐 ' + R.maxFields + " 个。</p>";
    r.fields.forEach(function (f) {
      h += '<div class="item"><h3>' + f.title + '</h3><p class="why">' + f.why + "</p><p style=\"margin:0 0 8px\">怎么用：" + f.use + "</p></div>";
    });
    h += '<p class="disc">' + R.fieldAvoid[r.stage || "none"] + "</p></section>";
    // 关系训练
    h += '<section class="card"><h2>关系小训练</h2><p class="hint">第 4 步「情绪独立」：先把自己的充电口修好，不把某一个人当唯一的充电宝。</p>';
    r.trainings.forEach(function (t) {
      h += '<div class="item"><h3>' + t.title + '</h3><p class="why">什么时候用：' + t.when + "</p><ol>" + t.steps.map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ol><div class="say">可以这样说：' + t.say + "</div></div>";
    });
    h += "</section>";
    h += '<section class="card soft"><p style="margin:0;color:var(--green)">' + R.copy.coreLine + '</p></section>';
    h += '<div class="btn-row"><a class="btn ghost" href="#/aware">重新选一次</a><a class="btn ghost" href="#/map">回到地图</a></div>';
    view.innerHTML = h; view.className = "fade";
    view.querySelectorAll("[data-done]").forEach(function (b) {
      b.onclick = function () {
        var d = load(), rr = todayRecord(d), id = b.getAttribute("data-done");
        rr.done = rr.done || []; var i = rr.done.indexOf(id);
        if (i === -1) { rr.done.push(id); toast("很好，又充了一点 ⚡"); } else rr.done.splice(i, 1);
        save(d); var y = window.scrollY; renderRepair(); window.scrollTo(0, y);
      };
    });
  }

  /* ---------- 路由 ---------- */
  var routes = { aware: renderAware, map: renderMap, repair: renderRepair };
  var first = true;
  function route() {
    if (RK) RK.closeNick();
    var name = (location.hash.replace(/^#\/?/, "") || "aware");
    if (!routes[name]) name = "aware";
    document.querySelectorAll("#tabs a").forEach(function (a) {
      var on = a.getAttribute("data-route") === name; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.title = { aware: "今日觉察", map: "今日耗电地图", repair: "今日修复" }[name] + " · 个人充电";
    var show = function () {
      try { routes[name](); }
      catch (e) {
        view.innerHTML = '<section class="card empty"><h2>页面出了点小问题</h2><p>不是你的错。刷新一下试试，数据不会丢。</p><button class="btn" onclick="location.reload()">刷新</button></section>';
        if (window.console) console.error(e);
      }
      view.className = "fade"; view.setAttribute("data-ready", name);
      if (!first) window.scrollTo(0, 0); first = false;
    };
    view.removeAttribute("data-ready");
    view.innerHTML = '<div class="sk" style="height:120px"></div><div class="sk" style="height:220px"></div><div class="sk" style="height:160px"></div>';
    setTimeout(show, first ? 160 : 90);
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", function (ev) { if (ev.key === KEY) { memStore = null; route(); } });
  route();
})();
