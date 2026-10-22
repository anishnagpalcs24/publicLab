
import * as authService from "../services/auth.service.js";

// Register a new user
export async function register(req, res, next) {
    try {
        const result = await authService.register(req.body);

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

// Log in an existing user
export async function login(req, res, next) {
    try {
        const result = await authService.login(req.body);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
