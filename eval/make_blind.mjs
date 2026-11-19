// 生成服务方盲测材料：真实帖子原话 vs. BriefAI 生成的需求单
// 用法（先 npm start）：node eval/make_blind.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chat } from "../lib/llm.js";
import { CATEGORIES } from "../lib/categories.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const API = "http://localhost:3000/api/chat";
const PICKS = [
  { category: "retouch", id: "R03" },
  { category: "retouch", id: "R09" },
  { category: "retouch", id: "R10" },
  { category: "video", id: "V01" },
  { category: "video", id: "V03" },
  { category: "video", id: "V04" },
];

const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));

async function simulate(request, profile, messages, catName) {
  const transcript = messages.map((m) => `${m.role === "user" ? "我" : "助手"}：${m.content}`).join("\n");
  const { content } = await chat({
    model: "qwen-max",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `你在扮演一个在小红书上发帖求${catName}的用户，正在和需求助手对话。你的帖子：「${request.text}」
你心里的完整需求：${JSON.stringify(profile)}
认真回答助手问的问题，不主动补充；画像里为 null 的就说没想好。口语化、简短。只输出你要说的话。`,
      },
      { role: "user", content: `对话记录：\n${transcript}\n\n你的下一句：` },
    ],
  });
  return content.trim();
}

function briefText(cat, r) {
  const lines = [];
  for (const f of cat.fields) if (r.brief[f.key]) lines.push(`- **${f.label}**：${r.brief[f.key]}`);
  if (r.styleTranslation?.length) {
    lines.push("", "**风格要求说明**");
    for (const s of r.styleTranslation) lines.push(`- 「${s.term}」→ ${s.spec}`);
  }
  return lines.join("\n");
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const outFile = path.join(ROOT, "results/blind_materials.json");
const existing = only && fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : [];
const out = [];
for (const pick of PICKS) {
  if (only && !only.includes(pick.id)) {
    const prev = existing.find((x) => x.pick.id === pick.id);
    if (prev) out.push(prev);
    continue;
  }
  const cat = CATEGORIES[pick.category];
  const req = load(`data/${pick.category}_requests.json`).find((x) => x.id === pick.id);
  const profile = load(pick.category === "retouch" ? "data/profiles.json" : `data/profiles_${pick.category}.json`)[pick.id];
  const messages = [{ role: "user", content: req.text }];
  let state = null, r;
  for (let turn = 1; turn <= 7; turn++) {
    r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, state, forceFinish: turn > 6 }),
    }).then((x) => x.json());
    messages.push({ role: "assistant", content: r.transcript || r.reply });
    state = { category: r.category, brief: r.brief, style_translation: r.styleTranslation, price_inputs: r.priceInputs };
    if (r.action !== "ask") break;
    messages.push({ role: "user", content: await simulate(req, profile, messages, cat.name) });
  }
  console.log(`${pick.id} ✓ ${r.action}`);
  out.push({ pick, req, brief: briefText(cat, r), messages });
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log("已保存 eval/results/blind_materials.json");
