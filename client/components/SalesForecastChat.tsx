import { useState } from "react";
import { Bot, Send } from "lucide-react";
import type { SalesForecastResponse } from "@shared/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function SalesForecastChat({ token, forecast }: { token: string; forecast: SalesForecastResponse }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const ask = async (value = question) => {
    const prompt = value.trim();
    if (!prompt || isSending) return;

    setQuestion("");
    setError("");
    setIsSending(true);
    setMessages((current) => [...current, { role: "user", content: prompt }]);

    try {
      const response = await fetch("/api/sales/forecast/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: prompt, messages: messages.slice(-8), forecast }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not get a forecast answer.");
      setMessages((current) => [...current, { role: "assistant", content: body.answer }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not get a forecast answer.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mt-4 border-t border-border pt-4" aria-label="Gemini sales forecast assistant">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-2/10 text-accent-2"><Bot size={17} /></span>
        <div>
          <h3 className="text-sm font-semibold text-navy">Ask Gemini</h3>
          <p className="text-xs text-gray-500">Answers are based on this forecast.</p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {["What is driving the trend?", "What should I stock up on?"].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void ask(suggestion)}
              disabled={isSending}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-navy transition hover:border-accent-2 hover:bg-off-white disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-off-white p-3" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "bg-navy text-white" : "border border-border bg-white text-navy"}`}>
                {message.content}
              </p>
            </div>
          ))}
          {isSending && <p className="text-xs text-muted">Gemini is thinking…</p>}
        </div>
      )}

      {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => { event.preventDefault(); void ask(); }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask();
            }
          }}
          maxLength={1000}
          rows={2}
          placeholder="Ask about your sales forecast…"
          aria-label="Ask about your sales forecast"
          disabled={isSending}
          className="min-h-10 flex-1 resize-y rounded-lg border border-border px-3 py-2 text-sm text-navy outline-none focus:border-accent-2 disabled:bg-off-white"
        />
        <button
          type="submit"
          disabled={isSending || !question.trim()}
          aria-label="Send question"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white transition hover:bg-navy-mid disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
