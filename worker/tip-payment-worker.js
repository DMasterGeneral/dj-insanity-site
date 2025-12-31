// DJ Insanity - Stripe + iTunes Proxy Worker
// Deploy this to Cloudflare Workers

// Required environment variable:
// - STRIPE_SECRET_KEY: Your Stripe secret key

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Route: GET /itunes?q=searchterm - Proxy iTunes Search API
        if (request.method === 'GET' && url.pathname === '/itunes') {
            const searchTerm = url.searchParams.get('q');
            if (!searchTerm) {
                return new Response(
                    JSON.stringify({ error: 'Missing search term', results: [] }),
                    { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                );
            }

            try {
                const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&limit=10`;

                const iTunesResponse = await fetch(iTunesUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; DJInsanityBot/1.0)',
                        'Accept': 'application/json',
                    },
                });

                if (!iTunesResponse.ok) {
                    throw new Error(`iTunes API returned ${iTunesResponse.status}`);
                }

                const text = await iTunesResponse.text();

                // Parse JSON (iTunes sometimes returns weird encoding)
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error('Failed to parse iTunes response');
                }

                return new Response(
                    JSON.stringify(data),
                    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                );
            } catch (error) {
                console.error('iTunes error:', error.message);
                return new Response(
                    JSON.stringify({ error: error.message, results: [] }),
                    { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                );
            }
        }

        // Route: POST / - Create Stripe PaymentIntent
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

                // Create PaymentIntent using Stripe REST API
                const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'amount': String(Math.round(amount * 100)),
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

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
};
