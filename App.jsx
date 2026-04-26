import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const DAILY_TIPS = [
  { text: "Exercise is one of the most powerful tools for managing Parkinson's. Even a 20-minute walk has real benefits.", icon: "🚶" },
  { text: "Try scheduling your most demanding activities during your personal best ON window each day.", icon: "⏰" },
  { text: "Staying well-hydrated helps with energy, constipation, and overall wellbeing.", icon: "💧" },
  { text: "Rhythmic cues — counting, humming, or music — can help overcome freezing of gait.", icon: "🎵" },
  { text: "Boxing, tai chi, and dance have all shown real benefits for balance and motor control.", icon: "🥊" },
  { text: "Speech exercises from a speech therapist can significantly strengthen your voice over time.", icon: "🗣️" },
  { text: "Caregivers need rest too. Burnout is real — asking for help is a sign of strength.", icon: "🤝" },
  { text: "A symptom diary helps your healthcare team make better decisions about your care.", icon: "📓" },
  { text: "Supportive non-slip footwear and removing loose rugs are among the best fall-prevention steps.", icon: "👟" },
  { text: "Protein timing may affect levodopa absorption. Ask your neurologist or dietitian about meal timing.", icon: "🥗" },
  { text: "Social connection and mental engagement are just as important as physical exercise for brain health.", icon: "🧠" },
  { text: "Deep breathing and relaxation techniques can help reduce the anxiety that may worsen symptoms.", icon: "🌬️" },
];

const CONCERNS = [
  "Tremors", "Stiffness", "Freezing of Gait", "Balance & Falls",
  "Medication Timing", "Sleep", "Speech & Voice", "Swallowing",
  "Fatigue", "Mental Health", "Caregiver Stress", "Exercise",
  "Daily Living", "Nutrition",
];

const DEFAULT_REMINDERS = [
  { id: "r1", title: "Morning Medication", type: "medication", time: "08:00", repeat: "daily", active: true, notes: "Take with water" },
  { id: "r2", title: "Midday Water Break", type: "hydration", time: "12:00", repeat: "daily", active: true, notes: "" },
  { id: "r3", title: "Afternoon Walk", type: "exercise", time: "15:30", repeat: "daily", active: false, notes: "20–30 minutes" },
];

const R_META = {
  medication: { icon: "💊", bg: "#eff6ff", border: "#bfdbfe" },
  hydration:  { icon: "💧", bg: "#ecfeff", border: "#a5f3fc" },
  exercise:   { icon: "🏃", bg: "#f0fdf4", border: "#bbf7d0" },
};

const MOODS = ["😞","😕","😐","🙂","😊"];
const MOOD_LABELS = ["Very Low","Low","Neutral","Good","Great"];

/* ─────────────────────────────────────────────────────────────
   API KEY — reads from env var first, then falls back to
   user-entered key stored in sessionStorage (cleared on tab close)
───────────────────────────────────────────────────────────── */
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const SESSION_KEY = "pd_api_key";

function getApiKey() {
  return ENV_KEY || sessionStorage.getItem(SESSION_KEY) || "";
}

/* ─────────────────────────────────────────────────────────────
   STORAGE HOOK  (localStorage for standalone app)
───────────────────────────────────────────────────────────── */
function useStore(key, init) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : init;
    } catch { return init; }
  });
  const update = useCallback((next) => {
    setVal(prev => {
      const v = typeof next === "function" ? next(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
      return v;
    });
  }, [key]);
  return [val, update];
}

/* ─────────────────────────────────────────────────────────────
   VOICE INPUT HOOK
───────────────────────────────────────────────────────────── */
function useVoice(onResult) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);
  const toggle = useCallback(() => {
    if (on) { ref.current?.stop(); setOn(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input is not supported in this browser. Try Chrome."); return; }
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    r.onresult = e => { onResult(e.results[0][0].transcript); setOn(false); };
    r.onerror = () => setOn(false);
    r.onend   = () => setOn(false);
    ref.current = r; r.start(); setOn(true);
  }, [on, onResult]);
  return [on, toggle];
}

/* ─────────────────────────────────────────────────────────────
   SYSTEM PROMPT
───────────────────────────────────────────────────────────── */
function buildPrompt(profile) {
  return `You are "PD Companion", a warm and knowledgeable Parkinson's disease support assistant. Your role is to provide compassionate general educational support to people living with Parkinson's and their caregivers.

${profile.name ? `The user's name is ${profile.name}. Address them warmly by name occasionally.` : ""}
${profile.role === "caregiver" ? "You are speaking with a caregiver. Be sensitive to caregiver challenges, burnout, and grief." : "You are speaking with someone living with Parkinson's disease."}
${profile.concerns?.length ? `Their main concerns include: ${profile.concerns.join(", ")}.` : ""}
${profile.medNotes ? `Medication context (for personalization only — do NOT interpret medically): ${profile.medNotes}` : ""}

ABSOLUTE SAFETY RULES — NEVER violate:
- NEVER diagnose Parkinson's or any condition
- NEVER prescribe, recommend, or suggest specific medication doses
- NEVER advise changing doses or medication timing without physician guidance
- NEVER replace a doctor, pharmacist, physical therapist, occupational therapist, speech-language pathologist, or dietitian
- For urgent concerns (falls with injury, choking, severe swallowing difficulty, new hallucinations, sudden symptom worsening, medication side effects) — IMMEDIATELY urge contacting healthcare team or emergency services (911)

WHAT YOU SHOULD DO:
- Provide warm, compassionate, evidence-informed general educational support
- Encourage consulting their healthcare team for all medical decisions
- End responses about medical/symptom topics with: "This is general educational support, not medical advice. Please contact your healthcare provider for personalized guidance."
- Use simple language, short paragraphs — accessible for older adults and all reading levels
- Be encouraging, never dismissive

TOPICS YOU CAN HELP WITH: Motor symptoms (tremor, rigidity, bradykinesia, freezing, dyskinesia), medication concepts (ON/OFF, wearing off — educational only), fall prevention, home safety, adaptive equipment, daily living adaptations, swallowing safety, eating strategies, nutrition principles, exercise (boxing, cycling, tai chi, dance, swimming), sleep and fatigue, speech and communication, mental health support, caregiver wellbeing, non-motor symptoms (educational only).

Keep responses warm, practical, and concise (2–4 paragraphs for most questions).`.trim();
}

/* ─────────────────────────────────────────────────────────────
   API CALL
───────────────────────────────────────────────────────────── */
async function callAI(history, profile) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("NO_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: buildPrompt(profile),
      messages: history.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.content?.find(c => c.type === "text")?.text || "I couldn't generate a response. Please try again.";
}

/* ─────────────────────────────────────────────────────────────
   API KEY SETUP SCREEN
───────────────────────────────────────────────────────────── */
function ApiKeySetup({ onKey }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const submit = async () => {
    const k = key.trim();
    if (!k.startsWith("sk-ant-")) { setError("That doesn't look like a valid Anthropic API key (should start with sk-ant-)."); return; }
    setTesting(true); setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": k,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role: "user", content: "Hi" }] }),
      });
      if (!res.ok) throw new Error("Invalid key");
      sessionStorage.setItem(SESSION_KEY, k);
      onKey(k);
    } catch {
      setError("Could not connect with that key. Please double-check it and try again.");
    }
    setTesting(false);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f5f4f0", padding: "0 24px", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", maxWidth: 420, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🤝</div>
        <h1 className="serif" style={{ margin: "0 0 8px", fontSize: 24, color: "#0f766e" }}>PD Companion</h1>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#6b7280" }}>Parkinson's Support Assistant</p>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>
          Enter your Anthropic API key to get started. The key is only kept for this session and never stored permanently.
        </p>

        <div style={{ textAlign: "left", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Anthropic API Key
          </label>
          <input
            type="password"
            value={key}
            onChange={e => { setKey(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="sk-ant-api03-..."
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "inherit" }}
          />
        </div>

        {error && (
          <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c", textAlign: "left" }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={submit} disabled={!key.trim() || testing} style={{
          width: "100%", background: "#0d9488", color: "#fff", border: "none",
          borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700,
          cursor: !key.trim() || testing ? "not-allowed" : "pointer",
          opacity: !key.trim() || testing ? 0.5 : 1,
          fontFamily: "inherit",
        }}>
          {testing ? "Connecting…" : "Connect & Start"}
        </button>

        <div style={{ marginTop: 20, padding: "14px", background: "#f0fdfa", borderRadius: 10, textAlign: "left" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#0f766e", lineHeight: 1.6 }}>
            🔑 <strong>Get your key:</strong> Visit{" "}
            <a href="https://console.anthropic.com/keys" target="_blank" rel="noreferrer" style={{ color: "#0d9488" }}>console.anthropic.com/keys</a>
            {" "}and create a new API key. You'll need an Anthropic account.
          </p>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 11, color: "#d1d5db", lineHeight: 1.5 }}>
          ⚠️ Educational support only · Not medical advice · Emergency: call 911
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SHARED UI COMPONENTS
───────────────────────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} role="switch" aria-checked={on} style={{
      position: "relative", width: 48, height: 26, borderRadius: 99,
      background: on ? "#0d9488" : "#d1d5db", border: "none", cursor: "pointer",
      transition: "background 0.2s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 25 : 3, width: 20, height: 20,
        borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 99,
      background: active ? "#ccfbf1" : "#f9fafb",
      border: `1.5px solid ${active ? "#2dd4bf" : "#e5e7eb"}`,
      color: active ? "#0f766e" : "#6b7280",
      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
    }}>{children}</button>
  );
}

function Dots({ value, max = 5, color }) {
  const cols = { teal: "#0d9488", amber: "#f59e0b", blue: "#3b82f6" };
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: i < value ? (cols[color] || cols.teal) : "#f3f4f6" }} />
      ))}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
      {children}
    </p>
  );
}

function SafetyBanner() {
  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠️</span>
      <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
        <strong>Educational support only.</strong> Not medical advice. For medical decisions, always consult your healthcare provider. Emergency: call 911.
      </p>
    </div>
  );
}

function RangeSlider({ label, value, onChange, colorClass = "teal", min = 0, max = 5 }) {
  const textColor = colorClass === "teal" ? "#0d9488" : colorClass === "amber" ? "#f59e0b" : "#3b82f6";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: textColor }}>{value}/{max}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}
        className={colorClass} style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 11, color: "#d1d5db" }}>None</span>
        <span style={{ fontSize: 11, color: "#d1d5db" }}>Severe</span>
      </div>
    </div>
  );
}

function FieldInput({ label, hint, as: As, ...props }) {
  return (
    <div>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</label>}
      {hint && <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 4px" }}>{hint}</p>}
      {As === "textarea" ? (
        <textarea {...props} style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "none", ...props.style }} />
      ) : (
        <input {...props} style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", ...props.style }} />
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style = {}, size = "md" }) {
  const base = { border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 700, borderRadius: 12, transition: "all 0.15s", opacity: disabled ? 0.4 : 1 };
  const sizes = { sm: { padding: "8px 14px", fontSize: 13 }, md: { padding: "12px 20px", fontSize: 14 }, lg: { padding: "14px 20px", fontSize: 15 } };
  const variants = {
    primary:   { background: "#0d9488", color: "#fff" },
    secondary: { background: "#f9fafb", color: "#374151", border: "1.5px solid #e5e7eb" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>{children}</button>;
}

/* ─────────────────────────────────────────────────────────────
   HOME
───────────────────────────────────────────────────────────── */
function HomeScreen({ profile, symptoms, reminders, lt }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const tip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];
  const activeCt = reminders.filter(r => r.active).length;
  const chartData = symptoms.slice(-7).map(s => ({
    n: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    t: s.tremor, s: s.stiffness,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "linear-gradient(135deg,#0f766e,#0891b2)", borderRadius: 20, padding: "22px 22px 20px", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="serif" style={{ margin: "0 0 6px", fontSize: lt ? 24 : 20, fontWeight: 700 }}>
          {greeting}{profile.name ? `, ${profile.name}` : ""}!
        </h1>
        <p style={{ margin: 0, fontSize: lt ? 14 : 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
          {profile.role === "caregiver" ? "Supporting someone you love takes real strength. You're not alone." : "You have support here. One step at a time."}
        </p>
      </div>

      <Card style={{ background: "#fffbeb", border: "1px solid #fef3c7" }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.08em" }}>💡 Daily Tip</p>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>{tip.icon}</span>
          <p style={{ margin: 0, fontSize: lt ? 15 : 13, color: "#78350f", lineHeight: 1.6 }}>{tip.text}</p>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[{ n: activeCt, label: "Active Reminders", icon: "🔔" }, { n: symptoms.length, label: "Symptom Logs", icon: "📊" }].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "16px 12px" }}>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <p style={{ margin: "6px 0 2px", fontSize: lt ? 32 : 28, fontWeight: 800, color: "#0d9488", lineHeight: 1 }}>{s.n}</p>
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{s.label}</p>
          </Card>
        ))}
      </div>

      {chartData.length >= 2 && (
        <Card>
          <p style={{ margin: "0 0 12px", fontSize: lt ? 14 : 13, fontWeight: 700, color: "#374151" }}>7-Day Symptom Trend</p>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 4 }}>
              <XAxis dataKey="n" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <Line type="monotone" dataKey="t" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} name="Tremor" />
              <Line type="monotone" dataKey="s" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Stiffness" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
            {[["#0d9488","Tremor"],["#f59e0b","Stiffness"]].map(([c,l]) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                <span style={{ width: 14, height: 3, borderRadius: 99, background: c, display: "inline-block" }} />{l}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ background: "#fff5f5", border: "1px solid #fecaca" }}>
        <p style={{ margin: "0 0 10px", fontSize: lt ? 14 : 13, fontWeight: 700, color: "#b91c1c" }}>🆘 Support Lines</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[{ label: "Emergency", num: "911", red: true }, { label: "Parkinson's Foundation", num: "1-800-473-4636" }, { label: "APDA Helpline", num: "1-800-223-2732" }].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{r.label}</span>
              <a href={`tel:${r.num}`} style={{ fontSize: 13, fontWeight: 700, color: r.red ? "#dc2626" : "#b91c1c", textDecoration: "none" }}>{r.num}</a>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ background: "#f9fafb" }}>
        <p style={{ margin: "0 0 10px", fontSize: lt ? 14 : 13, fontWeight: 700, color: "#9ca3af" }}>🔮 Coming Soon</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["⌚","Wearable Data"],["📋","Doctor Reports"],["👨‍👩‍👧","Caregiver Dashboard"],["🔊","Text-to-Speech"],["⚖️","Fall Risk Insights"]].map(([ic,lb]) => (
            <div key={lb} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9ca3af" }}>
              <span style={{ fontSize: 16 }}>{ic}</span>{lb}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CHAT
───────────────────────────────────────────────────────────── */
function ChatScreen({ messages, setMessages, profile, lt, onNeedsKey }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const appendVoice = useCallback(t => setInput(p => (p ? p + " " : "") + t), []);
  const [voiceOn, toggleVoice] = useVoice(appendVoice);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const next = [...messages, { role: "user", content: msg, ts: Date.now() }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await callAI(next, profile);
      setMessages(m => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (e) {
      if (e.message === "NO_KEY") {
        onNeedsKey();
        setMessages(next.slice(0, -1));
      } else {
        setMessages(m => [...m, {
          role: "assistant",
          content: "I'm having trouble connecting right now. Please check your connection and try again. If you have an urgent concern, please contact your healthcare provider or call 911.",
          ts: Date.now(),
        }]);
      }
    }
    setLoading(false);
  };

  const STARTERS = ["I feel very stiff today","What helps with freezing of gait?","Explain ON and OFF periods","Tips for preventing falls","How can I improve my sleep?","I'm exhausted — is that normal?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SafetyBanner />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
        {messages.length === 0 ? (
          <div className="fade-in" style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🤝</div>
            <p className="serif" style={{ margin: "0 0 4px", fontSize: lt ? 18 : 16, fontWeight: 700, color: "#1f2937" }}>
              Hello{profile.name ? `, ${profile.name}` : ""}!
            </p>
            <p style={{ margin: "0 0 18px", fontSize: lt ? 14 : 13, color: "#6b7280" }}>
              I'm PD Companion — here to support you with Parkinson's questions.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: "#f0fdfa", border: "1.5px solid #99f6e4", borderRadius: 12,
                  padding: "12px 16px", textAlign: "left", fontSize: lt ? 14 : 13,
                  color: "#0f766e", fontFamily: "inherit", fontWeight: 600, cursor: "pointer",
                }}>"{s}"</button>
              ))}
            </div>
          </div>
        ) : messages.map((m, i) => (
          <div key={i} className="fade-in" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "88%", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "12px 16px",
              background: m.role === "user" ? "#0d9488" : "#fff",
              border: m.role === "user" ? "none" : "1px solid #f3f4f6",
              boxShadow: m.role === "user" ? "none" : "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              {m.content.split("\n").filter(Boolean).map((line, li) => (
                <p key={li} style={{ margin: li > 0 ? "8px 0 0" : 0, fontSize: lt ? 15 : 14, color: m.role === "user" ? "#fff" : "#1f2937", lineHeight: 1.6 }}>{line}</p>
              ))}
              <p style={{ margin: "6px 0 0", fontSize: 11, color: m.role === "user" ? "rgba(255,255,255,0.6)" : "#d1d5db" }}>
                {new Date(m.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: "18px 18px 18px 4px", padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af", animation: `pdBounce 1s ${i*0.15}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ flexShrink: 0, borderTop: "1px solid #f3f4f6", paddingTop: 12, paddingBottom: 4 }}>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>
            ← Clear conversation
          </button>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button onClick={toggleVoice} style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: voiceOn ? "#fee2e2" : "#f9fafb", border: `1.5px solid ${voiceOn ? "#fca5a5" : "#e5e7eb"}`, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {voiceOn ? "🎙️" : "🎤"}
          </button>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about Parkinson's…" rows={2}
            style={{ flex: 1, border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", fontSize: lt ? 15 : 14, fontFamily: "inherit", resize: "none" }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{
            width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: "#0d9488", border: "none",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            opacity: input.trim() && !loading ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SYMPTOMS
───────────────────────────────────────────────────────────── */
function SymptomsScreen({ symptoms, setSymptoms, lt }) {
  const blank = { date: new Date().toISOString().slice(0,16), tremor: 0, stiffness: 0, freezing: false, mood: 2, sleep: 3, onOff: "unsure", notes: "" };
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const save = () => { setSymptoms(s => [...s, { ...form, id: Date.now() }]); setForm(blank); setOpen(false); };
  const pal = v => ({ on: { bg: "#f0fdf4", border: "#86efac", text: "#15803d" }, off: { bg: "#fff5f5", border: "#fca5a5", text: "#dc2626" }, unsure: { bg: "#f9fafb", border: "#e5e7eb", text: "#6b7280" } }[v]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="serif" style={{ margin: 0, fontSize: lt ? 22 : 19, color: "#1f2937" }}>Symptom Log</h2>
        <Btn onClick={() => setOpen(!open)} size="sm">{open ? "✕ Cancel" : "+ Log Now"}</Btn>
      </div>

      {open && (
        <Card className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ margin: 0, fontSize: lt ? 16 : 14, fontWeight: 700, color: "#374151" }}>How are you feeling right now?</p>
          <FieldInput label="Date & Time" type="datetime-local" value={form.date} onChange={e => f("date")(e.target.value)} />
          <RangeSlider label="Tremor Level" value={form.tremor} onChange={f("tremor")} colorClass="teal" />
          <RangeSlider label="Stiffness Level" value={form.stiffness} onChange={f("stiffness")} colorClass="amber" />
          <div>
            <SectionLabel>Mood</SectionLabel>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px" }}>
              {MOODS.map((emoji, i) => (
                <button key={i} onClick={() => f("mood")(i)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: "8px 10px", borderRadius: 12, border: `2px solid ${form.mood === i ? "#5eead4" : "transparent"}`,
                  background: form.mood === i ? "#f0fdfa" : "transparent", cursor: "pointer",
                  transform: form.mood === i ? "scale(1.1)" : "scale(1)", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 24 }}>{emoji}</span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{MOOD_LABELS[i]}</span>
                </button>
              ))}
            </div>
          </div>
          <RangeSlider label="Sleep Quality" value={form.sleep} onChange={f("sleep")} colorClass="blue" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "12px 16px" }}>
            <div>
              <p style={{ margin: 0, fontSize: lt ? 14 : 13, fontWeight: 700, color: "#374151" }}>Freezing Episode?</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>Did you freeze while walking today?</p>
            </div>
            <Toggle on={form.freezing} onChange={() => f("freezing")(!form.freezing)} />
          </div>
          <div>
            <SectionLabel>Medication / ON-OFF Status</SectionLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {[["on","✓ ON"],["off","✗ OFF"],["unsure","? Unsure"]].map(([v, label]) => {
                const p = pal(v);
                return (
                  <button key={v} onClick={() => f("onOff")(v)} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: form.onOff === v ? p.bg : "#f9fafb",
                    border: `2px solid ${form.onOff === v ? p.border : "#e5e7eb"}`,
                    color: form.onOff === v ? p.text : "#9ca3af", cursor: "pointer", fontFamily: "inherit",
                  }}>{label}</button>
                );
              })}
            </div>
          </div>
          <FieldInput label="Notes (optional)" as="textarea" rows={3} placeholder="Any other observations…" value={form.notes} onChange={e => f("notes")(e.target.value)} />
          <Btn onClick={save} size="lg" style={{ width: "100%" }}>Save Log Entry</Btn>
        </Card>
      )}

      {symptoms.length === 0 && !open ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>📊</div>
          <p style={{ margin: 0, fontSize: lt ? 15 : 13 }}>No symptom logs yet. Tap "+ Log Now" to start.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...symptoms].reverse().map(s => {
            const p = pal(s.onOff || "unsure");
            return (
              <Card key={s.id} className="fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: lt ? 14 : 13, fontWeight: 700, color: "#374151" }}>
                      {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>
                      {new Date(s.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{MOODS[s.mood ?? 2]}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: p.bg, border: `1.5px solid ${p.border}`, color: p.text }}>
                      {(s.onOff || "?").toUpperCase()}
                    </span>
                    <button onClick={() => setSymptoms(prev => prev.filter(x => x.id !== s.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 14 }}>✕</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                  {[["Tremor",s.tremor,"teal"],["Stiffness",s.stiffness,"amber"],["Sleep",s.sleep,"blue"]].map(([l,v,c]) => (
                    <div key={l} style={{ textAlign: "center" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, color: "#9ca3af" }}>{l}</p>
                      <Dots value={v} color={c} />
                    </div>
                  ))}
                </div>
                {s.freezing && <span style={{ fontSize: 11, background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c", padding: "3px 8px", borderRadius: 8, display: "inline-block", marginBottom: 6 }}>⚡ Freezing episode</span>}
                {s.notes && <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{s.notes}"</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   REMINDERS
───────────────────────────────────────────────────────────── */
function RemindersScreen({ reminders, setReminders, lt }) {
  const blank = { title: "", type: "medication", time: "09:00", repeat: "daily", active: true, notes: "" };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [open, setOpen] = useState(false);
  const openNew = () => { setForm(blank); setEditId(null); setOpen(true); };
  const openEdit = r => { setForm({ ...r }); setEditId(r.id); setOpen(true); };
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const save = () => {
    if (!form.title.trim()) return;
    if (editId) setReminders(rs => rs.map(r => r.id === editId ? { ...form, id: editId } : r));
    else setReminders(rs => [...rs, { ...form, id: `r${Date.now()}` }]);
    setOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="serif" style={{ margin: 0, fontSize: lt ? 22 : 19, color: "#1f2937" }}>Reminders</h2>
        <Btn onClick={openNew} size="sm">+ Add</Btn>
      </div>

      {open && (
        <Card className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: lt ? 16 : 14, fontWeight: 700, color: "#374151" }}>{editId ? "Edit" : "New"} Reminder</p>
          <FieldInput label="Title" placeholder="e.g. Evening Medication" value={form.title} onChange={e => f("title")(e.target.value)} />
          <div>
            <SectionLabel>Type</SectionLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(R_META).map(([t, m]) => (
                <button key={t} onClick={() => f("type")(t)} style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "10px 4px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                  background: form.type === t ? "#f0fdfa" : "#f9fafb",
                  border: `2px solid ${form.type === t ? "#5eead4" : "#e5e7eb"}`,
                  color: form.type === t ? "#0f766e" : "#9ca3af", fontWeight: 700, fontSize: 13,
                }}>
                  <span style={{ fontSize: 22 }}>{m.icon}</span>
                  <span style={{ textTransform: "capitalize" }}>{t}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FieldInput label="Time" type="time" value={form.time} onChange={e => f("time")(e.target.value)} />
            <div>
              <SectionLabel>Repeat</SectionLabel>
              <select value={form.repeat} onChange={e => f("repeat")(e.target.value)} style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit" }}>
                <option value="daily">Daily</option><option value="weekdays">Weekdays</option>
                <option value="weekends">Weekends</option><option value="once">Once</option>
              </select>
            </div>
          </div>
          <FieldInput label="Notes (optional)" placeholder="e.g. Take with food" value={form.notes} onChange={e => f("notes")(e.target.value)} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setOpen(false)} variant="secondary" style={{ flex: 1 }}>Cancel</Btn>
            <Btn onClick={save} style={{ flex: 1 }}>Save</Btn>
          </div>
        </Card>
      )}

      {reminders.length === 0 && !open ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🔔</div>
          <p style={{ margin: 0, fontSize: lt ? 15 : 13 }}>No reminders yet.</p>
        </div>
      ) : Object.entries(R_META).map(([type, meta]) => {
        const group = reminders.filter(r => r.type === type);
        if (!group.length) return null;
        return (
          <div key={type}>
            <SectionLabel>{meta.icon} {type}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {group.map(r => (
                <div key={r.id} className="fade-in" style={{
                  background: r.active ? meta.bg : "#f9fafb", border: `1.5px solid ${r.active ? meta.border : "#e5e7eb"}`,
                  borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                  opacity: r.active ? 1 : 0.6, transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: lt ? 15 : 14, fontWeight: 700, color: "#374151" }}>{r.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>{r.time} · {r.repeat}</p>
                    {r.notes && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => openEdit(r)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✏️</button>
                    <Toggle on={r.active} onChange={() => setReminders(rs => rs.map(x => x.id === r.id ? { ...x, active: !x.active } : x))} />
                    <button onClick={() => setReminders(rs => rs.filter(x => x.id !== r.id))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#d1d5db" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PROFILE
───────────────────────────────────────────────────────────── */
function ProfileScreen({ profile, setProfile, lt, onResetKey }) {
  const [form, setForm] = useState({ ...profile });
  const [saved, setSaved] = useState(false);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const toggleConcern = c => setForm(p => ({ ...p, concerns: p.concerns.includes(c) ? p.concerns.filter(x => x !== c) : [...p.concerns, c] }));
  const save = () => { setProfile(form); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="serif" style={{ margin: 0, fontSize: lt ? 22 : 19, color: "#1f2937" }}>Your Profile</h2>
      <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <FieldInput label="Preferred Name" placeholder="What should I call you?" value={form.name} onChange={e => f("name")(e.target.value)} />
        <div>
          <SectionLabel>I am a…</SectionLabel>
          <div style={{ display: "flex", gap: 12 }}>
            {[{v:"person",icon:"🫂",label:"Person with\nParkinson's"},{v:"caregiver",icon:"❤️",label:"Caregiver or\nFamily Member"}].map(o => (
              <button key={o.v} onClick={() => f("role")(o.v)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 8px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                background: form.role === o.v ? "#f0fdfa" : "#f9fafb",
                border: `2px solid ${form.role === o.v ? "#5eead4" : "#e5e7eb"}`,
                color: form.role === o.v ? "#0f766e" : "#6b7280",
              }}>
                <span style={{ fontSize: 32 }}>{o.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.3 }}>{o.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Main Concerns</SectionLabel>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9ca3af" }}>Select all that apply — I'll tailor my responses.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CONCERNS.map(c => <Pill key={c} active={form.concerns.includes(c)} onClick={() => toggleConcern(c)}>{c}</Pill>)}
          </div>
        </div>
        <FieldInput label="Medication Notes" hint="Optional. Do not include specific doses." as="textarea" rows={3} placeholder="e.g. Take levodopa 3×/day, best ON window is mid-morning" value={form.medNotes} onChange={e => f("medNotes")(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 12, padding: "14px 16px" }}>
          <div>
            <p style={{ margin: 0, fontSize: lt ? 14 : 13, fontWeight: 700, color: "#374151" }}>Large Text Mode</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>Increases text size throughout the app</p>
          </div>
          <Toggle on={form.largeText} onChange={() => f("largeText")(!form.largeText)} />
        </div>
        <Btn onClick={save} size="lg" style={{ width: "100%", background: saved ? "#22c55e" : "#0d9488" }}>
          {saved ? "✓ Profile Saved!" : "Save Profile"}
        </Btn>
      </Card>
      <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 12, padding: "12px 14px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6b7280", fontWeight: 700 }}>API Key</p>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>
          {ENV_KEY ? "API key is set via environment variable." : "Your API key is stored for this session only and cleared when you close the tab."}
        </p>
        {!ENV_KEY && (
          <button onClick={onResetKey} style={{ fontSize: 12, color: "#0d9488", background: "none", border: "1px solid #5eead4", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            Change API Key
          </button>
        )}
      </div>
      <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 12, padding: "12px 14px" }}>
        <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
          🔒 Profile and symptom data are stored locally in your browser's localStorage. Chat messages are sent to the Claude API to generate responses and are not stored on any server.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BOTTOM NAV
───────────────────────────────────────────────────────────── */
function BottomNav({ tab, setTab, lt }) {
  const TABS = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "symptoms", icon: "📊", label: "Symptoms" },
    { id: "reminders", icon: "🔔", label: "Reminders" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];
  return (
    <div style={{ flexShrink: 0, background: "#fff", borderTop: "1px solid #f3f4f6", display: "flex" }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          gap: 2, padding: "10px 4px 8px", background: "none", border: "none",
          cursor: "pointer", color: tab === t.id ? "#0d9488" : "#9ca3af", fontFamily: "inherit",
        }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
          <span style={{ fontSize: lt ? 11 : 10, fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</span>
          {tab === t.id && <div style={{ width: 16, height: 3, borderRadius: 99, background: "#0d9488", marginTop: 1 }} />}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   APP ROOT
───────────────────────────────────────────────────────────── */
export default function App() {
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useStore("pd_profile", { name: "", role: "person", concerns: [], medNotes: "", largeText: false });
  const [messages, setMessages] = useStore("pd_messages", []);
  const [symptoms, setSymptoms] = useStore("pd_symptoms", []);
  const [reminders, setReminders] = useStore("pd_reminders", DEFAULT_REMINDERS);

  const lt = profile.largeText;

  if (!hasKey) {
    return <ApiKeySetup onKey={() => setHasKey(true)} />;
  }

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#f5f4f0", maxWidth: 500, margin: "0 auto",
      fontFamily: "'Nunito', sans-serif", fontSize: lt ? 16 : 14,
    }}>
      <div style={{ flexShrink: 0, background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="serif" style={{ margin: 0, fontSize: lt ? 22 : 19, color: "#0f766e", lineHeight: 1 }}>PD Companion</h1>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>Parkinson's Support Assistant</p>
          </div>
          <div style={{ background: "#f0fdfa", color: "#0f766e", borderRadius: 99, padding: "4px 12px", fontSize: lt ? 13 : 12, fontWeight: 700 }}>
            {profile.role === "caregiver" ? "Caregiver" : profile.name || "Welcome"}
          </div>
        </div>
      </div>

      {tab === "chat" ? (
        <div style={{ flex: 1, overflow: "hidden", padding: "14px 16px 10px" }}>
          <ChatScreen messages={messages} setMessages={setMessages} profile={profile} lt={lt} onNeedsKey={() => { sessionStorage.removeItem(SESSION_KEY); setHasKey(false); }} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 12px" }}>
          {tab === "home"      && <HomeScreen profile={profile} symptoms={symptoms} reminders={reminders} lt={lt} />}
          {tab === "symptoms"  && <SymptomsScreen symptoms={symptoms} setSymptoms={setSymptoms} lt={lt} />}
          {tab === "reminders" && <RemindersScreen reminders={reminders} setReminders={setReminders} lt={lt} />}
          {tab === "profile"   && <ProfileScreen profile={profile} setProfile={setProfile} lt={lt} onResetKey={() => { sessionStorage.removeItem(SESSION_KEY); setHasKey(false); }} />}
        </div>
      )}

      <BottomNav tab={tab} setTab={setTab} lt={lt} />
    </div>
  );
}
