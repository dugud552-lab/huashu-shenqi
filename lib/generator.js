import scriptData from "../data/scripts.json";

const { scenarios, personalities, default_scenario, variables } = scriptData;

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
 * 为指定性格生成回复
 * @param {string} message - 用户消息
 * @param {string[]} selectedPersonalities - 选中的性格key数组
 * @returns {Array} - 回复结果数组 [{personality, label, emoji, scenario, text}]
 */
export function generateReplies(message, selectedPersonalities) {
  if (!message || !message.trim() || selectedPersonalities.length === 0) {
    return [];
  }

  const scenarioKey = matchScenario(message);
  const scenario = scenarios[scenarioKey];
  const vars = extractVariables(message);

  const results = [];
  for (const personalityKey of selectedPersonalities) {
    const personality = personalities[personalityKey];
    if (!personality) continue;

    const templates = scenario.templates[personalityKey];
    if (!templates || templates.length === 0) continue;

    const template = pickRandom(templates);
    const text = fillTemplate(template, vars);

    results.push({
      personality: personalityKey,
      label: personality.label,
      emoji: personality.emoji,
      scenario: scenario.label,
      text,
    });
  }

  return results;
}

export { personalities, scenarios };
