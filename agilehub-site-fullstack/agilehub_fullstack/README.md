# AgileHub course booking website

This version includes:

- AgileHub branded public website
- Calendar booking popup
- Real Stripe Checkout session creation
- Stripe webhook booking fulfilment
- Automated customer confirmation emails via Resend
- Admin panel to add/edit courses and dates without coding

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open: `http://localhost:3000`

Admin panel: `http://localhost:3000/admin.html`

## Required environment variables

Set these in `.env` locally and in your host provider:

```bash
PUBLIC_BASE_URL=https://agilehub.co
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_from_stripe
RESEND_API_KEY=re_your_key
EMAIL_FROM=AgileHub <bookings@agilehub.co>
ADMIN_EMAIL=info@agilehub.co
ADMIN_PASSWORD=choose-a-strong-password
```

## Stripe setup

1. Create a Stripe account.
2. Add `STRIPE_SECRET_KEY` to your environment variables.
3. Create a webhook endpoint in Stripe pointing to:

```text
https://agilehub.co/api/stripe-webhook
```

4. Subscribe it to `checkout.session.completed`.
5. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

Stripe recommends creating a Checkout Session for each payment attempt and using webhooks to fulfil the order after successful payment.

## Email setup

This project uses Resend for confirmation emails.

1. Create a Resend account.
2. Verify `agilehub.co` as a sending domain.
3. Add your API key as `RESEND_API_KEY`.
4. Set `EMAIL_FROM`, for example: `AgileHub <bookings@agilehub.co>`.

## Admin panel

Go to `/admin.html`, enter the `ADMIN_PASSWORD`, then edit:

- Course title
- Description
- Price
- In-person dates
- Online dates
- eLearning availability

Dates should be comma-separated, for example:

```text
2026-06-19, 2026-07-17, 2026-09-11
```

For eLearning, use:

```text
Start immediately
```

## Deployment note

This is now a Node/Express app, not a static-only site. Deploy it to a host that supports Node.js server routes, such as Render, Railway, Fly.io, DigitalOcean App Platform, or a VPS. Static-only Netlify Drop will not run the payment/admin/email backend without serverless conversion.
