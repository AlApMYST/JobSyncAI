import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeEmailWithAI } from "@/lib/analyze-email";
import { fetchGmailEmailsList, fetchGmailEmailsByIds, getValidGmailAccessToken } from "@/lib/gmail";

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

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
        const fullConn = await prisma.gmailConnection.findUnique({
          where: { clerkId: connection.clerkId },
          select: { nextPageToken: true },
        });

        const accessToken = await getValidGmailAccessToken(connection.clerkId);

        // 1. Try recent emails
        let listResponse = await fetchGmailEmailsList({
          accessToken,
          query: "newer_than:2d",
          maxResults: 50,
        });

        let messageIds = listResponse.messages.map(m => m.id);
        let existingApps = await prisma.application.findMany({
          where: { userId: connection.userId, emailId: { in: messageIds } },
          select: { emailId: true },
        });
        let existingIds = new Set(existingApps.map(a => a.emailId));
        let newIds = messageIds.filter(id => !existingIds.has(id));

        // 2. If no new recent emails, paginate historical
        if (newIds.length === 0) {
          listResponse = await fetchGmailEmailsList({
            accessToken,
            maxResults: 50,
            pageToken: fullConn?.nextPageToken || undefined,
          });

          messageIds = listResponse.messages.map(m => m.id);
          existingApps = await prisma.application.findMany({
            where: { userId: connection.userId, emailId: { in: messageIds } },
            select: { emailId: true },
          });
          existingIds = new Set(existingApps.map(a => a.emailId));
          newIds = messageIds.filter(id => !existingIds.has(id));

          // Save next page token for next cron run
          if (listResponse.nextPageToken) {
            await prisma.gmailConnection.update({
              where: { clerkId: connection.clerkId },
              data: { nextPageToken: listResponse.nextPageToken },
            });
          }
        }

        const idsToProcess = newIds.slice(0, 3);
        let scanned = 0;

        if (idsToProcess.length > 0) {
          const emails = await fetchGmailEmailsByIds(accessToken, idsToProcess);

          for (const email of emails) {
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
                  deadline: parseDate(analysis.deadline),
                  deadlineText: analysis.deadline_text,
                  actionRequired: analysis.action_required,
                  actionDescription: analysis.action_description,
                  contactEmail: analysis.contact_email,
                  importantLinks: analysis.important_links || [],
                  confidence: analysis.confidence || 0,
                  summary: analysis.summary,
                  fromEmail: email.from,
                  subject: email.subject,
                  receivedAt: parseDate(email.date),
                  rawEmail: email.body,
                },
                create: {
                  userId: connection.userId,
                  emailId: email.id,
                  company: analysis.company || "Unknown",
                  role: analysis.role,
                  stage: analysis.stage || "Unknown",
                  urgency: analysis.urgency || "LOW",
                  deadline: parseDate(analysis.deadline),
                  deadlineText: analysis.deadline_text,
                  actionRequired: analysis.action_required,
                  actionDescription: analysis.action_description,
                  contactEmail: analysis.contact_email,
                  importantLinks: analysis.important_links || [],
                  confidence: analysis.confidence || 0,
                  summary: analysis.summary,
                  fromEmail: email.from,
                  subject: email.subject,
                  receivedAt: parseDate(email.date),
                  rawEmail: email.body,
                },
              });
              scanned++;
            }

            await new Promise(resolve => setTimeout(resolve, 4000));
          }
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
