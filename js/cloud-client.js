/* 个人充电 · 云端提交号、短链和本机队列。与霍兰德 cloud-client / 巨婴 cloud-client 同一套规则。
 * 同一条本地记录（submissionKey，一般是这次保存的 ts）只提交一次。
 * 覆盖今天会换新的 ts，因此新开 reportId，不改已经发出的链接。
 */
(function (root) {
  "use strict";
  var PENDING_KEY = "rk.cloud.pending.v1";
  var OWNER_KEY = "rk.cloud.owner.v1";
  var LINKS_KEY = "rk.cloud.links.v1";
  var REPORT_RE = /^rpt_[A-Za-z0-9_-]{11,64}$/;
  var SECRET_RE = /^[A-Za-z0-9_-]{16,128}$/;

  function randomToken(bytes, cryptoObj) {
    cryptoObj = cryptoObj || root.crypto;
    var list = new Uint8Array(bytes || 32);
    cryptoObj.getRandomValues(list);
    var chars = "";
    for (var i = 0; i < list.length; i++) chars += String.fromCharCode(list[i]);
    return btoa(chars).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  function createSubmissionIds(cryptoObj) {
    return {
      reportId: "rpt_" + randomToken(8, cryptoObj),
      clientSubmissionId: "sub_" + randomToken(18, cryptoObj),
      linkSecret: randomToken(12, cryptoObj),
      ownerToken: randomToken(18, cryptoObj)
    };
  }

  /* 只认这一次本地保存。不把自述、选项或昵称写进键里。 */
  function gcdOrderKey(submissionKey) {
    return "gcd:" + String(submissionKey == null ? "" : submissionKey);
  }

  function parseShareHash(hash) {
    var text = String(hash || "").replace(/^#/, "").replace(/^\s+|\s+$/g, "");
    var dot = text.indexOf(".");
    if (dot < 0) return null;
    var reportId = text.slice(0, dot);
    var linkSecret = text.slice(dot + 1);
    if (reportId.indexOf("rpt_") !== 0) reportId = "rpt_" + reportId;
    if (!REPORT_RE.test(reportId) || !SECRET_RE.test(linkSecret)) return null;
    return { reportId: reportId, linkSecret: linkSecret };
  }

  function parseShareLink(input) {
    var text = String(input || "").replace(/^\s+|\s+$/g, "");
    var hashIndex = text.indexOf("#");
    if (hashIndex >= 0) return parseShareHash(text.slice(hashIndex));
    return parseShareHash(text);
  }

  function buildShareUrl(base, reportId, linkSecret) {
    var page = String(base || "").replace(/\/?$/, "/");
    var id = String(reportId || "").replace(/^rpt_/, "");
    return page + "#" + id + "." + linkSecret;
  }

  function backoffMs(attempt) {
    if (attempt <= 1) return 5000;
    if (attempt === 2) return 30000;
    return 120000;
  }

  function resolveEndpoint(locationLike, config) {
    config = config || {};
    var configured = typeof config.endpoint === "string" ? config.endpoint.replace(/^\s+|\s+$/g, "") : "";
    if (configured) return configured.replace(/\/$/, "");
    var host = locationLike && locationLike.hostname;
    if (host === "localhost" || host === "127.0.0.1") return String(locationLike.origin || "").replace(/\/$/, "");
    return "";
  }

  function endsWith(text, suffix) {
    return text.indexOf(suffix) === text.length - suffix.length;
  }

  function resolveReportBase(locationLike, config) {
    config = config || {};
    if (config.reportPageBase) return String(config.reportPageBase).replace(/\/?$/, "/");
    var host = (locationLike && locationLike.hostname) || "";
    if (endsWith(host, "github.io")) return locationLike.origin + "/mindtest-web/r/";
    if (locationLike && locationLike.origin) return locationLike.origin + "/r/";
    return "https://xiangshu3721.github.io/mindtest-web/r/";
  }

  function gateSubmit(input) {
    if (!input.agreed) return { ok: false, reason: "consent" };
    if (!input.nickname) return { ok: false, reason: "nickname" };
    if (!input.endpoint) return { ok: false, reason: "endpoint" };
    return { ok: true, reason: "" };
  }

  function readJson(storage, key, fallback) {
    try {
      var raw = storage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function createCloudStore(storage) {
    return {
      pending: function () {
        var data = readJson(storage, PENDING_KEY, { v: 1, items: [] });
        return Array.isArray(data.items) ? data.items : [];
      },
      savePending: function (items) {
        storage.setItem(PENDING_KEY, JSON.stringify({ v: 1, items: items }));
      },
      upsertPending: function (item) {
        var items = this.pending().filter(function (entry) { return entry && entry.reportId !== item.reportId; });
        items.push(item);
        this.savePending(items);
      },
      removePending: function (reportId) {
        this.savePending(this.pending().filter(function (entry) { return entry && entry.reportId !== reportId; }));
      },
      owners: function () {
        var data = readJson(storage, OWNER_KEY, { v: 1, items: {} });
        return data.items && typeof data.items === "object" ? data.items : {};
      },
      saveOwner: function (reportId, ownerToken) {
        var items = this.owners();
        items[reportId] = ownerToken;
        storage.setItem(OWNER_KEY, JSON.stringify({ v: 1, items: items }));
      },
      links: function () {
        var data = readJson(storage, LINKS_KEY, { v: 1, items: {} });
        return data.items && typeof data.items === "object" ? data.items : {};
      },
      saveLink: function (key, link) {
        var items = this.links();
        items[key] = link;
        storage.setItem(LINKS_KEY, JSON.stringify({ v: 1, items: items }));
      }
    };
  }

  function isoShanghai(date) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    function pick(type) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
      return "00";
    }
    return pick("year") + "-" + pick("month") + "-" + pick("day") + "T" + pick("hour") + ":" + pick("minute") + ":" + pick("second") + "+08:00";
  }

  function submitBody(item) {
    return { result: item.payload, linkSecret: item.linkSecret, ownerToken: item.ownerToken };
  }

  root.GcdCloudClient = {
    PENDING_KEY: PENDING_KEY,
    randomToken: randomToken,
    createSubmissionIds: createSubmissionIds,
    gcdOrderKey: gcdOrderKey,
    parseShareHash: parseShareHash,
    parseShareLink: parseShareLink,
    buildShareUrl: buildShareUrl,
    backoffMs: backoffMs,
    resolveEndpoint: resolveEndpoint,
    resolveReportBase: resolveReportBase,
    gateSubmit: gateSubmit,
    createCloudStore: createCloudStore,
    isoShanghai: isoShanghai,
    submitBody: submitBody
  };
})(typeof window !== "undefined" ? window : globalThis);
