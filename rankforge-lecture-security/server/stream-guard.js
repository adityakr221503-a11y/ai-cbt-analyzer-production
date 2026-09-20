/**
 * RankForge Lecture Stream Security
 * Short-lived signed-token foundation.
 * NOT DRM. Secret must remain server-side.
 */

const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64url(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value)
  );

  return base64url(new Uint8Array(signature));
}

export async function createLectureStreamToken({
  lectureId,
  userId,
  sessionId,
  ttlSeconds = 300,
  secret
}) {
  if (!secret) {
    throw new Error("LECTURE_STREAM_SECRET is required");
  }

  if (!lectureId || !userId || !sessionId) {
    throw new Error(
      "lectureId, userId and sessionId are required"
    );
  }

  const payload = {
    lectureId,
    userId,
    sessionId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };

  const encoded = base64url(
    encoder.encode(JSON.stringify(payload))
  );

  const signature = await hmac(encoded, secret);

  return `${encoded}.${signature}`;
}

export async function verifyLectureStreamToken(token, secret) {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, suppliedSignature] = parts;
  const expectedSignature = await hmac(encoded, secret);

  if (suppliedSignature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(
        decodeBase64url(encoded)
      )
    );

    if (
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
