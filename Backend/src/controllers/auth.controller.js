import * as authService from "../services/auth.service.js";

const COOKIE_NAME = "refreshToken";

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

function getClearCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
  };
}

// Register a new user
export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);

    return res.status(201).json({
      success: true,
      message: result.message || "Registration successful. Please verify your email.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// Verify email address with 6-digit OTP
export async function verifyOtp(req, res, next) {
  try {
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await authService.verifyEmailOtp({
      email: req.body.email,
      otp: req.body.otp,
      ipAddress,
      userAgent,
    });

    res.cookie(COOKIE_NAME, result.refreshToken, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Resend verification OTP
export async function resendOtp(req, res, next) {
  try {
    const result = await authService.resendEmailOtp({
      email: req.body.email,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (error) {
    next(error);
  }
}

// Log in an existing user
export async function login(req, res, next) {
  try {
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await authService.login({
      ...req.body,
      ipAddress,
      userAgent,
    });

    res.cookie(COOKIE_NAME, result.refreshToken, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Refresh access token using HttpOnly refresh cookie (or body fallback)
export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await authService.refreshTokens({
      refreshToken,
      ipAddress,
      userAgent,
    });

    res.cookie(COOKIE_NAME, result.refreshToken, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Logout current session
export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    const sessionId = req.user?.sessionId;

    await authService.logout({ sessionId, refreshToken });

    res.clearCookie(COOKIE_NAME, getClearCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
}

// Logout all active sessions for the authenticated user
export async function logoutAll(req, res, next) {
  try {
    await authService.logoutAll(req.user.id);

    res.clearCookie(COOKIE_NAME, getClearCookieOptions());

    return res.status(200).json({
      success: true,
      message: "All active sessions have been revoked successfully",
    });
  } catch (error) {
    next(error);
  }
}

// Get authenticated user profile
export async function getMe(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      message: "Current profile retrieved successfully",
      data: {
        user: req.user,
        session: {
          id: req.user?.sessionId,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// Forgot password - sends reset OTP
export async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword({
      email: req.body.email,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

// Reset password with OTP
export async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword({
      email: req.body.email,
      otp: req.body.otp,
      newPassword: req.body.newPassword,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

// Change password for logged-in user
export async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}


