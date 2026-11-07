export const emailConfig = {
  user: process.env.EMAIL_USER || "",
  pass: process.env.EMAIL_PASS || "",
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
  enableLiveEmail: process.env.ENABLE_LIVE_EMAIL === "true",
  mockEmail: process.env.MOCK_EMAIL === "true",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: process.env.SMTP_PORT || "",
  adminNotificationEmail:
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.CALLBACK_NOTIFICATION_EMAIL ||
    "anishnagpal37@gmail.com",
  callbackNotificationEmail:
    process.env.CALLBACK_NOTIFICATION_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    "anishnagpal37@gmail.com",
};

export default emailConfig;

