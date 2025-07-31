import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Aqui você pode pegar o email do cliente:
    const customerEmail = session.customer_email;

    if (!customerEmail) {
      return NextResponse.json({ error: "Email não encontrado no checkout session" }, { status: 400 });
    }

    // Atualiza o status para 'active' na tabela subscribers
    const { error } = await supabase
      .from("subscribers")
      .update({ status: "active" })
      .eq("email", customerEmail);

    if (error) {
      console.error("Erro ao atualizar status do assinante:", error);
      return NextResponse.json({ error: "Erro no banco" }, { status: 500 });
    }

    console.log(`Status do assinante ${customerEmail} atualizado para active.`);
  }

  return NextResponse.json({ received: true });
}
