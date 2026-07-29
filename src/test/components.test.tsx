import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooleanStatusRow } from "@/components/BooleanStatusRow";
import { LabelChips } from "@/components/LabelChips";
import { MatchedPatternChips } from "@/components/MatchedPatternChips";
import { WordBreakdownChips } from "@/components/WordBreakdownChips";
import { PracticeModeSwitch } from "@/components/PracticeModeSwitch";
import { LevelSelector } from "@/components/LevelSelector";
import { SupportCard } from "@/components/SupportCard";
import { ConceptTeachingContent, FormTeachingContent, TeachingCard } from "@/components/TeachingCard";
import { RewardsStrip } from "@/components/RewardsStrip";
import { LevelUpFlash } from "@/components/LevelUpFlash";
import { NavLink } from "@/components/NavLink";
import { DebugPanel } from "@/components/DebugPanel";
import { CoachingResult } from "@/components/CoachingResult";
import { ThemePicker } from "@/components/ThemePicker";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionHistorySidebar } from "@/components/SessionHistorySidebar";
import { SessionHistoryPanel } from "@/components/SessionHistoryPanel";
import { DinoDecor } from "@/components/DinoDecor";
import { mockCoaching } from "@/lib/mocks";

const report = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/lib/sessionReport", () => ({ downloadSessionReport: report.download }));

const word = {
  word: "rhythm", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Greek",
  definition: "A repeated pattern.", exampleSentence: "Keep the rhythm.", partOfSpeech: "noun",
  pronunciation: "RITH-um", patterns: ["rh"],
};
const request = {
  targetWord: "rhythm", childAttempt: "rythm", level: 2, mode: "standard",
  definitionViewed: true, exampleViewed: false, originViewed: false, partOfSpeechViewed: false,
  repeatWordCount: 0, usedVoiceInput: false,
};

describe("presentational components", () => {
  it("renders boolean statuses, label variants, and pattern details", () => {
    const { container } = render(<>
      <BooleanStatusRow items={[{ label: "Enabled", value: true }, { label: "Disabled", value: false }]} className="custom" />
      <LabelChips labels={["Latin"]} title="Origin" />
      <LabelChips labels={["suffix"]} variant="accent" />
      <LabelChips labels={["warm"]} variant="warm" />
      <MatchedPatternChips title="Patterns" patterns={[
        { label: "split", matchedParts: ["rhy", "thm"] },
        { label: "letters", matchedText: "rh" },
        { label: "no detail" },
      ]} />
    </>);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("rhy + thm")).toBeInTheDocument();
    expect(screen.getByText("rh")).toBeInTheDocument();
    expect(container.querySelector(".custom")).toBeInTheDocument();
  });

  it("returns nothing for empty labels, patterns, and chunks", () => {
    const { container } = render(<>
      <LabelChips labels={[]} />
      <MatchedPatternChips patterns={[]} />
      <WordBreakdownChips chunks={[]} reason="unused" />
    </>);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders word chunks with and without a reason", () => {
    const { rerender } = render(<WordBreakdownChips chunks={["rhy", "thm"]} reason="Split it" />);
    expect(screen.getByText("Split it")).toBeInTheDocument();
    rerender(<WordBreakdownChips chunks={["word"]} reason="" />);
    expect(screen.queryByText("Split it")).not.toBeInTheDocument();
  });

  it("switches practice modes and selects every level", () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<><PracticeModeSwitch mode="standard" onChange={onChange} /><LevelSelector selected={2} onSelect={onSelect} /></>);
    fireEvent.click(screen.getByRole("button", { name: "My Word Lists" }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 7/ }));
    expect(onChange).toHaveBeenCalledWith("custom");
    expect(onSelect.mock.calls.map(([level]) => level)).toEqual([1, 3]);
  });

  it("toggles all support card styles", () => {
    const toggle = vi.fn();
    const { rerender } = render(<SupportCard type="definition" content="Meaning" isOpen={false} onToggle={toggle} />);
    expect(screen.queryByText("Meaning")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Definition/ }));
    expect(toggle).toHaveBeenCalled();
    rerender(<SupportCard type="example" content="Sentence" isOpen onToggle={toggle} />);
    expect(screen.getByText("Sentence")).toBeInTheDocument();
    rerender(<SupportCard type="origin" content="Greek" isOpen onToggle={toggle} />);
    expect(screen.getByText("Greek")).toBeInTheDocument();
    rerender(<SupportCard type="partOfSpeech" content="noun" isOpen onToggle={toggle} />);
    expect(screen.getByText("noun")).toBeInTheDocument();
  });

  it("renders teaching cards for populated and empty concepts", () => {
    const { rerender } = render(<TeachingCard title="Teaching" icon={<span>icon</span>} className="extra">child</TeachingCard>);
    expect(screen.getByText("child")).toBeInTheDocument();
    rerender(<FormTeachingContent data={{ summary: "Summary", patterns: ["pattern"], chunks: ["chunk"], chunkReason: "Reason", sayAloudFocus: "Slowly" }} />);
    expect(screen.getByText("Slowly")).toBeInTheDocument();
    rerender(<ConceptTeachingContent data={{ summary: "", meaningFocus: "", originFocus: "", morphologyFocus: "", originLabels: [], morphologyLabels: [] }} />);
    expect(screen.getByText(/No strong concept clue/)).toBeInTheDocument();
    rerender(<ConceptTeachingContent data={{ summary: "Roots matter", meaningFocus: "", originFocus: "", morphologyFocus: "", originLabels: ["Greek"], morphologyLabels: ["root"], relatedForms: [] }} />);
    expect(screen.getByText("Roots matter")).toBeInTheDocument();
  });
});

describe("interactive display components", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows earned and locked rewards and clears a badge on schedule", () => {
    const clear = vi.fn();
    const badge = { id: "streak3", label: "On a Roll", emoji: "🔥", description: "3 in a row", check: () => true };
    const { rerender } = render(<RewardsStrip stats={{ streak: 3, bestStreak: 3, totalCorrect: 5, badges: ["streak3"] }} newBadge={badge} onClearNewBadge={clear} />);
    expect(screen.getByText("Badge unlocked")).toBeInTheDocument();
    expect(screen.getByTitle(/On a Roll/)).not.toHaveAttribute("title", expect.stringContaining("locked"));
    expect(screen.getByTitle(/Word Master/)).toHaveAttribute("title", expect.stringContaining("locked"));
    act(() => vi.advanceTimersByTime(3500));
    expect(clear).toHaveBeenCalled();
    rerender(<RewardsStrip stats={{ streak: 0, bestStreak: 0, totalCorrect: 0, badges: [] }} newBadge={null} onClearNewBadge={clear} />);
    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("shows and clears milestone flashes", () => {
    const done = vi.fn();
    const { rerender } = render(<LevelUpFlash streak={5} onDone={done} />);
    expect(screen.getByText("5 🔥")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1100));
    expect(done).toHaveBeenCalled();
    rerender(<LevelUpFlash streak={null} onDone={done} />);
  });

  it("combines active and inactive navigation classes", () => {
    render(<MemoryRouter initialEntries={["/active"]}><NavLink to="/active" className="base" activeClassName="active" pendingClassName="pending">Link</NavLink></MemoryRouter>);
    expect(screen.getByRole("link")).toHaveClass("base", "active");
  });

  it("opens debug data and includes all optional selections and response sections", () => {
    const response = mockCoaching(request);
    render(<DebugPanel
      level={2} wordData={word} supports={{ definitionViewed: true, exampleViewed: false, originViewed: false }} response={response}
      practiceMode="custom" selectedCustomList={{ id: "l1", name: "Homework", level: "2", wordCount: 3 }} customPracticeActive
      selectedForeignOrigin={{ origin: "Greek", wordCount: 2 }} selectedForeignOriginDetails={{ origin: "Greek", wordCount: 2, words: [word] }} foreignPracticeActive
    />);
    fireEvent.click(screen.getByRole("button", { name: /Show Debug/ }));
    expect(screen.getByText(/Homework/)).toBeInTheDocument();
    expect(screen.getByText(/Origin Preview Loaded/)).toBeInTheDocument();
    expect(screen.getByText("Full Raw Response:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hide Debug/ }));
    expect(screen.queryByText("Full Raw Response:")).not.toBeInTheDocument();
  });

  it("renders level-one and advanced coaching branches", () => {
    const incorrect = mockCoaching(request);
    const { rerender } = render(<CoachingResult result={incorrect} level={1} />);
    expect(screen.getByText("Not quite!")).toBeInTheDocument();
    expect(screen.getByText("Say It Aloud")).toBeInTheDocument();
    expect(screen.queryByText("What Happened")).not.toBeInTheDocument();
    rerender(<CoachingResult result={incorrect} level={2} />);
    expect(screen.getByText("Teach The Word")).toBeInTheDocument();
    const correct = mockCoaching({ ...request, childAttempt: "rhythm" });
    rerender(<CoachingResult result={correct} level={3} />);
    expect(screen.getByText("Correct!")).toBeInTheDocument();
  });

  it("renders streaming placeholders, progressive text, and section errors", () => {
    const streaming = {
      ...mockCoaching(request),
      missAnalysis: {
        summary: "The middle sound is still streaming",
        primaryErrorType: null,
        secondaryErrorTypes: [],
        primaryErrorFocus: "",
        likelyWrongWordInterpretation: false,
        usedMeaningDisambiguationWell: false,
      },
      coachingText: {
        shortFeedback: "",
        fullExplanation: "",
        memoryTip: "",
        sayAloudTip: "",
      },
      streamSections: {
        miss_analysis: {
          status: "streaming" as const,
          text: "The middle sound is still streaming",
          timingMs: 12,
          error: null,
        },
        explanation: {
          status: "idle" as const,
          text: "",
          timingMs: 0,
          error: null,
        },
        memory_tip: {
          status: "error" as const,
          text: "",
          timingMs: 20,
          error: { code: "SECTION_TIMEOUT", message: "Timed out." },
        },
      },
    };

    const { rerender } = render(<CoachingResult result={streaming} level={2} />);
    expect(screen.getByText("The middle sound is still streaming")).toBeInTheDocument();
    expect(screen.getByText("Explanation")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByText("This section could not be loaded.")).toBeInTheDocument();

    rerender(
      <CoachingResult
        result={{
          ...streaming,
          coachingText: {
            ...streaming.coachingText,
            fullExplanation: "Use rhy, then thm.",
            memoryTip: "Rhythm has your two h letters.",
          },
          streamSections: {
            ...streaming.streamSections,
            explanation: {
              status: "complete" as const,
              text: "Use rhy, then thm.",
              timingMs: 30,
              error: null,
            },
            memory_tip: {
              status: "complete" as const,
              text: "Rhythm has your two h letters.",
              timingMs: 40,
              error: null,
            },
          },
        }}
        level={2}
      />,
    );
    expect(screen.getByText("Use rhy, then thm.")).toBeInTheDocument();
    expect(screen.getByText("Rhythm has your two h letters.")).toBeInTheDocument();
    expect(screen.queryByText("This section could not be loaded.")).not.toBeInTheDocument();
  });

  it("filters themes by level, selects one, toggles, and closes outside", () => {
    const onChange = vi.fn();
    render(<TooltipProvider><ThemePicker current="default" onChange={onChange} level={1} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Theme" }));
    expect(screen.getByText("Choose a theme")).toBeInTheDocument();
    expect(screen.queryByText("Night Sky")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cosmic/ }));
    expect(onChange).toHaveBeenCalledWith("space");
    fireEvent.click(screen.getByRole("button", { name: "Theme" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Choose a theme")).not.toBeInTheDocument();
  });

  it("lists newest history first, selects original indexes, and downloads", () => {
    const first = { word, attempt: "rhythm", result: mockCoaching({ ...request, childAttempt: "rhythm" }) };
    const second = { word: { ...word, word: "necessary" }, attempt: "necesary", result: mockCoaching({ ...request, targetWord: "necessary", childAttempt: "necesary" }) };
    const select = vi.fn();
    render(<SessionHistorySidebar history={[first, second]} activeIndex={1} onSelect={select} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons.find((button) => button.textContent?.includes("necessary"))!);
    expect(select).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /Download/ }));
    expect(report.download).toHaveBeenCalledWith([first, second]);
  });

  it("renders decorative dinos and sheet-based history states", () => {
    const decorations = render(<DinoDecor />);
    expect(decorations.container.querySelectorAll("img")).toHaveLength(6);
    decorations.unmount();

    const correct = { word, attempt: "rhythm", result: mockCoaching({ ...request, childAttempt: "rhythm" }) };
    const select = vi.fn();
    render(<SessionHistoryPanel history={[correct]} activeIndex={0} onSelect={select} />);
    fireEvent.click(screen.getByRole("button", { name: "Session history" }));
    fireEvent.click(screen.getByRole("button", { name: /rhythm/ }));
    expect(select).toHaveBeenCalledWith(0);
  });
});
