"use client";

import { useEffect, useMemo, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { differenceInHours, formatDistanceToNow, isPast } from "date-fns";

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  urgent: boolean;
  content: string;
}

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

type DashboardPanel = "feed" | "analysis" | "dashboard";

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
  if (Number.isNaN(deadlineDate.getTime())) return deadlineText || null;

  if (isPast(deadlineDate)) {
    return `EXPIRED - ${deadlineText || "deadline passed"}`;
  }

  const hoursLeft = differenceInHours(deadlineDate, new Date());
  if (hoursLeft < 24) {
    return `${hoursLeft}h left - ${deadlineText || "deadline today"}`;
  }
  if (hoursLeft < 48) {
    return `${Math.floor(hoursLeft / 24)}d left - ${deadlineText || "deadline tomorrow"}`;
  }
  return `${formatDistanceToNow(deadlineDate, { addSuffix: true })} - ${
    deadlineText || "upcoming deadline"
  }`;
};

const getPlatform = (email?: EmailItem) => {
  const haystack = `${email?.from || ""} ${email?.subject || ""}`.toLowerCase();
  if (haystack.includes("internshala")) return "InternShala";
  if (haystack.includes("linkedin")) return "LinkedIn";
  if (haystack.includes("naukri")) return "Naukri";
  if (haystack.includes("unstop") || haystack.includes("dare2compete")) return "Unstop";
  if (haystack.includes("placement")) return "Campus";
  return "Direct";
};

const getPanelClass = (panel: DashboardPanel, activePanel: DashboardPanel) =>
  `${activePanel === panel ? "flex" : "hidden"} md:flex`;

export default function Dashboard() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [analysisByEmail, setAnalysisByEmail] = useState<Record<string, EmailAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    email: string | null;
  }>({ connected: false, email: null });
  const [scanningGmail, setScanningGmail] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<DashboardPanel>("feed");

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

  const analytics = useMemo(() => {
    const responseRate =
      stats.total > 0 ? Math.round((stats.shortlisted / stats.total) * 100) : 0;

    const platformCounts = emails.reduce<Record<string, number>>((acc, email) => {
      const emailAnalysis = analysisByEmail[email.id];
      if (!emailAnalysis?.is_placement_related) return acc;
      const platform = getPlatform(email);
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    return {
      responseRate,
      platforms: Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    };
  }, [analysisByEmail, emails, stats.shortlisted, stats.total]);

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

    const loadApplications = async () => {
      try {
        setLoadingApps(true);
        const response = await fetch("/api/applications");
        if (!response.ok) return;
        const data = await response.json();

        if (data.success) {
          const analysisMap: Record<string, EmailAnalysis> = {};
          const emailItems: EmailItem[] = [];

          data.applications.forEach((app: any) => {
            const id = app.emailId ? `gmail-${app.emailId}` : `db-${app.id}`;
            const importantLinks = Array.isArray(app.importantLinks)
              ? app.importantLinks
              : [];

            analysisMap[id] = {
              is_placement_related: true,
              company: app.company,
              role: app.role,
              stage: app.stage,
              deadline: app.deadline,
              deadline_text: app.deadlineText,
              action_required: app.actionRequired,
              action_description: app.actionDescription,
              urgency: app.urgency,
              contact_email: app.contactEmail,
              confidence: app.confidence,
              summary: app.summary || "",
              reply_draft: null,
              important_links: importantLinks,
            };

            emailItems.push({
              id,
              from: app.fromEmail || "",
              subject: app.subject || app.company,
              preview: app.summary || "",
              time: new Date(app.receivedAt || app.createdAt).toLocaleDateString(),
              urgent: app.actionRequired || app.urgency === "HIGH",
              content: app.rawEmail || "",
            });
          });

          setEmails(emailItems);
          setAnalysisByEmail(analysisMap);
        }
      } catch (error) {
        console.error("Error loading applications:", error);
      } finally {
        setLoadingApps(false);
      }
    };

    loadGmailStatus();
    loadApplications();
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
    setScanNotice(null);

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

      setEmails((prev) => {
        const existingIds = new Set(prev.map((email) => email.id));
        const newEmails = nextEmails.filter((email) => !existingIds.has(email.id));
        return [...newEmails, ...prev];
      });
      setAnalysisByEmail((prev) => ({ ...prev, ...nextAnalysis }));

      const placementCount =
        typeof result.placementCount === "number"
          ? result.placementCount
          : Object.values(nextAnalysis).filter((item) => item.is_placement_related)
              .length;
      const filteredCount =
        typeof result.filteredCount === "number"
          ? result.filteredCount
          : Object.values(nextAnalysis).filter((item) => !item.is_placement_related)
              .length;

      const firstActionable = nextEmails.find(
        (email) => nextAnalysis[email.id]?.is_placement_related
      );
      if (firstActionable) {
        setSelectedEmail(firstActionable);
        setAnalysis(nextAnalysis[firstActionable.id]);
        setActivePanel("analysis");
      }

      setScanNotice(
        `Scan complete: ${placementCount} opportunities found, ${filteredCount} filtered.`
      );
    } catch (error) {
      console.error("Gmail scan error:", error);
      setError(error instanceof Error ? error.message : "Gmail scan failed");
      setActivePanel("analysis");
    } finally {
      setScanningGmail(false);
    }
  };

  const analyzeEmail = async (email: EmailItem) => {
    setSelectedEmail(email);
    setActivePanel("analysis");

    if (analysisByEmail[email.id]) {
      setAnalysis(analysisByEmail[email.id]);
      setShowReply(false);
      setError(null);
      return;
    }

    if (!email.content) {
      setError("Email content is not available for re-analysis");
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

  const getStageBadgeColor = (stage: string) => {
    const colors: Record<string, string> = {
      Shortlisted: "bg-blue-500/10 text-blue-300 border-blue-500/20",
      Interview: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      Assignment: "bg-orange-500/10 text-orange-300 border-orange-500/20",
      Offer: "bg-green-500/10 text-green-300 border-green-500/20",
      Rejected: "bg-red-500/10 text-red-300 border-red-500/20",
      Applied: "bg-white/5 text-gray-300 border-white/10",
      Filtered: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    };
    return colors[stage] || "bg-white/5 text-gray-300 border-white/10";
  };

  const feedPanel = (
    <section className={`${getPanelClass("feed", activePanel)} min-h-0 flex-col overflow-hidden border-white/10 md:border-r`}>
      <div className="space-y-3 border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Email Feed
            {emails.length > 0 && (
              <span className="ml-2 text-xs text-gray-500">({emails.length})</span>
            )}
          </h2>
          {gmailStatus.connected ? (
            <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-xs text-green-300">
              Gmail connected
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-400">
              Not connected
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={connectGmail}
            disabled={scanningGmail}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium transition hover:bg-blue-500 disabled:opacity-50"
          >
            {gmailStatus.connected ? "Reconnect Gmail" : "Connect Gmail"}
          </button>
          <button
            onClick={scanGmail}
            disabled={!gmailStatus.connected || scanningGmail}
            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium transition hover:bg-green-500 disabled:bg-white/10 disabled:text-gray-500"
          >
            {scanningGmail ? "Scanning..." : "Scan Gmail"}
          </button>
        </div>

        {gmailStatus.email && (
          <p className="truncate text-xs text-gray-500">Connected: {gmailStatus.email}</p>
        )}
        {scanNotice && <p className="text-xs text-blue-300">{scanNotice}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadingApps ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-gray-500">Loading your applications...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <div className="mb-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-300">
              @
            </div>
            <p className="text-sm text-gray-400">No applications yet</p>
            <p className="mt-1 text-xs text-gray-600">
              Connect Gmail and scan your inbox to start tracking.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {emails.map((email) => {
              const emailAnalysis = analysisByEmail[email.id];
              const badgeLabel = emailAnalysis
                ? emailAnalysis.is_placement_related
                  ? normalizeStage(emailAnalysis.stage)
                  : "Filtered"
                : null;

              return (
                <button
                  key={email.id}
                  onClick={() => analyzeEmail(email)}
                  className={`block w-full p-4 text-left transition hover:bg-white/5 ${
                    selectedEmail?.id === email.id
                      ? "border-l-2 border-blue-500 bg-white/5"
                      : "border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        {email.urgent && (
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                            URGENT
                          </span>
                        )}
                        {badgeLabel && (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-xs ${getStageBadgeColor(
                              badgeLabel
                            )}`}
                          >
                            {badgeLabel}
                          </span>
                        )}
                        <span className="truncate text-xs text-gray-500">{email.from}</span>
                      </div>
                      <p className="truncate text-sm font-medium">{email.subject}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{email.preview}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-gray-600">{email.time}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const analysisPanel = (
    <section className={`${getPanelClass("analysis", activePanel)} min-h-0 flex-col overflow-hidden border-white/10 md:border-r`}>
      <div className="border-b border-white/10 p-4">
        <h2 className="text-sm font-semibold">AI Analysis</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!selectedEmail && !analyzing && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-300">
              AI
            </div>
            <p className="text-sm text-gray-400">Select an email to see details</p>
            <p className="mt-1 text-xs text-gray-600">
              Click any scanned email to view its extracted placement details.
            </p>
          </div>
        )}

        {analyzing && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm text-gray-400">Analyzing with AI...</p>
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
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="mb-1 text-xs text-gray-400">AI Summary</p>
              <p className="text-sm">{analysis.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <p className="text-gray-500">Classification</p>
                <p className="font-medium text-yellow-300">Not placement</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <p className="text-gray-500">Confidence</p>
                <p className="font-medium text-blue-300">{analysis.confidence}%</p>
              </div>
            </div>
          </div>
        )}

        {analysis && !analyzing && analysis.is_placement_related && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={`rounded border px-2 py-1 text-xs font-bold ${getUrgencyColor(
                  analysis.urgency
                )}`}
              >
                {analysis.urgency} URGENCY
              </span>
              <span className="text-xs text-gray-400">{analysis.confidence}% confidence</span>
            </div>

            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${analysis.confidence}%` }}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">
                  Co
                </div>
                <div>
                  <p className="font-semibold">{analysis.company || "Unknown company"}</p>
                  <p className="text-sm text-gray-400">{analysis.role || "Role not found"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-gray-500">Stage</p>
                  <p className={`font-medium ${getStageColor(analysis.stage)}`}>
                    {analysis.stage}
                  </p>
                </div>
                {(analysis.deadline || analysis.deadline_text) && (
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-gray-500">Deadline</p>
                    <p className="text-xs font-medium text-orange-400">
                      {getDeadlineDisplay(analysis.deadline, analysis.deadline_text)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {analysis.important_links && analysis.important_links.length > 0 && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <p className="mb-2 text-xs text-blue-300">Important Links</p>
                <div className="space-y-1">
                  {analysis.important_links.map((link) => (
                    <a
                      key={link}
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

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="mb-1 text-xs text-gray-400">AI Summary</p>
              <p className="text-sm">{analysis.summary}</p>
            </div>

            {analysis.action_required && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                <p className="mb-1 text-xs font-medium text-orange-400">Action Required</p>
                <p className="text-sm text-gray-300">{analysis.action_description}</p>
              </div>
            )}

            {analysis.reply_draft && (
              <div>
                <button
                  onClick={() => setShowReply(!showReply)}
                  className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium transition hover:bg-blue-500"
                >
                  {showReply ? "Hide" : "View"} AI Reply Draft
                </button>
                {showReply && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-xs text-gray-400">Draft Reply:</p>
                    <p className="whitespace-pre-wrap text-xs text-gray-200">
                      {analysis.reply_draft}
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(analysis.reply_draft || "")}
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
    </section>
  );

  const dashboardPanel = (
    <section className={`${getPanelClass("dashboard", activePanel)} min-h-0 flex-col overflow-y-auto`}>
      <div className="border-b border-white/10 p-4">
        <h2 className="text-sm font-semibold">Pipeline Dashboard</h2>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
            <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
            <div className="mt-1 text-xs text-gray-400">Total Applications</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
            <div className="text-2xl font-bold text-orange-400">{stats.actionNeeded}</div>
            <div className="mt-1 text-xs text-gray-400">Action Needed</div>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3">
            <div className="text-2xl font-bold text-green-400">{stats.shortlisted}</div>
            <div className="mt-1 text-xs text-gray-400">Shortlisted+</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
            <div className="text-2xl font-bold text-purple-400">{stats.interviews}</div>
            <div className="mt-1 text-xs text-gray-400">Interviews</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <div className="text-2xl font-bold text-emerald-400">{stats.offers}</div>
            <div className="mt-1 text-xs text-gray-400">Offers</div>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
            <div className="text-2xl font-bold text-yellow-400">{stats.filtered}</div>
            <div className="mt-1 text-xs text-gray-400">Filtered</div>
          </div>
        </div>

        {Object.values(analysisByEmail).some(
          (item) => item.deadline && !isPast(new Date(item.deadline))
        ) && (
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wider text-gray-400">
              Upcoming Deadlines
            </h3>
            <div className="space-y-2">
              {Object.values(analysisByEmail)
                .filter(
                  (item) =>
                    item.is_placement_related &&
                    item.deadline &&
                    !isPast(new Date(item.deadline))
                )
                .sort(
                  (a, b) =>
                    new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
                )
                .slice(0, 3)
                .map((item, index) => (
                  <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{item.company}</span>
                      <span className="whitespace-nowrap text-xs text-orange-400">
                        {differenceInHours(new Date(item.deadline!), new Date()) < 24
                          ? `${differenceInHours(new Date(item.deadline!), new Date())}h left`
                          : `${Math.floor(
                              differenceInHours(new Date(item.deadline!), new Date()) / 24
                            )}d left`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{item.deadline_text}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-xs uppercase tracking-wider text-gray-400">
            Pipeline Stages
          </h3>
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage} className="flex items-center justify-between border-b border-white/5 py-2">
              <span className="text-sm text-gray-300">{stage}</span>
              <span className="text-sm font-medium text-gray-500">{stageCounts[stage]}</span>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-3 text-xs uppercase tracking-wider text-gray-400">Analytics</h3>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Response Rate</span>
              <span className="text-sm font-semibold text-blue-300">
                {analytics.responseRate}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${analytics.responseRate}%` }}
              />
            </div>

            <div className="pt-2">
              <p className="mb-2 text-xs text-gray-500">Stage Breakdown</p>
              <div className="space-y-2">
                {PIPELINE_STAGES.map((stage) => {
                  const count = stageCounts[stage];
                  const width = stats.total > 0 ? Math.max(4, (count / stats.total) * 100) : 0;
                  return (
                    <div key={stage} className="grid grid-cols-[86px_1fr_24px] items-center gap-2">
                      <span className="truncate text-xs text-gray-400">{stage}</span>
                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-blue-500/80"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-right text-xs text-gray-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <p className="mb-2 text-xs text-gray-500">Best Platforms</p>
              {analytics.platforms.length === 0 ? (
                <p className="text-xs text-gray-600">No platform data yet.</p>
              ) : (
                <div className="space-y-2">
                  {analytics.platforms.map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">{platform}</span>
                      <span className="text-gray-500">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {analysis && (
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wider text-gray-400">
              Recent Analysis
            </h3>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {analysis.is_placement_related
                    ? analysis.company || "Unknown company"
                    : "Filtered email"}
                </span>
                <span
                  className={`text-xs ${
                    analysis.is_placement_related ? getStageColor(analysis.stage) : "text-yellow-300"
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
    </section>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-white">
      <nav className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold">
            J
          </div>
          <span className="text-lg font-bold">JobSync AI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-gray-500 sm:inline">Powered by AI</span>
          <UserButton />
        </div>
      </nav>

      <div className="grid grid-cols-3 border-b border-white/10 md:hidden">
        {[
          ["feed", "Inbox"],
          ["analysis", "Analysis"],
          ["dashboard", "Dashboard"],
        ].map(([panel, label]) => (
          <button
            key={panel}
            onClick={() => setActivePanel(panel as DashboardPanel)}
            className={`px-3 py-3 text-xs font-medium ${
              activePanel === panel
                ? "border-b-2 border-blue-500 text-white"
                : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="min-h-0 flex-1 md:grid md:grid-cols-3">
        {feedPanel}
        {analysisPanel}
        {dashboardPanel}
      </main>
    </div>
  );
}
