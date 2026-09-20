/*
 RankForge Lecture Security Model
 --------------------------------
 This module defines the server-side security contract.

 IMPORTANT:
 - Never put permanent video URLs in frontend code.
 - Never put signing secrets in frontend code.
 - The actual video provider/CDN should enforce the signed URL/token.
*/

const CONFIG = Object.freeze({
  STREAM_TOKEN_TTL_SECONDS: 300, // 5 minutes
  MAX_SESSIONS_PER_ACCOUNT: 2,
  WATERMARK_REQUIRED: true
});

function assertAuthenticated(user) {
  if (!user || !user.id) {
    throw new Error("AUTH_REQUIRED");
  }
}

function assertLectureAccess(user, lecture) {
  assertAuthenticated(user);

  if (!lecture || !lecture.id) {
    throw new Error("LECTURE_NOT_FOUND");
  }

  if (!lecture.purchasedBy?.includes(user.id)) {
    throw new Error("LECTURE_ACCESS_DENIED");
  }
}

function securityPolicy() {
  return {
    tokenTTL: CONFIG.STREAM_TOKEN_TTL_SECONDS,
    maxSessions: CONFIG.MAX_SESSIONS_PER_ACCOUNT,
    watermarkRequired: CONFIG.WATERMARK_REQUIRED,
    permanentPublicVideoURL: false,
    frontendSigningSecret: false
  };
}

module.exports = {
  CONFIG,
  assertAuthenticated,
  assertLectureAccess,
  securityPolicy
};
