let courses = [];
let bookings = [];

const passwordInput = document.getElementById('adminPassword');
const statusEl = document.getElementById('adminStatus');
const toolsEl = document.getElementById('adminTools');
const editorEl = document.getElementById('courseEditor');
const bookingListEl = document.getElementById('bookingList');

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-admin-password': passwordInput.value
  };
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function renderEditor() {
  editorEl.innerHTML = courses.map((course, index) => `
    <article class="card admin-course" data-index="${index}">
      <div class="admin-course-header">
        <h3>${course.title || 'New course'}</h3>
        <button type="button" class="btn danger" data-remove="${index}">Remove</button>
      </div>
      <label>Course title <input data-field="title" value="${course.title || ''}" /></label>
      <label>URL ID / slug <input data-field="id" value="${course.id || ''}" placeholder="auto-created if blank" /></label>
      <label>Description <textarea data-field="description" rows="3">${course.description || ''}</textarea></label>
      <label>Price before VAT (£) <input data-field="price" type="number" min="0" value="${course.price || 0}" /></label>
      <label>In-person dates <input data-delivery="In person" value="${(course.deliveries?.['In person'] || []).join(', ')}" placeholder="2026-06-19, 2026-07-17" /></label>
      <label>Online dates <input data-delivery="Online" value="${(course.deliveries?.Online || []).join(', ')}" placeholder="2026-06-12, 2026-07-10" /></label>
      <label>eLearning dates <input data-delivery="eLearning" value="${(course.deliveries?.eLearning || []).join(', ')}" placeholder="Start immediately" /></label>
    </article>`).join('');
}

function collectCoursesFromEditor() {
  return [...document.querySelectorAll('.admin-course')].map(card => {
    const get = selector => card.querySelector(selector)?.value.trim() || '';
    const title = get('[data-field="title"]');
    const deliveries = {};

    card.querySelectorAll('[data-delivery]').forEach(input => {
      const values = input.value.split(',').map(item => item.trim()).filter(Boolean);
      if (values.length) deliveries[input.dataset.delivery] = values;
    });

    return {
      id: get('[data-field="id"]') || slugify(title),
      title,
      description: get('[data-field="description"]'),
      price: Number(get('[data-field="price"]') || 0),
      deliveries
    };
  });
}

function renderBookings() {
  if (!bookings.length) {
    bookingListEl.innerHTML = '<p>No paid bookings yet.</p>';
    return;
  }

  bookingListEl.innerHTML = bookings.slice().reverse().map(booking => `
    <article class="card booking-row">
      <strong>${booking.courseTitle}</strong>
      <span>${booking.delivery} · ${booking.date} · ${booking.places} place(s)</span>
      <span>${booking.customer?.name || ''} · ${booking.customer?.email || ''}</span>
      <span>£${Number(booking.total || 0).toFixed(2)} · ${new Date(booking.createdAt).toLocaleString('en-GB')}</span>
    </article>`).join('');
}

async function loadAdmin() {
  statusEl.textContent = 'Loading...';
  try {
    const [coursesResponse, bookingsResponse] = await Promise.all([
      fetch('/api/courses'),
      fetch('/api/bookings', { headers: headers() })
    ]);

    if (!bookingsResponse.ok) throw new Error('Incorrect password or admin API unavailable.');
    courses = await coursesResponse.json();
    bookings = await bookingsResponse.json();

    renderEditor();
    renderBookings();
    toolsEl.hidden = false;
    statusEl.textContent = 'Admin loaded.';
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

async function saveCourses() {
  statusEl.textContent = 'Saving...';
  try {
    const response = await fetch('/api/courses', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ courses: collectCoursesFromEditor() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to save courses.');
    courses = data.courses;
    renderEditor();
    statusEl.textContent = 'Courses saved.';
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

document.getElementById('loadAdmin').addEventListener('click', loadAdmin);
document.getElementById('saveCourses').addEventListener('click', saveCourses);
document.getElementById('addCourse').addEventListener('click', () => {
  courses.push({ id: '', title: 'New course', description: '', price: 0, deliveries: { Online: [] } });
  renderEditor();
});
editorEl.addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  courses.splice(Number(button.dataset.remove), 1);
  renderEditor();
});
