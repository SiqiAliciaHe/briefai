// 汇总多次评测运行：均值 + 范围
// 用法：node eval/summarize.mjs --category retouch --files a.json,b.json,c.json
//   或：node eval/summarize.mjs --category retouch --last 3
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "../lib/categories.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const CATEGORY = args.category || "retouch";
const CAT = CATEGORIES[CATEGORY];
const dir = path.join(ROOT, "results");

let files;
if (args.files) files = args.files.split(",").map((f) => path.join(dir, path.basename(f)));
else {
  // 修图早期的结果文件名里没有品类
  const match = (f) => f.endsWith(".json") && (f.includes(`-${CATEGORY}-`) || (CATEGORY === "retouch" && !/-(retouch|video)-/.test(f)));
  files = fs.readdirSync(dir).filter(match).sort().slice(-(Number(args.last) || 3)).map((f) => path.join(dir, f));
}

const runs = files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const fieldRecall = (run, k) => {
  let hit = 0, tot = 0;
  for (const x of run.results.filter((r) => !r.error)) {
    const v = x.scores.recall?.[k];
    if (!x.profile[k] || !v) continue;
    tot++; hit += v.label === "hit" ? 1 : v.label === "partial" ? 0.5 : 0;
  }
  return tot ? hit / tot : null;
};

const metrics = [
  ["编造率", (r) => r.agg.fabricationRate],
  ["添油加醋率", (r) => r.agg.embellishRate],
  ["关键信息召回率", (r) => r.agg.recall],
  ...CAT.fields.filter((f) => f.core).map((f) => [`  召回：${f.label}`, (r) => fieldRecall(r, f.key)]),
];

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const out = [`${CAT.name}：${runs.length} 次运行（${files.map((f) => path.basename(f).slice(11, 19)).join("、")}）`, "", "| 指标 | 均值 | 范围 |", "|---|---|---|"];
const summary = {};
for (const [name, f] of metrics) {
  const xs = runs.map(f).filter((x) => x != null);
  summary[name.trim()] = { mean: mean(xs), min: Math.min(...xs), max: Math.max(...xs) };
  out.push(`| ${name} | ${pct(mean(xs))} | ${pct(Math.min(...xs))}–${pct(Math.max(...xs))} |`);
}
const lat = mean(runs.map((r) => r.agg.avgLatencyMs)) / 1000;
const tok = mean(runs.map((r) => r.agg.avgTokensPerCase));
out.push(`| 单轮延迟 / 每单 tokens | ${lat.toFixed(1)} 秒 / ${Math.round(tok)} | — |`);
if (runs[0].boundary?.length) out.push(`| 边界用例通过 | ${runs.map((r) => `${r.agg.boundaryPass}/${r.agg.boundaryTotal}`).join("、")} | — |`);
const flagged = runs.map((r) => r.agg.flaggedShareOfFabrication).filter((x) => x != null);
if (flagged.length) out.push(`| 编造字段中已标「待确认」的比例 | ${pct(mean(flagged))} | — |`);
const pend = runs.map((r) => r.agg.pendingFieldRate).filter((x) => x != null);
if (pend.length) out.push(`| 标为「待确认」的字段占比 | ${pct(mean(pend))} | — |`);
out.push(`| 正常需求被误拒 | ${runs.map((r) => r.agg.wronglyRefused ?? 0).join("、")} | — |`);
console.log(out.join("\n"));
if (args.json) fs.writeFileSync(args.json, JSON.stringify(summary, null, 2));
