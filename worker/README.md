# Cloudflare Worker Deployment Guide

## Overview

This worker creates Stripe PaymentIntents. The actual song request is written to Firebase by the frontend ONLY after Stripe confirms payment success.

**Flow:**
```
User submits song + tip → sessionStorage stores pending request
     ↓
Worker creates PaymentIntent → Returns clientSecret
     ↓
User pays via Stripe Elements
     ↓
Stripe redirects to /payment-success?requestId=xxx&redirect_status=succeeded
     ↓
PaymentSuccess page reads sessionStorage → Writes to Firebase → Clears storage
     ↓
DJ Dashboard shows request with tip ✓
```

**Benefits:**
- ✅ Abandoned payments = No Firebase write
- ✅ sessionStorage = Per-tab isolation
- ✅ Unique requestId = Multiple requests work
- ✅ Cleanup after write = No double-writes on refresh

---

## Quick Setup (~5 min)

### 1. Create the Worker

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. Click **Create Application** → **Create Worker**
3. Name it `dj-insanity-tips`
4. Click **Deploy**

### 2. Add Your Code

1. Click **Edit Code**
2. Delete all existing code
3. Paste the contents of `tip-payment-worker.js`
4. Click **Deploy**

### 3. Add Your Stripe Secret Key

1. Go to Worker → **Settings** → **Variables**
2. Add variable:
   - Name: `STRIPE_SECRET_KEY`
   - Value: Your Stripe secret key (from Stripe Dashboard)
3. Click **Encrypt** (important!)
4. Click **Save**

### 4. Get Your Worker URL

Your URL will be:
```
https://dj-insanity-tips.YOUR_SUBDOMAIN.workers.dev
```

### 5. Update Frontend `.env`

```env
VITE_STRIPE_PUBLISHABLE_KEY=your_publishable_key_here
VITE_STRIPE_WORKER_URL=https://dj-insanity-tips.YOUR_SUBDOMAIN.workers.dev
```

---

## Testing

1. **Test Card**: `4242 4242 4242 4242` (any future date, any CVC)
2. Check [Stripe Dashboard](https://dashboard.stripe.com/test/payments) for payment
3. Check Firebase Console → Firestore → `requests` collection

---

## Going Live

1. Switch Stripe to **Live mode**
2. Update worker `STRIPE_SECRET_KEY` with live secret
3. Update Cloudflare Pages env `VITE_STRIPE_PUBLISHABLE_KEY` with live key
4. Restrict CORS in worker to your domain only
