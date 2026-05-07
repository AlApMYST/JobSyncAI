import { prisma } from "@/lib/prisma";

export interface GmailEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string | null;
  snippet: string;
  body: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: GmailPart & {
    headers?: GmailHeader[];
  };
}

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function getGoogleRedirectUri(requestUrl: string) {
  const localRedirectUri = `${new URL(requestUrl).origin}/api/gmail/callback`;
  if (process.env.NODE_ENV !== "production") return localRedirectUri;
  return process.env.GOOGLE_REDIRECT_URI || localRedirectUri;
}

export function getGoogleAuthUrl(requestUrl: string, state: string) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Missing GOOGLE_CLIENT_ID in environment variables");
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getGoogleRedirectUri(requestUrl),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, requestUrl: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth client credentials");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getGoogleRedirectUri(requestUrl),
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || "Google token exchange failed");
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export async function getGmailProfile(accessToken: string) {
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to read Gmail profile");
  }

  return data as {
    emailAddress: string;
    historyId?: string;
  };
}

export async function getValidGmailAccessToken(clerkId: string) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { clerkId },
  });

  if (!connection) {
    throw new Error("Gmail is not connected yet");
  }

  const expiresAt = connection.expiresAt?.getTime() || 0;
  const stillValid = expiresAt > Date.now() + 60_000;
  if (stillValid) return connection.accessToken;

  if (!connection.refreshToken) {
    throw new Error("Gmail session expired. Please reconnect Gmail.");
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth client credentials");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || "Failed to refresh Gmail token");
  }

  const expires = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await prisma.gmailConnection.update({
    where: { clerkId },
    data: {
      accessToken: data.access_token,
      expiresAt: expires,
    },
  });

  return data.access_token as string;
}

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
};

const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const collectBodies = (part: GmailPart | undefined, bodies: string[] = []) => {
  if (!part) return bodies;

  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    bodies.push(part.mimeType === "text/html" ? stripHtml(decoded) : decoded);
  }

  part.parts?.forEach((child) => collectBodies(child, bodies));
  return bodies;
};

const getHeader = (headers: GmailHeader[] | undefined, name: string) =>
  headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())
    ?.value || "";

export async function fetchRecentGmailEmails({
  accessToken,
  days = 30,
  maxResults = 20,
}: {
  accessToken: string;
  days?: number;
  maxResults?: number;
}) {
  const params = new URLSearchParams({
    q: `newer_than:${days}d`,
    maxResults: String(maxResults),
  });

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const listData = await listResponse.json();
  if (!listResponse.ok) {
    throw new Error(listData?.error?.message || "Failed to list Gmail messages");
  }

  const messages = (listData.messages || []) as Array<{ id: string }>;

  const emails = await Promise.all(
    messages.map(async (message) => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const data = (await response.json()) as GmailMessage & {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to read Gmail message");
      }

      const headers = data.payload?.headers || [];
      const body = collectBodies(data.payload).join("\n\n").trim();

      return {
        id: data.id,
        threadId: data.threadId,
        from: getHeader(headers, "From"),
        subject: getHeader(headers, "Subject") || "(No subject)",
        date: getHeader(headers, "Date") || null,
        snippet: data.snippet || "",
        body: body || data.snippet || "",
      } satisfies GmailEmail;
    })
  );

  return emails;
}
