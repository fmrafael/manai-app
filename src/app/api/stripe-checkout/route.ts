import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

// Supabase Admin Client com Service Role Key para validar JWT e pegar usuário
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // Pega JWT do header Authorization: "Bearer <token>"
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.split(" ")[1];

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Token não enviado" }), {
        status: 401,
      });
    }

    // Valida o JWT e obtém usuário
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(jwt);

    if (error || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
      });
    }

    // Cria sessão Stripe com email do usuário autenticado
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email, // email preenchido e fixo no checkout
      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
    });
  } catch (error) {
    console.error("Erro ao criar sessão de pagamento:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar sessão de pagamento" }),
      { status: 500 }
    );
  }
}