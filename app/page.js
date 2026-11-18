"use client";

import { useEffect, useRef, useState } from "react";
import { BRIEF_FIELDS, MAX_TURNS } from "@/lib/prompts";

const EXAMPLES = [
  "下周社团招新，帮我做个海报，要好看点",
  "帮我写个奶茶店新品上市的朋友圈文案",
  "学院讲座要发公众号推文，想要个吸引人的标题",
  "想给我的手作小店设计一个 logo",
];

const ROUTE_LABEL = {
  ai: "🤖 AI 直接做",
  hybrid: "🤝 人机协作",
  human: "🧑‍🎨 交给真人",
};

const CORE_KEYS = BRIEF_FIELDS.filter((f) => f.core).map((f) => f.key);

function briefToText(brief, routing) {
  const lines = ["【需求单】"];
  for (const f of BRIEF_FIELDS) lines.push(`${f.label}：${brief[f.key] ?? "待确认"}`);
  if (routing) lines.push(`建议执行方式：${ROUTE_LABEL[routing.type] ?? routing.type}（${routing.reason}）`);
  return lines.join("\n");
}

export default function Home() {
  const [model, setModel] = useState("qwen-plus");
  const [messages, setMessages] = useState([]); // {role, content}
  const [options, setOptions] = useState([]);
  const [brief, setBrief] = useState(null);
  const [freshKeys, setFreshKeys] = useState([]);
  const [routing, setRouting] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [trace, setTrace] = useState([]);
  const [copied, setCopied] = useState(false);
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
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, forceFinish, model, brief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const prev = brief || {};
      setFreshKeys(BRIEF_FIELDS.map((f) => f.key).filter((k) => data.brief[k] && data.brief[k] !== prev[k]));
      setBrief(data.brief);
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setOptions(data.action === "ask" ? data.options : []);
      if (data.action === "finish") {
        setDone(true);
        setRouting(data.routing);
      }
      setTrace((t) => [...t, { at: new Date().toISOString(), input: content || "(用户点击：直接生成)", forceFinish, output: data }]);
    } catch (e) {
      setError(e.message || "出错了，请重试");
      setMessages(messages); // 回滚，方便重试
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  async function makeDraft() {
    setDrafting(true);
    setDraft("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      setTrace((t) => [...t, { at: new Date().toISOString(), input: "(生成初稿)", output: data }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setDrafting(false);
    }
  }

  function reset() {
    setMessages([]); setOptions([]); setBrief(null); setRouting(null);
    setDone(false); setError(""); setInput(""); setDraft(""); setTrace([]); setFreshKeys([]);
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(briefToText(brief, routing));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("复制失败，请手动选择文字复制");
    }
  }

  function exportTrace() {
    const blob = new Blob(
      [JSON.stringify({ model, exportedAt: new Date().toISOString(), messages, brief, routing, draft, trace }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `briefai-trace-${Date.now()}.json`;
    a.click();
  }

  const filledCore = brief ? CORE_KEYS.filter((k) => brief[k]).length : 0;
  const pct = Math.round((filledCore / CORE_KEYS.length) * 100);

  return (
    <>
      <header className="header">
        <div>
          <div className="logo">Brief<span>AI</span> 需求助手</div>
          <div className="sub">一句模糊的需求 → 技能方拿到就能开工的需求单</div>
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
            {messages.length > 0 && (
              <button className="btn ghost small" onClick={reset}>重新开始</button>
            )}
          </div>
          <div className="messages">
            {messages.length === 0 && (
              <div className="welcome">
                <h2>你想找人做点什么？</h2>
                随便说一句就行，我会帮你问清楚细节。目前支持<b>海报</b>和<b>文案</b>。
                <div className="chips">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} className="chip" onClick={() => send(ex)}>{ex}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>{m.content}</div>
            ))}
            {loading && <div className="typing">需求助手正在思考…</div>}
            {error && <div className="msg error">⚠️ {error}</div>}
            <div ref={endRef} />
          </div>

          <div className="composer">
            {options.length > 0 && (
              <div className="chips">
                {options.map((o) => (
                  <button key={o} className="chip" onClick={() => send(o)} disabled={loading}>{o}</button>
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
                    send(input);
                  }
                }}
              />
              <button className="btn" onClick={() => send(input)} disabled={loading || !input.trim()}>发送</button>
            </div>
            <div className="hint">
              <span>{messages.length ? `第 ${userTurns} / ${MAX_TURNS} 轮` : "Enter 发送，Shift+Enter 换行"}</span>
              {messages.length > 0 && !done && (
                <button className="btn ghost small" onClick={() => send("", true)} disabled={loading}>
                  不想答了，直接生成需求单 →
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <span>需求单（实时生成）</span>
            {brief && <span className="sub">关键信息 {filledCore}/{CORE_KEYS.length}</span>}
          </div>
          <div className="brief">
            {!brief ? (
              <div className="empty-state">开始对话后，这里会实时整理出结构化的需求单。</div>
            ) : (
              <>
                <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                <dl className="fields">
                  {BRIEF_FIELDS.map((f) => (
                    <FieldRow key={f.key} label={f.label} value={brief[f.key]} fresh={freshKeys.includes(f.key)} />
                  ))}
                </dl>

                {routing && (
                  <div className={`route ${routing.type}`}>
                    <div className="route-type">建议执行方式：{ROUTE_LABEL[routing.type] ?? routing.type}</div>
                    <p>{routing.reason}</p>
                  </div>
                )}

                {done && (
                  <div className="actions">
                    <button className="btn" onClick={copyBrief}>{copied ? "已复制 ✓" : "复制需求单"}</button>
                    {routing?.type !== "human" && (
                      <button className="btn ghost" onClick={makeDraft} disabled={drafting}>
                        {drafting ? "生成中…" : routing?.type === "ai" ? "AI 生成初稿" : "AI 生成文案与版式建议"}
                      </button>
                    )}
                    <button className="btn ghost" onClick={exportTrace}>导出对话记录</button>
                  </div>
                )}
                {draft && <div className="draft"><Markdown text={draft} /></div>}
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
      <dd className={!value ? "empty" : fresh ? "fresh" : ""}>{value || "待确认"}</dd>
    </>
  );
}

// 极简 Markdown 渲染：标题、列表、加粗，去掉代码块围栏
function Markdown({ text }) {
  const inline = (t, k) =>
    t.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={`${k}-${i}`}>{part.slice(2, -2)}</strong> : part
    );
  const lines = text.replace(/^```\w*\s*$/gm, "").split("\n");
  return lines.map((line, i) => {
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) return <div key={i} className="md-h">{inline(h[2], i)}</div>;
    const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) return <div key={i} className="md-li">• {inline(li[1], i)}</div>;
    if (!line.trim()) return <div key={i} className="md-gap" />;
    return <div key={i}>{inline(line, i)}</div>;
  });
}
