const mongoose = require("mongoose");
const pdfParse = require("pdf-parse");

const {
    generateInterviewReport,
    generateResumePdf
} = require("../services/ai.service");

const interviewReportModel = require("../models/interviewReport.model");


// ==========================================
// GENERATE INTERVIEW REPORT
// ==========================================

async function generateInterViewReportController(req, res, next) {

    let parser;

    try {

        // Validate uploaded file
        if (!req.file) {
            return res.status(400).json({
                message: "Please upload your resume in PDF format."
            });
        }

        // Validate request body
        const { selfDescription, jobDescription } = req.body;

        if (!selfDescription || !jobDescription) {
            return res.status(400).json({
                message: "Self description and job description are required."
            });
        }

        // Parse uploaded PDF
        parser = new pdfParse.PDFParse({
            data: req.file.buffer
        });

        const resumeContent = await parser.getText();

        // Validate extracted PDF text
        if (!resumeContent.text || !resumeContent.text.trim()) {
            return res.status(400).json({
                message: "Unable to extract text from the uploaded PDF."
            });
        }

        // Generate interview report using Gemini AI
        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription,
            jobDescription
        });

        // Save interview report in MongoDB
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        });

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        });

    } catch (error) {

        next(error);

    } finally {

        if (parser) {
            await parser.destroy();
        }

    }
}


// ==========================================
// GET INTERVIEW REPORT BY ID
// ==========================================

async function getInterviewReportByIdController(req, res, next) {

    try {

        const { interviewId } = req.params;

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(interviewId)) {
            return res.status(400).json({
                message: "Invalid interview report ID."
            });
        }

        // Find report belonging to logged-in user
        const interviewReport = await interviewReportModel.findOne({
            _id: interviewId,
            user: req.user.id
        });

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        return res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        });

    } catch (error) {

        next(error);

    }
}


// ==========================================
// GET ALL INTERVIEW REPORTS
// ==========================================

async function getAllInterviewReportsController(req, res, next) {

    try {

        const interviewReports = await interviewReportModel
            .find({
                user: req.user.id
            })
            .sort({
                createdAt: -1
            })
            .select(
                "-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan"
            );

        return res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        });

    } catch (error) {

        next(error);

    }
}


// ==========================================
// GENERATE RESUME PDF
// ==========================================

async function generateResumePdfController(req, res, next) {

    try {

        const { interviewReportId } = req.params;

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(interviewReportId)) {
            return res.status(400).json({
                message: "Invalid interview report ID."
            });
        }

        // Find report belonging to logged-in user
        const interviewReport = await interviewReportModel.findOne({
            _id: interviewReportId,
            user: req.user.id
        });

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        // Extract saved report information
        const {
            resume,
            jobDescription,
            selfDescription
        } = interviewReport;

        // Generate resume PDF using Gemini and Puppeteer
        const pdfBuffer = await generateResumePdf({
            resume,
            jobDescription,
            selfDescription
        });

        // Set PDF response headers
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        });

        return res.send(pdfBuffer);

    } catch (error) {

        next(error);

    }
}


// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController
};