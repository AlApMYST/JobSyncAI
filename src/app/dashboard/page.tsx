"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { formatDistanceToNow, isPast, differenceInHours } from "date-fns";

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  urgent: boolean;
  content: string;
}

const DEMO_EMAILS: EmailItem[] = [
  {
    id: "1",
    from: "hr@razorpay.com",
    subject: "Congratulations! Shortlisted for SDE Intern - Razorpay",
    preview: "You have been shortlisted for the SDE Intern position...",
    time: "2 hours ago",
    urgent: true,
    content: `Dear Candidate,

Congratulations! We are pleased to inform you that you have been shortlisted for the Software Development Engineer Intern position at Razorpay.

Please complete the attached coding assignment and submit it via this link: https://razorpay.com/careers/assignment/12345 by May 8th, 2026 at 11:59 PM IST.

The assignment should take approximately 3-4 hours to complete.

For any queries, please contact us at hr@razorpay.com

Best regards,
Priya Sharma
HR Team, Razorpay`,
  },
  {
    id: "2",
    from: "placements@zerodha.com",
    subject: "Interview Scheduled - Zerodha - May 7th 2PM IST",
    preview: "Your technical interview has been scheduled...",
    time: "5 hours ago",
    urgent: true,
    content: `Hi,

Your technical interview for the Software Engineer position at Zerodha has been scheduled for May 7th, 2026 at 2:00 PM IST.

Interview Format: 2 rounds
- Round 1: Technical (Data Structures & Algorithms) - 60 mins
- Round 2: System Design - 45 mins

Meeting Link: https://meet.zerodha.com/interview/abc123

Please confirm your availability by replying to this email.

Regards,
Recruitment Team
Zerodha`,
  },
  {
    id: "3",
    from: "noreply@internshala.com",
    subject: "New Job Application - Swiggy | Backend Developer Intern",
    preview: "Your application has been received by Swiggy...",
    time: "1 day ago",
    urgent: false,
    content: `Hi Alapan,

Your application for the Backend Developer Intern position at Swiggy has been successfully submitted through InternShala.

Company: Swiggy
Role: Backend Developer Intern
Stipend: ₹25,000/month
Duration: 3 months

You will hear back from the company within 7-10 business days.

Good luck!
Team InternShala`,
  },
  {
    id: "4",
    from: "careers@flipkart.com",
    subject: "Update on your application - Flipkart SDE",
    preview: "Thank you for your interest in Flipkart...",
    time: "3 days ago",
    urgent: false,
    content: `Dear Applicant,

Thank you for your interest in the Software Development Engineer position at Flipkart and for taking the time to apply.

After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.

We encourage you to keep an eye on our careers page for future opportunities.

Best regards,
Talent Acquisition Team
Flipkart`,
  },
  {
    id: "5",
    from: "hr@groww.in",
    subject: "URGENT: Offer Letter - Groww | Please respond within 48 hours",
    preview: "We are delighted to extend an offer...",
    time: "18 days ago",
    urgent: true,
    content: `Dear Candidate,

We are delighted to extend an offer for the position of Software Development Engineer at Groww.

CTC: ₹12,00,000 per annum
Joining Date: June 1st, 2026
Location: Bangalore

Please accept or decline this offer by May 7th, 2026 by signing the attached offer letter and sending it back to hr@groww.in

This is a time-sensitive offer. Please respond within 48 hours.

Congratulations!
HR Team, Groww`,
  },
  {
    id: "6",
    from: "updates@unstop.com",
    subject: "Win certificates and prizes - Coding Carnival registration closes tonight",
    preview: "Register for the webinar and get a participation certificate...",
    time: "2 days ago",
    urgent: false,
    content: `Hi there,

Join our Coding Carnival webinar tonight and get a certificate of participation.

Registration fee: Rs. 199
Prizes, coupons and learning resources available for all participants.

This is not a hiring process and there is no job application attached.

Team Unstop`,
  },
  {
    id: "7",
    from: "recruiter@cred.club",
    subject: "SDE Intern opportunity at CRED - quick response needed",
    preview: "Your GitHub profile looks relevant for our backend internship...",
    time: "3 hours ago",
    urgent: true,
    content: `Hi Alapan,

I came across your GitHub profile and wanted to reach out for a Backend Engineering Intern opportunity at CRED.

If interested, please share your resume and availability for a quick call by tomorrow EOD.

Role: Backend Engineering Intern
Location: Bangalore

Best,
Ananya
Talent Team, CRED`,
  },
  {
    id: "8",
    from: "placementcell@college.edu",
    subject: "Shortlisted Candidates - Meesho SDE Intern Round 1",
    preview: "You have been shortlisted for Meesho Round 1...",
    time: "12 hours ago",
    urgent: true,
    content: `Dear Student,

You have been shortlisted for Round 1 of the Meesho SDE Intern hiring process through campus placements.

Please fill this confirmation form before EOD tomorrow:
https://forms.gle/meesho-round1-confirmation

Round 1 will be an online coding test. Further details will be shared after confirmation.

Regards,
Placement Cell`,
  },
  {
    id: "9",
    from: "updates@naukri.com",
    subject: "Your profile was viewed by 3 recruiters this week",
    preview: "Improve your profile visibility with premium services...",
    time: "4 days ago",
    urgent: false,
    content: `Hello,

Your profile was viewed by 3 recruiters this week.

Upgrade to Naukri Premium to improve visibility and get resume writing services.

This is an automated promotional email. No company has invited you for an interview or assignment.

Team Naukri`,
  },
  {
    id: "10",
    from: "talent@smallcase.com",
    subject: "Take-home task for Frontend Intern application",
    preview: "Please submit the take-home task by May 9th...",
    time: "6 hours ago",
    urgent: true,
    content: `Hi,

Thanks for applying to the Frontend Engineering Intern role at smallcase.

We would like you to complete a take-home assignment and submit your GitHub repository link by May 9th, 2026 at 10:00 PM IST.

Assignment link: https://smallcase.com/careers/frontend-intern-task

Regards,
Talent Team`,
  },
  {
    id: "11",
    from: "careers@phonepe.com",
    subject: "Action Required: Confirm your interview slot",
    preview: "You were selected for the next round but have not confirmed...",
    time: "21 days ago",
    urgent: true,
    content: `Dear Candidate,

You have been selected for the next round for the Software Engineering Intern role at PhonePe.

Please confirm your interview slot using this link by April 20th, 2026:
https://phonepe.com/careers/interview-slot/456

If we do not receive your confirmation, your candidature may be closed.

Regards,
PhonePe Hiring Team`,
  },
  {
    id: "12",
    from: "hello@greatlearning.in",
    subject: "Limited time certificate course for software jobs",
    preview: "Enroll now and get job-ready with our paid course...",
    time: "1 week ago",
    urgent: false,
    content: `Hi Student,

Our paid certificate course can help you prepare for software jobs.

Enroll today and get 60% off. This is a promotional learning email and not a company shortlist, interview, assignment, or offer.

Great Learning Team`,
  },
];

const PIPELINE_STAGES = [
  "Applied",
  "Shortlisted",
  "Assignment",
  "Interview",
  "Offer",
  "Rejected",
] as const;

const POSITIVE_STAGES = new Set(["Shortlisted", "Assignment", "Interview", "Offer"]);

const normalizeStage = (stage: string | null | undefined) =>
  PIPELINE_STAGES.find(
    (knownStage) => knownStage.toLowerCase() === stage?.toLowerCase()
  ) || "Unknown";

const getDeadlineDisplay = (deadline: string | null, deadlineText: string | null) => {
  if (!deadline) return deadlineText || null;
  const deadlineDate = new Date(deadline);
  if (isPast(deadlineDate)) {
    return `⚠️ EXPIRED — ${deadlineText || "deadline passed"}`;
  }
  const hoursLeft = differenceInHours(deadlineDate, new Date());
  if (hoursLeft < 24) {
    return `🔴 ${hoursLeft}h left — ${deadlineText || "deadline today"}`;
  } else if (hoursLeft < 48) {
    return `🟠 ${Math.floor(hoursLeft / 24)}d left — ${deadlineText || "deadline tomorrow"}`;
  } else {
    return `🟡 ${formatDistanceToNow(deadlineDate, { addSuffix: true })} — ${deadlineText || ""}`;
  }
};

interface EmailAnalysis {
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

export default function Dashboard() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [analysisByEmail, setAnalysisByEmail] = useState<Record<string, EmailAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    email: string | null;
  }>({ connected: false, email: null });
  const [scanningGmail, setScanningGmail] = useState(false);

  const analyzedEmails = Object.values(analysisByEmail);
  const placementAnalyses = analyzedEmails.filter((item) => item.is_placement_related);
  const stageCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = 0;
    return acc;
  }, {});

  placementAnalyses.forEach((item) => {
    const stage = normalizeStage(item.stage);
    if (Object.prototype.hasOwnProperty.call(stageCounts, stage)) {
      stageCounts[stage] += 1;
    }
  });

  const stats = {
    total: placementAnalyses.length,
    actionNeeded: placementAnalyses.filter((item) => item.action_required).length,
    shortlisted: placementAnalyses.filter((item) =>
      POSITIVE_STAGES.has(normalizeStage(item.stage))
    ).length,
    interviews: stageCounts.Interview,
    offers: stageCounts.Offer,
    filtered: analyzedEmails.length - placementAnalyses.length,
  };

  const loadDemoEmails = () => {
    setEmails(DEMO_EMAILS);
    setSelectedEmail(null);
    setAnalysis(null);
    setAnalysisByEmail({});
    setShowReply(false);
    setError(null);
  };

  useEffect(() => {
    const loadGmailStatus = async () => {
      try {
        const response = await fetch("/api/gmail/status");
        if (!response.ok) return;
        const data = await response.json();
        setGmailStatus({
          connected: Boolean(data.connected),
          email: data.email || null,
        });
      } catch (error) {
        console.error("Gmail status error:", error);
      }
    };
    loadGmailStatus();
  }, []);

  const connectGmail = () => {
    window.location.href = "/api/gmail/connect";
  };

  const scanGmail = async () => {
    setScanningGmail(true);
    setError(null);
    setSelectedEmail(null);
    setAnalysis(null);
    setShowReply(false);

    try {
      const response = await fetch("/api/gmail/scan", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gmail scan failed");
      }

      const nextEmails: EmailItem[] = result.items.map((item: any) => item.email);
      const nextAnalysis: Record<string, EmailAnalysis> = {};
      result.items.forEach((item: any) => {
        nextAnalysis[item.email.id] = item.analysis;
      });

      setEmails(nextEmails);
      setAnalysisByEmail(nextAnalysis);
    } catch (error) {
      console.error("Gmail scan error:", error);
      setError(error instanceof Error ? error.message : "Gmail scan failed");
    } finally {
      setScanningGmail(false);
    }
  };

  const analyzeEmail = async (email: EmailItem) => {
    setSelectedEmail(email);
    if (analysisByEmail[email.id]) {
      setAnalysis(analysisByEmail[email.id]);
      setShowReply(false);
      setError(null);
      return;
    }

    setAnalysis(null);
    setAnalyzing(true);
    setShowReply(false);
    setError(null);

    try {
      const response = await fetch("/api/analyze-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailContent: email.content,
          emailSubject: email.subject,
          emailFrom: email.from,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "AI analysis failed");
      }

      setAnalysis(result.data);
      setAnalysisByEmail((prev) => ({
        ...prev,
        [email.id]: result.data,
      }));
    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    if (urgency === "HIGH") return "text-red-400 bg-red-500/10 border-red-500/20";
    if (urgency === "MEDIUM") return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    return "text-green-400 bg-green-500/10 border-green-500/20";
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      Shortlisted: "text-blue-400",
      Interview: "text-purple-400",
      Assignment: "text-orange-400",
      Offer: "text-green-400",
      Rejected: "text-red-400",
      Applied: "text-gray-400",
    };
    return colors[stage] || "text-gray-400";
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0f] text-white flex flex-col">

      {/* Header */}
      <nav className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">
            J
          </div>
          <span className="font-bold text-lg">JobSync AI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">Powered by AI</span>
          <UserButton />
        </div>
      </nav>

      {/* Three Panel Layout */}
      <div className="grid grid-cols-3 flex-1 min-h-0">

        {/* LEFT — Email Feed */}
        <div className="min-h-0 border-r border-white/10 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-sm">
                Email Feed
                {emails.length > 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({emails.length})
                  </span>
                )}
              </h2>
              {gmailStatus.connected ? (
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-xs text-green-300">
                  Gmail connected
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-400">
                  Demo mode
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={loadDemoEmails}
                disabled={scanningGmail}
                className="bg-white/10 hover:bg-white/15 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-medium transition"
              >
                Demo Emails
              </button>
              <button
                onClick={connectGmail}
                disabled={scanningGmail}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-medium transition"
              >
                {gmailStatus.connected ? "Reconnect" : "Connect Gmail"}
              </button>
              <button
                onClick={scanGmail}
                disabled={!gmailStatus.connected || scanningGmail}
                className="bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-gray-500 px-3 py-2 rounded-lg text-xs font-medium transition"
              >
                {scanningGmail ? "Scanning..." : "Scan Gmail"}
              </button>
            </div>

            {gmailStatus.email && (
              <p className="truncate text-xs text-gray-500">
                Connected inbox: {gmailStatus.email}
              </p>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="text-4xl mb-3">📧</div>
                <p className="text-gray-400 text-sm">No emails loaded yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Load demo emails or connect Gmail to scan your real inbox.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => analyzeEmail(email)}
                    className={`p-4 cursor-pointer hover:bg-white/5 transition ${
                      selectedEmail?.id === email.id
                        ? "bg-white/5 border-l-2 border-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {email.urgent && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                              URGENT
                            </span>
                          )}
                          <span className="text-xs text-gray-500 truncate">
                            {email.from}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {email.subject}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {email.preview}
                        </p>
                      </div>
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {email.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE — AI Analysis */}
        <div className="min-h-0 border-r border-white/10 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-semibold text-sm">AI Analysis</h2>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {!selectedEmail && !analyzing && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-5xl mb-4">🤖</div>
                <p className="text-gray-400 text-sm">Select an email to analyze</p>
                <p className="text-gray-600 text-xs mt-1">
                  AI will extract all placement details
                </p>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 text-sm">Analyzing with AI...</p>
              </div>
            )}

            {error && !analyzing && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-sm font-medium text-red-300">Analysis failed</p>
                <p className="mt-1 text-xs text-red-200/80">{error}</p>
              </div>
            )}

            {analysis && !analyzing && !analysis.is_placement_related && (
              <div className="space-y-4">
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-yellow-300">
                    Filtered out
                  </p>
                  <p className="mt-2 text-sm text-gray-200">
                    This email does not look like a real placement opportunity.
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-gray-400 mb-1">AI Summary</p>
                  <p className="text-sm">{analysis.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                    <p className="text-gray-500">Classification</p>
                    <p className="font-medium text-yellow-300">Not placement</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                    <p className="text-gray-500">Confidence</p>
                    <p className="font-medium text-blue-300">{analysis.confidence}%</p>
                  </div>
                </div>
              </div>
            )}

            {analysis && !analyzing && analysis.is_placement_related && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${getUrgencyColor(analysis.urgency)}`}>
                    {analysis.urgency} URGENCY
                  </span>
                  <span className="text-xs text-gray-400">
                    {analysis.confidence}% confidence
                  </span>
                </div>

                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${analysis.confidence}%` }}
                  ></div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-lg">
                      🏢
                    </div>
                    <div>
                      <p className="font-semibold">{analysis.company || "Unknown company"}</p>
                      <p className="text-sm text-gray-400">{analysis.role || "Role not found"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-gray-500">Stage</p>
                      <p className={`font-medium ${getStageColor(analysis.stage)}`}>
                        {analysis.stage}
                      </p>
                    </div>
                    {(analysis.deadline || analysis.deadline_text) && (
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500">Deadline</p>
                        <p className="font-medium text-orange-400 text-xs">
                          {getDeadlineDisplay(analysis.deadline, analysis.deadline_text)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {analysis.important_links && analysis.important_links.length > 0 && (
                  <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                    <p className="text-xs text-blue-300 mb-2">Important Links</p>
                    <div className="space-y-1">
                      {analysis.important_links.map((link) => (
                        
                       <a   key={link}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-blue-400 hover:text-blue-300"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-gray-400 mb-1">AI Summary</p>
                  <p className="text-sm">{analysis.summary}</p>
                </div>

                {analysis.action_required && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                    <p className="text-xs text-orange-400 font-medium mb-1">
                      ⚡ Action Required
                    </p>
                    <p className="text-sm text-gray-300">
                      {analysis.action_description}
                    </p>
                  </div>
                )}

                {analysis.reply_draft && (
                  <div>
                    <button
                      onClick={() => setShowReply(!showReply)}
                      className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm font-medium transition"
                    >
                      ✍️ {showReply ? "Hide" : "View"} AI Reply Draft
                    </button>
                    {showReply && (
                      <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-2">Draft Reply:</p>
                        <p className="text-xs text-gray-200 whitespace-pre-wrap">
                          {analysis.reply_draft}
                        </p>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(analysis.reply_draft || "")
                          }
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                        >
                          Copy to clipboard
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Dashboard */}
        <div className="min-h-0 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-semibold text-sm">Pipeline Dashboard</h2>
          </div>

          <div className="p-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
                <div className="text-xs text-gray-400 mt-1">Total Applications</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-orange-400">{stats.actionNeeded}</div>
                <div className="text-xs text-gray-400 mt-1">Action Needed</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-green-400">{stats.shortlisted}</div>
                <div className="text-xs text-gray-400 mt-1">Shortlisted+</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-purple-400">{stats.interviews}</div>
                <div className="text-xs text-gray-400 mt-1">Interviews</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-emerald-400">{stats.offers}</div>
                <div className="text-xs text-gray-400 mt-1">Offers</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                <div className="text-2xl font-bold text-yellow-400">{stats.filtered}</div>
                <div className="text-xs text-gray-400 mt-1">Filtered</div>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            {Object.values(analysisByEmail).some(
              (a) => a.deadline && !isPast(new Date(a.deadline))
            ) && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  Upcoming Deadlines
                </h3>
                <div className="space-y-2">
                  {Object.values(analysisByEmail)
                    .filter(
                      (a) =>
                        a.is_placement_related &&
                        a.deadline &&
                        !isPast(new Date(a.deadline))
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.deadline!).getTime() -
                        new Date(b.deadline!).getTime()
                    )
                    .slice(0, 3)
                    .map((a, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/10 rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{a.company}</span>
                          <span className="text-xs text-orange-400">
                            {differenceInHours(new Date(a.deadline!), new Date()) < 24
                              ? `${differenceInHours(new Date(a.deadline!), new Date())}h left`
                              : `${Math.floor(differenceInHours(new Date(a.deadline!), new Date()) / 24)}d left`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{a.deadline_text}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Pipeline Stages */}
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                Pipeline Stages
              </h3>
              {PIPELINE_STAGES.map((stage) => (
                <div
                  key={stage}
                  className="flex items-center justify-between py-2 border-b border-white/5"
                >
                  <span className="text-sm text-gray-300">{stage}</span>
                  <span className="text-sm font-medium text-gray-500">
                    {stageCounts[stage]}
                  </span>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            {analysis && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  Recent Analysis
                </h3>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {analysis.is_placement_related
                        ? analysis.company || "Unknown company"
                        : "Filtered email"}
                    </span>
                    <span
                      className={`text-xs ${
                        analysis.is_placement_related
                          ? getStageColor(analysis.stage)
                          : "text-yellow-300"
                      }`}
                    >
                      {analysis.is_placement_related ? analysis.stage : "Filtered"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{analysis.summary}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}