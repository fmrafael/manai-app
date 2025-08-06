import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Precisa ser Service Role Key!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: 'Invalid User' }, { status: 401 });
  }

  const { data, error: subError } = await supabase
    .from('subscribers')
    .select('stripe_customer_id')
    .eq('email', user.email)
    .single();

  if (subError || !data?.stripe_customer_id) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: process.env.PORTAL_RETURN_URL,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
  if (err instanceof Error) {
    console.error('Stripe Portal Error:', err.message);
  } else {
    console.error('Stripe Portal Error:', err);
  }

  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

}
