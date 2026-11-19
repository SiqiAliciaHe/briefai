import Link from "next/link";

export const metadata = {
  title: "BriefAI Case Study",
  description: "From market validation to evaluation: an AI requirement-clarification product for photo retouching and video editing",
};

const VALIDATION = [
  ["Copywriting", "Requests have almost disappeared (absorbed by general-purpose AI); what remains is mostly academic ghostwriting", "Not built; academic ghostwriting is a refusal boundary"],
  ["Simple posters", "Few people still hire designers, yet a post titled “chatted with AI for 3 days to get one poster” got 771 likes", "The bottleneck moved from “who makes it” to “saying clearly what you want”"],
  ["Logos / slides", "Still in demand at higher prices; “no one-click AI output” has become a selling point", "Market is splitting: low end goes to AI, design-sensitive work stays human"],
  ["Portrait retouching", "Active, paid demand; disputes like “you call THIS a ¥10 retouch?”", "Launch category"],
  ["Video editing", "Editors write their own “order requirements” lists: the market has grown its own brief template", "Launch category"],
  ["Tutoring / photo shoots", "Hard for AI to replace, but the pain is matching and trust, where AI only assists", "Out of scope"],
];

const INSIGHTS = [
  ["7/15", "retouching requests phrased as negatives", "“not too influencer-style”, “not over-edited”: people know what they don’t want better than what they want"],
  ["5/15", "had already tried editing it themselves and gave up", "Tools are everywhere; the bottleneck is expressing taste clearly"],
  ["8 vs 7", "video: individuals vs. creators / businesses", "Individuals can’t articulate needs; businesses write detailed briefs and struggle to hire"],
  ["Pay if satisfied", "the main way sellers compete on Xianyu", "Sellers currently absorb the risk of mismatched expectations; a brief reduces exactly that"],
];

const RESULTS = [
  ["Key-info recall", "67.4%", "73.9%", "58.4%", "67.7%"],
  ["Fabrication rate", "4.0%", "1.1%", "1.3%", "1.7%"],
  ["Style recall", "33.3%", "57.8%", "60.3%", "70.8%"],
  ["Acceptance-criteria recall", "22.1%", "47.8%", "—", "—"],
  ["Story / must-include recall", "—", "—", "37.2%", "65.8%"],
  ["Deadline recall", "—", "—", "28.6%", "81.6%"],
];

const LESSONS = [
  ["Question priority is zero-sum", "With a 6-turn limit, reordering questions only shifts recall between fields (style up, others down, total flat). What raised total recall was “quick picks”: more information per turn."],
  ["Models can’t reliably flag their own guesses", "Only ~11% of fabricated fields were self-flagged by the model. Replaced with code checks: content traceable to the user’s words is kept; content that looks like the assistant’s own proposal is marked “to confirm”; skipped confirmations are never written in."],
  ["The judge needs evaluating too", "The evaluation itself went through 5 revisions: the judge counted empty fields as fabrication, missed embellishments, treated “didn’t object” as “agreed”, simulated users were too cooperative, and single runs were too noisy. All found by reading transcripts by hand."],
  ["New features create new failure modes", "After adding quick picks, the model started defaulting to “2 revision rounds” as an industry norm (7 of 13 cases), caught only by reading results line by line."],
  ["Real usage found what simulation couldn’t", "Options that should be multi-select, the user’s own words wrongly flagged “to confirm”, style options that were as vague as the original request, options listed in text but not clickable: 9 issues in total, all fixed."],
  ["Text has a ceiling for taste", "In real posts, people align on taste through example photos, sample videos and creators they like. Next step: reference images first."],
];

export default function CasePageEn() {
  return (
    <div className="case">
      <header className="case-hero">
        <div className="case-wrap">
          <div className="case-top">
            <div className="logo">Brief<span>AI</span> · Case Study</div>
            <Link className="header-link" href="/case">中文版</Link>
          </div>
          <h1>Turning “make it look nicer” into a brief that retouchers and video editors can follow and check against</h1>
          <p className="case-lead">
            An AI requirement-clarification product for portrait retouching and video editing: multi-turn questions → structured brief → vibe words translated into instructions → rule-based pricing → AI routing (do it yourself with an AI app / AI + human / hire a human). Bilingual briefs support cross-border orders. Every step from market research to evaluation is documented.
          </p>
          <div className="case-actions">
            <Link className="btn" href="/">Try the demo →</Link>
            <a className="btn ghost" href="https://github.com/SiqiAliciaHe/briefai" target="_blank" rel="noreferrer">GitHub (docs & eval code)</a>
          </div>
        </div>
      </header>

      <main className="case-wrap">
        <section>
          <h2>1. Background: an outdated business plan</h2>
          <p>
            In 2022 I co-founded a campus skills marketplace, “Jiaowohuo”, and led operations. The biggest source of friction was that buyers couldn’t say what they wanted, which led to endless back-and-forth, rework and disputes.
            Looking back in 2026, AI has absorbed the cheap, simple jobs that platform targeted. So I asked again: <b>in the AI era, where in this transaction should AI step in?</b>
          </p>
        </section>

        <section>
          <h2>2. Market validation: 7 categories, researched by hand on Xiaohongshu and Xianyu</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Category</th><th>What I saw</th><th>Decision</th></tr></thead>
              <tbody>{VALIDATION.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="note">Takeaway: where AI does the job well, human demand is gone. What remains is subjective, hard-to-describe visual work, and the bottleneck is always “the buyer can’t say it clearly, so expectations don’t match”.</p>
        </section>

        <section>
          <h2>3. User insights: 30 real request posts (15 retouching, 15 video)</h2>
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
          <h2>4. Product</h2>
          <div className="shots">
            <figure>
              <img src="/case/en-1-clarify.png" alt="Clarifying questions with quick picks" />
              <figcaption>Clarifying: one main question per turn plus up to 3 quick picks (multi-select); ask for references first; options must describe what you’d actually see or hear</figcaption>
            </figure>
            <figure>
              <img src="/case/en-2-bilingual.png" alt="Bilingual brief for a China-based editor" />
              <figcaption>Cross-border: an overseas client’s English brief becomes a Chinese brief for a China-based editor, with vibe words like “clean girl aesthetic” explained and culture-specific tips</figcaption>
            </figure>
            <figure>
              <img src="/case/2-brief.png" alt="Brief, style translation, pricing and AI routing (Chinese UI)" />
              <figcaption>Chinese UI: style translation, rule-based pricing (the model extracts parameters only, never quotes prices), AI routing; unconfirmed content is never written in as fact</figcaption>
            </figure>
          </div>
        </section>

        <section>
          <h2>5. Going global: early signals from the data</h2>
          <ul>
            <li>3 of the 15 video posts involve overseas clients or platforms: an overseas creator hiring an editor for English interviews, Instagram videos paid <b>CNY 200–300 per video</b> (roughly 10× the domestic student rate), and TikTok talking-head edits.</li>
            <li>In these cross-border orders, the gap isn’t only “unclear needs” but also <b>language and taste</b>: “clean girl aesthetic” or “cinematic” means little to an editor in China. The bilingual brief targets exactly this.</li>
            <li><b>Not yet validated:</b> next I’m collecting real English requests from Reddit (r/PhotoshopRequest, r/forhire) to check whether overseas users show the same patterns, then running the same evaluation in English.</li>
          </ul>
        </section>

        <section>
          <h2>6. Evaluation method</h2>
          <ul>
            <li><b>Test cases</b>: 30 real request posts; each expanded into a hidden “full intent” profile (the original words are real, the expanded details are synthetic).</li>
            <li><b>Simulated users</b>: cooperative / off-topic / low-effort, answering only what they’re asked.</li>
            <li><b>Judge</b>: an LLM checks every brief field against what the user actually said (fabrication, embellishment) and against the hidden profile (recall), with human spot checks.</li>
            <li><b>Statistics</b>: 3 runs per version, reporting mean and range; an improvement only counts if it clears the run-to-run noise.</li>
          </ul>
        </section>

        <section>
          <h2>7. Results: baseline v0.2 → current v0.4.2 (mean of 3 runs)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Metric</th><th>Retouching baseline</th><th>Retouching now</th><th>Video baseline</th><th>Video now</th></tr>
              </thead>
              <tbody>{RESULTS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 2 || i === 4 ? "strong" : ""}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="note">Cost: longer prompts took tokens per brief from ~13k to ~23k and per-turn latency from ~9 s to ~14 s, the next thing to optimize. All metrics come from simulated evaluation, not live users.</p>
        </section>

        <section>
          <h2>8. Key findings and trade-offs</h2>
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
          <h2>9. Next steps</h2>
          <ul>
            <li><b>Reference images first</b>: upload reference photos / video links and pick from a style gallery, instead of reading descriptions.</li>
            <li><b>Real-transaction test</b>: on Xianyu, send the same request once as a one-liner and once as a brief, and compare rounds of back-and-forth, rework and first-draft satisfaction.</li>
            <li><b>English validation</b>: real Reddit requests through the same evaluation pipeline.</li>
            <li><b>B2B opportunity</b>: many seller accounts are run by customer-service staff relaying requests to freelancers, so information is lost at every hand-off; the brief could become their standard intake tool.</li>
            <li><b>Latency and cost</b>: generate quick picks without the model; try faster models.</li>
          </ul>
        </section>

        <footer className="case-footer">
          Stack: Next.js + Alibaba Cloud Model Studio (Qwen). Built with the AI coding tool Claude Code; product direction, research, data collection and evaluation design are my own. All data and process notes are in the GitHub repo under docs/.
        </footer>
      </main>
    </div>
  );
}
