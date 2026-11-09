import { useCallback, useEffect, useRef, useState } from "react";
import { api, session } from "../api.js";

export default function Chat({ compact = false, channel = "general", openSecretRequest = 0 }) {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [secretMode, setSecretMode] = useState(false);
  const [secretToken, setSecretToken] = useState("");
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const currentUser = session.user?.name;
  const activeChannel = !compact && secretMode ? "secret" : channel;
  const accessToken = activeChannel === "secret" ? secretToken : "";
  useEffect(() => {
    if (!compact && openSecretRequest) { setSecretMode(true); setSecretToken(""); setMessages([]); setPassword(""); setError(""); }
  }, [compact, openSecretRequest]);
  const refresh = useCallback(async () => {
    if (activeChannel === "secret" && !accessToken) return;
    try {
      const [nextMessages, nextTyping] = activeChannel === "secret"
        ? await Promise.all([api.secretChat(activeChannel, accessToken), api.secretTypingUsers(activeChannel, accessToken)])
        : await Promise.all([api.chat(activeChannel), api.typingUsers(activeChannel)]);
      setMessages((old) => JSON.stringify(old) === JSON.stringify(nextMessages) ? old : nextMessages);
      setTyping(nextTyping);
      if (document.visibilityState === "visible") {
        if (activeChannel === "secret") await api.markSecretChatSeen(activeChannel, accessToken);
        else await api.markChatSeen(activeChannel);
        window.dispatchEvent(new CustomEvent("chat-seen", { detail: { channel: activeChannel } }));
      }
    } catch (e) { setError(e.message); if (activeChannel === "secret" && /expired|unlock/i.test(e.message)) setSecretToken(""); }
  }, [activeChannel, accessToken]);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); clearTimeout(typingTimer.current); if (activeChannel === "secret" && accessToken) api.setSecretTyping(false, activeChannel, accessToken).catch(() => {}); else api.setTyping(false, activeChannel).catch(() => {}); };
  }, [refresh, activeChannel, accessToken]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  function onChange(value) {
    setText(value);
    if (activeChannel === "secret") { if (accessToken) api.setSecretTyping(Boolean(value.trim()), activeChannel, accessToken).catch(() => {}); }
    else api.setTyping(Boolean(value.trim()), activeChannel).catch(() => {});
    clearTimeout(typingTimer.current);
    if (value.trim()) typingTimer.current = setTimeout(() => (activeChannel === "secret" ? accessToken && api.setSecretTyping(false, activeChannel, accessToken) : api.setTyping(false, activeChannel)).catch(() => {}), 2500);
  }
  async function unlock(e) {
    e.preventDefault(); setUnlocking(true); setError("");
    try { const result = await api.unlockSecretChat(password); setSecretToken(result.token); setPassword(""); }
    catch (e) { setError(e.message); }
    finally { setUnlocking(false); }
  }
  async function send(e) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText(""); setError(""); clearTimeout(typingTimer.current);
    if (activeChannel === "secret") await api.setSecretTyping(false, activeChannel, accessToken).catch(() => {});
    else await api.setTyping(false, activeChannel).catch(() => {});
    try { const saved = activeChannel === "secret" ? await api.sendSecretChat(message, activeChannel, accessToken) : await api.sendChat(message, activeChannel); setMessages((items) => [...items.filter((m) => m._id !== saved._id), saved]); }
    catch (e) { setError(e.message); setText(message); }
  }
  if (!compact && secretMode && !secretToken) return <section className="love-unlock"><p className="love-kicker">A private place for two</p><h2>Maximum Love</h2><p className="love-copy">This private conversation is kept separate from your regular chat.</p><form onSubmit={unlock}><label htmlFor="love-password">Enter your application password</label><input id="love-password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button className="love-button" disabled={unlocking}>{unlocking ? "Opening…" : "Unlock chat"}</button></form>{error && <p className="love-error">{error}</p>}<button className="love-back" onClick={() => { setSecretMode(false); setError(""); }}>← Back to regular chat</button></section>;
  return <section className={`chat-panel ${compact ? "chat-panel-compact" : ""} ${activeChannel === "secret" ? "love-chat" : ""}`}>
    <div className="chat-heading"><div><h2 className="text-xl font-extrabold">{activeChannel === "secret" ? "Maximum Love" : "Chat"}</h2><p className="text-sm text-ink/55">{activeChannel === "secret" ? "Your private romantic conversation" : "The same shared conversation"}</p></div><div className="flex items-center gap-2">{!compact && activeChannel === "secret" && <button className="love-switch" onClick={() => { setSecretToken(""); setSecretMode(false); setMessages([]); setError(""); }}>Close</button>}<span className="chat-live"><i /> Live</span></div></div>
    <div className="chat-messages" aria-live="polite">
      {!messages.length && <p className="chat-empty">No messages yet. Say hello!</p>}
      {messages.map((message) => {
        const mine = message.sender === currentUser;
        return <div key={message._id} className={`chat-row ${mine ? "mine" : "theirs"}`}><div className="chat-bubble">
          {!mine && <p className="chat-sender">{message.sender}</p>}
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
          <time>{new Intl.DateTimeFormat("en-LK", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt))}{mine && <span className="chat-seen"> · {message.seenBy?.some((name) => name !== currentUser) ? "Seen" : "Sent"}</span>}</time>
        </div></div>;
      })}
      {typing.length > 0 && <p className="chat-typing">{typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…</p>}
      <div ref={endRef} />
    </div>
    {error && <p className="mb-2 px-4 text-sm text-red-600">{error}</p>}
    <form className="chat-compose" onSubmit={send}><input className="field" placeholder="Write a message…" value={text} onChange={(e) => onChange(e.target.value)} maxLength={2000} aria-label="Message" /><button className="btn" disabled={!text.trim()}>Send</button></form>
  </section>;
}
