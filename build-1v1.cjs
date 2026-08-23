/* eslint-disable */
// 一次性构建脚本：把 generator.js + scripts.json + 1v1 相关 CSS 合成纯 HTML 单文件
// 用法： node build-1v1.cjs
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// 1) 读取 scripts.json，重新序列化保证可内联
const scriptsJson = read("data/scripts.json");
let scriptDataObj;
try {
  scriptDataObj = JSON.parse(scriptsJson);
} catch (e) {
  console.error("scripts.json 解析失败:", e);
  process.exit(1);
}
const scriptDataLiteral = JSON.stringify(scriptDataObj);

// 2) 读取 generator.js，转成普通 JS（去掉 import / export）
let gen = read("lib/generator.js");

// 去掉 import JSON 的那一行
gen = gen.replace(
  /import\s+scriptData\s+from\s+["'][^"']+["']\s*(with\s*\{\s*type:\s*["']json["']\s*\})?\s*;?/g,
  ""
);
// 去掉原文件里那行解构（我们会在注入 scriptData 时重新加一行，避免重复声明）
gen = gen.replace(
  /^\s*const\s*\{\s*scenarios\s*,\s*personalities\s*,\s*default_scenario\s*,\s*variables\s*\}\s*=\s*scriptData\s*;?\s*$/gm,
  ""
);
// 去掉所有 ES module import / export 声明（本项目 generator.js 没有 import React 等其他模块）
gen = gen.replace(/^\s*export\s+/gm, "");
gen = gen.replace(/^\s*export\s+default\s+/gm, "");
// 去掉 export { personalities, scenarios }; 这种语句
gen = gen.replace(/export\s*\{[^}]*\}\s*;?/g, "");

// 在 generator.js 内容最前面注入 scriptData 字面量（替代原本的 import）
const generatorBody =
  "const scriptData = " + scriptDataLiteral + ";\n" +
  'const { scenarios, personalities, default_scenario, variables } = scriptData;\n' +
  gen;

// 3) 精简版 CSS（只保留 1v1 模式需要的：紫色渐变主题、暗色模式、移动端响应式）
const css = `
:root {
  --accent: #a855f7;
  --accent-light: #c084fc;
  --gradient-start: #7c3aed;
  --gradient-end: #ec4899;
  --bg-card: #ffffff;
  --bg-secondary: #f4f4f6;
  --bg-page: #faf5ff;
  --text-primary: #1f1f25;
  --text-secondary: #6b7280;
  --border: #ece9f3;
  --shadow: 0 8px 28px rgba(124,58,237,0.10);
  --gradient-main: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
}
html[data-theme="dark"] {
  --accent: #c084fc;
  --accent-light: #d8b4fe;
  --bg-card: #1c1922;
  --bg-secondary: #26222e;
  --bg-page: #15131a;
  --text-primary: #f4f4f8;
  --text-secondary: #a1a1aa;
  --border: #2e2a3a;
  --shadow: 0 8px 28px rgba(0,0,0,0.45);
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
body { min-height: 100vh; }

.app-shell { max-width: 880px; margin: 0 auto; padding: 18px 16px 140px; }

.app-header {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; margin-bottom: 14px;
}
.app-title {
  font-size: 20px; font-weight: 800; letter-spacing: 0.3px;
  background: var(--gradient-main); -webkit-background-clip: text;
  background-clip: text; color: transparent;
}
.app-sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.theme-btn {
  border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary);
  border-radius: 10px; padding: 8px 12px; font-size: 13px; cursor: pointer; transition: all .2s;
}
.theme-btn:hover { border-color: var(--accent); }

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}
.bro-input-card {
  border: 1.5px solid var(--border);
  background:
    linear-gradient(135deg, rgba(236,72,153,0.06), rgba(124,58,237,0.06)),
    var(--bg-card);
}
.bro-input-title { display: flex; gap: 14px; align-items: center; margin-bottom: 10px; }
.bro-input-title .t-emoji {
  width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
  font-size: 22px; background: linear-gradient(135deg, rgba(168,85,247,0.25), rgba(236,72,153,0.25));
  flex-shrink: 0;
}
.bro-input-title .t-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.bro-input-title .t-sub { font-size: 12px; color: var(--text-secondary); margin-top: 3px; line-height: 1.5; }

textarea, input, select {
  font-family: inherit;
}
.bro-textarea {
  width: 100%; min-height: 150px;
  font-size: 15px; line-height: 1.65;
  border-radius: 14px;
  padding: 12px 14px;
  background: var(--bg-secondary); color: var(--text-primary);
  border: 1px solid var(--border); outline: none;
  resize: vertical; transition: border-color .2s;
}
.bro-textarea:focus { border-color: var(--accent); }

.bro-meta-row {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;
  margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--border);
}
.bro-meta-item { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.bro-meta-item input, .bro-meta-item select {
  padding: 9px 11px; border-radius: 10px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); font-size: 13px; outline: none; transition: border-color .2s;
}
.bro-meta-item input:focus, .bro-meta-item select:focus { border-color: var(--accent); }

.quick-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 20px; }
.quick-chip {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 8px 12px; border-radius: 12px;
  background: var(--bg-card); border: 1px solid var(--border);
  transition: all .2s ease; cursor: pointer; text-align: left; max-width: 48%;
}
.quick-chip:hover {
  border-color: var(--accent); transform: translateY(-1px); box-shadow: var(--shadow);
  background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.12));
}
.quick-chip-hint { font-size: 11px; color: var(--accent-light); font-weight: 600; letter-spacing: .03em; }
.quick-chip-text { font-size: 12.5px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.bro-chips .quick-chip {
  background: linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.12));
  border-color: rgba(236,72,153,0.3);
}

.bro-mode-hint {
  margin-top: 14px; padding: 12px 14px; border-radius: 12px;
  background: linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08)), var(--bg-card);
  border: 1px solid rgba(34,197,94,0.25);
  display: flex; flex-direction: column; gap: 4px;
}
.bro-mode-hint .hint-title { font-size: 13px; font-weight: 700; color: #34d399; }
.bro-mode-hint .hint-row   { font-size: 12px; color: var(--text-secondary); }
.bro-mode-hint .hint-row.tips { color: var(--accent-light); margin-top: 4px; }

.generate-btn {
  width: 100%; padding: 14px 18px; border: none; border-radius: 14px;
  font-size: 15px; font-weight: 700; cursor: pointer; color: #fff;
  background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  box-shadow: 0 12px 36px rgba(236,72,153,0.35), var(--shadow);
  letter-spacing: .3px; transition: transform .15s ease, opacity .2s;
  margin-top: 14px;
}
.generate-btn:hover { transform: translateY(-1px); }
.generate-btn:active { transform: translateY(0); }
.generate-btn[disabled] { opacity: .65; cursor: not-allowed; }

.analysis-card {
  border-radius: 18px; padding: 18px; margin-bottom: 18px;
  border: 1.5px solid var(--border);
  background: linear-gradient(135deg, rgba(124,58,237,0.08), rgba(236,72,153,0.08)), var(--bg-card);
}
.analysis-card.hot { border-color: rgba(251,146,60,0.55); }
.analysis-card.cold { border-color: rgba(96,165,250,0.55); }
.analysis-card.danger {
  border-color: rgba(248,113,113,0.65);
  background: linear-gradient(135deg, rgba(248,113,113,0.12), rgba(239,68,68,0.08)), var(--bg-card);
}
.analysis-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; margin-bottom: 12px; }
.analysis-alert {
  display: inline-block; padding: 3px 10px; border-radius: 999px;
  font-size: 11px; color: #fff; background: linear-gradient(135deg, #ef4444, #dc2626);
  letter-spacing: .5px; font-weight: 700;
}
.analysis-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 12px;
  padding: 10px 12px; border-radius: 12px; background: var(--bg-secondary); margin-bottom: 12px;
}
.analysis-grid > div { display: flex; flex-direction: column; gap: 2px; }
.analysis-grid .k { font-size: 11px; color: var(--text-secondary); }
.analysis-grid .v { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.analysis-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.chips-label { font-size: 12px; color: var(--text-secondary); margin-right: 2px; }
.kw-chip {
  display: inline-block; padding: 3px 9px; border-radius: 999px;
  background: rgba(168,85,247,0.15); color: var(--accent-light);
  border: 1px solid var(--border); font-size: 11px; font-weight: 600;
}
.hint-chip {
  display: inline-block; padding: 3px 9px; border-radius: 999px;
  background: rgba(250,204,21,0.12); color: #fbbf24;
  border: 1px solid rgba(250,204,21,0.3); font-size: 11px; font-weight: 600;
}
.analysis-alert-box {
  padding: 12px 14px; border-radius: 12px;
  background: rgba(239,68,68,0.12); border: 1px solid rgba(248,113,113,0.4);
  color: #fecaca; font-size: 13px; line-height: 1.7; margin-bottom: 10px;
}
.analysis-alert-box strong { color: #f87171; }
.analysis-hints {
  margin: 6px 0 12px; padding: 10px 12px 10px 26px; border-radius: 10px;
  background: var(--bg-secondary); font-size: 12.5px; color: var(--text-primary); line-height: 1.75;
}
.analysis-hints li { margin-bottom: 3px; }
.analysis-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }

.bro-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.bro-card {
  padding: 13px; border-radius: 14px;
  background: var(--bg-card); border: 1px solid var(--border);
  box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px;
}
.bro-card.safe { border-color: rgba(16,185,129,0.45); }
.bro-card.warn-card {
  border-color: rgba(248,113,113,0.55);
  background: linear-gradient(135deg, rgba(248,113,113,0.10), var(--bg-card));
}
.bro-card-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bro-card-emoji { font-size: 16px; }
.bro-card-label { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.safe-flag { display: inline-block; margin-right: 6px; padding: 1px 7px; border-radius: 6px; font-size: 10px; font-weight: 700; letter-spacing: .3px; }
.safe-flag.ok { color: #059669; background: rgba(16,185,129,0.16); border: 1px solid rgba(16,185,129,0.4); }
.safe-flag.warn { color: #dc2626; background: rgba(248,113,113,0.16); border: 1px solid rgba(248,113,113,0.4); }
.intensity-badge {
  display: inline-block; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600; border: 1px solid var(--border); margin-left: 6px;
}
.intensity-badge.i-warmup { background: rgba(96,165,250,0.12); color: #60a5fa; border-color: rgba(96,165,250,0.35); }
.intensity-badge.i-daily { background: rgba(168,85,247,0.12); color: var(--accent-light); }
.intensity-badge.i-heatup { background: rgba(251,146,60,0.14); color: #fb923c; border-color: rgba(251,146,60,0.4); }
.bro-card-scenario { font-size: 11px; color: var(--text-secondary); }
.bro-card-text {
  font-size: 14px; line-height: 1.7; color: var(--text-primary);
  white-space: pre-wrap; word-break: break-word; flex: 1;
}
.bro-card-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }

.regen-btn {
  padding: 4px 10px; font-size: 12px; border-radius: 8px;
  background: var(--bg-secondary); color: var(--text-primary);
  border: 1px solid var(--border); transition: all .2s; cursor: pointer;
}
.regen-btn:hover { background: linear-gradient(135deg, var(--accent), var(--gradient-end)); color: #fff; border-color: transparent; }
.regen-btn.primary { background: linear-gradient(135deg, var(--accent), var(--gradient-end)); color: #fff; border-color: transparent; }

.empty-state { padding: 28px 14px; text-align: center; color: var(--text-secondary); font-size: 13px; }

/* 大哥档案 */
.bros-list { display: flex; flex-direction: column; gap: 10px; }
.bro-row { border-radius: 16px; border: 1.5px solid var(--border); background: var(--bg-card); overflow: hidden; transition: border-color .2s; }
.bro-row.open { border-color: var(--accent); }
.bro-row-head {
  padding: 14px; display: grid; grid-template-columns: 46px 1fr 24px; gap: 12px; align-items: center; cursor: pointer;
}
.bro-row-head:hover { background: rgba(168,85,247,0.06); }
.bro-avatar {
  width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: #fff; font-weight: 700; font-size: 18px;
}
.bro-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.bro-name-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.bro-nickname { font-weight: 700; color: var(--text-primary); font-size: 15px; }
.bro-type {
  padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
  background: rgba(168,85,247,0.12); color: var(--accent-light); border: 1px solid var(--border);
}
.bro-alert {
  padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
  background: rgba(248,113,113,0.16); color: #f87171; border: 1px solid rgba(248,113,113,0.4);
}
.bro-quote {
  font-size: 12.5px; color: var(--text-primary); opacity: .9; line-height: 1.55; margin: 2px 0;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bro-meta { font-size: 11.5px; color: var(--text-secondary); display: flex; flex-wrap: wrap; gap: 2px; }
.bro-meta .sep { margin: 0 6px; opacity: .5; }
.bro-caret { text-align: center; color: var(--text-secondary); font-size: 11px; }
.bro-detail { padding: 0 14px 14px; border-top: 1px dashed var(--border); display: none; }
.bro-row.open .bro-detail { display: block; }
.bro-detail-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 0; }
.bro-detail-quotes { font-size: 12.5px; color: var(--text-primary); line-height: 1.7; margin-top: 6px; }

.section-title { font-size: 14px; font-weight: 700; margin: 8px 0 12px; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
.section-title .count { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(168,85,247,0.12); color: var(--accent-light); }

.toast {
  position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%);
  background: rgba(31,41,55,.96); color: #fff; padding: 10px 18px;
  border-radius: 999px; font-size: 13px; z-index: 9999; opacity: 0;
  transition: opacity .2s, transform .2s; pointer-events: none;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* 移动端响应式 */
@media (max-width: 640px) {
  .app-shell { padding: 14px 12px 130px; }
  .app-title { font-size: 18px; }
  .card { padding: 14px; border-radius: 16px; }
  .bro-textarea { min-height: 130px; font-size: 14px; }
  .bro-meta-row { grid-template-columns: 1fr; gap: 8px; }
  .quick-chip { max-width: calc(50% - 4px); }
  .quick-chip-text { max-width: 130px; }
  .analysis-grid { grid-template-columns: 1fr 1fr; }
  .bro-grid { grid-template-columns: 1fr; }
  .bro-row-head { grid-template-columns: 42px 1fr 20px; gap: 10px; padding: 12px; }
  .bro-avatar { width: 42px; height: 42px; font-size: 16px; }
  .generate-btn { font-size: 14px; padding: 12px 14px; }
}
`;

// 4) 9 个示例 chips（从 pages/index.js 的 BROTHER_EXAMPLES 抄过来）
const brotherExamples = [
  { msg: "刚给你刷了个嘉年华 不用谢", hint: "刚刷礼物" },
  { msg: "我帮你守塔了 血条差点被偷 还好秒了", hint: "PK救场" },
  { msg: "妹妹 今天我生日 你不祝我生日快乐吗", hint: "大哥生日" },
  { msg: "给我唱一首后来吧 睡不着 想听你声音", hint: "深夜点歌" },
  { msg: "美女 发张你的自拍看看 要无美颜的", hint: "要私照（婉拒）" },
  { msg: "妹妹 最近周转不开 能借我3万块吗", hint: "借钱试探（硬拒）" },
  { msg: "下播啦 今天谢谢你帮我撑到最后", hint: "下播感谢" },
  { msg: "我喜欢你 做我女朋友吧 我是认真的", hint: "告白应对" },
  { msg: "今天被老板骂了 真不想干了 好委屈", hint: "失意安慰" },
];

// 5) 构造 HTML
const html = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#7c3aed" />
<title>1v1 大哥原话模式 · 高情商回复生成器</title>
<style>
${css}
</style>
</head>
<body>
<div class="app-shell">
  <header class="app-header">
    <div>
      <div class="app-title">💬 1v1 大哥原话模式</div>
      <div class="app-sub">把大哥原话粘进来 → 自动识别场景/画像/越界 → 8 种性格各出 1 条高情商回复</div>
    </div>
    <button class="theme-btn" id="themeBtn" type="button">🌙 暗色</button>
  </header>

  <!-- 输入卡 -->
  <section class="card bro-input-card">
    <div class="bro-input-title">
      <div class="t-emoji">🎯</div>
      <div>
        <div class="t-title">大哥原话输入</div>
        <div class="t-sub">系统会自动识别场景 / 画像 / 是否越界 / 该怎么称呼他，然后 8 种性格各出 1 条 1v1 专属回复</div>
      </div>
    </div>
    <textarea id="broTextarea" class="bro-textarea" placeholder="把大哥发来的原话粘在这里，比如：&quot;妹妹 今天我生日 你不祝我生日快乐吗&quot;"></textarea>

    <div class="bro-meta-row">
      <div class="bro-meta-item">
        <label for="broNickname">大哥备注/昵称</label>
        <input id="broNickname" type="text" placeholder="例如：陈总 / 王哥 / 龙哥" autocomplete="off" />
      </div>
      <div class="bro-meta-item">
        <label for="broAddress">怎么称呼他</label>
        <input id="broAddress" type="text" value="哥" placeholder="哥 / 老板 / 宝~" autocomplete="off" />
      </div>
      <div class="bro-meta-item">
        <label for="broHostName">主播名（你）</label>
        <input id="broHostName" type="text" placeholder="可选，模板会替换 {host}" autocomplete="off" />
      </div>
    </div>

    <!-- 示例 chips -->
    <div class="quick-chips bro-chips" id="broChips"></div>

    <div class="bro-mode-hint">
      <div class="hint-title">📌 这是什么模式</div>
      <div class="hint-row">这是主播 1v1 私聊大哥的「高情商回复引擎」：把大哥原话粘进来，系统会自动识别他的场景/画像/情绪温度，再给出 8 张不同性格的回复卡供你挑。</div>
      <div class="hint-row tips">💡 越界类（借钱/要私照/约炮）会自动降强度，并标注「该用哪几张卡」；点赞多的回复可直接复制或收藏到大哥档案。</div>
    </div>

    <button class="generate-btn" id="generateBtn" type="button">💬 生成 8 条 1v1 专属回复</button>
  </section>

  <!-- 分析面板 -->
  <section id="analysisWrap"></section>

  <!-- 8 张性格卡网格 -->
  <section>
    <div class="section-title">🎴 8 张性格回复卡 <span class="count" id="cardCount">0</span></div>
    <div id="broGridWrap">
      <div class="empty-state"><div>👆 点上方「💬 生成 8 条 1v1 专属回复」按钮试试</div></div>
    </div>
  </section>

  <!-- 大哥档案 -->
  <section>
    <div class="section-title">📂 大哥档案 <span class="count" id="broCount">0</span></div>
    <div id="brosListWrap">
      <div class="empty-state"><div>💡 还没有保存的大哥档案，生成一次后点「💾 保存到大哥档案」即可建档</div></div>
    </div>
  </section>
</div>

<div class="toast" id="toast"></div>

<script>
// ===== 内联 scripts.json 数据 =====
${generatorBody}
</script>

<script>
// ===== UI 层 vanilla JS（不依赖 React） =====
(function () {
  "use strict";

  // 9 个示例 chips
  var BROTHER_EXAMPLES = ${JSON.stringify(brotherExamples)};

  var LS_BROS = "1v1_brothers_v1";
  var LS_THEME = "1v1_theme_v1";

  // DOM refs
  var $ = function (id) { return document.getElementById(id); };
  var broTextarea = $("broTextarea");
  var broNickname = $("broNickname");
  var broAddress = $("broAddress");
  var broHostName = $("broHostName");
  var broChips = $("broChips");
  var generateBtn = $("generateBtn");
  var analysisWrap = $("analysisWrap");
  var broGridWrap = $("broGridWrap");
  var cardCount = $("cardCount");
  var brosListWrap = $("brosListWrap");
  var broCount = $("broCount");
  var themeBtn = $("themeBtn");
  var toastEl = $("toast");

  // 当前生成结果（给保存档案用）
  var currentReplies = [];
  var currentAnalysis = null;
  var currentMessage = "";

  /* ---------- 工具 ---------- */
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1600);
  }

  function loadJSON(key, fallback) {
    try {
      var s = localStorage.getItem(key);
      if (!s) return fallback;
      return JSON.parse(s);
    } catch (e) { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTime(ts) {
    var d = new Date(ts || Date.now());
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function initial(name) {
    if (!name) return "·";
    var ch = name.trim().charAt(0);
    return ch || "·";
  }

  /* ---------- 主题 ---------- */
  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      if (themeBtn) themeBtn.textContent = "☀️ 亮色";
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      if (themeBtn) themeBtn.textContent = "🌙 暗色";
    }
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    var next = cur === "light" ? "dark" : "light";
    applyTheme(next);
    saveJSON(LS_THEME, next);
  }

  /* ---------- chips ---------- */
  function renderChips() {
    if (!broChips) return;
    var html = "";
    BROTHER_EXAMPLES.forEach(function (ex) {
      html += '<button class="quick-chip" type="button" data-msg="' + escapeHtml(ex.msg) + '" title="' + escapeHtml(ex.msg) + '">' +
        '<span class="quick-chip-hint">' + escapeHtml(ex.hint) + '</span>' +
        '<span class="quick-chip-text">' + escapeHtml(ex.msg) + '</span>' +
        '</button>';
    });
    broChips.innerHTML = html;
    broChips.querySelectorAll(".quick-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var msg = btn.getAttribute("data-msg") || "";
        broTextarea.value = msg;
        broTextarea.focus();
        // 选中 chip 后直接生成，体验更顺
        doGenerate();
      });
    });
  }

  /* ---------- 生成 ---------- */
  function readOpts() {
    var nickname = broNickname.value.trim();
    var address = broAddress.value.trim() || "哥";
    var hostName = broHostName.value.trim();
    var opts = { address: address };
    if (nickname) opts.brotherName = nickname;
    if (hostName) opts.hostName = hostName;
    return opts;
  }

  function doGenerate() {
    var msg = broTextarea.value.trim();
    if (!msg) {
      showToast("先输入大哥原话再生成");
      broTextarea.focus();
      return;
    }
    // 按钮永远可点击：不在 disabled 状态下卡住
    try {
      var opts = readOpts();
      var analysis = analyzeBrotherQuote(msg, opts);
      var replies = generateOnePerPersonality(msg, opts);
      currentAnalysis = analysis;
      currentReplies = replies && replies._analysis ? replies.slice() : (replies || []);
      currentMessage = msg;

      renderAnalysis(analysis, msg);
      renderCards(replies);
    } catch (err) {
      console.error("1v1 生成失败:", err);
      showToast("生成失败：" + (err && err.message ? err.message : "未知错误"));
    }
  }

  /* ---------- 渲染分析面板 ---------- */
  function renderAnalysis(a, msg) {
    if (!a) { analysisWrap.innerHTML = ""; return; }

    var cls = "analysis-card";
    if (a.crossLine) cls += " danger";
    else if (a.toneLevel >= 2) cls += " hot";
    else if (a.toneLevel < 0) cls += " cold";

    var alertBox = "";
    if (a.crossLine) {
      alertBox = '<div class="analysis-alert-box"><strong>⚠️ 越界提醒：</strong>' +
        escapeHtml(a.crossLineType) + ' —— 建议用「温柔一刀/成熟直给/毒舌封死」3 张卡，不要用甜/撒娇/活泼，避免被误解为"有机会"。</div>';
    }

    var kw = (a.matchedWords || []).map(function (w) {
      return '<span class="kw-chip">' + escapeHtml(w) + '</span>';
    }).join("");

    var hints = (a.replyHints || []).map(function (h) {
      return '<li>' + escapeHtml(h) + '</li>';
    }).join("");

    var intensityLabel = a.suggestIntensity === "heatup" ? "🔥 升温" :
      (a.suggestIntensity === "warmup" ? "🌿 保守" : "💬 日常");

    analysisWrap.innerHTML =
      '<div class="' + cls + '">' +
        '<div class="analysis-title">🧠 原话深度分析' +
          (a.crossLine ? ' <span class="analysis-alert">越界</span>' : '') +
        '</div>' +
        '<div class="analysis-grid">' +
          '<div><span class="k">识别场景</span><span class="v">' + escapeHtml(a.scenarioLabel) + '</span></div>' +
          '<div><span class="k">大哥画像</span><span class="v">' + escapeHtml(a.brotherType) + '</span></div>' +
          '<div><span class="k">情绪温度</span><span class="v">' + (a.toneLevel >= 2 ? "🔥热" : a.toneLevel === 1 ? "💬平" : a.toneLevel === 0 ? "😐中" : "🥶冷") + (a.toneTags && a.toneTags.length ? "·" + escapeHtml(a.toneTags.join("/")) : "") + '</span></div>' +
          '<div><span class="k">建议称呼</span><span class="v">' + escapeHtml(a.suggestAddress) + '</span></div>' +
          '<div><span class="k">建议强度</span><span class="v">' + intensityLabel + '</span></div>' +
          '<div><span class="k">越界</span><span class="v">' + (a.crossLine ? escapeHtml(a.crossLineType) : "无") + '</span></div>' +
        '</div>' +
        alertBox +
        (kw ? '<div class="analysis-chips"><span class="chips-label">关键词命中：</span>' + kw + '</div>' : '') +
        (hints ? '<ul class="analysis-hints">' + hints + '</ul>' : '') +
        '<div class="analysis-actions">' +
          '<button class="regen-btn primary" type="button" id="saveBroBtn">💾 保存到大哥档案</button>' +
          '<button class="regen-btn" type="button" id="exportBtn">📤 导出文本</button>' +
          '<button class="regen-btn" type="button" id="regenBtn">🔁 再生成一次</button>' +
        '</div>' +
      '</div>';

    var saveBroBtn = $("saveBroBtn");
    var exportBtn = $("exportBtn");
    var regenBtn = $("regenBtn");
    if (saveBroBtn) saveBroBtn.addEventListener("click", saveCurrentBro);
    if (exportBtn) exportBtn.addEventListener("click", exportCurrent);
    if (regenBtn) regenBtn.addEventListener("click", doGenerate);
  }

  /* ---------- 渲染 8 张卡 ---------- */
  function renderCards(replies) {
    if (!replies || replies.length === 0) {
      broGridWrap.innerHTML = '<div class="empty-state"><div>💡 这个场景暂时没有匹配的模板，换条原话试试</div></div>';
      cardCount.textContent = "0";
      return;
    }
    cardCount.textContent = String(replies.length);
    var html = '<div class="bro-grid">';
    replies.forEach(function (r, idx) {
      var cardCls = "bro-card";
      var flag = "";
      if (r.isCrossLineSafe === true) { cardCls += " safe"; flag = '<span class="safe-flag ok">✓ 安全</span>'; }
      else if (r.isCrossLineSafe === false) { cardCls += " warn-card"; flag = '<span class="safe-flag warn">⚠ 慎用</span>'; }

      var intensityCls = "i-" + (r.intensity || "daily");
      var intensityText = r.intensity === "heatup" ? "🔥升温" : r.intensity === "warmup" ? "🌿保守" : "💬日常";

      html += '<div class="' + cardCls + '">' +
        '<div class="bro-card-head">' +
          flag +
          '<span class="bro-card-emoji">' + escapeHtml(r.emoji) + '</span>' +
          '<span class="bro-card-label">' + escapeHtml(r.label) + '</span>' +
          '<span class="intensity-badge ' + intensityCls + '">' + intensityText + '</span>' +
        '</div>' +
        '<div class="bro-card-scenario">场景：' + escapeHtml(r.scenario) + '</div>' +
        '<div class="bro-card-text">' + escapeHtml(r.text) + '</div>' +
        '<div class="bro-card-actions">' +
          '<button class="regen-btn primary" type="button" data-act="copy" data-idx="' + idx + '">📋 复制</button>' +
          '<button class="regen-btn" type="button" data-act="fav" data-idx="' + idx + '">⭐ 收藏</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    broGridWrap.innerHTML = html;

    broGridWrap.querySelectorAll(".regen-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        var act = btn.getAttribute("data-act");
        var r = replies[idx];
        if (!r) return;
        if (act === "copy") copyText(r.text);
        else if (act === "fav") saveCurrentBro();
      });
    });
  }

  /* ---------- 复制 ---------- */
  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("✅ 已复制到剪贴板");
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("✅ 已复制");
    } catch (e) { showToast("复制失败，请手动选中文本"); }
  }

  /* ---------- 导出文本 ---------- */
  function exportCurrent() {
    if (!currentMessage && (!currentReplies || currentReplies.length === 0)) {
      showToast("先生成一次再导出");
      return;
    }
    var record = {
      brotherMessage: currentMessage,
      nickname: broNickname.value.trim(),
      analysis: currentAnalysis,
      replies: currentReplies,
    };
    var text;
    try { text = exportBrotherRecord(record); }
    catch (e) { text = fallbackExport(record); }
    copyText(text);
  }
  function fallbackExport(record) {
    var lines = [];
    lines.push("【大哥原话】" + (record.brotherMessage || ""));
    if (record.nickname) lines.push("【大哥备注】" + record.nickname);
    (record.replies || []).forEach(function (r) {
      lines.push("『" + r.emoji + " " + r.label + "』");
      lines.push(r.text);
      lines.push("");
    });
    return lines.join("\\n").trim();
  }

  /* ---------- 大哥档案（localStorage 持久化） ---------- */
  function getBros() { return loadJSON(LS_BROS, []); }
  function setBros(arr) {
    saveJSON(LS_BROS, arr);
    renderBros();
  }

  function saveCurrentBro() {
    if (!currentMessage) {
      showToast("先输入大哥原话并生成");
      return;
    }
    if (!currentReplies || currentReplies.length === 0) {
      showToast("当前没有可保存的回复");
      return;
    }
    var nickname = broNickname.value.trim();
    var bros = getBros();
    var rec = {
      id: "bro_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
      ts: Date.now(),
      brotherMessage: currentMessage,
      nickname: nickname,
      address: broAddress.value.trim(),
      hostName: broHostName.value.trim(),
      analysis: currentAnalysis,
      replies: currentReplies,
    };
    bros.unshift(rec);
    setBros(bros);
    showToast("✅ 已保存到大哥档案");
  }

  function deleteBro(id) {
    var bros = getBros().filter(function (b) { return b.id !== id; });
    setBros(bros);
    showToast("已删除");
  }

  function restoreBro(b) {
    broTextarea.value = b.brotherMessage || "";
    if (b.nickname) broNickname.value = b.nickname;
    if (b.address) broAddress.value = b.address;
    if (b.hostName) broHostName.value = b.hostName;
    currentMessage = b.brotherMessage || "";
    currentAnalysis = b.analysis || null;
    currentReplies = b.replies || [];
    renderAnalysis(currentAnalysis, currentMessage);
    renderCards(currentReplies);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportBro(b) {
    var text;
    try { text = exportBrotherRecord(b); }
    catch (e) { text = fallbackExport(b); }
    copyText(text);
  }

  function renderBros() {
    var bros = getBros();
    broCount.textContent = String(bros.length);
    if (bros.length === 0) {
      brosListWrap.innerHTML = '<div class="empty-state"><div>💡 还没有保存的大哥档案，生成一次后点「💾 保存到大哥档案」即可建档</div></div>';
      return;
    }
    var html = '<div class="bros-list">';
    bros.forEach(function (b) {
      var a = b.analysis || {};
      var alertHtml = a.crossLine ? '<span class="bro-alert">⚠ 越界</span>' : "";
      var repliesCount = (b.replies || []).length;
      html += '<div class="bro-row" data-id="' + escapeHtml(b.id) + '">' +
        '<div class="bro-row-head" data-act="toggle">' +
          '<div class="bro-avatar">' + escapeHtml(initial(b.nickname)) + '</div>' +
          '<div class="bro-main">' +
            '<div class="bro-name-row">' +
              '<span class="bro-nickname">' + escapeHtml(b.nickname || "未备注大哥") + '</span>' +
              (a.brotherType ? '<span class="bro-type">' + escapeHtml(a.brotherType) + '</span>' : "") +
              alertHtml +
            '</div>' +
            '<div class="bro-quote">' + escapeHtml(b.brotherMessage || "") + '</div>' +
            '<div class="bro-meta">' +
              '<span>' + escapeHtml(formatTime(b.ts)) + '</span>' +
              (a.scenarioLabel ? '<span class="sep">·</span><span>' + escapeHtml(a.scenarioLabel) + '</span>' : "") +
              (repliesCount ? '<span class="sep">·</span><span>' + repliesCount + ' 条回复</span>' : "") +
            '</div>' +
          '</div>' +
          '<div class="bro-caret">▾</div>' +
        '</div>' +
        '<div class="bro-detail">' +
          '<div class="bro-detail-actions">' +
            '<button class="regen-btn primary" type="button" data-act="restore">🔁 回到 1v1 模式重调</button>' +
            '<button class="regen-btn" type="button" data-act="export">📤 导出文本</button>' +
            '<button class="regen-btn" type="button" data-act="delete">🗑 删除档案</button>' +
          '</div>' +
          (a.replyHints && a.replyHints.length ?
            '<div class="analysis-chips"><span class="chips-label">小贴士：</span>' +
              a.replyHints.map(function (h) { return '<span class="hint-chip">💡 ' + escapeHtml(h) + '</span>'; }).join("") +
            '</div>' : "") +
          (a.matchedWords && a.matchedWords.length ?
            '<div class="analysis-chips"><span class="chips-label">关键词：</span>' +
              a.matchedWords.map(function (w) { return '<span class="kw-chip">' + escapeHtml(w) + '</span>'; }).join("") +
            '</div>' : "") +
          '<div class="bro-detail-quotes">' +
            (b.replies || []).map(function (r) {
              return '<div style="margin-bottom:10px"><strong>' + escapeHtml(r.emoji) + ' ' + escapeHtml(r.label) + '</strong><br/>' + escapeHtml(r.text) + '</div>';
            }).join("") +
          '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    brosListWrap.innerHTML = html;

    brosListWrap.querySelectorAll(".bro-row").forEach(function (row) {
      var id = row.getAttribute("data-id");
      var bro = bros.find(function (x) { return x.id === id; }) || {};
      row.querySelector('[data-act="toggle"]').addEventListener("click", function () {
        row.classList.toggle("open");
      });
      var restoreBtn = row.querySelector('[data-act="restore"]');
      var exportBtnRow = row.querySelector('[data-act="export"]');
      var delBtn = row.querySelector('[data-act="delete"]');
      if (restoreBtn) restoreBtn.addEventListener("click", function () { restoreBro(bro); });
      if (exportBtnRow) exportBtnRow.addEventListener("click", function () { exportBro(bro); });
      if (delBtn) delBtn.addEventListener("click", function () { deleteBro(id); });
    });
  }

  /* ---------- 事件绑定 ---------- */
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
  if (generateBtn) generateBtn.addEventListener("click", doGenerate);
  // Ctrl/Cmd + Enter 快捷生成
  if (broTextarea) {
    broTextarea.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doGenerate();
      }
    });
  }

  /* ---------- 初始化 ---------- */
  var savedTheme = loadJSON(LS_THEME, "dark");
  applyTheme(savedTheme);
  renderChips();
  renderBros();
})();
</script>
</body>
</html>
`;

// 6) 写入文件
var outPath = path.join(ROOT, "public", "1v1.html");
fs.mkdirSync(path.join(ROOT, "public"), { recursive: true });
fs.writeFileSync(outPath, html, "utf8");

console.log("✅ 已生成:", outPath);
console.log("   文件大小:", (fs.statSync(outPath).size / 1024).toFixed(1) + " KB");
console.log("   scripts.json 数据大小:", (scriptDataLiteral.length / 1024).toFixed(1) + " KB");
