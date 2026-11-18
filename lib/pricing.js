// 报价参考：用确定性规则计算，不让模型直接报价，避免编造价格。
// 数据来源：2026 年 11 月人工浏览小红书的真实帖子（见 docs/决策记录.md D3、D4），样本很少，仅作参考。

const RETOUCH = {
  natural: { label: "自然微调", low: 10, high: 20 },
  fine: { label: "明显精修", low: 20, high: 50 },
  heavy: { label: "大改/合成", low: 50, high: null },
};

// 某视频代剪接单帖的价目表（偏低价，学生接单）
const VIDEO_TIERS = [
  { maxSec: 15, price: 3.5 },
  { maxSec: 30, price: 5 },
  { maxSec: 60, price: 8 },
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
      detail: [`${tier.label}：${unit}`, count ? `数量：${count} 张` : "数量：待确认"],
      source: "参考小红书真实帖子：「10 元精修」纠纷帖、「一张收费 50」找修图师帖、「别人收 50+，我只收 20+」",
    };
  }
  if (category === "video") {
    const sec = Number(p.duration_sec) || null;
    if (!sec) return null;
    const detail = [];
    let base = null;
    const tier = VIDEO_TIERS.find((t) => sec <= t.maxSec);
    if (tier) {
      base = tier.price;
      detail.push(`成片 ${sec} 秒：${tier.price} 元（≤${tier.maxSec} 秒档）`);
      if (p.urgent) { base += 2; detail.push("加急：+2 元"); }
      if (p.complex) { base += 1; detail.push("复杂特效：+1 元"); }
      detail.push("含 2 次修改，超出后每次小改 +0.5 元");
      return {
        summary: `约 ${base} 元起（低价学生接单参考）`,
        detail,
        source: "参考小红书某「视频代剪」接单帖的价目表；不同剪辑师价格差异很大",
      };
    }
    return {
      summary: "超过 1 分钟，需与剪辑师按分钟协商",
      detail: [`成片约 ${Math.round(sec / 60)} 分钟`, "市场价格从低价学生接单到约 200 元/分钟不等"],
      source: "参考小红书「200¥ 一分钟的剪辑是什么样子的」等帖子",
    };
  }
  return null;
}
