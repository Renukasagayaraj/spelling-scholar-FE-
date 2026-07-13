const PENDING_PRACTICE_RESUME_MODE_KEY = "pending_practice_resume_mode";
const PENDING_MOCK_BEE_RESUME_KEY = "pending_mock_bee_resume";

export function queuePracticeResumeMode(mode: string) {
  localStorage.setItem(PENDING_PRACTICE_RESUME_MODE_KEY, mode);
}

export function takePracticeResumeMode(): string | null {
  const value = localStorage.getItem(PENDING_PRACTICE_RESUME_MODE_KEY);
  if (!value) return null;
  localStorage.removeItem(PENDING_PRACTICE_RESUME_MODE_KEY);
  return value;
}

export function queueMockBeeResume() {
  localStorage.setItem(PENDING_MOCK_BEE_RESUME_KEY, "1");
}

export function takeMockBeeResume(): boolean {
  const value = localStorage.getItem(PENDING_MOCK_BEE_RESUME_KEY);
  if (!value) return false;
  localStorage.removeItem(PENDING_MOCK_BEE_RESUME_KEY);
  return true;
}

export function formatSessionModeLabel(mode: string): string {
  if (mode === "mock_bee") {
    return "Mock Bee";
  }

  if (mode.startsWith("standard_level_")) {
    const level = mode.replace("standard_level_", "");
    return `Standard Practice (Level ${level})`;
  }

  if (mode.startsWith("custom_list_")) {
    return "Custom Practice";
  }

  if (mode.startsWith("foreign_origin_")) {
    const origin = mode.replace("foreign_origin_", "").replace(/_/g, " ");
    return `Language Origin (${origin})`;
  }

  if (mode === "custom") {
    return "Custom Practice";
  }

  if (mode === "foreign_origin") {
    return "Language Origin Practice";
  }

  return mode.replace(/_/g, " ");
}
