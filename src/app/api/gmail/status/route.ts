import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  let connection = await prisma.gmailConnection.findUnique({
    where: { clerkId: userId },
    select: { email: true, updatedAt: true },
  });

  if (!connection) {
    const clerkUser = await currentUser();
    const primaryEmail =
      clerkUser?.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      )?.emailAddress || clerkUser?.emailAddresses[0]?.emailAddress;

    if (primaryEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: primaryEmail },
        include: { gmailConnection: true },
      });

      if (existingUser?.gmailConnection) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: existingUser.id },
            data: { clerkId: userId },
          }),
          prisma.gmailConnection.update({
            where: { id: existingUser.gmailConnection.id },
            data: { clerkId: userId },
          }),
        ]);

        connection = {
          email: existingUser.gmailConnection.email,
          updatedAt: existingUser.gmailConnection.updatedAt,
        };
      }
    }
  }

  return NextResponse.json({
    connected: Boolean(connection),
    email: connection?.email || null,
    updatedAt: connection?.updatedAt || null,
  });
}
