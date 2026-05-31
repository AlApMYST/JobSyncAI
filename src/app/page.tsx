import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

const features = [
  {
    icon: "AE",
    title: "Auto Email Tracking",
    description:
      "Syncs Gmail safely and turns messy placement emails into structured company, role, stage, and deadline records.",
    tone: "from-indigo-50 to-white",
  },
  {
    icon: "DI",
    title: "Deadline Intelligence",
    description:
      "Flags assignments, interview confirmations, form links, and offer deadlines before they disappear in your inbox.",
    tone: "from-emerald-50 to-white",
  },
  {
    icon: "AI",
    title: "Neural Talent Scoring",
    description:
      "Scores every email for urgency, confidence, and required action so students know exactly what to handle first.",
    tone: "from-slate-950 to-indigo-950",
    dark: true,
  },
  {
    icon: "VF",
    title: "Visual Pipeline Flow",
    description:
      "Groups every opportunity into Applied, Shortlisted, Assignment, Interview, Offer, or Rejected without manual tracking.",
    tone: "from-white to-violet-50",
  },
];

const integrations = ["Slack", "G-Suite", "Workday", "Notion"];

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <main className="min-h-screen bg-[#f7f7ff] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-indigo-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="JobSync AI"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {!isSignedIn && (
              <Link
                href="/sign-in"
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600 sm:block"
              >
                Sign in
              </Link>
            )}
            <Link
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              {isSignedIn ? "Go to Dashboard" : "Get Started"}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            AI V2 Now Live
          </div>

          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Track placements with{" "}
            <span className="text-indigo-600">AI-driven</span> precision.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            JobSync AI connects to a student&apos;s Gmail, detects real placement
            emails, filters spam, extracts deadlines, and builds a live pipeline
            without manual spreadsheets.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="rounded-full bg-indigo-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-xl shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
            </Link>
            <Link
              href="#intelligence"
              className="rounded-full border border-indigo-200 bg-white px-6 py-3 text-center text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              Watch Demo
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["A", "R", "S", "M"].map((avatar, index) => (
                <div
                  key={avatar}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white shadow-sm"
                  style={{ zIndex: 10 - index }}
                >
                  {avatar}
                </div>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-500">
              Trusted by 500+ placement-focused students
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] border border-white bg-white p-3 shadow-2xl shadow-indigo-950/15">
            <div className="overflow-hidden rounded-[1.5rem] bg-[#0b1020] p-5 text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-medium text-indigo-200">
                    Placement Intelligence
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Live Pipeline</h2>
                </div>
                <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  98.4% match
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-white">
                      Application Flow
                    </p>
                    <p className="text-xs text-slate-400">Last 30 days</p>
                  </div>
                  <div className="flex h-44 items-end gap-3">
                    {[42, 64, 38, 86, 72, 58, 96].map((height, index) => (
                      <div
                        key={height}
                        className="flex flex-1 flex-col justify-end rounded-full bg-indigo-500/10"
                      >
                        <div
                          className="rounded-full bg-gradient-to-t from-indigo-500 to-cyan-300"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    ["Razorpay", "Assignment", "High"],
                    ["Zerodha", "Interview", "High"],
                    ["Groww", "Offer", "Critical"],
                  ].map(([company, stage, urgency]) => (
                    <div
                      key={company}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{company}</p>
                        <span className="rounded-full bg-indigo-400/10 px-2 py-1 text-[10px] font-bold uppercase text-indigo-200">
                          {urgency}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{stage}</p>
                      <div className="mt-3 h-1.5 rounded-full bg-white/10">
                        <div className="h-1.5 w-4/5 rounded-full bg-indigo-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-8 left-6 rounded-2xl border border-indigo-100 bg-white p-4 shadow-xl shadow-indigo-950/10 sm:left-10">
            <p className="text-xs font-medium text-slate-500">Match Accuracy</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">98.4%</p>
            <div className="mt-3 h-2 w-36 rounded-full bg-indigo-100">
              <div className="h-2 w-[98%] rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400" />
            </div>
          </div>
        </div>
      </section>

      <section id="intelligence" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-indigo-700 sm:text-5xl">
              Intelligence for every stage
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Every stage of placement season gets an AI layer: tracking,
              scoring, reminders, and recovery from missed opportunities.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`rounded-[1.5rem] border p-6 shadow-sm ${
                  feature.dark
                    ? "border-slate-800 bg-gradient-to-br text-white shadow-slate-950/20"
                    : "border-indigo-100 bg-gradient-to-br text-slate-950"
                } ${feature.tone}`}
              >
                <div
                  className={`mb-7 flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-bold ${
                    feature.dark
                      ? "bg-white/10 text-indigo-100"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p
                  className={`mt-3 max-w-xl text-sm leading-6 ${
                    feature.dark ? "text-indigo-100/80" : "text-slate-500"
                  }`}
                >
                  {feature.description}
                </p>
                {feature.dark && (
                  <Link
                    href="/sign-up"
                    className="mt-6 inline-flex text-sm font-semibold text-white"
                  >
                    View Analysis Framework
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-500">
              Works where you work
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Student alerts stay connected to your workflow.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
              JobSync AI can sit beside Gmail today and expand into Slack,
              G-Suite, Notion, and campus workflows as the product grows.
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {integrations.map((integration) => (
                <div
                  key={integration}
                  className="rounded-xl border border-indigo-100 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-600 shadow-sm"
                >
                  {integration}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute h-64 w-64 rounded-full border border-indigo-100 bg-white shadow-2xl shadow-indigo-950/10" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-500 text-3xl font-bold text-white shadow-xl shadow-indigo-700/25">
              JS
            </div>
            <div className="absolute left-8 top-8 h-9 w-9 rounded-full border border-indigo-100 bg-white shadow" />
            <div className="absolute bottom-8 right-10 h-9 w-9 rounded-full border border-emerald-100 bg-white shadow" />
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-500 px-6 py-14 text-center text-white shadow-2xl shadow-indigo-700/25 sm:px-10">
          <h2 className="text-4xl font-semibold tracking-tight">
            Ready to stop missing opportunities?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-indigo-100">
            Connect Gmail, scan recent placement emails, and turn inbox chaos
            into a clear action list before deadlines slip away.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              {isSignedIn ? "Go to Dashboard" : "Get Started for Free"}
            </Link>
            <Link
              href="#intelligence"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              See How It Works
            </Link>
          </div>
          <p className="mt-6 text-xs text-indigo-100">
            No credit card required &middot; Cancel anytime
          </p>
        </div>
      </section>

      <footer className="border-t border-indigo-100 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="JobSync AI"
              className="h-10 w-auto object-contain"
            />
          </Link>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            {["Privacy Policy", "Terms of Service", "Security", "Contact"].map(
              (item) => (
                <Link key={item} href="/sign-in" className="hover:text-indigo-600">
                  {item}
                </Link>
              )
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
