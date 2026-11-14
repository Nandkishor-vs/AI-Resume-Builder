const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const puppeteer = require("puppeteer");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const interviewReportSchema = z.object({

    matchScore: z.number()
        .min(0)
        .max(100)
        .describe("A score between 0 and 100 indicating how well the candidate matches the job"),

    technicalQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string(),
        })
    ),

    behavioralQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string(),
        })
    ),

    skillGaps: z.array(
        z.object({
            skill: z.string(),
            severity: z.enum(["low", "medium", "high"]),
        })
    ),

    preparationPlan: z.array(
        z.object({
            day: z.number(),
            focus: z.string(),
            tasks: z.array(z.string()),
        })
    ),

    title: z.string()
        .describe("The actual job title extracted from the job description"),

});

async function generateInterviewReport({
    resume,
    selfDescription,
    jobDescription,
}) {

    const prompt = `
You are an expert technical interviewer and career advisor.

Analyze the candidate's profile and generate a complete interview preparation report.

CANDIDATE RESUME:
${resume}

SELF DESCRIPTION:
${selfDescription}

JOB DESCRIPTION:
${jobDescription}

INSTRUCTIONS:

1. Generate a matchScore between 0 and 100.
2. Generate relevant technical interview questions.
3. Generate relevant behavioral interview questions.
4. Identify skill gaps based on the job requirements.
5. Create a day-wise preparation plan.
6. Extract the actual job title from the job description.

IMPORTANT REQUIREMENTS:

- Return ALL fields defined in the schema.
- Do not omit any fields.
- Use the exact property names.
- Follow the exact data types.
- Do not return skillGaps as strings.
- Every skillGap must contain skill and severity.
- Every question must contain question, intention and answer.
- Every preparationPlan item must contain day, focus and tasks.
- If no skill gaps are identified, return an empty array.
- Never invent candidate qualifications or experience.

The skillGaps structure must look like:

[
    {
        "skill": "React.js",
        "severity": "medium"
    }
]

The preparationPlan structure must look like:

[
    {
        "day": 1,
        "focus": "JavaScript Fundamentals",
        "tasks": [
            "Revise closures",
            "Practice promises"
        ]
    }
]
    OUTPUT STRUCTURE REQUIREMENTS:

technicalQuestions must be an array of objects:
{
    "question": "Question text",
    "intention": "Why the interviewer asks this question",
    "answer": "Detailed answer"
}

behavioralQuestions must be an array of objects:
{
    "question": "Question text",
    "intention": "Why the interviewer asks this question",
    "answer": "Detailed answer"
}

skillGaps must be an array of objects:
{
    "skill": "React.js",
    "severity": "medium"
}

preparationPlan must be an array of objects:
{
    "day": 1,
    "focus": "JavaScript Fundamentals",
    "tasks": [
        "Revise JavaScript closures",
        "Practice promises"
    ]
}

The job title property MUST be named "title".
Do not use "jobTitle".

Do not return arrays of strings.
Every array must follow the exact object structure defined above.
`;

    const response = await ai.models.generateContent({

        model: "gemini-3-flash-preview",

        contents: prompt,

        config: {
    responseMimeType: "application/json",
    responseJsonSchema: z.toJSONSchema(interviewReportSchema),
},

    });

    if (!response.text) {
        throw new Error("Gemini returned an empty response");
    }

    const aiResponse = JSON.parse(response.text);

    console.log(
        "Gemini Raw Response:",
        JSON.stringify(aiResponse, null, 2)
    );

    // Validate the actual Gemini response
    const validatedResponse = interviewReportSchema.parse(aiResponse);

    return validatedResponse;
}

async function generatePdfFromHtml(htmlContent) {

    const browser = await puppeteer.launch();

    try {

        const page = await browser.newPage();

        await page.setContent(htmlContent, {
            waitUntil: "networkidle0",
        });

        const pdfBuffer = await page.pdf({

            format: "A4",

            printBackground: true,

            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm",
            },

        });

        return pdfBuffer;

    } finally {

        await browser.close();

    }

}

const resumePdfSchema = z.object({

    html: z.string()
        .describe("Complete professional HTML resume with CSS styling"),

});

async function generateResumePdf({
    resume,
    selfDescription,
    jobDescription,
}) {

    const prompt = `Generate a professional resume in HTML for a candidate with the following details:

Resume: ${resume}

Self Description: ${selfDescription}

Job Description: ${jobDescription}

Instructions:

1. Create a professional and ATS-friendly resume.
2. Tailor the resume according to the job description.
3. Highlight relevant skills, education and experience.
4. Use a clean and professional design.
5. Keep the resume ideally 1-2 pages long.
6. Use proper HTML structure and CSS styling.
7. Include all relevant information from the original resume.
8. Do not invent qualifications, experience or achievements.
9. Return valid HTML content.

IMPORTANT:
- The response must contain a single JSON field named "html".
- The html field must contain the complete HTML document.
- Include CSS styling inside the HTML document.
`;

    const response = await ai.models.generateContent({

        model: "gemini-3-flash-preview",

        contents: prompt,

        config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(resumePdfSchema),
        },

    });

    console.log("Gemini Resume Response:", response.text);

    const jsonContent = resumePdfSchema.parse(
        JSON.parse(response.text)
    );

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html);

    return pdfBuffer;

}

module.exports = {
    generateInterviewReport,
    generateResumePdf,
};