/* 个人充电 · 地图页算出电量后自动提交一次。「分享结果」只复制阅读短链。
 * 没有同意勾选。同一条本地记录只交一次；换了 submissionKey（覆盖今天）就新开 reportId。
 */
(function (root) {
  "use strict";
  var P = root.GcdCloudPayload;
  var C = root.GcdCloudClient;
  var current = null;
  var slotEl = null;
  var timer = 0;
  var copyTimer = 0;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function config() {
    return root.GCD_CLOUD_CONFIG || {};
  }

  function endpoint() {
    return C.resolveEndpoint(root.location || {}, config());
  }

  function store() {
    return C.createCloudStore(root.localStorage);
  }

  function activeSaved(key) {
    var saved = store().links()[key];
    if (!saved || saved.status !== "active" || !saved.reportUrl) return null;
    return saved;
  }

  function pendingItem(key) {
    var items = store().pending();
    for (var i = 0; i < items.length; i++) if (items[i] && items[i].orderKey === key) return items[i];
    return null;
  }

  function still(generation, key) {
    return !!(current && current.generation === generation && current.orderKey === key);
  }

  function view(input) {
    var saved = activeSaved(input.orderKey);
    var pending = pendingItem(input.orderKey);
    var failed = !!(!saved && !input.saving && pending && pending.attempts > 0 && pending.lastError);
    var note = input.note || "";
    if (!note && input.saving && !saved) note = "链接生成中";
    if (!note && failed) note = pending.lastError || "这次没生成链接";
    var warn = !!(note && note !== "链接已复制" && note !== "链接生成中");
    var busy = input.saving && !saved;
    var retry = failed ? '<button type="button" class="gcd-retry" data-cloud="retry">重试</button>' : "";
    return '<div class="gcd-share">' +
      '<button type="button" class="btn" data-cloud="share"' + (busy ? ' disabled aria-busy="true"' : "") + ">分享结果</button>" +
      retry +
      (note ? '<p class="gcd-note' + (warn ? " warn" : "") + '">' + esc(note) + "</p>" : "") +
      "</div>";
  }

  function paint() {
    if (!slotEl || !current) return;
    if (slotEl.isConnected === false) return;
    slotEl.innerHTML = view(current);
  }

  function later(fn, ms) {
    var id = root.setTimeout(fn, ms);
    if (id && typeof id.unref === "function") id.unref();
    return id;
  }

  function mount(slot, input) {
    if (!slot) return;
    slotEl = slot;
    input = input || {};
    var key = input.submissionKey ? C.gcdOrderKey(input.submissionKey) : "gcd:incomplete";
    var previous = current && current.orderKey === key ? current : null;
    current = {
      nickname: input.nickname,
      stateId: input.stateId || null,
      customText: typeof input.customText === "string" ? input.customText : "",
      sourceIds: input.sourceIds,
      dayIndex: input.dayIndex,
      submissionKey: input.submissionKey ? String(input.submissionKey) : "",
      completedAt: input.completedAt,
      orderKey: key,
      saving: !!(previous && previous.saving),
      note: previous ? previous.note : "",
      generation: previous ? previous.generation : null
    };
    if (!slot.getAttribute("data-bound")) {
      slot.setAttribute("data-bound", "1");
      slot.addEventListener("click", onClick);
    }
    paint();
    if (current.saving || activeSaved(key)) return;
    var pending = pendingItem(key);
    if (pending && pending.attempts > 0 && pending.attempts < 8) {
      resumePending();
      return;
    }
    submit();
  }

  function onClick(event) {
    var button = event.target && event.target.closest ? event.target.closest("[data-cloud]") : null;
    if (!button || !current) return;
    if (event.stopPropagation) event.stopPropagation();
    var name = button.getAttribute("data-cloud");
    if (name === "retry") {
      retry();
      return;
    }
    if (name !== "share") return;
    if (activeSaved(current.orderKey)) {
      copyLink();
      return;
    }
    if (current.saving) {
      current.note = "链接生成中，稍后再试";
      paint();
      return;
    }
    retry();
  }

  function resumePending() {
    if (!current || current.saving || activeSaved(current.orderKey)) return;
    var pending = pendingItem(current.orderKey);
    if (!pending || pending.attempts <= 0 || pending.attempts >= 8) return;
    var wait = Math.max(0, (pending.nextAt || 0) - Date.now());
    root.clearTimeout(timer);
    timer = later(function () { submit(); }, wait);
  }

  function retry() {
    if (!current || current.saving) return;
    root.clearTimeout(timer);
    var cloud = store();
    var pending = pendingItem(current.orderKey);
    if (pending) {
      pending.attempts = 0;
      pending.lastError = "";
      pending.nextAt = 0;
      cloud.upsertPending(pending);
    }
    current.note = "";
    submit();
  }

  function completedAtOf(value) {
    var date = value ? new Date(value) : new Date();
    if (isNaN(date.getTime())) date = new Date();
    return C.isoShanghai(date);
  }

  function ensurePending(cloud, nick) {
    var found = pendingItem(current.orderKey);
    var ids = found;
    if (!found) {
      ids = C.createSubmissionIds();
      if (ids.linkSecret === ids.ownerToken) ids.ownerToken = C.createSubmissionIds().ownerToken;
    }
    var payload = P.buildGcdResult({
      nickname: nick,
      stateId: current.stateId,
      customText: current.customText,
      sourceIds: current.sourceIds,
      dayIndex: current.dayIndex,
      reportId: ids.reportId,
      clientSubmissionId: ids.clientSubmissionId,
      completedAt: completedAtOf(current.completedAt)
    });
    if (!payload) return null;
    if (found) {
      found.payload = payload;
      cloud.upsertPending(found);
      return found;
    }
    var item = {
      reportId: ids.reportId,
      clientSubmissionId: ids.clientSubmissionId,
      linkSecret: ids.linkSecret,
      ownerToken: ids.ownerToken,
      orderKey: current.orderKey,
      payload: payload,
      attempts: 0,
      nextAt: 0,
      lastError: ""
    };
    cloud.upsertPending(item);
    cloud.saveOwner(ids.reportId, ids.ownerToken);
    return item;
  }

  function rememberLink(cloud, item, key, generation) {
    if (!still(generation, key)) return;
    var reportUrl = C.buildShareUrl(C.resolveReportBase(root.location, config()), item.reportId, item.linkSecret);
    cloud.removePending(item.reportId);
    cloud.saveLink(key, { reportId: item.reportId, reportUrl: reportUrl, status: "active", byteSize: 0 });
    current.note = "";
  }

  function failPending(item, message, generation, key) {
    var cloud = store();
    item.attempts += 1;
    item.lastError = message;
    item.nextAt = Date.now() + C.backoffMs(item.attempts);
    cloud.upsertPending(item);
    if (!still(generation, key)) return;
    current.note = "";
    if (item.attempts < 8) {
      root.clearTimeout(timer);
      var delay = C.backoffMs(item.attempts);
      timer = later(function () {
        if (still(generation, key)) submit();
      }, delay);
    }
  }

  function rememberError(message) {
    if (!current) return;
    current.saving = false;
    current.note = message;
    paint();
  }

  function submit() {
    if (!current || current.saving) return;
    var key = current.orderKey;
    if (activeSaved(key)) return;
    var cloud = store();
    var target = endpoint();
    var nick = P.gcdNickname(current.nickname);
    if (!current.submissionKey) { rememberError("这一次结果不完整，没法分享"); return; }
    if (!nick) { rememberError("先填一个称呼，才能分享"); return; }
    if (P.phoneNickname(current.nickname) || P.phoneNickname(nick)) { rememberError("称呼不能是手机号"); return; }
    var gate = C.gateSubmit({ agreed: true, endpoint: target, nickname: nick });
    if (!gate.ok) { rememberError("现在没法生成链接"); return; }
    var generation = {};
    current.generation = generation;
    current.saving = true;
    current.note = "";
    paint();
    var item = ensurePending(cloud, nick);
    if (!still(generation, key)) return;
    if (!item) { rememberError("这一次结果不完整，没法分享"); return; }
    root.fetch(target + "/v1/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(C.submitBody(item))
    }).then(function (response) {
      return response.json().then(function (body) {
        return { response: response, body: body || {} };
      }, function () {
        return { response: response, body: {} };
      });
    }).then(function (res) {
      if (!still(generation, key)) return;
      var response = res.response;
      var body = res.body;
      if (response.status === 200 && body.reportId) {
        rememberLink(cloud, item, key, generation);
        return;
      }
      if (response.status === 409) {
        return root.fetch(target + "/v1/results/read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reportId: item.reportId, linkSecret: item.linkSecret })
        }).then(function (saved) {
          if (!still(generation, key)) return;
          if (saved.status === 200) {
            rememberLink(cloud, item, key, generation);
            return;
          }
          item.lastError = "这次没生成链接";
          item.attempts = 8;
          cloud.upsertPending(item);
        });
      }
      if (response.status === 422) {
        item.lastError = "这次没生成链接";
        item.attempts = 8;
        cloud.upsertPending(item);
        return;
      }
      failPending(item, response.status === 429 ? "刚才点得太快了，稍后再试" : "这次没生成链接", generation, key);
    }).catch(function () {
      if (!still(generation, key)) return;
      if (item) failPending(item, "这次没生成链接", generation, key);
      else rememberError("这次没生成链接");
    }).then(function () {
      if (still(generation, key)) {
        current.saving = false;
        paint();
      }
    });
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var doc = root.document;
        var area = doc.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        doc.body.appendChild(area);
        area.select();
        var ok = doc.execCommand("copy");
        if (area.parentNode) area.parentNode.removeChild(area);
        if (!ok) reject(new Error("copy"));
        else resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  function writeClipboard(text) {
    var nav = root.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      return Promise.resolve(nav.clipboard.writeText(text)).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function copyLink() {
    if (!current) return;
    var saved = activeSaved(current.orderKey);
    if (!saved) return;
    writeClipboard(saved.reportUrl).then(function () {
      current.note = "链接已复制";
      paint();
      root.clearTimeout(copyTimer);
      copyTimer = later(function () {
        if (current && current.note === "链接已复制") {
          current.note = "";
          paint();
        }
      }, 2500);
    }, function () {
      current.note = "没复制上，再点一次";
      paint();
    });
  }

  root.GcdCloud = { mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
