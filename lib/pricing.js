// 报价参考：用确定性规则计算，不让模型直接报价，避免编造价格。
// 数据来源：2026 年 11 月人工浏览小红书求助帖 + 闲鱼接单商品（见 docs/价格数据.md），样本有限，仅作参考。
// 注意：闲鱼挂价常为 1 元引流价，下面采用的是商品标题/价目表里写明的实际价格。
// 英文模式下价格仍是中国个人接单市场的人民币价格（跨境订单由国内服务方承接的场景）。

const RETOUCH = {
  natural: { zh: "日常自然微调", en: "Light, natural touch-up", low: 5, high: 20 },
  fine: { zh: "明显精修 / 高 p", en: "Noticeable retouching", low: 10, high: 50 },
  heavy: { zh: "大改 / 合成 / 换背景", en: "Heavy edit / compositing / background swap", low: 25, high: null },
};

// 学生 / 个人接单的常见价目（闲鱼多份价目表的中位区间）
const VIDEO_TIERS = [
  { maxSec: 30, low: 5, high: 20 },
  { maxSec: 60, low: 15, high: 20 },
  { maxSec: 120, low: 20, high: 30 },
  { maxSec: 300, low: 20, high: 50 },
  { maxSec: 600, low: 50, high: 100 },
];

const TXT = {
  zh: {
    perPhoto: (l, h) => (h ? `${l}–${h} 元/张` : `${l} 元/张起，需与修图师协商`),
    total: (n, l, h) => `${n} 张约 ${l * n}–${h * n} 元`,
    tierNote: "（个人 / 学生接单价）",
    count: (n) => (n ? `数量：${n} 张` : "数量：待确认"),
    retouchSource: "参考闲鱼修图商品（「10r 一张」「高 p 25 元一张」等）与小红书求助帖（「一张收费 50」「10 元精修」纠纷帖）",
    length: (sec) => (sec >= 60 ? `${Math.round(sec / 60)} 分钟` : `${sec} 秒`),
    videoLine: (len, l, h) => `成片约 ${len}：${l}–${h} 元（个人 / 学生接单价）`,
    urgent: "加急：多数卖家加价，幅度需协商",
    complex: "复杂特效 / AE：通常另计（如「AE 代做 10 块起」）",
    range: (l, h) => `约 ${l}–${h} 元`,
    videoSource: "参考闲鱼剪辑接单价目表（如「30 秒内 5–20 块、1–5 分钟 20–50 块、5–10 分钟 50–100 块」）",
    longSummary: "超过 10 分钟，需与剪辑师协商（价格差异很大）",
    longDetail: (min) => [
      `成片约 ${min} 分钟`,
      "学生接单：5–10 分钟约 50–100 元，更长的需单独报价",
      "专业 / 商业：简单口播约 30 元/分钟；英文短视频约 200–300 元/条；企业年会视频整单约 1 万元",
    ],
    longSource: "参考闲鱼价目表与小红书求剪辑帖（TK 口播「30 每分钟」、Instagram「200–300r 一条」、年会「预算 1w」）",
  },
  en: {
    perPhoto: (l, h) => (h ? `CNY ${l}–${h} per photo` : `from CNY ${l} per photo, negotiate with the retoucher`),
    total: (n, l, h) => `${n} photos ≈ CNY ${l * n}–${h * n}`,
    tierNote: " (independent / student freelancers in China)",
    count: (n) => (n ? `Photos: ${n}` : "Photos: to confirm"),
    retouchSource: "China freelance market: Xianyu retouching listings (e.g. “CNY 10 per photo”, “heavy edits CNY 25 per photo”) and Xiaohongshu request posts",
    length: (sec) => (sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} s`),
    videoLine: (len, l, h) => `Final length ~${len}: CNY ${l}–${h} (independent / student freelancers in China)`,
    urgent: "Rush: most editors charge extra, negotiable",
    complex: "Complex effects / After Effects: usually priced separately",
    range: (l, h) => `≈ CNY ${l}–${h}`,
    videoSource: "China freelance market: Xianyu video-editing price lists (e.g. under 30 s CNY 5–20, 1–5 min CNY 20–50, 5–10 min CNY 50–100)",
    longSummary: "Over 10 minutes: negotiate with the editor (prices vary widely)",
    longDetail: (min) => [
      `Final length ~${min} min`,
      "Student freelancers: 5–10 min ≈ CNY 50–100; longer videos quoted separately",
      "Professional: simple talking-head ≈ CNY 30/min; English short-form for Instagram ≈ CNY 200–300 per video; corporate event video ≈ CNY 10,000",
    ],
    longSource: "Xianyu price lists and Xiaohongshu hiring posts (TikTok talking-head “CNY 30/min”, Instagram “CNY 200–300 per video”, corporate “CNY 10k budget”)",
  },
};

export function estimatePrice(category, p = {}, lang = "zh") {
  if (!p) return null;
  const t = TXT[lang] || TXT.zh;
  if (category === "retouch") {
    const tier = RETOUCH[p.level];
    const count = Number(p.count) || null;
    if (!tier) return null;
    const unit = t.perPhoto(tier.low, tier.high);
    const total = count && tier.high ? t.total(count, tier.low, tier.high) : null;
    return {
      summary: total ?? unit,
      detail: [`${tier[lang] || tier.zh}: ${unit}${t.tierNote}`, t.count(count)],
      source: t.retouchSource,
    };
  }
  if (category === "video") {
    const sec = Number(p.duration_sec) || null;
    if (!sec) return null;
    const tier = VIDEO_TIERS.find((x) => sec <= x.maxSec);
    if (tier) {
      const detail = [t.videoLine(t.length(sec), tier.low, tier.high)];
      if (p.urgent) detail.push(t.urgent);
      if (p.complex) detail.push(t.complex);
      return { summary: t.range(tier.low, tier.high), detail, source: t.videoSource };
    }
    return { summary: t.longSummary, detail: t.longDetail(Math.round(sec / 60)), source: t.longSource };
  }
  return null;
}
