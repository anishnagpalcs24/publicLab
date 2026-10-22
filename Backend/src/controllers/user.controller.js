
import * as userService from "../services/user.service.js";

// Get the currently authenticated user's profile
export async function getMyProfile(req, res, next) {
    try {
        const user = await userService.getUserProfile(req.user.id);

        return res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            data: user,
        });
    } catch (error) {
        next(error);
    }
}

// Update the currently authenticated user's profile
export async function updateMyProfile(req, res, next) {
    try {
        const user = await userService.updateUserProfile(
            req.user.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: user,
        });
    } catch (error) {
        next(error);
    }
}

// Get a user by ID (for authorized administrative use)
export async function getUserById(req, res, next) {
    try {
        const user = await userService.getUserById(req.params.userId);

        return res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: user,
        });
    } catch (error) {
        next(error);
    }
}

// List users (for authorized administrative use)
export async function getUsers(req, res, next) {
    try {
        const result = await userService.getUsers({
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}
