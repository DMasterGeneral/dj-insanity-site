// DJ Insanity - Stripe Tip Payment Worker
// Deploy this to Cloudflare Workers (Quick Edit - no bundler needed)

// Required environment variable:
// - STRIPE_SECRET_KEY: Your Stripe secret key

export default {
    async fetch(request, env) {
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // In production, restrict to your domain
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Handle POST request to create PaymentIntent
        if (request.method === 'POST') {
            try {
                const { amount } = await request.json();

                // Validate amount
                if (!amount || amount < 1 || amount > 999) {
                    return new Response(
                        JSON.stringify({ error: 'Invalid tip amount' }),
                        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                    );
                }

                // Create PaymentIntent using Stripe REST API (no npm package needed)
                const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'amount': String(Math.round(amount * 100)), // Convert to cents
                        'currency': 'usd',
                        'automatic_payment_methods[enabled]': 'true',
                        'description': `DJ Insanity Tip - $${amount}`,
                    }),
                });

                const paymentIntent = await stripeResponse.json();

                if (paymentIntent.error) {
                    throw new Error(paymentIntent.error.message);
                }

                return new Response(
                    JSON.stringify({ clientSecret: paymentIntent.client_secret }),
                    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                );
            } catch (error) {
                console.error('Stripe error:', error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                );
            }
        }

        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    },
};
