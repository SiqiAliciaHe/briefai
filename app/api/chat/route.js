import { chat, parseJson, ALLOWED_MODELS } from "@/lib/llm";
import { clarifySystemPrompt, BRIEF_FIELDS, MAX_TURNS } from "@/lib/prompts";

// messages: [{ role: "user" | "assistant", content: string }]
export async function POST(req) {
  try {
    const { messages = [], forceFinish = false, model: reqModel, brief: prevBrief = null } = await req.json();
    const model = ALLOWED_MODELS.includes(reqModel) ? reqModel : process.env.MODEL || "qwen-plus";
    const turn = messages.filter((m) => m.role === "user").length;

    const llmMessages = [
      { role: "system", content: clarifySystemPrompt({ turn, forceFinish, brief: prevBrief }) },
      ...messages,
      ...(forceFinish ? [{ role: "user", content: "先这样吧，直接帮我生成需求单。" }] : []),
    ];

    let result, parsed, lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await chat({ model, messages: llmMessages, json: true });
        parsed = parseJson(result.content);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!parsed) throw lastErr;

    // 兜底：保证字段齐全；到达轮次上限时强制结束
    const brief = {};
    for (const f of BRIEF_FIELDS) brief[f.key] = parsed.brief?.[f.key] ?? null;
    let action = parsed.action === "finish" ? "finish" : "ask";
    if ((forceFinish || turn >= MAX_TURNS) && action !== "finish") action = "finish";

    return Response.json({
      action,
      reply: parsed.reply || "",
      options: Array.isArray(parsed.options) ? parsed.options.slice(0, 4) : [],
      brief,
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      routing: action === "finish" ? parsed.routing ?? null : null,
      meta: { model, turn, latencyMs: result.latencyMs, usage: result.usage },
    });
  } catch (e) {
    return Response.json({ error: e.message || "服务出错了" }, { status: 500 });
  }
}
