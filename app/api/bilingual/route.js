// Vercel 函数最长运行时间（秒）
export const maxDuration = 60;

import { chat, parseJson, ALLOWED_MODELS } from "@/lib/llm";
import { CATEGORIES, fieldsOf } from "@/lib/categories";

// 跨境双语需求单：海外客户用英文说清的需求 → 给国内修图师 / 剪辑师的中文需求单
// 重点不是逐字翻译，而是把英文里的审美 / 文化表达翻译成国内服务方能执行的要求。
export async function POST(req) {
  try {
    const { category, brief, styleTranslation = [], routing = null, model: reqModel } = await req.json();
    const cat = CATEGORIES[category];
    if (!cat) return Response.json({ error: "Unknown category" }, { status: 400 });
    const model = ALLOWED_MODELS.includes(reqModel) ? reqModel : process.env.MODEL || "qwen-plus";
    const fields = fieldsOf(category);

    const result = await chat({
      model,
      json: true,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `你在帮国内的${cat.name}服务方承接海外客户的订单。下面是客户用英文确认过的需求单，请生成给国内服务方看的中文版本。
要求：
1. brief_zh：逐字段翻译成自然、口语化的中文，意思必须忠实，不增不减；原文为空的字段保持 null；原文标了「to confirm」的，中文标「（待确认）」。
2. style_notes：对英文里的审美 / 风格 / 网络用语（如 clean girl aesthetic、soft glam、cinematic、vlog vibe），给出：
   - term：英文原词
   - meaning：在海外语境下通常指什么（具体、可执行）
   - cn_equivalent：国内大致对应的说法（没有就写「无直接对应」）
3. culture_tips：最多 3 条国内服务方容易误解的地方，必须和这份需求单直接相关（例如海外客户通常不希望明显美白、磨皮；保留雀斑；英文字幕注意语法）。没有就输出空数组。不要泛泛而谈。
只输出 JSON：{"brief_zh": {${fields.map((f) => `"${f.key}": 字符串或 null`).join(", ")}}, "style_notes": [{"term": "", "meaning": "", "cn_equivalent": ""}], "culture_tips": [""]}`,
        },
        {
          role: "user",
          content: `需求单（英文）：${JSON.stringify(brief)}\n风格说明（英文）：${JSON.stringify(styleTranslation)}\nAI 分单建议：${JSON.stringify(routing)}`,
        },
      ],
    });
    const parsed = parseJson(result.content);
    const briefZh = {};
    for (const f of fields) briefZh[f.key] = parsed.brief_zh?.[f.key] ?? null;
    return Response.json({
      briefZh,
      styleNotes: Array.isArray(parsed.style_notes) ? parsed.style_notes.filter((s) => s?.term) : [],
      cultureTips: Array.isArray(parsed.culture_tips) ? parsed.culture_tips.filter(Boolean).slice(0, 3) : [],
      meta: { model, latencyMs: result.latencyMs, usage: result.usage },
    });
  } catch (e) {
    return Response.json({ error: e.message || "服务出错了" }, { status: 500 });
  }
}
