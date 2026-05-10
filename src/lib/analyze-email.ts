export interface EmailAnalysis {
  is_placement_related: boolean;
  company: string | null;
  role: string | null;
  stage: string;
  deadline: string | null;
  deadline_text: string | null;
  action_required: boolean;
  action_description: string | null;
  urgency: string;
  contact_email: string | null;
  important_links?: string[];
  confidence: number;
  summary: string;
  reply_draft: string | null;
}

interface AnalyzeEmailInput {
  emailContent: string;
  emailSubject: string;
  emailFrom: string;
  emailDate?: string | null;
}

const cleanModelJson = (text: string) =>
  text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

const BLOCKED_URL_PATTERNS = [
  /linkedin\.com\/comm/i,
  /utm_/i,
  /trackingId/i,
  /midToken/i,
  /otpToken/i,
  /unsubscribe/i,
  /click\.email/i,
  /mailtrack/i,
  /naukri\.com\/rateapplication/i,
  /internshala\.com\/track/i,
  /refId=/i,
  /lipi=/i,
  /trk=/i,
];

const filterLinks = (links: string[]): string[] => {
  return links.filter((link) => {
    if (!link.startsWith("http")) return false;
    return !BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(link));
  });
};

export async function analyzeEmailWithAI({
  emailContent,
  emailSubject,
  emailFrom,
  emailDate,
}: AnalyzeEmailInput): Promise<EmailAnalysis> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY in environment variables");
  }

  const prompt = `You are an AI assistant helping Indian students track job applications during placement season.

Analyze this email and extract information. Return ONLY a valid JSON object, nothing else, no markdown.

{
  "is_placement_related": true or false,
  "company": "company name or null",
  "role": "job role or null",
  "stage": "one of: Applied / Shortlisted / Assignment / Interview / Offer / Rejected / Unknown",
  "deadline": "ISO date string or null",
  "deadline_text": "deadline as written in email or null",
  "action_required": true or false,
  "action_description": "what needs to be done or null",
  "urgency": "HIGH or MEDIUM or LOW",
  "contact_email": "HR email or null",
  "important_links": ["only direct action URLs like assignment submission, form, interview links - max 2 links - no tracking URLs, no linkedin.com/comm URLs, no utm parameters"],
  "confidence": 0 to 100,
  "summary": "one line summary",
  "reply_draft": "a professional reply email if action required, or null"
}

Rules:
- Real companies: Zerodha, Razorpay, Swiggy, Flipkart, Zomato, CRED, PhonePe, Groww, Meesho, Ola, Paytm, Infosys, TCS, Wipro, HCL, Accenture, and any legitimate hiring company.
- Real platforms: InternShala, LinkedIn, Naukri, Unstop, Dare2Compete, campus placement cells.
- SPAM/NOT placement: certificate courses, webinar promotions, discount offers, profile-view notifications, Unstop contest spam, random newsletter, paid resume services.
- LinkedIn/recruiter emails are placement related only if they contain a real company opportunity, interview, assignment, recruiter outreach, or application status update.
- Profile viewed, course ads, contests, certificates, webinars, and generic job tips are NOT placement related.
- If deadline is relative like "this Friday", calculate from the email date if present, otherwise from today: ${new Date().toISOString()}.
- Rejection emails: action_required = false, urgency = LOW.
- Offer letters: urgency = HIGH, action_required = true.
- If not placement related, return company null, role null, stage "Unknown", action_required false, urgency LOW, and reply_draft null.
- important_links: include ONLY direct action links like assignment portals, form submissions, interview meeting links. Maximum 2 links. NEVER include LinkedIn tracking URLs, newsletter unsubscribe links, or any URL containing "utm", "trackingId", "midToken", "otpToken", or "comm/jobs".
- If no clean action links found, return empty array []

Email Date: ${emailDate || "Unknown"}
Email From: ${emailFrom}
Email Subject: ${emailSubject}
Email Content: ${emailContent.slice(0, 2000)}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq API request failed");
  }

  if (!data.choices || !data.choices[0]?.message?.content) {
    throw new Error(`Invalid Groq response structure: ${JSON.stringify(data)}`);
  }

  const responseText = data.choices[0].message.content;
  const cleanJson = cleanModelJson(responseText);

  try {
    const safeJson = cleanJson.replace(/[\x00-\x1F\x7F]/g, " ");
    const parsed = JSON.parse(safeJson) as EmailAnalysis;

    // Filter tracking URLs from important_links
    if (parsed.important_links && parsed.important_links.length > 0) {
      parsed.important_links = filterLinks(parsed.important_links);
    }

    return parsed;
  } catch {
    console.error("JSON parse error:", cleanJson);
    throw new Error("AI returned invalid JSON format");
  }
}