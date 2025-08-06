"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const handleGoHome = () => {
  router.push("/");
};


  useEffect(() => {
  async function fetchUserData() {
    setLoading(true);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user?.email) {
      router.push("/login");
      return;
    }

    setEmail(data.user.email);

    const { data: subData, error: subError } = await supabase
      .from("subscribers")
      .select("status, subscription_expires_at")
      .eq("email", data.user.email)
      .single();

    if (subError || !subData) {
      console.error("Erro ao buscar status ou usuário não encontrado:", subError?.message);
      setStatus("trial");  // Assume que se não achou, é trial/free
    } else {
      // Verifica se a assinatura expirou
      const now = new Date();
      const expiresAt = subData.subscription_expires_at ? new Date(subData.subscription_expires_at) : null;

      if (subData.status === "active" && (expiresAt === null || expiresAt > now)) {
        setStatus("active");
      } else {
        setStatus("trial");
      }
    }

    setLoading(false);
  }

  fetchUserData();
}, [router]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

 const handleManageSubscription = async () => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    router.push("/login");
    return;
  }

  const res = await fetch("/api/stripe-portal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });

  if (!res.ok) {
    alert("Erro ao abrir portal de assinaturas.");
    return;
  }

  const { url } = await res.json();
  window.location.href = url;
};


  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-50">
      <section className="bg-white p-6 rounded-xl shadow-md border max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-gray-200 flex items-center justify-center text-4xl text-gray-500">
            🟪
          </div>
          <h1 className="text-xl font-semibold mt-4">{email || "Carregando..."}</h1>
          <p className="text-gray-500">
            Plano:{" "}
            <span className="font-medium text-gray-800">
              {loading ? "Carregando..." : status}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleLogout}
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
          >
            Logout
          </button>
          {status === "active" && !loading && (
            <button
              onClick={handleManageSubscription}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
            >
              Gerenciar Assinatura
            </button>

            
          )}

          <button
  onClick={handleGoHome}
  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
>
  Voltar para Home
</button>

        </div>
      </section>
    </main>
  );
}
