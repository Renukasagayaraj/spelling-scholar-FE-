import type { CoachingResponse, DbWordAttempt } from "@/lib/api";

function isCoachingResponse(value: unknown): value is CoachingResponse {
  if (!value || typeof value !== "object") return false;

  const coaching = value as Partial<CoachingResponse>;
  return Boolean(coaching.correctness && coaching.coachingText && coaching.wordTeaching);
}

export function parseStoredCoaching(attempt: DbWordAttempt): CoachingResponse {
  const storedCoaching = attempt.coaching_response;
  let shortFeedback = "";

  if (isCoachingResponse(storedCoaching)) {
    return storedCoaching;
  }

  if (typeof storedCoaching === "string") {
    shortFeedback = storedCoaching.trim();
    try {
      const parsed = JSON.parse(storedCoaching) as unknown;
      if (typeof parsed === "string") {
        shortFeedback = parsed.trim();
      } else if (isCoachingResponse(parsed)) {
        return parsed;
      }
    } catch {
      // Legacy attempts stored short feedback as plain text rather than JSON.
    }
  }

  return {
    correctness: { isCorrect: attempt.is_correct, reinforceSuccess: true },
    missAnalysis: {
      summary: "",
      primaryErrorType: null,
      secondaryErrorTypes: [],
      errorTypeEvidence: {},
      primaryErrorFocus: "",
      likelyWrongWordInterpretation: false,
      usedMeaningDisambiguationWell: false,
    },
    wordTeaching: {
      formTeaching: {
        summary: "",
        patterns: [],
        chunks: [],
        chunkReason: "",
        sayAloudFocus: "",
      },
      conceptTeaching: {
        summary: "",
        meaningFocus: "",
        originFocus: "",
        morphologyFocus: "",
        originLabels: [],
        morphologyLabels: [],
      },
    },
    errorRelevance: { mostRelevantToError: "", confidence: 0, reason: "" },
    teachingDecision: {
      strategy: "",
      primaryFocus: "",
      secondaryFocuses: [],
      confidence: 0,
      rationale: "",
    },
    coachingText: {
      shortFeedback,
      fullExplanation: "",
      memoryTip: "",
      sayAloudTip: "",
    },
    wordBreakdown: { displayChunks: [], chunkReason: "", matchedPatterns: [] },
    conceptLabels: { originLabels: [], patternLabels: [], morphologyLabels: [] },
    nextStep: {
      practiceFocus: "",
      shouldReviewSoon: !attempt.is_correct,
      suggestedSimilarWordTypes: [],
    },
  };
}
