import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

const SECRET = "SECRET_CUSTOM_9f3c";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

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
  for (const name of ["rules.js", "engine.js", "cloud-config.js", "cloud-client.js", "cloud-payload.js", "cloud-share.js"]) {
    runInContext(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"), sandbox, { filename: name });
  }
  return sandbox;
}

function installDom(sandbox) {
  const listeners = new Map();
  const slot = {
    isConnected: true,
    innerHTML: "",
    attrs: {},
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    addEventListener(type, fn) { listeners.set(type, fn); },
    click(name) {
      listeners.get("click")({
        stopPropagation() {},
        target: {
          closest(sel) {
            if (sel !== "[data-cloud]") return null;
            return { getAttribute: () => name };
          },
        },
      });
    },
  };
  sandbox.document = {
    body: { appendChild() {}, removeChild() {} },
    createElement() {
      return { value: "", style: {}, setAttribute() {}, select() {}, parentNode: { removeChild() {} } };
    },
    execCommand() { return false; },
  };
  sandbox.localStorage = memoryStorage();
  sandbox.location = { hostname: "xiangshu3721.github.io", origin: "https://xiangshu3721.github.io" };
  sandbox.copied = "";
  sandbox.navigator = { clipboard: { writeText: async (text) => { sandbox.copied = text; } } };
  return slot;
}

function record(extra) {
  return {
    nickname: "  小林  ",
    stateId: null,
    customText: SECRET,
    sourceIds: ["none"],
    dayIndex: 20000,
    submissionKey: "1710000000001",
    completedAt: Date.parse("2026-10-23T15:04:05+08:00"),
    ...extra,
  };
}

async function flush() {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

test("地图页自动提交一次，分享结果只复制短链，自述不在请求里", async () => {
  const sandbox = loadPage();
  const slot = installDom(sandbox);
  const calls = [];
  sandbox.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url: String(url), body, headers: options.headers });
    const stored = sandbox.localStorage.getItem(sandbox.GcdCloudClient.PENDING_KEY) || "";
    assert.equal(stored.includes(SECRET), false);
    assert.equal(stored.includes("customText"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(options.headers, "authorization"), false);
    if (String(url).endsWith("/v1/results")) {
      return { status: 200, json: async () => ({ reportId: body.result.reportId, index: "off", byteSize: 4 }) };
    }
    return { status: 404, json: async () => ({}) };
  };
  const input = record();
  sandbox.GcdCloud.mount(slot, input);
  assert.match(slot.innerHTML, /分享结果/);
  assert.match(slot.innerHTML, /链接生成中/);
  assert.equal(slot.innerHTML.includes("我同意"), false);
  assert.equal(slot.innerHTML.includes("同意"), false);
  await flush();
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/assessment-report-dev\/v1\/results$/);
  assert.equal(calls[0].body.result.assessmentId, "gcd");
  assert.equal(calls[0].body.result.assessmentVersion, "gcd-h5-v1");
  assert.equal(calls[0].body.result.nickname, "小林");
  assert.equal(calls[0].body.result.extensionData.stateId, null);
  assert.deepEqual(calls[0].body.result.extensionData.sourceIds, []);
  assert.equal(calls[0].body.result.extensionData.dayIndex, 20000);
  assert.equal(typeof calls[0].body.result.extensionData.score.score, "number");
  assert.ok(Array.isArray(calls[0].body.result.extensionData.score.actionIds));
  const posted = JSON.stringify(calls[0].body);
  assert.equal(posted.includes(SECRET), false);
  assert.equal(posted.includes("customText"), false);
  assert.equal(posted.includes("stateLabel"), false);
  assert.match(calls[0].body.linkSecret, /^[A-Za-z0-9_-]{16}$/);
  assert.match(calls[0].body.result.reportId, /^rpt_[A-Za-z0-9_-]{11}$/);
  sandbox.GcdCloud.mount(slot, input);
  await flush();
  assert.equal(calls.length, 1);
  slot.click("share");
  await flush();
  const saved = sandbox.GcdCloudClient.createCloudStore(sandbox.localStorage).links();
  const link = saved[sandbox.GcdCloudClient.gcdOrderKey(input.submissionKey)];
  assert.equal(sandbox.copied, link.reportUrl);
  assert.match(sandbox.copied, /^https:\/\/xiangshu3721\.github\.io\/mindtest-web\/r\/#[A-Za-z0-9_-]{11}\.[A-Za-z0-9_-]{16}$/);
  assert.equal(sandbox.copied.includes("rpt_"), false);
  assert.equal(sandbox.copied.length, 75);
  assert.match(slot.innerHTML, /链接已复制/);
});

test("覆盖今天新开 reportId，不改已经发出的链接", async () => {
  const sandbox = loadPage();
  const slot = installDom(sandbox);
  const ids = [];
  sandbox.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    ids.push(body.result.reportId);
    assert.equal(JSON.stringify(body).includes(SECRET), false);
    return { status: 200, json: async () => ({ reportId: body.result.reportId }) };
  };
  const first = record({ submissionKey: "1710000000001" });
  sandbox.GcdCloud.mount(slot, first);
  await flush();
  const again = record({ submissionKey: "1710000000002" });
  sandbox.GcdCloud.mount(slot, again);
  await flush();
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  const links = sandbox.GcdCloudClient.createCloudStore(sandbox.localStorage).links();
  const keyA = sandbox.GcdCloudClient.gcdOrderKey(first.submissionKey);
  const keyB = sandbox.GcdCloudClient.gcdOrderKey(again.submissionKey);
  assert.equal(links[keyA].reportId, ids[0]);
  assert.equal(links[keyB].reportId, ids[1]);
  assert.notEqual(links[keyA].reportUrl, links[keyB].reportUrl);
});

test("提交失败可以重试同一次，手机号和不完整结果不发请求", async () => {
  const sandbox = loadPage();
  const slot = installDom(sandbox);
  let failed = true;
  const ids = [];
  sandbox.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    ids.push(body.result.reportId);
    if (failed) throw new Error("offline");
    return { status: 200, json: async () => ({ reportId: body.result.reportId }) };
  };
  sandbox.GcdCloud.mount(slot, record({ stateId: "tired", customText: "", sourceIds: ["enough", "stuck", "phone"], submissionKey: "1710000000003" }));
  await flush();
  assert.match(slot.innerHTML, /重试/);
  assert.match(slot.innerHTML, /这次没生成链接/);
  assert.equal(slot.innerHTML.includes("微信"), false);
  assert.equal(slot.innerHTML.includes("二维码"), false);
  failed = false;
  slot.click("retry");
  await flush();
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.equal(slot.innerHTML.includes("重试"), false);

  const quiet = loadPage();
  const quietSlot = installDom(quiet);
  const calls = [];
  quiet.fetch = async () => { calls.push("hit"); return { status: 200, json: async () => ({}) }; };
  quiet.GcdCloud.mount(quietSlot, record({ nickname: "13800000000" }));
  await flush();
  assert.equal(calls.length, 0);
  assert.match(quietSlot.innerHTML, /称呼不能是手机号/);
  quiet.GcdCloud.mount(quietSlot, record({ nickname: "小林", stateId: null, customText: "   ", submissionKey: "1710000000004" }));
  await flush();
  assert.equal(calls.length, 0);
  assert.match(quietSlot.innerHTML, /这一次结果不完整，没法分享/);
  quiet.GcdCloud.mount(quietSlot, record({ nickname: "", submissionKey: "1710000000005" }));
  await flush();
  assert.equal(calls.length, 0);
  assert.match(quietSlot.innerHTML, /先填一个称呼，才能分享/);
});

test("链接还在生成时，点分享会提示稍后再试", async () => {
  const sandbox = loadPage();
  const slot = installDom(sandbox);
  let release;
  sandbox.fetch = () => new Promise((resolve) => { release = resolve; });
  sandbox.GcdCloud.mount(slot, record({ submissionKey: "1710000000006" }));
  assert.match(slot.innerHTML, /disabled/);
  assert.match(slot.innerHTML, /aria-busy="true"/);
  slot.click("share");
  assert.match(slot.innerHTML, /链接生成中，稍后再试/);
  release({ status: 200, json: async () => ({ reportId: "rpt_abcdefghijk" }) });
  await flush();
  assert.match(slot.innerHTML, /分享结果/);
  assert.equal(slot.innerHTML.includes("disabled"), false);
});
