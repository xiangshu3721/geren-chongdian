# 个人充电

移动端优先的 Web App：30 秒输入，3 分钟一次自我修复。无登录、无构建。作答和历史仍在 localStorage。

- 线上：https://xiangshu3721.github.io/geren-chongdian/
- 三个页面：今日觉察 / 今日耗电地图 / 今日修复（hash 路由 `#/aware` `#/map` `#/repair`）
- 规则全在 `js/rules.js`，说明见 `RULES.md`（自拟，待 PRD 对齐）
- 地图页算出电量后自动提交一次。`分享结果` 只复制 `https://xiangshu3721.github.io/mindtest-web/r/#{id}.{secret}`。自己写的那句话（`customText`）不上传。覆盖今天只改本机当天记录，云端每次成功提交新开一条 `reportId`。
- 本地跑：`python3 -m http.server` 后打开 http://localhost:8000
- 自检：`node test-engine.js`（规则引擎）；`node --test js/cloud-payload.test.mjs js/cloud-share.test.mjs`（上传体与分享）；`BASE=... node e2e.mjs`（Playwright 手机视口流程，需要 playwright）

云端标识：`assessmentId=gcd`，`assessmentVersion=gcd-h5-v1`，`consentId=consent-assessment-gcd-1`（自动同意，没有勾选），`resultKitId=gcd`。接口与霍兰德、巨婴相同：`assessment-report-dev`。昵称仍走 ResultKit `gcd` 门槛。

允许列表不在本仓。`mindtest-web` 的 `ALLOWED_ASSESSMENT_IDS`（目前在 `cursor/sefs-allow-assessment-75bb` 的 `cloud/assessment-report/lib/ids.mjs`）还没有 `gcd`，`validate.mjs` 也还没有 `validateGcdResult`。名单加上之前，已部署接口会回 422「测评不在可保存范围内」，页面显示「重试」，不会改掉已经复制过的链接。

本工具只做自我觉察和生活小建议，不是医学判断，不能代替专业帮助。
