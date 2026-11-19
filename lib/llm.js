// 调用阿里云百炼（OpenAI 兼容接口）
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export const ALLOWED_MODELS = ["qwen-plus", "qwen-max"];

export async function chat({ model, messages, json = false, temperature = 0.4, timeoutMs = 60000, retries = 1 }) {
  try {
    return await chatOnce({ model, messages, json, temperature, timeoutMs });
  } catch (e) {
    if (retries > 0) return chat({ model, messages, json, temperature, timeoutMs, retries: retries - 1 });
    throw e;
  }
}

async function chatOnce({ model, messages, json, temperature, timeoutMs }) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("缺少 DASHSCOPE_API_KEY 环境变量");

  const started = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    signal: AbortSignal.timeout(timeoutMs),
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `模型调用失败（HTTP ${res.status}）`);
  }
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage ?? null,
    latencyMs: Date.now() - started,
  };
}

// 解析模型返回的 JSON，失败时尝试截取第一个 {...}
export function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("模型返回的不是合法 JSON");
  }
}
