let courses = [];

const courseGrid = document.getElementById("courseGrid");
const courseSelect = document.getElementById("courseSelect");
const deliverySelect = document.getElementById("deliverySelect");
const dateSelect = document.getElementById("dateSelect");
const dateDisplay = document.getElementById("dateDisplay");
const calendarPopup = document.getElementById("calendarPopup");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonth = document.getElementById("calendarMonth");
const calendarPrev = document.getElementById("calendarPrev");
const calendarNext = document.getElementById("calendarNext");
const placesInput = document.getElementById("placesInput");
const vatSelect = document.getElementById("vatSelect");
const bookingForm = document.getElementById("bookingForm");
const paymentNotice = document.getElementById("paymentNotice");

const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const formatDate = value => value === "Start immediately" ? value : new Date(`${value}T09:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

let visibleCalendarMonth = new Date();

function renderCourses(filter = "all") {
  courseGrid.innerHTML = "";
  courses
    .filter(course => filter === "all" || Object.keys(course.deliveries).includes(filter))
    .forEach(course => {
      const card = document.createElement("article");
      card.className = "card";
      const tags = Object.keys(course.deliveries).map(delivery => `<span class="tag">${delivery}</span>`).join("");
      card.innerHTML = `
        <h3>${course.title}</h3>
        <p>${course.description}</p>
        <div class="course-meta">${tags}</div>
        <div class="price">${currency.format(course.price)} + VAT</div>
        <button class="btn secondary" data-book="${course.id}">Book this course</button>
      `;
      courseGrid.appendChild(card);
    });
}

function populateCourseSelect() {
  courseSelect.innerHTML = courses.map(course => `<option value="${course.id}">${course.title}</option>`).join("");
  populateDeliverySelect();
}

function selectedCourse() {
  return courses.find(course => course.id === courseSelect.value);
}

function currentDates() {
  const course = selectedCourse();
  return course?.deliveries[deliverySelect.value] || [];
}

function populateDeliverySelect() {
  const course = selectedCourse();
  deliverySelect.innerHTML = Object.keys(course.deliveries).map(delivery => `<option value="${delivery}">${delivery}</option>`).join("");
  populateDateSelect();
}

function populateDateSelect() {
  const dates = currentDates();
  dateSelect.innerHTML = dates.map(date => `<option value="${date}">${formatDate(date)}</option>`).join("");
  dateSelect.value = dates[0] || "";
  dateDisplay.value = formatDate(dateSelect.value || "");

  const firstRealDate = dates.find(date => date !== "Start immediately");
  if (firstRealDate) {
    visibleCalendarMonth = new Date(`${firstRealDate}T09:00:00`);
  }

  renderCalendar();
  updateSummary();
}

function getAvailableDateSet() {
  return new Set(currentDates().filter(date => date !== "Start immediately"));
}

function showCalendar() {
  const dates = currentDates();
  if (dates.length === 1 && dates[0] === "Start immediately") {
    calendarPopup.hidden = false;
    dateDisplay.setAttribute("aria-expanded", "true");
    calendarGrid.innerHTML = `<div class="elearning-date-note">This eLearning course starts immediately after booking and payment.</div>`;
    calendarMonth.textContent = "Self-paced eLearning";
    calendarPrev.hidden = true;
    calendarNext.hidden = true;
    document.querySelector(".calendar-weekdays").hidden = true;
    document.getElementById("calendarHint").hidden = true;
    return;
  }

  calendarPrev.hidden = false;
  calendarNext.hidden = false;
  document.querySelector(".calendar-weekdays").hidden = false;
  document.getElementById("calendarHint").hidden = false;
  calendarPopup.hidden = false;
  dateDisplay.setAttribute("aria-expanded", "true");
  renderCalendar();
}

function hideCalendar() {
  calendarPopup.hidden = true;
  dateDisplay.setAttribute("aria-expanded", "false");
}

function renderCalendar() {
  if (!calendarGrid || !calendarMonth) return;

  const available = getAvailableDateSet();
  if (!available.size) return;

  const year = visibleCalendarMonth.getFullYear();
  const month = visibleCalendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayStartIndex = (firstDay.getDay() + 6) % 7;

  calendarMonth.textContent = monthFormat.format(firstDay);
  calendarGrid.innerHTML = "";

  for (let i = 0; i < mondayStartIndex; i += 1) {
    const blank = document.createElement("button");
    blank.type = "button";
    blank.className = "calendar-day blank";
    blank.disabled = true;
    calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const button = document.createElement("button");
    button.type = "button";
    const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isAvailable = available.has(value);
    const isSelected = dateSelect.value === value;

    button.className = `calendar-day${isAvailable ? " available" : ""}${isSelected ? " selected" : ""}`;
    button.textContent = day;
    button.disabled = !isAvailable;
    button.setAttribute("aria-label", isAvailable ? `Select ${formatDate(value)}` : `${day} not available`);

    if (isAvailable) {
      button.addEventListener("click", () => {
        dateSelect.value = value;
        dateDisplay.value = formatDate(value);
        updateSummary();
        hideCalendar();
      });
    }

    calendarGrid.appendChild(button);
  }
}

function changeCalendarMonth(direction) {
  visibleCalendarMonth = new Date(visibleCalendarMonth.getFullYear(), visibleCalendarMonth.getMonth() + direction, 1);
  renderCalendar();
}

function updateSummary() {
  const course = selectedCourse();
  if (!course) return;
  const places = Math.max(1, Number(placesInput.value || 1));
  const vatRate = Number(vatSelect.value);
  const subtotal = course.price * places;
  const vat = subtotal * vatRate;
  const total = subtotal + vat;

  document.getElementById("summaryCourse").textContent = course.title;
  document.getElementById("summaryDelivery").textContent = deliverySelect.value;
  document.getElementById("summaryDate").textContent = formatDate(dateSelect.value || "");
  document.getElementById("summaryPlaces").textContent = places;
  document.getElementById("summarySubtotal").textContent = currency.format(subtotal);
  document.getElementById("summaryVat").textContent = currency.format(vat);
  document.getElementById("summaryTotal").textContent = currency.format(total);
}

async function handleCheckout(event) {
  event.preventDefault();
  const course = selectedCourse();
  const places = Math.max(1, Number(placesInput.value || 1));

  paymentNotice.hidden = false;
  paymentNotice.innerHTML = `<strong>Creating secure checkout...</strong><br>Please wait while we connect to Stripe.`;

  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: course.id,
        delivery: deliverySelect.value,
        date: dateSelect.value,
        places,
        customer: {
          name: document.getElementById('nameInput').value,
          email: document.getElementById('emailInput').value,
          company: document.getElementById('companyInput').value
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to create checkout session.');
    window.location.href = data.checkoutUrl;
  } catch (error) {
    paymentNotice.innerHTML = `<strong>Checkout unavailable:</strong><br>${error.message}`;
  }
}

document.querySelector(".nav-toggle").addEventListener("click", () => {
  document.querySelector(".nav-links").classList.toggle("open");
});

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(filter => filter.classList.remove("active"));
    button.classList.add("active");
    renderCourses(button.dataset.filter);
  });
});

courseGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-book]");
  if (!button) return;
  courseSelect.value = button.dataset.book;
  populateDeliverySelect();
  document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
});

[courseSelect, deliverySelect, placesInput, vatSelect].forEach(element => element.addEventListener("change", () => {
  if (element === courseSelect) populateDeliverySelect();
  else if (element === deliverySelect) populateDateSelect();
  else updateSummary();
}));

placesInput.addEventListener("input", updateSummary);
bookingForm.addEventListener("submit", handleCheckout);
dateDisplay.addEventListener("click", showCalendar);
dateDisplay.addEventListener("keydown", event => {
  if (["Enter", " ", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    showCalendar();
  }
});
calendarPrev.addEventListener("click", () => changeCalendarMonth(-1));
calendarNext.addEventListener("click", () => changeCalendarMonth(1));
document.addEventListener("click", event => {
  if (!event.target.closest(".date-field")) hideCalendar();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") hideCalendar();
});

async function loadCourses() {
  try {
    const response = await fetch('/api/courses');
    courses = await response.json();
    renderCourses();
    populateCourseSelect();
  } catch (error) {
    courseGrid.innerHTML = '<p>Courses are temporarily unavailable. Please try again later.</p>';
  }
}

loadCourses();
