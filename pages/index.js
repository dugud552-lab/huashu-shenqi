import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Head from "next/head";
import {
  generateReplies,
  generateOne,
  personalities,
  getStats,
  getScenarioList,
} from "../lib/generator";

const PERSONALITY_KEYS = Object.keys(personalities);

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
  const [docked, setDocked] = useState(false);    // 移动端键盘弹起 → 生成按钮吸底
  const [panelMode, setPanelMode] = useState("card"); // card(默认) | drawer

  const textareaRef = useRef(null);

  const stats = useMemo(() => getStats(), []);
  const scenarioList = useMemo(() => getScenarioList(), []);

  /* 初始化：主题 / 历史 / 收藏 */
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setTheme(savedTheme);
    setHistory(loadJSON("hh_history", []));
    setFav(loadJSON("hh_fav", []));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

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

      {/* 输入框 */}
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

      {/* Tabs：结果 / 历史 / 收藏 */}
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
      </div>

      {/* ===== 结果区 ===== */}
      {activeTab === TAB_RESULT && (
        <div className="results">
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

      {/* 移动端吸底生成按钮（键盘弹起时才出现） */}
      {docked && (
        <div className="docked-bar">
          <button
            className="generate-btn docked"
            onClick={handleGenerate}
            disabled={!message.trim() || selectedTags.length === 0 || isGenerating}
          >
            {isGenerating ? "生成中..." : "✨ 生成回复话术"}
          </button>
        </div>
      )}

      <footer className="footer">
        大哥维护神器 · 内置{stats.templates.toLocaleString()}
        条话术模板 · {stats.scenarios}大场景全覆盖 · {stats.personalities}种性格风格
      </footer>
    </div>
  );
}
