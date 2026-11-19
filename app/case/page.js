import Link from "next/link";

export const metadata = {
  title: "BriefAI 项目介绍",
  description: "从市场验证到评测迭代：一个面向修图、剪辑需求的 AI 需求澄清产品",
};

const VALIDATION = [
  ["商业文案", "求助帖几乎消失，被通用 AI 吸收；剩下的「代写」多为学术代写", "不做；学术代写设为拒绝边界"],
  ["简单海报", "找真人设计的需求很少；但「跟 AI 聊了 3 天才做好」获 771 赞", "瓶颈从「谁来做」变成「说清楚」"],
  ["logo / PPT", "需求仍多且愿意付高价；「拒绝 AI 一键生成」成为卖点", "市场分化：低端归 AI，追求设计感的归真人"],
  ["人像修图", "需求活跃、愿意付费；「10 元精修，修成这样你收我 10？」", "首发品类"],
  ["视频剪辑", "卖家自写「下单须知」：市场已自发长出需求单", "首发品类"],
  ["家教 / 约拍等", "难被 AI 取代，但痛点是匹配与信任，AI 只能辅助", "不纳入"],
];

const INSIGHTS = [
  ["7/15", "修图需求用否定句表达", "「不要太网红 p」「不要高 p」：用户更清楚自己不要什么"],
  ["5/15", "自己修过或用工具试过，仍不满意", "工具已普及，瓶颈在「说清楚、对上审美」"],
  ["8 vs 7", "剪辑：个人用户 vs 商家 / 博主", "个人说不清要什么；商家自己会写需求，痛点是招人"],
  ["满意再付", "闲鱼卖家的主要竞争手段", "预期不一致的风险目前由卖家承担，需求单正是要降低它"],
];

const RESULTS = [
  ["关键信息召回率", "67.4%", "73.9%", "58.4%", "67.7%"],
  ["编造率", "4.0%", "1.1%", "1.3%", "1.7%"],
  ["风格召回", "33.3%", "57.8%", "60.3%", "70.8%"],
  ["验收标准召回", "22.1%", "47.8%", "—", "—"],
  ["叙事与内容重点召回", "—", "—", "37.2%", "65.8%"],
  ["截止时间召回", "—", "—", "28.6%", "81.6%"],
];

const LESSONS = [
  ["提问优先级是零和的", "6 轮限制下，调整提问顺序只是在字段之间转移召回率（风格升、其他降，总召回持平）。真正提高总召回的是「快速选择题」：提高每轮信息密度。"],
  ["让模型自己标「未确认」不可靠", "被评委判为编造的字段，只有约 11% 被模型自己标出。改为代码校验：内容来自用户原话的不标；更像 AI 自己提议的标「待确认」；用户跳过确认时不写入。"],
  ["评委本身也要被评测", "评测体系改了 5 次：评委把留空判为编造、漏判添油加醋、把「没反对」当「同意」、模拟用户太配合、单次运行波动太大。都是靠人工看对话发现的。"],
  ["新功能会带来新的编造方式", "加入快速选择题后，AI 开始按「行业惯例」默认填「修改 2 次」（13 条里 7 条），逐条看评测结果才发现。"],
  ["真实试用发现了模拟评测测不出的问题", "选项不能多选、用户原话被误标「待确认」、风格选项本身也很抽象、回复里列了选项却点不了……共 9 个，均已修复。"],
  ["用文字解释审美有上限", "真实帖子里，用户靠「例图」「样片」「参考博主」对齐审美。下一步：参考图优先。"],
];

export default function CasePage() {
  return (
    <div className="case">
      <header className="case-hero">
        <div className="case-wrap">
          <div className="case-top">
            <div className="logo">Brief<span>AI</span> 需求助手 · 项目介绍</div>
            <Link className="header-link" href="/en/case">English</Link>
          </div>
          <h1>把「修得好看点」「剪得有氛围感」，变成服务方能照着做、能照着验收的需求单</h1>
          <p className="case-lead">
            面向人像修图、视频剪辑的 AI 需求澄清产品：多轮追问 → 结构化需求单 → 审美词翻译 → 规则报价 → AI 分单（AI 工具自助 / AI + 真人 / 交给真人）。
            从市场验证、用户数据到评测迭代，全部过程可追溯。
          </p>
          <div className="case-actions">
            <Link className="btn" href="/">体验 Demo →</Link>
            <a className="btn ghost" href="https://github.com/SiqiAliciaHe/briefai" target="_blank" rel="noreferrer">GitHub（文档与评测代码）</a>
          </div>
        </div>
      </header>

      <main className="case-wrap">
        <section>
          <h2>1. 背景：一份过时的商业计划书</h2>
          <p>
            2022 年我联合创办了校园技能交易平台「交我活」（联合创始人，负责运营），当时最大的效率损耗是：需求方说不清要什么，导致反复沟通、返工和纠纷。
            2026 年回头看，AI 已经吃掉了这个平台瞄准的「低价、简单」的活儿。于是我重新提出问题：<b>AI 时代，AI 应该切进这条交易链路的哪个环节？</b>
          </p>
        </section>

        <section>
          <h2>2. 市场验证：7 类需求，人工浏览小红书与闲鱼</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>品类</th><th>观察</th><th>决策</th></tr></thead>
              <tbody>{VALIDATION.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="note">结论：AI 能做好的部分，人工需求已消失；剩下的是主观、难描述的视觉服务。核心瓶颈都是「需求方说不清，双方预期对不上」。</p>
        </section>

        <section>
          <h2>3. 用户洞察：30 条真实需求原话（修图、剪辑各 15 条）</h2>
          <div className="stat-grid">
            {INSIGHTS.map(([n, t, d]) => (
              <div className="stat" key={t}>
                <div className="stat-n">{n}</div>
                <div className="stat-t">{t}</div>
                <div className="stat-d">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>4. 产品</h2>
          <div className="shots">
            <figure>
              <img src="/case/1-clarify.png" alt="追问：主问题 + 快速选择题" />
              <figcaption>追问：每轮一个主问题 + 最多 3 个快速选择题（可多选），风格先要参考、选项说人话</figcaption>
            </figure>
            <figure>
              <img src="/case/2-brief.png" alt="需求单、风格翻译、报价与 AI 分单" />
              <figcaption>需求单：审美词翻译、规则报价（模型只抽参数，不直接报价）、AI 分单；未经用户确认的内容不会写入</figcaption>
            </figure>
            <figure>
              <img src="/case/3-refuse.png" alt="服务边界" />
              <figcaption>服务边界：拒绝 AI 换脸、造谣、学术代写；考核剪辑能力的课程作业改为提供学习帮助</figcaption>
            </figure>
          </div>
        </section>

        <section>
          <h2>出海延伸：数据里的早期信号</h2>
          <ul>
            <li>15 条剪辑需求中有 3 条和海外有关：海外博主招英文访谈剪辑、Instagram 英文视频<b>一条 200–300 元</b>（约为国内学生接单价的 10 倍）、TikTok 口播剪辑。</li>
            <li>跨境订单里，双方之间不只是「说不清」，还隔着<b>语言和审美文化</b>：「clean girl aesthetic」「cinematic」国内剪辑师未必理解。产品已支持英文界面和<b>中英双语需求单</b>：海外客户用英文说清需求，国内服务方拿到中文版，附审美词解释和跨文化提示。</li>
            <li><b>尚未验证</b>：下一步收集 Reddit（r/PhotoshopRequest、r/forhire）上的英文真实需求，用同一套评测验证海外用户是否有同样的规律。</li>
          </ul>
        </section>

        <section>
          <h2>5. 评测方法</h2>
          <ul>
            <li><b>用例</b>：30 条真实需求原话；以原话为基础补全隐藏需求画像（原话真实，补全部分为合成）。</li>
            <li><b>模拟用户</b>：配合型 / 答非所问型 / 敷衍型，只回答被问到的问题。</li>
            <li><b>评委</b>：大模型对照「用户实际说过的话」逐字段检查编造与添油加醋，对照隐藏画像检查召回；人工抽检校准。</li>
            <li><b>统计</b>：每个版本跑 3 次取均值和范围，改进必须超出波动范围才算数。</li>
          </ul>
        </section>

        <section>
          <h2>6. 结果：基线 v0.2 → 当前 v0.4.2（各 3 次均值）</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>指标</th><th>修图 基线</th><th>修图 当前</th><th>剪辑 基线</th><th>剪辑 当前</th></tr>
              </thead>
              <tbody>{RESULTS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 2 || i === 4 ? "strong" : ""}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="note">代价：prompt 变长，每单 tokens 约 1.3 万 → 2.3 万，单轮延迟约 9 秒 → 14 秒，是下一步要优化的点。</p>
        </section>

        <section>
          <h2>7. 关键发现与取舍</h2>
          <div className="lessons">
            {LESSONS.map(([t, d]) => (
              <div className="lesson" key={t}>
                <div className="lesson-t">{t}</div>
                <div className="lesson-d">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>8. 下一步</h2>
          <ul>
            <li><b>参考图优先</b>：支持上传参考图 / 视频链接，为常见风格准备示例图库，让用户「指着图选」。</li>
            <li><b>真实交易验证</b>：在闲鱼对同一需求分别发一句话和需求单，对比沟通轮次、返工次数和首稿满意度。</li>
            <li><b>B 端机会</b>：服务方验证时发现大量接单账号背后是客服中介，需求在传话中层层损耗，需求单可作为客服的标准接单工具。</li>
            <li><b>延迟与成本</b>：快速选择题改为前端生成、尝试更快的模型。</li>
          </ul>
        </section>

        <footer className="case-footer">
          技术：Next.js + 阿里云百炼（通义千问）。开发使用 AI 编程工具 Claude Code，产品设计、调研与评测由本人负责。
          所有数据与过程记录见 GitHub 仓库 docs/ 目录。
        </footer>
      </main>
    </div>
  );
}
