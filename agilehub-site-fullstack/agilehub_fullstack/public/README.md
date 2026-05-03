# AgileHub Course Website

A responsive starter website for advertising and booking AgileHub courses.

## Included

- Course catalogue
- Delivery filters: In person, Online, Self-paced eLearning
- Date selector
- Booking form
- Price, VAT and total calculation
- Demo checkout flow
- Payment integration placeholder for Stripe Checkout or similar

## Run locally

Open `index.html` in a browser, or run:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Payment integration

The current form shows a demo payment notice. For live payments, create a backend endpoint such as:

`POST /api/create-checkout-session`

That endpoint should:

1. Validate the selected course/date/price server-side.
2. Create a Stripe Checkout Session.
3. Return the hosted checkout URL.
4. Confirm payment through Stripe webhooks.
5. Store the booking in a database and send confirmation emails.

Never trust prices calculated only in browser JavaScript.


## Brand update

This version uses the AgileHub logo from the supplied letterhead, a clean white background, charcoal AgileHub tones and yellow accent colours. The public domain referenced in metadata and footer is https://agilehub.co.
