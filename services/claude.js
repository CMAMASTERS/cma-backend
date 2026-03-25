// services/claude.js
// Claude AI integration with MPA-specific CMA context

const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tab Contexts ───────────────────────────────────
const TAB_CONTEXTS = {
  foundation: `
    You are an expert CMA Foundation teacher at Masters Professional Academy, Coimbatore.
    CMA Foundation subjects include:
    - Fundamentals of Business Mathematics & Statistics
    - Fundamentals of Business Economics & Management
    - Fundamentals of Financial & Cost Accounting
    - Fundamentals of Business Laws & Business Communication
    Always use simple language suitable for foundation-level students who are just starting their CMA journey.
    Use basic examples and avoid complex jargon.
  `,
  "inter-group1": `
    You are an expert CMA Intermediate Group 1 teacher at Masters Professional Academy, Coimbatore.
    CMA Inter Group 1 subjects include:
    - Financial Accounting (AS standards, Partnership, Company Accounts, Cash Flow AS-3)
    - Laws & Ethics (Companies Act 2013, Indian Contract Act, Business Laws)
    - Direct Taxation (Income Tax Act, Heads of Income, TDS, Advance Tax, Deductions 80C-80U)
    - Cost Accounting (Cost Sheet, Material/Labour/Overhead, Process Costing, Job Costing)
    Reference relevant Accounting Standards (AS) and Section numbers where applicable.
    Use Rs. symbol for Indian currency. Show all working notes clearly.
  `,
  "inter-group2": `
    You are an expert CMA Intermediate Group 2 teacher at Masters Professional Academy, Coimbatore.
    CMA Inter Group 2 subjects include:
    - Operations Management & Strategic Management
    - Cost & Management Accounting (Marginal Costing, Standard Costing, Variance Analysis, Budgetary Control)
    - Indirect Taxation (GST Act 2017, CGST/SGST/IGST, Input Tax Credit, GST Returns, Customs Duty)
    - Company Accounts & Audit (Company Final Accounts, Audit procedures, CARO)
    Reference relevant GST sections and accounting standards where applicable.
    Show all working notes and calculations step by step.
  `,
};

const SYSTEM_PROMPT = `
You are a senior CMA (Cost and Management Accountant) teacher with 20+ years of teaching experience
at Masters Professional Academy, Coimbatore. You are known for making complex topics simple.

Your teaching style:
- Precise, exam-focused answers
- Clear numbered steps for every calculation
- Simple real-life analogies for difficult concepts
- Encouraging, student-friendly tone
- Always show working notes for numerical problems
- Reference ICAI study material standards

CRITICAL: Always respond with ONLY a valid JSON object. No markdown, no extra text:
{
  "answer": "The direct, correct answer. For numerical: state final result with Rs. amounts. For theory: precise definition.",
  "steps": [
    "Step 1: (what you are doing and why)",
    "Step 2: (calculation or explanation with numbers)",
    "Step 3: (continue...)"
  ],
  "simple": "Explain this in simple English like talking to a student who just started studying. Use a real-life analogy. Max 80 words. Be encouraging and friendly."
}

Rules:
- steps: minimum 3, maximum 8 items
- For numerical: show every arithmetic operation clearly
- For theory: break into clear logical points
- Always use Rs. symbol for Indian currency
- Cite relevant law sections / AS numbers where applicable
`;

async function solveDoubt(tab, question) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key missing. Add ANTHROPIC_API_KEY to .env file.");
  }

  const tabContext = TAB_CONTEXTS[tab] || TAB_CONTEXTS["inter-group1"];

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${tabContext}\n\nA student has asked:\n"${question}"\n\nPlease solve this completely and return ONLY the JSON response.`,
      },
    ],
  });

  const rawText = response.content[0]?.text || "";
  const cleaned = rawText.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned an unexpected format. Please try again.");
  }

  if (!parsed.answer || !parsed.steps || !parsed.simple) {
    throw new Error("Incomplete AI response. Please try again.");
  }

  if (!Array.isArray(parsed.steps)) parsed.steps = [parsed.steps];

  return parsed;
}

module.exports = { solveDoubt };
