import { NextRequest, NextResponse } from "next/server";
import {
  buildUserPrompt,
  buildSystemPrompt,
  buildDemoResult,
  type XinsanguoLevel,
  type XinsanguoFaithfulness,
} from "@/lib/xinsanguo-prompt";

export const runtime = "nodejs";

const VALID_LEVELS = new Set<XinsanguoLevel>(["light", "standard", "grand"]);

function normalizeFaithfulness(value: unknown): XinsanguoFaithfulness {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// 强度越高越"贴近原剧台词"（更稳重、少发挥）→ 低温；越低越放飞 → 高温。
function faithfulnessToTemperature(faithfulness: XinsanguoFaithfulness): number {
  const clamped = Math.max(0, Math.min(100, faithfulness));
  const temp = 1.0 - (clamped / 100) * 0.7;
  return Number(temp.toFixed(2));
}

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_WINDOW_LIMIT = 12;
const RATE_DAY_LIMIT = 60;

type RateRecord = {
  windowStartedAt: number;
  count: number;
  day: string;
  dayCount: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  xinsanguoRateLimit?: Map<string, RateRecord>;
};

const rateLimit = globalForRateLimit.xinsanguoRateLimit ?? new Map();
globalForRateLimit.xinsanguoRateLimit = rateLimit;

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  const clientId = request.headers.get("x-client-id") || "anonymous";
  return `${ip}:${clientId.slice(0, 80)}`;
}

function getShanghaiDay(now: number) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function secondsUntilNextShanghaiDay(now: number) {
  const shanghaiNow = new Date(now + 8 * 60 * 60 * 1000);
  const nextShanghaiMidnightUtc =
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() + 1,
    ) -
    8 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((nextShanghaiMidnightUtc - now) / 1000));
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const today = getShanghaiDay(now);
  const current = rateLimit.get(key);

  if (!current || current.day !== today) {
    rateLimit.set(key, {
      windowStartedAt: now,
      count: 1,
      day: today,
      dayCount: 1,
    });
    return {
      allowed: true,
      remaining: Math.min(RATE_WINDOW_LIMIT - 1, RATE_DAY_LIMIT - 1),
      windowRemaining: RATE_WINDOW_LIMIT - 1,
      dailyRemaining: RATE_DAY_LIMIT - 1,
      retryAfterSeconds: 0,
    };
  }

  if (now - current.windowStartedAt > RATE_WINDOW_MS) {
    current.windowStartedAt = now;
    current.count = 0;
  }

  const dailyRemainingBefore = Math.max(0, RATE_DAY_LIMIT - current.dayCount);
  const windowRemainingBefore = Math.max(0, RATE_WINDOW_LIMIT - current.count);

  if (current.dayCount >= RATE_DAY_LIMIT) {
    return {
      allowed: false,
      reason: "day" as const,
      remaining: 0,
      windowRemaining: windowRemainingBefore,
      dailyRemaining: 0,
      retryAfterSeconds: secondsUntilNextShanghaiDay(now),
    };
  }

  if (current.count >= RATE_WINDOW_LIMIT) {
    return {
      allowed: false,
      reason: "window" as const,
      remaining: 0,
      windowRemaining: 0,
      dailyRemaining: dailyRemainingBefore,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.windowStartedAt + RATE_WINDOW_MS - now) / 1000),
      ),
    };
  }

  current.count += 1;
  current.dayCount += 1;
  rateLimit.set(key, current);
  const dailyRemaining = Math.max(0, RATE_DAY_LIMIT - current.dayCount);
  const windowRemaining = Math.max(0, RATE_WINDOW_LIMIT - current.count);
  return {
    allowed: true,
    remaining: Math.min(dailyRemaining, windowRemaining),
    windowRemaining,
    dailyRemaining,
    retryAfterSeconds: 0,
  };
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
) {
  const retryDelays = [800];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(150_000),
      });

      if (response.ok || response.status < 500 || attempt >= retryDelays.length) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= retryDelays.length) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
  }

  throw lastError;
}

function resolveProvider(
  requested: "deepseek" | "openai_compatible" | "demo" | undefined,
  requestedModel?: string,
) {
  if (requested === "openai_compatible") {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY?.trim();

    if (!baseUrl || !apiKey) {
      return {
        provider: "demo" as const,
        reason: "missing_openai_compatible_env" as const,
      };
    }

    const model = requestedModel?.trim() || process.env.OPENAI_COMPATIBLE_MODEL?.trim();
    if (!model) {
      return {
        provider: "demo" as const,
        reason: "missing_openai_compatible_model" as const,
      };
    }

    return {
      provider: "openai_compatible" as const,
      baseUrl,
      apiKey,
      model,
    };
  }

  if (requested === "demo") {
    return { provider: "demo" as const };
  }

  const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepSeekKey) {
    const model =
      requestedModel?.trim() ||
      process.env.DEEPSEEK_MODEL?.trim() ||
      "deepseek-v4-flash";
    return {
      provider: "deepseek" as const,
      apiKey: deepSeekKey,
      model,
    };
  }

  return { provider: "demo" as const };
}

function cleanGeneratedText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.、]\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  let body: {
    text?: unknown;
    level?: unknown;
    faithfulness?: unknown;
    provider?: unknown;
    model?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "无话可译，请先写下一句。" },
      { status: 400 },
    );
  }

  const requestedProvider = (
    body.provider === "openai_compatible" || body.provider === "demo"
      ? body.provider
      : "deepseek"
  ) as "deepseek" | "openai_compatible" | "demo";
  const requestedModel =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : undefined;
  const provider = resolveProvider(requestedProvider, requestedModel);
  const level = VALID_LEVELS.has(body.level as XinsanguoLevel)
    ? (body.level as XinsanguoLevel)
    : "standard";
  const faithfulness = normalizeFaithfulness(body.faithfulness);
  const key = getClientKey(request);
  const rate = checkRateLimit(key);

  if (!rate.allowed) {
    const isWindowLimit = rate.reason === "window";
    return NextResponse.json(
      {
        error: isWindowLimit
          ? `翻译太急，请约 ${Math.ceil(rate.retryAfterSeconds / 60)} 分钟后再来。`
          : `今日翻译已满，请明日再来。`,
        remaining: rate.remaining,
        windowRemaining: rate.windowRemaining,
        dailyRemaining: rate.dailyRemaining,
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json(
      { error: "无话可译，请先写下一句。" },
      { status: 400 },
    );
  }

  if (text.length > 300) {
    return NextResponse.json(
      { error: "言多则意繁，请将原话控制在300字以内。" },
      { status: 400 },
    );
  }

  if (provider.provider === "demo") {
    return NextResponse.json({
      result: buildDemoResult(text, level, faithfulness),
      model: provider.reason === "missing_openai_compatible_env" ? "本地演示" : "本地演示",
      demo: true,
      remaining: rate.remaining,
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const maxTokens = level === "grand" ? 1500 : 1200;
    const requestBody: Record<string, unknown> = {
      model: provider.model,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(level, faithfulness),
        },
        {
          role: "user",
          content: buildUserPrompt(text),
        },
      ],
      max_tokens: maxTokens,
      temperature: faithfulnessToTemperature(faithfulness),
      stream: false,
    };
    // 禁用思考链：DeepSeek 与多数 vLLM/New API 类兼容网关的 reasoning 模型需要此字段，
    // 否则正文常为空（token 全花在 reasoning 上），导致翻译结果为空被长度校验拦截。
    if (provider.provider === "deepseek" || provider.provider === "openai_compatible") {
      requestBody.thinking = { type: "disabled" };
    }

    let response: Response;
    if (provider.provider === "deepseek") {
      response = await fetchWithRetry(
        "https://api.deepseek.com/chat/completions",
        {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        requestBody,
      );
    } else {
      // OpenAI 兼容网关标准路径为 /v1/chat/completions（如 New API 类网关）。
      // 归一化 baseUrl：去掉尾部斜杠与多余的 /v1，统一补 /v1，避免拼成 /chat/completions 而 404。
      const normalizedBase = provider.baseUrl
        .replace(/\/+$/, "")
        .replace(/\/v1$/, "");
      response = await fetchWithRetry(
        `${normalizedBase}/v1/chat/completions`,
        {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        requestBody,
      );
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(
        provider.provider === "deepseek" ? "DeepSeek API error:" : "OpenAI compatible API error:",
        data,
      );
      return NextResponse.json(
        { error: "执笔官暂未回应，请稍后再试。" },
        { status: 502 },
      );
    }

    const generatedText =
      data?.choices?.[0]?.message?.content?.trim() || "";
    const cleanedResult = cleanGeneratedText(generatedText);

    if (!cleanedResult || cleanedResult.length < 20) {
      return NextResponse.json(
        { error: "此言尚未成译，请再试一次。" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result: cleanedResult,
      model: provider.provider === "deepseek" ? provider.model : provider.model,
      demo: false,
      remaining: rate.remaining,
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  } catch (error) {
    console.error("Translate request failed:", error);
    return NextResponse.json(
      { error: "执笔官远行未归，请稍后再试。" },
      { status: 502 },
    );
  }
}
