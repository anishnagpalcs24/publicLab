import { pool } from "../config/db.js";

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden: insufficient role permissions",
      });
    }

    next();
  };
}

/**
 * Middleware ensuring the authenticated laboratory possesses an active, non-expired subscription.
 * Admins are permitted unrestricted access.
 * Expired, past_due, cancelled, or missing subscriptions are rejected with 403 Forbidden.
 */
export function requireActiveSubscription() {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      if (req.user.role === "admin") {
        return next();
      }

      if (req.user.role !== "lab" || !req.user.labId) {
        return res.status(403).json({
          success: false,
          message: "Laboratory access required",
        });
      }

      const result = await pool.query(
        `SELECT id, status, current_period_start, current_period_end
         FROM subscriptions
         WHERE lab_id = $1
         ORDER BY current_period_end DESC NULLS LAST, id DESC
         LIMIT 1`,
        [req.user.labId]
      );

      const sub = result.rows[0];

      if (
        !sub ||
        sub.status !== "active" ||
        (sub.current_period_end && new Date(sub.current_period_end) <= new Date())
      ) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to access this paid feature. Your subscription has expired, is cancelled, or is awaiting payment.",
          code: "SUBSCRIPTION_REQUIRED",
          subscriptionStatus: sub?.status || "none",
        });
      }

      req.subscription = sub;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default authorize;
