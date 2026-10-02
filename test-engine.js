// node test-engine.js —— 规则/引擎自检：上限、范围、可复算
const E = require("./js/engine.js"), R = require("./js/rules.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
const ids = R.sources.map(s => s.id);
let n = 0;
for (const st of R.states) for (let a = 0; a < ids.length; a++) for (let b = a; b < ids.length; b++) for (let day = 0; day < 3; day++) {
  const src = a === b ? [ids[a]] : [ids[a], ids[b], ids[(a + b + 1) % ids.length]];
  const r = E.compute({ stateId: st.id, sourceIds: [...new Set(src)], dayIndex: day }); n++;
  ok(r.score >= 0 && r.score <= 100, "score range");
  ok(r.actions.length >= 1 && r.actions.length <= 3, "actions " + r.actions.length);
  ok(r.fields.length >= 1 && r.fields.length <= 3, "fields");
  ok(r.trainings.length >= 1 && r.trainings.length <= 2, "trainings");
  ok(!r.low || r.actions.length <= 2, "low actions");
  Object.values(r.dims).forEach(v => ok(v >= 0 && v <= 100, "dim range"));
  const r2 = E.compute({ stateId: st.id, sourceIds: [...new Set(src)], dayIndex: day });
  ok(JSON.stringify(r) === JSON.stringify(r2), "deterministic");
}
const none = E.compute({ stateId: "full", sourceIds: [] });
ok(none.score === 90 && none.stage === null && none.actions.length === 3, "full/no-source");
ok(E.compute({ customText: "今天很累", sourceIds: ["body"] }).score === 47, "custom 累 55-8=47");
ok(E.compute({ customText: "说不清", sourceIds: [] }).score === 55, "custom default");
ok(E.compute({ customText: "不舒服", sourceIds: [] }).stateId === "empty", "不舒服 -> empty");
ok(E.compute({ stateId: "collapse", sourceIds: ["burst","taking","body"] }).score === 0 , "clamp 0");
console.log(n + " combos, fails=" + fails); process.exit(fails ? 1 : 0);
