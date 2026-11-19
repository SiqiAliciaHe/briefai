import { chat, ALLOWED_MODELS } from "@/lib/llm";
import { CATEGORIES } from "@/lib/categories";

// AI 自助操作指引：把需求单翻译成在常见 App 里自己动手的步骤
const TOOLS = {
  retouch: "醒图或美图秀秀",
  video: "剪映",
};

export async function POST(req) {
  try {
    const { category, brief, styleTranslation = [], model: reqModel } = await req.json();
    const cat = CATEGORIES[category];
    if (!cat) return Response.json({ error: "未知品类" }, { status: 400 });
    const model = ALLOWED_MODELS.includes(reqModel) ? reqModel : process.env.MODEL || "qwen-plus";

    const result = await chat({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `你是耐心的${cat.name}老师。用户的需求比较简单，可以用${TOOLS[category]}自己完成。请根据需求单，写一份新手也能照着做的操作指引。
要求：
- 5–8 步，每步一行，格式「步骤序号. 做什么 → 调整方向和程度」。
- 重点写「调到什么程度」，并与需求单里的风格要求、不能改动的地方保持一致（例如「磨皮保持轻度，保留皮肤纹理」「不要使用瘦脸/液化」）。
- App 的具体菜单名称可能随版本变化：只写常见的功能名（如「美颜」「祛痘」「调色」「智能字幕」「卡点」），不要编造具体的菜单路径或精确参数值。
- 最后加一行「做完后自查：」，列 2–3 条对照需求单的检查项。
- 不要寒暄，直接输出步骤，纯文本，不用 Markdown 符号。`,
        },
        {
          role: "user",
          content: `需求单：${JSON.stringify(brief)}\n风格要求说明：${JSON.stringify(styleTranslation)}`,
        },
      ],
    });
    return Response.json({ tool: TOOLS[category], guide: result.content.trim(), meta: { model, latencyMs: result.latencyMs } });
  } catch (e) {
    return Response.json({ error: e.message || "服务出错了" }, { status: 500 });
  }
}
