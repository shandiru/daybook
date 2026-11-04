import { useCallback, useEffect, useRef, useState } from "react";
import { api, session } from "../api.js";

export default function Chat({ compact = false }) {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const currentUser = session.user?.name;
  const refresh = useCallback(async () => {
    try {
      const [nextMessages, nextTyping] = await Promise.all([api.chat(), api.typingUsers()]);
      setMessages((old) => JSON.stringify(old) === JSON.stringify(nextMessages) ? old : nextMessages);
      setTyping(nextTyping);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); clearTimeout(typingTimer.current); api.setTyping(false).catch(() => {}); };
  }, [refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  function onChange(value) {
    setText(value);
    api.setTyping(Boolean(value.trim())).catch(() => {});
    clearTimeout(typingTimer.current);
    if (value.trim()) typingTimer.current = setTimeout(() => api.setTyping(false).catch(() => {}), 2500);
  }
  async function send(e) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText(""); setError(""); clearTimeout(typingTimer.current);
    await api.setTyping(false).catch(() => {});
    try { const saved = await api.sendChat(message); setMessages((items) => [...items.filter((m) => m._id !== saved._id), saved]); }
    catch (e) { setError(e.message); setText(message); }
  }
  return <section className={`chat-panel ${compact ? "chat-panel-compact" : ""}`}>
    <div className="chat-heading"><div><h2 className="text-xl font-extrabold">{compact ? "Game Chat" : "Chat"}</h2><p className="text-sm text-ink/55">A shared conversation</p></div><span className="chat-live"><i /> Live</span></div>
    <div className="chat-messages" aria-live="polite">
      {!messages.length && <p className="chat-empty">No messages yet. Say hello!</p>}
      {messages.map((message) => {
        const mine = message.sender === currentUser;
        return <div key={message._id} className={`chat-row ${mine ? "mine" : "theirs"}`}><div className="chat-bubble">
          {!mine && <p className="chat-sender">{message.sender}</p>}
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
          <time>{new Intl.DateTimeFormat("en-LK", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt))}</time>
        </div></div>;
      })}
      {typing.length > 0 && <p className="chat-typing">{typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…</p>}
      <div ref={endRef} />
    </div>
    {error && <p className="mb-2 px-4 text-sm text-red-600">{error}</p>}
    <form className="chat-compose" onSubmit={send}><input className="field" placeholder="Write a message…" value={text} onChange={(e) => onChange(e.target.value)} maxLength={2000} aria-label="Message" /><button className="btn" disabled={!text.trim()}>Send</button></form>
  </section>;
}
