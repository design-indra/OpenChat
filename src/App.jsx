import { useState, useRef, useEffect, useCallback } from "react";

/* ─── Models ─────────────────────────────────────────────────────────── */
// Updated: model free aktif per Juni 2026
const FREE_MODELS = [
  { id: "openrouter/auto",                               name: "Auto (Pilih Terbaik)",  tag: "⚡Auto",   vision: true  },
  { id: "meta-llama/llama-4-maverick:free",              name: "Llama 4 Maverick",      tag: "Vision",   vision: true  },
  { id: "meta-llama/llama-4-scout:free",                 name: "Llama 4 Scout",         tag: "Fast",     vision: false },
  { id: "meta-llama/llama-3.3-70b-instruct:free",       name: "Llama 3.3 70B",         tag: "Smart",    vision: false },
  { id: "deepseek/deepseek-chat-v3-0324:free",           name: "DeepSeek V3",           tag: "Top",      vision: false },
  { id: "deepseek/deepseek-r1:free",                     name: "DeepSeek R1",           tag: "Reason",   vision: false },
  { id: "deepseek/deepseek-r1-0528:free",                name: "DeepSeek R1 (Latest)",  tag: "New",      vision: false },
  { id: "qwen/qwen3-235b-a22b:free",                     name: "Qwen3 235B",            tag: "Large",    vision: false },
  { id: "qwen/qwen3-30b-a3b:free",                       name: "Qwen3 30B",             tag: "Balanced", vision: false },
  { id: "qwen/qwq-32b:free",                             name: "QwQ 32B",               tag: "Reason",   vision: false },
  { id: "google/gemini-2.0-flash-exp:free",              name: "Gemini 2.0 Flash",      tag: "Google",   vision: true  },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2",     tag: "Mistral",  vision: true  },
  { id: "microsoft/mai-ds-r1:free",                      name: "Microsoft MAI-DS-R1",   tag: "MS",       vision: false },
];

// Deteksi error "endpoint tidak tersedia" → perlu ganti model
const isEndpointError = (msg = "") =>
  msg.toLowerCase().includes("no endpoints found") ||
  msg.toLowerCase().includes("no providers") ||
  msg.toLowerCase().includes("provider error") ||
  msg.toLowerCase().includes("model_not_found");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Gagal membaca file"));
    r.readAsDataURL(file);
  });

const fileToText = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Gagal membaca teks"));
    r.readAsText(file, "utf-8");
  });

// FIX: Baca ZIP sebagai ArrayBuffer, konversi ke string yang bisa dibaca
const readZip = async (file) => {
  try {
    // Coba baca sebagai teks dulu (ZIP mungkin berisi file teks)
    const text = await fileToText(file);
    // Saring karakter non-printable (karakter binary dalam ZIP)
    const printable = text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "?");
    const preview = printable.slice(0, 5000).trim();
    if (preview.length > 50) {
      return `[File ZIP: "${file.name}" | Ukuran: ${formatSize(file.size)}]\n\nIsi terbaca (mungkin parsial):\n\`\`\`\n${preview}\n\`\`\`\n\n⚠️ ZIP adalah format binary. Untuk analisis lengkap, ekstrak file terlebih dahulu.`;
    }
    throw new Error("Isi tidak terbaca");
  } catch {
    return `[File ZIP: "${file.name}" | Ukuran: ${formatSize(file.size)}]\n\nℹ️ File ZIP binary tidak dapat dibaca langsung. Detail:\n- Nama: ${file.name}\n- Ukuran: ${formatSize(file.size)}\n- Tipe: ${file.type || "application/zip"}\n\nSilakan ekstrak file ZIP dan upload file di dalamnya secara langsung.`;
  }
};

const getFileIcon = (type, name) => {
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/zip" || type === "application/x-zip-compressed" || name.endsWith(".zip")) return "🗜️";
  if (type === "application/pdf") return "📄";
  if (type.includes("text") || name.match(/\.(txt|md|csv|json|js|ts|jsx|tsx|py|html|css|xml|yaml|yml|env|sh|php|java|cpp|c|go|rs)$/i)) return "📝";
  if (name.match(/\.(doc|docx)$/i)) return "📃";
  return "📎";
};

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
};

/* ─── Sub-components ──────────────────────────────────────────────────── */
const TypingDots = () => (
  <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 0" }}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 7, height: 7, borderRadius: "50%", background: "#7c6fff",
          display: "inline-block",
          animation: `tdot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
  </div>
);

const FileChip = ({ att, onRemove }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "5px 10px", borderRadius: 20,
    background: att.type?.startsWith("image/")
      ? "rgba(99,179,237,0.15)" : "rgba(124,111,255,0.15)",
    border: att.type?.startsWith("image/")
      ? "1px solid rgba(99,179,237,0.3)" : "1px solid rgba(124,111,255,0.3)",
    fontSize: 12, color: "#c4b9ff", maxWidth: 220,
    flexShrink: 0,
  }}>
    <span>{getFileIcon(att.type || "", att.name)}</span>
    {att.preview && (
      <img
        src={att.preview}
        alt=""
        style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover" }}
      />
    )}
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
      {att.name}
    </span>
    <span style={{ color: "#6b6490", fontSize: 10 }}>{formatSize(att.size)}</span>
    {onRemove && (
      <button
        onClick={onRemove}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#6b6490", fontSize: 14, padding: 0, lineHeight: 1,
          marginLeft: 2,
        }}
      >×</button>
    )}
  </div>
);

const MessageBubble = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 18, alignItems: "flex-end", gap: 10,
    }}>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #7c6fff, #a78bfa)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
          boxShadow: "0 2px 10px rgba(124,111,255,0.4)",
        }}>🤖</div>
      )}
      <div style={{
        maxWidth: "75%", display: "flex", flexDirection: "column", gap: 6,
        alignItems: isUser ? "flex-end" : "flex-start",
      }}>
        {/* Attachments preview */}
        {msg.attachments?.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
            justifyContent: isUser ? "flex-end" : "flex-start",
          }}>
            {msg.attachments.map((att, i) =>
              att.type?.startsWith("image/") && att.preview ? (
                <img
                  key={i}
                  src={att.preview}
                  alt={att.name}
                  style={{
                    maxWidth: 220, maxHeight: 160, borderRadius: 12, objectFit: "cover",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                />
              ) : (
                <FileChip key={i} att={att} />
              )
            )}
          </div>
        )}
        {/* Text bubble */}
        {msg.content && (
          <div style={{
            padding: "11px 15px",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            background: isUser
              ? "linear-gradient(135deg, #7c6fff, #5b4fdb)"
              : "rgba(255,255,255,0.06)",
            color: "#f0eeff", fontSize: 14, lineHeight: 1.68,
            border: isUser ? "none" : "1px solid rgba(255,255,255,0.08)",
            wordBreak: "break-word", whiteSpace: "pre-wrap",
            boxShadow: isUser ? "0 4px 15px rgba(124,111,255,0.3)" : "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            {msg.content}
          </div>
        )}
      </div>
      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>👤</div>
      )}
    </div>
  );
};

/* ─── Main App ────────────────────────────────────────────────────────── */
export default function App() {
  const [apiKey, setApiKey]             = useState("");
  const [savedKey, setSavedKey]         = useState("");
  const [model, setModel]               = useState(FREE_MODELS[0].id);
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful AI assistant. When given files or images, analyze and describe them thoroughly."
  );
  const [showSidebar, setShowSidebar]   = useState(true);
  const [attachments, setAttachments]   = useState([]);
  const [dragging, setDragging]         = useState(false);
  const [fileError, setFileError]       = useState("");

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const fileInputRef   = useRef(null);
  const dragCounter    = useRef(0); // FIX: pakai counter agar dragLeave tidak false-trigger

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  /* ── File processing ── */
  const processFiles = useCallback(async (files) => {
    setFileError("");
    const newAtts = [];
    for (const file of files) {
      // FIX: validasi ukuran file
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`❌ File "${file.name}" terlalu besar (maks 10 MB)`);
        continue;
      }

      const isImage = file.type.startsWith("image/");
      // FIX: deteksi ZIP lebih lengkap termasuk application/x-zip-compressed
      const isZip =
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed" ||
        (file.type === "application/octet-stream" && file.name.endsWith(".zip")) ||
        file.name.endsWith(".zip");

      let base64 = null, textContent = null, preview = null;

      try {
        if (isImage) {
          base64  = await fileToBase64(file);
          preview = URL.createObjectURL(file);
        } else if (isZip) {
          textContent = await readZip(file);
        } else {
          textContent = await fileToText(file);
        }
      } catch (err) {
        textContent = `[Tidak bisa membaca file "${file.name}": ${err.message}]`;
      }

      newAtts.push({
        name: file.name,
        type: file.type || "",
        size: file.size,
        base64,
        textContent,
        preview,
        isImage,
        isZip,
      });
    }
    if (newAtts.length > 0) {
      setAttachments((prev) => [...prev, ...newAtts]);
    }
  }, []);

  // FIX: accept file input yang lebih komprehensif termasuk .zip dengan proper MIME
  const handleFilePick = (e) => {
    if (e.target.files?.length) {
      processFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  // FIX: drag counter mencegah flickering saat hover child element
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);
      if (e.dataTransfer.files?.length) {
        processFiles(Array.from(e.dataTransfer.files));
      }
    },
    [processFiles]
  );

  const removeAttachment = (i) =>
    setAttachments((prev) => {
      // FIX: revoke object URL agar tidak memory leak
      if (prev[i]?.preview) URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });

  /* ── Build API content ── */
  // FIX: terima history yang sudah final (bukan state lama)
  const buildApiMessages = (history, pendingAtts, userText) => {
    const currentContent = [];

    // Tambahkan teks file / ZIP sebagai blok teks
    for (const att of pendingAtts) {
      if (!att.isImage && att.textContent) {
        currentContent.push({
          type: "text",
          text: `📎 File: ${att.name}\n\`\`\`\n${att.textContent.slice(0, 8000)}\n\`\`\``,
        });
      }
    }

    // Tambahkan gambar
    for (const att of pendingAtts) {
      if (att.isImage && att.base64) {
        const mt = att.type || "image/jpeg";
        currentContent.push({
          type: "image_url",
          image_url: { url: `data:${mt};base64,${att.base64}` },
        });
      }
    }

    if (userText.trim()) {
      currentContent.push({ type: "text", text: userText.trim() });
    }

    // History hanya kirim teks (hemat token), skip pesan dengan content kosong
    const apiHistory = history
      .map((m) => ({ role: m.role, content: m.content || "" }))
      .filter((m) => m.content.trim() !== "");

    // FIX: jika hanya 1 blok teks, kirim sebagai string biasa (lebih kompatibel)
    const lastContent =
      currentContent.length === 1 && currentContent[0].type === "text"
        ? currentContent[0].text
        : currentContent;

    return [...apiHistory, { role: "user", content: lastContent }];
  };

  /* ── Send ── */
  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    if (!savedKey) {
      setError("Masukkan API Key OpenRouter terlebih dahulu!");
      return;
    }

    // FIX: cegah kirim gambar ke model yang tidak support vision
    const hasImages = attachments.some((a) => a.isImage);
    if (hasImages && !selectedModel?.vision) {
      setError(`❌ Model "${selectedModel?.name}" tidak mendukung gambar. Pilih model dengan tag 👁 Vision.`);
      return;
    }

    const pendingAtts = [...attachments];
    const userText    = input.trim();

    // Pesan tampilan (UI)
    const displayMsg = {
      role: "user",
      content: userText,
      attachments: pendingAtts.map((a) => ({
        name: a.name,
        type: a.type,
        size: a.size,
        preview: a.preview,
      })),
    };

    // FIX: simpan snapshot history sebelum update state
    const historyBeforeSend = [...messages];
    const newHistory        = [...historyBeforeSend, displayMsg];

    setMessages(newHistory);
    setInput("");
    setAttachments([]);
    setFileError("");
    setLoading(true);
    setError("");

    // Daftar model untuk dicoba: model yang dipilih dulu, lalu fallback
    const modelQueue = model === "openrouter/auto"
      ? ["openrouter/auto"]
      : [model, "openrouter/auto", "meta-llama/llama-4-scout:free"];

    let lastError = null;

    try {
      const apiMessages = buildApiMessages(historyBeforeSend, pendingAtts, userText);
      let replied = false;

      for (const tryModel of modelQueue) {
        try {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${savedKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://openrouter-chat.vercel.app",
              "X-Title": "AI Chat Tool",
            },
            body: JSON.stringify({
              model: tryModel,
              messages: [{ role: "system", content: systemPrompt }, ...apiMessages],
            }),
          });

          const data = await res.json();
          const errMsg = data.error?.message || "";

          // Jika endpoint tidak tersedia, coba model berikutnya
          if (!res.ok && isEndpointError(errMsg)) {
            lastError = errMsg;
            continue;
          }
          if (!res.ok) throw new Error(errMsg || `Error ${res.status}`);

          const reply = data.choices?.[0]?.message?.content || "No response.";
          const usedModel = FREE_MODELS.find(m => m.id === tryModel);
          const suffix = tryModel !== model && usedModel
            ? `

_(Auto-fallback ke: ${usedModel.name})_` : "";
          setMessages((prev) => [...prev, { role: "assistant", content: reply + suffix }]);
          replied = true;
          break;
        } catch (innerErr) {
          lastError = innerErr.message;
          if (!isEndpointError(innerErr.message)) throw innerErr;
        }
      }

      if (!replied) {
        throw new Error(lastError || "Semua model tidak tersedia. Coba lagi nanti.");
      }
    } catch (e) {
      setError("❌ " + (e.message || "Gagal terhubung ke OpenRouter"));
      setMessages(historyBeforeSend);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedModel = FREE_MODELS.find((m) => m.id === model);

  /* ── Render ── */
  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        display: "flex", height: "100vh", width: "100%",
        background: "#0f0e1a",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: "hidden", position: "relative",
      }}
    >
      <style>{`
        @keyframes tdot {
          0%,60%,100% { transform:translateY(0); opacity:.5 }
          30% { transform:translateY(-6px); opacity:1 }
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(124,111,255,.3); border-radius:2px }
        textarea { resize:none !important }
        .msg-in { animation:fadeUp .3s ease }
        .model-row:hover { background:rgba(124,111,255,.15) !important }
        .ibtn:hover { background:rgba(255,255,255,.1) !important }
        .send-btn:not(:disabled):hover { transform:scale(1.06); filter:brightness(1.1) }
        .attach-btn:hover { background:rgba(124,111,255,.2) !important; border-color:rgba(124,111,255,.4) !important }
      `}</style>

      {/* ── Drag overlay ── */}
      {dragging && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(124,111,255,.18)",
          border: "3px dashed rgba(124,111,255,.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(6px)", pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center", color: "#c4b9ff" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Lepas file di sini</div>
            <div style={{ fontSize: 13, opacity: .7, marginTop: 4 }}>Gambar, ZIP, teks, PDF…</div>
          </div>
        </div>
      )}

      {/* ── Hidden file input ── */}
      {/* FIX: accept lebih lengkap, tambahkan application/zip MIME type */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/zip,application/x-zip-compressed,.zip,.txt,.md,.json,.csv,.js,.ts,.jsx,.tsx,.py,.html,.css,.xml,.pdf,.doc,.docx,.yaml,.yml,.env,.sh,.php,.java,.cpp,.c,.go,.rs"
        onChange={handleFilePick}
        style={{ display: "none" }}
      />

      {/* ════════ SIDEBAR ════════ */}
      {showSidebar && (
        <div style={{
          width: 272, flexShrink: 0,
          background: "rgba(255,255,255,.03)",
          borderRight: "1px solid rgba(255,255,255,.07)",
          display: "flex", flexDirection: "column",
          padding: "18px 14px", gap: 18,
          backdropFilter: "blur(20px)",
          animation: "fadeUp .3s ease",
          overflowY: "auto",
        }}>
          {/* Logo */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,.07)",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg,#7c6fff,#a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, boxShadow: "0 4px 12px rgba(124,111,255,.4)",
            }}>✦</div>
            <div>
              <div style={{ color: "#e2ddff", fontWeight: 700, fontSize: 14 }}>AI Chat Tool</div>
              <div style={{ color: "#7c6fff", fontSize: 11 }}>via OpenRouter</div>
            </div>
          </div>

          {/* API Key */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{
              color: "#9d96cc", fontSize: 10, fontWeight: 700,
              letterSpacing: ".08em", textTransform: "uppercase",
            }}>API Key</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="password"
                placeholder="sk-or-v1-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSavedKey(apiKey.trim())}
                style={{
                  flex: 1, padding: "8px 11px",
                  background: "rgba(255,255,255,.05)",
                  border: savedKey
                    ? "1px solid rgba(124,111,255,.5)"
                    : "1px solid rgba(255,255,255,.1)",
                  borderRadius: 8, color: "#e2ddff", fontSize: 12, outline: "none",
                }}
              />
              <button
                onClick={() => setSavedKey(apiKey.trim())}
                style={{
                  padding: "8px 11px",
                  background: "linear-gradient(135deg,#7c6fff,#5b4fdb)",
                  border: "none", borderRadius: 8, color: "white",
                  fontSize: 12, cursor: "pointer", fontWeight: 700,
                }}
              >{savedKey ? "✓" : "Save"}</button>
            </div>
            {savedKey
              ? <div style={{ color: "#4ade80", fontSize: 11 }}>✓ Tersimpan</div>
              : <div style={{ color: "#6b6490", fontSize: 11 }}>openrouter.ai/keys</div>}
          </div>

          {/* Model */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{
              color: "#9d96cc", fontSize: 10, fontWeight: 700,
              letterSpacing: ".08em", textTransform: "uppercase",
            }}>Model Gratis</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflowY: "auto" }}>
              {FREE_MODELS.map((m) => (
                <div
                  key={m.id}
                  className="model-row"
                  onClick={() => setModel(m.id)}
                  style={{
                    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                    background: model === m.id ? "rgba(124,111,255,.2)" : "transparent",
                    border: model === m.id
                      ? "1px solid rgba(124,111,255,.4)"
                      : "1px solid transparent",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", transition: "all .15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {m.vision && <span title="Support gambar" style={{ fontSize: 12 }}>👁</span>}
                    <span style={{ color: model === m.id ? "#c4b9ff" : "#9d96cc", fontSize: 12 }}>
                      {m.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 99,
                    background: model === m.id ? "rgba(124,111,255,.3)" : "rgba(255,255,255,.06)",
                    color: model === m.id ? "#a78bfa" : "#6b6490", fontWeight: 700,
                  }}>{m.tag}</span>
                </div>
              ))}
            </div>
            {selectedModel?.vision && (
              <div style={{ fontSize: 11, color: "#7c6fff", display: "flex", alignItems: "center", gap: 4 }}>
                👁 Model ini mendukung gambar
              </div>
            )}
          </div>

          {/* System Prompt */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{
              color: "#9d96cc", fontSize: 10, fontWeight: 700,
              letterSpacing: ".08em", textTransform: "uppercase",
            }}>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              style={{
                padding: "8px 11px", background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.1)", borderRadius: 8,
                color: "#e2ddff", fontSize: 12, outline: "none",
                lineHeight: 1.5, resize: "vertical",
              }}
            />
          </div>

          {/* File format info */}
          <div style={{
            padding: "10px 12px", background: "rgba(124,111,255,.07)",
            border: "1px solid rgba(124,111,255,.15)", borderRadius: 10,
            fontSize: 11, color: "#7c6b9e", lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: "#9d87cc", marginBottom: 4 }}>📎 Format yang didukung</div>
            <div>🖼️ Gambar: JPG, PNG, GIF, WebP</div>
            <div>🗜️ Arsip: ZIP (info metadata)</div>
            <div>📝 Teks: TXT, MD, JSON, CSV, JS, PY…</div>
            <div style={{ marginTop: 4, color: "#6b5e8e" }}>Drag & drop ke mana saja ✓ · Maks 10 MB</div>
          </div>

          {/* Info fallback */}
          <div style={{
            padding: "9px 12px", background: "rgba(74,222,128,.06)",
            border: "1px solid rgba(74,222,128,.15)", borderRadius: 10,
            fontSize: 11, color: "#6b9e7c", lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: "#4ade80", marginBottom: 3 }}>⚡ Auto Fallback Aktif</div>
            <div>Jika model utama error, otomatis coba model lain.</div>
            <div style={{ marginTop: 3, color: "#3d6050" }}>Pilih "Auto" untuk hasil terbaik.</div>
          </div>

          {/* Clear */}
          <div style={{ marginTop: "auto" }}>
            <button
              onClick={() => { setMessages([]); setError(""); setAttachments([]); setFileError(""); }}
              style={{
                width: "100%", padding: "9px",
                background: "rgba(239,68,68,.1)",
                border: "1px solid rgba(239,68,68,.2)",
                borderRadius: 8, color: "#f87171",
                fontSize: 12, cursor: "pointer", fontWeight: 700,
              }}
            >🗑 Hapus Chat</button>
          </div>
        </div>
      )}

      {/* ════════ CHAT AREA ════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header - sticky agar tidak tertutup konten */}
        <div style={{
          padding: "13px 18px",
          borderBottom: "1px solid rgba(255,255,255,.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(15,14,26,0.92)", backdropFilter: "blur(10px)",
          position: "sticky", top: 0, zIndex: 10, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="ibtn"
              onClick={() => setShowSidebar((v) => !v)}
              style={{
                background: "transparent", border: "none", color: "#9d96cc",
                cursor: "pointer", fontSize: 18, padding: "5px 7px",
                borderRadius: 8, transition: "background .15s",
              }}
            >☰</button>
            <div>
              <div style={{
                color: "#e2ddff", fontWeight: 600, fontSize: 14,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {selectedModel?.name}
                {selectedModel?.vision && (
                  <span style={{ fontSize: 11, color: "#7c6fff" }}>👁 Vision</span>
                )}
              </div>
              <div style={{ color: savedKey ? "#4ade80" : "#f87171", fontSize: 11 }}>
                {savedKey ? "● Terkoneksi" : "○ Belum terkoneksi"}
              </div>
            </div>
          </div>
          <div style={{ color: "#6b6490", fontSize: 12 }}>
            {messages.length > 0 && `${messages.length} pesan`}
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "22px 18px",
          display: "flex", flexDirection: "column",
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 14, opacity: .65,
            }}>
              <div style={{ fontSize: 46 }}>✦</div>
              <div style={{ color: "#9d96cc", fontSize: 15, fontWeight: 500 }}>Mulai percakapan</div>
              <div style={{
                color: "#6b6490", fontSize: 13, textAlign: "center",
                maxWidth: 320, lineHeight: 1.6,
              }}>
                {savedKey
                  ? "Kirim pesan atau lampirkan file gambar/ZIP untuk mulai."
                  : "Masukkan API Key OpenRouter di panel kiri untuk memulai."}
              </div>
              {savedKey && (
                <div style={{
                  display: "flex", gap: 10, marginTop: 4,
                  flexWrap: "wrap", justifyContent: "center",
                }}>
                  {["Halo, siapa kamu?", "Analisa file ini", "Translate ke English", "Buatkan kode Python"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      style={{
                        padding: "7px 13px",
                        background: "rgba(124,111,255,.12)",
                        border: "1px solid rgba(124,111,255,.25)",
                        borderRadius: 20, color: "#a78bfa",
                        fontSize: 12, cursor: "pointer",
                      }}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="msg-in">
              <MessageBubble msg={msg} />
            </div>
          ))}

          {loading && (
            <div className="msg-in" style={{
              display: "flex", alignItems: "flex-end",
              gap: 10, marginBottom: 16,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "linear-gradient(135deg,#7c6fff,#a78bfa)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>🤖</div>
              <div style={{
                padding: "12px 16px", background: "rgba(255,255,255,.06)",
                borderRadius: "18px 18px 18px 4px",
                border: "1px solid rgba(255,255,255,.08)",
              }}><TypingDots /></div>
            </div>
          )}

          {error && (
            <div className="msg-in" style={{
              margin: "6px 0", padding: "11px 15px",
              background: "rgba(239,68,68,.1)",
              border: "1px solid rgba(239,68,68,.2)",
              borderRadius: 10, color: "#f87171", fontSize: 13,
            }}>{error}</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ── */}
        <div style={{
          padding: "12px 18px 16px",
          borderTop: "1px solid rgba(255,255,255,.07)",
          background: "rgba(255,255,255,.02)",
        }}>
          {/* File error */}
          {fileError && (
            <div style={{
              marginBottom: 8, padding: "7px 12px",
              background: "rgba(239,68,68,.1)",
              border: "1px solid rgba(239,68,68,.2)",
              borderRadius: 8, color: "#f87171", fontSize: 12,
            }}>{fileError}</div>
          )}

          {/* Pending attachments */}
          {attachments.length > 0 && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6,
              marginBottom: 10, padding: "10px 12px",
              background: "rgba(124,111,255,.07)",
              border: "1px solid rgba(124,111,255,.15)", borderRadius: 12,
            }}>
              {attachments.map((att, i) => (
                <FileChip key={i} att={att} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          )}

          {/* Input box */}
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-end",
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 16, padding: "10px 12px",
          }}>
            {/* Attach button */}
            <button
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Lampirkan file (gambar, ZIP, teks)"
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
                color: "#9d96cc", fontSize: 17, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}
            >📎</button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                savedKey
                  ? "Ketik pesan… (Enter kirim, Shift+Enter baris baru)"
                  : "Simpan API Key dulu…"
              }
              disabled={!savedKey || loading}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none",
                color: "#e2ddff", fontSize: 14, outline: "none",
                lineHeight: 1.6, padding: 0, fontFamily: "inherit",
                minHeight: 24, maxHeight: 140,
              }}
            />

            {/* Send */}
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={(!input.trim() && attachments.length === 0) || loading || !savedKey}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background:
                  (input.trim() || attachments.length > 0) && !loading && savedKey
                    ? "linear-gradient(135deg,#7c6fff,#5b4fdb)"
                    : "rgba(255,255,255,.08)",
                border: "none",
                cursor:
                  (input.trim() || attachments.length > 0) && !loading && savedKey
                    ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, transition: "all .2s",
                boxShadow:
                  (input.trim() || attachments.length > 0) && !loading && savedKey
                    ? "0 4px 12px rgba(124,111,255,.4)" : "none",
              }}
            >{loading ? "⏳" : "➤"}</button>
          </div>

          <div style={{ color: "#3d3660", fontSize: 11, textAlign: "center", marginTop: 7 }}>
            Model gratis · Drag & drop file ke mana saja · Shift+Enter untuk baris baru
          </div>
        </div>
      </div>
    </div>
  );
}
