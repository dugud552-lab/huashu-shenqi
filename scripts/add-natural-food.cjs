/* eslint-disable */
/**
 * 给 food 场景添加更自然的口语化模板
 * 解决问题：回复太模板化，缺少"怎么回事没吃饭吗"这种自然对话
 */
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data", "scripts.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// food 场景：按性格添加自然回复
const naturalFoodTemplates = {
  gentle: [
    "怎么回事早上没吃饭吗",
    "快去吃点东西吧 别饿着了",
    "哥你这是多久没吃饭了呀",
    "饿了就赶紧去吃 别硬扛着",
    "看你饿的 快去弄点吃的去",
    "别饿着肚子 赶紧吃饭去",
    "你这是饿了多久了 赶紧去吃点",
    "不行不行 必须吃饭 饿坏了怎么办",
    "快去吃点 等你吃完再聊",
    "饿肚子可不行 赶紧吃饭",
    "怎么饿成这样了 快去吃点好的",
    "别跟自己的胃过不去 赶紧吃饭",
  ],
  tsundere: [
    "哼 饿了就去吃 别跟我说",
    "自己不会去吃饭吗 还问我",
    "饿肚子关我什么事 快去吃",
    "行吧 赶紧去吃饭 别饿着",
    "切 饿了就吃 别老问我",
    "谁管你饿不饿 快去吃饭",
    "别在这喊饿 自己去弄吃的",
    "哼 快去吃饭 别让我等",
  ],
  lively: [
    "啊！！你没吃饭吗！！快去吃！！",
    "哎呀哥！！饿死我了！！快去吃饭！！",
    "快快快！！去吃饭！！别饿着！！",
    "你这是要饿晕过去吗！！快去吃！！",
    "妈呀 赶紧去吃点东西啊！！",
    "饿成这样可不行！！快去吃饭！！",
    "走走走！！去吃饭！！我也要吃！！",
    "哈哈哈 你也饿了吗 快去吃！！",
    "冲冲冲！！吃饭去！！",
  ],
  coquettish: [
    "哥~ 你没吃饭吗 人家心疼你呀",
    "饿了就去吃嘛 别让人家担心",
    "哥~ 快去吃饭好不好 人家等你",
    "别饿着嘛 人家会心疼的",
    "哥~ 吃饭饭哦 人家看着你",
    "饿肚子对身体不好 快去吃点嘛",
    "哥~ 你吃饭了吗 人家想知道",
    "别让人家担心嘛 快去吃饭",
  ],
  humorous: [
    "怎么回事 早上没吃饭吗 胃在抗议了",
    "快去吃饭吧 不然我要替你的胃打抱不平了",
    "你这是跟胃有仇吗 赶紧吃饭",
    "我替你的胃谢谢你 它快饿扁了",
    "赶紧去吃饭 不然明天我要笑你饿晕",
    "饿肚子还不吃饭 你是想成仙吗",
    "快去吧 你的胃在跟我告状呢",
    "再不吃饭 我都要替你饿了",
  ],
  mature: [
    "怎么回事 早上没吃饭吗",
    "快去吃点东西吧 别饿着了",
    "哥你这是多久没吃饭了",
    "饿了就赶紧去吃 别硬扛",
    "不行 必须吃饭 身体重要",
    "快去吃点好的 别委屈自己",
    "别跟自己身体过不去 吃饭",
    "你这是饿了多久了 赶紧解决",
  ],
  sharp: [
    "饿了就吃 别啰嗦",
    "快去吃饭 别在这喊",
    "自己去弄吃的 别找我",
    "行不行 吃饭去",
    "别磨叽 赶紧吃饭",
    "吃个饭还要人教吗",
    "不行 必须吃饭 没得商量",
    "别逼我催第二遍 吃饭去",
  ],
  sweet: [
    "宝~ 你没吃饭吗 人家好心疼",
    "饿了就去吃嘛 人家陪你",
    "宝~ 快去吃饭好不好",
    "别饿着人家的宝贝 快去吃",
    "哥~ 吃饭饭哦 人家等你",
    "饿肚子对身体不好 人家担心",
    "宝~ 你吃饭了吗 人家想知道",
    "别让人家担心嘛 快去吃饭",
  ],
};

const food = data.scenarios.food.templates;
let added = 0;

for (const [pk, templates] of Object.entries(naturalFoodTemplates)) {
  if (!food[pk]) continue;
  const usedSet = new Set(food[pk]);
  for (const tpl of templates) {
    if (!usedSet.has(tpl)) {
      food[pk].push(tpl);
      usedSet.add(tpl);
      added++;
    }
  }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf8");

// 统计
let total = 0;
for (const pk of Object.keys(food)) {
  total += food[pk].length;
}

console.log(`food 场景新增 ${added} 条自然回复`);
console.log(`food 场景总计 ${total} 条`);
console.log("示例:");
naturalFoodTemplates.gentle.slice(0, 3).forEach(t => console.log("  → " + t));
console.log(naturalFoodTemplates.lively.slice(0, 3).forEach(t => console.log("  → " + t)));
