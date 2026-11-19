"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_TURNS } from "@/lib/prompts";
import { CATEGORIES, fieldsOf } from "@/lib/categories";
import { T, UNSURE, PENDING_RE } from "@/lib/i18n";

const labelOf = (f, lang) => (lang === "en" ? f.labelEn : f.label);

function briefToText({ category, brief, styleTranslation, price, routing }, lang, t) {
  const c = CATEGORIES[category];
  const lines = [t.briefHeading(lang === "en" ? c?.nameEn : c?.name)];
  for (const f of fieldsOf(category)) lines.push(`${labelOf(f, lang)}${t.sep}${brief[f.key] ?? t.pendingValue}`);
  if (styleTranslation?.length) {
    lines.push("", t.styleHeading);
    for (const s of styleTranslation) lines.push(lang === "en" ? `"${s.term}" → ${s.spec}` : `「${s.term}」→ ${s.spec}`);
  }
  if (price) lines.push("", `${t.priceHeading}${price.summary}`);
  if (routing) lines.push(`${t.routeHeading}${t.routeLabel[routing.type] ?? routing.type}${t.sep}${routing.reason}`);
  return lines.join("\n");
}

function bilingualToText(view, bi, t) {
  const zh = T.zh;
  const lines = [briefToText(view, "en", t), "", "—— 中文版（给国内服务方）——", zh.briefHeading(CATEGORIES[view.category].name)];
  for (const f of fieldsOf(view.category)) lines.push(`${f.label}：${bi.briefZh[f.key] ?? "待确认"}`);
  if (bi.styleNotes.length) {
    lines.push("", "【风格 / 审美词说明】");
    for (const s of bi.styleNotes) lines.push(`「${s.term}」：${s.meaning}（国内近似说法：${s.cn_equivalent}）`);
  }
  if (bi.cultureTips.length) {
    lines.push("", "【跨文化沟通提示】");
    for (const tip of bi.cultureTips) lines.push(`· ${tip}`);
  }
  return lines.join("\n");
}

export default function Home() {
  const [lang, setLang] = useState("zh");
  const t = T[lang];
  const [model, setModel] = useState("qwen-plus");
  const [messages, setMessages] = useState([]);
  const [options, setOptions] = useState([]);
  const [quickForm, setQuickForm] = useState([]);
  const [optionsMulti, setOptionsMulti] = useState(false);
  const [optionsField, setOptionsField] = useState(null);
  const [mainPicks, setMainPicks] = useState([]);
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
  const [bilingual, setBilingual] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [biCopied, setBiCopied] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // 语言偏好：浏览器存储不可用时（隐私模式等）静默忽略
  useEffect(() => {
    try {
      const saved = localStorage.getItem("briefai-lang");
      if (saved === "en" || saved === "zh") setLang(saved);
      else if (typeof navigator !== "undefined" && !navigator.language?.startsWith("zh")) setLang("en");
    } catch {}
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const unsure = UNSURE[lang];

  function switchLang(next) {
    if (next === lang) return;
    setLang(next);
    try { localStorage.setItem("briefai-lang", next); } catch {}
    reset(); // 换语言后重新开始，避免一段对话里混用两种语言
  }

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
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), forceFinish, model, state, lang }),
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
      setOptionsMulti(!!data.optionsMulti);
      setOptionsField(data.optionsField || null);
      setMainPicks([]);
      if (data.action === "finish") setDone(true);
      setTrace((tr) => [...tr, { at: new Date().toISOString(), input: content || "(finish now)", forceFinish, output: data }]);
    } catch (e) {
      setError(e.message || t.errorRetry);
      setMessages(messages);
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  // 快速选择：多选题可以选多个，单选题再点一次取消或换成另一个；「不确定」和其他选项互斥
  function togglePick(q, o) {
    setPicks((p) => {
      const cur = p[q.field] || [];
      const base = o === unsure ? [] : cur.filter((x) => x !== unsure);
      const next = cur.includes(o) ? cur.filter((x) => x !== o) : q.multi && o !== unsure ? [...base, o] : [o];
      return { ...p, [q.field]: next };
    });
  }

  // 把主问题选项、快速选择和输入框文字合成一条回答
  function composeAnswer(choice) {
    const joiner = lang === "en" ? ", " : "、";
    const main = choice ?? [mainPicks.join(joiner), input.trim()].filter(Boolean).join(lang === "en" ? "; " : "；");
    const picked = quickForm
      .filter((q) => picks[q.field]?.length)
      .map((q) => `${q.question.replace(/[？?]$/, "")}${t.sep}${picks[q.field].join(joiner)}`);
    return [main, picked.length ? picked.join(lang === "en" ? "; " : "；") : ""].filter(Boolean).join("\n");
  }

  async function postJson(url, body) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async function makeGuide() {
    setGuiding(true);
    setError("");
    try {
      const data = await postJson("/api/guide", { category: view.category, brief: view.brief, styleTranslation: view.styleTranslation, model, lang });
      setGuide(data);
      setTrace((tr) => [...tr, { at: new Date().toISOString(), input: "(self-serve guide)", output: data }]);
    } catch (e) {
      setError(e.message || t.errorRetry);
    } finally {
      setGuiding(false);
    }
  }

  async function makeBilingual() {
    setTranslating(true);
    setError("");
    try {
      const data = await postJson("/api/bilingual", { category: view.category, brief: view.brief, styleTranslation: view.styleTranslation, routing: view.routing, model });
      setBilingual(data);
      setTrace((tr) => [...tr, { at: new Date().toISOString(), input: "(bilingual brief)", output: data }]);
    } catch (e) {
      setError(e.message || t.errorRetry);
    } finally {
      setTranslating(false);
    }
  }

  function reset() {
    setGuide(null); setBilingual(null);
    setOptionsMulti(false); setMainPicks([]); setOptionsField(null);
    setMessages([]); setOptions([]); setQuickForm([]); setPicks({}); setState(null); setView(null);
    setDone(false); setError(""); setInput(""); setTrace([]); setFreshKeys([]);
  }

  async function copyText(text, setFlag) {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 1500);
    } catch {
      setError(t.copyFail);
    }
  }

  function exportTrace() {
    const blob = new Blob(
      [JSON.stringify({ model, lang, exportedAt: new Date().toISOString(), messages, final: view, bilingual, trace }, null, 2)],
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
    <div className="app-root" lang={lang === "en" ? "en" : "zh-CN"}>
      <header className="header">
        <div>
          <div className="logo">Brief<span>AI</span> {t.title}</div>
          <div className="sub">{t.tagline}</div>
        </div>
        <div className="header-right">
          <div className="lang-switch" role="group" aria-label="Language">
            <button className={lang === "zh" ? "on" : ""} onClick={() => switchLang("zh")}>中文</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => switchLang("en")}>EN</button>
          </div>
          <a className="header-link" href={t.caseHref}>{t.caseLink}</a>
          <label className="sub">
            {t.model}{" "}
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={messages.length > 0}>
              <option value="qwen-plus">Qwen Plus</option>
              <option value="qwen-max">Qwen Max</option>
            </select>
          </label>
        </div>
      </header>

      <main className="main">
        <section className="panel chat">
          <div className="panel-title">
            <span>{t.chat}</span>
            {messages.length > 0 && <button className="btn ghost small" onClick={reset}>{t.restart}</button>}
          </div>
          <div className="messages">
            {messages.length === 0 && (
              <div className="welcome">
                <h2>{t.welcomeTitle}</h2>
                {t.welcomeBody}
                <div className="chips">
                  {t.examples.map((ex) => (
                    <button key={ex} className="chip" onClick={() => send(ex)}>{ex}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>{m.display ?? m.content}</div>
            ))}
            {loading && <div className="typing">{t.thinking}</div>}
            {error && <div className="msg error">⚠️ {error}</div>}
            <div ref={endRef} />
          </div>

          <div className="composer">
            {quickForm.length > 0 && (
              <div className="quickform">
                <div className="sub">{t.quickFormHint}</div>
                {quickForm.map((q) => (
                  <div key={q.field} className="qf-row">
                    <span className="qf-q">{q.question}{q.multi && <span className="sub">{t.multi}</span>}</span>
                    <div className="chips">
                      {[...q.options, unsure].map((o) => (
                        <button
                          key={o}
                          className={`chip ${(picks[q.field] || []).includes(o) ? "picked" : ""}`}
                          onClick={() => togglePick(q, o)}
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
                {optionsMulti && <div className="sub multi-hint">{t.multiHint}</div>}
                {options.map((o) => (
                  <button
                    key={o}
                    className={`chip ${mainPicks.includes(o) ? "picked" : ""}`}
                    onClick={() =>
                      optionsMulti
                        ? setMainPicks((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]))
                        : send(composeAnswer(o))
                    }
                    disabled={loading}
                  >{o}</button>
                ))}
                {/* 兜底选项：选项都不合适时 */}
                {optionsField === "style" && (
                  <button
                    className="chip escape"
                    onClick={() => { setInput((v) => v || t.haveRefPrefill); inputRef.current?.focus(); }}
                    disabled={loading}
                  >{t.haveRef}</button>
                )}
                <button className="chip escape" onClick={() => inputRef.current?.focus()} disabled={loading}>{t.notThese}</button>
                <button className="chip escape" onClick={() => send(composeAnswer(t.suggest))} disabled={loading}>{t.suggest}</button>
              </div>
            )}
            <div className="composer-row">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                placeholder={done ? t.placeholderDone : t.placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(composeAnswer());
                  }
                }}
              />
              <button className="btn" onClick={() => send(composeAnswer())} disabled={loading || (!input.trim() && !mainPicks.length && !Object.values(picks).some((v) => v?.length))}>{t.send}</button>
            </div>
            <div className="hint">
              <span>{messages.length ? t.turn(userTurns, MAX_TURNS) : t.enterHint}</span>
              {cat && !done && !refused && (
                <button className="btn ghost small" onClick={() => send("", true)} disabled={loading}>{t.finishNow}</button>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <span>{t.briefTitle(cat)}</span>
            {cat && !refused && <span className="sub">{t.keyInfo(filledCore, coreKeys.length)}</span>}
          </div>
          <div className="brief">
            {refused ? (
              <div className="route refuse">
                <div className="route-type">{t.refused}</div>
                <p>{view.reply}</p>
              </div>
            ) : unsupported ? (
              <div className="route hybrid">
                <div className="route-type">{t.unsupported}</div>
                <p>{view.reply}</p>
              </div>
            ) : !cat ? (
              <div className="empty-state">{t.empty}</div>
            ) : (
              <>
                <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                <dl className="fields">
                  {fields.map((f) => (
                    <FieldRow key={f.key} label={labelOf(f, lang)} value={view.brief[f.key]} fresh={freshKeys.includes(f.key)} empty={t.pendingValue} />
                  ))}
                </dl>

                {view.styleTranslation?.length > 0 && (
                  <div className="card">
                    <div className="card-title">{t.styleCard}</div>
                    <div className="sub">{t.styleCardSub}</div>
                    {view.styleTranslation.map((s, i) => (
                      <div key={i} className="translate">
                        <span className="term">{lang === "en" ? `"${s.term}"` : `「${s.term}」`}</span>
                        <span>→ {s.spec}</span>
                      </div>
                    ))}
                  </div>
                )}

                {view.price && (
                  <div className="card">
                    <div className="card-title">{t.price}{view.price.summary}</div>
                    {view.price.detail.map((d, i) => <div key={i} className="sub">· {d}</div>)}
                    <div className="meta">{t.source}{view.price.source}</div>
                  </div>
                )}

                {view.routing ? (
                  <div className={`route ${view.routing.type}`}>
                    <div className="route-type">{t.routing}{t.sep}{t.routeLabel[view.routing.type] ?? view.routing.type}</div>
                    <p>{view.routing.reason}</p>
                  </div>
                ) : (
                  <div className="route pending-route">
                    <div className="route-type">{t.routing}</div>
                    <p>{t.routingPending}</p>
                  </div>
                )}

                {done && (
                  <div className="actions">
                    <button className="btn" onClick={() => copyText(briefToText(view, lang, t), setCopied)}>{copied ? t.copied : t.copy}</button>
                    {lang === "en" && view.routing?.type !== "ai" && (
                      <button className="btn ghost" onClick={makeBilingual} disabled={translating}>
                        {translating ? t.generating : t.bilingualBtn}
                      </button>
                    )}
                    {view.routing?.type !== "human" && (
                      <button className="btn ghost" onClick={makeGuide} disabled={guiding}>
                        {guiding ? t.generating : t.guideBtn}
                      </button>
                    )}
                    <button className="btn ghost" onClick={exportTrace}>{t.export}</button>
                  </div>
                )}

                {bilingual && (
                  <div className="card bilingual">
                    <div className="card-title">{T.en.bilingualTitle}</div>
                    <dl className="fields">
                      {fields.map((f) => (
                        <FieldRow key={f.key} label={f.label} value={bilingual.briefZh[f.key]} empty="待确认" />
                      ))}
                    </dl>
                    {bilingual.styleNotes.length > 0 && (
                      <>
                        <div className="card-title small-title">风格 / 审美词说明</div>
                        {bilingual.styleNotes.map((s, i) => (
                          <div key={i} className="translate">
                            <span className="term">「{s.term}」</span>
                            <span>{s.meaning}（国内近似说法：{s.cn_equivalent}）</span>
                          </div>
                        ))}
                      </>
                    )}
                    {bilingual.cultureTips.length > 0 && (
                      <>
                        <div className="card-title small-title">{T.en.bilingualNotes}</div>
                        {bilingual.cultureTips.map((tip, i) => <div key={i} className="sub">· {tip}</div>)}
                      </>
                    )}
                    <div className="actions">
                      <button className="btn" onClick={() => copyText(bilingualToText(view, bilingual, t), setBiCopied)}>
                        {biCopied ? t.copied : T.en.bilingualCopy}
                      </button>
                    </div>
                  </div>
                )}

                {guide && (
                  <div className="card">
                    <div className="card-title">{t.guideTitle(guide.tool)}</div>
                    <div className="guide">{guide.guide}</div>
                    <div className="meta">{t.guideNote}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function FieldRow({ label, value, fresh, empty }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={!value ? "empty" : PENDING_RE.test(value) ? "pending" : fresh ? "fresh" : ""}>{value || empty}</dd>
    </>
  );
}
