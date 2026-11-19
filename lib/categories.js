// 品类模板：新增品类只需在这里加一份配置
// 字段 core=true 表示「缺了就没法开工」的关键信息

export const CATEGORIES = {
  retouch: {
    name: "人像修图",
    emoji: "🖼️",
    fields: [
      { key: "photo_info", label: "照片数量与类型", core: true },
      { key: "purpose", label: "用途与发布场景", core: true },
      { key: "must_fix", label: "需要修的地方", core: true },
      { key: "intensity", label: "修图程度", core: true },
      { key: "style", label: "风格与色调", core: true },
      { key: "keep", label: "不能改动的地方", core: true },
      { key: "reference", label: "参考图", core: false },
      { key: "deadline", label: "截止时间", core: false },
      { key: "budget", label: "预算", core: false },
      { key: "revisions", label: "修改次数", core: false },
      { key: "acceptance", label: "验收标准", core: true },
    ],
    focus: `- 修图最常见的纠纷是「修得不像本人」和「精修的程度双方理解不同」（真实案例：「10 元精修，修成这样你收我 10？？？」）。
- 一定要问清：修图程度（自然微调 / 明显精修 / 大改合成），以及哪些地方不能动（如脸型、痣、发型、要像本人）。
- 「清透感」「氛围感」「自然感」「高级感」这类审美词必须翻译成可执行的要求（亮度、肤色、磨皮、饱和度、色调冷暖、对比度、液化幅度等）。
- 验收标准要具体，例如「家人一眼认得出是我」「皮肤保留纹理，不要磨成塑料感」。`,
    routing: `- "ai"：单张、自然微调、标准操作（祛痘、提亮、一键美颜、简单消除路人），用醒图、美图秀秀等工具即可自助完成。
- "hybrid"：先用 AI 工具一键处理，再由修图师针对「像本人」「质感」等细节精修。
- "human"：多张精修、商业写真、合成（加人/换背景）、对「像本人但更好看」有高要求，必须真人修图师。`,
  },
  video: {
    name: "视频剪辑",
    emoji: "🎬",
    fields: [
      { key: "footage", label: "素材情况", core: true },
      { key: "story", label: "叙事与内容重点", core: true },
      { key: "purpose", label: "用途与发布平台", core: true },
      { key: "duration", label: "成片时长与画幅", core: true },
      { key: "style", label: "风格与节奏", core: true },
      { key: "music_text", label: "BGM / 字幕 / 文案", core: true },
      { key: "cover", label: "封面", core: false },
      { key: "reference", label: "参考视频", core: false },
      { key: "deadline", label: "截止时间", core: true },
      { key: "budget", label: "预算", core: false },
      { key: "revisions", label: "修改次数", core: false },
      { key: "acceptance", label: "验收标准", core: false },
    ],
    focus: `- 剪辑师在接单前通常要求客户提供：全部原始素材、想要的风格、参考视频、BGM 与字幕文案、是否需要封面、交付时间（来自真实接单帖的「下单须知」）。
- 「卡点」「氛围感」「电影感」「Vlog 感」等风格词必须翻译成可执行的要求（剪辑节奏、转场方式、调色方向、字幕样式、音乐类型）。
- 问清素材是否齐全、横屏还是竖屏、成片时长，这直接决定报价。
- 很多人素材很杂（「拍了好多乱七八糟的」），要问清叙事与内容重点：想讲一个什么故事、哪些人或时刻必须剪进去、素材由谁筛选。
- 「故事感」「综艺感」「网感」「用心」「不要套模板」等也需要翻译；涉及英文素材或双语字幕时，记录在 BGM/字幕/文案字段。`,
    routing: `- "ai"：短视频、有现成模板可套（如剪映一键成片/模板卡点），用户愿意自己操作。
- "hybrid"：AI 工具粗剪、自动字幕，再由剪辑师调整节奏与调色。
- "human"：有脚本的微电影/作业、长视频、复杂特效或对质感要求高，必须真人剪辑师。`,
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export function fieldsOf(category) {
  return CATEGORIES[category]?.fields ?? [];
}
