import { chat, parseJson, ALLOWED_MODELS } from "@/lib/llm";
import { clarifySystemPrompt, MAX_TURNS } from "@/lib/prompts";
import { CATEGORIES, fieldsOf } from "@/lib/categories";
import { estimatePrice } from "@/lib/pricing";

// 请求：{ messages: [{role, content}], forceFinish, model, state }
// state 是上一轮返回的 { category, brief, style_translation, price_inputs }
export async function POST(req) {
  try {
    const { messages = [], forceFinish = false, model: reqModel, state = null } = await req.json();
    const model = ALLOWED_MODELS.includes(reqModel) ? reqModel : process.env.MODEL || "qwen-plus";
    const turn = messages.filter((m) => m.role === "user").length;

    const llmMessages = [
      { role: "system", content: clarifySystemPrompt({ turn, forceFinish, state }) },
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

    const category = CATEGORIES[parsed.category] ? parsed.category : null;
    let action = ["ask", "finish", "refuse", "unsupported"].includes(parsed.action) ? parsed.action : "ask";
    // 兜底：到达轮次上限或用户要求时强制结束（拒绝和未识别品类除外）
    if (category && action === "ask" && (forceFinish || turn >= MAX_TURNS)) action = "finish";

    // 只保留当前品类定义过的字段
    const brief = {};
    for (const f of fieldsOf(category)) brief[f.key] = parsed.brief?.[f.key] ?? null;

    const styleTranslation = Array.isArray(parsed.style_translation)
      ? parsed.style_translation.filter((s) => s?.term && s?.spec)
      : [];
    const priceInputs = parsed.price_inputs ?? null;
    const price = category ? estimatePrice(category, priceInputs) : null;

    return Response.json({
      action,
      category,
      reply: parsed.reply || "",
      options: action === "ask" && Array.isArray(parsed.options) ? parsed.options.slice(0, 4) : [],
      brief,
      styleTranslation,
      priceInputs,
      price,
      routing: action === "finish" ? parsed.routing ?? null : null,
      meta: { model, turn, latencyMs: result.latencyMs, usage: result.usage },
    });
  } catch (e) {
    return Response.json({ error: e.message || "服务出错了" }, { status: 500 });
  }
}
