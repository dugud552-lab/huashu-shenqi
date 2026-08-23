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
  gentle:     { emojiChance: 0.30, particleChance: 0.45, chopChance: 0.35, typosChance: 0.10, exBias: 0.10, waveBias: 0.15, repeatChance: 0.15, pauseChance: 0.08, ultraShortChance: 0.08 },
  tsundere:   { emojiChance: 0.10, particleChance: 0.20, chopChance: 0.55, typosChance: 0.02, exBias: 0.55, waveBias: 0.00, repeatChance: 0.03, pauseChance: 0.15, ultraShortChance: 0.22 },
  lively:     { emojiChance: 0.60, particleChance: 0.55, chopChance: 0.20, typosChance: 0.15, exBias: 0.70, waveBias: 0.10, repeatChance: 0.35, pauseChance: 0.05, ultraShortChance: 0.05 },
  coquettish: { emojiChance: 0.55, particleChance: 0.70, chopChance: 0.25, typosChance: 0.05, exBias: 0.10, waveBias: 0.90, repeatChance: 0.28, pauseChance: 0.04, ultraShortChance: 0.04 },
  humorous:   { emojiChance: 0.45, particleChance: 0.40, chopChance: 0.40, typosChance: 0.12, exBias: 0.40, waveBias: 0.05, repeatChance: 0.22, pauseChance: 0.25, ultraShortChance: 0.18 },
  mature:     { emojiChance: 0.08, particleChance: 0.15, chopChance: 0.60, typosChance: 0.01, exBias: 0.00, waveBias: 0.00, repeatChance: 0.02, pauseChance: 0.20, ultraShortChance: 0.12 },
  sharp:      { emojiChance: 0.05, particleChance: 0.10, chopChance: 0.65, typosChance: 0.01, exBias: 0.80, waveBias: 0.00, repeatChance: 0.02, pauseChance: 0.18, ultraShortChance: 0.30 },
  sweet:      { emojiChance: 0.72, particleChance: 0.78, chopChance: 0.12, typosChance: 0.06, exBias: 0.20, waveBias: 0.78, repeatChance: 0.30, pauseChance: 0.03, ultraShortChance: 0.03 },
};

/* 强度档位对参数的乘数：warmup 收敛、daily 中性、heatup 放大 */
const INTENSITY_MULT = {
  warmup:  { emoji: 0.55, particle: 0.70, chop: 1.15, typos: 0.70, ex: 0.70, wave: 0.55, repeat: 0.40, pause: 1.10, ultraShort: 1.20 },
  daily:   { emoji: 1.00, particle: 1.00, chop: 1.00, typos: 1.00, ex: 1.00, wave: 1.00, repeat: 1.00, pause: 1.00, ultraShort: 1.00 },
  heatup:  { emoji: 1.35, particle: 1.25, chop: 0.75, typos: 1.20, ex: 1.30, wave: 1.35, repeat: 1.60, pause: 0.80, ultraShort: 0.60 },
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
  { blocker: /(不|没|别|才不|并没有|并不是|不是真的|假的).{0,3}(喜欢|爱|想|梦到|惦记|牵挂|喜欢你|爱你|想你)/, then: "comfort" },
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
  // 拒绝越界：索要照片/视频/裸露/借钱/约炮 —— 最高优先级
  {
    scenario: "reject",
    regex:
      /发.{0,3}(照片|图|照片)|看.{0,3}(脸|身体|照片|素颜|腿)|露.{0,2}(脸|身体)|裸|脱.{0,2}(衣服|光)|开房|陪我一晚|约.{0,2}(一晚|炮)|借.{0,2}钱|私.{0,2}密.{0,2}照|发骚|看看你|视频.{0,2}(聊|裸)/,
  },
  // 感谢打赏：转账/红包/送礼物
  {
    scenario: "gift_thanks",
    regex: /(转|发|打)了.{0,4}(钱|红包|心意|辛苦费|礼物|心意)|(送|打赏|投喂)了?|给你转|发你了|收一下|破费/,
  },
  // 暧昧维护：想你/喜欢你/梦到/牵挂 —— 优先于打招呼
  {
    scenario: "ambiguous",
    regex: /(想|喜|爱)你|想你|梦到我|梦到|牵挂|惦记|念念不忘|好想|怎么不理我|在吗.{0,4}(想|喜欢)|想见你/,
  },
  // 节日祝福：xx快乐
  {
    scenario: "festival",
    regex: /(新年|春节|圣诞|元旦|中秋|国庆|生日|情人节|七夕|跨年|除夕|端午|元宵|节日).{0,2}(快乐|好|到了)|生日快乐/,
  },
  // 哄人安抚：不开心/难过/委屈/生气
  {
    scenario: "comfort",
    regex: /(不|好)(开心|高兴|舒服)|难过|心情不好|委屈|想哭|生气|吃醋|闹脾气|你变了|不在乎我|为什么.{0,2}不理我/,
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
  // 深夜谈心：睡不着/失眠/凌晨
  {
    scenario: "late_night",
    regex: /睡不(着|觉)|失眠|凌晨|深夜|一个人|孤独|寂寞|夜深|想聊天|陪我说话|无聊.*?睡不着/,
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
  const primaries = selectedPersonalities.length >= 3
    ? [selectedPersonalities[0], selectedPersonalities[1]]
    : selectedPersonalities;

  for (const personalityKey of primaries) {
    const one = generateOne(message, personalityKey, scenarioOverride, intensity);
    if (one) results.push(one);
  }

  // 多选性格混搭卡
  if (selectedPersonalities.length >= 2) {
    const primaryKey = selectedPersonalities[0];
    const voiceKey = selectedPersonalities[1];
    const detectedScenarioKey = matchScenario(message);
    const scenarioKey = scenarioOverride || detectedScenarioKey;
    const scenario = scenarios[scenarioKey];
    const vars = extractVariables(message);
    const templates = scenario?.templates?.[primaryKey];
    const p1 = personalities[primaryKey];
    const p2 = personalities[voiceKey];
    if (templates && templates.length > 0 && p1 && p2) {
      const rawText = fillTemplate(pickRandom(templates), vars);
      // 混搭：主模板 + 副性格语气 + 档位强度
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

  return results;
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
