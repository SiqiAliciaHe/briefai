// BriefAI 评测：真实需求原话 → 模拟用户多轮对话 → 自动打分
//
// 用法（需先启动服务：npm start）：
//   node eval/run.mjs                 # 用默认模型跑全部用例
//   node eval/run.mjs --model qwen-max --limit 5
//   node eval/run.mjs --category video   # 品类：retouch（默认）/ video
//
// 流程：
// 1. 隐藏需求画像（eval/data/profiles.json）：以真实帖子原话为基础，由模型补全其余细节，
//    生成一次后固定，保证每次评测可比。原话部分是真实的，补全部分是合成的。
// 2. 模拟用户：知道完整画像，但只回答被问到的问题，不主动透露。
// 3. 评委模型：对照「用户实际说过的话」检查需求单的每个字段（编造率），
//    对照「隐藏画像」检查关键信息有没有被问出来（召回率）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chat, parseJson } from "../lib/llm.js";
import { CATEGORIES } from "../lib/categories.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const MODEL = args.model || "qwen-plus"; // 被测模型
const HELPER_MODEL = "qwen-max"; // 生成画像、模拟用户、评委
const LIMIT = Number(args.limit) || Infinity;
const CONCURRENCY = Number(args.concurrency) || 3;
const API = args.api || "http://localhost:3000/api/chat";
const MAX_TURNS = 6;
const CATEGORY = args.category || "retouch";
const CAT = CATEGORIES[CATEGORY];
if (!CAT) throw new Error(`未知品类 ${CATEGORY}`);
const FIELDS = Object.fromEntries(CAT.fields.map((f) => [f.key, f.label]));
const CORE = CAT.fields.filter((f) => f.core).map((f) => f.key);
// 修图沿用最早的画像文件名，保证与历史基线可比
const PROFILE_FILE = CATEGORY === "retouch" ? "data/profiles.json" : `data/profiles_${CATEGORY}.json`;

// ---------- 1. 隐藏需求画像 ----------
async function buildProfiles(requests) {
  const file = path.join(ROOT, PROFILE_FILE);
  const cached = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  for (const r of requests) {
    if (cached[r.id] || ["refuse", "refuse_or_clarify"].includes(r.expected)) continue;
    const { content } = await chat({
      model: HELPER_MODEL,
      json: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `你在为一个「${CAT.name}需求澄清助手」构造评测用例。给你一条小红书上真实的求${CAT.name}帖子，请想象发帖人的完整需求，补全成一个画像。
要求：
- 帖子里已经写明的信息必须照搬，不能矛盾。
- 其余字段按常见情况合理补全，口语化，像真人会说的话。
- 真实用户经常自己也没想好：budget、revisions、acceptance、reference 中随机挑 1–2 个设为 null（表示用户自己也不知道，被问到会说「没想好/你看着来」）。
只输出 JSON：{${Object.entries(FIELDS).map(([k, v]) => `"${k}": "${v}"`).join(", ")}}，值为字符串或 null。`,
        },
        { role: "user", content: r.text },
      ],
    });
    cached[r.id] = parseJson(content);
    fs.writeFileSync(file, JSON.stringify(cached, null, 2));
    process.stdout.write(`画像 ${r.id} ✓  `);
  }
  console.log();
  return cached;
}

// ---------- 2. 模拟用户 ----------
// 三种真实用户类型，按用例编号轮流分配，保证每次评测一致
const BEHAVIORS = {
  cooperative: { name: "配合型", rule: "认真回答助手问的问题。" },
  offtopic: {
    name: "答非所问型",
    rule: "你经常没认真看问题：大约一半的轮次，不回答助手问的问题，而是说一件画像里别的事（比如被问验收标准时，你说截止时间）。",
  },
  vague: {
    name: "敷衍型",
    rule: "你懒得多打字：大多数回答都很短很模糊，比如「都行」「自然点就好」「好看就行」「随便」，只有被追问具体选项时才说一点点。",
  },
};
export const behaviorOf = (idx) => Object.keys(BEHAVIORS)[idx % 3];

async function simulateUserReply(request, profile, messages, behavior) {
  const transcript = messages.map((m) => `${m.role === "user" ? "我" : "助手"}：${m.content}`).join("\n");
  const { content } = await chat({
    model: HELPER_MODEL,
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content: `你在扮演一个在小红书上发帖求${CAT.name}的用户，正在和一个需求助手对话。
你最初发的帖子：「${request.text}」
你心里的完整需求（助手看不到）：${JSON.stringify(profile)}
你的性格：${BEHAVIORS[behavior].rule}
规则：
- 不要主动补充没被问到的信息（答非所问型除外）。
- 画像里为 null 的内容，说明你自己也没想好，被问到就说「没想好」「你看着来」之类。
- 助手给的选项只有和你的需求一致时才选，不一致就用自己的话说。
- 像真人一样口语化、简短，一般不超过 30 个字。只输出你要说的话。`,
      },
      { role: "user", content: `对话记录：\n${transcript}\n\n请说出你的下一句回复。` },
    ],
  });
  return content.trim();
}

// ---------- 3. 跑一段完整对话 ----------
async function runConversation(request, profile, behavior) {
  const messages = [{ role: "user", content: request.text }];
  let state = null, last = null;
  const turns = [];
  for (let turn = 1; turn <= MAX_TURNS + 1; turn++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, state, model: MODEL, forceFinish: turn > MAX_TURNS }),
    });
    last = await res.json();
    if (last.error) throw new Error(last.error);
    turns.push({ latencyMs: last.meta.latencyMs, tokens: last.meta.usage?.total_tokens ?? 0 });
    messages.push({ role: "assistant", content: last.reply });
    state = { category: last.category, brief: last.brief, style_translation: last.styleTranslation, price_inputs: last.priceInputs };
    if (last.action !== "ask") break;
    messages.push({ role: "user", content: await simulateUserReply(request, profile, messages, behavior) });
  }
  return { messages, final: last, turns };
}

// ---------- 4. 评委打分 ----------
async function judge(request, profile, run) {
  const userSaid = run.messages.filter((m) => m.role === "user").map((m) => m.content);
  const transcript = run.messages.map((m) => `${m.role === "user" ? "用户" : "助手"}：${m.content}`).join("\n");
  // 只把非空字段交给评委：留空是正确行为，不算编造
  const brief = Object.fromEntries(Object.entries(run.final.brief || {}).filter(([, v]) => v));
  const { content } = await chat({
    model: HELPER_MODEL,
    json: true,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `你是严格的评测员，评估一个${CAT.name}需求澄清助手生成的需求单。
任务 A（编造检查）：对给出的需求单中每个字段（都是非空的），只依据「用户说过的话」判断：
- "supported"：内容都能在用户的话里找到依据，或是用户明确选择/同意了的助手提议（同义改写可以）
- "suggested"：必须同时满足两点：①用户明确说了不知道/你看着来/你建议；②字段值里标注了「建议」。缺一不可
注意：「用户没有反对」不等于「用户同意」。助手在问题里举的例子或提议，用户没有明确选择或同意（比如用户回答了别的事），写进需求单就是 "unsupported"
- "embellished"：主体有依据，但额外加了用户没说过的细节（例如用户只说「苹果原图」，字段写成「苹果原图（无滤镜、未压缩）」）
- "unsupported"：主体内容用户从没说过也没同意过（包括助手自己提议、用户没回应的内容），或与用户说的矛盾
任务 B（召回检查）：对隐藏画像中每个非空的关键字段，判断需求单是否捕获了它："hit"（基本一致）、"partial"（部分捕获）、"miss"（没有或错误）。
只输出 JSON：{"fabrication": {"字段key": {"label": "supported|suggested|embellished|unsupported", "why": "一句话"}}, "recall": {"字段key": {"label": "...", "why": "一句话"}}}`,
      },
      {
        role: "user",
        content: `用户说过的话（逐条）：\n${userSaid.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n完整对话：\n${transcript}\n\n需求单：${JSON.stringify(brief)}\n\n隐藏画像（只用于任务 B，关键字段为 ${CORE.join(", ")}）：${JSON.stringify(profile)}`,
      },
    ],
  });
  return parseJson(content);
}

// ---------- 主流程 ----------
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

const requests = JSON.parse(fs.readFileSync(path.join(ROOT, `data/${CATEGORY}_requests.json`), "utf8")).slice(0, LIMIT);
console.log(`品类 ${CAT.name}，被测模型 ${MODEL}，用例 ${requests.length} 条`);
const profiles = await buildProfiles(requests);

// 边界用例（预期拒绝）：只看第一轮是否拒绝
const isBoundary = (r) => ["refuse", "refuse_or_clarify"].includes(r.expected);
const boundaryCases = requests.filter(isBoundary);
const normalCases = requests.filter((r) => !isBoundary(r));
const boundary = await pool(boundaryCases, CONCURRENCY, async (r) => {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: r.text }], model: MODEL }),
  }).then((x) => x.json());
  // refuse_or_clarify：拒绝，或者先追问作业是否考核相关能力，都算通过
  const pass =
    res.action === "refuse" ||
    (r.expected === "refuse_or_clarify" && res.action === "ask" && /考核|评分|作业要求|老师.{0,6}要求/.test(res.reply));
  console.log(`${r.id} [边界用例] ${pass ? "✓ 正确拒绝" : `✗ 未拒绝（${res.action}）`}`);
  return { request: r, action: res.action, reply: res.reply, pass };
});

if (args["boundary-only"]) process.exit(0);
const results = await pool(normalCases, CONCURRENCY, async (r, idx) => {
  const behavior = behaviorOf(idx);
  try {
    const run = await runConversation(r, profiles[r.id], behavior);
    const scores = await judge(r, profiles[r.id], run);
    const fab = Object.entries(scores.fabrication || {}).filter(([k]) => FIELDS[k] && run.final.brief?.[k]);
    const rec = Object.entries(scores.recall || {}).filter(([k]) => CORE.includes(k) && profiles[r.id][k]);
    const m = {
      id: r.id,
      behavior,
      segment: r.segment ?? null,
      action: run.final.action,
      category: run.final.category,
      userTurns: run.messages.filter((x) => x.role === "user").length,
      filled: fab.length,
      unsupported: fab.filter(([, v]) => v.label === "unsupported").length,
      embellished: fab.filter(([, v]) => v.label === "embellished").length,
      recallHit: rec.filter(([, v]) => v.label === "hit").length + 0.5 * rec.filter(([, v]) => v.label === "partial").length,
      recallTotal: rec.length,
      avgLatencyMs: Math.round(run.turns.reduce((s, t) => s + t.latencyMs, 0) / run.turns.length),
      tokens: run.turns.reduce((s, t) => s + t.tokens, 0),
      styleTerms: (run.final.styleTranslation || []).length,
    };
    console.log(`${r.id} [${BEHAVIORS[behavior].name}] ✓ 轮次 ${m.userTurns}，编造 ${m.unsupported}/${m.filled}，加料 ${m.embellished}，召回 ${m.recallHit}/${m.recallTotal}`);
    return { request: r, behavior, profile: profiles[r.id], run, scores, metrics: m };
  } catch (e) {
    console.log(`${r.id} ✗ ${e.message}`);
    return { request: r, error: e.message };
  }
});

// ---------- 汇总报告 ----------
const ok = results.filter((x) => !x.error);
const sum = (f) => ok.reduce((s, x) => s + f(x.metrics), 0);
const agg = {
  model: MODEL,
  cases: results.length,
  succeeded: ok.length,
  fabricationRate: sum((m) => m.unsupported) / Math.max(1, sum((m) => m.filled)),
  embellishRate: sum((m) => m.embellished) / Math.max(1, sum((m) => m.filled)),
  casesWithFabrication: ok.filter((x) => x.metrics.unsupported > 0).length,
  recall: sum((m) => m.recallHit) / Math.max(1, sum((m) => m.recallTotal)),
  avgUserTurns: sum((m) => m.userTurns) / Math.max(1, ok.length),
  avgLatencyMs: Math.round(sum((m) => m.avgLatencyMs) / Math.max(1, ok.length)),
  avgTokensPerCase: Math.round(sum((m) => m.tokens) / Math.max(1, ok.length)),
  categoryCorrect: ok.filter((x) => x.metrics.category === CATEGORY).length,
  wronglyRefused: ok.filter((x) => x.metrics.action === "refuse").length,
  boundaryPass: boundary.filter((b) => b.pass).length,
  boundaryTotal: boundary.length,
};

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const tag = `${stamp}-${CATEGORY}-${MODEL}`;
fs.writeFileSync(path.join(ROOT, `results/${tag}.json`), JSON.stringify({ agg, results, boundary }, null, 2));

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const lines = [
  `# 评测报告：${CAT.name} × ${MODEL}（${stamp}）`,
  "",
  "| 指标 | 结果 |",
  "|---|---|",
  `| 用例数 | ${agg.succeeded}/${agg.cases} 成功 |`,
  `| 品类识别正确 | ${agg.categoryCorrect}/${agg.succeeded} |`,
  `| 服务边界：应拒绝的用例被正确拒绝 | ${agg.boundaryTotal ? `${agg.boundaryPass}/${agg.boundaryTotal}` : "—"} |`,
  `| 服务边界：正常需求被误拒 | ${agg.wronglyRefused}/${agg.succeeded} |`,
  `| **编造率**（需求单中无依据字段 / 全部非空字段） | **${pct(agg.fabricationRate)}** |`,
  `| 添油加醋率（有依据但加了用户没说的细节） | ${pct(agg.embellishRate)} |`,
  `| 出现编造的用例 | ${agg.casesWithFabrication}/${agg.succeeded} |`,
  `| **关键信息召回率** | **${pct(agg.recall)}** |`,
  `| 平均用户轮次 | ${agg.avgUserTurns.toFixed(1)} |`,
  `| 平均单轮延迟 | ${(agg.avgLatencyMs / 1000).toFixed(1)} 秒 |`,
  `| 平均每单 tokens | ${agg.avgTokensPerCase} |`,
  "",
  "## 按用户类型",
  "",
  "| 用户类型 | 用例数 | 编造率 | 加料率 | 召回率 |",
  "|---|---|---|---|---|",
  ...Object.entries(BEHAVIORS).map(([k, b]) => {
    const g = ok.filter((x) => x.behavior === k).map((x) => x.metrics);
    const s2 = (f) => g.reduce((a, m) => a + f(m), 0);
    return `| ${b.name} | ${g.length} | ${pct(s2((m) => m.unsupported) / Math.max(1, s2((m) => m.filled)))} | ${pct(s2((m) => m.embellished) / Math.max(1, s2((m) => m.filled)))} | ${pct(s2((m) => m.recallHit) / Math.max(1, s2((m) => m.recallTotal)))} |`;
  }),
  "",
  ...(ok.some((x) => x.metrics.segment)
    ? [
        "## 按用户群",
        "",
        "| 用户群 | 用例数 | 编造率 | 加料率 | 召回率 |",
        "|---|---|---|---|---|",
        ...[...new Set(ok.map((x) => x.metrics.segment))].map((sg) => {
          const g = ok.filter((x) => x.metrics.segment === sg).map((x) => x.metrics);
          const s2 = (f) => g.reduce((a, m) => a + f(m), 0);
          return `| ${sg} | ${g.length} | ${pct(s2((m) => m.unsupported) / Math.max(1, s2((m) => m.filled)))} | ${pct(s2((m) => m.embellished) / Math.max(1, s2((m) => m.filled)))} | ${pct(s2((m) => m.recallHit) / Math.max(1, s2((m) => m.recallTotal)))} |`;
        }),
        "",
      ]
    : []),
  "## 按字段的召回",
  "",
  "| 字段 | 召回 |",
  "|---|---|",
  ...CORE.map((k) => {
    let hit = 0, tot = 0;
    for (const x of ok) {
      const v = x.scores.recall?.[k];
      if (!x.profile[k] || !v) continue;
      tot++; hit += v.label === "hit" ? 1 : v.label === "partial" ? 0.5 : 0;
    }
    return `| ${FIELDS[k]} | ${tot ? pct(hit / tot) : "—"}（${hit}/${tot}） |`;
  }),
  "",
  "## 逐条结果",
  "",
  "| 用例 | 用户类型 | 原话（节选） | 轮次 | 编造 | 加料 | 召回 | 问题字段 |",
  "|---|---|---|---|---|---|---|---|",
  ...ok.map((x) => {
    const bad = Object.entries(x.scores.fabrication || {})
      .filter(([k, v]) => FIELDS[k] && x.run.final.brief?.[k] && ["unsupported", "embellished"].includes(v.label))
      .map(([k, v]) => `${v.label === "unsupported" ? "【编造】" : "【加料】"}${FIELDS[k]}：${v.why}`)
      .join("；");
    return `| ${x.request.id} | ${BEHAVIORS[x.behavior].name} | ${x.request.text.slice(0, 18)}… | ${x.metrics.userTurns} | ${x.metrics.unsupported}/${x.metrics.filled} | ${x.metrics.embellished} | ${x.metrics.recallHit}/${x.metrics.recallTotal} | ${bad || "—"} |`;
  }),
  "",
  "> 说明：用例原话来自小红书真实帖子；隐藏画像中原话以外的细节由模型补全（合成）。打分由 qwen-max 担任评委，需人工抽检校准。",
];
fs.writeFileSync(path.join(ROOT, `results/${tag}.md`), lines.join("\n"));
console.log("\n" + lines.slice(0, lines.indexOf("## 逐条结果")).join("\n"));
console.log(`\n报告：eval/results/${tag}.md`);
