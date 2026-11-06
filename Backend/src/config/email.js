export const emailConfig = {
  user: process.env.EMAIL_USER || "",
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
  callbackNotificationEmail:
    process.env.CALLBACK_NOTIFICATION_EMAIL || "anishnagpal37@gmail.com",
};

export default emailConfig;

