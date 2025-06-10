require('dotenv').config();
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const db = require('./sql');

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'tha333456@gmail.com',
    pass: 'crrm revq gwqi kiej'
  }
});

// Update statusID for expiring and just expired services
async function updateServiceStatus() {
  // Set statusID = 2 for expiring in 3 months
  await db.connectAndQuery(`
    UPDATE Service
    SET statusID = 2
    WHERE endDate > GETDATE() AND endDate <= DATEADD(DAY, 90, GETDATE())
  `);

  // Set statusID = 3 for just expired (within 30 days)
  await db.connectAndQuery(`
    UPDATE Service
    SET statusID = 3
    WHERE endDate <= GETDATE() AND endDate >= DATEADD(DAY, -30, GETDATE())
  `);
}

// Fetch services that are expiring or just expired
async function fetchExpiringServices() {
  const query = `
    SELECT serviceID, DeviceName, endDate
    FROM Service
    WHERE 
      (endDate > GETDATE() AND endDate <= DATEADD(DAY, 90, GETDATE()))
      OR
      (endDate <= GETDATE() AND endDate >= DATEADD(DAY, -30, GETDATE()))
  `;
  return db.connectAndQuery(query);
}

// Function to send email
async function sendExpireNotification(services) {
  if (!services.length) {
    console.log('No expiring or just expired services found.');
    return;
  }

  const serviceList = services.map(
    s => `ID: ${s.serviceID}, Device: ${s.DeviceName}, End: ${s.endDate}`
  ).join('\n');

  const mailOptions = {
    from: 'tha333456@gmail.com',
    to: 'libzthums@gmail.com', // Set your recipient
    subject: 'Services Expiring Soon or Just Expired',
    text: `The following services will expire in 3 months or just expired (within 30 days):\n\n${serviceList}`
  };

  await transporter.sendMail(mailOptions);
  console.log('Notification email sent.');
}

// Scheduled job: runs every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  try {
    await updateServiceStatus(); // 1. Update statusID
    const services = await fetchExpiringServices(); // 2. Fetch data
    await sendExpireNotification(services); // 3. Send email
  } catch (error) {
    console.error('Error in scheduled notifier:', error);
  }
});

console.log('Service expire notifier scheduler is running...');