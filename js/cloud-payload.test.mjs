import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

const SECRET = "SECRET_CUSTOM_9f3c";

function loadPage() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Intl,
    Number,
    String,
    Object,
    Array,
    Boolean,
    Error,
    Uint8Array,
    btoa: globalThis.btoa,
    atob: globalThis.atob,
    crypto: globalThis.crypto,
    isFinite,
    isNaN,
    Promise,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  createContext(sandbox);
  for (const name of ["rules.js", "engine.js", "cloud-config.js", "cloud-client.js", "cloud-payload.js"]) {
    runInContext(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"), sandbox, { filename: name });
  }
  return sandbox;
}

const page = loadPage();
const P = page.GcdCloudPayload;
const E = page.Engine;

function base(extra) {
  return {
    nickname: "林深",
    reportId: "rpt_abcdefghijk",
    clientSubmissionId: "sub_abcdefghijklmnop",
    completedAt: "2026-10-23T15:04:05+08:00",
    stateId: "tired",
    sourceIds: ["enough", "stuck", "phone"],
    dayIndex: 20000,
    ...extra,
  };
}

function keysOf(value, found) {
  found = found || [];
  if (!value || typeof value !== "object") return found;
  const keys = Array.isArray(value) ? [] : Object.keys(value);
  keys.forEach((key) => {
    found.push(key);
    keysOf(value[key], found);
  });
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found));
  return found;
}

function ids(list) {
  return list.map((item) => item.id);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("称呼取前 12 个字，手机号和坏作答不上传", () => {
  assert.equal(P.gcdNickname("  林深  "), "林深");
  assert.equal(P.gcdNickname(`${"林深".repeat(6)}尾`), "林深".repeat(6));
  assert.equal(P.gcdNickname("   "), "");
  assert.equal(P.phoneNickname("13800000000"), true);
  assert.equal(P.phoneNickname("+86 138-0000-0000"), true);
  assert.equal(P.phoneNickname("林深"), false);
  assert.equal(P.buildGcdResult(base({ nickname: "  " })), null);
  assert.equal(P.buildGcdResult(base({ nickname: "13800000000" })), null);
  assert.equal(P.buildGcdResult(base({ stateId: null, customText: "" })), null);
  assert.equal(P.buildGcdResult(base({ stateId: "missing" })), null);
  assert.equal(P.buildGcdResult(base({ sourceIds: ["nope"] })), null);
  assert.equal(P.buildGcdResult(base({ dayIndex: -1 })), null);
  assert.equal(P.buildGcdResult(base({ dayIndex: 1.5 })), null);
  assert.equal(P.buildGcdResult(base({ completedAt: "" })), null);
});

test("预设状态上传快照，不带自述字段；分数与引擎一致", () => {
  const input = base({ customText: SECRET });
  const report = P.buildGcdResult(input);
  const computed = E.compute({
    stateId: "tired",
    customText: "",
    sourceIds: ["enough", "stuck", "phone"],
    dayIndex: 20000,
  });
  assert.equal(computed.score, 35);
  assert.equal(report.assessmentId, "gcd");
  assert.equal(report.assessmentVersion, "gcd-h5-v1");
  assert.equal(report.assessmentName, "个人充电");
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.source.resultKitId, "gcd");
  assert.equal(report.source.repo, "geren-chongdian");
  assert.equal(report.source.origin, "external-repo");
  assert.equal(report.source.localKey, "gcd.v1");
  assert.equal(report.extensionData.consent.agreed, true);
  assert.equal(report.extensionData.consent.version, "consent-assessment-gcd-1");
  assert.deepEqual(plain(report.extensionData.consent.scopes), ["store", "share_link", "mentor_read"]);
  assert.equal(report.extensionData.compat.level, "partial");
  assert.equal(report.extensionData.compat.gaps[0], P.READER_GAP);
  assert.equal(report.extensionData.stateId, "tired");
  assert.deepEqual(plain(report.extensionData.sourceIds), ["enough", "stuck", "phone"]);
  assert.equal(report.extensionData.dayIndex, 20000);
  assert.equal(report.extensionData.score.score, 35);
  assert.equal(report.extensionData.score.band.key, computed.band.key);
  assert.equal(JSON.stringify(report.extensionData.score.dims), JSON.stringify(computed.dims));
  assert.equal(JSON.stringify(report.extensionData.score.actionIds), JSON.stringify(ids(computed.actions)));
  assert.equal(JSON.stringify(report.extensionData.score.fieldIds), JSON.stringify(ids(computed.fields)));
  assert.equal(JSON.stringify(report.extensionData.score.trainingIds), JSON.stringify(ids(computed.trainings)));
  assert.equal(report.extensionData.score.topDim, computed.topDim);
  assert.equal(report.extensionData.score.stage, computed.stage);
  assert.deepEqual(plain(report.reportContent.viewModel.score), plain(report.extensionData.score));
  assert.equal(report.reportContent.viewModel.rushed, false);
  assert.deepEqual(plain(report.extensionData.quality), { rushed: false });
  assert.equal(report.reportContent.format, "view-model+sections");
  assert.equal(report.result.headline, "今天的电量 35 / 100 · " + computed.band.label);
  const keys = keysOf(report);
  assert.equal(keys.includes("customText"), false);
  assert.equal(keys.includes("stateLabel"), false);
  assert.equal(keys.includes("openText"), false);
  const posted = JSON.stringify(report);
  assert.equal(posted.includes(SECRET), false);
  assert.equal(posted.includes("customText"), false);
});

test("自由自述只参与本机计分，上传体里没有原文", () => {
  const dayIndex = 20001;
  const computed = E.compute({
    stateId: null,
    customText: SECRET,
    sourceIds: [],
    dayIndex,
  });
  const report = P.buildGcdResult(base({
    stateId: null,
    customText: SECRET,
    sourceIds: ["none"],
    dayIndex,
  }));
  assert.ok(report);
  assert.equal(report.extensionData.stateId, null);
  assert.deepEqual(plain(report.extensionData.sourceIds), []);
  assert.equal(report.extensionData.dayIndex, dayIndex);
  assert.equal(report.extensionData.score.score, computed.score);
  assert.equal(report.extensionData.score.matchedStateId, computed.stateId);
  assert.equal(report.extensionData.score.customUnmatched, computed.customUnmatched);
  assert.equal(JSON.stringify(report.extensionData.score.actionIds), JSON.stringify(ids(computed.actions)));
  assert.equal(JSON.stringify(report).includes(SECRET), false);
  assert.equal(report.reportContent.textFallback.includes(SECRET), false);
  assert.equal(report.reportContent.textFallback.includes(P.CUSTOM_NOTE), true);
  assert.equal(report.result.summary.includes(SECRET), false);
});
