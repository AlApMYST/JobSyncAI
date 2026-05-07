import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeEmailWithAI } from "@/lib/analyze-email";
import { fetchRecentGmailEmails, getValidGmailAccessToken } from "@/lib/gmail";

export async function GET(request: Request) {
  // Security check — only Vercel cron can call this
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all connected Gmail accounts
    const connections = await prisma.gmailConnection.findMany({
      select: { clerkId: true, userId: true },
    });

    console.log(`Cron: scanning ${connections.length} accounts`);

    const results = [];

    for (const connection of connections) {
      try {
        const accessToken = await getValidGmailAccessToken(connection.clerkId);
        const emails = await fetchRecentGmailEmails({
          accessToken,
          days: 1, // Only last 24 hours for cron
          maxResults: 5,
        });

        let scanned = 0;
        for (const email of emails.slice(0, 3)) {
          const analysis = await analyzeEmailWithAI({
            emailContent: email.body.slice(0, 1500),
            emailSubject: email.subject,
            emailFrom: email.from,
            emailDate: email.date,
          });

          if (analysis.is_placement_related) {
            await prisma.application.upsert({
              where: {
                userId_emailId: {
                  userId: connection.userId,
                  emailId: email.id,
                },
              },
              update: {
                stage: analysis.stage || "Unknown",
                urgency: analysis.urgency || "LOW",
                actionRequired: analysis.action_required,
                summary: analysis.summary,
              },
              create: {
                userId: connection.userId,
                emailId: email.id,
                company: analysis.company || "Unknown",
                role: analysis.role,
                stage: analysis.stage || "Unknown",
                urgency: analysis.urgency || "LOW",
                deadline: null,
                actionRequired: analysis.action_required,
                actionDescription: analysis.action_description,
                contactEmail: analysis.contact_email,
                confidence: analysis.confidence || 0,
                summary: analysis.summary,
                fromEmail: email.from,
                subject: email.subject,
              },
            });
            scanned++;
          }

          await new Promise(resolve => setTimeout(resolve, 4000));
        }

        results.push({ userId: connection.userId, scanned });
      } catch (err: any) {
        console.error(`Cron error for user ${connection.userId}:`, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      accounts: connections.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}