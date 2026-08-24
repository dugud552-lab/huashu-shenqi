/* eslint-disable */
/**
 * 性能报告生成器：评估 10 万条模板数据的生成质量、加载性能、运行性能
 */
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const dataPath = path.join(__dirname, "..", "data", "scripts.json");
const fileStat = fs.statSync(dataPath);
const fileSizeMB = fileStat.size / 1024 / 1024;

console.log("\n" + "=".repeat(70));
console.log("📊 模板数据库性能报告");
console.log("=".repeat(70));
console.log(`生成时间: ${new Date().toISOString()}`);
console.log(`数据文件: ${dataPath}`);

// 1) 加载性能
const t0 = performance.now();
const memBefore = process.memoryUsage().heapUsed;
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const t1 = performance.now();
const memAfter = process.memoryUsage().heapUsed;

console.log("\n" + "─".repeat(70));
console.log("1️⃣  数据加载性能");
console.log("─".repeat(70));
console.log(`  加载耗时:        ${(t1 - t0).toFixed(2)} ms`);
console.log(`  内存占用:        ${((memAfter - memBefore) / 1024 / 1024).toFixed(2)} MB`);
console.log(`  文件大小:        ${fileSizeMB.toFixed(2)} MB`);

// 2) 数据规模统计
const { scenarios, personalities } = data;
const personalityKeys = Object.keys(personalities);
const scenarioKeys = Object.keys(scenarios);

let total = 0, minLen = 9999, maxLen = 0, sumLen = 0;
const groupStats = {};
const scenarioStats = {};
const allTexts = [];

for (const sk of scenarioKeys) {
  let scTotal = 0;
  for (const pk of personalityKeys) {
    const arr = scenarios[sk].templates?.[pk] || [];
    total += arr.length;
    scTotal += arr.length;
    if (!groupStats[sk]) groupStats[sk] = {};
    groupStats[sk][pk] = arr.length;
    for (const t of arr) {
      const len = t.length;
      sumLen += len;
      if (len < minLen) minLen = len;
      if (len > maxLen) maxLen = len;
      allTexts.push(t);
    }
  }
  scenarioStats[sk] = scTotal;
}

console.log("\n" + "─".repeat(70));
console.log("2️⃣  数据规模统计");
console.log("─".repeat(70));
console.log(`  总模板数:        ${total.toLocaleString()} 条`);
console.log(`  场景数:          ${scenarioKeys.length}`);
console.log(`  性格数:          ${personalityKeys.length}`);
console.log(`  场景×性格组数:  ${scenarioKeys.length * personalityKeys.length}`);
console.log(`  平均每组:        ${Math.round(total / (scenarioKeys.length * personalityKeys.length))} 条`);
console.log(`  模板长度:        min ${minLen} / max ${maxLen} / avg ${Math.round(sumLen / total)} 字`);

// 3) 场景分布
console.log("\n" + "─".repeat(70));
console.log("3️⃣  场景分布（按模板数排序）");
console.log("─".repeat(70));
const sortedScenarios = Object.entries(scenarioStats).sort((a, b) => b[1] - a[1]);
const maxSc = sortedScenarios[0][1];
for (const [sk, count] of sortedScenarios) {
  const bar = "█".repeat(Math.ceil(count / maxSc * 30));
  const label = (scenarios[sk].label || sk).padEnd(10);
  console.log(`  ${label} ${String(count).padStart(6)} ${bar}`);
}

// 4) 性格分布（应该是均衡的）
console.log("\n" + "─".repeat(70));
console.log("4️⃣  性格分布（均衡性检查）");
console.log("─".repeat(70));
const personalityTotals = {};
for (const pk of personalityKeys) {
  let s = 0;
  for (const sk of scenarioKeys) s += scenarios[sk].templates?.[pk]?.length || 0;
  personalityTotals[pk] = s;
}
const pVals = Object.values(personalityTotals);
const pAvg = pVals.reduce((a, b) => a + b, 0) / pVals.length;
const pMin = Math.min(...pVals), pMax = Math.max(...pVals);
const balance = ((1 - (pMax - pMin) / pAvg) * 100).toFixed(1);
for (const pk of personalityKeys) {
  const label = personalities[pk].label || pk;
  const count = personalityTotals[pk];
  const bar = "█".repeat(Math.ceil(count / pMax * 30));
  console.log(`  ${label.padEnd(8)} ${String(count).padStart(6)} ${bar}`);
}
console.log(`  均衡度: ${balance}% (min=${pMin}, max=${pMax}, avg=${Math.round(pAvg)})`);

// 5) 重复检测（抽样）
console.log("\n" + "─".repeat(70));
console.log("5️⃣  重复检测（全量）");
console.log("─".repeat(70));
const t2 = performance.now();
const seen = new Set();
let dupCount = 0;
for (const t of allTexts) {
  if (seen.has(t)) dupCount++;
  else seen.add(t);
}
const t3 = performance.now();
const dupRate = (dupCount / total * 100).toFixed(3);
console.log(`  重复模板数:      ${dupCount.toLocaleString()} / ${total.toLocaleString()}`);
console.log(`  重复率:          ${dupRate}%`);
console.log(`  去重后实际数:    ${(total - dupCount).toLocaleString()}`);
console.log(`  去重耗时:        ${(t3 - t2).toFixed(2)} ms`);

// 6) 生成性能测试
console.log("\n" + "─".repeat(70));
console.log("6️⃣  运行时生成性能（100 次模拟生成）");
console.log("─".repeat(70));
const testMessages = [
  "刚给你刷了个嘉年华 不用谢",
  "我喜欢你 做我女朋友吧",
  "我想睡你 你开价",
  "今天加班好累啊",
  "周末有空吗 出来吃个饭",
  "能借我3万块吗 周转不开",
  "给我唱一首后来吧",
  "发张照片看看呗",
];

const generatorPath = path.join(__dirname, "..", "lib", "generator.js");
const { generateOnePerPersonality, analyzeBrotherQuote } = require(generatorPath);

const runTimes = [];
const runMem = [];
for (let i = 0; i < 100; i++) {
  const msg = testMessages[i % testMessages.length];
  const mBefore = process.memoryUsage().heapUsed;
  const tStart = performance.now();
  const replies = generateOnePerPersonality(msg, {});
  const tEnd = performance.now();
  const mEnd = process.memoryUsage().heapUsed;
  runTimes.push(tEnd - tStart);
  runMem.push((mEnd - mBefore) / 1024);
}
const avgTime = runTimes.reduce((a, b) => a + b, 0) / runTimes.length;
const maxTime = Math.max(...runTimes);
const minTime = Math.min(...runTimes);
const avgMem = runMem.reduce((a, b) => a + b, 0) / runMem.length;
console.log(`  生成 8 条回复平均耗时: ${avgTime.toFixed(2)} ms`);
console.log(`  最快/最慢:           ${minTime.toFixed(2)} / ${maxTime.toFixed(2)} ms`);
console.log(`  平均内存增量:         ${avgMem.toFixed(2)} KB`);
console.log(`  QPS 估算:            ${Math.round(1000 / avgTime).toLocaleString()} 次/秒`);

// 7) 浏览器加载预估
console.log("\n" + "─".repeat(70));
console.log("7️⃣  浏览器加载性能预估");
console.log("─".repeat(70));
const bandwidths = [
  { name: "4G (10 Mbps)", mbps: 10 },
  { name: "5G (50 Mbps)", mbps: 50 },
  { name: "WiFi (100 Mbps)", mbps: 100 },
  { name: "光纤 (300 Mbps)", mbps: 300 },
];
console.log(`  数据文件大小: ${fileSizeMB.toFixed(2)} MB（gzip 压缩后约 ${(fileSizeMB * 0.18).toFixed(2)} MB）`);
for (const b of bandwidths) {
  const gzipSize = fileSizeMB * 0.18; // JSON 文本 gzip 压缩率约 18%
  const timeSec = (gzipSize * 8) / b.mbps;
  console.log(`  ${b.name}: ${(timeSec * 1000).toFixed(0)} ms (gzip 后)`);
}

// 8) 数据质量抽检
console.log("\n" + "─".repeat(70));
console.log("8️⃣  数据质量抽检（每个场景×性格抽样 1 条）");
console.log("─".repeat(70));
let emptyGroups = 0;
let shortCount = 0;
for (const sk of scenarioKeys) {
  for (const pk of personalityKeys) {
    const arr = scenarios[sk].templates?.[pk] || [];
    if (arr.length === 0) {
      emptyGroups++;
      continue;
    }
    const sample = arr[Math.floor(Math.random() * arr.length)];
    if (sample.length < 10) shortCount++;
  }
}
console.log(`  空组数:          ${emptyGroups} / ${scenarioKeys.length * personalityKeys.length}`);
console.log(`  过短模板数(<10字): ${shortCount}`);
console.log(`  数据完整度:      ${((1 - emptyGroups / (scenarioKeys.length * personalityKeys.length)) * 100).toFixed(1)}%`);

// 9) 变体多样性
console.log("\n" + "─".repeat(70));
console.log("9️⃣  变体多样性分析");
console.log("─".repeat(70));
const variantSample = allTexts.slice(0, 5000);
const prefixSet = new Set();
const suffixSet = new Set();
for (const t of variantSample) {
  prefixSet.add(t.slice(0, 4));
  suffixSet.add(t.slice(-4));
}
console.log(`  抽样数:          ${variantSample.length}`);
console.log(`  不同前缀数:      ${prefixSet.size} / ${variantSample.length}（多样性 ${((prefixSet.size / variantSample.length) * 100).toFixed(1)}%）`);
console.log(`  不同后缀数:      ${suffixSet.size} / ${variantSample.length}（多样性 ${((suffixSet.size / variantSample.length) * 100).toFixed(1)}%）`);

console.log("\n" + "=".repeat(70));
console.log("✅ 性能报告生成完毕");
console.log("=".repeat(70));
