// 用法: BASE=http://localhost:8765/ node e2e.mjs   （需要 playwright）
import { chromium } from "/workspace/pw/node_modules/playwright/index.mjs";
const BASE = process.env.BASE || "http://localhost:8765/";
const SHOTS = process.env.SHOTS || "/workspace/geren-chongdian-shots/";
const res = []; const ok = (c, m) => { res.push((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
const wait = () => p.waitForSelector("#view[data-ready]", { timeout: 5000 });
const prefix = process.env.PREFIX || "";
// 1 空状态
await p.goto(BASE + "#/map"); await wait();
ok(await p.locator(".empty").count() === 1 && (await p.textContent("#view")).includes("今天还没有电量"), "地图页空状态");
await p.goto(BASE + "#/repair"); await p.reload(); await wait();
ok((await p.textContent("#view")).includes("今天还没有修复建议"), "修复页空状态");
// 骨架屏存在
await p.goto(BASE + "#/aware"); await wait();
ok(await p.locator('[data-state]').count() === 9, "状态选项 8 + 自己写");
// 样式正常：背景色
const bg = await p.evaluate(() => getComputedStyle(document.body).fontFamily + "|" + getComputedStyle(document.querySelector(".btn")).backgroundColor);
ok(bg.includes("rgb(47, 93, 74)"), "样式生效(墨绿按钮) " + bg.split("|")[1]);
// 未选直接提交
await p.click("#submit"); ok((await p.textContent("#err")).includes("状态"), "未选状态提示");
await p.click('[data-state="tired"]'); await p.click("#submit"); ok((await p.textContent("#err")).includes("来源"), "未选来源提示");
// 4 个来源拦截
for (const id of ["enough", "body", "stuck"]) await p.click(`[data-src="${id}"]`);
await p.click('[data-src="phone"]');
ok(await p.locator("#toast.show").count() === 1 && (await p.textContent("#toast")).includes("最多选 3"), "第 4 个被拦并提示");
ok(await p.locator('[data-src][aria-checked="true"]').count() === 3, "仍只有 3 个选中");
ok((await p.textContent("#counter")).trim() === "3 / 3", "计数 3/3");
await p.click('[data-src="body"]'); await p.click('[data-src="phone"]');
ok(await p.locator('[data-src][aria-checked="true"]').count() === 3, "取消一个后可换选");
await p.screenshot({ path: SHOTS + prefix + "01-aware.png", fullPage: false });
await p.click("#submit"); await p.waitForURL(/#\/map/); await wait();
// tired 55 - enough 7 - stuck 7 - phone 6 = 35
await p.waitForTimeout(2600); const sc = await p.textContent(".battery .num");
ok(sc.startsWith("35"), "电量=55-7-7-6=35, 实际 " + sc);
ok(await p.locator(".dim-row").count() === 4, "四维 4 行");
ok(await p.locator(".node").count() === 5 && await p.locator(".node.on").count() === 1, "耗电链路 5 环且 1 环高亮: " + await p.textContent(".node.on"));
await p.screenshot({ path: SHOTS + prefix + "02-map.png", fullPage: true });
// 修复页
await p.click('#tabs a[data-route="repair"]'); await p.waitForSelector('#view[data-ready="repair"]');
const nA = await p.locator(".card:has(> h2:text('小动作')) .item").count();
const nF = await p.locator(".card:has(> h2:text('好场')) .item").count();
const nT = await p.locator(".card:has(> h2:text('关系小训练')) .item").count();
ok(nA >= 1 && nA <= 3, "修复动作数 " + nA); ok(nF >= 1 && nF <= 3, "场域数 " + nF); ok(nT >= 1 && nT <= 2, "关系训练数 " + nT);
await p.click(".chk >> nth=0"); ok((await p.getAttribute(".chk >> nth=0", "aria-pressed")) === "true", "标记已做");
await p.screenshot({ path: SHOTS + prefix + "03-repair.png", fullPage: true });
// 刷新保留
await p.reload(); await wait();
ok((await p.getAttribute(".chk >> nth=0", "aria-pressed")) === "true", "刷新后已做保留");
await p.goto(BASE + "#/map"); await p.reload(); await wait();
ok((await p.textContent(".battery .num")).startsWith("35"), "刷新后电量保留");
const stored = await p.evaluate(() => localStorage.getItem("gcd.v1")); ok(!!stored && JSON.parse(stored).records.length === 1, "localStorage 有 1 条");
// 手动输入
await p.goto(BASE + "#/aware"); await wait();
await p.click('[data-state="__custom"]'); await p.click("#submit"); ok((await p.textContent("#err")).includes("写一句"), "自写为空提示");
await p.fill("#customIn", "有点烦又有点累，说不清"); await p.click('[data-src="none"]'); await p.click("#submit"); await p.waitForURL(/#\/map/); await wait();
ok((await p.textContent(".you-said")).includes("有点烦又有点累"), "手动输入状态显示");
const sc2 = await p.textContent(".battery .num"); ok(!isNaN(parseInt(sc2)), "手动输入电量 " + sc2);
ok((await p.locator("#view").textContent()).includes("先把自己接上世界") || (await p.locator(".foot").textContent()).includes("先把自己接上世界，你才会重新有电"), "结语");
// 损坏数据
await p.evaluate(() => localStorage.setItem("gcd.v1", "{bad json")); await p.reload(); await wait();
ok(await p.locator(".banner").count() === 1 && (await p.textContent(".banner")).includes("重新开始"), "损坏数据→错误提示且不崩");
// 宽屏
await p.setViewportSize({ width: 1280, height: 800 }); await p.goto(BASE + "#/aware"); await wait();
ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "桌面无横向溢出");
await p.setViewportSize({ width: 320, height: 640 }); await p.reload(); await wait();
ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "320 宽无横向溢出");
ok(errs.length === 0, "无控制台错误 " + errs.join(";"));
console.log(res.join("\n")); await b.close();
