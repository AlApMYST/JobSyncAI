import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">J</div>
          <span className="font-bold text-lg">JobSync AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-gray-400 hover:text-white transition">Login</Link>
          <Link href="/sign-up" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm mb-8">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
          AI-Powered Placement Intelligence
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Never Miss A<br />
          <span className="text-blue-500">Placement Opportunity</span><br />
          Again
        </h1>
        <p className="text-gray-400 text-xl max-w-2xl mb-10">
          JobSync AI reads your Gmail, extracts every placement email, tracks deadlines, and alerts you before opportunities expire. Zero manual effort.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/sign-up" className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-xl text-lg font-semibold transition">
            Connect Gmail Free
          </Link>
          <span className="text-gray-500 text-sm">No credit card required</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-12 mt-20">
          <div>
            <div className="text-4xl font-bold text-blue-500">2-3</div>
            <div className="text-gray-400 mt-1">Opportunities missed<br />per placement season</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-blue-500">94%</div>
            <div className="text-gray-400 mt-1">Email classification<br />accuracy</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-blue-500">0</div>
            <div className="text-gray-400 mt-1">Manual entries<br />required</div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: "🎯", title: "Auto Email Tracking", desc: "AI reads every placement email and extracts company, role, stage, and deadline automatically" },
          { icon: "⚠️", title: "Forgotten Opportunity Recovery", desc: "Detects shortlists you missed and alerts you before the window closes forever" },
          { icon: "📅", title: "Deadline Intelligence", desc: "48hr, 24hr, and 2hr warnings before every assignment and interview deadline" },
          { icon: "✍️", title: "One-Click Reply Drafts", desc: "AI drafts professional replies to interview invites and follow-ups in 10 seconds" },
          { icon: "📊", title: "Pipeline Dashboard", desc: "See your entire placement journey — Applied, Shortlisted, Interview, Offer — in one view" },
          { icon: "📱", title: "WhatsApp Alerts", desc: "Get urgent notifications on WhatsApp because that's where you actually are" },
        ].map((f) => (
          <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-blue-500/30 transition">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center py-16 border-t border-white/10">
        <h2 className="text-3xl font-bold mb-4">Ready to take control of your placements?</h2>
        <p className="text-gray-400 mb-8">Join students who never miss an opportunity</p>
        <Link href="/sign-up" className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-xl text-lg font-semibold transition">
          Get Started — It's Free
        </Link>
      </div>
    </main>
  );
}