import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { generateReplies, personalities } from "../lib/generator";

const PERSONALITY_KEYS = Object.keys(personalities);

export default function Home() {
  const [message, setMessage] = useState("");
  const [selectedTags, setSelectedTags] = useState(["gentle", "lively"]);
  const [results, setResults] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [copiedId, setCopiedId] = useState(null);

  const textareaRef = useRef(null);
  // 中文输入法（IME）组合状态：拼音未上屏时不更新 state，避免打断输入
  const isComposingRef = useRef(false);

  // 初始化主题
  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("theme");
    if (saved) {
      setTheme(saved);
    }
  }, []);

  // 应用主题
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const toggleTag = (key) => {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleGenerate = () => {
    if (!message.trim() || selectedTags.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setResults([]);

    // 模拟思考延迟
    setTimeout(() => {
      const replies = generateReplies(message, selectedTags);
      setResults(replies);
      setIsGenerating(false);
    }, 400);
  };

  // 复制到剪贴板
  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // 降级方案
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        // ignore
      }
      document.body.removeChild(textarea);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 打字机效果组件
  const TypewriterText = ({ text, startDelay }) => {
    const [displayText, setDisplayText] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
      let index = 0;
      setDisplayText("");
      setIsTyping(true);
      let timer;

      const startTyping = setTimeout(() => {
        timer = setInterval(() => {
          if (index < text.length) {
            setDisplayText(text.slice(0, index + 1));
            index++;
          } else {
            clearInterval(timer);
            setIsTyping(false);
          }
        }, 30);
      }, startDelay);

      return () => {
        clearTimeout(startTyping);
        clearInterval(timer);
      };
    }, [text, startDelay]);

    return (
      <div className="result-text">
        {displayText}
        {isTyping && <span className="cursor" />}
      </div>
    );
  };

  return (
    <div className="container">
      <Head>
        <title>大哥维护话术神器 - 私聊高情商回复生成器</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
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
          value={message}
          onChange={(e) => {
            // 中文输入法组合期间（拼音未上屏）不更新 state，避免打断输入
            if (isComposingRef.current) return;
            setMessage(e.target.value);
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            setMessage(e.target.value);
          }}
          placeholder="在这里粘贴大哥发来的私聊消息...&#10;例如：在吗想你了 / 给你转了点心意收一下 / 今天加班好累 / 发张照片看看"
          maxLength={500}
        />
      </div>

      {/* 性格标签 */}
      <div className="section-label">🎭 选择回复性格（可多选）</div>
      <div className="tags">
        {PERSONALITY_KEYS.map((key) => (
          <button
            key={key}
            className={`tag ${selectedTags.includes(key) ? "active" : ""}`}
            onClick={() => toggleTag(key)}
          >
            {personalities[key].emoji} {personalities[key].label}
          </button>
        ))}
      </div>

      {/* 生成按钮 */}
      <button
        className="generate-btn"
        onClick={handleGenerate}
        disabled={!message.trim() || selectedTags.length === 0 || isGenerating}
      >
        {isGenerating ? "正在生成回复中..." : "✨ 生成回复话术"}
      </button>

      {/* 结果展示 */}
      <div className="results">
        {isGenerating && (
          <div className="empty-state">
            <div>⏳ AI正在为你生成话术...</div>
          </div>
        )}

        {!isGenerating && results.length === 0 && message.trim() && (
          <div className="empty-state">
            <div>👆 点击上方按钮生成回复</div>
          </div>
        )}

        {!isGenerating && results.length === 0 && !message.trim() && (
          <div className="empty-state">
            <div>💡 先输入消息内容，再点击生成</div>
          </div>
        )}

        {results.map((result, index) => (
          <div key={index} className="result-card">
            <div className="result-header">
              <div className="result-personality">
                <span className="personality-dot" />
                {result.emoji} {result.label}
              </div>
              <button
                className={`copy-btn ${
                  copiedId === index ? "copied" : ""
                }`}
                onClick={() => handleCopy(result.text, index)}
              >
                {copiedId === index ? "已复制 ✓" : "📋 复制"}
              </button>
            </div>
            <div className="scenario-badge">场景：{result.scenario}</div>
            <TypewriterText
              text={result.text}
              startDelay={index * 150}
            />
          </div>
        ))}
      </div>

      <footer className="footer">
        大哥维护神器 · 内置832条话术模板 · 17大场景全覆盖 · 8种性格风格
      </footer>
    </div>
  );
}
