"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { getRandomSuggestions } from "@/lib/systemPrompt";

type Message = {
  id: number;
  text: string;
  role: "user" | "assistant";
};

const FREE_LIMIT_DAILY = 7;

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dailyCount, setDailyCount] = useState(0);
  const [typingMessage, setTypingMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Limpar contador diário se mudar o dia
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const storedDate = localStorage.getItem("lastMessageDate");

    if (storedDate !== today) {
      localStorage.setItem("lastMessageDate", today);
      localStorage.setItem("dailyMessageCount", "0");
      localStorage.removeItem(`chatHistory_${storedDate || ""}`);
    }
  }, []);

  // Checar login e status de assinante
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true);
        const { data, error } = await supabase
          .from("assinantes")
          .select("status")
          .eq("email", user.email)
          .single();

        setIsSubscriber(!error && data?.status === "active");
      } else {
        setIsLoggedIn(false);
        setIsSubscriber(false);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setIsLoggedIn(true);
          const { data, error } = await supabase
            .from("assinantes")
            .select("status")
            .eq("email", session.user.email)
            .single();

          setIsSubscriber(!error && data?.status === "active");
        } else {
          setIsLoggedIn(false);
          setIsSubscriber(false);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Carregar histórico do dia conforme assinante ou não
  useEffect(() => {
    async function loadMessages() {
      if (!loading) {
        const today = new Date().toISOString().split("T")[0];
        if (isSubscriber) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setMessages([]);
            return;
          }
          const { data, error } = await supabase
            .from("memories")
            .select("role, text, id, created_at")
            .eq("user_id", user.id)
            .gte("created_at", `${today}T00:00:00Z`)
            .order("id", { ascending: true });

          if (!error && data && data.length > 0) {
            const msgs: Message[] = data.map((m, i) => ({
              id: i,
              role: m.role as "user" | "assistant",
              text: m.text,
            }));
            setMessages(msgs);
            return;
          } else {
            setMessages([]);
          }
        } else {
          const stored = localStorage.getItem(`chatHistory_${today}`);
          if (stored) {
            setMessages(JSON.parse(stored));
            return;
          } else {
            setMessages([]);
          }
        }
      }
    }
    loadMessages();
  }, [isSubscriber, loading]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Atualizar dailyCount quando mensagens mudam
  useEffect(() => {
    const count = parseInt(localStorage.getItem("dailyMessageCount") || "0");
    setDailyCount(count);
  }, [messages]);

  // Mensagem de boas-vindas digitada se não houver mensagens
  useEffect(() => {
    if (!loading && messages.length === 0) {
      const selected = getRandomSuggestions(3);
      const formattedSuggestions = selected.map((s) => `- ${s}`).join("\n\n");

      const initialPrompt = `Olá! Vamos começar?\n\nSugestões:\n\n${formattedSuggestions}`;

      let index = 0;
      setIsTyping(true);

      const typingInterval = setInterval(() => {
        setTypingMessage(initialPrompt.slice(0, index + 1));
        index++;

        if (index >= initialPrompt.length) {
          clearInterval(typingInterval);
          setIsTyping(false);
          setMessages([{ id: 0, text: initialPrompt, role: "assistant" }]);
          setTypingMessage("");
        }
      }, 30);

      return () => clearInterval(typingInterval);
    }
  }, [loading, messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const today = new Date().toISOString().split("T")[0];
    const storedDate = localStorage.getItem("lastMessageDate");
    let count = parseInt(localStorage.getItem("dailyMessageCount") || "0");

    if (storedDate !== today) {
      count = 0;
      localStorage.setItem("lastMessageDate", today);
    }

    if (!isSubscriber && count >= FREE_LIMIT_DAILY) return;

    if (!isSubscriber) {
      count++;
      localStorage.setItem("dailyMessageCount", count.toString());
    }

    const newMessages = [
      ...messages,
      { id: messages.length, text: trimmed, role: "user" },
    ];
    setMessages(newMessages);
    setInput("");

    if (!isSubscriber) {
      localStorage.setItem(`chatHistory_${today}`, JSON.stringify(newMessages));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("memories").insert([
          { user_id: user.id, role: "user", text: trimmed },
        ]);
        if (error) console.error("Erro salvando memória:", error.message);
      }
    }

    // Enviar todo o contexto de mensagens para API
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    const data = await res.json();

    const updatedMessages = [
      ...newMessages,
      { id: newMessages.length, text: data.reply, role: "assistant" },
    ];
    setMessages(updatedMessages);

    if (isSubscriber) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("memories").insert([
          { user_id: user.id, role: "assistant", text: data.reply },
        ]);
        if (error) console.error("Erro salvando resposta IA:", error.message);
      }
    } else {
      localStorage.setItem(`chatHistory_${today}`, JSON.stringify(updatedMessages));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen text-gray-500">
        Carregando...
      </main>
    );
  }

  const reachedLimit = !isSubscriber && dailyCount >= FREE_LIMIT_DAILY;

  return (
    <main className="flex min-h-screen bg-gray-50">
    
      {/* Área principal do chat */}
<section className="flex flex-col flex-1 max-w-3xl mx-auto w-full p-6 bg-white border border-gray-200 rounded-xl shadow-lg mt-16">
        <header className="flex justify-between items-center mb-6">
          
          <div className="text-2xl font-semibold text-gray-800">ManAI</div>
          <button
            onClick={() => router.push("/login")}
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
          >
            {isLoggedIn ? "Minha Conta" : "Entrar na Conta"}
          </button>
        </header>

        <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center text-gray-900">
          👋 Bem-vindo!
        </h1>
        <p className="text-gray-600 mb-8 text-center leading-relaxed">
          O seu espaço seguro para organizar ideias, aliviar a mente e fortalecer o emocional.
          <br />
          Converse comigo sem julgamentos. Vamos focar no que você controla.
        </p>

        <div className="flex-grow overflow-y-auto max-h-[60vh] px-2 mb-6 space-y-4">
          {(messages.length === 0) && (
            <p className="text-gray-400 text-center mt-12 select-none">
              Nenhuma mensagem no chat
            </p>
          )}
          {messages.slice(-10).map(({ id, text, role }) => (
            <div
              key={id}
              className={`max-w-[75%] px-5 py-2 rounded-lg whitespace-pre-wrap break-words leading-tight
                ${
                  role === "user"
                    ? "self-end bg-blue-700 text-white rounded-br-none shadow-md"
                    : "self-start bg-gray-100 text-gray-900 rounded-bl-none shadow-sm"
                }`}
            >
              {text}
            </div>
          ))}

          {isTyping && typingMessage && (
            <div
              className="self-start bg-gray-100 text-gray-900 rounded-bl-none shadow-sm max-w-[75%] px-5 py-2 rounded-lg whitespace-pre-wrap break-words leading-tight"
            >
              {typingMessage}
              <span className="animate-pulse">|</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {reachedLimit ? (
          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded text-center">
            <p className="mb-4 text-yellow-800 font-semibold">
              Você atingiu o limite de {FREE_LIMIT_DAILY} mensagens gratuitas.
            </p>
            <a
              href="https://chk.eduzz.com/1W3ZZ5XQW2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-800 text-white px-6 py-3 rounded-lg hover:bg-blue-900 transition"
            >
              Faça Upgrade para mensagens ilimitadas
            </a>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-4 border border-gray-300 rounded-lg p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-600"
          >
            <textarea
              placeholder="Digite sua mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={reachedLimit}
              rows={1}
              className="
                resize-none
                bg-transparent
                outline-none
                border-none
                w-full
                py-2
                px-5
                min-h-[2.5rem]
                text-base
                leading-tight
                text-gray-900
              "
              style={{
                caretColor: "#2563eb",
              }}
            />

            <button
              type="submit"
              disabled={reachedLimit}
              className={`px-6 py-3 rounded-lg text-white transition
                ${
                  reachedLimit
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-700 hover:bg-blue-800"
                }`}
            >
              ➤
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
