// 报价参考：用确定性规则计算，不让模型直接报价，避免编造价格。
// 数据来源：2026 年 11 月人工浏览小红书求助帖 + 闲鱼接单商品（见 docs/价格数据.md），样本有限，仅作参考。
// 注意：闲鱼挂价常为 1 元引流价，下面采用的是商品标题/价目表里写明的实际价格。

const RETOUCH = {
  natural: { label: "日常自然微调", low: 5, high: 20 },
  fine: { label: "明显精修 / 高 p", low: 10, high: 50 },
  heavy: { label: "大改 / 合成 / 换背景", low: 25, high: null },
};

// 学生 / 个人接单的常见价目（闲鱼多份价目表的中位区间）
const VIDEO_TIERS = [
  { maxSec: 30, low: 5, high: 20 },
  { maxSec: 60, low: 15, high: 20 },
  { maxSec: 120, low: 20, high: 30 },
  { maxSec: 300, low: 20, high: 50 },
  { maxSec: 600, low: 50, high: 100 },
];

export function estimatePrice(category, p = {}) {
  if (!p) return null;
  if (category === "retouch") {
    const tier = RETOUCH[p.level];
    const count = Number(p.count) || null;
    if (!tier) return null;
    const unit = tier.high ? `${tier.low}–${tier.high} 元/张` : `${tier.low} 元/张起，需与修图师协商`;
    const total = count && tier.high ? `${count} 张约 ${tier.low * count}–${tier.high * count} 元` : null;
    return {
      summary: total ?? unit,
      detail: [`${tier.label}：${unit}（个人 / 学生接单价）`, count ? `数量：${count} 张` : "数量：待确认"],
      source: "参考闲鱼修图商品（「10r 一张」「高 p 25 元一张」等）与小红书求助帖（「一张收费 50」「10 元精修」纠纷帖）",
    };
  }
  if (category === "video") {
    const sec = Number(p.duration_sec) || null;
    if (!sec) return null;
    const tier = VIDEO_TIERS.find((t) => sec <= t.maxSec);
    if (tier) {
      const detail = [`成片约 ${sec >= 60 ? `${Math.round(sec / 60)} 分钟` : `${sec} 秒`}：${tier.low}–${tier.high} 元（个人 / 学生接单价）`];
      if (p.urgent) detail.push("加急：多数卖家加价，幅度需协商");
      if (p.complex) detail.push("复杂特效 / AE：通常另计（如「AE 代做 10 块起」）");
      return {
        summary: `约 ${tier.low}–${tier.high} 元`,
        detail,
        source: "参考闲鱼剪辑接单价目表（如「30 秒内 5–20 块、1–5 分钟 20–50 块、5–10 分钟 50–100 块」）",
      };
    }
    return {
      summary: "超过 10 分钟，需与剪辑师协商（价格差异很大）",
      detail: [
        `成片约 ${Math.round(sec / 60)} 分钟`,
        "学生接单：5–10 分钟约 50–100 元，更长的需单独报价",
        "专业 / 商业：简单口播约 30 元/分钟；英文短视频约 200–300 元/条；企业年会视频整单约 1 万元",
      ],
      source: "参考闲鱼价目表与小红书求剪辑帖（TK 口播「30 每分钟」、Instagram「200–300r 一条」、年会「预算 1w」）",
    };
  }
  return null;
}
