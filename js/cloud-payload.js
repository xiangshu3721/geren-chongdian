/* 个人充电 · 云端协议。计分仍只走 engine.js，这里不另写公式。
 *
 * assessmentId=gcd，assessmentVersion=gcd-h5-v1，
 * consent.version=consent-assessment-gcd-1（结果页自动同意，没有同意勾选）。
 * resultKitId=gcd。
 *
 * 上传：stateId、sourceIds、dayIndex，以及当次 compute 的快照
 * （电量、分档、四维、链路、动作 / 场域 / 关系训练的 id）。
 * 不上传 customText，也不上传会带上自述原文的 stateLabel。
 * 自述只在本函数里交给 Engine.compute，用完即丢。
 *
 * 依赖：已部署的 assessment-report-dev 允许列表里还没有 gcd 时，
 * 提交会 422「测评不在可保存范围内」。允许列表在 mindtest-web，不在本仓。
 */
(function (root) {
  "use strict";
  var ASSESSMENT_ID = "gcd";
  var ASSESSMENT_NAME = "个人充电";
  var ASSESSMENT_VERSION = "gcd-h5-v1";
  var CONSENT_VERSION = "consent-assessment-gcd-1";
  var SCHEMA_VERSION = "1.0.0";
  var READER_GAP = "阅读页若尚未重绘个人充电，电量、分档、四维、链路和动作 id 在 extensionData.score 与 viewModel。自由自述不上传，只留在本机。";
  var NONE_STAGE = "今天你的电没有明显落在耗电链路上，不用硬找问题，保持节奏就好。";
  var CUSTOM_NOTE = "你写了一句自己的状态，原文只留在这台设备。";

  function chars(value) {
    return Array.from(String(value == null ? "" : value));
  }

  function gcdNickname(value) {
    var s = String(value == null ? "" : value);
    s = s.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff9-\ufffb]/g, " ");
    s = s.replace(/<[^>]*>/g, "").replace(/[<>&"'`\\]/g, "");
    s = s.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    var list = chars(s);
    if (list.length > 12) list = list.slice(0, 12);
    return list.join("").replace(/^\s+|\s+$/g, "");
  }

  function phoneNickname(value) {
    var text = String(value == null ? "" : value);
    if (/(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(text)) return true;
    return /1[3-9]\d{9}/.test(text.replace(/\D/g, ""));
  }

  function rules() {
    return root.RULES || null;
  }

  function screenText() {
    var pack = rules();
    return pack && pack.insights ? pack.insights.disclaimer : "";
  }

  function byId(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function fillScore(text, score) {
    return String(text || "").replace("{n}", score);
  }

  function stateIdOf(input) {
    var id = input && input.stateId;
    if (id == null || id === "") return null;
    if (typeof id !== "string") return null;
    return id;
  }

  function sourceIdsOf(input) {
    var raw = input && input.sourceIds;
    if (!Array.isArray(raw)) return null;
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      if (typeof raw[i] !== "string" || !raw[i]) return null;
      if (raw[i] === "none") continue;
      out.push(raw[i]);
    }
    return out;
  }

  function dayIndexOf(input) {
    var n = input && input.dayIndex;
    if (typeof n !== "number" || !isFinite(n) || Math.floor(n) !== n || n < 0 || n > 10000000) return null;
    return n;
  }

  function idsOf(list) {
    var out = [];
    for (var i = 0; i < (list || []).length; i++) out.push(list[i].id);
    return out;
  }

  function copyDims(dims) {
    return {
      body: dims.body,
      emotion: dims.emotion,
      relation: dims.relation,
      world: dims.world
    };
  }

  function snapshotOf(computed) {
    var band = computed.band;
    return {
      score: computed.score,
      band: { key: band.key, label: band.label, min: band.min, max: band.max, tagline: band.tagline },
      base: computed.base,
      totalDrain: computed.totalDrain,
      dims: copyDims(computed.dims),
      topDim: computed.topDim,
      stage: computed.stage,
      low: computed.low,
      matchedStateId: computed.stateId,
      customMatched: !!computed.customMatched,
      customUnmatched: !!computed.customUnmatched,
      actionIds: idsOf(computed.actions),
      fieldIds: idsOf(computed.fields),
      trainingIds: idsOf(computed.trainings)
    };
  }

  function dimensionsOf(computed) {
    var pack = rules();
    var engine = root.Engine;
    return pack.dims.map(function (dim) {
      return {
        id: dim.key,
        name: dim.name,
        kind: "score",
        score: computed.dims[dim.key],
        raw: computed.dims[dim.key],
        max: 100,
        level: null,
        levelLabel: engine.dimLevel(computed.dims[dim.key]),
        narrative: dim.desc,
        labels: []
      };
    });
  }

  function outcome(computed) {
    return {
      headline: "今天的电量 " + computed.score + " / 100 · " + computed.band.label,
      code: computed.band.key,
      label: computed.band.label,
      summary: computed.band.tagline,
      flags: computed.customUnmatched ? ["custom-unmatched"] : []
    };
  }

  function chainOf(stage) {
    var list = rules().chain;
    for (var i = 0; i < list.length; i++) if (list[i].key === stage) return list[i];
    return null;
  }

  function prose(computed, stateId) {
    var pack = rules();
    var seen = pack.insights;
    var lines = [];
    var chosen = stateId ? byId(pack.states, stateId) : null;
    if (chosen) lines.push("你选的状态：" + chosen.label);
    else lines.push(CUSTOM_NOTE);
    if (computed.sources.length) {
      lines.push("耗电来源：" + computed.sources.map(function (item) { return item.label.split("：")[0]; }).join("、"));
    }
    lines.push(fillScore(seen.band[computed.band.key], computed.score));
    lines.push(computed.sources.length ? seen.dim[computed.topDim] : seen.noDrain);
    lines.push(seen.check[computed.stage || "none"]);
    lines.push(seen.shift);
    if (computed.stage) {
      var link = chainOf(computed.stage);
      if (link) {
        lines.push(link.now);
        lines.push(link.cut);
      }
    } else lines.push(NONE_STAGE);
    lines.push(screenText());
    return lines;
  }

  function interpretation(computed, stateId) {
    return prose(computed, stateId).map(function (text, index) {
      return { id: "p" + (index + 1), title: null, text: text };
    });
  }

  function recommendations(computed) {
    var list = computed.actions.map(function (action) {
      return { id: action.id, title: action.title, text: action.why };
    });
    list.push({ id: "screen", title: null, text: screenText() });
    list.push({ id: "reader", title: null, text: READER_GAP });
    return list;
  }

  function sections(computed, stateId, head) {
    var blocks = [{ t: "h", l: 2, x: head.headline }, { t: "p", x: head.summary }];
    prose(computed, stateId).forEach(function (text) { blocks.push({ t: "p", x: text }); });
    return blocks;
  }

  function buildGcdResult(input) {
    input = input || {};
    var pack = rules();
    var engine = root.Engine;
    if (!pack || !engine || typeof engine.compute !== "function") return null;
    var nickname = gcdNickname(input.nickname);
    if (!nickname || phoneNickname(input.nickname) || phoneNickname(nickname)) return null;
    if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;
    if (!isFinite(Date.parse(input.completedAt))) return null;
    var stateId = stateIdOf(input);
    var sourceIds = sourceIdsOf(input);
    var dayIndex = dayIndexOf(input);
    if (!sourceIds || dayIndex == null) return null;
    var customText = "";
    if (!stateId && typeof input.customText === "string") customText = input.customText;
    if (!stateId && !String(customText).replace(/^\s+|\s+$/g, "")) return null;
    var computed;
    try {
      computed = engine.compute({
        stateId: stateId,
        customText: stateId ? "" : customText,
        sourceIds: sourceIds,
        dayIndex: dayIndex
      });
    } catch (e) {
      return null;
    }
    var usedIds = idsOf(computed.sources);
    var score = snapshotOf(computed);
    var head = outcome(computed);
    var sectionList = sections(computed, stateId, head);
    var viewScore = JSON.parse(JSON.stringify(score));
    var extensionScore = JSON.parse(JSON.stringify(score));
    return {
      reportId: input.reportId,
      assessmentId: ASSESSMENT_ID,
      assessmentName: ASSESSMENT_NAME,
      assessmentVersion: ASSESSMENT_VERSION,
      nickname: nickname,
      completedAt: input.completedAt,
      dimensions: dimensionsOf(computed),
      result: head,
      interpretation: interpretation(computed, stateId),
      recommendations: recommendations(computed),
      reportContent: {
        format: "view-model+sections",
        viewModel: {
          stateId: stateId,
          sourceIds: usedIds.slice(),
          dayIndex: dayIndex,
          rushed: false,
          score: viewScore
        },
        sections: sectionList,
        textFallback: sectionList.map(function (section) { return section.x; }).join("")
      },
      extensionData: {
        stateId: stateId,
        sourceIds: usedIds.slice(),
        dayIndex: dayIndex,
        score: extensionScore,
        quality: { rushed: false },
        consent: {
          agreed: true,
          version: CONSENT_VERSION,
          at: input.completedAt,
          scopes: ["store", "share_link", "mentor_read"]
        },
        compat: { level: "partial", gaps: [READER_GAP] }
      },
      source: {
        site: ASSESSMENT_NAME,
        path: "index.html",
        repo: "geren-chongdian",
        origin: "external-repo",
        pageUrl: "https://xiangshu3721.github.io/geren-chongdian/",
        clientSubmissionId: input.clientSubmissionId,
        resultKitId: "gcd",
        localKey: "gcd.v1"
      },
      schemaVersion: SCHEMA_VERSION
    };
  }

  root.GcdCloudPayload = {
    ASSESSMENT_ID: ASSESSMENT_ID,
    ASSESSMENT_NAME: ASSESSMENT_NAME,
    ASSESSMENT_VERSION: ASSESSMENT_VERSION,
    CONSENT_VERSION: CONSENT_VERSION,
    SCHEMA_VERSION: SCHEMA_VERSION,
    READER_GAP: READER_GAP,
    CUSTOM_NOTE: CUSTOM_NOTE,
    screenText: screenText,
    gcdNickname: gcdNickname,
    phoneNickname: phoneNickname,
    buildGcdResult: buildGcdResult
  };
})(typeof window !== "undefined" ? window : globalThis);
