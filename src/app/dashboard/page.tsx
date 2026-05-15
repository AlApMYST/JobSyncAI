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

type FilterType = "all" | "actionNeeded" | "shortlisted" | "interviews" | "offers" | "filtered";
type TabType = "emails" | "analysis" | "pipeline";

export default function Dashboard() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [analysisByEmail, setAnalysisByEmail] = useState<Record<string, EmailAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email: string | null }>({
    connected: false,
    email: null,
  });
  const [scanningGmail, setScanningGmail] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [activeTab, setActiveTab] = useState<TabType>("emails");

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

  const filteredEmails = emails.filter((email) => {
    const a = analysisByEmail[email.id];
    if (activeFilter === "all") return true;
    if (!a) return false;
    if (activeFilter === "actionNeeded") return a.action_required;
    if (activeFilter === "shortlisted") return POSITIVE_STAGES.has(normalizeStage(a.stage));
    if (activeFilter === "interviews") return normalizeStage(a.stage) === "Interview";
    if (activeFilter === "offers") return normalizeStage(a.stage) === "Offer";
    if (activeFilter === "filtered") return !a.is_placement_related;
    return true;
  });

  const handleFilterClick = (filter: FilterType) => {
    setActiveFilter((prev) => (prev === filter ? "all" : filter));
    setSelectedEmail(null);
    setAnalysis(null);
  };

  const filterLabel: Record<FilterType, string> = {
    all: "All",
    actionNeeded: "Action Needed",
    shortlisted: "Shortlisted+",
    interviews: "Interviews",
    offers: "Offers",
    filtered: "Filtered",
  };

  useEffect(() => {
    const loadGmailStatus = async () => {
      try {
        const response = await fetch("/api/gmail/status");
        if (!response.ok) return;
        const data = await response.json();
        setGmailStatus({ connected: Boolean(data.connected), email: data.email || null });
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

        if (data.success && data.applications.length > 0) {
          const analysisMap: Record<string, EmailAnalysis> = {};
          const emailItems: EmailItem[] = [];

          data.applications.forEach((app: any) => {
            const id = `db-${app.id}`;
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
              important_links: app.importantLinks || [],
            };
            emailItems.push({
              id,
              from: app.fromEmail || "",
              subject: app.subject || app.company,
              preview: app.summary || "",
              time: new Date(app.createdAt).toLocaleDateString(),
              urgent: app.actionRequired || app.urgency === "HIGH",
              content: "",
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

  const connectGmail = () => { window.location.href = "/api/gmail/connect"; };

  const scanGmail = async () => {
    setScanningGmail(true);
    setError(null);
    setSelectedEmail(null);
    setAnalysis(null);
    setShowReply(false);
    try {
      const response = await fetch("/api/gmail/scan", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Gmail scan failed");

      const nextEmails: EmailItem[] = result.items.map((item: any) => item.email);
      const nextAnalysis: Record<string, EmailAnalysis> = {};
      result.items.forEach((item: any) => { nextAnalysis[item.email.id] = item.analysis; });

      setEmails((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        return [...nextEmails.filter((e) => !existingIds.has(e.id)), ...prev];
      });
      setAnalysisByEmail((prev) => ({ ...prev, ...nextAnalysis }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gmail scan failed");
    } finally {
      setScanningGmail(false);
    }
  };

  const analyzeEmail = async (email: EmailItem) => {
    setSelectedEmail(email);
    setActiveTab("analysis"); // auto-switch on mobile
    if (analysisByEmail[email.id]) {
      setAnalysis(analysisByEmail[email.id]);
      setShowReply(false);
      setError(null);
      return;
    }
    if (!email.content) { setError("Email content not available for re-analysis"); return; }

    setAnalysis(null);
    setAnalyzing(true);
    setShowReply(false);
    setError(null);
    try {
      const response = await fetch("/api/analyze-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailContent: email.content, emailSubject: email.subject, emailFrom: email.from }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "AI analysis failed");
      setAnalysis(result.data);
      setAnalysisByEmail((prev) => ({ ...prev, [email.id]: result.data }));
    } catch (error) {
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
      Shortlisted: "text-blue-400", Interview: "text-purple-400",
      Assignment: "text-orange-400", Offer: "text-green-400",
      Rejected: "text-red-400", Applied: "text-gray-400",
    };
    return colors[stage] || "text-gray-400";
  };

  // ─── Shared panel components ──────────────────────────────────────────────

  const EmailFeedPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-white/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">Email Feed</h2>
            {emails.length > 0 && (
              <span className="text-xs text-gray-500">
                ({filteredEmails.length}{activeFilter !== "all" ? ` of ${emails.length}` : ""})
              </span>
            )}
          </div>
          {gmailStatus.connected ? (
            <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-xs text-green-300">Gmail connected</span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-400">Not connected</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={connectGmail} disabled={scanningGmail}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-medium transition">
            {gmailStatus.connected ? "Reconnect Gmail" : "Connect Gmail"}
          </button>
          <button onClick={scanGmail} disabled={!gmailStatus.connected || scanningGmail}
            className="bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-gray-500 px-3 py-2 rounded-lg text-xs font-medium transition">
            {scanningGmail ? "Scanning..." : "Scan Gmail"}
          </button>
        </div>
        {gmailStatus.email && <p className="truncate text-xs text-gray-500">Connected: {gmailStatus.email}</p>}
        {activeFilter !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Filtering:</span>
            <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">{filterLabel[activeFilter]}</span>
            <button onClick={() => handleFilterClick("all")} className="text-xs text-gray-500 hover:text-gray-300 transition ml-auto">✕ Clear</button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loadingApps ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-gray-500 text-xs">Loading your applications...</p>
          </div>
        ) : filteredEmails.length === 0 && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="text-4xl mb-3">📧</div>
            <p className="text-gray-400 text-sm">No applications yet</p>
            <p className="text-gray-600 text-xs mt-1">Connect Gmail and scan your inbox to get started.</p>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-400 text-sm">No emails match this filter</p>
            <button onClick={() => handleFilterClick("all")} className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition">Clear filter</button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredEmails.map((email) => (
              <div key={email.id} onClick={() => analyzeEmail(email)}
                className={`p-4 cursor-pointer hover:bg-white/5 transition ${selectedEmail?.id === email.id ? "bg-white/5 border-l-2 border-blue-500" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {email.urgent && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">URGENT</span>}
                      {analysisByEmail[email.id] && (
                        <span className={`text-xs ${getStageColor(normalizeStage(analysisByEmail[email.id].stage))}`}>
                          {normalizeStage(analysisByEmail[email.id].stage)}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 truncate">{email.from}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{email.subject}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{email.preview}</p>
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">{email.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const AnalysisPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-white/10 shrink-0">
        <h2 className="font-semibold text-sm">AI Analysis</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {!selectedEmail && !analyzing && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">🤖</div>
            <p className="text-gray-400 text-sm">Select an email to see details</p>
            <p className="text-gray-600 text-xs mt-1">Click any scanned email to view its extracted placement details.</p>
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
              <p className="text-xs font-bold uppercase tracking-wide text-yellow-300">Filtered out</p>
              <p className="mt-2 text-sm text-gray-200">This email does not look like a real placement opportunity.</p>
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
              <span className="text-xs text-gray-400">{analysis.confidence}% confidence</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${analysis.confidence}%` }}></div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-lg">🏢</div>
                <div>
                  <p className="font-semibold">{analysis.company || "Unknown company"}</p>
                  <p className="text-sm text-gray-400">{analysis.role || "Role not found"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-gray-500">Stage</p>
                  <p className={`font-medium ${getStageColor(analysis.stage)}`}>{analysis.stage}</p>
                </div>
                {(analysis.deadline || analysis.deadline_text) && (
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-gray-500">Deadline</p>
                    <p className="font-medium text-orange-400 text-xs">{getDeadlineDisplay(analysis.deadline, analysis.deadline_text)}</p>
                  </div>
                )}
              </div>
            </div>
            {analysis.important_links && analysis.important_links.length > 0 && (
              <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                <p className="text-xs text-blue-300 mb-2">Important Links</p>
                <div className="space-y-1">
                  {analysis.important_links.map((link) => (
                    <a key={link} href={link} target="_blank" rel="noreferrer" className="block truncate text-xs text-blue-400 hover:text-blue-300">{link}</a>
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
                <p className="text-xs text-orange-400 font-medium mb-1">⚡ Action Required</p>
                <p className="text-sm text-gray-300">{analysis.action_description}</p>
              </div>
            )}
            {analysis.reply_draft && (
              <div>
                <button onClick={() => setShowReply(!showReply)}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm font-medium transition">
                  ✍️ {showReply ? "Hide" : "View"} AI Reply Draft
                </button>
                {showReply && (
                  <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-2">Draft Reply:</p>
                    <p className="text-xs text-gray-200 whitespace-pre-wrap">{analysis.reply_draft}</p>
                    <button onClick={() => navigator.clipboard.writeText(analysis.reply_draft || "")}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300">Copy to clipboard</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const PipelinePanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-white/10 shrink-0">
        <h2 className="font-semibold text-sm">Pipeline Dashboard</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { filter: "all" as FilterType, color: "blue", count: stats.total, label: "Total Applications" },
            { filter: "actionNeeded" as FilterType, color: "orange", count: stats.actionNeeded, label: "Action Needed" },
            { filter: "shortlisted" as FilterType, color: "green", count: stats.shortlisted, label: "Shortlisted+" },
            { filter: "interviews" as FilterType, color: "purple", count: stats.interviews, label: "Interviews" },
            { filter: "offers" as FilterType, color: "emerald", count: stats.offers, label: "Offers" },
            { filter: "filtered" as FilterType, color: "yellow", count: stats.filtered, label: "Filtered" },
          ].map(({ filter, color, count, label }) => (
            <button key={filter}
              onClick={() => { handleFilterClick(filter); setActiveTab("emails"); }}
              className={`text-left bg-${color}-500/10 border rounded-xl p-3 transition hover:bg-${color}-500/20 ${
                activeFilter === filter ? `border-${color}-400 ring-1 ring-${color}-400/50` : `border-${color}-500/20`
              }`}
            >
              <div className={`text-2xl font-bold text-${color}-400`}>{count}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
              {activeFilter === filter && <div className={`text-xs text-${color}-400 mt-1`}>● Active</div>}
            </button>
          ))}
        </div>

        {Object.values(analysisByEmail).some((a) => a.deadline && !isPast(new Date(a.deadline))) && (
          <div>
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Upcoming Deadlines</h3>
            <div className="space-y-2">
              {Object.values(analysisByEmail)
                .filter((a) => a.is_placement_related && a.deadline && !isPast(new Date(a.deadline)))
                .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
                .slice(0, 3)
                .map((a, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
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

        <div>
          <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Pipeline Stages</h3>
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage} className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-gray-300">{stage}</span>
              <span className="text-sm font-medium text-gray-500">{stageCounts[stage]}</span>
            </div>
          ))}
        </div>

        {analysis && (
          <div>
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Recent Analysis</h3>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {analysis.is_placement_related ? analysis.company || "Unknown company" : "Filtered email"}
                </span>
                <span className={`text-xs ${analysis.is_placement_related ? getStageColor(analysis.stage) : "text-yellow-300"}`}>
                  {analysis.is_placement_related ? analysis.stage : "Filtered"}
                </span>
              </div>
              <p className="text-xs text-gray-500">{analysis.summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">

      {/* Header — always visible */}
      <nav className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">J</div>
          <span className="font-bold text-lg">JobSync AI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">Powered by AI</span>
          <UserButton />
        </div>
      </nav>

      {/* ── DESKTOP: three column grid ── */}
      <div className="hidden md:grid md:grid-cols-3 flex-1 min-h-0">
        <div className="border-r border-white/10 min-h-0 overflow-hidden"><EmailFeedPanel /></div>
        <div className="border-r border-white/10 min-h-0 overflow-hidden"><AnalysisPanel /></div>
        <div className="min-h-0 overflow-hidden"><PipelinePanel /></div>
      </div>

      {/* ── MOBILE: single panel + bottom tab bar ── */}
      <div className="flex md:hidden flex-col flex-1 min-h-0">

        {/* Active panel */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "emails" && <EmailFeedPanel />}
          {activeTab === "analysis" && <AnalysisPanel />}
          {activeTab === "pipeline" && <PipelinePanel />}
        </div>

        {/* Bottom tab bar */}
        <div className="shrink-0 border-t border-white/10 bg-[#0d0d14] grid grid-cols-3">
          <button onClick={() => setActiveTab("emails")}
            className={`flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === "emails" ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <span className="text-xs font-medium">Emails</span>
            {activeTab === "emails" && <div className="w-4 h-0.5 rounded-full bg-blue-400" />}
          </button>

          <button onClick={() => setActiveTab("analysis")}
            className={`flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === "analysis" ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54Z"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54Z"/>
            </svg>
            <span className="text-xs font-medium">Analysis</span>
            {activeTab === "analysis" && <div className="w-4 h-0.5 rounded-full bg-blue-400" />}
          </button>

          <button onClick={() => setActiveTab("pipeline")}
            className={`flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === "pipeline" ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1"/>
              <rect width="7" height="5" x="14" y="3" rx="1"/>
              <rect width="7" height="9" x="14" y="12" rx="1"/>
              <rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
            <span className="text-xs font-medium">Pipeline</span>
            {activeTab === "pipeline" && <div className="w-4 h-0.5 rounded-full bg-blue-400" />}
          </button>
        </div>
      </div>

    </div>
  );
}