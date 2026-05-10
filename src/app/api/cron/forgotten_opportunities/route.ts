import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find applications where action was required but not acted on in 7+ days
    const forgottenApps = await prisma.application.findMany({
      where: {
        actionRequired: true,
        isForgotten: false,
        updatedAt: { lt: sevenDaysAgo },
      },
      include: {
        user: {
          select: { email: true, name: true, phoneNumber: true },
        },
      },
    });

    // Mark them as forgotten
    if (forgottenApps.length > 0) {
      await prisma.application.updateMany({
        where: {
          id: { in: forgottenApps.map(app => app.id) },
        },
        data: { isForgotten: true },
      });
    }

    console.log(`Forgotten opportunities found: ${forgottenApps.length}`);

    return NextResponse.json({
      success: true,
      count: forgottenApps.length,
      opportunities: forgottenApps.map(app => ({
        id: app.id,
        company: app.company,
        role: app.role,
        stage: app.stage,
        summary: app.summary,
        userEmail: app.user.email,
        daysSinceUpdate: Math.floor(
          (Date.now() - new Date(app.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
    });
  } catch (error: any) {
    console.error("Forgotten opportunities error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}