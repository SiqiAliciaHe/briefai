"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_TURNS } from "@/lib/prompts";
import { CATEGORIES, fieldsOf } from "@/lib/categories";

const EXAMPLES = [
  "帮我修一下毕业照，要清透感，但别修得不像我",
  "旅游拍了一堆素材，想剪个氛围感 vlog 发小红书",
  "求帮忙把照片里的路人 P 掉",
  "思政作业要剪个微电影，8 分钟，便宜点",
];

const ROUTE_LABEL = {
  ai: "🤖 AI 工具自助即可",
  hybrid: "🤝 AI 处理 + 真人精修",
  human: "🧑‍🎨 交给真人服务方",
};

function briefToText({ category, brief, styleTranslation, price, routing }) {
  const c = CATEGORIES[category];
  const lines = [`【${c?.name ?? ""}需求单】`];
  for (const f of fieldsOf(category)) lines.push(`${f.label}：${brief[f.key] ?? "待确认"}`);
  if (styleTranslation?.length) {
    lines.push("", "【风格要求说明】");
    for (const s of styleTranslation) lines.push(`「${s.term}」→ ${s.spec}`);
  }
  if (price) lines.push("", `【报价参考】${price.summary}`);
  if (routing) lines.push(`【建议执行方式】${ROUTE_LABEL[routing.type] ?? routing.type}：${routing.reason}`);
  return lines.join("\n");
}

export default function Home() {
  const [model, setModel] = useState("qwen-plus");
  const [messages, setMessages] = useState([]);
  const [options, setOptions] = useState([]);
  const [quickForm, setQuickForm] = useState([]);
  const [picks, setPicks] = useState({});
  const [state, setState] = useState(null); // { category, brief, style_translation, price_inputs }
  const [view, setView] = useState(null); // 最近一次返回，用于展示
  const [freshKeys, setFreshKeys] = useState([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [trace, setTrace] = useState([]);
  const [copied, setCopied] = useState(false);
  const [guide, setGuide] = useState(null);
  const [guiding, setGuiding] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const userTurns = messages.filter((m) => m.role === "user").length;

  async function send(text, forceFinish = false) {
    const content = (text ?? "").trim();
    if ((!content && !forceFinish) || loading) return;
    const next = content ? [...messages, { role: "user", content }] : messages;
    setMessages(next);
    setInput("");
    setOptions([]);
    setQuickForm([]);
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), forceFinish, model, state }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const prev = view?.brief || {};
      setFreshKeys(Object.keys(data.brief).filter((k) => data.brief[k] && data.brief[k] !== prev[k]));
      setView(data);
      setState({
        category: data.category,
        brief: data.brief,
        style_translation: data.styleTranslation,
        price_inputs: data.priceInputs,
      });
      // content 进入对话历史（含快速选择题），display 只显示主问题（选择题在下方单独展示）
      setMessages([...next, { role: "assistant", content: data.transcript || data.reply, display: data.reply }]);
      setOptions(data.options);
      setQuickForm(data.quickForm || []);
      setPicks({});
      if (data.action === "finish") setDone(true);
      setTrace((t) => [...t, { at: new Date().toISOString(), input: content || "(用户点击：直接生成)", forceFinish, output: data }]);
    } catch (e) {
      setError(e.message || "出错了，请重试");
      setMessages(messages);
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  // 把快速选择的结果和输入框文字合成一条回答
  function composeAnswer(choice) {
    const picked = quickForm.filter((q) => picks[q.field]).map((q) => `${q.question.replace(/[？?]$/, "")}：${picks[q.field]}`);
    return [choice ?? input.trim(), picked.length ? picked.join("；") : ""].filter(Boolean).join("\n");
  }

  async function makeGuide() {
    setGuiding(true);
    setError("");
    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: view.category, brief: view.brief, styleTranslation: view.styleTranslation, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGuide(data);
      setTrace((t) => [...t, { at: new Date().toISOString(), input: "(生成自助操作指引)", output: data }]);
    } catch (e) {
      setError(e.message || "生成失败，请重试");
    } finally {
      setGuiding(false);
    }
  }

  function reset() {
    setGuide(null);
    setMessages([]); setOptions([]); setQuickForm([]); setPicks({}); setState(null); setView(null);
    setDone(false); setError(""); setInput(""); setTrace([]); setFreshKeys([]);
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(briefToText(view));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("复制失败，请手动选择文字复制");
    }
  }

  function exportTrace() {
    const blob = new Blob(
      [JSON.stringify({ model, exportedAt: new Date().toISOString(), messages, final: view, trace }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `briefai-trace-${Date.now()}.json`;
    a.click();
  }

  const cat = view?.category ? CATEGORIES[view.category] : null;
  const fields = fieldsOf(view?.category);
  const coreKeys = fields.filter((f) => f.core).map((f) => f.key);
  const filledCore = view ? coreKeys.filter((k) => view.brief[k]).length : 0;
  const pct = coreKeys.length ? Math.round((filledCore / coreKeys.length) * 100) : 0;
  const refused = view?.action === "refuse";
  const unsupported = view?.action === "unsupported";

  return (
    <>
      <header className="header">
        <div>
          <div className="logo">Brief<span>AI</span> 需求助手</div>
          <div className="sub">把「修得好看点」「剪得有氛围感」，变成修图师、剪辑师能照着做、能照着验收的需求单</div>
        </div>
        <label className="sub">
          模型{" "}
          <select value={model} onChange={(e) => setModel(e.target.value)} disabled={messages.length > 0}>
            <option value="qwen-plus">通义千问 Plus</option>
            <option value="qwen-max">通义千问 Max</option>
          </select>
        </label>
      </header>

      <main className="main">
        <section className="panel chat">
          <div className="panel-title">
            <span>对话</span>
            {messages.length > 0 && <button className="btn ghost small" onClick={reset}>重新开始</button>}
          </div>
          <div className="messages">
            {messages.length === 0 && (
              <div className="welcome">
                <h2>想修图，还是想剪视频？</h2>
                随便说一句就行，我会帮你把要求问清楚，避免「修成这样你收我钱？」的尴尬。目前支持<b>人像修图</b>和<b>视频剪辑</b>。
                <div className="chips">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} className="chip" onClick={() => send(ex)}>{ex}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>{m.display ?? m.content}</div>
            ))}
            {loading && <div className="typing">需求助手正在思考…</div>}
            {error && <div className="msg error">⚠️ {error}</div>}
            <div ref={endRef} />
          </div>

          <div className="composer">
            {quickForm.length > 0 && (
              <div className="quickform">
                <div className="sub">顺便快速选一下（可跳过）：</div>
                {quickForm.map((q) => (
                  <div key={q.field} className="qf-row">
                    <span className="qf-q">{q.question}</span>
                    <div className="chips">
                      {q.options.map((o) => (
                        <button
                          key={o}
                          className={`chip ${picks[q.field] === o ? "picked" : ""}`}
                          onClick={() => setPicks((p) => ({ ...p, [q.field]: p[q.field] === o ? undefined : o }))}
                          disabled={loading}
                        >{o}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {options.length > 0 && (
              <div className="chips">
                {options.map((o) => (
                  <button key={o} className="chip" onClick={() => send(composeAnswer(o))} disabled={loading}>{o}</button>
                ))}
              </div>
            )}
            <div className="composer-row">
              <textarea
                rows={1}
                value={input}
                placeholder={done ? "需求单已生成，可以补充修改，或点「重新开始」" : "输入你的需求或回答…"}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(composeAnswer());
                  }
                }}
              />
              <button className="btn" onClick={() => send(composeAnswer())} disabled={loading || (!input.trim() && !Object.values(picks).some(Boolean))}>发送</button>
            </div>
            <div className="hint">
              <span>{messages.length ? `第 ${userTurns} / ${MAX_TURNS} 轮` : "Enter 发送，Shift+Enter 换行"}</span>
              {cat && !done && !refused && (
                <button className="btn ghost small" onClick={() => send("", true)} disabled={loading}>
                  不想答了，直接生成需求单 →
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <span>{cat ? `${cat.emoji} ${cat.name}需求单` : "需求单（实时生成）"}</span>
            {cat && !refused && <span className="sub">关键信息 {filledCore}/{coreKeys.length}</span>}
          </div>
          <div className="brief">
            {refused ? (
              <div className="route refuse">
                <div className="route-type">🚫 这个需求我们不能接</div>
                <p>{view.reply}</p>
              </div>
            ) : unsupported ? (
              <div className="route hybrid">
                <div className="route-type">🚧 暂不支持这个品类</div>
                <p>{view.reply}</p>
              </div>
            ) : !cat ? (
              <div className="empty-state">开始对话后，这里会实时整理出结构化的需求单。</div>
            ) : (
              <>
                <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                <dl className="fields">
                  {fields.map((f) => (
                    <FieldRow key={f.key} label={f.label} value={view.brief[f.key]} fresh={freshKeys.includes(f.key)} />
                  ))}
                </dl>

                {view.styleTranslation?.length > 0 && (
                  <div className="card">
                    <div className="card-title">🎨 风格要求说明</div>
                    <div className="sub">把审美词翻译成服务方能照着做的要求</div>
                    {view.styleTranslation.map((s, i) => (
                      <div key={i} className="translate">
                        <span className="term">「{s.term}」</span>
                        <span>→ {s.spec}</span>
                      </div>
                    ))}
                  </div>
                )}

                {view.price && (
                  <div className="card">
                    <div className="card-title">💰 报价参考：{view.price.summary}</div>
                    {view.price.detail.map((d, i) => <div key={i} className="sub">· {d}</div>)}
                    <div className="meta">来源：{view.price.source}</div>
                  </div>
                )}

                {view.routing && (
                  <div className={`route ${view.routing.type}`}>
                    <div className="route-type">建议执行方式：{ROUTE_LABEL[view.routing.type] ?? view.routing.type}</div>
                    <p>{view.routing.reason}</p>
                  </div>
                )}

                {done && (
                  <div className="actions">
                    <button className="btn" onClick={copyBrief}>{copied ? "已复制 ✓" : "复制需求单，发给服务方"}</button>
                    {view.routing?.type !== "human" && (
                      <button className="btn ghost" onClick={makeGuide} disabled={guiding}>
                        {guiding ? "生成中…" : "🛠️ 教我用 AI 工具自己做"}
                      </button>
                    )}
                    <button className="btn ghost" onClick={exportTrace}>导出对话记录</button>
                  </div>
                )}
                {guide && (
                  <div className="card">
                    <div className="card-title">🛠️ 用{guide.tool}自己做</div>
                    <div className="guide">{guide.guide}</div>
                    <div className="meta">步骤由 AI 生成，App 的具体菜单名称以实际版本为准。</div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function FieldRow({ label, value, fresh }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={!value ? "empty" : /待确认/.test(value) ? "pending" : fresh ? "fresh" : ""}>{value || "待确认"}</dd>
    </>
  );
}
