"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getRandomSuggestions } from "@/lib/systemPrompt";
import { useAuthSubscriber } from "@/hooks/useAuthSubscriber";
import { useMessages, Message } from "@/hooks/useMessages";
import { loadStripe } from '@stripe/stripe-js';


export default function Home() {

  const [input, setInput] = useState("");
  const {
    isLoggedIn,
    isSubscriber,
    loading,
    dailyCount,
    setDailyCount,
    FREE_LIMIT_DAILY,
  } = useAuthSubscriber();
  const { messages, setMessages } = useMessages(isSubscriber, loading);

  const [typingMessage, setTypingMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

 const handleSubscribe = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    alert("Usuário não está logado.");
    return;
  }

  const response = await fetch('/api/stripe-checkout', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });


  if (!response.ok) {
  const errorText = await response.text();
  console.error("Erro ao iniciar checkout:", response.status, errorText);
  alert("Erro ao iniciar o checkout. Veja o console para detalhes.");
  return;
}


  if (!response.ok) {
    alert("Erro ao iniciar o checkout.");
    return;
  }

  const data = await response.json();

  if (data.sessionId) {
    const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
    if (stripe) {
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    }
  } else {
    alert('Erro ao iniciar o checkout');
  }
};


  // GARANTIR INSERÇÃO DO USUÁRIO NA TABELA 'subscribers' QUANDO LOGADO
  useEffect(() => {
    if (!isLoggedIn) return;

    async function checkAndInsertUser() {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error("Erro ao obter usuário:", userError.message);
        return;
      }

      if (!user?.email) {
        console.warn("Usuário não possui email válido.");
        return;
      }

      // Verificar se usuário já está na tabela
      const { data, error } = await supabase
        .from("subscribers")
        .select("email")
        .eq("email", user.email)
        .single();

      if (data) {
        console.log("Assinante já registrado:", data.email);
        return;
      }

      // Se erro for diferente do erro esperado de não encontrado, loga e sai
      if (error && error.code !== "PGRST116") {
        console.error("Erro ao consultar assinante:", error.message);
        return;
      }

      // Inserir novo assinante com status 'trial'
      const { error: insertError } = await supabase.from("subscribers").insert([
        {
          email: user.email,
          status: "trial",
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        console.error("Erro ao inserir assinante:", insertError.message);
      } else {
        console.log("Novo assinante inserido:", user.email);
      }
    }

    checkAndInsertUser();
  }, [isLoggedIn]);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mensagem de boas-vindas animada
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
  }, [loading, messages, setMessages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const storedDate = localStorage.getItem("lastMessageDate");
    let count = parseInt(localStorage.getItem("dailyMessageCount") || "0");

    if (storedDate !== today) {
      count = 0;
      localStorage.setItem("lastMessageDate", today);
      localStorage.setItem("dailyMessageCount", "0");
    }

    if (!isSubscriber && count >= FREE_LIMIT_DAILY) {
      alert(`Você atingiu o limite diário de ${FREE_LIMIT_DAILY} mensagens gratuitas.`);
      return;
    }

    if (!isSubscriber) {
      count++;
      localStorage.setItem("dailyMessageCount", count.toString());
      setDailyCount(count);
    }

    const userMessage: Message = {
      id: messages.length,
      text: trimmed,
      role: "user",
      created_at: new Date().toISOString(),
    };

    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!isSubscriber) {
      localStorage.setItem(`chatHistory_${today}`, JSON.stringify(newMessages));
    } else if (user) {
      const { error: userError } = await supabase
        .from("memories")
        .insert([{ user_id: user.id, role: "user", text: trimmed }]);
      if (userError) {
        console.error("Erro salvando memória:", userError.message);
        alert("Erro ao salvar sua mensagem. Por favor, tente novamente.");
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        console.error("Falha na resposta do servidor:", res.statusText);
        alert("Erro ao processar sua solicitação. Tente novamente mais tarde.");
        return;
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: newMessages.length,
        text: data.reply,
        role: "assistant",
        created_at: new Date().toISOString(),
      };

      const updatedMessages: Message[] = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      if (isSubscriber && user) {
        const { error: assistantError } = await supabase
          .from("memories")
          .insert([{ user_id: user.id, role: "assistant", text: data.reply }]);
        if (assistantError) {
          console.error("Erro salvando resposta IA:", assistantError.message);
          alert("Erro ao salvar a resposta do assistente. Por favor, tente novamente.");
        }
      } else if (!isSubscriber) {
        localStorage.setItem(`chatHistory_${today}`, JSON.stringify(updatedMessages));
      }
    } catch (error) {
      console.error("Erro ao chamar /api/chat:", error);
      alert("Ocorreu um erro inesperado ao enviar sua mensagem. Por favor, tente novamente.");
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
      <section className="flex flex-col flex-1 max-w-3xl mx-auto w-full p-6 bg-white border border-gray-200 rounded-xl shadow-lg mt-16">
        <header className="flex justify-between items-center mb-6">
          <div className="text-2xl font-semibold text-gray-800">ManAI</div>
          <button
            onClick={() => router.push("/login")}
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
          >
            {isLoggedIn ? "Minha Conta" : "Entrar na Conta"}
          </button>

<button
  onClick={handleSubscribe}
  className={`px-4 py-2 rounded text-white transition ${
    isSubscriber ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
  }`}
  disabled={isSubscriber}
>
  {isSubscriber ? 'PRO' : 'Assinar PRO'}
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
          {messages.length === 0 && (
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
            <div className="self-start bg-gray-100 text-gray-900 rounded-bl-none shadow-sm max-w-[75%] px-5 py-2 rounded-lg whitespace-pre-wrap break-words leading-tight">
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
              className="resize-none bg-transparent outline-none border-none w-full py-2 px-5 min-h-[2.5rem] text-base leading-tight text-gray-900"
              style={{ caretColor: "#2563eb" }}
            />

            <button
              type="submit"
              disabled={reachedLimit}
              className={`px-6 py-3 rounded-lg text-white transition ${
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
