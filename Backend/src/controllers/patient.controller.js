

import * as patientService from "../services/patient.service.js";

// Register a patient
export async function createPatient(req, res, next) {
    try {
        const patient = await patientService.createPatient({
            ...req.body,
            labId: req.user.labId,
        });

        return res.status(201).json({
            success: true,
            message: "Patient registered successfully",
            data: patient,
        });
    } catch (error) {
        next(error);
    }
}

// Get a patient by ID
export async function getPatientById(req, res, next) {
    try {
        const patient = await patientService.getPatientById({
            patientId: req.params.patientId,
            user: req.user,
        });

        return res.status(200).json({
            success: true,
            message: "Patient retrieved successfully",
            data: patient,
        });
    } catch (error) {
        next(error);
    }
}

// Get patients belonging to the authenticated lab
export async function getPatients(req, res, next) {
    try {
        const result = await patientService.getPatients({
            user: req.user,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Patients retrieved successfully",
            data: result.patients,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

// Find a patient using the lab's local patient code
export async function getPatientByLabReference(req, res, next) {
    try {
        const patient = await patientService.getPatientByLabReference({
            user: req.user,
            localPatientCode: req.params.localPatientCode,
        });

        return res.status(200).json({
            success: true,
            message: "Patient retrieved successfully",
            data: patient,
        });
    } catch (error) {
        next(error);
    }
}
