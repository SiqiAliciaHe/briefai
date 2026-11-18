import { chat, ALLOWED_MODELS } from "@/lib/llm";
import { draftSystemPrompt } from "@/lib/prompts";

export async function POST(req) {
  try {
    const { brief, model: reqModel } = await req.json();
    const model = ALLOWED_MODELS.includes(reqModel) ? reqModel : process.env.MODEL || "qwen-plus";
    const result = await chat({
      model,
      temperature: 0.8,
      messages: [
        { role: "system", content: draftSystemPrompt() },
        { role: "user", content: `需求单：\n${JSON.stringify(brief, null, 2)}` },
      ],
    });
    return Response.json({
      draft: result.content,
      meta: { model, latencyMs: result.latencyMs, usage: result.usage },
    });
  } catch (e) {
    return Response.json({ error: e.message || "服务出错了" }, { status: 500 });
  }
}
