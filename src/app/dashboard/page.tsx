"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { formatDistanceToNow, isPast, differenceInHours } from "date-fns";
import Image from "next/image";
import Link from "next/link";

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
  if (isPast(deadlineDate)) return `⚠️ EXPIRED — ${deadlineText || "deadline passed"}`;
  const hoursLeft = differenceInHours(deadlineDate, new Date());
  if (hoursLeft < 24) return `🔴 ${hoursLeft}h left — ${deadlineText || "deadline today"}`;
  if (hoursLeft < 48) return `🟠 ${Math.floor(hoursLeft / 24)}d left — ${deadlineText || "deadline tomorrow"}`;
  return `🟡 ${formatDistanceToNow(deadlineDate, { addSuffix: true })} — ${deadlineText || ""}`;
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
    connected: false, email: null,
  });
  const [scanningGmail, setScanningGmail] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [activeTab, setActiveTab] = useState<TabType>("emails");

  const analyzedEmails = Object.values(analysisByEmail);
  const placementAnalyses = analyzedEmails.filter((item) => item.is_placement_related);
  const stageCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = 0; return acc;
  }, {});
  placementAnalyses.forEach((item) => {
    const stage = normalizeStage(item.stage);
    if (Object.prototype.hasOwnProperty.call(stageCounts, stage)) stageCounts[stage] += 1;
  });

  const stats = {
    total: placementAnalyses.length,
    actionNeeded: placementAnalyses.filter((item) => item.action_required).length,
    shortlisted: placementAnalyses.filter((item) => POSITIVE_STAGES.has(normalizeStage(item.stage))).length,
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
    all: "All", actionNeeded: "Action Needed", shortlisted: "Shortlisted+",
    interviews: "Interviews", offers: "Offers", filtered: "Filtered",
  };

  useEffect(() => {
    const loadGmailStatus = async () => {
      try {
        const response = await fetch("/api/gmail/status");
        if (!response.ok) return;
        const data = await response.json();
        setGmailStatus({ connected: Boolean(data.connected), email: data.email || null });
      } catch (e) { console.error(e); }
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
              is_placement_related: true, company: app.company, role: app.role,
              stage: app.stage, deadline: app.deadline, deadline_text: app.deadlineText,
              action_required: app.actionRequired, action_description: app.actionDescription,
              urgency: app.urgency, contact_email: app.contactEmail, confidence: app.confidence,
              summary: app.summary || "", reply_draft: null, important_links: app.importantLinks || [],
            };
            emailItems.push({
              id, from: app.fromEmail || "", subject: app.subject || app.company,
              preview: app.summary || "", time: new Date(app.createdAt).toLocaleDateString(),
              urgent: app.actionRequired || app.urgency === "HIGH", content: "",
            });
          });
          setEmails(emailItems);
          setAnalysisByEmail(analysisMap);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingApps(false); }
    };
    loadGmailStatus();
    loadApplications();
  }, []);

  const connectGmail = () => { window.location.href = "/api/gmail/connect"; };

  const scanGmail = async () => {
    setScanningGmail(true); setError(null); setSelectedEmail(null); setAnalysis(null); setShowReply(false);
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
    } catch (e) { setError(e instanceof Error ? e.message : "Gmail scan failed"); }
    finally { setScanningGmail(false); }
  };

  const analyzeEmail = async (email: EmailItem) => {
    setSelectedEmail(email); setActiveTab("analysis");
    if (analysisByEmail[email.id]) {
      setAnalysis(analysisByEmail[email.id]); setShowReply(false); setError(null); return;
    }
    if (!email.content) { setError("Email content not available for re-analysis"); return; }
    setAnalysis(null); setAnalyzing(true); setShowReply(false); setError(null);
    try {
      const response = await fetch("/api/analyze-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailContent: email.content, emailSubject: email.subject, emailFrom: email.from }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "AI analysis failed");
      setAnalysis(result.data);
      setAnalysisByEmail((prev) => ({ ...prev, [email.id]: result.data }));
    } catch (e) { setError(e instanceof Error ? e.message : "AI analysis failed"); }
    finally { setAnalyzing(false); }
  };

  // Stage pill — small rounded pill matching Image 2
  const getStagePillClass = (stage: string) => {
    const s = normalizeStage(stage);
    const map: Record<string, string> = {
      Applied:     "bg-gray-100 text-gray-600 border border-gray-300",
      Shortlisted: "bg-blue-50 text-blue-600 border border-blue-300",
      Interview:   "bg-purple-50 text-purple-600 border border-purple-300",
      Assignment:  "bg-orange-50 text-orange-600 border border-orange-300",
      Offer:       "bg-green-50 text-green-600 border border-green-300",
      Rejected:    "bg-red-50 text-red-600 border border-red-300",
      Unknown:     "bg-gray-100 text-gray-500 border border-gray-300",
    };
    return map[s] || map.Unknown;
  };

  const getStageTextColor = (stage: string) => {
    const map: Record<string, string> = {
      Shortlisted: "text-blue-600", Interview: "text-purple-600",
      Assignment: "text-orange-600", Offer: "text-green-600",
      Rejected: "text-red-600", Applied: "text-gray-600",
    };
    return map[stage] || "text-gray-600";
  };

  // Urgency pill matching Image 2 — rounded pill, red bg white text
  const getUrgencyClass = (urgency: string) => {
    if (urgency === "HIGH") return "bg-red-500 text-white";
    if (urgency === "MEDIUM") return "bg-orange-400 text-white";
    return "bg-green-500 text-white";
  };

  const getUrgencyLabel = (urgency: string) => {
    if (urgency === "HIGH") return "HIGH URGENCY";
    if (urgency === "MEDIUM") return "MEDIUM URGENCY";
    return "LOW URGENCY";
  };

  // ── LEFT PANEL ─────────────────────────────────────────────────────────────
  const EmailFeedPanel = () => (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header section */}
      <div className="shrink-0 px-5 pt-5 pb-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[15px] text-gray-900">
            Email Feed{" "}
            {emails.length > 0 && (
              <span className="font-normal text-gray-400 text-sm">
                ({filteredEmails.length}{activeFilter !== "all" ? ` of ${emails.length}` : ""})
              </span>
            )}
          </h2>
          {gmailStatus.connected ? (
            <span className="flex items-center gap-1.5 rounded-full border border-green-400 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Gmail connected
            </span>
          ) : (
            <span className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
              Not connected
            </span>
          )}
        </div>

        {/* Buttons — blue left with upload icon, green right with search icon */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={connectGmail} disabled={scanningGmail}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {gmailStatus.connected ? "Reconnect Gmail" : "Connect Gmail"}
          </button>
          <button onClick={scanGmail} disabled={!gmailStatus.connected || scanningGmail}
            className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            {scanningGmail ? "Scanning..." : "Scan Gmail"}
          </button>
        </div>

        {/* Connected email */}
        {gmailStatus.email && (
          <p className="text-xs text-gray-500">
            Connected: <span className="text-blue-500 font-medium">{gmailStatus.email}</span>
          </p>
        )}

        {/* Active filter indicator */}
        {activeFilter !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtering:</span>
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              {filterLabel[activeFilter]}
            </span>
            <button onClick={() => handleFilterClick("all")} className="ml-auto text-xs text-gray-400 hover:text-gray-600">
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="shrink-0 h-px bg-gray-100" />

      {/* Email list */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white">
        {loadingApps ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-xs">Loading your applications...</p>
          </div>
        ) : filteredEmails.length === 0 && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-4xl mb-3">📧</div>
            <p className="text-gray-700 text-sm font-medium">No applications yet</p>
            <p className="text-gray-400 text-xs mt-1">Connect Gmail and scan your inbox to get started.</p>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-700 text-sm font-medium">No emails match this filter</p>
            <button onClick={() => handleFilterClick("all")} className="mt-3 text-xs text-blue-500 hover:text-blue-600">Clear filter</button>
          </div>
        ) : (
          filteredEmails.map((email) => {
            const a = analysisByEmail[email.id];
            const stage = a ? normalizeStage(a.stage) : "Unknown";
            const isSelected = selectedEmail?.id === email.id;
            return (
              <div key={email.id} onClick={() => analyzeEmail(email)}
                className={`px-5 py-3.5 cursor-pointer border-b border-gray-100 transition-colors ${
                  isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"
                }`}>
                {/* Row 1: URGENT + stage pill + sender + date */}
                <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                  {email.urgent && (
                    <span className="shrink-0 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">
                      URGENT
                    </span>
                  )}
                  <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${getStagePillClass(stage)}`}>
                    {stage}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate flex-1">{email.from}</span>
                  <span className="shrink-0 text-[11px] text-gray-400">{email.time}</span>
                </div>
                {/* Subject */}
                <p className="text-[13px] font-semibold text-gray-900 truncate">{email.subject}</p>
                {/* Preview */}
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{email.preview}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ── MIDDLE PANEL ───────────────────────────────────────────────────────────
  const AnalysisPanel = () => (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="shrink-0 px-6 py-5">
        <h2 className="font-bold text-[15px] text-gray-900">AI Analysis</h2>
      </div>
      <div className="shrink-0 h-px bg-gray-100" />

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {/* Empty state */}
        {!selectedEmail && !analyzing && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl mb-5">
              🤖
            </div>
            <p className="text-gray-700 text-sm font-semibold">Select an email to see details</p>
            <p className="text-gray-400 text-xs mt-2 max-w-[220px] leading-relaxed">
              Click any scanned email to view its extracted placement details.
            </p>
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500 text-sm">Analyzing with AI...</p>
          </div>
        )}

        {error && !analyzing && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
            <p className="text-sm font-semibold text-red-600">Analysis failed</p>
            <p className="mt-1 text-xs text-red-500">{error}</p>
          </div>
        )}

        {analysis && !analyzing && !analysis.is_placement_related && (
          <div className="space-y-3">
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-yellow-600 mb-1">Filtered out</p>
              <p className="text-sm text-gray-600">This email is not a real placement opportunity.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1.5">AI Summary</p>
              <p className="text-sm text-gray-700">{analysis.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-400 mb-1">Classification</p>
                <p className="text-sm font-semibold text-yellow-600">Not placement</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-400 mb-1">Confidence</p>
                <p className="text-sm font-semibold text-blue-600">{analysis.confidence}%</p>
              </div>
            </div>
          </div>
        )}

        {analysis && !analyzing && analysis.is_placement_related && (
          <div className="space-y-4">
            {/* Urgency + Match % — exactly like Image 2 */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${getUrgencyClass(analysis.urgency)}`}>
                {getUrgencyLabel(analysis.urgency)}
              </span>
              <span className="text-sm font-semibold text-gray-700">{analysis.confidence}% Match</span>
            </div>

            {/* Confidence bar — blue to green gradient */}
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-400 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${analysis.confidence}%` }}
              />
            </div>

            {/* Company card — white bg, centered icon + name + role, then stage/deadline row */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              {/* Centered company icon + name + role */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-14 h-14 bg-blue-100 border border-blue-200 rounded-2xl flex items-center justify-center text-2xl mb-3">
                  🏢
                </div>
                <p className="font-bold text-gray-900 text-xl">{analysis.company || "Unknown company"}</p>
                <p className="text-sm text-gray-500 mt-1">{analysis.role || "Role not found"}</p>
              </div>

              {/* Stage + Deadline side by side — uppercase label above value */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white border border-gray-200 p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Current Stage</p>
                  <p className={`text-sm font-bold ${getStageTextColor(analysis.stage)}`}>{analysis.stage}</p>
                </div>
                {(analysis.deadline || analysis.deadline_text) && (
                  <div className="rounded-lg bg-white border border-gray-200 p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Next Deadline</p>
                    <p className="text-sm font-bold text-orange-500 leading-snug">
                      {getDeadlineDisplay(analysis.deadline, analysis.deadline_text)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Intelligence Summary — matches Image 2 label style */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                AI Intelligence Summary
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Action Required — matches Image 2: light red bg, warning triangle, red label */}
            {analysis.action_required && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-500 text-sm">⚠</span>
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Action Required</p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{analysis.action_description}</p>
              </div>
            )}

            {/* Important links */}
            {analysis.important_links && analysis.important_links.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">Important Links</p>
                <div className="space-y-1">
                  {analysis.important_links.map((link) => (
                    <a key={link} href={link} target="_blank" rel="noreferrer"
                      className="block truncate text-xs text-blue-500 hover:text-blue-700 transition-colors">{link}</a>
                  ))}
                </div>
              </div>
            )}

            {/* View AI Reply Draft button — full width blue, icon left */}
            {analysis.reply_draft && (
              <div>
                <button onClick={() => setShowReply(!showReply)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {showReply ? "Hide AI Reply Draft" : "View AI Reply Draft"}
                </button>
                {showReply && (
                  <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-400 mb-2">Draft Reply:</p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{analysis.reply_draft}</p>
                    <button onClick={() => navigator.clipboard.writeText(analysis.reply_draft || "")}
                      className="mt-3 text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium">
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
  );

  // ── RIGHT PANEL ────────────────────────────────────────────────────────────
  const PipelinePanel = () => (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="shrink-0 px-5 py-5">
        <h2 className="font-bold text-[15px] text-gray-900">Pipeline Dashboard</h2>
      </div>
      <div className="shrink-0 h-px bg-gray-100" />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">

        {/* 6 stat cards — 2 col grid, each is a clickable filter button */}
        {/* Matches Image 2: white bg, large bold colored number, small gray label, colored border */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { filter: "all" as FilterType,         count: stats.total,       label: "Total Apps",    num: "text-blue-600",   border: "border-blue-400",   ring: "ring-blue-300" },
            { filter: "actionNeeded" as FilterType, count: stats.actionNeeded,label: "Action Needed", num: "text-red-500",    border: "border-red-400",    ring: "ring-red-300" },
            { filter: "shortlisted" as FilterType,  count: stats.shortlisted, label: "Shortlisted+",  num: "text-green-600",  border: "border-green-400",  ring: "ring-green-300" },
            { filter: "interviews" as FilterType,   count: stats.interviews,  label: "Interviews",    num: "text-purple-600", border: "border-purple-400", ring: "ring-purple-300" },
            { filter: "offers" as FilterType,       count: stats.offers,      label: "Offers",        num: "text-gray-900",   border: "border-gray-400",   ring: "ring-gray-300" },
            { filter: "filtered" as FilterType,     count: stats.filtered,    label: "Filtered",      num: "text-yellow-600", border: "border-yellow-400", ring: "ring-yellow-300" },
          ].map(({ filter, count, label, num, border, ring }) => {
            const isActive = activeFilter === filter;
            return (
              <button key={filter}
                onClick={() => { handleFilterClick(filter); setActiveTab("emails"); }}
                className={`text-left bg-white rounded-xl border-2 p-4 transition-all ${border} ${
                  isActive ? `ring-2 ${ring}` : "hover:shadow-sm"
                }`}>
                <div className={`text-4xl font-bold tabular-nums leading-none ${num}`}>{count}</div>
                <div className="text-xs text-gray-500 mt-2 font-medium">{label}</div>
              </button>
            );
          })}
        </div>

        {/* Upcoming Deadlines — company initial circle + name + colored time */}
        {Object.values(analysisByEmail).some((a) => a.deadline && !isPast(new Date(a.deadline))) && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Upcoming Deadlines
            </p>
            <div className="space-y-1">
              {Object.values(analysisByEmail)
                .filter((a) => a.is_placement_related && a.deadline && !isPast(new Date(a.deadline)))
                .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
                .slice(0, 3)
                .map((a, i) => {
                  const hoursLeft = differenceInHours(new Date(a.deadline!), new Date());
                  const timeLabel = hoursLeft < 24 ? `${hoursLeft}h remaining` : hoursLeft < 48 ? "Tomorrow" : `${Math.floor(hoursLeft / 24)} days`;
                  const timeColor = hoursLeft < 24 ? "text-red-500 font-semibold" : hoursLeft < 48 ? "text-orange-500 font-semibold" : "text-gray-400";
                  const initial = (a.company || "?")[0].toUpperCase();
                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                        {initial}
                      </div>
                      <span className="text-sm text-gray-800 flex-1 truncate font-medium">{a.company}</span>
                      <span className={`text-xs shrink-0 ${timeColor}`}>{timeLabel}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Pipeline Stages — numbered 01 02 03, blue bar accent, count right */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Pipeline Stages
          </p>
          <div>
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-3 py-2.5 border-b border-gray-100">
                <span className="text-xs text-gray-400 tabular-nums w-5 shrink-0 font-medium">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-gray-700 flex-1 font-medium">{stage}</span>
                {stageCounts[stage] > 0 && (
                  <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
                )}
                <span className="text-sm font-semibold text-gray-600 tabular-nums w-5 text-right">
                  {stageCounts[stage]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Analysis */}
        {analysis && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Recent Analysis
            </p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-900">
                  {analysis.is_placement_related ? analysis.company || "Unknown" : "Filtered email"}
                </span>
                <span className={`text-xs font-semibold ${
                  analysis.is_placement_related ? getStageTextColor(analysis.stage) : "text-yellow-600"
                }`}>
                  {analysis.is_placement_related ? analysis.stage : "Filtered"}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{analysis.summary}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-100 text-gray-900 flex flex-col overflow-hidden">

      {/* Header — white bg, subtle bottom border */}
      <nav className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="JobSync AI" width={32} height={32} className="rounded-lg object-contain" />
          <span className="font-bold text-[17px] text-gray-900">JobSync AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            Home
          </Link>
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Powered by AI
          </span>
          <UserButton />
        </div>
      </nav>

      {/* Desktop 3-col — panels separated by 1px gray borders */}
      <div className="hidden md:grid md:grid-cols-3 flex-1 min-h-0 gap-px bg-gray-200">
        <div className="min-h-0 overflow-hidden bg-white"><EmailFeedPanel /></div>
        <div className="min-h-0 overflow-hidden bg-white"><AnalysisPanel /></div>
        <div className="min-h-0 overflow-hidden bg-white"><PipelinePanel /></div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden bg-white">
          {activeTab === "emails" && <EmailFeedPanel />}
          {activeTab === "analysis" && <AnalysisPanel />}
          {activeTab === "pipeline" && <PipelinePanel />}
        </div>
        <div className="shrink-0 border-t border-gray-200 bg-white grid grid-cols-3">
          {[
            { tab: "emails" as TabType, label: "Emails",   icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> },
            { tab: "analysis" as TabType, label: "Analysis", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54Z"/></svg> },
            { tab: "pipeline" as TabType, label: "Pipeline", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg> },
          ].map(({ tab, label, icon }) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                activeTab === tab ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}>
              {icon}
              <span className="text-xs font-medium">{label}</span>
              {activeTab === tab && <div className="w-4 h-0.5 rounded-full bg-blue-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
