import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";


function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }
  return secret;
}

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is missing or malformed",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, getAccessSecret());
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    // Support passwordless patient report access tokens (no users account required)
    if (decoded.type === "patient_report_access") {
      const patientId = decoded.patientId || decoded.sub || decoded.id;
      const patientResult = await pool.query(
        `SELECT id, full_name, email, phone
         FROM patients
         WHERE id = $1`,
        [patientId]
      );

      const patient = patientResult.rows[0];

      if (!patient) {
        return res.status(401).json({
          success: false,
          message: "Patient record no longer exists",
        });
      }

      req.user = {
        id: patient.id,
        patientId: patient.id,
        fullName: patient.full_name,
        email: patient.email,
        phone: patient.phone,
        role: "patient",
        type: "patient_report_access",
      };

      req.session = { id: null };
      return next();
    }

    const userId = decoded.sub || decoded.id;
    const sessionId = decoded.sessionId;

    // Validate user in DB
    const userResult = await pool.query(
      `SELECT id, full_name, email, phone, role, lab_id, account_status, email_verified
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    if (user.account_status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is not active",
      });
    }

    // If session ID is present in token, check session status
    if (sessionId) {
      const sessionResult = await pool.query(
        `SELECT id, is_revoked, expires_at
         FROM auth_sessions
         WHERE id = $1`,
        [sessionId]
      );

      const session = sessionResult.rows[0];

      if (!session || session.is_revoked || new Date(session.expires_at) < new Date()) {
        return res.status(401).json({
          success: false,
          message: "Session has expired or was revoked. Please log in again.",
        });
      }
    }

    req.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role || "patient",
      labId: user.lab_id ? Number(user.lab_id) : null,
      accountStatus: user.account_status,
      emailVerified: user.email_verified,
      sessionId: sessionId || null,
    };

    req.session = {
      id: sessionId || null,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export default authenticate;
