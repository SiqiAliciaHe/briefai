// Vercel 函数最长运行时间（秒）：模型单次调用约 10–15 秒，默认上限可能不够
export const maxDuration = 60;

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
    for (const f of fieldsOf(category)) {
      const v = parsed.brief?.[f.key];
      // 模型偶尔会输出数组，统一成字符串
      brief[f.key] = Array.isArray(v) ? v.join("、") : v ?? null;
    }
    // 来源标注：AI 提议、用户未确认的内容，在需求单上明确标出「待确认」
    const unconfirmed = Array.isArray(parsed.unconfirmed) ? parsed.unconfirmed : [];
    // 代码校验：内容在用户原话里能找到的，说明是用户自己说的，不标「待确认」（模型自标常把用户原话误标）
    const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
    const saidByUser = (v) => {
      const core = String(v).replace(/（[^）]*）|\([^)]*\)/g, "").trim();
      return core.length > 0 && userText.includes(core);
    };
    for (const k of unconfirmed) {
      if (brief[k] && !/待确认/.test(brief[k]) && !saidByUser(brief[k])) brief[k] = `${brief[k]}（待确认）`;
    }

    // 快速选择题：只允许事实型字段，最多 3 个
    const FORM_BLOCKED = ["style", "acceptance", "keep", "story"];
    const quickForm =
      action === "ask" && Array.isArray(parsed.quick_form)
        ? parsed.quick_form
            .filter((q) => q?.field && q?.question && Array.isArray(q.options) && q.options.length && !FORM_BLOCKED.includes(q.field) && !brief[q.field])
            .slice(0, 3)
            .map((q) => ({
              field: q.field,
              question: String(q.question).replace(/[（(]可多选[）)]/g, "").trim(),
              options: q.options.slice(0, 5),
              // 「需要修的地方」这类天然可多选的字段，强制允许多选
              multi: q.multi === true || ["must_fix", "music_text"].includes(q.field),
            }))
        : [];
    const styleTranslation = Array.isArray(parsed.style_translation)
      ? parsed.style_translation.filter((s) => s?.term && s?.spec)
      : [];
    // 主问题的选项。兜底：模型有时把选项写成回复里的列表（✅ / 1. / A.），而 options 为空，
    // 用户就看不到可点的选项。这时从回复里提取列表作为选项，并从显示文字中去掉。
    let reply = parsed.reply || "";
    let extracted = false;
    let options = action === "ask" && Array.isArray(parsed.options) ? parsed.options.slice(0, 5) : [];
    const LIST_ITEM = /^\s*(?:✅|☑️|✔️|•|·|-|\*|[0-9]{1,2}[.、)）]|[①-⑨]|[A-Da-d][.、)）])\s*(.+)$/;
    if (action === "ask" && options.length === 0) {
      const items = reply.split("\n").map((l) => l.match(LIST_ITEM)?.[1]?.trim()).filter((x) => x && x.length <= 60);
      if (items.length >= 2) {
        options = items.slice(0, 5);
        extracted = true;
        reply = reply.split("\n").filter((l) => !LIST_ITEM.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
      }
    }
    const optionsField = typeof parsed.options_field === "string" ? parsed.options_field : null;
    const priceInputs = parsed.price_inputs ?? null;
    const price = category ? estimatePrice(category, priceInputs) : null;

    return Response.json({
      action,
      category,
      reply,
      options,
      optionsField,
      // 主问题选项是否可多选：模型判断，或者问的是天然可多选的字段
      optionsMulti:
        parsed.options_multi === true || extracted || ["must_fix", "keep", "acceptance", "music_text"].includes(optionsField),
      quickForm,
      // 写入对话历史的助手发言：主问题 + 快速选择题，保证下一轮模型（和评测里的模拟用户）都能看到
      transcript: quickForm.length
        ? `${parsed.reply}\n（顺便快速选一下：${quickForm.map((q) => `${q.question}${q.multi ? "（可多选）" : ""}【${q.options.join(" / ")}】`).join("；")}）`
        : parsed.reply || "",
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
