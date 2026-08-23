import scriptData from "../data/scripts.json" with { type: "json" };

const { scenarios, personalities, default_scenario, variables } = scriptData;

/* =========================================================
   真人化后处理器 v2  —— 把"作文式模板"变成"像人发的微信"
   新增（相比 v1）：
     a) 统一的「去标点堆叠清理器」→ 修复 "✨！" "🥺~！" 这种机器味
     b) 语义重复词（谢谢谢谢 / 嗯嗯嗯 / 好好好 / 嘿嘿 / 哈哈哈哈）
     c) 思维停顿前缀（那个… / 哦对了 / 呃… / 害）
     d) 极端短变体：10% 概率直接退回 2~5 字 + 1 表情的超短回复
     e) 长度多样：不同位置的空格换行策略随机化，避免每条都是"结构类似长消息"
     f) 话术强度 (intensity)：warmup=保守距离 / daily=日常 / heatup=升温
   ========================================================= */

const SOFT_TYPOS = [
  ["好的", "好哒"], ["好的", "好滴"],
  ["知道", "造"], ["什么", "啥"],
  ["怎么", "咋"], ["这样", "酱紫"],
  ["不要", "表"], ["喜欢", "稀饭"],
  ["朋友", "盆友"], ["难过", "蓝瘦"],
  ["睡觉", "碎觉"], ["可爱", "阔耐"],
];

const MOOD_PARTICLES = ["哈", "嘛", "哦", "啦", "呢", "呗", "诶", "唔", "咯", "喽", "啊", "喔"];

const TINY_EMOJI = [
  "🌸","💫","✨","🥺","😜","😝","🫠","🤭","😏","🫶","💭","🌙","☀️","🤍","👉👈",
  "🥰","💖","🫡","🤤","🥲","😇","🤠","🤐","😘","🤗","💘","🩷","🌷","☁️","🍻"
];

const PAUSE_STARTERS = ["那个…", "哦对了，", "呃…", "害，", "其实吧，", "怎么说呢…", "嗯~…", "哎，"];

const CHAR_REPEAT = [
  ["谢谢", "谢谢谢谢"], ["嗯嗯", "嗯嗯嗯"], ["好好好", "好好好"], ["哈哈", "哈哈哈哈"],
  ["哎呀", "哎呀哎呀"], ["宝贝", "宝贝宝贝"], ["哥哥", "哥哥哥"], ["好嘞", "好嘞好嘞"],
  ["在的", "在的在的"], ["收到", "收到收到"],
];

const PERSONALITY_STYLE = {
  gentle:     { emojiChance: 0.30, particleChance: 0.45, chopChance: 0.35, typosChance: 0.10, exBias: 0.10, waveBias: 0.15, repeatChance: 0.15, pauseChance: 0.08, ultraShortChance: 0.04 },
  tsundere:   { emojiChance: 0.10, particleChance: 0.20, chopChance: 0.55, typosChance: 0.02, exBias: 0.55, waveBias: 0.00, repeatChance: 0.03, pauseChance: 0.15, ultraShortChance: 0.08 },
  lively:     { emojiChance: 0.60, particleChance: 0.55, chopChance: 0.20, typosChance: 0.15, exBias: 0.70, waveBias: 0.10, repeatChance: 0.35, pauseChance: 0.05, ultraShortChance: 0.03 },
  coquettish: { emojiChance: 0.55, particleChance: 0.70, chopChance: 0.25, typosChance: 0.05, exBias: 0.10, waveBias: 0.90, repeatChance: 0.28, pauseChance: 0.04, ultraShortChance: 0.02 },
  humorous:   { emojiChance: 0.45, particleChance: 0.40, chopChance: 0.40, typosChance: 0.12, exBias: 0.40, waveBias: 0.05, repeatChance: 0.22, pauseChance: 0.25, ultraShortChance: 0.08 },
  mature:     { emojiChance: 0.08, particleChance: 0.15, chopChance: 0.60, typosChance: 0.01, exBias: 0.00, waveBias: 0.00, repeatChance: 0.02, pauseChance: 0.20, ultraShortChance: 0.05 },
  sharp:      { emojiChance: 0.05, particleChance: 0.10, chopChance: 0.65, typosChance: 0.01, exBias: 0.80, waveBias: 0.00, repeatChance: 0.02, pauseChance: 0.18, ultraShortChance: 0.08 },
  sweet:      { emojiChance: 0.72, particleChance: 0.78, chopChance: 0.12, typosChance: 0.06, exBias: 0.20, waveBias: 0.78, repeatChance: 0.30, pauseChance: 0.03, ultraShortChance: 0.02 },
};

/* 强度档位对参数的乘数：warmup 收敛、daily 中性、heatup 放大 */
const INTENSITY_MULT = {
  warmup:  { emoji: 0.55, particle: 0.70, chop: 1.15, typos: 0.70, ex: 0.70, wave: 0.55, repeat: 0.40, pause: 1.10, ultraShort: 0.50 },
  daily:   { emoji: 1.00, particle: 1.00, chop: 1.00, typos: 1.00, ex: 1.00, wave: 1.00, repeat: 1.00, pause: 1.00, ultraShort: 1.00 },
  heatup:  { emoji: 1.35, particle: 1.25, chop: 0.75, typos: 1.20, ex: 1.30, wave: 1.35, repeat: 1.60, pause: 0.80, ultraShort: 0.40 },
};

function rand(n) { return Math.random() < Math.max(0, Math.min(1, n)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** 统一去标点堆叠：把 "~！~" "✨！" "？！" 这类清成一个主标点 */
function cleanupPunctuation(str) {
  let s = str;
  // 1) 表情/字母后紧跟的单独叹号/问号直接删除，避免"✨！🥺！"
  s = s.replace(/([\p{Extended_Pictographic}\p{Emoji_Presentation}a-zA-Z])\s*[!！]+/gu, "$1");
  s = s.replace(/([\p{Extended_Pictographic}\p{Emoji_Presentation}a-zA-Z])\s*[?？]+/gu, "$1");
  // 2) ~ 波浪号最多保留 2 个
  s = s.replace(/~~+/g, "~~");
  // 3) ！？ 最多 2 个
  s = s.replace(/！！！+/g, "！！");
  s = s.replace(/！！！+/g, "！！");
  s = s.replace(/\?\?\?+/g, "？？");
  s = s.replace(/？？？+/g, "？？");
  // 4) ，，或，。 这种合并成单个
  s = s.replace(/，，+/g, "，");
  s = s.replace(/，。/g, "。");
  s = s.replace(/。。+/g, "。");
  // 5) 表情前后多余的空格：表情之间 1 空格
  s = s.replace(/([\p{Extended_Pictographic}\p{Emoji_Presentation}])\s{2,}(?=[\p{Extended_Pictographic}\p{Emoji_Presentation}])/gu, "$1 ");
  // 6) 句首标点：",/，/。" 开头删掉
  s = s.replace(/^[，,。.\s]+/, "");
  return s.trim();
}

/**
 * 真人化主入口
 * @param {"warmup"|"daily"|"heatup"} intensity
 */
export function humanizeText(text, personalityKey = "gentle", intensity = "daily") {
  const base = PERSONALITY_STYLE[personalityKey] || PERSONALITY_STYLE.gentle;
  const mult = INTENSITY_MULT[intensity] || INTENSITY_MULT.daily;
  const style = {
    emojiChance:      base.emojiChance      * mult.emoji,
    particleChance:   base.particleChance   * mult.particle,
    chopChance:       base.chopChance       * mult.chop,
    typosChance:      base.typosChance      * mult.typos,
    exBias:           base.exBias           * mult.ex,
    waveBias:         base.waveBias         * mult.wave,
    repeatChance:     base.repeatChance     * mult.repeat,
    pauseChance:      base.pauseChance      * mult.pause,
    ultraShortChance: base.ultraShortChance * mult.ultraShort,
  };

  let result = text;

  // 0) 超短回复变体：毒舌/傲娇/幽默 30% 概率直接退化成 2~5 个字
  if (rand(style.ultraShortChance)) {
    const ultraShortPool = {
      tsundere: ["嗯", "行吧", "知道了", "随便", "别闹", "哦", "不", "不行"],
      sharp:    ["切", "滚", "别扯", "得了", "拉倒", "呵呵", "说人话"],
      humorous: ["哈哈哈哈", "笑死", "离谱", "我真的", "栓Q", "你牛"],
      mature:   ["嗯", "收到", "了解", "好的", "辛苦了"],
      gentle:   ["好呀", "嗯嗯", "在的", "怎么啦", "好的呀"],
      lively:   ["哇！", "收到！", "哈哈", "好嘞", "来啦"],
      coquettish:["嗯~", "好嘛~", "知道啦~", "收到~", "讨厌~"],
      sweet:    ["么么哒", "宝贝~", "爱你哦", "收到啦~"],
    };
    const pool = ultraShortPool[personalityKey] || ultraShortPool.gentle;
    let short = pick(pool);
    // 超短 + 偶尔双字重复
    if (rand(0.3) && short.length <= 3) short = short + short;
    // 加 1 个表情概率
    if (rand(style.emojiChance * 0.9)) short = short + " " + pick(TINY_EMOJI);
    return cleanupPunctuation(short);
  }

  // 1) 轻微错别字替换
  for (const [from, to] of SOFT_TYPOS) {
    if (rand(style.typosChance * 0.2) && result.includes(from)) {
      result = result.replace(from, to);
      break;
    }
  }

  // 2) 切段 + 砍段（破坏三段式工整感）
  let parts = result.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1 && rand(style.chopChance)) {
    if (rand(0.65)) parts.pop();     // 砍掉最后一段（去除机械引导句）
    else parts.splice(Math.floor(parts.length / 2), 1); // 砍中间
  }
  // 强度=heatup 时，额外加一个"多留一段"的保护，让升温话术更有温度
  if (intensity === "heatup" && parts.length >= 2 && rand(0.35)) {
    // 什么都不砍，保持更完整的情感
  }

  // 3) 性格专属标点：撒娇 ~ / 活泼毒舌 ！ / 逗号打断句号
  parts = parts.map(line => {
    let s = line;
    if (rand(style.waveBias)) {
      s = s.replace(/([嘛哦啦呢呗啊哒啦])[\。\.！!？?]?$/g, "$1~");
    }
    if (rand(style.exBias) && !/[!！~]$/.test(s)) {
      if (s.endsWith("。")) s = s.slice(0, -1) + "！";
      else if (rand(0.45)) s = s + "！";
    }
    if (rand(0.15) && (s.match(/。/g) || []).length >= 2) {
      s = s.replace(/。/, "，");
    }
    return s;
  });

  // 3.5) 语义重复词（谢谢谢谢 / 嗯嗯嗯 / 好好好）
  if (rand(style.repeatChance)) {
    const targetIdx = Math.floor(Math.random() * parts.length);
    for (const [from, to] of CHAR_REPEAT) {
      if (parts[targetIdx] && parts[targetIdx].includes(from)) {
        parts[targetIdx] = parts[targetIdx].replace(from, to);
        break;
      }
    }
  }

  // 3.6) 思维停顿前缀（那个… / 哦对了 / 害）—— 冷启动一句
  if (parts.length > 0 && rand(style.pauseChance)) {
    const chosen = pick(PAUSE_STARTERS);
    parts[0] = chosen + parts[0].replace(/^(那个|哦对了|呃|害|其实吧|怎么说呢|嗯~|哎)?[，,、…]?/, "");
  }

  // 4) 语气词插入（随机选一句；如果这句末尾已经有表情字符，就不加后缀语气词；前缀如果原句已有语气词也跳过）
  if (parts.length > 0 && rand(style.particleChance)) {
    const idx = Math.floor(Math.random() * parts.length);
    const orig = parts[idx];
    if (!orig) { /* no-op */ }
    else {
      const lineHasTrailingEmoji = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]$/u.test(orig.trim());
      const startsWithParticle = MOOD_PARTICLES.some(p => orig.startsWith(p) || orig.startsWith("哎呀") || orig.startsWith("嗯嗯") || orig.startsWith("哦哦"));
      const preferPrefix = startsWithParticle ? false : (lineHasTrailingEmoji ? true : rand(0.4));
      const p = pick(MOOD_PARTICLES);
      if (preferPrefix) {
        parts[idx] = p + "，" + orig.replace(/^(诶|嗯|哦|啊|哼|哇|嗨)?[，,]?/, "");
      } else {
        const tail = orig.match(/([。！!？?，,~]+)$/);
        if (tail) {
          parts[idx] = orig.slice(0, -tail[1].length) + p + tail[1];
        } else {
          parts[idx] = orig + p;
        }
      }
    }
  }

  // 5) 拼回字符串（长度多样化：不是永远"几句就几行"）
  if (parts.length === 1) {
    result = parts[0];
  } else if (parts.length === 2) {
    result = parts.join(rand(0.35) ? "\n" : " ");
  } else {
    // 3 段以上：45% 全不换行、25% 只在最后换一次行、30% 全换行
    const r = Math.random();
    if (r < 0.45) result = parts.join(" ");
    else if (r < 0.70) result = parts.slice(0, -1).join(" ") + "\n" + parts[parts.length - 1];
    else result = parts.join("\n");
  }

  // 6) 随机加 1~2 个小 emoji
  if (rand(style.emojiChance)) {
    result += " " + pick(TINY_EMOJI);
    if (rand(style.emojiChance * 0.25)) result += pick(TINY_EMOJI);
  }

  return cleanupPunctuation(result);
}

/* =========================================================
   否定词保护：命中"不/没/别+敏感动词"时，强行降级场景
   ========================================================= */
const NEGATION_GUARD = [
  // ⚠️ 修复 false positive：
  // 之前 /(不|没|别)…{0,3}(喜欢|爱|想)/ 会误中 "睡不[着] 想…" / "不舒服 想你" / "不开心 想你" 这类
  // 修复：① 先判断"长否定短语"（并不是/并没有/假的/才不…）② 短"不/没"必须：否定字符后 0~4 字 直接 跟 情感动词，中间不能有 「着/过/开/用/忙/饿/顺/在/够/对/舒/服/困/累」等日常"不X"字
  {
    blocker: /(不是真的|并没有|并不是|假的|才不|别当真|别以为|当我真|当我傻).{0,6}(喜欢|爱|想你|梦到|惦记|牵挂|喜欢你|爱你|表白|对象|做我(女|男)?朋友|嫁给我|在一起)/,
    then: "comfort",
  },
  {
    blocker: /[^\p{L}](不|没)(?![着过开用忙饿顺在够对舒困累服方便巧安好心])(?=[^\p{L}]{0,4}(喜欢|爱|想你|喜欢你|爱你|梦到|惦记|牵挂|表白|对象|做我朋友|嫁给我|在一起))/u,
    then: "comfort",
  },
  { blocker: /(不|别|别发|不给|没有|不能).{0,3}(照片|图|视频|看看你|露)/, then: "reject" },
];

export function applyNegationGuard(message, proposedScenario) {
  for (const rule of NEGATION_GUARD) {
    if (rule.blocker.test(message)) {
      return rule.then;
    }
  }
  return proposedScenario;
}

/**
 * 从用户消息中提取变量值
 * {user} - 用户名（从消息中提取昵称，或者用默认）
 * {gift} - 礼物名
 * {amount} - 数量
 * {topic} - 话题/地点
 */
export function extractVariables(message) {
  const vars = { ...variables };

  // 提取用户名：匹配常见昵称格式
  const namePatterns = [
    /我叫([^\s,，。.!！?？]{1,8})/,
    /我是([^\s,，。.!！?？]{1,8})/,
    /([^\s,，。.!！?？]{1,10})来了/,
    /@([^\s,，。.!！?？]{1,10})/,
  ];
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      vars["{user}"] = match[1];
      break;
    }
  }

  // 提取礼物名
  const giftMatch = message.match(
    /(送了?|打赏|投喂|礼物)\s*(一个|一份|一些)?\s*([^\s,，。.!！?？]{1,8})/
  );
  if (giftMatch && giftMatch[3]) {
    vars["{gift}"] = giftMatch[3];
  }

  // 提取数量
  const amountMatch = message.match(/(\d+)\s*(个|份|次)/);
  if (amountMatch) {
    vars["{amount}"] = amountMatch[1];
  }

  // 提取地点/话题
  const topicMatch = message.match(
    /(在|来自|我是.*?人).*?([^\s,，。.!！?？]{2,6})/
  );
  if (topicMatch && topicMatch[2]) {
    vars["{topic}"] = topicMatch[2];
  }

  return vars;
}

/**
 * 意图正则：对关键意图做高优先级识别，优先于关键词打分
 * 用于处理"发张照片看看""在吗想你了"这类组合句
 */
const INTENT_RULES = [
  // ⚠️ 告白场景：优先级最高！比拒绝/感谢都高
  // 匹配"我爱你/我喜欢你/做我女朋友/做我对象/我爱死你了/爱你"
  {
    scenario: "confession",
    regex:
      /(我|真的|超级|太|最)(爱|喜欢)你|爱你$|我爱你$|做我(女|男)?朋友|做我对象|做(你|我)(男|女)朋友|表白|当我女朋友|嫁给我|能不能在一起|我想和你在?一起|能不能做我|我要和你在?一起/,
  },
  // 拒绝越界（硬拒绝类：借钱/裸露/脱/开房/约炮/私密照/开价/包养）— 优先级 2，走 reject 场景"硬刚型"话术
  {
    scenario: "reject",
    regex: new RegExp([
      "借(我|点|一下|.{0,4}(万|块|元|钱))",
      "(差|缺|需要|用).{0,5}(点|些|个)?(钱|万|块|元)",
      "周转.{0,12}(钱|万|块|元|不开)",
      "没钱了.{0,12}(给|借|帮|先)",
      "帮.{0,3}(我|咱).{0,3}(钱|块|万)",
      "能借.{0,6}(钱|万|块)",
      "有钱吗",
      "发.{0,4}(红包|钱)",
      "打.{0,4}钱",
      "裸.{1,3}(照|聊|体)",
      "脱.{0,2}(衣服|光)",
      "开房", "陪(我)?一晚", "约.{0,2}(一晚|炮)", "陪(睡|夜)",
      "私.{0,2}密.{0,2}照", "发骚", "视频.{0,2}(裸|聊|脱)",
      "看看.{0,4}(腿|胸|逼|JB|内裤|三点|骚)", "三点式", "内裤",
      "睡你|想睡你",
      "开价|多少钱.{0,6}(一晚|一次|包)|价格|报价",
      "包养|包月.{0,4}(多少钱|价格)|包周",
      "来一发|打一炮",
      "你值.{0,6}钱|出.{0,4}价|面.{0,4}交",
    ].join("|")),
  },
  // 🆕 发照片/视频/露脸（普通大哥委婉型）— 走 send_pic 场景（温柔婉拒），不能和 reject 混
  {
    scenario: "send_pic",
    regex:
      /(发|来|给我|想看|要).{0,5}(张|个|条|几)?(照片|自拍|相片|图片|图|视频)|(拍|录).{0,4}(张|个|段)?(照片|视频|自拍)|露.{0,3}(脸|肩|腰|身材)|看看你长|长什么(样子|样)|给我看看你|(你|本人)的(照片|视频|自拍)|素颜.{0,4}(看看|发|来)/,
  },
  // 🆕 PK拉票（第1场直播核心）
  {
    scenario: "pk_support",
    regex: /打PK|血条|(帮|上|守|偷|压|拉).{0,3}(塔|票|一波|过去)|加成|散票|拉票|PK(赢|输|了)|帮打.{0,6}PK|助力PK/,
  },
  // 🆕 下播感谢（大哥说刚帮下播/下播了）
  {
    scenario: "after_stream",
    regex:
      /(我|你|刚|准备|要|终于|总算).{0,3}(下(播|班)|关播|收工|播(完|结束))了|刚(下播|关播|收工)|下播啦.{0,10}(谢|晚安|想你|吃点啥)|直播(结束|完了)了/,
  },
  // 🆕 生日祝福（必须在 festival 前面，不然被覆盖）
  {
    scenario: "birthday",
    regex:
      /(今天|明天|我|哥|你|他)(.{0,5})生日|生日(快乐|快樂|到|过|愿望|许愿|礼物|蛋糕)|过生日|大寿|周岁(快乐|生日)|(几岁|多大)生日|吹蜡烛|生辰(快乐|生日)/,
  },
  // 🆕 深夜点歌（必须在 late_night/comfort 之前，不然被「失眠」覆盖）
  {
    scenario: "late_night_song",
    regex:
      /(给|帮|来|点|放|唱).{0,4}(我|你|我们|哥|一首|一首.{1,10}歌)?(歌|首歌|首.{1,8}|首听|首你唱)|(点|来|唱|放)一首.{0,20}(歌|听|唱)|想听歌|想听你(声音|唱|唱歌)|点了首|唱什么歌|歌名|点歌/,
  },
  // 感谢打赏：转账/红包/送礼物/上票刷礼（直播核心）
  {
    scenario: "gift_thanks",
    regex:
      /(转|发|打|刷|送|上|投|砸).{0,5}(钱|红包|心意|辛苦费|礼物|礼物|票|嘉年华|火箭|抖音|一号|游艇|跑车|城堡|花海|穿云箭)|(送|打赏|投喂|破费)了?|给你(刷|打赏|转|发)|(收|领)一下|打赏记录|上榜(一|二|三)|榜(一|二|三)/,
  },
  // 暧昧维护：想你/喜欢你/梦到/牵挂 —— 优先于打招呼
  {
    scenario: "ambiguous",
    regex: /(想|喜|爱)你|想你|梦到我|梦到|牵挂|惦记|念念不忘|好想|怎么不理我|在吗.{0,4}(想|喜欢)|想见你/,
  },
  // 节日祝福：xx快乐（⚠️ 注意：生日已从这里移除，走 birthday 场景）
  {
    scenario: "festival",
    regex: /(新年|春节|圣诞|元旦|中秋|国庆|情人节|七夕|跨年|除夕|端午|元宵|节日|周年|纪念日).{0,2}(快乐|好|到了)|新年快樂|新年好/,
  },
  // 哄人安抚：不开心/难过/委屈/生气（⚠️ 注意：失眠/孤独 不在这里，在 late_night）
  {
    scenario: "comfort",
    regex: /(不|好)(开心|高兴|舒服)|难过|心情不好|委屈|想哭|生气|吃醋|闹脾气|你变了|不在乎我|为什么.{0,2}不理我|被(骂|坑|骗|欺负)了.{0,10}(好烦|好难过|气死|不想干)|顶不住.{0,6}(压力|了)/,
  },
  // 回访跟进：好久不见/失联/人呢
  {
    scenario: "follow_up",
    regex: /好久不见|没.{0,2}(动静|消息)|怎么不找|想我了?吗|还记不记得|去哪了|消失|失联|还认识我吗/,
  },
  // 邀约见面：出来/见个面/喝茶
  {
    scenario: "invitation",
    regex: /见.{0,2}面|出来(玩|坐|吃|喝)?|约.{0,2}(饭|茶|咖啡)|什么时候有空|聚聚|碰个面|喝(茶|咖啡)/,
  },
  // 工作生活：加班/项目/老板/业绩
  {
    scenario: "work_life",
    regex: /加班|项目|老板|客户|开会|出差|业绩|赚钱|升职|压力大|工作忙|事业|生意|公司|团队|做生意/,
  },
  // 约饭美食：吃什么/饿了/奶茶
  {
    scenario: "food",
    regex: /吃(什么|了没|了么)|饿(了|不饿)|美食|好吃|奶茶|咖啡|宵夜|外卖|吃货|肚子饿/,
  },
  // 周末安排：周末/假期/放假
  {
    scenario: "weekend",
    regex: /周末|假期|放假|去哪玩|打算|计划|出去(玩|浪)|宅(家|在家)|看电影|逛街|旅游/,
  },
  // 深夜谈心：睡不着/失眠/凌晨（⚠️ 注意：点歌不在这里，走 late_night_song）
  {
    scenario: "late_night",
    regex: /睡不(着|觉)|失眠|凌晨|深夜|一个人|孤独|寂寞|夜深|想聊天|陪我说话|无聊(?!.{0,10}(歌|点歌|唱歌))/,
  },
  // 回答个人问题：年龄/感情/联系方式
  {
    scenario: "personal_qa",
    regex: /(多大了?|几岁|哪里人|单身|有(男朋友|对象)|结婚|身高|体重|做什么的|真名|叫什么|微信|联系方式|手机号)/,
  },
  // 倾听吐槽：倒霉/烦死/气死/不想干
  {
    scenario: "complaint",
    regex: /倒霉|烦死|气死|不公平|被坑|奇葩|倒苦水|不想干|受不了|郁闷|遇到(烂人|奇葩)/,
  },
  // 回应夸奖：好看/漂亮/可爱
  {
    scenario: "compliment",
    regex: /(好|真|太|挺)?(看|漂亮|可爱|帅|迷人|有气质)|声音好听|好听|温柔|棒|优秀|厉害|赞/,
  },
  // 日常关怀：早安/晚安/下班/天气
  {
    scenario: "daily_care",
    regex: /(早|晚)安|起了|睡了|吃(饭|了|了没|了么)|下班|上班|累不累|辛苦|降温|下雨|注意身体|好好休息|天气/,
  },
  // 打招呼开场：在吗/忙吗/能聊聊
  {
    scenario: "greeting",
    regex: /^(在吗|在不在|忙吗|hi|hello|哈喽|嗨|能聊聊|打(个)?招呼|闪一下)/,
  },
];

/**
 * 根据消息内容匹配最合适的场景
 * 1) 先用意图正则做高优先级识别（处理组合句）
 * 2) 再用关键词打分做兜底，得分最高者胜出
 * 3) 都没命中则用 general 通用兜底
 */
export function matchScenario(message) {
  const lowerMsg = message.toLowerCase();

  // 0) 先跑否定词保护，拿到一个"被否定时的锁定场景"。命中任何一条，
  //    后面的正则/打分结果就必须让位于它（解决"我不喜欢你"被当暧昧的问题）
  const lockedByNegation = (() => {
    for (const rule of NEGATION_GUARD) {
      if (rule.blocker.test(message)) return rule.then;
    }
    return null;
  })();
  if (lockedByNegation) return lockedByNegation;

  // 1) 意图正则识别（按声明顺序，前面的优先级更高）
  for (const rule of INTENT_RULES) {
    if (rule.regex.test(message) || rule.regex.test(lowerMsg)) {
      return rule.scenario;
    }
  }

  // 2) 关键词打分兜底
  const scores = {};
  for (const [key, scenario] of Object.entries(scenarios)) {
    if (!scenario.keywords || scenario.keywords.length === 0) {
      scores[key] = 0;
      continue;
    }
    scores[key] = 0;
    for (const keyword of scenario.keywords) {
      if (lowerMsg.includes(keyword.toLowerCase())) {
        scores[key] += keyword.length >= 3 ? 2 : 1;
      }
    }
  }

  // 找出得分最高的场景
  let bestScenario = default_scenario;
  let bestScore = 0;
  for (const [key, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestScenario = key;
    }
  }

  return bestScenario;
}

/**
 * 从数组中随机取一个元素
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 用变量替换模板中的占位符
 */
function fillTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(key).join(value);
  }
  return result;
}

/**
 * 为指定性格生成单条回复（支持手动覆盖场景 & 话术强度）
 */
export function generateOne(message, personalityKey, scenarioOverride = null, intensity = "daily") {
  const detectedScenarioKey = matchScenario(message);
  const scenarioKey = scenarioOverride || detectedScenarioKey;
  const scenario = scenarios[scenarioKey];
  if (!scenario) return null;
  const vars = extractVariables(message);

  const personality = personalities[personalityKey];
  if (!personality) return null;

  const templates = scenario.templates[personalityKey];
  if (!templates || templates.length === 0) return null;

  const template = pickRandom(templates);
  const rawText = fillTemplate(template, vars);
  const text = humanizeText(rawText, personalityKey, intensity);

  return {
    personality: personalityKey,
    label: personality.label,
    emoji: personality.emoji,
    scenarioKey,
    scenario: scenario.label,
    intensity,
    text,
  };
}

/**
 * 为选中的性格批量生成回复
 * @param {string} message
 * @param {string[]} selectedPersonalities
 * @param {string|null} scenarioOverride
 * @param {"warmup"|"daily"|"heatup"} intensity
 */
export function generateReplies(message, selectedPersonalities, scenarioOverride = null, intensity = "daily") {
  if (!message || !message.trim() || selectedPersonalities.length === 0) {
    return [];
  }

  const results = [];
  const MAX_COUNT = 3; // 多选性格最多显示 3 条（用户要求）

  // 单选：直接 1 条（不再补其他）
  if (selectedPersonalities.length === 1) {
    const one = generateOne(message, selectedPersonalities[0], scenarioOverride, intensity);
    if (one) results.push(one);
    return results.slice(0, MAX_COUNT);
  }

  // 选 2 个性格：2 主卡 + 1 混搭卡 = 恰好 3 条
  if (selectedPersonalities.length === 2) {
    for (const personalityKey of selectedPersonalities) {
      const one = generateOne(message, personalityKey, scenarioOverride, intensity);
      if (one) results.push(one);
    }
  }

  // 选 ≥3 个性格：不再重复主卡，改成 1 主卡 + 2 条不同组合混搭
  // （避免回复全是同一套主模板，真正显示出"多选的层次感"）
  if (selectedPersonalities.length >= 3) {
    const firstKey = selectedPersonalities[0];
    const one = generateOne(message, firstKey, scenarioOverride, intensity);
    if (one) results.push(one);
  }

  // 混搭卡组合（最多补足到 MAX_COUNT=3）
  let combos = [];
  if (selectedPersonalities.length === 2) {
    combos.push([selectedPersonalities[0], selectedPersonalities[1]]);
  } else if (selectedPersonalities.length >= 3) {
    // 从选中的性格里，抽 2 组不一样的性格对 做混搭
    combos.push([selectedPersonalities[0], selectedPersonalities[1]]);
    combos.push([selectedPersonalities[0], selectedPersonalities[2]]);
    if (selectedPersonalities[2] !== selectedPersonalities[1] && selectedPersonalities[3]) {
      // 如果用户选了 4+ 个，再加 1 组 主 × 第 4 性格（防重复）
      combos.pop();
      combos.push([selectedPersonalities[0], selectedPersonalities[2]]);
      combos.push([selectedPersonalities[1], selectedPersonalities[3]]);
    }
  }

  const detectedScenarioKey = matchScenario(message);
  const scenarioKey = scenarioOverride || detectedScenarioKey;
  const scenario = scenarios[scenarioKey];
  const vars = extractVariables(message);

  for (const [primaryKey, voiceKey] of combos) {
    if (results.length >= MAX_COUNT) break;
    const templates = scenario?.templates?.[primaryKey];
    const p1 = personalities[primaryKey];
    const p2 = personalities[voiceKey];
    if (templates && templates.length > 0 && p1 && p2 && primaryKey !== voiceKey) {
      const rawText = fillTemplate(pickRandom(templates), vars);
      const text = humanizeText(rawText, voiceKey, intensity);
      results.push({
        personality: `${primaryKey}+${voiceKey}`,
        label: `${p1.label}·${p2.label}混搭`,
        emoji: `${p1.emoji}${p2.emoji}`,
        scenarioKey,
        scenario: scenario.label,
        intensity,
        text,
        isBlend: true,
      });
    }
  }

  return results.slice(0, MAX_COUNT);
}

/** 话术统计（给 footer 用） */
export function getStats() {
  let totalTemplates = 0;
  const scenarioKeys = Object.keys(scenarios);
  for (const sk of scenarioKeys) {
    const tpl = scenarios[sk].templates;
    for (const pk of Object.keys(tpl)) {
      totalTemplates += Array.isArray(tpl[pk]) ? tpl[pk].length : 0;
    }
  }
  return {
    scenarios: scenarioKeys.length,
    personalities: Object.keys(personalities).length,
    templates: totalTemplates,
  };
}

/** 场景列表给 UI 下拉用 */
export function getScenarioList() {
  return Object.entries(scenarios).map(([key, val]) => ({
    key,
    label: val.label,
  }));
}

export { personalities, scenarios };

/* ======================================================================
   🔥 1v1 大哥原话专属引擎（主播真正用的"把大哥粘进来→出8张卡"）
   - analyzeBrotherQuote(message, opts)：深度识别，返回 场景/意图/情绪/称呼/越界/建议
   - generateOnePerPersonality(message, opts)：一次返回 8 个性格各 1 条 1v1 专属回复
   - 支持称呼替换：opts.brotherName / opts.address（哥/宝/老板/X哥/...）
   - 支持主播名/昵称：opts.hostName
   ====================================================================== */

// 📌 称呼识别（从大哥原话的"自称/对主播称呼"里抓，反推我们该怎么回称呼）
//    ⚠️ 必须是"大哥视角"的语境：前面不能有 被/跟/和/找/骂/见/找老板 这类
const ADDRESS_PATTERNS = [
  // 大哥自称（我是/我叫/你叫我/以后叫我 + 称呼）
  { re: /(^|[^\p{L}])我(是|叫|们?就|以后就?)[^。!\s]{0,6}(哥|老板|总|爷|弟|兄弟|哥哥)/u, suggest_override: true },
  // 大哥对主播的称呼 → 反过来推断我们怎么叫他
  { re: /(?<![被跟和找骂见怼换跟])(?<![不把给对])妹妹|(?<![被跟和找骂见怼换跟])小妹|小([^\s,，。!！?？]{1,4})妹/, suggest: "哥" },
  { re: /(?<![被跟和找骂见怼换跟])(?<![不把给对])美女|小姐姐|仙女|妞/, suggest: "哥" },
  { re: /老婆|媳妇儿|媳妇|宝贝|宝宝|小宝/, suggest: "宝~", tone: "warm" },
  {
    // 老板/总：排除"被老板/跟老板/找老板/公司老板"这类词前面的动词语境
    re: /(^|[^\p{L}不把给对被跟和找骂见怼换跟公司])(老板|总|([^\s,，。!！?？]{1,4})总)(?=$|[^\p{L}总])/u,
    suggest: "老板",
  },
  { re: /(?<![被跟和找骂见怼换跟])(?<![不把给对])姐|姐姐/, suggest: "哥" },
  { re: /亲爱的|honey|darling|乖乖/, suggest: "亲爱的~", tone: "warm" },
];

// 📌 情绪/温度识别：0=冷,1=平,2=热,3=越界, -1=负情绪（抱怨/生气/难过）
const TONE_RULES = [
  { level: 3, tags: ["越界直白"], re: /开房|裸|脱|炮|骚|色|洗澡|床上|陪睡|陪夜|内裤|三点|奶|逼|jb|做爱|性交/ },
  { level: 2, tags: ["热情", "想进一步"], re: /爱你|喜欢你|想你|宝贝|宝宝|亲爱的|梦到你|想抱着|亲|抱|么么|啵|约会|见面/ },
  { level: -1, tags: ["生气", "抱怨"], re: /你变了|不理我|不重视|失望|骗我|忽悠|糊弄|套路|假|虚伪|伤心|寒心/ },
  { level: -2, tags: ["难过", "低落"], re: /难过|想哭|孤独|撑不住|要疯了|崩溃|绝望|无助|失眠|抑郁/ },
  { level: 1, tags: ["日常", "普通关心"], re: /在吗|吃了|早安|晚安|天气|累不累|辛苦|下班|上班|起了吗/ },
];

// 📌 56+ 关键词权重打分（原话专属引擎兜底，比通用打分更精准）
const QUOTE_WEIGHTS = [
  // 直播业务类（权重高，主播核心场景）
  { scenario: "pk_support", weight: 5, words: ["PK","打PK","pk","血条","上票","守塔","偷塔","加成","散票","拉票","压过去","秒了","助力"] },
  { scenario: "gift_thanks", weight: 5, words: ["给你刷了","刷了多少","刷礼物","送你","打赏","投喂","发了个红包","给你转","破费了","心意收到没","上了多少票","上榜一","榜一","榜二"] },
  { scenario: "after_stream", weight: 5, words: ["下播了","下播啦","刚下播","关播了","播完了","收工","直播结束","今天播了多久","下播吃什么","下播晚安"] },
  { scenario: "late_night_song", weight: 5, words: ["点歌","唱首歌","给我唱","唱歌","想听你唱","点了首","来一首","点一首","唱什么","歌名","你唱得好听"] },
  { scenario: "send_pic", weight: 5, words: ["照片","视频","露脸","自拍","看看你","长什么样","发张","发个照片","素颜","拍个视频","拍张照"] },
  { scenario: "birthday", weight: 5, words: ["生日","过生日","生日快乐","大寿","蛋糕","许愿","吹蜡烛","几岁","周岁","生辰"] },
  { scenario: "confession", weight: 6, words: ["我爱你","我喜欢你","做我女朋友","做我对象","表白","嫁给我","在一起","想追你","追你","你单身吗","我想你做我"] },
  { scenario: "reject", weight: 7, words: ["借钱","借我钱","能借点","需要钱","周转","借个","发照片","裸聊","脱","开房","约炮","陪我一晚","私照","看看腿","看看胸","骚"] },
  { scenario: "ambiguous", weight: 3, words: ["想你","梦到","牵挂","惦记","喜欢你","想抱抱","想亲亲","好想","怎么不理我","在吗想你","想见你","想视频","想语音"] },
  { scenario: "invitation", weight: 4, words: ["见个面","见面","出来玩","约饭","喝茶","咖啡","什么时候有空","有空出来","一起吃个饭","坐坐","喝一杯","聚聚"] },
  { scenario: "comfort", weight: 4, words: ["不开心","难过","委屈","生气","吃醋","想哭","心情不好","郁闷","压力大","顶不住","难受","想哭了","被欺负了"] },
  { scenario: "complaint", weight: 4, words: ["倒霉","烦死","气死","被坑","奇葩","受不了","不想干","郁闷","苦水","不公平","操蛋","狗日","SB","傻逼","垃圾"] },
  { scenario: "follow_up", weight: 4, words: ["好久不见","去哪了","消失了","没消息","怎么不说话","还认识我吗","想我了吗","多久没来了","最近咋样"] },
  { scenario: "daily_care", weight: 2, words: ["早安","晚安","吃了吗","吃了没","下班","上班","累不累","辛苦","吃饭了吗","早饭","午饭","晚饭","吃点好的","别饿","注意身体"] },
  { scenario: "festival", weight: 4, words: ["新年快乐","春节","圣诞","元旦","中秋","国庆","情人节","七夕","跨年","除夕","端午","元宵","节日快乐","祝福"] },
  { scenario: "compliment", weight: 3, words: ["好看","漂亮","可爱","声音好听","唱歌好听","你真美","身材好","有气质","耐看","笑起来好看","你好瘦","眼睛好看"] },
  { scenario: "personal_qa", weight: 4, words: ["多大了","几岁","哪里人","有对象吗","单身吗","结婚了吗","身高","多少斤","真名","叫什么","微信多少","联系方式","电话","有男朋友吗"] },
  { scenario: "work_life", weight: 3, words: ["加班","老板","客户","开会","出差","业绩","项目","公司","升职","赚钱","生意","亏损","失业","换工作","面试","压力"] },
  { scenario: "food", weight: 2, words: ["吃什么","饿了","奶茶","好吃","美食","咖啡","宵夜","外卖","吃货","吃了啥","推荐吃","火锅","烧烤","麻辣烫"] },
  { scenario: "weekend", weight: 2, words: ["周末","放假","假期","去哪玩","出去玩","宅家","看电影","逛街","旅游","计划","打算","周日","周六","五一","国庆假"] },
  { scenario: "late_night", weight: 3, words: ["睡不着","失眠","凌晨","深夜","一个人","孤独","寂寞","无聊","想聊天","陪我说话","还没睡","你睡了吗"] },
  { scenario: "greeting", weight: 1, words: ["在吗","在不在","忙吗","哈喽","嗨","hi","hello","闪一下","打招呼","能聊聊么","你好"] },
];

/**
 * 🧠 深度分析大哥原话（1v1 引擎的核心）
 * @param {string} message 大哥原话
 * @param {{brotherName?:string, address?:string, hostName?:string}} opts
 * @returns {{
 *   scenarioKey: string,
 *   scenarioLabel: string,
 *   toneLevel: number,
 *   toneTags: string[],
 *   suggestAddress: string,   // 建议主播怎么称呼对方
 *   suggestIntensity: string, // warmup/daily/heatup
 *   crossLine: boolean,       // 是否越界（借钱/索要私照/约炮等）
 *   crossLineType: string,    // 越界分类
 *   brotherType: string,      // 大哥画像：沉默榜一型 / 热情聊骚型 / 越界试探型 / 日常打卡型 / 失意求安慰型 / 维护型
 *   customVars: Record<string,string>,
 *   matchedWords: string[],
 *   replyHints: string[],     // 给主播的小贴士
 * }}
 */
export function analyzeBrotherQuote(message, opts = {}) {
  const msg = message || "";

  // 1) 先走高优先级的正则识别（复用通用引擎，更稳）
  const scenarioKey = matchScenario(msg);
  const scenarioLabel = scenarios[scenarioKey]?.label || scenarios[default_scenario].label;

  // 2) 情绪/越界判定（按顺序跑，最大绝对值优先）
  let toneLevel = 0;
  let toneTags = [];
  for (const rule of TONE_RULES) {
    if (rule.re.test(msg)) {
      toneLevel = rule.level;
      toneTags = [...rule.tags];
      break;
    }
  }

  // 3) 越界二次识别：分类
  let crossLine = false;
  let crossLineType = "";
  if (/借(我|点)?钱|周转|差.{0,4}钱|需要.{0,4}万|需要.{0,4}块|没钱了.{0,10}(给|借|帮)|能借.{0,6}(钱|万|块)|有钱吗|发.{0,4}(红包|钱)|打.{0,4}钱/.test(msg)) {
    crossLine = true; crossLineType = "借钱要钱";
  } else if (/发.{0,4}(照片|视频|自拍|素颜|胸|腿)|露.{0,3}(脸|肩|腰|胸|腿)|裸|脱|三点|内裤|私(照|密)|看看(你|身材|腿)|视频裸|裸聊/.test(msg)) {
    crossLine = true; crossLineType = "索要私照/视频";
  } else if (/开房|约炮|陪睡|陪夜|一晚上|过夜|床上|做爱|性交|睡你|想睡你|睡一晚|来一发|打一炮/.test(msg)) {
    crossLine = true; crossLineType = "明确约炮/涉黄";
  } else if (/开价|多少钱|价格|报价|包养|包月|包周|一次.{0,4}多少钱|一晚.{0,4}多少|你值.{0,6}钱|出.{0,4}价|面.{0,4}交/.test(msg)) {
    crossLine = true; crossLineType = "涉黄交易(开价类)";
  } else if ((/加.{0,3}微信|留.{0,4}联系|手机号|电话/.test(msg)) && (/见面|出来玩|约|私下|出去|吃饭|喝.{0,2}一杯/.test(msg) || /开价|多少钱|包养/.test(msg))) {
    crossLine = true; crossLineType = "急着加私人联系方式(线下邀约)";
  } else if (/((地址|位置|在哪住|住哪|你家|公司地址|工作地|学校|具体位置).{0,20}(哪|？|\?))|((在哪|地址|位置)发我|给我.{0,4}(地址|位置))/.test(msg)) {
    crossLine = true; crossLineType = "打探地址/个人隐私";
  }

  // ⚠️ 越界场景强制覆盖场景key为 reject（借钱/约炮/开价）或 send_pic（要照片）
  // 这样确保 1v1 模式一定命中越界专用模板，而不是通用模板
  let finalScenarioKey = scenarioKey;
  if (crossLine) {
    if (crossLineType === "索要私照/视频") {
      finalScenarioKey = "send_pic";
    } else {
      finalScenarioKey = "reject";
    }
  }

  // 4) 称呼建议
  let suggestAddress = opts.address || "哥";
  let overrideDone = false;
  for (const p of ADDRESS_PATTERNS) {
    if (p.re.test(msg)) {
      if (p.suggest_override) {
        // 大哥自称：抓他后面的称呼词（哥/老板/总）做 主播的回应称呼（一般还是"哥"，只有说「我是X总/我是老板」才叫对应）
        const m = msg.match(p.re);
        const suffix = m && (m[3] || m[4] || m[0].slice(-2));
        if (/老板|总/.test(suffix || "")) suggestAddress = suffix?.includes("老板") ? "老板" : (suffix + "总").replace(/总总$/, "总");
        else suggestAddress = "哥";
        overrideDone = true;
      } else if (!overrideDone) {
        suggestAddress = p.suggest;
      }
      if (p.tone === "warm" && toneLevel < 2) toneLevel = 2;
      break;
    }
  }
  // 如果大哥原话里带了更具体的："王哥""李哥""我是张总"就抓一下
  const nameHint = msg.match(/我是([^\s,，。!！?？]{1,6})/);
  if (nameHint && !opts.brotherName) opts = { ...opts, brotherName: nameHint[1] };

  // 5) 建议话术强度 —— 越界必须 warmup，其他按情绪判断
  let suggestIntensity = "daily";
  if (crossLine) {
    suggestIntensity = "warmup";
  } else if (toneLevel >= 2) {
    suggestIntensity = "heatup";
  } else if (toneLevel < 0) {
    suggestIntensity = "warmup";
  }
  if (opts.intensity) suggestIntensity = opts.intensity;

  // 6) 关键词打分兜底 → 大哥画像分类 & 命中词
  const score = {};
  const matchedWords = [];
  for (const w of QUOTE_WEIGHTS) {
    let s = 0;
    for (const word of w.words) {
      if (msg.includes(word)) {
        s += w.weight * (word.length >= 3 ? 1.2 : 1);
        matchedWords.push(word);
      }
    }
    if (s) score[w.scenario] = (score[w.scenario] || 0) + s;
  }

  // 7) 大哥画像（6 类）
  let brotherType = "日常打卡型";
  if (crossLine) brotherType = "越界试探型";
  else if (toneLevel >= 2 || scenarioKey === "confession" || scenarioKey === "ambiguous") brotherType = "热情聊骚型";
  else if (toneLevel <= -1 || scenarioKey === "comfort" || scenarioKey === "complaint") brotherType = "失意求安慰型";
  else if (scenarioKey === "gift_thanks" || scenarioKey === "pk_support" || scenarioKey === "after_stream") brotherType = "刷量维护型";
  else if (msg.length <= 8 && (msg.includes("在吗") || msg.includes("早") || msg.includes("晚安"))) brotherType = "沉默榜一型";
  else if (scenarioKey === "follow_up" || scenarioKey === "daily_care") brotherType = "维护回访型";

  // 8) 变量（模板 {user} 替换成建议称呼，{brotherName} 是大名）
  const customVars = {
    ...variables,
    "{user}": suggestAddress,
    "{brother}": opts.brotherName || suggestAddress,
    "{host}": opts.hostName || "我",
    "{address}": suggestAddress,
  };

  // 9) 小贴士（主播操作建议）
  const replyHints = [];
  if (crossLine) {
    replyHints.push(`⚠️ 越界类型：${crossLineType}—— 优先用「温柔一刀/成熟直给/毒舌封死」3 张卡，不要用甜/撒娇/活泼，避免被误解为"有机会"`);
    replyHints.push("话术强度自动降到 warmup（保守距离档），避免推拉过火");
  }
  if (brotherType === "刷量维护型") {
    replyHints.push(`🎁 这类大哥吃"情绪价值"：回复里必须出现「记在心里」「你别太累」「身体第一」3 句中的至少 1 句`);
    replyHints.push("优先选 温柔/成熟/甜系 3 张，毒舌慎用");
  }
  if (brotherType === "热情聊骚型") {
    replyHints.push(`🔥 对方在"升温"——你可以 heatup 档，但必须留「但」字门：不给明确承诺，不接「老婆」称呼`);
    replyHints.push("推荐搭配：温柔卡（稳）+ 甜系卡（拉情绪）+ 傲娇卡（推拉）");
  }
  if (brotherType === "失意求安慰型") {
    replyHints.push(`🫂 先「接情绪」，再「说理解」，最后「给台阶」——不要一上来加油打气，越说越烦`);
    replyHints.push("推荐：温柔（主力）+ 成熟（靠谱）+ 幽默（破局）");
  }
  if (brotherType === "越界试探型") {
    replyHints.push("🚫 三不原则：不接话、不解释、不讨好—— 一次亮底，以后再敢提你就有底气冷他");
    replyHints.push("推荐：sharp 毒舌（必须有一张立规矩） + mature 成熟（讲原则）+ gentle 温柔（给台阶下）");
  }
  if (finalScenarioKey === "gift_thanks") replyHints.push("✅ 感谢 3 段式公式：①先心疼 ②再感谢 ③最后关心身体 = 下次他还刷");
  if (finalScenarioKey === "confession") replyHints.push(`✅ 告白 回复公式：先给情绪价值 + 再委婉拉距离 + 最后给一个「朋友级」的替代身份`);
  if (finalScenarioKey === "reject") replyHints.push(`✅ 拒绝公式：不指责 + 说原则 + 给一个「我不是针对你」的台阶`);
  if (finalScenarioKey === "send_pic") replyHints.push("✅ 婉拒私照模板：我不喜欢在私底下发 → 但你可以直播间看我呀 → 直播间给你专属镜头");
  if (replyHints.length === 0) replyHints.push("💡 常规场景：先用 1 条日常强度 + 1 条升温档 对比发送，观察大哥回复速度决定下一步");

  return {
    scenarioKey: finalScenarioKey,
    scenarioLabel: scenarios[finalScenarioKey]?.label || scenarioLabel,
    toneLevel,
    toneTags,
    suggestAddress,
    suggestIntensity,
    crossLine,
    crossLineType,
    brotherType,
    customVars,
    matchedWords: Array.from(new Set(matchedWords)).slice(0, 12),
    replyHints,
  };
}

/**
 * 💬 1v1 引擎：给大哥原话 → 8 个性格各 1 条专属卡（一次8张）
 * 核心改进：
 *  - 用原话分析结果替换 {user} 等变量（比如大哥让你叫他"老板"就自动换）
 *  - 越界场景时：5 个"非安全"性格自动降级为 warmup + 距离化润色
 *  - 返回结构和 generateReplies 兼容，可以直接复用 UI 渲染
 * @returns {Array<{personality, label, emoji, scenarioKey, scenario, intensity, text, isCrossLineSafe: boolean}>}
 */
export function generateOnePerPersonality(message, opts = {}) {
  if (!message || !message.trim()) return [];

  const analysis = analyzeBrotherQuote(message, opts);
  const scenarioKey = analysis.scenarioKey;
  const scenario = scenarios[scenarioKey];
  const intensity = analysis.suggestIntensity;
  const vars = analysis.customVars;

  // 映射 crossLineType → _crossLineSpecific 中的 key
  const crossLineKeyMap = {
    "借钱要钱": "借钱要钱",
    "索要私照/视频": "索要私照",
    "明确约炮/涉黄": "睡你类",
    "涉黄交易(开价类)": "开价交易",
    "急着加私人联系方式(线下邀约)": "打探隐私",
    "打探地址/个人隐私": "打探隐私",
  };
  const crossLineSpecificKey = analysis.crossLine ? crossLineKeyMap[analysis.crossLineType] : null;

  const results = [];
  const personalityKeys = Object.keys(personalities);

  for (const pk of personalityKeys) {
    const p = personalities[pk];
    if (!p) continue;

    // 优先使用 crossLine-specific 模板（如果可用）
    let templates = null;
    if (analysis.crossLine && crossLineSpecificKey && scriptData._crossLineSpecific) {
      const crossLineTemplates = scriptData._crossLineSpecific[pk];
      if (crossLineTemplates && crossLineTemplates[crossLineSpecificKey]) {
        templates = crossLineTemplates[crossLineSpecificKey];
      }
    }
    // 回退到场景通用模板
    if (!templates || templates.length === 0) {
      templates = scenario.templates[pk];
    }
    if (!templates || templates.length === 0) continue;

    // 按原话变量挑最合适的模板
    let bestTpl = templates[0];
    if (templates.length > 1) {
      const withUser = templates.filter(t => t.includes("{user}"));
      if (withUser.length > 0) {
        bestTpl = pickRandom(withUser);
      } else {
        const nat = templates.filter(t => t.length >= 40 && t.length <= 160);
        bestTpl = pickRandom(nat.length ? nat : templates);
      }
    }

    let rawText = fillTemplate(bestTpl, vars);

    // 越界时的安全处理
    let safeIntensity = intensity;
    if (analysis.crossLine) {
      if (["sweet","coquettish","lively"].includes(pk)) {
        safeIntensity = "warmup";
        rawText = `${vars["{user}"]} 我先说好哦 我这个人挺有原则的 你别吓我~ ${rawText}`;
      }
    }

    // 大哥画像微调
    if (analysis.brotherType === "刷量维护型" && ["gentle","mature","sweet"].includes(pk)) {
      if (!rawText.includes("记着") && !rawText.includes("记性")) {
        rawText = rawText.replace(/。(\s*)$/, "。 你对我好 我记性好 都记着。");
      }
    }
    if (analysis.brotherType === "失意求安慰型") {
      if (!rawText.includes("听着") && !rawText.includes("我懂")) {
        rawText = `${vars["{user}"]} 我听着呢 你说。${rawText}`;
      }
    }

    const text = humanizeText(rawText, pk, safeIntensity);
    results.push({
      personality: pk,
      label: p.label,
      emoji: p.emoji,
      scenarioKey,
      scenario: scenario.label,
      intensity: safeIntensity,
      text,
      isCrossLineSafe: !analysis.crossLine || ["gentle","mature","sharp"].includes(pk),
    });
  }

  results._analysis = analysis;
  return results;
}

/**
 * 📤 大哥档案 → 导出分享文本（主播复制给闺蜜/团队存档用）
 */
export function exportBrotherRecord(record) {
  const lines = [];
  lines.push(`【大哥原话】${record.brotherMessage || ""}`);
  if (record.nickname) lines.push(`【大哥称呼/备注】${record.nickname}`);
  if (record.analysis) {
    const a = record.analysis;
    lines.push(`【识别场景】${a.scenarioLabel}（${a.scenarioKey}） · 画像：${a.brotherType}`);
    if (a.crossLine) lines.push(`【⚠️ 越界】${a.crossLineType}`);
    lines.push(`【建议强度】${a.suggestIntensity} · 建议称呼：${a.suggestAddress}`);
    if (a.matchedWords.length) lines.push(`【关键词命中】${a.matchedWords.join("、")}`);
  }
  lines.push("");
  (record.replies || []).forEach((r, i) => {
    lines.push(`『${r.emoji} ${r.label}${r.intensity === "heatup" ? "·升温" : r.intensity === "warmup" ? "·保守" : ""}』`);
    lines.push(r.text);
    lines.push("");
  });
  return lines.join("\n").trim();
}

