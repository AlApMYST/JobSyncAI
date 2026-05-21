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

// ── Telegram alert ────────────────────────────────────────────────────────────
async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.error("Telegram alert failed:", e);
  }
}

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
      query: "newer_than:60d",
      maxResults: 20,
    });

    // Get already processed email IDs from DB
    const existing = await prisma.application.findMany({
      where: { userId: connection.userId },
      select: { emailId: true },
    });
    const existingIds = new Set(existing.map(e => e.emailId));

    // Only process emails NOT already in DB
    const newIds = listResponse.messages.map(m => m.id).filter(id => !existingIds.has(id));
    const emails = newIds.length > 0
      ? await fetchGmailEmailsByIds(accessToken, newIds.slice(0, 3))
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

        // ── Send Telegram alert for HIGH or MEDIUM urgency ──────────────────
        if (analysis.urgency === "HIGH" || analysis.urgency === "MEDIUM") {
          const urgencyEmoji = analysis.urgency === "HIGH" ? "🚨" : "⚠️";
          const deadlineText = analysis.deadline_text
            ? `\n⏰ <b>Deadline:</b> ${analysis.deadline_text}`
            : "";
          const actionText = analysis.action_required && analysis.action_description
            ? `\n⚡ <b>Action:</b> ${analysis.action_description}`
            : "";

          const message =
            `${urgencyEmoji} <b>${analysis.urgency} URGENCY — JobSync AI</b>\n\n` +
            `🏢 <b>Company:</b> ${analysis.company || "Unknown"}\n` +
            `💼 <b>Role:</b> ${analysis.role || "Not specified"}\n` +
            `📊 <b>Stage:</b> ${analysis.stage || "Unknown"}` +
            deadlineText +
            actionText +
            `\n\n🔗 job-sync-ai-iota.vercel.app`;

          await sendTelegramAlert(message);
        }
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
      placementCount: items.filter((item) => item.analysis.is_placement_related).length,
      filteredCount: items.filter((item) => !item.analysis.is_placement_related).length,
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