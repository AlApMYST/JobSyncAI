import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const connection = await prisma.gmailConnection.findUnique({
    where: { clerkId: userId },
    select: { email: true, updatedAt: true },
  });

  return NextResponse.json({
    connected: Boolean(connection),
    email: connection?.email || null,
    updatedAt: connection?.updatedAt || null,
  });
}
