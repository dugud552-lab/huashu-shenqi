import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Head from "next/head";
import {
  generateReplies,
  generateOne,
  personalities,
  getStats,
  getScenarioList,
  analyzeBrotherQuote,
  generateOnePerPersonality,
  exportBrotherRecord,
} from "../lib/generator";

const PERSONALITY_KEYS = Object.keys(personalities);

const BROTHER_EXAMPLES = [
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

const QUICK_EXAMPLES = [
  { msg: "在吗 想你了", hint: "开场" },
  { msg: "给你转了点心意 收一下", hint: "感谢打赏" },
  { msg: "我喜欢你 做我女朋友吧", hint: "告白回应" },
  { msg: "发张照片看看呗", hint: "越界拒绝" },
  { msg: "今天加班好累啊", hint: "哄人安慰" },
  { msg: "周末有空吗 出来吃个饭", hint: "邀约见面" },
  { msg: "好久不见 最近忙啥呢", hint: "回访跟进" },
  { msg: "睡不着 一个人有点寂寞", hint: "深夜谈心" },
  { msg: "你长得真好看 声音也好听", hint: "回应夸奖" },
  { msg: "新年快乐呀 小宝贝", hint: "节日祝福" },
];

const INTENSITY_LEVELS = [
  { key: "warmup",  label: "保持距离",  emoji: "🌿", desc: "刚认识/新大哥 · 收敛礼貌" },
  { key: "daily",   label: "日常维护",  emoji: "💬", desc: "默认 · 关系稳定的老大哥" },
  { key: "heatup",  label: "升温撩拨",  emoji: "🔥", desc: "高价值大哥 · 拉近距离" },
];

const TAB_RESULT = "result";
const TAB_HISTORY = "history";
const TAB_FAV = "fav";
const TAB_BROS = "bros";

const MODE_CLASSIC = "classic";
const MODE_1V1 = "bro1v1";

function loadJSON(key, fallback) {
  try {
    const s = (typeof window !== "undefined") && localStorage.getItem(key);
    if (!s) return fallback;
    return JSON.parse(s);
  } catch (e) { return fallback; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [selectedTags, setSelectedTags] = useState(["gentle", "lively"]);
  const [results, setResults] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [copiedId, setCopiedId] = useState(null);
  const [globalScenarioKey, setGlobalScenarioKey] = useState(null);
  const [intensity, setIntensity] = useState("daily");
  const [activeTab, setActiveTab] = useState(TAB_RESULT);
  const [history, setHistory] = useState([]);     // [{id, ts, msg, tags, intensity, items:[{label,emoji,scenario,text}]}]
  const [fav, setFav] = useState([]);             // [{id, ts, label, emoji, scenario, text, sourceMsg}]
  const [docked, setDocked] = useState(false);    // 移动端键盘弹起 → 按钮吸底
  const [panelMode, setPanelMode] = useState("card"); // card(默认) | drawer
  const [appMode, setAppMode] = useState(MODE_CLASSIC); // classic | bro1v1

  /* ===== 1v1 大哥原话模式相关 state ===== */
  const [broMsg, setBroMsg] = useState("");
  const [broNickname, setBroNickname] = useState("");   // 大哥备注（陈总/王哥）
  const [broAddress, setBroAddress] = useState("哥");   // 想怎么称呼他
  const [broHostName, setBroHostName] = useState("");   // 主播名（模板替换 {host}）
  const [broReplies, setBroReplies] = useState([]);     // 8 条 1v1 卡片
  const [broAnalysis, setBroAnalysis] = useState(null); // 原话深度分析
  const [broGenerating, setBroGenerating] = useState(false);
  const [brothers, setBrothers] = useState([]);         // 大哥档案库 localStorage
  const [broDetailId, setBroDetailId] = useState(null); // 当前点开的大哥档案 id

  const textareaRef = useRef(null);
  const broTextareaRef = useRef(null);

  const stats = useMemo(() => getStats(), []);
  const scenarioList = useMemo(() => getScenarioList(), []);

  /* 初始化：主题 / 历史 / 收藏 / 大哥档案 */
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setTheme(savedTheme);
    setHistory(loadJSON("hh_history", []));
    setFav(loadJSON("hh_fav", []));
    setBrothers(loadJSON("hh_brothers", []));
    const savedMode = localStorage.getItem("hh_mode");
    if (savedMode === MODE_1V1) setAppMode(MODE_1V1);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("hh_mode", appMode);
  }, [appMode]);

  /* 移动端键盘弹起监听 → 按钮吸底  */
  useEffect(() => {
    const onVis = () => {
      if (typeof window === "undefined" || !window.visualViewport) return;
      const vv = window.visualViewport;
      const kbShown = vv.height < window.innerHeight - 80;
      setDocked(kbShown);
    };
    if (typeof window !== "undefined" && window.visualViewport) {
      window.visualViewport.addEventListener("resize", onVis);
      window.visualViewport.addEventListener("scroll", onVis);
    }
    return () => {
      if (typeof window !== "undefined" && window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onVis);
        window.visualViewport.removeEventListener("scroll", onVis);
      }
    };
  }, []);

  const pushHistory = useCallback((msg, tags, intens, arr) => {
    const record = {
      id: Date.now() + "" + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      msg,
      tags: [...tags],
      intensity: intens,
      items: arr.map(r => ({
        label: r.label, emoji: r.emoji, scenario: r.scenario,
        text: r.text, isBlend: !!r.isBlend,
      })),
    };
    setHistory(prev => {
      const next = [record, ...prev].slice(0, 20);
      saveJSON("hh_history", next);
      return next;
    });
  }, []);

  /* 收藏 / 取消收藏 */
  const toggleFav = useCallback((row) => {
    setFav(prev => {
      const existIdx = prev.findIndex(f => f.text === row.text && f.label === row.label);
      let next;
      if (existIdx >= 0) next = prev.filter((_, i) => i !== existIdx);
      else {
        next = [{
          id: Date.now() + "" + Math.random().toString(36).slice(2, 6),
          ts: Date.now(),
          label: row.label, emoji: row.emoji, scenario: row.scenario,
          text: row.text, sourceMsg: message,
        }, ...prev].slice(0, 50);
      }
      saveJSON("hh_fav", next);
      return next;
    });
  }, [message]);

  const favContains = (row) => fav.some(f => f.text === row.text && f.label === row.label);

  const toggleTheme = () => setTheme(p => p === "dark" ? "light" : "dark");
  const toggleTag = (key) => setSelectedTags(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const doGenerate = (scenarioOverride = globalScenarioKey, intens = intensity) => {
    if (!message.trim() || selectedTags.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setResults([]);
    setActiveTab(TAB_RESULT);
    setTimeout(() => {
      const replies = generateReplies(message, selectedTags, scenarioOverride, intens);
      setResults(replies);
      setIsGenerating(false);
      if (replies.length > 0) pushHistory(message, selectedTags, intens, replies);
    }, 380);
  };
  const handleGenerate = () => doGenerate(globalScenarioKey, intensity);

  const handleCopy = async (text, id) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleCopyAll = async () => {
    if (results.length === 0) return;
    const buf = results.map((r, i) =>
      `【${i+1}】${r.label}｜${r.scenario}\n${r.text}`
    ).join("\n\n");
    await handleCopy(buf, "all");
  };

  const handleRegenOne = (idx) => {
    const row = results[idx];
    if (!row) return;
    let nextText;
    if (row.isBlend) {
      const [pKey, vKey] = row.personality.split("+");
      const one = generateOne(message, pKey, row.scenarioKey || globalScenarioKey, intensity);
      if (!one) return;
      nextText = one.text;
    } else {
      const one = generateOne(message, row.personality, row.scenarioKey || globalScenarioKey, intensity);
      if (!one) return;
      nextText = one.text;
    }
    const nr = [...results];
    nr[idx] = { ...row, text: nextText };
    setResults(nr);
  };

  const handleScenarioChangeForCard = (idx, newScenarioKey) => {
    const row = results[idx];
    if (!row) return;
    const one = row.isBlend
      ? generateOne(message, row.personality.split("+")[0], newScenarioKey, intensity)
      : generateOne(message, row.personality, newScenarioKey, intensity);
    if (!one) return;
    const nr = [...results];
    nr[idx] = { ...row, scenarioKey: one.scenarioKey, scenario: one.scenario, text: one.text };
    setResults(nr);
  };

  const handlePickExample = (ex) => {
    setMessage(ex.msg);
    if (textareaRef.current) textareaRef.current.value = ex.msg;
    setResults([]);
    setTimeout(() => {
      if (!ex.msg.trim() || selectedTags.length === 0) return;
      setIsGenerating(true);
      setActiveTab(TAB_RESULT);
      setTimeout(() => {
        const replies = generateReplies(ex.msg, selectedTags, globalScenarioKey, intensity);
        setResults(replies);
        setIsGenerating(false);
        if (replies.length > 0) pushHistory(ex.msg, selectedTags, intensity, replies);
      }, 380);
    }, 50);
  };

  /* 用历史记录快速恢复一次生成 */
  const restoreHistory = (record) => {
    setMessage(record.msg);
    if (textareaRef.current) textareaRef.current.value = record.msg;
    setSelectedTags(record.tags || ["gentle"]);
    setIntensity(record.intensity || "daily");
    setResults(record.items.map((it, i) => ({
      ...it,
      personality: "hist_" + i,
      scenarioKey: "__hist__",
      intensity: record.intensity || "daily",
    })));
    setActiveTab(TAB_RESULT);
  };

  /* 复制一条收藏（收藏夹里每条都能单独复制） */
  const handleCopyFav = async (text, id) => handleCopy(text, "f" + id);

  const handleClear = () => {
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.focus();
    }
  };

  const clearHistory = () => {
    setHistory([]); saveJSON("hh_history", []);
  };
  const clearFav = () => {
    setFav([]); saveJSON("hh_fav", []);
  };
  const removeFav = (fid) => {
    setFav(prev => {
      const next = prev.filter(f => f.id !== fid);
      saveJSON("hh_fav", next); return next;
    });
  };

  /* ===== 1v1 大哥原话模式：核心动作 ===== */
  // ⚠️ msgOverride 解决 React 闭包陷阱：chip 点击时 setBroMsg 还没 re-render，
  //    旧的 handleBroGenerate 闭包里 broMsg 是空值 → return。
  //    改为优先用 ref 的 textarea 真实值，兜底 broMsg state，再兜底传入的 override。
  const getBroMsg = (override) => {
    if (typeof override === "string" && override.trim()) return override.trim();
    const fromRef = broTextareaRef.current?.value || "";
    return fromRef.trim() ? fromRef.trim() : broMsg.trim();
  };

  const handleBroGenerate = (msgOverride) => {
    const msg = getBroMsg(msgOverride);
    if (!msg || broGenerating) return;
    setBroGenerating(true);
    setActiveTab(TAB_RESULT);
    setTimeout(() => {
      const opts = {
        brotherName: broNickname.trim() || undefined,
        address: broAddress.trim() || undefined,
        hostName: broHostName.trim() || undefined,
      };
      const analysis = analyzeBrotherQuote(msg, opts);
      const replies = generateOnePerPersonality(msg, opts);
      const analysis2 = replies._analysis || analysis;
      setBroAnalysis(analysis2);
      setBroReplies(replies.slice(0, 8));
      setBroGenerating(false);
    }, 450);
  };

  const handleBroRegenOne = (pk) => {
    const msg = getBroMsg();
    if (!msg) return;
    const opts = {
      brotherName: broNickname.trim() || undefined,
      address: broAddress.trim() || undefined,
      hostName: broHostName.trim() || undefined,
    };
    const replies = generateOnePerPersonality(msg, opts);
    const fresh = replies.find(r => r.personality === pk);
    if (!fresh) return;
    setBroReplies(prev => prev.map(r => r.personality === pk ? fresh : r));
  };

  const handleBroSaveBrother = () => {
    const msg = getBroMsg();
    if (!msg || broReplies.length === 0) return;
    const id = "bro_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const record = {
      id,
      ts: Date.now(),
      nickname: broNickname.trim() || broAnalysis?.suggestAddress || "哥",
      brotherMessage: msg,
      address: broAddress,
      hostName: broHostName,
      analysis: broAnalysis,
      replies: broReplies.map(r => ({
        personality: r.personality, label: r.label, emoji: r.emoji,
        scenario: r.scenario, scenarioKey: r.scenarioKey,
        intensity: r.intensity, text: r.text, isCrossLineSafe: r.isCrossLineSafe,
      })),
    };
    setBrothers(prev => {
      const next = [record, ...prev].slice(0, 200); // 最多 200 个大哥档案
      saveJSON("hh_brothers", next);
      return next;
    });
    setBroDetailId(id);
    setActiveTab(TAB_BROS);
    handleCopy(`已保存到【大哥档案】啦，点「📂 大哥档案」Tab 就能看到`,"bro_saved");
  };

  const handleBroExport = (recordOrCurrent) => {
    const text = exportBrotherRecord(recordOrCurrent || {
      brotherMessage: getBroMsg(),
      nickname: broNickname,
      analysis: broAnalysis,
      replies: broReplies,
    });
    handleCopy(text, "bro_export_" + Math.random().toString(36).slice(2, 6));
  };

  const handleBroPickExample = (ex) => {
    setBroMsg(ex.msg);
    if (broTextareaRef.current) broTextareaRef.current.value = ex.msg;
    setBroReplies([]);
    setBroAnalysis(null);
    // ⚠️ 直接传 ex.msg，避免闭包陷阱（setBroMsg 还没 re-render 时 broMsg 仍是空）
    setTimeout(() => handleBroGenerate(ex.msg), 60);
  };

  const handleBroDelete = (bid) => {
    setBrothers(prev => {
      const next = prev.filter(b => b.id !== bid);
      saveJSON("hh_brothers", next);
      return next;
    });
    if (broDetailId === bid) setBroDetailId(null);
  };

  const handleBroRestore = (rec) => {
    setBroMsg(rec.brotherMessage || "");
    if (broTextareaRef.current) broTextareaRef.current.value = rec.brotherMessage || "";
    setBroNickname(rec.nickname || "");
    setBroAddress(rec.address || "哥");
    setBroHostName(rec.hostName || "");
    setBroReplies(rec.replies || []);
    setBroAnalysis(rec.analysis || null);
    setBroDetailId(rec.id);
    setAppMode(MODE_1V1);
    setActiveTab(TAB_RESULT);
  };

  const clearBrothers = () => {
    if (!confirm("确定清空所有大哥档案吗？（不可恢复）")) return;
    setBrothers([]); saveJSON("hh_brothers", []);
  };

  const charCountBro = broMsg.length;
  const charCount = message.length;

  /* 打字机组件 */
  const TypewriterText = ({ text, startDelay, forceImmediate }) => {
    const [displayText, setDisplayText] = useState("");
    const [isTyping, setIsTyping] = useState(true);
    useEffect(() => {
      if (forceImmediate) {
        setDisplayText(text); setIsTyping(false); return;
      }
      let idx = 0; setDisplayText(""); setIsTyping(true);
      let timer;
      const kick = setTimeout(() => {
        timer = setInterval(() => {
          if (idx < text.length) {
            setDisplayText(text.slice(0, idx + 2));
            idx += 2;
          } else {
            clearInterval(timer); setIsTyping(false);
          }
        }, 20);
      }, startDelay);
      return () => { clearTimeout(kick); clearInterval(timer); };
    }, [text, startDelay, forceImmediate]);
    return <div className="result-text">{displayText}{isTyping && <span className="cursor" />}</div>;
  };

  return (
    <div className={`container ${docked ? "docked" : ""}`}>
      <Head>
        <title>大哥维护话术神器 - 私聊高情商回复生成器</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <header className="header">
        <div className="logo">
          <div className="logo-icon">💝</div>
          <span className="logo-text">大哥维护神器</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="切换主题">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      <div className="hero">
        <h1>私聊维护话术生成器</h1>
        <p>粘贴大哥发来的消息，选性格，秒生成高情商维护回复</p>
      </div>

      {/* 🆕 双模式大切换：经典模式 / 1v1 大哥原话 */}
      <div className="mode-switch" role="tablist" aria-label="工作模式">
        <button
          className={"mode-item " + (appMode === MODE_CLASSIC ? "active" : "")}
          onClick={() => setAppMode(MODE_CLASSIC)}
          title="传统：写一句你想对大哥说的场景，选性格出回复"
        >
          <span className="mode-emoji">🎯</span>
          <span className="mode-title">经典模式</span>
          <span className="mode-desc">我出上句 → 你挑风格</span>
        </button>
        <button
          className={"mode-item " + (appMode === MODE_1V1 ? "active" : "")}
          onClick={() => setAppMode(MODE_1V1)}
          title="【主力】把大哥原话粘进来 → 自动识别 + 8 个性格一次出 1v1 专属回复 + 建档保存"
        >
          <span className="mode-emoji new">💬</span>
          <span className="mode-title">1v1 大哥原话 <span className="mode-tag new">主播专用</span></span>
          <span className="mode-desc">大哥说啥粘啥 → 8 种性格一键出</span>
        </button>
      </div>

      {/* =========================================================
          🎯 经典模式（原 UI 保留，用 className wrap 一下，1v1 模式隐藏）
          ========================================================= */}
      <div className={"mode-block " + (appMode === MODE_CLASSIC ? "show" : "")}>
      <div className="input-card">
        <textarea
          ref={textareaRef}
          defaultValue=""
          maxLength={500}
          placeholder={"在这里粘贴大哥发来的私聊消息...\n例如：在吗想你了 / 给你转了点心意收一下 / 今天加班好累 / 发张照片看看"}
          onInput={(e) => setMessage(e.target.value)}
        />
        <div className="input-meta">
          <button className="clear-btn" onClick={handleClear} disabled={!message}>✕ 清空</button>
          <div className={"char-counter " + (charCount >= 450 ? "warn" : "")}>{charCount} / 500</div>
        </div>
      </div>

      {/* 示例 chips */}
      <div className="section-label secondary">💡 常见话术，点一下直接生成</div>
      <div className="quick-chips">
        {QUICK_EXAMPLES.map(ex => (
          <button key={ex.msg} className="quick-chip" onClick={() => handlePickExample(ex)} title={ex.msg}>
            <span className="quick-chip-hint">{ex.hint}</span>
            <span className="quick-chip-text">{ex.msg}</span>
          </button>
        ))}
      </div>

      {/* 性格标签 */}
      <div className="section-label">🎭 选择回复性格（可多选，2 种以上会出「混搭风格卡」）
        <span className="badge-soft">已选 {selectedTags.length}</span>
      </div>
      <div className="tags">
        {PERSONALITY_KEYS.map(key => (
          <button
            key={key}
            className={`tag ${selectedTags.includes(key) ? "active" : ""}`}
            onClick={() => toggleTag(key)}
          >
            {personalities[key].emoji} {personalities[key].label}
          </button>
        ))}
      </div>

      {/* 话术强度 三档分段控件 */}
      <div className="section-label secondary">📈 话术浓度档位
        <span className="hint-inline">
          {INTENSITY_LEVELS.find(l => l.key === intensity)?.desc}
        </span>
      </div>
      <div className="segmented" role="tablist" aria-label="话术浓度">
        {INTENSITY_LEVELS.map(l => (
          <button
            key={l.key}
            className={`seg-item ${intensity === l.key ? "active" : ""}`}
            onClick={() => setIntensity(l.key)}
            title={l.desc}
          >
            <span className="seg-emoji">{l.emoji}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>

      {/* 场景模式 */}
      <div className="scenario-row">
        <div className="section-label secondary" style={{ margin: 0 }}>🎯 场景识别模式</div>
        <select
          className="scenario-select"
          value={globalScenarioKey || "__auto__"}
          onChange={(e) => setGlobalScenarioKey(e.target.value === "__auto__" ? null : e.target.value)}
          title="手动锁定场景"
        >
          <option value="__auto__">自动识别（推荐）</option>
          {scenarioList.map(s => (
            <option key={s.key} value={s.key}>强制：{s.label}</option>
          ))}
        </select>
      </div>

      {/* 生成按钮（桌面非吸底；移动端键盘弹起时用另一个吸底按钮） */}
      <button
        className={"generate-btn " + (docked ? "only-desktop" : "")}
        onClick={handleGenerate}
        disabled={!message.trim() || selectedTags.length === 0 || isGenerating}
      >
        {isGenerating ? "正在生成回复中..." : "✨ 生成回复话术"}
      </button>

      {/* Tabs：结果 / 历史 / 收藏 / 大哥档案 */}
      <div className="tabs">
        <button className={"tab " + (activeTab === TAB_RESULT ? "active" : "")} onClick={() => setActiveTab(TAB_RESULT)}>
          🎯 结果 <span className="tab-count">{appMode === MODE_1V1 ? broReplies.length : results.length}</span>
        </button>
        <button className={"tab " + (activeTab === TAB_HISTORY ? "active" : "")} onClick={() => setActiveTab(TAB_HISTORY)}>
          🕘 历史 <span className="tab-count">{history.length}</span>
        </button>
        <button className={"tab " + (activeTab === TAB_FAV ? "active" : "")} onClick={() => setActiveTab(TAB_FAV)}>
          ⭐ 收藏 <span className="tab-count">{fav.length}</span>
        </button>
        <button className={"tab " + (activeTab === TAB_BROS ? "active" : "")} onClick={() => setActiveTab(TAB_BROS)}>
          📂 大哥档案 <span className="tab-count">{brothers.length}</span>
        </button>
      </div>

      {/* ===== 结果区 ===== */}
      {activeTab === TAB_RESULT && (
        <div className="results">

          {/* ═══════════════ 1v1 模式：深度分析面板 + 8 张性格卡 ═══════════════ */}
          {appMode === MODE_1V1 && (
            <>
              {broGenerating && (
                <div className="skeleton-row">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="result-card skeleton">
                      <div className="sk sk-head" /><div className="sk sk-line w-80" />
                      <div className="sk sk-line w-100" /><div className="sk sk-line w-60" />
                    </div>
                  ))}
                </div>
              )}

              {!broGenerating && broAnalysis && (
                <div className={"analysis-card " + (broAnalysis.crossLine ? "danger" : broAnalysis.toneLevel >= 2 ? "hot" : broAnalysis.toneLevel <= -1 ? "cold" : "")}>
                  <div className="analysis-title">
                    🧠 原话深度识别
                    {broAnalysis.crossLine && <span className="analysis-alert">⚠️ 越界预警</span>}
                  </div>
                  <div className="analysis-grid">
                    <div><span className="k">场景命中</span><span className="v">{broAnalysis.scenarioLabel}</span></div>
                    <div><span className="k">大哥画像</span><span className="v">{broAnalysis.brotherType}</span></div>
                    <div><span className="k">建议称呼</span><span className="v">{broAnalysis.suggestAddress}</span></div>
                    <div><span className="k">建议浓度</span><span className="v">{INTENSITY_LEVELS.find(l=>l.key===broAnalysis.suggestIntensity)?.label || broAnalysis.suggestIntensity}</span></div>
                  </div>
                  {broAnalysis.matchedWords.length > 0 && (
                    <div className="analysis-chips">
                      <span className="chips-label">关键词命中：</span>
                      {broAnalysis.matchedWords.map(w => <span key={w} className="kw-chip">{w}</span>)}
                    </div>
                  )}
                  {broAnalysis.crossLine && (
                    <div className="analysis-alert-box">
                      🚨 越界分类：<strong>{broAnalysis.crossLineType}</strong>
                      <div>→ 建议优先使用"温柔 / 成熟 / 毒舌"三张卡（✅ 标记的）</div>
                    </div>
                  )}
                  <ul className="analysis-hints">
                    {broAnalysis.replyHints.slice(0, 5).map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                  <div className="analysis-actions">
                    <button className="bulk-btn" onClick={() => handleBroSaveBrother()} disabled={broReplies.length === 0}>
                      💾 保存到大哥档案
                    </button>
                    <button className="bulk-btn primary" onClick={() => handleBroExport(null)} disabled={broReplies.length === 0}>
                      📤 复制整套话术（可分享）
                    </button>
                  </div>
                </div>
              )}

              {!broGenerating && broReplies.length === 0 && broMsg.trim() && (
                <div className="empty-state"><div>👆 点击「💬 生成 8 条 1v1 回复」按钮</div></div>
              )}
              {!broGenerating && broReplies.length === 0 && !broMsg.trim() && (
                <div className="empty-state"><div>💡 在上面输入框粘贴大哥原话，一键出 8 种性格的回复</div></div>
              )}

              {/* 8 张 1v1 卡片 */}
              <div className="bro-grid">
                {broReplies.map((r, i) => (
                  <div key={r.personality || i} className={"result-card bro-card " + (r.isCrossLineSafe ? "safe" : "warn-card")}>
                    <div className="result-header">
                      <div className="result-personality">
                        {r.isCrossLineSafe === false && <span className="safe-flag warn" title="越界场景下慎用，容易被误解为给机会">⚠️ 慎用</span>}
                        {r.isCrossLineSafe && broAnalysis?.crossLine && <span className="safe-flag ok" title="越界场景下优先用这类卡">✅ 推荐</span>}
                        <span className="personality-dot" />
                        {r.emoji} {r.label}
                      </div>
                      <div className="result-actions">
                        <button
                          className="fav-btn"
                          onClick={() => toggleFav({ ...r, sourceMsg: broMsg, label: r.label, text: r.text, emoji: r.emoji, scenario: r.scenario })}
                          title="收藏话术"
                        >{favContains(r) ? "⭐" : "☆"}</button>
                        <button className="regen-btn" onClick={() => handleBroRegenOne(r.personality)} title="再换一条">🔄 换</button>
                        <button
                          className={`copy-btn ${copiedId === "bro_"+r.personality ? "copied" : ""}`}
                          onClick={() => handleCopy(r.text, "bro_"+r.personality)}
                        >{copiedId === "bro_"+r.personality ? "已复制 ✓" : "📋 复制"}</button>
                      </div>
                    </div>
                    <div className="scenario-row-card">
                      <span className="scenario-badge">场景：{r.scenario}</span>
                      <span className={"intensity-badge i-" + r.intensity}>
                        浓度：{INTENSITY_LEVELS.find(l => l.key === r.intensity)?.label || r.intensity}
                      </span>
                    </div>
                    <div className="result-text">{r.text}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══════════════ 经典模式：原结果区 ═══════════════ */}
          {appMode === MODE_CLASSIC && (
            <>
              {results.length > 0 && (
                <div className="bulk-actions">
                  <button className="bulk-btn primary" onClick={handleCopyAll} disabled={results.length === 0}>
                    📋 一键复制全部（{results.length}条）
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="skeleton-row">
                  {[0, 1].map(i => (
                    <div key={i} className="result-card skeleton">
                      <div className="sk sk-head" />
                      <div className="sk sk-line w-80" />
                      <div className="sk sk-line w-100" />
                      <div className="sk sk-line w-60" />
                    </div>
                  ))}
                </div>
              )}

              {!isGenerating && results.length === 0 && message.trim() && (
                <div className="empty-state"><div>👆 点击上方按钮生成回复</div></div>
              )}
              {!isGenerating && results.length === 0 && !message.trim() && (
                <div className="empty-state"><div>💡 先输入消息内容，或者点上方常用话术 chip</div></div>
              )}

              {results.map((r, i) => (
                <div key={i} className={"result-card " + (r.isBlend ? "blend" : "")}>
                  <div className="result-header">
                    <div className="result-personality">
                      <span className="personality-dot" />
                      {r.emoji} {r.label}
                      {r.isBlend && <span className="blend-tag">混搭</span>}
                    </div>
                    <div className="result-actions">
                      <button
                        className="fav-btn"
                        onClick={() => toggleFav(r)}
                        title={favContains(r) ? "取消收藏" : "收藏话术"}
                      >
                        {favContains(r) ? "⭐" : "☆"}
                      </button>
                      <button className="regen-btn" onClick={() => handleRegenOne(i)} title="换一条">🔄 换一批</button>
                      <button
                        className={`copy-btn ${copiedId === i ? "copied" : ""}`}
                        onClick={() => handleCopy(r.text, i)}
                      >
                        {copiedId === i ? "已复制 ✓" : "📋 复制"}
                      </button>
                    </div>
                  </div>

                  <div className="scenario-row-card">
                    <span className="scenario-badge">场景：{r.scenario}</span>
                    <select
                      className="scenario-select tiny"
                      value={r.scenarioKey || "__auto__"}
                      onChange={(e) => handleScenarioChangeForCard(i, e.target.value)}
                      title="手动换场景重出"
                    >
                      <option value={r.scenarioKey || "__auto__"}>切场景 ↓</option>
                      {scenarioList.map(s => (
                        <option key={s.key} value={s.key}>→ {s.label}</option>
                      ))}
                    </select>
                  </div>

                  <TypewriterText text={r.text} startDelay={i * 120} forceImmediate={false} />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ===== 历史区 ===== */}
      {activeTab === TAB_HISTORY && (
        <div className="panel">
          {history.length > 0 && (
            <div className="panel-actions">
              <span className="panel-hint">最近 20 条，自动保存在本机</span>
              <button className="link-btn danger" onClick={clearHistory}>清空历史</button>
            </div>
          )}
          {history.length === 0 && (
            <div className="empty-state"><div>🕘 还没有生成记录</div></div>
          )}
          {history.map(h => (
            <details key={h.id} className="hist-item" open={history.indexOf(h) === 0}>
              <summary>
                <div className="hist-msg">{h.msg}</div>
                <div className="hist-meta">
                  {new Date(h.ts).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  <span className="sep">·</span>
                  性格 {h.tags?.length || 0} 选
                  <span className="sep">·</span>
                  {INTENSITY_LEVELS.find(l => l.key === h.intensity)?.label || "日常"}
                  <span className="sep">·</span>
                  {h.items.length} 条结果
                </div>
              </summary>
              <div className="hist-body">
                {h.items.map((it, ii) => (
                  <div className="result-card" key={ii}>
                    <div className="result-header">
                      <div className="result-personality">
                        <span className="personality-dot" />
                        {it.emoji} {it.label}
                        {it.isBlend && <span className="blend-tag">混搭</span>}
                      </div>
                      <div className="result-actions">
                        <button
                          className="fav-btn"
                          onClick={() => toggleFav({ ...it, sourceMsg: h.msg })}
                          title="收藏"
                        >{favContains(it) ? "⭐" : "☆"}</button>
                        <button
                          className={`copy-btn ${copiedId === `h${h.id}-${ii}` ? "copied" : ""}`}
                          onClick={() => handleCopy(it.text, `h${h.id}-${ii}`)}
                        >
                          {copiedId === `h${h.id}-${ii}` ? "已复制 ✓" : "📋 复制"}
                        </button>
                      </div>
                    </div>
                    <span className="scenario-badge">场景：{it.scenario}</span>
                    <div className="result-text">{it.text}</div>
                  </div>
                ))}
                <div className="hist-restore">
                  <button className="regen-btn" onClick={() => restoreHistory(h)}>
                    🔁 用本次条件再生成一轮
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* ===== 收藏区 ===== */}
      {activeTab === TAB_FAV && (
        <div className="panel">
          {fav.length > 0 && (
            <div className="panel-actions">
              <span className="panel-hint">最多保存 50 条，永久保留在本机</span>
              <button className="link-btn danger" onClick={clearFav}>清空收藏</button>
            </div>
          )}
          {fav.length === 0 && (
            <div className="empty-state">
              <div>⭐ 点每张卡片右上角 ☆ 收藏最喜欢的话术</div>
            </div>
          )}
          {fav.map(f => (
            <div key={f.id} className="result-card fav-card">
              <div className="result-header">
                <div className="result-personality">
                  <span className="personality-dot" />
                  {f.emoji} {f.label}
                </div>
                <div className="result-actions">
                  <button className="link-btn danger" onClick={() => removeFav(f.id)} title="移除">移除</button>
                  <button
                    className={`copy-btn ${copiedId === "f" + f.id ? "copied" : ""}`}
                    onClick={() => handleCopyFav(f.text, f.id)}
                  >
                    {copiedId === "f" + f.id ? "已复制 ✓" : "📋 复制"}
                  </button>
                </div>
              </div>
              {f.sourceMsg && <div className="fav-source">← 来自对话：{f.sourceMsg}</div>}
              <span className="scenario-badge">场景：{f.scenario}</span>
              <div className="result-text">{f.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* ===== 📂 大哥档案 Tab ===== */}
      {activeTab === TAB_BROS && (
        <div className="panel bros-panel">
          {brothers.length > 0 && (
            <div className="panel-actions">
              <span className="panel-hint">最多 200 条，自动保存在本机（{brothers.length}/200）</span>
              <button className="link-btn danger" onClick={clearBrothers}>清空档案</button>
            </div>
          )}
          {brothers.length === 0 && (
            <div className="empty-state">
              <div>📂 还没有大哥档案</div>
              <div className="small">切到「💬 1v1 大哥原话」模式，生成一次后点「💾 保存到大哥档案」</div>
            </div>
          )}
          <div className="bros-list">
            {brothers.map(b => (
              <div key={b.id} className={"bro-row " + (broDetailId === b.id ? "open" : "")}>
                <div className="bro-row-head" onClick={() => setBroDetailId(broDetailId === b.id ? null : b.id)}>
                  <div className="bro-avatar">{(b.nickname || "哥").slice(0,1)}</div>
                  <div className="bro-main">
                    <div className="bro-name-row">
                      <span className="bro-nickname">{b.nickname || "未命名大哥"}</span>
                      <span className={"bro-type t-" + (b.analysis?.brotherType || "日常打卡型").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")}>
                        {b.analysis?.brotherType || "—"}
                      </span>
                      {b.analysis?.crossLine && <span className="bro-alert">⚠️ 越界</span>}
                    </div>
                    <div className="bro-quote">「{b.brotherMessage?.slice(0, 56)}{(b.brotherMessage||"").length > 56 ? "…" : ""}」</div>
                    <div className="bro-meta">
                      {new Date(b.ts).toLocaleString("zh-CN", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" })}
                      <span className="sep">·</span>场景：{b.analysis?.scenarioLabel || "—"}
                      <span className="sep">·</span>{b.replies?.length || 0} 条回复
                    </div>
                  </div>
                  <div className="bro-caret">{broDetailId === b.id ? "▲" : "▼"}</div>
                </div>
                {broDetailId === b.id && (
                  <div className="bro-detail">
                    <div className="bro-detail-actions">
                      <button className="regen-btn" onClick={() => handleBroRestore(b)}>🔁 回到 1v1 模式重调</button>
                      <button className="copy-btn" onClick={() => handleBroExport(b)}>📤 复制整套</button>
                      <button className="link-btn danger" onClick={() => handleBroDelete(b.id)}>🗑 删除档案</button>
                    </div>
                    <div className="analysis-chips">
                      <span className="chips-label">关键词：</span>
                      {(b.analysis?.matchedWords || []).map(w => <span key={w} className="kw-chip">{w}</span>)}
                      {(b.analysis?.replyHints || []).slice(0, 2).map((h, i) => (
                        <span key={i} className="hint-chip">💡 {h}</span>
                      ))}
                    </div>
                    <div className="bro-grid">
                      {(b.replies || []).map((r, i) => (
                        <div key={r.personality || i} className={"result-card bro-card " + (r.isCrossLineSafe === false ? "warn-card" : r.isCrossLineSafe ? "safe" : "")}>
                          <div className="result-header">
                            <div className="result-personality">
                              <span className="personality-dot" />{r.emoji} {r.label}
                              {r.isCrossLineSafe === false && <span className="safe-flag warn">⚠️ 慎用</span>}
                            </div>
                            <div className="result-actions">
                              <button className="fav-btn"
                                onClick={() => toggleFav({
                                  id: Math.random(), label: r.label, emoji: r.emoji, scenario: r.scenario,
                                  text: r.text, sourceMsg: b.brotherMessage,
                                })}
                              >{favContains({label:r.label, text:r.text}) ? "⭐" : "☆"}</button>
                              <button
                                className={`copy-btn ${copiedId === "brosrc_"+b.id+"_"+r.personality ? "copied" : ""}`}
                                onClick={() => handleCopy(r.text, "brosrc_"+b.id+"_"+r.personality)}
                              >{copiedId === "brosrc_"+b.id+"_"+r.personality ? "已复制 ✓" : "📋 复制"}</button>
                            </div>
                          </div>
                          <div className="scenario-row-card">
                            <span className="scenario-badge">场景：{r.scenario}</span>
                            <span className={"intensity-badge i-" + r.intensity}>
                              {INTENSITY_LEVELS.find(l => l.key === r.intensity)?.label || r.intensity}
                            </span>
                          </div>
                          <div className="result-text">{r.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 移动端吸底生成按钮（键盘弹起时才出现）—— 按模式切换 */}
      {docked && (
        <div className="docked-bar">
          {appMode === MODE_CLASSIC ? (
            <button
              className="generate-btn docked"
              onClick={handleGenerate}
              disabled={!message.trim() || selectedTags.length === 0 || isGenerating}
            >
              {isGenerating ? "生成中..." : "✨ 生成回复话术"}
            </button>
          ) : (
            <button
              className="generate-btn docked primary-1v1"
              onClick={() => handleBroGenerate()}
              disabled={!broMsg.trim() || broGenerating}
            >
              {broGenerating ? "分析大哥原话中..." : "💬 生成 8 条 1v1 回复"}
            </button>
          )}
        </div>
      )}
      </div> {/* ⬅️ 关闭经典模式的 mode-block */}

      {/* =========================================================
          💬 1v1 大哥原话模式（整个第二大区块，经典模式隐藏时显示它）
          ========================================================= */}
      <div className={"mode-block " + (appMode === MODE_1V1 ? "show" : "")}>
        {/* 大哥原话输入卡 + 元信息 */}
        <div className="input-card bro-input-card">
          <div className="bro-input-title">
            <span className="t-emoji">💬</span>
            <div>
              <div className="t-title">大哥原话（微信私聊直接粘贴）</div>
              <div className="t-sub">系统会自动识别场景 / 画像 / 是否越界 / 该怎么称呼他，然后 8 种性格各出 1 条 1v1 专属回复</div>
            </div>
          </div>
          <textarea
            ref={broTextareaRef}
            defaultValue=""
            maxLength={800}
            className="bro-textarea"
            placeholder={"把大哥发给你的原话粘到这里…\n\n例如：\n刚给你刷了个嘉年华 不用谢\n美女 发张自拍看看 要无美颜的\n妹妹 周转不开 能借我 3 万块吗\n我帮你守塔了 血条差点被偷 还好秒了"}
            onInput={(e) => setBroMsg(e.target.value)}
          />
          <div className="input-meta">
            <button className="clear-btn" onClick={() => {
              setBroMsg(""); if(broTextareaRef.current) { broTextareaRef.current.value=""; broTextareaRef.current.focus(); }
            }} disabled={!broMsg}>✕ 清空</button>
            <div className={"char-counter " + (charCountBro >= 700 ? "warn" : "")}>{charCountBro} / 800</div>
          </div>

          <div className="bro-meta-row">
            <label className="bro-meta-item">
              <span>备注名（大哥昵称）</span>
              <input
                type="text"
                maxLength={16}
                placeholder="例如：陈总 / 王哥 / 榜一大哥"
                value={broNickname}
                onChange={(e) => setBroNickname(e.target.value)}
              />
            </label>
            <label className="bro-meta-item">
              <span>怎么称呼他</span>
              <select value={broAddress} onChange={(e) => setBroAddress(e.target.value)}>
                <option value="哥">哥</option>
                <option value="宝~">宝~</option>
                <option value="老板">老板</option>
                <option value="X总">X总</option>
                <option value="兄弟">兄弟</option>
                <option value="亲爱的~">亲爱的~</option>
              </select>
            </label>
            <label className="bro-meta-item">
              <span>你的主播名（可选）</span>
              <input
                type="text"
                maxLength={12}
                placeholder="模板里会用 {host}"
                value={broHostName}
                onChange={(e) => setBroHostName(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* 1v1 常用原话 chips */}
        <div className="section-label secondary">🎯 真实场景示例，点一下直接生成</div>
        <div className="quick-chips bro-chips">
          {BROTHER_EXAMPLES.map(ex => (
            <button key={ex.msg} className="quick-chip" onClick={() => handleBroPickExample(ex)} title={ex.msg}>
              <span className="quick-chip-hint">{ex.hint}</span>
              <span className="quick-chip-text">{ex.msg}</span>
            </button>
          ))}
        </div>

        {/* 说明：8 性格同时出 */}
        <div className="bro-mode-hint">
          <span className="hint-title">✅ 一次生成 8 种性格回复</span>
          <span className="hint-row">温柔体贴 / 高冷傲娇 / 活泼可爱 / 撒娇卖萌 / 幽默搞笑 / 成熟稳重 / 毒舌犀利 / 甜言蜜语</span>
          <span className="hint-row tips">越界场景自动标记 ⚠️ 慎用卡，推荐用 ✅ 卡</span>
        </div>

        {/* 1v1 生成按钮 */}
        <button
          className={"generate-btn bro-generate-btn " + (docked ? "only-desktop" : "")}
          onClick={() => handleBroGenerate()}
          disabled={!broMsg.trim() || broGenerating}
        >
          {broGenerating ? "🔍 正在识别原话 + 生成 8 条高情商回复..." : "💬 生成 8 条 1v1 专属回复"}
        </button>
      </div>

      <footer className="footer">
        大哥维护神器 · 内置{stats.templates.toLocaleString()}
        条话术模板 · {stats.scenarios}大场景全覆盖 · {stats.personalities}种性格风格
      </footer>
    </div>
  );
}
