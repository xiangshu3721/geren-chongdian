# 个人充电

移动端优先的纯前端 Web App：30 秒输入，3 分钟一次自我修复。无后端、无登录、无依赖，数据存 localStorage。

- 线上：https://xiangshu3721.github.io/geren-chongdian/
- 三个页面：今日觉察 / 今日耗电地图 / 今日修复（hash 路由 `#/aware` `#/map` `#/repair`）
- 规则全在 `js/rules.js`，说明见 `RULES.md`（自拟，待 PRD 对齐）
- 本地跑：`python3 -m http.server` 后打开 http://localhost:8000
- 自检：`node test-engine.js`（规则引擎）；`BASE=... node e2e.mjs`（Playwright 手机视口流程，需要 playwright）

本工具只做自我觉察和生活小建议，不是医学判断，不能代替专业帮助。
