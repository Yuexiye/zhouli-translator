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
  { id: "light" as XinsanguoLevel, title: "随口", description: "一句到位" },
  { id: "standard" as XinsanguoLevel, title: "铺陈", description: "完整展开" },
  { id: "grand" as XinsanguoLevel, title: "崩坏", description: "层层崩坏" },
];

type ProviderId = "deepseek" | "openai_compatible" | "demo";

const PROVIDERS: Array<{ id: ProviderId; title: string; description: string; mark: string }> = [
  { id: "deepseek", title: "DeepSeek", description: "使用 DeepSeek 官方接口", mark: "深" },
  { id: "openai_compatible", title: "OpenAI 兼容", description: "使用自定义接口", mark: "兼" },
  { id: "demo", title: "本地演示", description: "不请求网络，直接出梗", mark: "示" },
];

const MODELS = [
  { id: "DeepSeek-V4-Flash", title: "DeepSeek-V4-Flash", description: "默认 · 较快" },
  { id: "DeepSeek-V4-Pro", title: "DeepSeek-V4-Pro", description: "更强 · 较慢" },
  { id: "glm-5.2", title: "GLM-5.2", description: "智谱" },
  { id: "Kimi-K2.6", title: "Kimi-K2.6", description: "月之暗面" },
  { id: "MiniMax-M3", title: "MiniMax-M3", description: "MiniMax" },
  { id: "auto", title: "auto", description: "网关自动路由" },
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

const GITHUB_URL = "https://github.com/Yuexiye/zhouli-translator";

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

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function Home() {
  const [character, setCharacter] = useState<XinsanguoCharacter>("caocao");
  const [level, setLevel] = useState<XinsanguoLevel>("standard");
  const [provider, setProvider] = useState<ProviderId>("openai_compatible");
  const [model, setModel] = useState("DeepSeek-V4-Flash");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
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
            model,
          }),
        },
        150_000,
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "执笔官暂未回应，请稍后再试。");
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
      setError("执笔官远行未归，请稍后再试。");
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
    <main>
      <div className="page-noise" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="新三国台词翻译器首页">
          <span className="brand-seal">三</span>
          <span>
            <strong>新三国台词翻译器</strong>
            <small>XIN SAN GUO</small>
          </span>
        </a>
        <nav aria-label="页面导航">
          <a href="#translator">请角色开口</a>
        </nav>
        <span className="header-note">新三国宇宙 · 试行本</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span />
          把现代白话，译成角色台词
          <span />
        </div>
        <h1>
          把寻常的话
          <br />
          <em>说得像新三国</em>
        </h1>
        <p className="hero-copy">
          现代白话为骨，角色人设为法。
          <br />
          选一位人物，便把你的话翻成他的台词。
        </p>
        <a className="hero-cta" href="#translator">
          入席请角色开口
          <ArrowIcon />
        </a>
        <div className="hero-orbit orbit-one" aria-hidden="true">
          <span>曹</span>
        </div>
        <div className="hero-orbit orbit-two" aria-hidden="true">
          <span>亮</span>
        </div>
        <div className="hero-side-note left">角色自演</div>
        <div className="hero-side-note right">场景崩坏</div>
      </section>

      <section className="translator-section" id="translator">
        <div className="section-heading">
          <span className="section-number">
            <i>壹</i>
          </span>
          <div>
            <p>白话入戏，角色自演</p>
            <h2>现代白话，翻译成新三国台词</h2>
          </div>
        </div>

        <div className="translator-shell">
          <div className="translator-panel input-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-label">原言</span>
                <h3>你本来想说什么？</h3>
              </div>
              <span className={`character-count ${text.length > 280 ? "warning" : ""}`}>
                {text.length} / 300
              </span>
            </div>

            <div className="mode-grid" role="radiogroup" aria-label="选择角色">
              {CHARACTERS.map((char) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={character === char.id}
                  className={character === char.id ? "active" : ""}
                  key={char.id}
                  onClick={() => setCharacter(char.id)}
                  title={char.description}
                >
                  <span className="mode-mark" style={{ color: char.color, borderColor: char.color }}>
                    {char.mark}
                  </span>
                  <span>
                    <strong>{char.title}</strong>
                    <small>{char.description}</small>
                  </span>
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(event) => syncInputText(event.target.value)}
              placeholder="在此写下你想说的话……"
              rows={6}
              maxLength={300}
            />

            <div className="example-row">
              <span>不知说什么？</span>
              <div>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => syncInputText(example)}
                    title={example}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider">
              <span>择其篇幅</span>
            </div>

            <div className="level-field">
              <div>
                <span className="field-title">篇幅长短</span>
                <span className="field-help">由短评到长篇崩坏</span>
              </div>
              <div className="level-switch" role="radiogroup" aria-label="选择生成长度">
                {LEVELS.map((item) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={level === item.id}
                    className={level === item.id ? "active" : ""}
                    key={item.id}
                    onClick={() => setLevel(item.id)}
                    title={item.description}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider">
              <span>择其接口</span>
            </div>

            <div className="mode-grid" role="radiogroup" aria-label="选择接口">
              {PROVIDERS.map((item) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={provider === item.id}
                  className={provider === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setProvider(item.id)}
                  title={item.description}
                >
                  <span className="mode-mark">{item.mark}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </div>

            {provider !== "demo" && (
              <>
                <div className="divider">
                  <span>择其模型</span>
                </div>
                <div className="level-field">
                  <div>
                    <span className="field-title">选用模型</span>
                    <span className="field-help">切换不同大模型</span>
                  </div>
                  <select
                    className="model-select"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    aria-label="选择模型"
                  >
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} · {m.description}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {error && <p className="error-message">{error}</p>}

            <button
              className="translate-button"
              type="button"
              disabled={!text.trim() || loading}
              onClick={translate}
            >
              <span className="button-decoration">◆</span>
              <span>
                {loading ? LOADING_LINES[loadingIndex] : "请角色开口"}
              </span>
              {loading ? (
                <span className="loading-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <ArrowIcon />
              )}
            </button>
          </div>

          <div
            className={`translator-panel result-panel ${result ? "has-result" : ""}`}
            ref={resultRef}
          >
            <div className="result-topline">
              <div>
                <span className="panel-label inverse">成言</span>
                <span className="result-style">
                  {selectedCharacter.title} · {selectedLevel.title}
                </span>
              </div>
                <span className="result-seal" aria-hidden="true">
                入戏
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
                    {copied ? "已入戏本" : "复制全文"}
                  </button>
                  <button type="button" onClick={translate}>
                    再议一次
                  </button>
                </div>
                <div className="result-meta">
                  <span>
                    {isDemo
                      ? "本地演示 · 配置 API 后启用大模型"
                      : provider === "openai_compatible"
                        ? `OpenAI 兼容接口已接 · ${model}`
                        : "DeepSeek 已阅"}
                  </span>
                  {remaining !== null && (
                    <span>近10分钟还可翻译 {remaining} 次</span>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-result">
                <span className="empty-glyph">言</span>
                <p>言未至，译未成</p>
                <small>在左侧写下一句话，选择角色，再请角色开口</small>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-seal">三</span>
          <span>
            <strong>新三国台词翻译器</strong>
            <small>角色自演，场景崩坏</small>
          </span>
        </div>
        <div className="footer-note">
          <p>本工具用于语言娱乐与文化创作，生成内容请自行判断与核实。</p>
          <p>灵感来自 2010 版电视剧《三国》及中文互联网「扭三」亚文化。</p>
        </div>
        <div className="footer-right">
          <span>Yuexiye · 二〇二六</span>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            开源仓库
          </a>
        </div>
      </footer>
    </main>
  );
}
