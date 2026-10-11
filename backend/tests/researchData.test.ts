import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { nanoid } from "nanoid";

// Ensure test environment and isolated temporary database fixture by default
process.env.NODE_ENV = "test";
const tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "thinkflow-test-"));
const tempDbPath = path.join(tempDbDir, "thinkflow-test-db.json");
process.env.THINKFLOW_DB_PATH = process.env.THINKFLOW_DB_PATH ?? tempDbPath;

// Ensure a valid long salt for test execution baseline
const VALID_TEST_SALT = "test-secure-salt-with-at-least-32-characters-required";
process.env.THINKFLOW_RESEARCH_SALT = VALID_TEST_SALT;

const { db } = await import("../src/storage/db.js");
const { config } = await import("../src/config.js");
const { createApp } = await import("../src/server.js");
const {
  computeAggregateFeatures,
  deleteUserResearchData,
  getResearchDatasetStats,
  getResearchSalt,
  mapSelfReportToTargetClass,
  pseudonymizeParticipantId,
  recordResearchSample,
  updateUserResearchConsent,
} = await import("../src/services/researchDataService.js");
const { fuseMoodSignals } = await import("../src/services/emotionEngine.js");
const { apiRouter } = await import("../src/routes/api.js");

test("Research Data Collection, Security, & Consent Suite", async (t) => {
  // Track all test-created user IDs for robust teardown cleanup
  const createdUserIds = new Set<string>();

  // Setup a test user
  const testUserId = "test-user-consent-" + Date.now();
  createdUserIds.add(testUserId);
  const testUser = {
    id: testUserId,
    displayName: "Test Developer",
    createdAt: new Date().toISOString(),
    personalityMode: "friendly-buddy" as const,
    timezone: "UTC",
    researchConsent: {
      optedIn: false,
      updatedAt: new Date().toISOString(),
      version: "1.0",
    },
  };
  db.data.users.push(testUser);
  await db.write();

  t.after(async () => {
    // Restore valid salt
    process.env.THINKFLOW_RESEARCH_SALT = VALID_TEST_SALT;

    // Cleanup all test users and associated research samples
    db.data.users = db.data.users.filter((u) => !createdUserIds.has(u.id));
    for (const uid of createdUserIds) {
      if (db.data.researchSamples) {
        try {
          const pid = pseudonymizeParticipantId(uid);
          db.data.researchSamples = db.data.researchSamples.filter(
            (s) => s.participantId !== pid,
          );
        } catch {
          // Ignore if salt is unset during teardown
        }
      }
    }

    // Cleanup all test extension links
    if (db.data.extensionLinks) {
      db.data.extensionLinks = db.data.extensionLinks.filter(
        (l) => !createdUserIds.has(l.userId),
      );
    }

    // Cleanup all test typing snapshots
    if (db.data.typingSnapshots) {
      db.data.typingSnapshots = db.data.typingSnapshots.filter(
        (s) => !createdUserIds.has(s.userId),
      );
    }

    await db.write();

    // Clean up temporary database directory
    try {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error if already removed
    }
  });

  const createTestAuthToken = (userId: string) => {
    createdUserIds.add(userId);
    const rawToken = `tf_sec_test_${crypto.randomBytes(24).toString("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const link = {
      id: "link-" + nanoid(),
      userId,
      ide: "vscode" as const,
      installId: "install-" + nanoid(),
      linkedAt: new Date().toISOString(),
      linkCode: `TF-${nanoid(8).toUpperCase()}`,
      tokenHash,
    };
    if (!db.data.extensionLinks) {
      db.data.extensionLinks = [];
    }
    db.data.extensionLinks.push(link);
    return { token: rawToken, link };
  };

  await t.test("1. Defensible label mapping logic", () => {
    // Supported target mappings
    assert.equal(mapSelfReportToTargetClass("frustrated"), "frustration");
    assert.equal(mapSelfReportToTargetClass("confident"), "confidence");
    assert.equal(mapSelfReportToTargetClass("neutral"), "neutral");
    assert.equal(mapSelfReportToTargetClass("calm"), "neutral");

    // Unsupported assumptions are strictly excluded (return null)
    assert.equal(
      mapSelfReportToTargetClass("energetic"),
      null,
      "energetic must NOT be assumed to mean confidence",
    );
    assert.equal(
      mapSelfReportToTargetClass("fatigued"),
      null,
      "fatigued must NOT be assumed to mean frustration",
    );
  });

  await t.test("2. Secret fail-closed: missing or weak HMAC salt", async () => {
    const originalSalt = process.env.THINKFLOW_RESEARCH_SALT;

    try {
      // Test 2a: Missing salt
      delete process.env.THINKFLOW_RESEARCH_SALT;
      assert.throws(
        () => getResearchSalt(),
        /THINKFLOW_RESEARCH_SALT is missing or has insufficient entropy/,
      );
      assert.throws(
        () => pseudonymizeParticipantId("any-user"),
        /THINKFLOW_RESEARCH_SALT is missing or has insufficient entropy/,
      );

      // Verify recordResearchSample fails closed safely without crashing or leaking
      await updateUserResearchConsent(testUserId, true);
      const missingSaltResult = await recordResearchSample({
        userId: testUserId,
        sessionId: "session-secret-test",
        window: {
          timestamp: new Date().toISOString(),
          charsTyped: 50,
          wordsTyped: 10,
          backspaces: 2,
          errorCount: 0,
          pauseMs: 1000,
          durationMs: 15000,
        },
        selfReport: {
          emotion: "frustrated",
          reportTimestamp: new Date().toISOString(),
        },
      });
      assert.equal(missingSaltResult.accepted, false);
      assert.match(missingSaltResult.reason ?? "", /secure salt configuration missing/i);

      // Test 2b: Too short / weak salt (< 32 characters)
      process.env.THINKFLOW_RESEARCH_SALT = "too-short-secret";
      assert.throws(
        () => getResearchSalt(),
        /insufficient entropy/,
      );
    } finally {
      process.env.THINKFLOW_RESEARCH_SALT = originalSalt ?? VALID_TEST_SALT;
    }
  });

  await t.test("3. Rejection when consent is disabled (default off)", async () => {
    testUser.researchConsent = {
      optedIn: false,
      updatedAt: new Date().toISOString(),
      version: "1.0",
    };
    await db.write();

    const now = new Date();
    const result = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-1",
      window: {
        timestamp: now.toISOString(),
        charsTyped: 120,
        wordsTyped: 24,
        backspaces: 4,
        errorCount: 1,
        pauseMs: 2500,
        durationMs: 30000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: now.toISOString(),
      },
    });

    assert.equal(result.accepted, false);
    assert.match(result.reason ?? "", /consent is not granted/i);

    // Verify nothing stored
    const pid = pseudonymizeParticipantId(testUserId);
    const stored = (db.data.researchSamples ?? []).find(
      (s) => s.participantId === pid,
    );
    assert.equal(stored, undefined);
  });

  await t.test("4. Accepted when consent is explicitly enabled", async () => {
    await updateUserResearchConsent(testUserId, true);
    assert.equal(testUser.researchConsent?.optedIn, true);

    const now = new Date();
    const result = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-active-1",
      window: {
        timestamp: now.toISOString(),
        charsTyped: 200,
        wordsTyped: 40,
        backspaces: 8,
        errorCount: 2,
        pauseMs: 4000,
        durationMs: 45000,
      },
      selfReport: {
        emotion: "confident",
        energy: 8,
        reportTimestamp: now.toISOString(),
      },
    });

    assert.equal(result.accepted, true);
    assert.ok(result.sample);
    assert.equal(result.sample.label.targetClass, "confidence");
    assert.equal(result.sample.label.selfReportedEmotion, "confident");
    assert.equal(result.sample.label.energy, 8);
    assert.equal(result.sample.sessionId, "session-active-1");

    // Verify pseudonymized participant ID
    const expectedPid = pseudonymizeParticipantId(testUserId);
    assert.equal(result.sample.participantId, expectedPid);
    assert.notEqual(result.sample.participantId, testUserId);

    // Verify numerical features calculated
    assert.equal(result.sample.features.charsTyped, 200);
    assert.equal(result.sample.features.backspaces, 8);
    assert.ok(result.sample.features.typingSpeedWpm > 0);
  });

  await t.test("5. Rejection of unmappable labels (energetic, fatigued)", async () => {
    const now = new Date().toISOString();
    const resultEnergetic = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-active-1",
      window: {
        timestamp: now,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "energetic",
        reportTimestamp: now,
      },
    });
    assert.equal(resultEnergetic.accepted, false);
    assert.match(resultEnergetic.reason ?? "", /cannot be mapped defensibly/i);

    const resultFatigued = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-active-1",
      window: {
        timestamp: now,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "fatigued",
        reportTimestamp: now,
      },
    });
    assert.equal(resultFatigued.accepted, false);
    assert.match(resultFatigued.reason ?? "", /cannot be mapped defensibly/i);
  });

  await t.test("6. Timestamp semantics: invalid dates, report before window, stale report", async () => {
    const baseTime = Date.now();
    const windowEndIso = new Date(baseTime).toISOString();

    // 6a: Invalid date formats (non-parseable string and non-ISO string like 2026/10/11)
    const invalidDateResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: "not-a-valid-date",
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: windowEndIso,
      },
    });
    assert.equal(invalidDateResult.accepted, false);
    assert.match(invalidDateResult.reason ?? "", /invalid window timestamp format/i);

    const nonIsoDateResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: "2026/10/11", // Valid in Date.parse, but NOT valid ISO-8601
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: windowEndIso,
      },
    });
    assert.equal(nonIsoDateResult.accepted, false);
    assert.match(nonIsoDateResult.reason ?? "", /invalid window timestamp format/i);

    const nonIsoReportResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: windowEndIso,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: "October 11, 2026", // Valid in Date.parse, but NOT valid ISO-8601
      },
    });
    assert.equal(nonIsoReportResult.accepted, false);
    assert.match(nonIsoReportResult.reason ?? "", /invalid self-report timestamp format/i);

    // 6b: Report preceding typing window (report happens 10 seconds before window ended)
    const reportPrecedingTime = new Date(baseTime - 10000).toISOString();
    const precedingResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: windowEndIso,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: reportPrecedingTime,
      },
    });
    assert.equal(precedingResult.accepted, false);
    assert.match(precedingResult.reason ?? "", /precedes the typing window/i);

    // 6c: Zero tolerance: Report preceding typing window by even 500ms must be rejected
    const reportPrecedingJitter = new Date(baseTime - 500).toISOString();
    const jitterResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: windowEndIso,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: reportPrecedingJitter,
      },
    });
    assert.equal(jitterResult.accepted, false);
    assert.match(jitterResult.reason ?? "", /precedes the typing window/i);

    // 6d: Boundary: Report at exactly window conclusion is accepted (latencySec = 0)
    const exactResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: windowEndIso,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: windowEndIso,
      },
    });
    assert.equal(exactResult.accepted, true);
    assert.equal(exactResult.sample?.label.reportLatencySec, 0);

    // 6e: Boundary: Report at exactly 300 seconds (5 minutes) is accepted
    const exactly300sReportTime = new Date(baseTime + 300 * 1000).toISOString();
    const boundary300Result = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: windowEndIso,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: exactly300sReportTime,
      },
    });
    assert.equal(boundary300Result.accepted, true);
    assert.equal(boundary300Result.sample?.label.reportLatencySec, 300);

    // 6f: Stale report (> 300 seconds, e.g. 301 seconds after window ended)
    const staleReportTime = new Date(baseTime + 301 * 1000).toISOString();
    const staleResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-time-test",
      window: {
        timestamp: windowEndIso,
        charsTyped: 100,
        wordsTyped: 20,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1000,
        durationMs: 20000,
      },
      selfReport: {
        emotion: "frustrated",
        reportTimestamp: staleReportTime,
      },
    });
    assert.equal(staleResult.accepted, false);
    assert.match(staleResult.reason ?? "", /stale self-report/i);
  });

  await t.test("7. Strict numeric validation & inconsistent metrics", async () => {
    const now = new Date().toISOString();

    // 7a: Inconsistent: wordsTyped > charsTyped
    const wordsExceedCharsResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-inconsistent",
      window: {
        timestamp: now,
        charsTyped: 10,
        wordsTyped: 50, // 50 words in 10 chars is impossible
        backspaces: 0,
        errorCount: 0,
        pauseMs: 100,
        durationMs: 5000,
      },
      selfReport: { emotion: "neutral", reportTimestamp: now },
    });
    assert.equal(wordsExceedCharsResult.accepted, false);
    assert.match(wordsExceedCharsResult.reason ?? "", /wordsTyped cannot exceed charsTyped/i);

    // 7b: Inconsistent: pauseMs > durationMs
    const pauseExceedsDurationResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-inconsistent",
      window: {
        timestamp: now,
        charsTyped: 50,
        wordsTyped: 10,
        backspaces: 0,
        errorCount: 0,
        pauseMs: 25000, // 25s pause in a 10s window is impossible
        durationMs: 10000,
      },
      selfReport: { emotion: "neutral", reportTimestamp: now },
    });
    assert.equal(pauseExceedsDurationResult.accepted, false);
    assert.match(pauseExceedsDurationResult.reason ?? "", /pauseMs cannot exceed durationMs/i);

    // 7c: Negative value
    const negativeResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-inconsistent",
      window: {
        timestamp: now,
        charsTyped: -5,
        wordsTyped: 2,
        backspaces: 0,
        errorCount: 0,
        pauseMs: 0,
        durationMs: 5000,
      },
      selfReport: { emotion: "neutral", reportTimestamp: now },
    });
    assert.equal(negativeResult.accepted, false);
    assert.match(negativeResult.reason ?? "", /invalid negative/i);

    // 7d: Zero typing activity
    const zeroResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-inconsistent",
      window: {
        timestamp: now,
        charsTyped: 0,
        wordsTyped: 0,
        backspaces: 0,
        errorCount: 0,
        pauseMs: 0,
        durationMs: 5000,
      },
      selfReport: { emotion: "neutral", reportTimestamp: now },
    });
    assert.equal(zeroResult.accepted, false);
    assert.match(zeroResult.reason ?? "", /no typing activity/i);

    // 7e: Non-integer count fields rejected
    const nonIntegerResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-inconsistent",
      window: {
        timestamp: now,
        charsTyped: 12.5, // non-integer count
        wordsTyped: 2,
        backspaces: 0,
        errorCount: 0,
        pauseMs: 0,
        durationMs: 5000,
      },
      selfReport: { emotion: "neutral", reportTimestamp: now },
    });
    assert.equal(nonIntegerResult.accepted, false);
    assert.match(nonIntegerResult.reason ?? "", /must be an integer/i);

    // 7f: Inconsistent: errorCount cannot exceed total keystrokes (charsTyped + backspaces)
    const excessiveErrorsResult = await recordResearchSample({
      userId: testUserId,
      sessionId: "session-inconsistent",
      window: {
        timestamp: now,
        charsTyped: 10,
        wordsTyped: 2,
        backspaces: 2,
        errorCount: 20, // 20 errors when only 12 total keystrokes occurred
        pauseMs: 0,
        durationMs: 5000,
      },
      selfReport: { emotion: "neutral", reportTimestamp: now },
    });
    assert.equal(excessiveErrorsResult.accepted, false);
    assert.match(excessiveErrorsResult.reason ?? "", /errorCount cannot exceed total keystrokes/i);
  });

  await t.test("8. Privacy verification: No raw text, keys, or file paths", () => {
    const features = computeAggregateFeatures({
      charsTyped: 80,
      wordsTyped: 16,
      backspaces: 3,
      errorCount: 1,
      pauseMs: 1200,
      durationMs: 25000,
    });

    const keys = Object.keys(features);
    assert.ok(keys.includes("typingSpeedWpm"));
    assert.ok(keys.includes("backspaceRatio"));
    assert.ok(keys.includes("errorRate"));
    assert.ok(keys.includes("pauseRatio"));

    for (const [k, v] of Object.entries(features)) {
      assert.equal(typeof v, "number", `Feature ${k} must be numerical`);
    }
  });

  await t.test("9. Consent withdrawal and data deletion (Right to Erasure)", async () => {
    const pid = pseudonymizeParticipantId(testUserId);
    const beforeCount = (db.data.researchSamples ?? []).filter(
      (s) => s.participantId === pid,
    ).length;
    assert.ok(beforeCount >= 1, "Expected at least 1 sample stored before deletion");

    const deleteResult = await deleteUserResearchData(testUserId);
    assert.equal(deleteResult.deletedCount, beforeCount);
    assert.equal(deleteResult.participantId, pid);

    const remaining = (db.data.researchSamples ?? []).filter(
      (s) => s.participantId === pid,
    );
    assert.equal(remaining.length, 0);
    assert.equal(testUser.researchConsent?.optedIn, false);
  });

  await t.test("10. Authorization checks on consent and deletion endpoints", async () => {
    // Helper to simulate router route execution
    const findRouteHandler = (pathRegex: RegExp, method: string) => {
      const layer = apiRouter.stack.find(
        (l) => l.route && pathRegex.test(l.route.path) && l.route.methods[method],
      );
      if (!layer) throw new Error(`Route not found for ${method} ${pathRegex}`);
      return layer.route.stack[0].handle;
    };

    const consentHandler = findRouteHandler(/\/users\/:userId\/consent/, "patch");
    const deletionHandler = findRouteHandler(/\/users\/:userId\/research-data/, "delete");

    const createMockRes = () => {
      const res: any = {
        statusCode: 200,
        body: null,
        status(code: number) {
          res.statusCode = code;
          return res;
        },
        json(data: any) {
          res.body = data;
          return res;
        },
      };
      return res;
    };

    // 10a: Unauthorized consent update without Authorization header -> 401
    const reqNoHeader = {
      params: { userId: testUserId },
      headers: {},
      body: { optedIn: true },
    };
    const resNoHeader = createMockRes();
    await consentHandler(reqNoHeader, resNoHeader);
    assert.equal(resNoHeader.statusCode, 401);
    assert.match(resNoHeader.body.error, /Missing Authorization bearer token header/i);

    // 10b: Unauthorized consent update with malformed Authorization header -> 401
    const reqMalformed = {
      params: { userId: testUserId },
      headers: { authorization: "Basic not-bearer-token" },
      body: { optedIn: true },
    };
    const resMalformed = createMockRes();
    await consentHandler(reqMalformed, resMalformed);
    assert.equal(resMalformed.statusCode, 401);
    assert.match(resMalformed.body.error, /Expected 'Bearer <token>'/i);

    // 10c: Unauthorized consent update with invalid/non-existent bearer token -> 401
    const reqInvalid = {
      params: { userId: testUserId },
      headers: { authorization: "Bearer tf_sec_nonexistent_token_12345" },
      body: { optedIn: true },
    };
    const resInvalid = createMockRes();
    await consentHandler(reqInvalid, resInvalid);
    assert.equal(resInvalid.statusCode, 401);
    assert.match(resInvalid.body.error, /Invalid or revoked bearer token/i);

    // 10d: Unauthorized consent update with revoked bearer token -> 401
    const { token: revokedToken, link: revokedLink } = createTestAuthToken(testUserId);
    revokedLink.revokedAt = new Date().toISOString();
    const reqRevoked = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${revokedToken}` },
      body: { optedIn: true },
    };
    const resRevoked = createMockRes();
    await consentHandler(reqRevoked, resRevoked);
    assert.equal(resRevoked.statusCode, 401);
    assert.match(resRevoked.body.error, /Invalid or revoked bearer token/i);

    // 10e: Forbidden consent update when caller's token belongs to a different user -> 403
    const attackerUserId = "attacker-user-" + Date.now();
    const { token: attackerToken } = createTestAuthToken(attackerUserId);
    const reqMismatched = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${attackerToken}` },
      body: { optedIn: true },
    };
    const resMismatched = createMockRes();
    await consentHandler(reqMismatched, resMismatched);
    assert.equal(resMismatched.statusCode, 403);
    assert.match(resMismatched.body.error, /not authorized for target user resource/i);

    // 10f: Authorized consent update when caller's token matches target user -> 200
    const { token: validToken } = createTestAuthToken(testUserId);
    const reqAuthorized = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${validToken}` },
      body: { optedIn: true },
    };
    const resAuthorized = createMockRes();
    await consentHandler(reqAuthorized, resAuthorized);
    assert.equal(resAuthorized.statusCode, 200);
    assert.equal(resAuthorized.body.researchConsent.optedIn, true);

    // 10g: Unauthorized deletion without Authorization header -> 401
    const delNoHeaderReq = {
      params: { userId: testUserId },
      headers: {},
    };
    const delNoHeaderRes = createMockRes();
    await deletionHandler(delNoHeaderReq, delNoHeaderRes);
    assert.equal(delNoHeaderRes.statusCode, 401);

    // 10h: Forbidden deletion when caller token belongs to different user -> 403
    const delMismatchedReq = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${attackerToken}` },
    };
    const delMismatchedRes = createMockRes();
    await deletionHandler(delMismatchedReq, delMismatchedRes);
    assert.equal(delMismatchedRes.statusCode, 403);

    // 10i: Deletion on non-existent user returns 404
    const nonExistentUserId = "non-existent-user-" + Date.now();
    const { token: nonExistentToken } = createTestAuthToken(nonExistentUserId);
    const delNonExistentReq = {
      params: { userId: nonExistentUserId },
      headers: { authorization: `Bearer ${nonExistentToken}` },
    };
    const delNonExistentRes = createMockRes();
    await deletionHandler(delNonExistentReq, delNonExistentRes);
    assert.equal(delNonExistentRes.statusCode, 404);
    assert.match(delNonExistentRes.body.error, /User not found/i);

    // 10j: Authorized deletion when caller matches target user -> 200, no participantId returned
    const delAuthorizedReq = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${validToken}` },
    };
    const delAuthorizedRes = createMockRes();
    await deletionHandler(delAuthorizedReq, delAuthorizedRes);
    assert.equal(delAuthorizedRes.statusCode, 200);
    assert.equal(delAuthorizedRes.body.ok, true);
    assert.equal(delAuthorizedRes.body.participantId, undefined, "participantId must not be exposed in deletion response");
  });

  await t.test("11. Dataset statistics reporting & bearer token authorization", async () => {
    // 11a: Direct service invocation returns statistics
    const stats = getResearchDatasetStats();
    assert.equal(typeof stats.totalSamples, "number");
    assert.equal(typeof stats.participantCount, "number");
    assert.ok("frustration" in stats.classDistribution);
    assert.ok("confidence" in stats.classDistribution);
    assert.ok("neutral" in stats.classDistribution);

    // Helper to find route handler
    const findRouteHandler = (pathRegex: RegExp, method: string) => {
      const layer = apiRouter.stack.find(
        (l) => l.route && pathRegex.test(l.route.path) && l.route.methods[method],
      );
      if (!layer) throw new Error(`Route not found for ${method} ${pathRegex}`);
      return layer.route.stack[0].handle;
    };

    const statsHandler = findRouteHandler(/\/research\/stats/, "get");
    const createMockRes = () => {
      const res: any = {
        statusCode: 200,
        body: null,
        status(code: number) {
          res.statusCode = code;
          return res;
        },
        json(data: any) {
          res.body = data;
          return res;
        },
      };
      return res;
    };

    // 11b: Missing authorization header -> 401
    const reqNoAuth = { headers: {} };
    const resNoAuth = createMockRes();
    await statsHandler(reqNoAuth, resNoAuth);
    assert.equal(resNoAuth.statusCode, 401);
    assert.match(resNoAuth.body.error, /Missing Authorization bearer token header/i);

    // 11c: Invalid / malformed bearer token -> 401
    const reqInvalid = { headers: { authorization: "Bearer invalid-token-xyz" } };
    const resInvalid = createMockRes();
    await statsHandler(reqInvalid, resInvalid);
    assert.equal(resInvalid.statusCode, 401);
    assert.match(resInvalid.body.error, /Invalid or revoked bearer token/i);

    // 11d: Revoked bearer token -> 401
    const { token: revokedToken, link: revokedLink } = createTestAuthToken(testUserId);
    revokedLink.revokedAt = new Date().toISOString();
    const reqRevoked = { headers: { authorization: `Bearer ${revokedToken}` } };
    const resRevoked = createMockRes();
    await statsHandler(reqRevoked, resRevoked);
    assert.equal(resRevoked.statusCode, 401);
    assert.match(resRevoked.body.error, /Invalid or revoked bearer token/i);

    // 11e: Valid bearer token -> 200 with dataset stats
    const { token: validToken } = createTestAuthToken(testUserId);
    const reqValid = { headers: { authorization: `Bearer ${validToken}` } };
    const resValid = createMockRes();
    await statsHandler(reqValid, resValid);
    assert.equal(resValid.statusCode, 200);
    assert.equal(typeof resValid.body.totalSamples, "number");
    assert.equal(typeof resValid.body.participantCount, "number");
    assert.ok("classDistribution" in resValid.body);
  });

  await t.test("12. Existing rule-based emotion engine preserved with confident support", () => {
    const fusedConfident = fuseMoodSignals({
      manualMood: "confident",
      manualEnergy: 9,
      aiSignal: "confidence",
      latestVibeScore: 85,
    });
    assert.equal(fusedConfident.fusedMood, "confident");
    assert.equal(fusedConfident.confidence, 0.93);

    const fusedFrustrated = fuseMoodSignals({
      manualMood: "frustrated",
      manualEnergy: 3,
      aiSignal: "frustration",
      latestVibeScore: 30,
    });
    assert.equal(fusedFrustrated.fusedMood, "frustrated");
  });

  await t.test("13. Extension research sample endpoint wiring and consent flow", async () => {
    const findRouteHandler = (pathRegex: RegExp, method: string) => {
      const layer = apiRouter.stack.find(
        (l) => l.route && pathRegex.test(l.route.path) && l.route.methods[method],
      );
      if (!layer) throw new Error(`Route not found for ${method} ${pathRegex}`);
      return layer.route.stack[0].handle;
    };

    const sampleHandler = findRouteHandler(/\/research\/samples/, "post");
    const consentHandler = findRouteHandler(/\/users\/:userId\/consent/, "patch");
    const deletionHandler = findRouteHandler(/\/users\/:userId\/research-data/, "delete");

    const createMockRes = () => {
      const res: any = {
        statusCode: 200,
        body: null,
        status(code: number) {
          res.statusCode = code;
          return res;
        },
        json(data: any) {
          res.body = data;
          return res;
        },
      };
      return res;
    };

    const now = Date.now();
    const windowEndIso = new Date(now).toISOString();
    const reportIso = new Date(now + 2000).toISOString();

    const samplePayload = {
      userId: testUserId,
      sessionId: "session-wire-test",
      window: {
        timestamp: windowEndIso,
        charsTyped: 150,
        wordsTyped: 30,
        backspaces: 5,
        errorCount: 1,
        pauseMs: 2000,
        durationMs: 35000,
      },
      selfReport: {
        emotion: "frustrated" as const,
        energy: 4,
        reportTimestamp: reportIso,
      },
    };

    // 13a: Missing Authorization header -> 401
    const reqNoHeader = { headers: {}, body: samplePayload };
    const resNoHeader = createMockRes();
    await sampleHandler(reqNoHeader, resNoHeader);
    assert.equal(resNoHeader.statusCode, 401);
    assert.match(resNoHeader.body.error, /Missing Authorization bearer token header/i);

    // 13b: Invalid bearer token -> 401
    const reqInvalid = {
      headers: { authorization: "Bearer invalid-sample-token" },
      body: samplePayload,
    };
    const resInvalid = createMockRes();
    await sampleHandler(reqInvalid, resInvalid);
    assert.equal(resInvalid.statusCode, 401);
    assert.match(resInvalid.body.error, /Invalid or revoked bearer token/i);

    // 13c: Mismatched bearer token (token for other user) -> 403
    const attackerUserId = "attacker-sample-" + Date.now();
    const { token: attackerToken } = createTestAuthToken(attackerUserId);
    const reqMismatched = {
      headers: { authorization: `Bearer ${attackerToken}` },
      body: samplePayload,
    };
    const resMismatched = createMockRes();
    await sampleHandler(reqMismatched, resMismatched);
    assert.equal(resMismatched.statusCode, 403);
    assert.match(resMismatched.body.error, /not authorized for target user resource/i);

    // 13d: Rejected when user is currently opted out
    const { token: validToken } = createTestAuthToken(testUserId);
    await updateUserResearchConsent(testUserId, false);
    const reqOptedOut = {
      headers: { authorization: `Bearer ${validToken}` },
      body: samplePayload,
    };
    const resOptedOut = createMockRes();
    await sampleHandler(reqOptedOut, resOptedOut);
    assert.equal(resOptedOut.statusCode, 400);
    assert.match(resOptedOut.body.error, /consent is not granted/);

    // 13e: Opt-in via PATCH /users/:userId/consent with valid bearer token -> 200
    const reqOptIn = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${validToken}` },
      body: { optedIn: true },
    };
    const resOptIn = createMockRes();
    await consentHandler(reqOptIn, resOptIn);
    assert.equal(resOptIn.statusCode, 200);
    assert.equal(resOptIn.body.researchConsent.optedIn, true);

    // 13f: Successfully submit research sample when opted in -> 201
    const reqValid = {
      headers: { authorization: `Bearer ${validToken}` },
      body: samplePayload,
    };
    const resValid = createMockRes();
    await sampleHandler(reqValid, resValid);
    assert.equal(resValid.statusCode, 201);
    assert.equal(resValid.body.accepted, true);
    assert.ok(resValid.body.sample);
    assert.equal(resValid.body.sample.label.selfReportedEmotion, "frustrated");
    assert.equal(resValid.body.sample.label.targetClass, "frustration");

    // 13g: Deletion via DELETE /users/:userId/research-data erases all samples
    const reqDel = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${validToken}` },
    };
    const resDel = createMockRes();
    await deletionHandler(reqDel, resDel);
    assert.equal(resDel.statusCode, 200);
    assert.ok(resDel.body.deletedCount >= 1);

    // Check user is opted out after deletion
    const refreshedUser = db.data.users.find((u) => u.id === testUserId);
    assert.equal(refreshedUser?.researchConsent?.optedIn, false);
  });

  await t.test("14. Strict isolation between operational extension telemetry and research samples", async () => {
    const findRouteHandler = (pathRegex: RegExp, method: string) => {
      const layer = apiRouter.stack.find(
        (l) => l.route && pathRegex.test(l.route.path) && l.route.methods[method],
      );
      if (!layer) throw new Error(`Route not found for ${method} ${pathRegex}`);
      return layer.route.stack[0].handle;
    };

    const operationalHandler = findRouteHandler(/\/extension\/events\/typing/, "post");

    const createMockRes = () => {
      const res: any = {
        statusCode: 200,
        body: null,
        status(code: number) {
          res.statusCode = code;
          return res;
        },
        json(data: any) {
          res.body = data;
          return res;
        },
      };
      return res;
    };

    const beforeResearchCount = db.data.researchSamples?.length ?? 0;

    const opReq = {
      headers: {},
      body: {
        userId: testUserId,
        charsTyped: 120,
        wordsTyped: 24,
        backspaces: 2,
        errorCount: 0,
        pauseMs: 1500,
        durationMs: 25000,
      },
    };
    const opRes = createMockRes();
    await operationalHandler(opReq, opRes);

    assert.equal(opRes.statusCode, 201);
    assert.ok("adaptiveMode" in opRes.body);
    assert.ok("vibeScore" in opRes.body);

    // Verify operational telemetry did NOT add anything to researchSamples
    const afterResearchCount = db.data.researchSamples?.length ?? 0;
    assert.equal(afterResearchCount, beforeResearchCount, "Operational telemetry must not pollute research dataset");
  });

  await t.test("15. Extension linking, secure token issuance, and revocation", async () => {
    const findRouteHandler = (pathRegex: RegExp, method: string) => {
      const layer = apiRouter.stack.find(
        (l) => l.route && pathRegex.test(l.route.path) && l.route.methods[method],
      );
      if (!layer) throw new Error(`Route not found for ${method} ${pathRegex}`);
      return layer.route.stack[0].handle;
    };

    const linkHandler = findRouteHandler(/\/extension\/link/, "post");
    const revokeHandler = findRouteHandler(/\/extension\/revoke/, "post");
    const consentHandler = findRouteHandler(/\/users\/:userId\/consent/, "patch");

    const createMockRes = () => {
      const res: any = {
        statusCode: 200,
        body: null,
        status(code: number) {
          res.statusCode = code;
          return res;
        },
        json(data: any) {
          res.body = data;
          return res;
        },
      };
      return res;
    };

    // 15a: Initial link creation issues secure token and stores only hash
    const linkReq1 = {
      body: {
        userId: testUserId,
        installId: "install-test-15a",
        ide: "vscode",
      },
    };
    const linkRes1 = createMockRes();
    await linkHandler(linkReq1, linkRes1);
    assert.equal(linkRes1.statusCode, 201);
    assert.ok(linkRes1.body.token, "Link response must issue raw token to client");
    assert.match(linkRes1.body.token, /^tf_sec_[0-9a-f]{64}$/, "Token must follow cryptographically secure format");

    const token1 = linkRes1.body.token;
    const tokenHash1 = crypto.createHash("sha256").update(token1).digest("hex");

    const storedLink1 = db.data.extensionLinks?.find((l) => l.id === linkRes1.body.id);
    assert.ok(storedLink1, "Link must be stored in database");
    assert.equal(storedLink1.tokenHash, tokenHash1, "Stored tokenHash must match SHA-256 of token");
    assert.equal(
      (storedLink1 as any).token,
      undefined,
      "Raw token must NEVER be stored in the database",
    );

    // 15b: Re-linking same user and installId revokes the previous link
    const linkReq2 = {
      body: {
        userId: testUserId,
        installId: "install-test-15a",
        ide: "vscode",
      },
    };
    const linkRes2 = createMockRes();
    await linkHandler(linkReq2, linkRes2);
    assert.equal(linkRes2.statusCode, 201);
    assert.ok(linkRes2.body.token);

    // Stored link 1 should now be marked revoked
    assert.ok(storedLink1?.revokedAt, "Previous link must be revoked upon re-linking");

    // Using old token 1 must now be rejected
    const reqOldToken = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${token1}` },
      body: { optedIn: true },
    };
    const resOldToken = createMockRes();
    await consentHandler(reqOldToken, resOldToken);
    assert.equal(resOldToken.statusCode, 401);
    assert.match(resOldToken.body.error, /Invalid or revoked bearer token/i);

    // Using new token 2 succeeds
    const token2 = linkRes2.body.token;
    const reqNewToken = {
      params: { userId: testUserId },
      headers: { authorization: `Bearer ${token2}` },
      body: { optedIn: true },
    };
    const resNewToken = createMockRes();
    await consentHandler(reqNewToken, resNewToken);
    assert.equal(resNewToken.statusCode, 200);

    // 15c: Revoking an active token via /extension/revoke
    const revokeReq = {
      headers: { authorization: `Bearer ${token2}` },
    };
    const revokeRes = createMockRes();
    await revokeHandler(revokeReq, revokeRes);
    assert.equal(revokeRes.statusCode, 200);
    assert.equal(revokeRes.body.revoked, true);

    // Now token 2 is also rejected
    const resAfterRevoke = createMockRes();
    await consentHandler(reqNewToken, resAfterRevoke);
    assert.equal(resAfterRevoke.statusCode, 401);
    assert.match(resAfterRevoke.body.error, /Invalid or revoked bearer token/i);
  });

  await t.test("16. Local development server host binding and CORS restriction configuration", () => {
    // 16a: Default host binds to 127.0.0.1 (not 0.0.0.0)
    assert.equal(config.host, "127.0.0.1", "Dev server host must bind to 127.0.0.1 by default");

    // 16b: CORS allowed origins restricted to approved local dev origins
    assert.ok(
      config.corsOrigins.includes("http://localhost:5173"),
      "CORS must allow http://localhost:5173",
    );
    assert.ok(
      config.corsOrigins.includes("http://127.0.0.1:5173"),
      "CORS must allow http://127.0.0.1:5173",
    );

    // 16c: Disallowed origins rejected
    assert.equal(
      config.corsOrigins.includes("http://evil-site.com"),
      false,
      "CORS must not allow arbitrary origins",
    );
    assert.equal(
      config.corsOrigins.includes("http://localhost:3000"),
      false,
      "CORS must not allow arbitrary ports without FRONTEND_URL",
    );
  });

  await t.test("17. HTTP integration test through actual Express CORS middleware", async () => {
    const app = createApp();
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 17a: Preflight OPTIONS request with allowed origin http://localhost:5173
      const preflightLocalhost = await fetch(`${baseUrl}/api/v1/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });
      assert.ok(
        preflightLocalhost.status === 200 || preflightLocalhost.status === 204,
        "Preflight OPTIONS for localhost:5173 must return 200 or 204",
      );
      assert.equal(
        preflightLocalhost.headers.get("access-control-allow-origin"),
        "http://localhost:5173",
        "Preflight must allow http://localhost:5173",
      );

      // 17b: Preflight OPTIONS request with allowed origin http://127.0.0.1:5173
      const preflightLoopback = await fetch(`${baseUrl}/api/v1/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://127.0.0.1:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });
      assert.ok(
        preflightLoopback.status === 200 || preflightLoopback.status === 204,
        "Preflight OPTIONS for 127.0.0.1:5173 must return 200 or 204",
      );
      assert.equal(
        preflightLoopback.headers.get("access-control-allow-origin"),
        "http://127.0.0.1:5173",
        "Preflight must allow http://127.0.0.1:5173",
      );

      // 17c: Preflight OPTIONS request with disallowed origin https://evil-site.com
      const preflightEvil = await fetch(`${baseUrl}/api/v1/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil-site.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });
      assert.equal(
        preflightEvil.headers.get("access-control-allow-origin"),
        null,
        "Preflight with https://evil-site.com must NOT receive an Access-Control-Allow-Origin header",
      );

      // 17d: Actual GET request with allowed origin http://localhost:5173
      const actualLocalhost = await fetch(`${baseUrl}/`, {
        method: "GET",
        headers: {
          Origin: "http://localhost:5173",
        },
      });
      assert.equal(actualLocalhost.status, 200);
      assert.equal(
        actualLocalhost.headers.get("access-control-allow-origin"),
        "http://localhost:5173",
        "Actual request must allow http://localhost:5173",
      );

      // 17e: Actual GET request with allowed origin http://127.0.0.1:5173
      const actualLoopback = await fetch(`${baseUrl}/`, {
        method: "GET",
        headers: {
          Origin: "http://127.0.0.1:5173",
        },
      });
      assert.equal(actualLoopback.status, 200);
      assert.equal(
        actualLoopback.headers.get("access-control-allow-origin"),
        "http://127.0.0.1:5173",
        "Actual request must allow http://127.0.0.1:5173",
      );

      // 17f: Actual GET request with disallowed origin https://evil-site.com
      const actualEvil = await fetch(`${baseUrl}/`, {
        method: "GET",
        headers: {
          Origin: "https://evil-site.com",
        },
      });
      assert.equal(
        actualEvil.headers.get("access-control-allow-origin"),
        null,
        "Actual request with https://evil-site.com must NOT receive an Access-Control-Allow-Origin header",
      );
      assert.equal(
        actualEvil.status,
        500,
        "Actual request from untrusted origin must be rejected by CORS middleware",
      );
      const evilBody = (await actualEvil.json()) as { error?: string };
      assert.match(
        evilBody.error ?? "",
        /CORS blocked: Origin 'https:\/\/evil-site\.com' is not allowed/i,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
