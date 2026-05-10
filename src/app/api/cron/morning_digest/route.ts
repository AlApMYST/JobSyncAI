import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        gmailConnection: { isNot: null },
      },
      include: {
        applications: {
          where: {
            actionRequired: true,
            isForgotten: false,
          },
          orderBy: { deadline: "asc" },
        },
      },
    });

    const results = [];

    for (const user of users) {
      try {
        const urgentApps = user.applications.filter(
          (app) => app.urgency === "HIGH"
        );
        const actionApps = user.applications.filter(
          (app) => app.actionRequired
        );
        const allApps = await prisma.application.findMany({
          where: { userId: user.id },
        });

        const upcomingDeadlines = user.applications.filter((app) => {
          if (!app.deadline) return false;
          const hoursLeft =
            (new Date(app.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
          return hoursLeft > 0 && hoursLeft < 48;
        });

        if (actionApps.length === 0 && upcomingDeadlines.length === 0) {
          continue;
        }

        const urgentSection =
          urgentApps.length > 0
            ? `
          <div style="background:#1a0a0a;border-left:3px solid #ef4444;padding:12px;border-radius:6px;margin-bottom:12px;">
            <p style="color:#ef4444;font-size:11px;font-weight:700;margin:0 0 8px;">🔴 URGENT — ${urgentApps.length} action${urgentApps.length > 1 ? "s" : ""} needed</p>
            ${urgentApps
              .map(
                (app) => `
              <p style="color:#d1d5db;font-size:13px;margin:4px 0;">→ ${app.company} — ${app.actionDescription || app.summary || "Action required"}</p>
            `
              )
              .join("")}
          </div>
        `
            : "";

        const deadlineSection =
          upcomingDeadlines.length > 0
            ? `
          <div style="background:#1a0f00;border-left:3px solid #f97316;padding:12px;border-radius:6px;margin-bottom:12px;">
            <p style="color:#f97316;font-size:11px;font-weight:700;margin:0 0 8px;">⏰ DEADLINES IN 48 HOURS</p>
            ${upcomingDeadlines
              .map((app) => {
                const hoursLeft = Math.floor(
                  (new Date(app.deadline!).getTime() - Date.now()) /
                    (1000 * 60 * 60)
                );
                return `<p style="color:#d1d5db;font-size:13px;margin:4px 0;">→ ${app.company} — ${hoursLeft}h left — ${app.deadlineText || "deadline approaching"}</p>`;
              })
              .join("")}
          </div>
        `
            : "";

        const pipelineSection = `
          <div style="background:#0f0f1a;border:1px solid #1f2937;padding:12px;border-radius:6px;margin-bottom:12px;">
            <p style="color:#9ca3af;font-size:11px;font-weight:700;margin:0 0 8px;">📊 YOUR PIPELINE</p>
            <p style="color:#d1d5db;font-size:13px;margin:4px 0;">Total Applications: ${allApps.length}</p>
            <p style="color:#d1d5db;font-size:13px;margin:4px 0;">Action Needed: ${actionApps.length}</p>
            <p style="color:#d1d5db;font-size:13px;margin:4px 0;">Offers: ${allApps.filter((a) => a.stage === "Offer").length}</p>
          </div>
        `;

        const html = `
          <div style="font-family:sans-serif;background:#0a0a0f;color:#ffffff;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;">
            <div style="display:flex;align-items:center;margin-bottom:24px;">
              <div style="background:#3b82f6;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;margin-right:12px;">J</div>
              <span style="font-size:18px;font-weight:700;">JobSync AI</span>
            </div>

            <h2 style="color:#ffffff;font-size:20px;margin-bottom:4px;">Good morning, ${user.name || "there"}! 👋</h2>
            <p style="color:#9ca3af;font-size:14px;margin-bottom:24px;">Here's your placement update for today.</p>

            ${urgentSection}
            ${deadlineSection}
            ${pipelineSection}

            <div style="text-align:center;margin-top:24px;">
              <a href="https://job-sync-ai-iota.vercel.app/dashboard" style="background:#3b82f6;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                Open Dashboard →
              </a>
            </div>

            <p style="color:#4b5563;font-size:11px;text-align:center;margin-top:24px;">
              JobSync AI — Never miss a placement opportunity
            </p>
          </div>
        `;

        await resend.emails.send({
          from: "JobSync AI <onboarding@resend.dev>",
          to: user.email,
          subject: `Your placement update — ${urgentApps.length} urgent, ${upcomingDeadlines.length} deadlines today`,
          html,
        });

        results.push({ userId: user.id, email: user.email, sent: true });
      } catch (err: any) {
        console.error(`Digest error for ${user.email}:`, err.message);
        results.push({ userId: user.id, email: user.email, sent: false });
      }
    }

    return NextResponse.json({
      success: true,
      processed: users.length,
      results,
    });
  } catch (error: any) {
    console.error("Morning digest error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}