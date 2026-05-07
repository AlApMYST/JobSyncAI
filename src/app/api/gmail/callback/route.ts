import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getGmailProfile } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";

const redirectWithError = (request: NextRequest, message: string) => {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("gmail_error", message);
  return NextResponse.redirect(url);
};

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.cookies.get("gmail_oauth_state")?.value;

  if (!code) return redirectWithError(request, "Google did not return a code");
  if (!state || state !== savedState) {
    return redirectWithError(request, "Invalid Gmail connection state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, request.url);
    const profile = await getGmailProfile(tokens.access_token);
    const clerkUser = await currentUser();
    const primaryEmail =
      clerkUser?.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ||
      clerkUser?.emailAddresses[0]?.emailAddress ||
      profile.emailAddress;

    const dbUser = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {
        email: primaryEmail,
        name: clerkUser?.fullName || clerkUser?.firstName || null,
      },
      create: {
        clerkId: userId,
        email: primaryEmail,
        name: clerkUser?.fullName || clerkUser?.firstName || null,
      },
    });

    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    );

    await prisma.gmailConnection.upsert({
      where: { clerkId: userId },
      update: {
        email: profile.emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt,
        historyId: profile.historyId || null,
      },
      create: {
        clerkId: userId,
        userId: dbUser.id,
        email: profile.emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
        historyId: profile.historyId || null,
      },
    });

    const response = NextResponse.redirect(
      new URL("/dashboard?gmail=connected", request.url)
    );
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (error: any) {
    return redirectWithError(request, error.message || "Gmail connection failed");
  }
}
