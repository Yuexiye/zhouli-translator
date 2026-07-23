"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { XinsanguoCharacter, XinsanguoLevel } from "@/lib/xinsanguo-prompt";

const CHARACTERS = [
  {
    id: "caocao" as XinsanguoCharacter,
    title: "曹操",
    description: "不可能，绝对不可能",
    mark: "操",
    color: "#c2410c",
  },
  {
    id: "liubei" as XinsanguoCharacter,
    title: "刘备",
    description: "自刎归天",
    mark: "备",
    color: "#1d4ed8",
  },
  {
    id: "guanyu" as XinsanguoCharacter,
    title: "关羽",
    description: "哼，关某何惧",
    mark: "羽",
    color: "#15803d",
  },
  {
    id: "zhangfei" as XinsanguoCharacter,
    title: "张飞",
    description: "一万个透明窟窿",
    mark: "飞",
    color: "#7c3aed",
  },
  {
    id: "zhugeliang" as XinsanguoCharacter,
    title: "诸葛亮",
    description: "龙，可是帝王之征啊",
    mark: "亮",
    color: "#0369a1",
  },
  {
    id: "sima_yi" as XinsanguoCharacter,
    title: "司马懿",
    description: "不急，且看他如何收场",
    mark: "懿",
    color: "#475569",
  },
];

const LEVELS = [
  { id: "light" as XinsanguoLevel, title: "小礼", description: "一句到位" },
  { id: "standard" as XinsanguoLevel, title: "成礼", description: "完整展开" },
  { id: "grand" as XinsanguoLevel, title: "大礼", description: "层层崩坏" },
];

type ProviderId = "deepseek" | "openai_compatible" | "demo";

const PROVIDERS: Array<{ id: ProviderId; title: string; description: string }> = [
  { id: "deepseek", title: "DeepSeek", description: "使用 DeepSeek 官方接口" },
  { id: "openai_compatible", title: "OpenAI 兼容", description: "使用自定义接口" },
  { id: "demo", title: "本地演示", description: "不请求网络，直接出梗" },
];

const EXAMPLES = [
  "今天天气真好啊",
  "我明天要考试了",
  "这个月工资还没发",
  "你能不能帮我一个忙",
  "我失恋了",
];

const LOADING_LINES = [
  "正在列位诸公",
  "正在查阅新三国宇宙法则",
  "正在让角色自己演自己",
  "正在触发天意机制",
  "正在五秒崩",
];

function createClientId() {
  const cryptoObject = globalThis.crypto;
  if (typeof cryptoObject?.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }
  if (typeof cryptoObject?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }
  return [
    "xinsanguo",
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join("-");
}

function getClientId() {
  const storageKey = "xinsanguo-client-id";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
  } catch {
    // ignore
  }
  const created = createClientId();
  try {
    window.localStorage.setItem(storageKey, created);
  } catch {
    // ignore
  }
  return created;
}

async function writeClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // ignore
  }
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.left = "-9999px";
  helper.style.top = "0";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  helper.setSelectionRange(0, helper.value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  helper.remove();
  return copied;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function Home() {
  const [character, setCharacter] = useState<XinsanguoCharacter>("caocao");
  const [level, setLevel] = useState<XinsanguoLevel>("standard");
  const [provider, setProvider] = useState<ProviderId>("demo");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const selectedCharacter = useMemo(
    () => CHARACTERS.find((item) => item.id === character) ?? CHARACTERS[0],
    [character],
  );
  const selectedLevel = useMemo(
    () => LEVELS.find((item) => item.id === level) ?? LEVELS[1],
    [level],
  );
  const selectedProvider = useMemo(
    () => PROVIDERS.find((item) => item.id === provider) ?? PROVIDERS[2],
    [provider],
  );

  function syncInputText(value: string) {
    setText(value.slice(0, 300));
    setError("");
  }

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    let animationFrame = 0;
    const readNativeValue = () => {
      const value = element.value.slice(0, 300);
      setText(value);
      setError("");
    };
    const syncNativeValue = () => {
      readNativeValue();
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(readNativeValue);
    };
    element.addEventListener("input", syncNativeValue);
    element.addEventListener("change", syncNativeValue);
    return () => {
      element.removeEventListener("input", syncNativeValue);
      element.removeEventListener("change", syncNativeValue);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setLoadingIndex((index) => (index + 1) % LOADING_LINES.length);
    }, 1200);
    return () => window.clearInterval(interval);
  }, [loading]);

  async function translate() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setResult("");
    setCopied(false);

    const clientId = getClientId();

    try {
      const response = await fetchWithTimeout(
        "/api/xinsanguo",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-id": clientId,
          },
          body: JSON.stringify({
            text: trimmed,
            character,
            level,
            provider,
          }),
        },
        60_000,
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "礼官暂未回应，请稍后再试。");
        setLoading(false);
        return;
      }

      setResult(data.result || "");
      setIsDemo(Boolean(data.demo));
      setRemaining(data.remaining ?? null);
      setLoading(false);

      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err) {
      setError("礼官远行未归，请稍后再试。");
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    const success = await writeClipboard(result);
    setCopied(success);
    if (success) {
      await wait(1500);
      setCopied(false);
    }
  }

  return (
    <main className="xinsanguo-main">
      <section className="xinsanguo-hero">
        <div className="xinsanguo-hero-inner">
          <span className="xinsanguo-eyebrow">新三国体翻译器</span>
          <h1>
            新三国宇宙
            <br />
            台词翻译器
          </h1>
          <p>
            把现代中文扔进新三国的平行宇宙，让它自动获得失重感。
            <br />
            角色自己演自己，场景随时崩坏，5秒内必出梗。
          </p>
        </div>
      </section>

      <section className="xinsanguo-panels">
        <div className="translator-panel input-panel">
          <div className="panel-header">
            <span className="panel-label">白话入席</span>
            <span className="char-count">{text.length}/300</span>
          </div>

          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => syncInputText(event.target.value)}
            placeholder="在此写下你想说的话……"
            rows={6}
          />

          <div className="examples">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="example-chip"
                onClick={() => syncInputText(example)}
              >
                {example}
              </button>
            ))}
          </div>

          <div className="controls">
            <div className="provider-grid">
              {PROVIDERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`provider-button ${provider === item.id ? "active" : ""}`}
                  onClick={() => setProvider(item.id)}
                  title={item.description}
                >
                  <span className="provider-title">{item.title}</span>
                  <span className="provider-desc">{item.description}</span>
                </button>
              ))}
            </div>

            <div className="character-grid">
              {CHARACTERS.map((char) => (
                <button
                  key={char.id}
                  type="button"
                  className={`character-button ${character === char.id ? "active" : ""}`}
                  style={
                    character === char.id
                      ? { borderColor: char.color, backgroundColor: char.color + "18" }
                      : {}
                  }
                  onClick={() => setCharacter(char.id)}
                  title={char.description}
                >
                  <span className="character-mark" style={{ color: char.color }}>
                    {char.mark}
                  </span>
                  <span className="character-title">{char.title}</span>
                </button>
              ))}
            </div>

            <div className="level-selector">
              {LEVELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`level-button ${level === item.id ? "active" : ""}`}
                  onClick={() => setLevel(item.id)}
                  title={item.description}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}

          <button
            className="translate-button"
            type="button"
            disabled={!text.trim() || loading}
            onClick={translate}
          >
            <span className="button-decoration">◆</span>
            <span>
              {loading ? LOADING_LINES[loadingIndex] : "请周公制礼"}
            </span>
            {loading ? (
              <span className="loading-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <span className="button-arrow">→</span>
            )}
          </button>
        </div>

        <div
          className={`translator-panel result-panel ${result ? "has-result" : ""}`}
          ref={resultRef}
        >
          <div className="result-topline">
            <div>
              <span className="panel-label inverse">
                {selectedCharacter.title} · {selectedLevel.title}
              </span>
              <span className="result-style">
                {selectedCharacter.description}
              </span>
            </div>
            <span className="result-seal" aria-hidden="true">
              合礼
            </span>
          </div>

          {result ? (
            <>
              <div className="result-content">
                {result.split("\n").map((paragraph, index) =>
                  paragraph ? <p key={index}>{paragraph}</p> : <br key={index} />,
                )}
              </div>
              <div className="result-actions">
                <button type="button" onClick={copyResult}>
                  {copied ? "已录于简册" : "复制全文"}
                </button>
                <button type="button" onClick={translate}>
                  再议一次
                </button>
              </div>
              <div className="result-meta">
                <span>
                  {isDemo
                    ? "本地演示 · 切换 OpenAI 兼容并填写环境变量后启用大模型"
                    : provider === "openai_compatible"
                      ? "OpenAI 兼容接口已接"
                      : "DeepSeek 大儒已阅"}
                </span>
                {remaining !== null && (
                  <span>
                    近10分钟还可翻译 {remaining} 次
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="empty-result">
              <span className="empty-glyph">礼</span>
              <p>言未至，礼未成</p>
              <small>在左侧写下一句话，选择角色，再请周公制礼</small>
            </div>
          )}
        </div>
      </section>

      <section className="xinsanguo-footer">
        <p>
          本工具用于语言娱乐与文化创作，生成内容请自行判断与核实。
        </p>
        <p>
          灵感来自 2010 版电视剧《三国》及中文互联网「扭三」亚文化。
        </p>
      </section>
    </main>
  );
}
