import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    const state = crypto.randomUUID();
    const authUrl = getGoogleAuthUrl(request.url, state);
    const response = NextResponse.redirect(authUrl);

    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error: any) {
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("gmail_error", error.message || "connect_failed");
    return NextResponse.redirect(url);
  }
}
