const bookings = JSON.parse(localStorage.getItem("bookings")) || [];

// ================== BASIC STATS ==================
document.getElementById("totalBookings").innerText = bookings.length;

const today = new Date().toLocaleDateString();

const todaysBookings = bookings.filter(b => b.date === today);
document.getElementById("todayBookings").innerText = todaysBookings.length;

const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.price), 0);
document.getElementById("totalRevenue").innerText =
  "R " + totalRevenue.toFixed(2);

// ================== REVENUE CALCULATIONS ==================
let dailyRevenue = 0;
let weeklyRevenue = 0;
let monthlyRevenue = 0;

const now = new Date();

bookings.forEach(b => {
  const bookingDate = new Date(b.date);
  const diffDays = (now - bookingDate) / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) dailyRevenue += Number(b.price);
  if (diffDays <= 7) weeklyRevenue += Number(b.price);
  if (diffDays <= 30) monthlyRevenue += Number(b.price);
});

// ================== BOOKING STATUS DATA ==================
const statusCounts = {
  Booked: 0,
  Collected: 0,
  "In Transit": 0,
  "Out for Delivery": 0,
  Delivered: 0
};

bookings.forEach(b => {
  if (statusCounts[b.status] !== undefined) {
    statusCounts[b.status]++;
  }
});

// ================== CHARTS ==================

// BOOKINGS BAR CHART
new Chart(document.getElementById("bookingChart"), {
  type: "bar",
  data: {
    labels: Object.keys(statusCounts),
    datasets: [{
      label: "Number of Bookings",
      data: Object.values(statusCounts)
    }]
  }
});

// REVENUE PIE CHART
new Chart(document.getElementById("revenueChart"), {
  type: "pie",
  data: {
    labels: ["Daily", "Weekly", "Monthly"],
    datasets: [{
      data: [
        dailyRevenue.toFixed(2),
        weeklyRevenue.toFixed(2),
        monthlyRevenue.toFixed(2)
      ]
    }]
  }
});

// ================== CUSTOMER REVENUE ANALYTICS ==================
const customerRevenue = {};
const customerBookings = {};

bookings.forEach(b => {
  const customer = b.fromCompany;

  customerRevenue[customer] =
    (customerRevenue[customer] || 0) + Number(b.price);

  customerBookings[customer] =
    (customerBookings[customer] || 0) + 1;
});

// CUSTOMER REVENUE CHART
new Chart(document.getElementById("customerRevenueChart"), {
  type: "bar",
  data: {
    labels: Object.keys(customerRevenue),
    datasets: [{
      label: "Revenue (R)",
      data: Object.values(customerRevenue)
    }]
  }
});

