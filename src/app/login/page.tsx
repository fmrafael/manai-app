  "use client";

  import { supabase } from "@/lib/supabaseClient";
  import { loadStripe } from "@stripe/stripe-js";

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);


  export default function LoginPage() {
    async function handleLogin() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin, // opcional, volta para a home
        },
      });
      if (error) {
        alert("Erro no login: " + error.message);
      }
    } 

   async function handleSubscribe() {
  try {
    const res = await fetch("/api/stripe-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: "price_1Rq31fLKLhrIIm4HIYvWL2Mz" }), // seu priceId aqui
    });

    const data = await res.json();

    if (data.sessionId) {
      const stripe = await stripePromise;
      if (!stripe) {
        alert("Erro ao carregar Stripe");
        return;
      }
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) alert(error.message);
    } else {
      alert("Não foi possível iniciar o checkout. Tente novamente.");
    }
  } catch (error) {
    console.error("Erro ao iniciar checkout:", error);
    alert("Ocorreu um erro. Tente novamente mais tarde.");
  }
}


    return (
      <main className="flex flex-col min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
          <h1 className="text-3xl font-bold">Entrar na Conta</h1>
          <p className="text-gray-700">Entre com suas credenciais de assinante</p>

      <button
    onClick={handleLogin}
    className="w-full flex items-center justify-center gap-3 rounded border border-gray-300 bg-white py-3 text-gray-700 hover:bg-gray-100 transition"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M23.64 12.2c0-.77-.07-1.51-.2-2.22H12v4.22h6.36c-.28 1.43-1.11 2.64-2.36 3.45v2.88h3.82c2.24-2.07 3.54-5.1 3.54-8.33z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.82-2.88c-1.06.7-2.41 1.11-4.13 1.11-3.18 0-5.88-2.14-6.84-5.02H1.16v3.15A11.999 11.999 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.16 14.31a7.22 7.22 0 010-4.62V6.54H1.16a11.998 11.998 0 000 10.92l4-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.33.6 4.57 1.77l3.43-3.43C17.96 1.43 15.24 0 12 0 7.24 0 3.1 2.73 1.16 6.54l4 3.15c.92-2.88 3.62-5.02 6.84-5.02z"
      />
    </svg>
    Entrar com Google
  </button>


          
    <span>Não tem uma conta?</span>
    <button
    onClick={handleLogin}
    className="w-full flex items-center justify-center gap-3 rounded border border-gray-300 bg-white py-3 text-gray-700 hover:bg-gray-100 transition"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M23.64 12.2c0-.77-.07-1.51-.2-2.22H12v4.22h6.36c-.28 1.43-1.11 2.64-2.36 3.45v2.88h3.82c2.24-2.07 3.54-5.1 3.54-8.33z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.82-2.88c-1.06.7-2.41 1.11-4.13 1.11-3.18 0-5.88-2.14-6.84-5.02H1.16v3.15A11.999 11.999 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.16 14.31a7.22 7.22 0 010-4.62V6.54H1.16a11.998 11.998 0 000 10.92l4-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.33.6 4.57 1.77l3.43-3.43C17.96 1.43 15.24 0 12 0 7.24 0 3.1 2.73 1.16 6.54l4 3.15c.92-2.88 3.62-5.02 6.84-5.02z"
      />
    </svg>
    Registrar-se com Google
  </button>

 


          <a
            href="https://wa.me/5511983600707"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            Precisa de ajuda? Fale no WhatsApp
          </a>
        </div>
      </main>
    );
  }
