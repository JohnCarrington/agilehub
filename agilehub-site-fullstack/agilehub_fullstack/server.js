import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-strong-password';
const EMAIL_FROM = process.env.EMAIL_FROM || 'AgileHub <bookings@agilehub.co>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@agilehub.co';
const COURSES_FILE = path.join(__dirname, 'data', 'courses.json');
const BOOKINGS_FILE = path.join(__dirname, 'data', 'bookings.json');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function requireAdmin(req, res, next) {
  const supplied = req.headers['x-admin-password'];
  if (!supplied || supplied !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }
  next();
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function formatDate(value) {
  if (value === 'Start immediately') return value;
  return new Date(`${value}T09:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function validateBookingPayload(body, courses) {
  const course = courses.find(item => item.id === body.courseId);
  if (!course) throw new Error('Course not found.');
  if (!course.deliveries?.[body.delivery]) throw new Error('Delivery option not found for this course.');
  if (!course.deliveries[body.delivery].includes(body.date)) throw new Error('Selected date is not available for this course.');

  const places = Math.max(1, Math.min(20, Number(body.places || 1)));
  const customer = body.customer || {};
  if (!customer.name || !customer.email) throw new Error('Customer name and email are required.');

  return { course, places, customer };
}

async function sendConfirmationEmail(booking) {
  if (!resend) {
    console.log('RESEND_API_KEY not set. Skipping email send.', booking);
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">
      <h1 style="color:#123a63">Booking confirmed</h1>
      <p>Thank you for booking with AgileHub. Your payment has been received.</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td><strong>Course</strong></td><td>${booking.courseTitle}</td></tr>
        <tr><td><strong>Delivery</strong></td><td>${booking.delivery}</td></tr>
        <tr><td><strong>Date</strong></td><td>${formatDate(booking.date)}</td></tr>
        <tr><td><strong>Places</strong></td><td>${booking.places}</td></tr>
        <tr><td><strong>Total paid</strong></td><td>${formatMoney(booking.total)}</td></tr>
      </table>
      <p>We’ll be in touch with joining instructions. For questions, email <a href="mailto:info@agilehub.co">info@agilehub.co</a>.</p>
      <p>AgileHub Ltd</p>
    </div>`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: [booking.customer.email],
    bcc: [ADMIN_EMAIL],
    subject: `AgileHub booking confirmed: ${booking.courseTitle}`,
    html
  });
}

app.get('/api/courses', async (_req, res) => {
  res.json(await readJson(COURSES_FILE, []));
});

app.put('/api/courses', requireAdmin, async (req, res) => {
  const courses = Array.isArray(req.body.courses) ? req.body.courses : [];
  const cleaned = courses.map(course => ({
    id: course.id || slugify(course.title),
    title: String(course.title || '').trim(),
    description: String(course.description || '').trim(),
    price: Number(course.price || 0),
    deliveries: course.deliveries || {}
  })).filter(course => course.id && course.title && course.price >= 0);

  await writeJson(COURSES_FILE, cleaned);
  res.json({ ok: true, courses: cleaned });
});

app.get('/api/bookings', requireAdmin, async (_req, res) => {
  res.json(await readJson(BOOKINGS_FILE, []));
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured.');

    const courses = await readJson(COURSES_FILE, []);
    const { course, places, customer } = validateBookingPayload(req.body, courses);
    const subtotal = course.price * places;
    const vat = Math.round(subtotal * 0.2 * 100) / 100;
    const total = subtotal + vat;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customer.email,
      success_url: `${PUBLIC_BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/#booking`,
      line_items: [
        {
          quantity: places,
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(course.price * 1.2 * 100),
            product_data: {
              name: `${course.title} - ${req.body.delivery}`,
              description: `${formatDate(req.body.date)} · includes VAT`
            }
          }
        }
      ],
      metadata: {
        courseId: course.id,
        courseTitle: course.title,
        delivery: req.body.delivery,
        date: req.body.date,
        places: String(places),
        customerName: customer.name,
        customerEmail: customer.email,
        company: customer.company || '',
        subtotal: String(subtotal),
        vat: String(vat),
        total: String(total)
      }
    });

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/stripe-webhook', async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Stripe webhook is not configured.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook signature verification failed: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const booking = {
      id: session.id,
      paymentStatus: session.payment_status,
      createdAt: new Date().toISOString(),
      courseId: meta.courseId,
      courseTitle: meta.courseTitle,
      delivery: meta.delivery,
      date: meta.date,
      places: Number(meta.places || 1),
      subtotal: Number(meta.subtotal || 0),
      vat: Number(meta.vat || 0),
      total: Number(meta.total || 0),
      customer: {
        name: meta.customerName,
        email: meta.customerEmail || session.customer_details?.email,
        company: meta.company
      }
    };

    const bookings = await readJson(BOOKINGS_FILE, []);
    if (!bookings.some(item => item.id === booking.id)) {
      bookings.push(booking);
      await writeJson(BOOKINGS_FILE, bookings);
      await sendConfirmationEmail(booking);
    }
  }

  res.json({ received: true });
});

app.get('/success.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.listen(PORT, () => {
  console.log(`AgileHub booking site running on ${PUBLIC_BASE_URL}`);
});
