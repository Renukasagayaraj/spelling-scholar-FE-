// Mock fallbacks used when the backend is unreachable (e.g. local preview
// without the API server running). These let you exercise the full UI —
// "Hear the Word", coaching feedback sections, etc. — without OpenAI access.

import type { CoachingRequest, CoachingResponse, WordData, NextWordParams } from "./api";

const WORDS_BY_LEVEL: Record<number, WordData[]> = {
  1: [
    { word: "friend", level: "1", gradeBand: "K-2", difficulty: "easy", origin: "Old English 'freond', meaning one who loves.", definition: "A person you like and trust.", exampleSentence: "My best friend came to my birthday party.", partOfSpeech: "noun", pronunciation: "frend", patterns: ["silent i"] },
    { word: "because", level: "1", gradeBand: "K-2", difficulty: "easy", origin: "Middle English, from 'by cause'.", definition: "For the reason that.", exampleSentence: "I stayed home because it was raining.", partOfSpeech: "conjunction", pronunciation: "bih-KAWZ", patterns: ["-ause ending"] },
  ],
  2: [
    { word: "rhythm", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Greek 'rhythmos', meaning measured flow.", definition: "A regular repeated pattern of sound or movement.", exampleSentence: "The drummer kept a steady rhythm.", partOfSpeech: "noun", pronunciation: "RITH-uhm", patterns: ["Greek rh-", "silent vowel"] },
    { word: "necessary", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Latin 'necessarius', meaning unavoidable.", definition: "Needed; required.", exampleSentence: "Sleep is necessary for good health.", partOfSpeech: "adjective", pronunciation: "NES-uh-ser-ee", patterns: ["one c, double s"] },
  ],
  3: [
    { word: "onomatopoeia", level: "3", gradeBand: "6-8", difficulty: "hard", origin: "Greek 'onomatopoiia', meaning word-making.", definition: "A word that imitates the sound it represents, like 'buzz' or 'sizzle'.", exampleSentence: "'Bang!' is a classic example of onomatopoeia.", partOfSpeech: "noun", pronunciation: "on-uh-mat-uh-PEE-uh", patterns: ["Greek poeia"] },
    { word: "conscientious", level: "3", gradeBand: "6-8", difficulty: "hard", origin: "Latin 'conscientia', meaning awareness.", definition: "Careful and thorough; guided by conscience.", exampleSentence: "She is a conscientious student who checks her work.", partOfSpeech: "adjective", pronunciation: "kon-shee-EN-shuhs", patterns: ["sci = sh", "-tious"] },
  ],
};

let pickIndex = 0;

export function mockNextWord(params: NextWordParams): WordData {
  const lvl = params.level && WORDS_BY_LEVEL[params.level] ? params.level : 2;
  const pool = WORDS_BY_LEVEL[lvl];
  const w = pool[pickIndex % pool.length];
  pickIndex++;
  // Override for foreign origin / custom modes so the chip still makes sense
  if (params.foreignOrigin) {
    return { ...w, origin: `${params.foreignOrigin} origin (mock).` };
  }
  return w;
}

export function mockCoaching(req: CoachingRequest): CoachingResponse {
  const target = req.targetWord.toLowerCase();
  const attempt = req.childAttempt.toLowerCase();
  const isCorrect = target === attempt;

  // Build a naive chunking: split into 2-3 char chunks for display.
  const chunks: string[] = [];
  for (let i = 0; i < target.length; i += 3) chunks.push(target.slice(i, i + 3));

  return {
    correctness: { isCorrect, reinforceSuccess: isCorrect },
    missAnalysis: {
      summary: isCorrect
        ? "Spelled perfectly on the first try."
        : `You wrote "${attempt}" but the word is "${target}". The middle letters tripped you up.`,
      errorTypes: isCorrect ? [] : ["vowel substitution", "missing letter"],
      primaryErrorFocus: isCorrect ? "" : "Listen for every syllable before writing.",
      likelyWrongWordInterpretation: false,
      usedMeaningDisambiguationWell: true,
    },
    wordTeaching: {
      formTeaching: {
        summary: `"${target}" follows a predictable pattern once you see the chunks.`,
        patterns: ["common ending", "stressed first syllable"],
        chunks,
        chunkReason: "Breaking the word into syllable-sized pieces makes it easier to remember.",
        sayAloudFocus: "Say each chunk slowly, then blend them together.",
      },
      conceptTeaching: {
        summary: `"${target}" comes from older roots that explain its spelling.`,
        meaningFocus: "Connect the meaning to how the word sounds.",
        originFocus: "Knowing the origin reveals why certain letters appear.",
        morphologyFocus: "Look for prefixes, roots, and suffixes you already know.",
        originLabels: ["Latin", "Greek"],
        morphologyLabels: ["root", "suffix"],
      },
    },
    errorRelevance: {
      mostRelevantToError: isCorrect ? "form" : "form",
      confidence: 0.82,
      reason: "The error is mostly about letter patterns, not meaning.",
    },
    teachingDecision: {
      strategy: "chunk-and-blend",
      primaryFocus: "syllable awareness",
      secondaryFocuses: ["spelling pattern recognition"],
      confidence: 0.78,
      rationale: "Mock rationale for preview.",
    },
    coachingText: {
      shortFeedback: isCorrect
        ? "Nice work — that's exactly right!"
        : "Close! Let's look at where it slipped.",
      fullExplanation: isCorrect
        ? `You spelled "${target}" correctly. Notice how the chunks ${chunks.join(" + ")} fit together — that's the pattern to remember.`
        : `The target word is "${target}". Break it into ${chunks.join(" + ")} and say each chunk aloud. The tricky part is usually the unstressed vowel in the middle.`,
      memoryTip: `Picture the chunks ${chunks.join("-")} stacked like LEGO bricks.`,
      sayAloudTip: "Whisper each chunk, then say the whole word at normal speed.",
    },
    wordBreakdown: {
      displayChunks: chunks,
      chunkReason: "Each chunk is one syllable or a meaningful spelling unit.",
      matchedPatterns: [
        { label: "double consonant", matchedText: target.length > 2 ? target.slice(0, 2) : target },
        { label: "syllable split", matchedParts: chunks.slice(0, 2) },
      ],
    },
    conceptLabels: {
      originLabels: ["Latin"],
      patternLabels: ["vowel team", "consonant blend"],
      morphologyLabels: ["suffix -ion"],
    },
    nextStep: {
      practiceFocus: isCorrect
        ? "Try a harder word with a similar pattern."
        : "Practice 2-3 more words with the same vowel pattern.",
      shouldReviewSoon: !isCorrect,
      suggestedSimilarWordTypes: ["multi-syllable", "Latin-origin"],
    },
  };
}

// Plays the word using the browser's SpeechSynthesis API and returns an
// object URL pointing to a tiny silent WAV (so the existing `new Audio(url)`
// playback in the page doesn't error).
const SILENT_WAV_BASE64 =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function mockPronunciationAudio(word: string): string {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    }
  } catch {
    // ignore — fall through to silent audio
  }
  const bytes = Uint8Array.from(atob(SILENT_WAV_BASE64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}
