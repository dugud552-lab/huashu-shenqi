import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Head from "next/head";
import {
  generateOne,
  personalities,
  getStats,
  getScenarioList,
  analyzeBrotherQuote,
  generateOnePerPersonality,
  exportBrotherRecord,
} from "../lib/generator";

const PERSONALITY_KEYS = Object.keys(personalities);

const ALL_EXAMPLES = [
  { msg: "在吗 想你了", hint: "开场" },
  { msg: "刚给你刷了个嘉年华 不用谢", hint: "刷礼物" },
  { msg: "给你转了点心意 收一下", hint: "感谢打赏" },
  { msg: "我喜欢你 做我女朋友吧", hint: "告白" },
  { msg: "发张照片看看呗", hint: "越界" },
  { msg: "今天加班好累啊", hint: "安慰" },
  { msg: "我想睡你 你开价", hint: "越界" },
  { msg: "能借我3万块吗 周转不开", hint: "借钱" },
  { msg: "我帮你守塔了 血条差点被偷", hint: "PK" },
  { msg: "今天我生日 你不祝我吗", hint: "生日" },
  { msg: "给我唱一首后来吧 睡不着", hint: "点歌" },
  { msg: "下播啦 今天谢谢你", hint: "下播" },
  { msg: "今天被老板骂了 真不想干了", hint: "吐槽" },
  { msg: "周末有空吗 出来吃个饭", hint: "邀约" },
];

const INTENSITY_LEVELS = [
  { key: "warmup", label: "保持距离", emoji: "🌿" },
  { key: "daily",  label: "日常维护", emoji: "💬" },
  { key: "heatup", label: "升温撩拨", emoji: "🔥" },
];

const TAB_RESULT = "result";
const TAB_HISTORY = "history";
const TAB_FAV = "fav";
const TAB_BROS = "bros";

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
  const [selectedTags, setSelectedTags] = useState([]);
  const [results, setResults] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [copiedId, setCopiedId] = useState(null);
  const [intensity, setIntensity] = useState("auto");
  const [activeTab, setActiveTab] = useState(TAB_RESULT);
  const [history, setHistory] = useState([]);
  const [fav, setFav] = useState([]);
  const [docked, setDocked] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [broNickname, setBroNickname] = useState("");
  const [broAddress, setBroAddress] = useState("哥");
  const [brothers, setBrothers] = useState([]);
  const [broDetailId, setBroDetailId] = useState(null);

  const textareaRef = useRef(null);

  const stats = useMemo(() => getStats(), []);
  const scenarioList = useMemo(() => getScenarioList(), []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setTheme(savedTheme);
    setHistory(loadJSON("hh_history", []));
    setFav(loadJSON("hh_fav", []));
    setBrothers(loadJSON("hh_brothers", []));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const onVis = () => {
      if (typeof window === "undefined" || !window.visualViewport) return;
      const vv = window.visualViewport;
      setDocked(vv.height < window.innerHeight - 80);
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

  const pushHistory = useCallback((msg, tags, arr) => {
    const record = {
      id: Date.now() + "" + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      msg,
      tags: [...tags],
      items: arr.map(r => ({
        label: r.label, emoji: r.emoji, scenario: r.scenario,
        text: r.text,
      })),
      analysis: arr._analysis || null,
    };
    setHistory(prev => {
      const next = [record, ...prev].slice(0, 20);
      saveJSON("hh_history", next);
      return next;
    });
  }, []);

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

  // 获取输入框内容（兼容 IME）
  const getMsg = (override) => {
    if (typeof override === "string" && override.trim()) return override.trim();
    const ta = textareaRef.current;
    if (ta && ta.value && ta.value.trim()) return ta.value.trim();
    return message.trim();
  };

  // 统一生成逻辑
  const handleGenerate = (msgOverride) => {
    const msg = getMsg(msgOverride);
    if (!msg || isGenerating) return;
    setIsGenerating(true);
    setResults([]);
    setAnalysis(null);
    setActiveTab(TAB_RESULT);
    setTimeout(() => {
      try {
        const opts = {
          brotherName: broNickname.trim() || undefined,
          address: broAddress.trim() || undefined,
          intensity: intensity === "auto" ? undefined : intensity,
        };
        const broAnalysis = analyzeBrotherQuote(msg, opts);
        const replies = generateOnePerPersonality(msg, opts);
        const analysisResult = replies._analysis || broAnalysis;
        setAnalysis(analysisResult);

        // 如果选了特定性格，只显示选中的；否则显示全部 8 条
        const filtered = selectedTags.length > 0
          ? replies.filter(r => selectedTags.includes(r.personality))
          : replies;
        setResults(filtered.length > 0 ? filtered : replies);
        pushHistory(msg, selectedTags.length > 0 ? selectedTags : PERSONALITY_KEYS, filtered.length > 0 ? filtered : replies);
      } catch (err) {
        console.error("生成失败:", err);
        setResults([]);
      } finally {
        setIsGenerating(false);
      }
    }, 380);
  };

  const handleRegenOne = (pk) => {
    const msg = getMsg();
    if (!msg) return;
    const opts = {
      brotherName: broNickname.trim() || undefined,
      address: broAddress.trim() || undefined,
      intensity: intensity === "auto" ? undefined : intensity,
    };
    const replies = generateOnePerPersonality(msg, opts);
    const fresh = replies.find(r => r.personality === pk);
    if (!fresh) return;
    setResults(prev => prev.map(r => r.personality === pk ? fresh : r));
  };

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

  const handlePickExample = (ex) => {
    setMessage(ex.msg);
    if (textareaRef.current) textareaRef.current.value = ex.msg;
    setResults([]);
    setAnalysis(null);
    setTimeout(() => handleGenerate(ex.msg), 60);
  };

  const handleSaveBrother = () => {
    const msg = getMsg();
    if (!msg || results.length === 0) return;
    const id = "bro_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const record = {
      id, ts: Date.now(),
      nickname: broNickname.trim() || analysis?.suggestAddress || "哥",
      brotherMessage: msg,
      address: broAddress,
      analysis,
      replies: results.map(r => ({
        personality: r.personality, label: r.label, emoji: r.emoji,
        scenario: r.scenario, scenarioKey: r.scenarioKey,
        intensity: r.intensity, text: r.text, isCrossLineSafe: r.isCrossLineSafe,
      })),
    };
    setBrothers(prev => {
      const next = [record, ...prev].slice(0, 200);
      saveJSON("hh_brothers", next);
      return next;
    });
    setBroDetailId(id);
    setActiveTab(TAB_BROS);
  };

  const handleExport = () => {
    const msg = getMsg();
    const text = exportBrotherRecord({
      brotherMessage: msg,
      nickname: broNickname,
      analysis,
      replies: results,
    });
    handleCopy(text, "export");
  };

  const handleClear = () => {
    setMessage("");
    setResults([]);
    setAnalysis(null);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.focus();
    }
  };

  const clearHistory = () => { setHistory([]); saveJSON("hh_history", []); };
  const clearFav = () => { setFav([]); saveJSON("hh_fav", []); };
  const removeFav = (fid) => {
    setFav(prev => { const n = prev.filter(f => f.id !== fid); saveJSON("hh_fav", n); return n; });
  };
  const handleBroDelete = (bid) => {
    setBrothers(prev => { const n = prev.filter(b => b.id !== bid); saveJSON("hh_brothers", n); return n; });
    if (broDetailId === bid) setBroDetailId(null);
  };
  const handleBroRestore = (rec) => {
    setMessage(rec.brotherMessage || "");
    if (textareaRef.current) textareaRef.current.value = rec.brotherMessage || "";
    setBroNickname(rec.nickname || "");
    setBroAddress(rec.address || "哥");
    setResults(rec.replies || []);
    setAnalysis(rec.analysis || null);
    setBroDetailId(rec.id);
    setActiveTab(TAB_RESULT);
  };
  const clearBrothers = () => {
    if (!confirm("确定清空所有大哥档案吗？")) return;
    setBrothers([]); saveJSON("hh_brothers", []);
  };

  const charCount = message.length;

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
        <p>粘贴大哥发来的消息 → 一键生成 8 种性格高情商回复</p>
      </div>

      {/* 输入框 */}
      <div className="input-card">
        <textarea
          ref={textareaRef}
          defaultValue=""
          maxLength={800}
          placeholder={"把大哥发来的消息粘到这里...\n\n例如：\n在吗 想你了\n刚给你刷了个嘉年华\n我想睡你 你开价\n能借我3万块吗\n今天被老板骂了 好累"}
          onInput={(e) => setMessage(e.target.value)}
          onCompositionEnd={(e) => setMessage(e.target.value)}
          onBlur={(e) => setMessage(e.target.value)}
        />
        <div className="input-meta">
          <button className="clear-btn" onClick={handleClear} disabled={!message}>✕ 清空</button>
          <div className={"char-counter " + (charCount >= 700 ? "warn" : "")}>{charCount} / 800</div>
        </div>
      </div>

      {/* 快捷示例 */}
      <div className="section-label secondary">💡 点一下直接生成</div>
      <div className="quick-chips">
        {ALL_EXAMPLES.map(ex => (
          <button key={ex.msg} className="quick-chip" onClick={() => handlePickExample(ex)} title={ex.msg}>
            <span className="quick-chip-hint">{ex.hint}</span>
            <span className="quick-chip-text">{ex.msg}</span>
          </button>
        ))}
      </div>

      {/* 性格选择（可选） */}
      <div className="section-label">
        🎭 选择性格（可选，不选则出全部 8 种）
        {selectedTags.length > 0 && <span className="badge-soft">已选 {selectedTags.length}</span>}
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

      {/* 高级选项（折叠） */}
      <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? "▼ 高级设置" : "▶ 高级设置（称呼 / 浓度）"}
      </button>
      {showAdvanced && (
        <div className="advanced-panel">
          <label className="bro-meta-item">
            <span>怎么称呼他</span>
            <select value={broAddress} onChange={(e) => setBroAddress(e.target.value)}>
              <option value="哥">哥</option>
              <option value="宝~">宝~</option>
              <option value="老板">老板</option>
              <option value="X总">X总</option>
              <option value="兄弟">兄弟</option>
            </select>
          </label>
          <label className="bro-meta-item">
            <span>备注名</span>
            <input type="text" maxLength={16} placeholder="大哥昵称" value={broNickname} onChange={(e) => setBroNickname(e.target.value)} />
          </label>
          <div className="intensity-row">
            <span>话术浓度</span>
            <div className="segmented compact">
              <button className={`seg-item ${intensity === "auto" ? "active" : ""}`} onClick={() => setIntensity("auto")}>自动</button>
              {INTENSITY_LEVELS.map(l => (
                <button key={l.key} className={`seg-item ${intensity === l.key ? "active" : ""}`} onClick={() => setIntensity(l.key)}>
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      <button
        className={"generate-btn " + (docked ? "only-desktop" : "")}
        onClick={() => handleGenerate()}
        disabled={isGenerating}
      >
        {isGenerating ? "🔍 正在识别 + 生成回复..." : "✨ 生成回复"}
      </button>

      {/* Tabs */}
      <div className="tabs">
        <button className={"tab " + (activeTab === TAB_RESULT ? "active" : "")} onClick={() => setActiveTab(TAB_RESULT)}>
          🎯 结果 <span className="tab-count">{results.length}</span>
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

      {/* 结果区 */}
      {activeTab === TAB_RESULT && (
        <div className="results">
          {isGenerating && (
            <div className="skeleton-row">
              {[0,1,2,3].map(i => (
                <div key={i} className="result-card skeleton">
                  <div className="sk sk-head" /><div className="sk sk-line w-80" />
                  <div className="sk sk-line w-100" /><div className="sk sk-line w-60" />
                </div>
              ))}
            </div>
          )}

          {!isGenerating && analysis && (
            <div className={"analysis-card " + (analysis.crossLine ? "danger" : analysis.toneLevel >= 2 ? "hot" : analysis.toneLevel <= -1 ? "cold" : "")}>
              <div className="analysis-title">
                <span className="analysis-icon">🧠</span>
                <span>原话深度识别</span>
                {analysis.crossLine && <span className="analysis-alert">⚠️ 越界预警</span>}
              </div>

              {/* 意图总结 */}
              {analysis.intent && (
                <div className="analysis-intent">
                  <span className="intent-label">意图</span>
                  <span className="intent-text">{analysis.intent}</span>
                </div>
              )}

              {/* 核心维度 */}
              <div className="analysis-grid">
                <div><span className="k">场景</span><span className="v">{analysis.scenarioLabel}</span></div>
                <div><span className="k">画像</span><span className="v">{analysis.brotherType}</span></div>
                <div><span className="k">浓度</span><span className="v">{INTENSITY_LEVELS.find(l=>l.key===analysis.suggestIntensity)?.label || analysis.suggestIntensity}</span></div>
                {analysis.crossLine && <div><span className="k">越界</span><span className="v danger-text">{analysis.crossLineType}</span></div>}
              </div>

              {/* 🆕 高级维度 */}
              <div className="analysis-metrics">
                <div className="metric-item">
                  <span className="metric-label">情绪强度</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{width: `${analysis.emotionIntensity}%`, background: analysis.emotionIntensity >= 70 ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#a855f7,#ec4899)"}} />
                    <span className="metric-value">{analysis.emotionIntensity}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <span className="metric-label">风险评分</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{width: `${analysis.riskScore}%`, background: analysis.riskScore >= 70 ? "linear-gradient(90deg,#ef4444,#dc2626)" : analysis.riskScore >= 40 ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#10b981,#059669)"}} />
                    <span className="metric-value">{analysis.riskScore}</span>
                  </div>
                </div>
              </div>

              {/* 🆕 阶段/消费力/难度 */}
              <div className="analysis-tags-row">
                <div className={`tag-pill stage-${analysis.interactStage}`}>
                  <span className="tag-icon">🎯</span>
                  <span className="tag-name">互动阶段</span>
                  <span className="tag-value">{analysis.interactStage}</span>
                </div>
                <div className={`tag-pill power-${analysis.spendingPower === '超高' ? 'top' : analysis.spendingPower === '高' ? 'high' : analysis.spendingPower === '低' ? 'low' : 'mid'}`}>
                  <span className="tag-icon">💎</span>
                  <span className="tag-name">消费力</span>
                  <span className="tag-value">{analysis.spendingPower}</span>
                </div>
                <div className={`tag-pill diff-${analysis.replyDifficulty === '高危' ? 'danger' : analysis.replyDifficulty === '困难' ? 'hard' : analysis.replyDifficulty === '简单' ? 'easy' : 'mid'}`}>
                  <span className="tag-icon">⚡</span>
                  <span className="tag-name">回复难度</span>
                  <span className="tag-value">{analysis.replyDifficulty}</span>
                </div>
              </div>

              {analysis.crossLine && (
                <div className="analysis-alert-box">
                  🚨 建议优先使用 ✅ 标记的性格卡，慎用 ⚠️ 标记的
                </div>
              )}
              {analysis.replyHints && analysis.replyHints.length > 0 && (
                <ul className="analysis-hints">
                  {analysis.replyHints.slice(0, 4).map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              )}
              <div className="analysis-actions">
                <button className="bulk-btn" onClick={handleSaveBrother} disabled={results.length === 0}>💾 存档案</button>
                <button className="bulk-btn primary" onClick={handleExport} disabled={results.length === 0}>📤 复制全部</button>
              </div>
            </div>
          )}

          {!isGenerating && results.length === 0 && !message.trim() && (
            <div className="empty-state"><div>💡 粘贴大哥消息，点生成按钮</div></div>
          )}
          {!isGenerating && results.length === 0 && message.trim() && (
            <div className="empty-state"><div>👆 点生成按钮</div></div>
          )}

          {!isGenerating && results.length > 0 && (
            <div className="bulk-actions">
              <button className="bulk-btn primary" onClick={handleCopyAll}>📋 一键复制全部（{results.length}条）</button>
            </div>
          )}

          {/* 回复卡片 */}
          <div className="bro-grid">
            {results.map((r, i) => (
              <div key={r.personality || i} className={"result-card bro-card " + (r.isCrossLineSafe === false ? "warn-card" : r.isCrossLineSafe && analysis?.crossLine ? "safe" : "")}>
                <div className="result-header">
                  <div className="result-personality">
                    {r.isCrossLineSafe === false && <span className="safe-flag warn">⚠️ 慎用</span>}
                    {r.isCrossLineSafe && analysis?.crossLine && <span className="safe-flag ok">✅ 推荐</span>}
                    <span className="personality-dot" />
                    {r.emoji} {r.label}
                  </div>
                  <div className="result-actions">
                    <button className="fav-btn" onClick={() => toggleFav(r)} title="收藏">
                      {favContains(r) ? "⭐" : "☆"}
                    </button>
                    <button className="regen-btn" onClick={() => handleRegenOne(r.personality)} title="换一条">🔄</button>
                    <button
                      className={`copy-btn ${copiedId === "r"+i ? "copied" : ""}`}
                      onClick={() => handleCopy(r.text, "r"+i)}
                    >{copiedId === "r"+i ? "✓" : "📋"}</button>
                  </div>
                </div>
                <div className="scenario-row-card">
                  <span className="scenario-badge">{r.scenario}</span>
                  <span className={"intensity-badge i-" + r.intensity}>
                    {INTENSITY_LEVELS.find(l => l.key === r.intensity)?.label || r.intensity}
                  </span>
                  {r.stance && (
                    <span className={`stance-badge stance-${r.stance}`} title="主播内心想法：对大哥请求的立场">
                      {r.stanceLabel}
                    </span>
                  )}
                </div>
                <div className="result-text">{r.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 历史区 */}
      {activeTab === TAB_HISTORY && (
        <div className="panel">
          {history.length > 0 && (
            <div className="panel-actions">
              <span className="panel-hint">最近 {history.length} 条</span>
              <button className="link-btn danger" onClick={clearHistory}>清空</button>
            </div>
          )}
          {history.length === 0 && <div className="empty-state"><div>🕘 还没有记录</div></div>}
          {history.map(h => (
            <details key={h.id} className="hist-item" open={history.indexOf(h) === 0}>
              <summary>
                <div className="hist-msg">{h.msg}</div>
                <div className="hist-meta">
                  {new Date(h.ts).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  <span className="sep">·</span>{h.items.length} 条
                </div>
              </summary>
              <div className="hist-body">
                {h.items.map((it, ii) => (
                  <div className="result-card" key={ii}>
                    <div className="result-header">
                      <div className="result-personality">
                        <span className="personality-dot" />{it.emoji} {it.label}
                      </div>
                      <div className="result-actions">
                        <button className="fav-btn" onClick={() => toggleFav({ ...it, sourceMsg: h.msg })}>
                          {favContains(it) ? "⭐" : "☆"}
                        </button>
                        <button className={`copy-btn ${copiedId === "h"+ii ? "copied" : ""}`}
                          onClick={() => handleCopy(it.text, "h"+ii)}>
                          {copiedId === "h"+ii ? "✓" : "📋"}
                        </button>
                      </div>
                    </div>
                    <span className="scenario-badge">{it.scenario}</span>
                    <div className="result-text">{it.text}</div>
                  </div>
                ))}
                <button className="regen-btn" onClick={() => {
                  setMessage(h.msg);
                  if (textareaRef.current) textareaRef.current.value = h.msg;
                  setResults(h.items.map((it, i) => ({ ...it, personality: "hist_"+i })));
                  setAnalysis(h.analysis || null);
                  setActiveTab(TAB_RESULT);
                }}>🔁 再生成</button>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* 收藏区 */}
      {activeTab === TAB_FAV && (
        <div className="panel">
          {fav.length > 0 && (
            <div className="panel-actions">
              <span className="panel-hint">{fav.length} 条收藏</span>
              <button className="link-btn danger" onClick={clearFav}>清空</button>
            </div>
          )}
          {fav.length === 0 && <div className="empty-state"><div>⭐ 点卡片 ☆ 收藏</div></div>}
          {fav.map(f => (
            <div key={f.id} className="result-card fav-card">
              <div className="result-header">
                <div className="result-personality"><span className="personality-dot" />{f.emoji} {f.label}</div>
                <div className="result-actions">
                  <button className="link-btn danger" onClick={() => removeFav(f.id)}>移除</button>
                  <button className={`copy-btn ${copiedId === "f"+f.id ? "copied" : ""}`}
                    onClick={() => handleCopy(f.text, "f"+f.id)}>
                    {copiedId === "f"+f.id ? "✓" : "📋"}
                  </button>
                </div>
              </div>
              {f.sourceMsg && <div className="fav-source">← {f.sourceMsg}</div>}
              <span className="scenario-badge">{f.scenario}</span>
              <div className="result-text">{f.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* 大哥档案 */}
      {activeTab === TAB_BROS && (
        <div className="panel bros-panel">
          {brothers.length > 0 && (
            <div className="panel-actions">
              <span className="panel-hint">{brothers.length}/200 条档案</span>
              <button className="link-btn danger" onClick={clearBrothers}>清空</button>
            </div>
          )}
          {brothers.length === 0 && <div className="empty-state"><div>📂 生成回复后点「💾 存档案」</div></div>}
          <div className="bros-list">
            {brothers.map(b => (
              <div key={b.id} className={"bro-row " + (broDetailId === b.id ? "open" : "")}>
                <div className="bro-row-head" onClick={() => setBroDetailId(broDetailId === b.id ? null : b.id)}>
                  <div className="bro-avatar">{(b.nickname || "哥").slice(0,1)}</div>
                  <div className="bro-main">
                    <div className="bro-name-row">
                      <span className="bro-nickname">{b.nickname || "未命名"}</span>
                      <span className="bro-type">{b.analysis?.brotherType || "—"}</span>
                      {b.analysis?.crossLine && <span className="bro-alert">⚠️</span>}
                    </div>
                    <div className="bro-quote">「{b.brotherMessage?.slice(0, 50)}{b.brotherMessage?.length > 50 ? "…" : ""}」</div>
                  </div>
                  <div className="bro-caret">{broDetailId === b.id ? "▲" : "▼"}</div>
                </div>
                {broDetailId === b.id && (
                  <div className="bro-detail">
                    <div className="bro-detail-actions">
                      <button className="regen-btn" onClick={() => handleBroRestore(b)}>🔁 重调</button>
                      <button className="copy-btn" onClick={() => handleCopy(exportBrotherRecord(b), "bro_ex_"+b.id)}>📤 复制</button>
                      <button className="link-btn danger" onClick={() => handleBroDelete(b.id)}>🗑 删除</button>
                    </div>
                    <div className="bro-grid">
                      {(b.replies || []).map((r, i) => (
                        <div key={r.personality || i} className={"result-card bro-card " + (r.isCrossLineSafe === false ? "warn-card" : "")}>
                          <div className="result-header">
                            <div className="result-personality"><span className="personality-dot" />{r.emoji} {r.label}</div>
                            <div className="result-actions">
                              <button className="fav-btn" onClick={() => toggleFav({ ...r, sourceMsg: b.brotherMessage })}>
                                {favContains({label:r.label, text:r.text}) ? "⭐" : "☆"}
                              </button>
                              <button className={`copy-btn ${copiedId === "br"+b.id+i ? "copied" : ""}`}
                                onClick={() => handleCopy(r.text, "br"+b.id+i)}>
                                {copiedId === "br"+b.id+i ? "✓" : "📋"}
                              </button>
                            </div>
                          </div>
                          <span className="scenario-badge">{r.scenario}</span>
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

      {/* 移动端吸底按钮 */}
      {docked && (
        <div className="docked-bar">
          <button className="generate-btn docked" onClick={() => handleGenerate()} disabled={isGenerating}>
            {isGenerating ? "生成中..." : "✨ 生成回复"}
          </button>
        </div>
      )}

      <footer className="footer">
        大哥维护神器 · {stats.templates.toLocaleString()}条模板 · {stats.scenarios}大场景 · {stats.personalities}种性格
      </footer>
    </div>
  );
}
