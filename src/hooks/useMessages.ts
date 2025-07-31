import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Message = {
  id: number;
  text: string;
  role: "user" | "assistant";
  created_at?: string;
};

// aqui continua a lógica do hook...


export function useMessages(isSubscriber: boolean, loading: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);

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
            const msgs = data.map((m, i) => ({
              id: i,
              role: m.role as "user" | "assistant",
              text: m.text,
              created_at: m.created_at,
            }));
            setMessages(msgs);
          } else {
            setMessages([]);
          }
        } else {
          const stored = localStorage.getItem(`chatHistory_${today}`);
          if (stored) {
            setMessages(JSON.parse(stored));
          } else {
            setMessages([]);
          }
        }
      }
    }
    loadMessages();
  }, [isSubscriber, loading]);

  return { messages, setMessages };
}
