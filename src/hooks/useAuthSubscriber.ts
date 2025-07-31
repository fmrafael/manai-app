import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

const FREE_LIMIT_DAILY = 7;

export function useAuthSubscriber() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dailyCount, setDailyCount] = useState(0);

  // Reseta contador diário se o dia mudou
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const storedDate = localStorage.getItem("lastMessageDate");

    if (storedDate !== today) {
      localStorage.setItem("lastMessageDate", today);
      localStorage.setItem("dailyMessageCount", "0");
      localStorage.removeItem(`chatHistory_${storedDate || ""}`);
      setDailyCount(0);
    }
  }, []);

  // Checa se email é assinante ativo
  async function checkSubscriber(email: string) {
    const { data, error } = await supabase
      .from("subscribers")
      .select("status")
      .eq("email", email)
      .single();

    // Se não houver erro e status === "active", é assinante
    setIsSubscriber(!error && data?.status === "active");
  }

  useEffect(() => {
    // Ao montar, pega usuário logado e verifica assinante
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user && user.email) {
        setIsLoggedIn(true);
        await checkSubscriber(user.email);
      } else {
        setIsLoggedIn(false);
        setIsSubscriber(false);
      }
      setLoading(false);
    });

    // Escuta mudanças no estado de autenticação (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        if (session?.user?.email) {
          setIsLoggedIn(true);
          await checkSubscriber(session.user.email);
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

  // Inicializa dailyCount do localStorage ao montar
  useEffect(() => {
    const count = parseInt(localStorage.getItem("dailyMessageCount") || "0");
    setDailyCount(count);
  }, []);

  return {
    isLoggedIn,
    isSubscriber,
    loading,
    dailyCount,
    setDailyCount,
    FREE_LIMIT_DAILY,
  };
}
