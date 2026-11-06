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

// Get patients belonging to the authenticated lab (with search)
export async function getPatients(req, res, next) {
    try {
        const result = await patientService.getPatients({
            user: req.user,
            search: req.query.search,
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

// Update permitted patient details
export async function updatePatient(req, res, next) {
    try {
        const patient = await patientService.updatePatient({
            patientId: req.params.patientId,
            user: req.user,
            updates: req.body,
        });

        return res.status(200).json({
            success: true,
            message: "Patient updated successfully",
            data: patient,
        });
    } catch (error) {
        next(error);
    }
}

// Find a patient using the lab's local patient code
export async function getPatientByLabReference(req, res, next) {
    try {
        const code = req.params.code || req.params.localPatientCode;
        const patient = await patientService.getPatientByLabReference({
            user: req.user,
            localPatientCode: code,
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

// Get clinical calculations for a specific patient
export async function getPatientCalculations(req, res, next) {
    try {
        const result = await patientService.getPatientCalculations({
            patientId: req.params.patientId,
            user: req.user,
            limit: req.query.limit,
            offset: req.query.offset,
        });

        return res.status(200).json({
            success: true,
            message: "Patient calculations retrieved successfully",
            data: result.calculations,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
}

