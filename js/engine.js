/* 个人充电 · 计算引擎：只读 rules.js，不含任何写死的数字/文案。纯函数，同样输入同样输出。 */
(function (root) {
  var R = (typeof module !== "undefined" && module.exports) ? require("./rules.js") : root.RULES;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function matchCustom(text) {
    var t = String(text || "").trim();
    for (var i = 0; i < R.customKeywords.length; i++) {
      var k = R.customKeywords[i];
      for (var j = 0; j < k.words.length; j++) if (t.indexOf(k.words[j]) !== -1) return k.id;
    }
    return null;
  }

  function bandOf(score) {
    for (var i = 0; i < R.bands.length; i++) if (score >= R.bands[i].min && score <= R.bands[i].max) return R.bands[i];
    return R.bands[R.bands.length - 1];
  }

  function dimLevel(v) {
    var out = R.formula.dimLevels[0].label;
    R.formula.dimLevels.forEach(function (l) { if (v >= l.min) out = l.label; });
    return out;
  }

  // 同分时用“第几天”轮换，让每天不完全一样，但同一天同输入结果固定
  function pickRotate(sorted, dayIndex) {
    if (!sorted.length) return null;
    var top = sorted[0].score, ties = sorted.filter(function (x) { return x.score === top; });
    return ties[(dayIndex || 0) % ties.length].item;
  }

  /* input: { stateId?: string, customText?: string, sourceIds: string[], dayIndex?: number } */
  function compute(input) {
    var F = R.formula;
    var stateId = input.stateId || null, custom = (input.customText || "").trim().slice(0, F.customMaxLen);
    var state = null, matched = null, base = F.customDefaultBase, stageHint = null, stateLabel = custom;
    if (stateId) {
      state = byId(R.states, stateId);
      if (!state) throw new Error("unknown state " + stateId);
    } else if (custom) {
      matched = matchCustom(custom);
      state = matched ? byId(R.states, matched) : null;
    } else {
      throw new Error("state required");
    }
    if (state) { base = state.base; stageHint = state.stageHint; if (stateId) stateLabel = state.label; }

    var ids = (input.sourceIds || []).filter(function (x) { return x !== "none"; }).slice(0, F.maxSources);
    var sources = ids.map(function (id) { var s = byId(R.sources, id); if (!s) throw new Error("unknown source " + id); return s; });

    var totalDrain = 0, dimRaw = { body: 0, emotion: 0, relation: 0, world: 0 }, stageScore = {};
    sources.forEach(function (s) {
      totalDrain += s.drain;
      R.dims.forEach(function (d) { dimRaw[d.key] += s.drain * s.w[d.key]; });
      stageScore[s.stage] = (stageScore[s.stage] || 0) + s.drain;
    });
    var score = clamp(Math.round(base - totalDrain), 0, 100);
    var dimVals = {};
    R.dims.forEach(function (d) {
      dimVals[d.key] = clamp(Math.round(dimRaw[d.key] * F.dimScale + (100 - base) * F.baseSpread), 0, 100);
    });
    var topDim = R.dims[0].key;
    R.dims.forEach(function (d) { if (dimVals[d.key] > dimVals[topDim]) topDim = d.key; });

    // 耗电链路落点：来源耗电值按环节累加，取最大；并列取更靠后的环（更深）；没选来源则看状态；都没有 → null
    var stage = null;
    if (sources.length) {
      var best = -1;
      R.chain.forEach(function (c) { var v = stageScore[c.key] || 0; if (v > 0 && v >= best) { best = v; stage = c.key; } });
    } else if (stageHint && base < F.stableHintLimit) stage = stageHint;

    var band = bandOf(score), dayIndex = input.dayIndex || 0;
    var stageKey = stage || "none";

    // 修复动作：按该环节的“步骤优先级”各挑 1 个，低电量只给 2 个且优先很轻的
    var low = score < F.lowBatteryLimit;
    var nAct = low ? R.maxActionsLow : R.maxActions;
    var pri = R.stepPriority[stageKey].slice(0, nAct), actions = [];
    pri.forEach(function (stepN) {
      var cands = R.actions.filter(function (a) { return a.step === stepN; });
      if (low) { var easy = cands.filter(function (a) { return a.easy; }); if (easy.length) cands = easy; }
      var scored = cands.map(function (a) { return { item: a, score: dimVals[a.dim] }; })
        .sort(function (x, y) { return y.score - x.score; });
      var p = pickRotate(scored, dayIndex);
      if (p) actions.push(p);
    });
    actions = actions.slice(0, R.maxActions);

    // 场域推荐
    var fScored = R.fields.map(function (f, idx) {
      var s = (f.stages.indexOf(stageKey) !== -1 ? 30 : 0);
      f.dims.forEach(function (d) { s += dimVals[d] / 10; });
      if (low && f.easy) s += 20;
      return { item: f, score: Math.round(s * 10) / 10 - idx * 0.001 };
    }).filter(function (x) { return !low || x.item.easy || true; })
      .sort(function (x, y) { return y.score - x.score; });
    var fields = fScored.slice(0, R.maxFields).map(function (x) { return x.item; });

    // 关系训练：先按环节筛；是否给第 2 个看关系维度/环节
    var tStage = stage || "scarcity";
    var cands = R.trainings.filter(function (t) { return t.stages.indexOf(tStage) !== -1; });
    if (!cands.length) cands = [byId(R.trainings, "r6")];
    var want = (dimVals.relation >= R.trainingTwoWhen.relationDimMin || R.trainingTwoWhen.stages.indexOf(tStage) !== -1) ? 2 : 1;
    want = Math.min(want, R.maxTrainings, cands.length);
    var trainings = [];
    for (var i = 0; i < want; i++) trainings.push(cands[((dayIndex % cands.length) + i) % cands.length]);

    return {
      score: score, band: band, base: base, totalDrain: totalDrain,
      stateLabel: stateLabel, stateId: state ? state.id : null, customMatched: !!(matched), customUnmatched: !!(custom && !stateId && !matched),
      sources: sources, dims: dimVals, topDim: topDim, stage: stage, low: low,
      actions: actions, fields: fields, trainings: trainings
    };
  }

  var api = { compute: compute, bandOf: bandOf, dimLevel: dimLevel, matchCustom: matchCustom, byId: byId };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
