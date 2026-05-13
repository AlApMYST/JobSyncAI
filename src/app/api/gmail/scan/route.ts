import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { analyzeEmailWithAI } from "@/lib/analyze-email";
import { fetchGmailEmailsList, fetchGmailEmailsByIds, getValidGmailAccessToken } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const previewFrom = (body: string, snippet: string) =>
  (snippet || body).replace(/\s+/g, " ").trim().slice(0, 140);

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const connection = await prisma.gmailConnection.findUnique({
      where: { clerkId: userId },
      select: { userId: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connect Gmail before scanning" },
        { status: 400 }
      );
    }

    const accessToken = await getValidGmailAccessToken(userId);
    const listResponse = await fetchGmailEmailsList({
      accessToken,
      query: "newer_than:30d",
      maxResults: 5,
    });

    const messageIds = listResponse.messages.map(m => m.id);
    const emails =
      messageIds.length > 0
        ? await fetchGmailEmailsByIds(accessToken, messageIds.slice(0, 3))
        : [];
    
    const items = [];
    for (const email of emails) {
      const analysis = await analyzeEmailWithAI({
        emailContent: email.body.slice(0, 1500),
        emailSubject: email.subject,
        emailFrom: email.from,
        emailDate: email.date,
      });
      await new Promise(resolve => setTimeout(resolve, 4000));

      if (analysis.is_placement_related) {
        await prisma.application.upsert({
          where: {
            userId_emailId: {
              userId: connection.userId,
              emailId: email.id,
            },
          },
          update: {
            company: analysis.company || "Unknown company",
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
          create: {
            userId: connection.userId,
            company: analysis.company || "Unknown company",
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
            emailId: email.id,
            fromEmail: email.from,
            subject: email.subject,
            receivedAt: parseDate(email.date),
            rawEmail: email.body,
          },
        });
      }

      items.push({
        email: {
          id: `gmail-${email.id}`,
          from: email.from,
          subject: email.subject,
          preview: previewFrom(email.body, email.snippet),
          time: email.date ? new Date(email.date).toLocaleDateString() : "Gmail",
          urgent: analysis.action_required || analysis.urgency === "HIGH",
          content: email.body,
        },
        analysis,
      });
    }

    return NextResponse.json({
      success: true,
      count: items.length,
      placementCount: items.filter((item) => item.analysis.is_placement_related)
        .length,
      filteredCount: items.filter((item) => !item.analysis.is_placement_related)
        .length,
      items,
    });
  } catch (error: any) {
    console.error("Gmail scan error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Gmail scan failed" },
      { status: 500 }
    );
  }
}
