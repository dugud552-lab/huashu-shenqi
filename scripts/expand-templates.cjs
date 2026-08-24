/* eslint-disable */
/**
 * 模板扩展脚本：把现有 1898 条模板通过语义保持的变体生成扩到 10000+ 条
 *
 * 变体生成策略（每个模板生成 4~6 个变体）：
 *   1) 同义词替换（谢谢 → 感谢/谢啦/辛苦了）
 *   2) 句式重排（A→B→C 变 B→A→C / C→B→A）
 *   3) 语气词增减（加 呀/嘛/哦/啦；去 重叠字）
 *   4) 标点变化（。→！/，→~）
 *   5) 句段合并/拆分（多段合并为一段，或单段拆成两句）
 *   6) 表情插入（按场景情绪插入对应 emoji）
 *
 * 保留：
 *   - 变量占位符 {user}/{brother}/{gift}/{amount}/{topic}/{host}
 *   - 核心意图（拒绝类不能变成同意类）
 *
 * 用法：node scripts/expand-templates.cjs
 */
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data", "scripts.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// ============================================================
// 同义词表（双向使用：from→to 也可 to→from）
// ============================================================
const SYNONYMS = {
  // 感谢类
  "谢谢": ["感谢", "谢啦", "谢咯", "多谢", "辛苦你了", "破费了"],
  "感谢": ["谢谢", "谢啦", "多谢"],
  "谢谢谢": ["谢谢", "感谢感谢", "谢啦谢啦"],
  // 称呼
  "哥": ["哥", "老哥", "哥哥"],
  "宝": ["宝", "宝贝", "宝宝"],
  "老板": ["老板", "boss", "老板儿"],
  // 通用动词
  "知道": ["知道", "明白", "了解", "懂了"],
  "明白": ["明白", "懂了", "了解", "知道"],
  "好的": ["好的", "好嘞", "行", "好哒", "好滴", "嗯嗯"],
  "好嘞": ["好嘞", "好的", "行嘞", "收到"],
  "收到": ["收到", "明白", "好的", "知道啦"],
  "行": ["行", "可以", "好", "没问题"],
  "可以": ["可以", "行", "没问题", "好呀"],
  "没问题": ["没问题", "可以", "行", "包在我身上"],
  // 礼物类
  "礼物": ["礼物", "心意", "东西"],
  "心意": ["心意", "礼物", "情谊"],
  "刷": ["刷", "打", "投", "送"],
  "打赏": ["打赏", "投喂", "支持", "刷"],
  "投喂": ["投喂", "打赏", "支持"],
  // 情感
  "想你": ["想你", "惦记你", "念你", "牵挂你"],
  "喜欢": ["喜欢", "中意", "看上", "相中"],
  "开心": ["开心", "高兴", "乐呵", "美滋滋"],
  "高兴": ["高兴", "开心", "乐呵", "愉快"],
  "难过": ["难过", "心里难受", "不舒服", "憋屈"],
  "累": ["累", "疲惫", "辛苦", "乏"],
  "辛苦": ["辛苦", "累", "疲惫"],
  // 时间
  "今天": ["今天", "今日", "今儿"],
  "明天": ["明天", "明日", "明儿"],
  "现在": ["现在", "眼下", "目前", "当下"],
  "一会儿": ["一会儿", "稍后", "待会儿"],
  // 程度
  "真的": ["真的", "确实", "真心", "果真"],
  "确实": ["确实", "真的", "的确"],
  "特别": ["特别", "尤其", "格外", "非常"],
  "非常": ["非常", "特别", "十分", "极其"],
  // 转折
  "但是": ["但是", "可是", "不过", "然而", "只是"],
  "可是": ["可是", "但是", "不过"],
  "不过": ["不过", "但是", "可是", "然而"],
  // 通用
  "觉得": ["觉得", "感觉", "认为", "想"],
  "感觉": ["感觉", "觉得", "感觉上"],
  "以为": ["以为", "觉得", "认为"],
  "怎么": ["怎么", "咋", "如何"],
  "什么": ["什么", "啥", "何"],
  "为什么": ["为什么", "为啥", "咋回事"],
  // 否定类（保守，避免改变意图）
  "不要": ["不要", "别", "不想"],
  "不行": ["不行", "不可以", "不成"],
  "不可以": ["不可以", "不行", "不成"],
};

// 句末语气词（按性格分池）
const PARTICLES_BY_PERSONALITY = {
  gentle:     ["呀", "呢", "哦", "嘛"],
  tsundere:   ["哼", "呗", "咯", "而已"],
  lively:     ["啦", "呀", "哒", "喽"],
  coquettish: ["嘛~", "呀~", "哒~", "啦~"],
  humorous:   ["哈", "啦", "呗", "咯"],
  mature:     ["", "的", "了", "而已"],
  sharp:      ["啊", "咯", "呗", "得了"],
  sweet:      ["嘛", "呀", "哒", "啦"],
};

// 表情池（按场景情绪）
const EMOJI_BY_SCENARIO = {
  confession:    ["💕", "💖", "💗", "🌸", "🥺", "✨"],
  gift_thanks:   ["🎁", "💖", "💝", "🥰", "✨", "🌸"],
  pk_support:    ["🔥", "💪", "⚔️", "🎯", "⚡", "🛡️"],
  ambiguous:     ["💗", "💫", "🥺", "🌙", "☁️", "💖"],
  reject:        ["🚫", "🙅", "❌", "🛑", "⚠️"],
  send_pic:      ["🙅", "🚫", "😅", "🙈", "直播间见"],
  greeting:      ["👋", "😊", "✨", "🌟", "💫"],
  daily_care:    ["☀️", "🌙", "☕", "🤍", "🌿"],
  comfort:       ["🫂", "🤍", "💝", "🥺", "💪"],
  complaint:     ["😮‍💨", "😤", "💢", "🙄", "🤦"],
  follow_up:     ["👋", "😊", "💭", "🌙", "✨"],
  invitation:    ["🍵", "🤝", "💫", "🌸", "☕"],
  compliment:    ["😊", "🥰", "💫", "💕", "✨"],
  personal_qa:   ["🤔", "💭", "🙈", "😊", "✨"],
  work_life:     ["💼", "☕", "💪", "🌟", "🤍"],
  food:          ["🍜", "🧋", "🍱", "🍩", "🤤"],
  weekend:       ["🌟", "☕", "🌿", "💫", "🌙"],
  late_night:    ["🌙", "☁️", "💫", "🤍", "💭"],
  late_night_song:["🎵", "🎶", "🎤", "🌙", "💫"],
  festival:      ["🎉", "🎊", "🥳", "✨", "🎈"],
  birthday:      ["🎂", "🎉", "🥳", "🎈", "🎁"],
  after_stream:  ["🌙", "☕", "🤍", "💤", "✨"],
  general:       ["✨", "💫", "🌟", "🤍", "💕"],
};

// ============================================================
// 工具函数
// ============================================================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(n) { return Math.random() < n; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 变体 1：同义词替换（保守，只替换 1~2 处，避免语义漂移）
function variantSynonym(tpl) {
  let result = tpl;
  const keys = Object.keys(SYNONYMS).filter(k => result.includes(k));
  if (keys.length === 0) return tpl;
  // 随机选 1~2 个可替换的词
  const chosen = shuffle(keys).slice(0, Math.min(2, keys.length));
  for (const k of chosen) {
    const replacers = SYNONYMS[k].filter(v => v !== k);
    if (replacers.length === 0) continue;
    const to = pick(replacers);
    // 只替换第一个出现，避免全替换改变语义
    result = result.replace(k, to);
  }
  return result;
}

// 变体 2：句式重排（多段时换段顺序）
function variantReorder(tpl) {
  const parts = tpl.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) return tpl;
  // 保留首段，重排中段
  const first = parts[0];
  const middle = parts.slice(1, -1);
  const last = parts[parts.length - 1];
  if (middle.length < 2) return tpl;
  const shuffledMiddle = shuffle(middle);
  return [first, ...shuffledMiddle, last].join("\n");
}

// 变体 3：语气词增减
function variantParticle(tpl, personalityKey) {
  const pool = PARTICLES_BY_PERSONALITY[personalityKey] || PARTICLES_BY_PERSONALITY.gentle;
  // 50% 加一个语气词到句末，50% 不变
  if (!rand(0.5)) return tpl;
  // 找最后一个完整句子的末尾
  const parts = tpl.split(/\n+/);
  const lastIdx = parts.length - 1;
  let last = parts[lastIdx];
  // 句末是 。/！/？ 时，在标点前插入；否则直接末尾加
  const tailMatch = last.match(/([。！？!?~]+)$/);
  if (tailMatch) {
    const p = pick(pool);
    if (p) last = last.slice(0, -tailMatch[1].length) + p + tailMatch[1];
  } else {
    const p = pick(pool);
    if (p) last = last + p;
  }
  parts[lastIdx] = last;
  return parts.join("\n");
}

// 变体 4：标点变化
function variantPunct(tpl) {
  let result = tpl;
  // 30% 把 。变 ！（提升情绪），30% 把 ！变 。，20% 把 ，变 ~（撒娇）
  const r = Math.random();
  if (r < 0.3) {
    result = result.replace(/。/g, () => rand(0.5) ? "！" : "。");
  } else if (r < 0.6) {
    result = result.replace(/！/g, () => rand(0.5) ? "。" : "！");
  } else if (r < 0.8) {
    result = result.replace(/，/g, () => rand(0.3) ? "~" : "，");
  }
  return result;
}

// 变体 5：句段合并 / 拆分
function variantMerge(tpl) {
  const parts = tpl.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return tpl;
  if (rand(0.5)) {
    // 合并：把多段用空格连起来（变成一段）
    return parts.join(" ");
  }
  // 拆分：把第一段按句号拆成两段
  const first = parts[0];
  const sentences = first.split(/。/).filter(Boolean);
  if (sentences.length >= 2) {
    const newFirst = sentences[0] + "。";
    const newSecond = sentences.slice(1).join("。") + "。";
    return [newFirst, newSecond, ...parts.slice(1)].join("\n");
  }
  return tpl;
}

// 变体 6：表情插入
function variantEmoji(tpl, scenarioKey) {
  const pool = EMOJI_BY_SCENARIO[scenarioKey] || EMOJI_BY_SCENARIO.general;
  if (!rand(0.4)) return tpl;
  // 末尾加 1 个表情
  const e = pick(pool);
  return tpl.replace(/([。！？!?~]*)$/, "$1 " + e);
}

// 综合生成变体（确保与原模板不同）
function makeVariant(tpl, scenarioKey, personalityKey, usedSet) {
  const fns = [
    () => variantSynonym(tpl),
    () => variantReorder(tpl),
    () => variantParticle(tpl, personalityKey),
    () => variantPunct(tpl),
    () => variantMerge(tpl),
    () => variantEmoji(tpl, scenarioKey),
  ];
  // 组合 1~2 个变换
  const n = rand(0.5) ? 1 : 2;
  const picked = shuffle(fns).slice(0, n);
  let result = tpl;
  for (const fn of picked) {
    const next = fn();
    if (next && next !== result) result = next;
  }
  // 确保不与已用模板重复，且与原模板不同
  if (result === tpl || usedSet.has(result)) {
    // 强制做一次同义词替换
    result = variantSynonym(result);
    if (result === tpl || usedSet.has(result)) return null;
  }
  return result;
}

// ============================================================
// 主流程
// ============================================================
const TARGET = 50000;
const { scenarios, personalities } = data;
const personalityKeys = Object.keys(personalities);
const scenarioKeys = Object.keys(scenarios);

let total = 0;
for (const sk of scenarioKeys) {
  const tpl = scenarios[sk].templates || {};
  for (const pk of personalityKeys) {
    total += (tpl[pk] || []).length;
  }
}
console.log(`当前模板总数：${total}`);
console.log(`目标：${TARGET}`);
console.log(`需要新增：${TARGET - total}`);

// 按场景×性格的"缺口"分配扩展配额
// 每个场景×性格组目标条数 = ceil(TARGET / 场景数 / 性格数)
const perGroup = Math.ceil(TARGET / scenarioKeys.length / personalityKeys.length);
console.log(`每组目标：${perGroup} 条`);

let added = 0;
let skipped = 0;

for (const sk of scenarioKeys) {
  const scenario = scenarios[sk];
  if (!scenario.templates) scenario.templates = {};

  for (const pk of personalityKeys) {
    const arr = scenario.templates[pk] || [];
    const usedSet = new Set(arr);
    const need = Math.max(0, perGroup - arr.length);
    if (need === 0) continue;

    // 基于现有模板做变体（如果现有为空，跳过——不能凭空生成）
    if (arr.length === 0) {
      skipped += need;
      continue;
    }

    const seeds = [...arr];
    let tries = 0;
    let addedHere = 0;
    while (addedHere < need && tries < need * 8) {
      tries++;
      // 随机选一个种子模板
      const seed = pick(seeds);
      const variant = makeVariant(seed, sk, pk, usedSet);
      if (variant && !usedSet.has(variant)) {
        arr.push(variant);
        usedSet.add(variant);
        addedHere++;
      }
    }
    added += addedHere;
    scenario.templates[pk] = arr;
  }
}

console.log(`新增：${added} 条`);
console.log(`跳过（无种子）：${skipped} 条`);

// 重新统计
let newTotal = 0;
for (const sk of scenarioKeys) {
  const tpl = scenarios[sk].templates || {};
  for (const pk of personalityKeys) {
    newTotal += (tpl[pk] || []).length;
  }
}
console.log(`扩展后总数：${newTotal}`);

// 如果还差很多，做第二轮（基于新生成的变体继续扩展）
let round = 2;
while (newTotal < TARGET && round <= 30) {
  console.log(`\n=== 第 ${round} 轮扩展 ===`);
  let added2 = 0;
  for (const sk of scenarioKeys) {
    const scenario = scenarios[sk];
    if (!scenario.templates) continue;
    for (const pk of personalityKeys) {
      const arr = scenario.templates[pk] || [];
      if (arr.length === 0) continue;
      const usedSet = new Set(arr);
      const need = Math.max(0, perGroup - arr.length);
      if (need === 0) continue;
      // 🆕 种子池：每轮扩大种子范围，新增的变体也作种子
      const seeds = [...arr];
      let tries = 0;
      let addedHere = 0;
      // 提高 tries 上限，50000 条需要更多次尝试
      while (addedHere < need && tries < need * 20) {
        tries++;
        const seed = pick(seeds);
        const variant = makeVariant(seed, sk, pk, usedSet);
        if (variant && !usedSet.has(variant)) {
          arr.push(variant);
          usedSet.add(variant);
          addedHere++;
        }
      }
      added2 += addedHere;
      scenario.templates[pk] = arr;
    }
  }
  newTotal = 0;
  for (const sk of scenarioKeys) {
    const tpl = scenarios[sk].templates || {};
    for (const pk of personalityKeys) {
      newTotal += (tpl[pk] || []).length;
    }
  }
  console.log(`第 ${round} 轮新增：${added2}，总数：${newTotal}`);
  if (added2 === 0) break;
  round++;
}

// 写回文件（保留其他字段如 _crossLineSpecific）
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf8");
console.log(`\n✅ 扩展完成，最终总数：${newTotal}`);
console.log(`数据已写回：${dataPath}`);
