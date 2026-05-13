import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      const clerkUser = await currentUser();
      const primaryEmail =
        clerkUser?.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId
        )?.emailAddress || clerkUser?.emailAddresses[0]?.emailAddress;

      if (primaryEmail) {
        const existingUser = await prisma.user.findUnique({
          where: { email: primaryEmail },
        });

        if (existingUser) {
          user = await prisma.user.update({
            where: { id: existingUser.id },
            data: { clerkId: userId },
          });
        }
      }
    }

    if (!user) {
      return NextResponse.json({ success: true, applications: [] });
    }

    const applications = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, applications });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
