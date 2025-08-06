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

// Define um tipo que estende Subscription para incluir current_period_end


export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")!;
  const buf = await req.arrayBuffer();
  const body = Buffer.from(buf).toString("utf8");

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

  console.log("Recebi evento Stripe:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerEmail = session.customer_email;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Email não encontrado no checkout session" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("subscribers")
      .upsert(
        {
          email: customerEmail,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: "active",
          cancel_at_period_end: false,
          subscription_expires_at: null,
        },
        { onConflict: "email" }
      );

    if (error) {
      console.error("Erro ao atualizar assinante:", error);
      return NextResponse.json({ error: "Erro no banco" }, { status: 500 });
    }

    console.log(`Status do assinante ${customerEmail} atualizado para active.`);
  }

  if (event.type === "customer.subscription.updated") {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const cancelAt = subscription.cancel_at; // timestamp UNIX em segundos, pode ser null

  const updates = {
    cancel_at_period_end: cancelAtPeriodEnd,
    subscription_expires_at:
      cancelAtPeriodEnd && cancelAt
        ? new Date(cancelAt * 1000).toISOString()
        : null,
  };

  const { error } = await supabase
    .from("subscribers")
    .update(updates)
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("Erro ao atualizar subscription updated:", error);
    return NextResponse.json({ error: "Erro no banco" }, { status: 500 });
  }

  console.log(
    `Subscription updated: ${customerId} → cancel_at_period_end: ${cancelAtPeriodEnd}`
  );
}


  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    const { error } = await supabase
      .from("subscribers")
      .update({
        status: "trial",
        cancel_at_period_end: false,
        subscription_expires_at: null,
      })
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.error("Erro ao atualizar status após cancelamento:", error);
      return NextResponse.json({ error: "Erro no banco" }, { status: 500 });
    }

    console.log(`Status do cliente ${customerId} atualizado para trial (deleted).`);
  }

  return NextResponse.json({ received: true });
}
