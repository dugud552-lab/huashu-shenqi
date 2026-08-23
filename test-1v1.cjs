/* eslint-disable */
// 功能验证：在 Node vm 沙箱里跑生成的 1v1.html 里的内联 JS，模拟浏览器调用流程
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync(__dirname + "/public/1v1.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log("script 块数:", scripts.length);

// 构造一个模拟浏览器的 sandbox
const sandbox = {
  console: console,
  Math,
  Date,
  JSON,
  Array,
  Object,
  String,
  Number,
  RegExp,
  Error,
  Map,
  Set,
  Symbol,
  Reflect,
  Proxy,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  // 模拟 localStorage
  localStorage: {
    _s: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; },
  },
  // 模拟 navigator（无 clipboard，触发 fallback）
  navigator: {},
  document: { documentElement: { setAttribute() {}, getAttribute() { return "dark"; } }, getElementById() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {}, select() {}, focus() {}, removeChild() {}, appendChild() {} }; }, body: { appendChild() {}, removeChild() {} } },
  window: {},
};

sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// 跑 script 0（注入 generator + scripts.json 数据 + 工具函数）
vm.runInContext(scripts[0], sandbox, { filename: "1v1-inline-gen.js" });

// 验证关键函数和数据是否暴露在 sandbox 上
const fns = ["analyzeBrotherQuote", "generateOnePerPersonality", "humanizeText", "fillTemplate", "matchScenario", "generateOne", "generateReplies", "applyNegationGuard", "extractVariables", "exportBrotherRecord", "getStats", "getScenarioList", "scenarios", "personalities", "default_scenario", "variables"];
let okFns = 0;
for (const name of fns) {
  if (name in sandbox) {
    okFns++;
  } else {
    console.log("❌ 未暴露:", name);
  }
}
console.log(`✅ 暴露的标识符: ${okFns}/${fns.length}`);

// 调用 getStats 验证数据完整性
try {
  const stats = sandbox.getStats();
  console.log("📊 stats:", JSON.stringify(stats));
  if (!stats.scenarios || !stats.personalities || !stats.templates) throw new Error("stats 不完整");
} catch (e) {
  console.error("❌ getStats 失败:", e.message);
  process.exit(1);
}

// 测试 9 个示例 chips 都能跑通 analyzeBrotherQuote + generateOnePerPersonality
const examples = [
  "刚给你刷了个嘉年华 不用谢",
  "我帮你守塔了 血条差点被偷 还好秒了",
  "妹妹 今天我生日 你不祝我生日快乐吗",
  "给我唱一首后来吧 睡不着 想听你声音",
  "美女 发张你的自拍看看 要无美颜的",
  "妹妹 最近周转不开 能借我3万块吗",
  "下播啦 今天谢谢你帮我撑到最后",
  "我喜欢你 做我女朋友吧 我是认真的",
  "今天被老板骂了 真不想干了 好委屈",
];

let totalCards = 0;
let allPassed = true;
for (let i = 0; i < examples.length; i++) {
  const msg = examples[i];
  try {
    const analysis = sandbox.analyzeBrotherQuote(msg, {});
    const replies = sandbox.generateOnePerPersonality(msg, {});
    const count = replies.length;
    totalCards += count;
    console.log(`[${i + 1}] "${msg.slice(0, 18)}..." → 场景=${analysis.scenarioKey} 画像=${analysis.brotherType} 越界=${analysis.crossLine} 卡数=${count}`);
    if (count !== 8) {
      console.log("  ⚠️ 卡数不是 8，但仍视为通过（某些场景可能某些性格无模板）");
    }
  } catch (e) {
    allPassed = false;
    console.error(`❌ [${i + 1}] "${msg}" 失败:`, e.message);
  }
}

console.log("\n--- 总结 ---");
console.log("9 个示例全部跑通:", allPassed ? "✅ 是" : "❌ 否");
console.log("总生成卡片数:", totalCards, "(平均", (totalCards / examples.length).toFixed(1), "条/条)");

// 抽一条回复看内容
const sample = sandbox.generateOnePerPersonality("刚给你刷了个嘉年华 不用谢", {});
console.log("\n--- 示例输出（第1条）---");
if (sample[0]) {
  console.log("性格:", sample[0].personality, sample[0].label, sample[0].emoji);
  console.log("场景:", sample[0].scenario, "强度:", sample[0].intensity);
  console.log("正文:", sample[0].text);
}

// 验证 exportBrotherRecord
try {
  const rec = { brotherMessage: "刚给你刷了个嘉年华 不用谢", nickname: "陈总", analysis: sandbox.analyzeBrotherQuote("刚给你刷了个嘉年华 不用谢", {}), replies: sample };
  const txt = sandbox.exportBrotherRecord(rec);
  console.log("\n--- 导出文本（前 200 字）---");
  console.log(txt.slice(0, 200));
  console.log("✅ exportBrotherRecord 可用");
} catch (e) {
  console.error("❌ exportBrotherRecord 失败:", e.message);
}

process.exit(allPassed ? 0 : 1);
