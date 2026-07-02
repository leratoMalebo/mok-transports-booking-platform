// mok-backend/services/emailService.js
// Nodemailer via Afrihost SMTP
// npm install nodemailer  (run once in mok-backend folder)

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'mail.moktransports.com',
  port:   Number(process.env.SMTP_PORT || 465),
  secure: true, // SSL on port 465
  auth: {
    user: process.env.SMTP_USER || 'mavis@moktransports.com',
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // allow self-signed certs common on cPanel
  }
});

// ─────────────────────────────────────────────
// SEND STAFF NOTIFICATION — New Local Booking
// ─────────────────────────────────────────────
exports.sendBookingNotification = async ({ booking, waybill }) => {
  const notifyEmails = (process.env.NOTIFY_EMAILS || 'mavis@moktransports.com,neo@moktransports.com')
    .split(',').map(e => e.trim()).filter(Boolean);

  const serviceLabels = {
    SAMEDAY:  'SameDay Express',
    ONX:      'Overnight Express (ONX)',
    NDD:      'NextDay Express',
    ECO:      'Economy Service',
    ECOSPEC:  'Economy Special',
  };
  const serviceLabel = serviceLabels[(booking.service||'').toUpperCase()] || booking.service || '—';
  const bookingDate  = new Date().toLocaleDateString('en-ZA', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background:#f4f6f9; margin:0; padding:0 }
    .wrap { max-width:620px; margin:24px auto; background:#fff;
      border-radius:10px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.1) }
    .header { background:#0d2137; padding:24px 28px;
      display:flex; align-items:center; justify-content:space-between }
    .header-title { color:#fff; font-size:20px; font-weight:700; margin:0 }
    .header-sub { color:#90a4ae; font-size:11px; margin-top:4px; letter-spacing:1px; text-transform:uppercase }
    .badge { background:#f57c00; color:#fff; border-radius:4px; padding:4px 10px;
      font-size:12px; font-weight:700; letter-spacing:.5px }
    .body { padding:24px 28px }
    .greeting { color:#1a2535; font-size:15px; margin-bottom:20px }
    .section-title { font-size:11px; font-weight:700; color:#607d8b; text-transform:uppercase;
      letter-spacing:1px; margin:0 0 10px; padding-bottom:6px; border-bottom:2px solid #f0f4f8 }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px }
    .detail-item { background:#f8fafc; border-radius:7px; padding:10px 14px }
    .detail-label { font-size:10px; font-weight:700; color:#90a4ae;
      text-transform:uppercase; letter-spacing:.8px; margin-bottom:3px }
    .detail-value { font-size:14px; font-weight:600; color:#1a2535 }
    .party-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px }
    .party-box { border-radius:8px; padding:14px 16px }
    .sender-box { background:#fff8f0; border:1px solid #ffcc80 }
    .receiver-box { background:#e3f2fd; border:1px solid #90caf9 }
    .party-label { font-size:10px; font-weight:700; text-transform:uppercase;
      letter-spacing:1px; margin-bottom:6px }
    .sender-box .party-label { color:#e65100 }
    .receiver-box .party-label { color:#1565c0 }
    .party-name { font-size:15px; font-weight:700; color:#1a2535; margin-bottom:3px }
    .party-detail { font-size:12px; color:#607d8b; line-height:1.7 }
    .waybill-banner { background:#0d2137; border-radius:8px; padding:16px 20px;
      text-align:center; margin-bottom:20px }
    .waybill-label { color:#90a4ae; font-size:11px; letter-spacing:2px;
      text-transform:uppercase; margin-bottom:6px }
    .waybill-no { color:#fff; font-size:28px; font-weight:800; letter-spacing:3px }
    .price-row { background:#e8f5e9; border-radius:8px; padding:12px 16px;
      display:flex; justify-content:space-between; align-items:center; margin-bottom:20px }
    .price-label { color:#2e7d32; font-size:13px; font-weight:600 }
    .price-amount { color:#2e7d32; font-size:20px; font-weight:800 }
    .footer { background:#f8fafc; padding:16px 28px; text-align:center;
      font-size:11px; color:#90a4ae; border-top:1px solid #dce3ec }
    .action-btn { display:inline-block; background:#1565c0; color:#fff;
      padding:12px 24px; border-radius:7px; text-decoration:none;
      font-weight:700; font-size:13px; margin-top:4px }
  </style>
</head>
<body>
  <div class="wrap">

    <div class="header">
      <div>
        <div class="header-title">Mok Transports Services</div>
        <div class="header-sub">New Booking Notification</div>
      </div>
      <span class="badge">NEW BOOKING</span>
    </div>

    <div class="body">
      <p class="greeting">
        A new local shipment has been booked on <strong>${bookingDate}</strong>.
        Please review the details below and dispatch accordingly.
      </p>

      <!-- WAYBILL -->
      <div class="waybill-banner">
        <div class="waybill-label">JKJ Express Waybill Number</div>
        <div class="waybill-no">${waybill.waybill_no || '—'}</div>
      </div>

      <!-- BOOKING DETAILS -->
      <div class="section-title">Shipment Details</div>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">Service</div>
          <div class="detail-value">${serviceLabel}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Zone</div>
          <div class="detail-value">${booking.zone_label || '—'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Weight</div>
          <div class="detail-value">${booking.weight || 0} kg</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Vol. Weight</div>
          <div class="detail-value">${booking.volumetric_weight || 0} kg</div>
        </div>
      </div>

      <!-- PRICE -->
      <div class="price-row">
        <span class="price-label">Nett Price (Excl. VAT)</span>
        <span class="price-amount">R ${Number(booking.price || 0).toFixed(2)}</span>
      </div>

      <!-- SENDER / RECEIVER -->
      <div class="section-title">Sender & Receiver</div>
      <div class="party-grid">
        <div class="party-box sender-box">
          <div class="party-label">📦 Sender (Collection)</div>
          <div class="party-name">${booking.consignor_name || '—'}</div>
          <div class="party-detail">
            ${booking.consignor_address || ''}<br>
            ${booking.consignor_suburb ? booking.consignor_suburb + ', ' : ''}${booking.consignor_town || ''}<br>
            ${booking.consignor_contact || ''}<br>
            ${booking.consignor_contact_name ? 'Attn: ' + booking.consignor_contact_name : ''}
          </div>
        </div>
        <div class="party-box receiver-box">
          <div class="party-label">🏁 Receiver (Delivery)</div>
          <div class="party-name">${booking.consignee_name || '—'}</div>
          <div class="party-detail">
            ${booking.consignee_address || ''}<br>
            ${booking.consignee_suburb ? booking.consignee_suburb + ', ' : ''}${booking.consignee_town || ''}<br>
            ${booking.consignee_contact || ''}<br>
            ${booking.consignee_contact_name ? 'Attn: ' + booking.consignee_contact_name : ''}
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-top:8px">
        <a href="https://bookings.moktransports.com/waybills.html" class="action-btn">
          View Waybills Dashboard →
        </a>
      </div>
    </div>

    <div class="footer">
      Mok Transports Services (Pty) Ltd &nbsp;|&nbsp;
      12 Jupiter Road, Crown Mines, Johannesburg &nbsp;|&nbsp;
      011 839 6496 &nbsp;|&nbsp; accounts@moktransports.com
    </div>

  </div>
</body>
</html>`;

  const text = `
NEW BOOKING — ${bookingDate}
Waybill: ${waybill.waybill_no}
Service: ${serviceLabel} | Zone: ${booking.zone_label || '—'} | Weight: ${booking.weight}kg
Price: R ${Number(booking.price||0).toFixed(2)}

SENDER: ${booking.consignor_name} | ${booking.consignor_address} | ${booking.consignor_town}
RECEIVER: ${booking.consignee_name} | ${booking.consignee_address} | ${booking.consignee_town}

View: https://bookings.moktransports.com/waybills.html
  `.trim();

  try {
    await transporter.sendMail({
      from:    `"Mok Transports Bookings" <${process.env.SMTP_USER || 'mavis@moktransports.com'}>`,
      to:      notifyEmails.join(', '),
      subject: `🚚 New Booking — ${waybill.waybill_no} | ${booking.consignee_town || 'Local'}`,
      html,
      text
    });
    console.log(`✅ Notification sent to: ${notifyEmails.join(', ')}`);
  } catch (err) {
    // Log but never crash the booking — email is non-blocking
    console.error('❌ Email notification failed:', err.message);
  }
};


