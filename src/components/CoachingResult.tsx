import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Lightbulb, BookOpen, Puzzle, Volume2,
  ArrowRight, Brain, Layers, Target, Shapes, BookText
} from "lucide-react";
import type { CoachingResponse } from "@/lib/api";
import { WordBreakdownChips } from "./WordBreakdownChips";
import { LabelChips } from "./LabelChips";
import { MatchedPatternChips } from "./MatchedPatternChips";
import { ConfidenceBar } from "./ConfidenceBar";
import { TeachingCard, ConceptTeachingContent } from "./TeachingCard";
import { BooleanStatusRow } from "./BooleanStatusRow";
import { cn } from "@/lib/utils";
import { friendlyErrorType } from "@/lib/errorTypeLabels";

interface CoachingResultProps {
  result: CoachingResponse;
  level?: number;
  targetWord?: string;
}

function Section({ icon: Icon, title, children, className }: { icon: React.ElementType; title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn("rounded-xl border border-border bg-card p-4", className)}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-foreground/85">{children}</div>
    </motion.div>
  );
}

const relevanceBadgeStyle: Record<string, string> = {
  form: "bg-primary/10 text-primary",
  concept: "bg-chip-accent text-chip-accent-foreground",
  mixed: "bg-warning/10 text-warning",
  unclear: "bg-muted text-muted-foreground",
};

export function CoachingResult({ result, level, targetWord }: CoachingResultProps) {
  const isLevel1 = level === 1;
  const { correctness, missAnalysis, wordTeaching, errorRelevance, teachingDecision, coachingText, wordBreakdown, conceptLabels, nextStep } = result;
  const isCorrect = correctness.isCorrect;

  return (
    <div className="space-y-3">
      {/* Quick Feedback Banner */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "rounded-xl p-4 text-center",
          isCorrect ? "bg-success/10 border-2 border-success/30" : "bg-secondary/10 border-2 border-secondary/30"
        )}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          {isCorrect ? <CheckCircle2 className="h-6 w-6 text-success" /> : <XCircle className="h-6 w-6 text-secondary" />}
          <span className="font-display text-lg">{isCorrect ? "Correct!" : "Not quite!"}</span>
        </div>
        <p className="text-sm text-muted-foreground">{coachingText.shortFeedback}</p>
      </motion.div>

      {/* Word Breakdown */}
      {wordBreakdown?.displayChunks?.length > 0 && (
        <Section icon={Puzzle} title="Word Breakdown">
          <WordBreakdownChips chunks={wordBreakdown.displayChunks} reason={wordBreakdown.chunkReason} />
          {isLevel1 && wordBreakdown.matchedPatterns?.length > 0 && (
            <div className="mt-3">
              <MatchedPatternChips patterns={wordBreakdown.matchedPatterns} title="Matched Patterns" />
            </div>
          )}
        </Section>
      )}

      {/* Teach The Word */}
      {!isLevel1 && wordTeaching && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Teach The Word</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TeachingCard title="Form Teaching" icon={<Shapes className="h-4 w-4 text-primary" />}>
              {(() => {
                const matched = wordBreakdown?.matchedPatterns ?? [];
                const conceptPatterns = conceptLabels?.patternLabels ?? [];
                const sayAloud = coachingText?.sayAloudTip;
                const relatedForms = wordTeaching?.conceptTeaching?.relatedForms ?? [];
                if (matched.length === 0 && conceptPatterns.length === 0 && !sayAloud && relatedForms.length === 0) {
                  return <p className="text-muted-foreground italic text-xs">No matched patterns for this word.</p>;
                }
                return (
                  <div className="space-y-2.5">
                    {matched.length > 0 && (
                      <MatchedPatternChips patterns={matched} title="Patterns" />
                    )}
                    {conceptPatterns.length > 0 && (
                      <LabelChips labels={conceptPatterns} variant="default" title="Concept Labels" />
                    )}
                    {relatedForms.length > 0 && (
                      <LabelChips labels={relatedForms} variant="accent" title="Related Forms" />
                    )}
                    {sayAloud && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Say Aloud Tip</p>
                        <p>{sayAloud}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </TeachingCard>
            <TeachingCard title="Concept Teaching" icon={<BookText className="h-4 w-4 text-primary" />}>
              <ConceptTeachingContent data={wordTeaching.conceptTeaching} targetWord={targetWord} />
            </TeachingCard>
          </div>
        </motion.div>
      )}

      {/* Miss Analysis (L2/L3 only, incorrect only) */}
      {!isLevel1 && !isCorrect && missAnalysis?.summary && (() => {
        const booleanItems = [
          missAnalysis.likelyWrongWordInterpretation && { label: "Wrong word interpretation", value: true },
          missAnalysis.usedMeaningDisambiguationWell && { label: "Used meaning disambiguation", value: true },
        ].filter(Boolean) as { label: string; value: boolean }[];
        return (
        <Section icon={XCircle} title="Miss Analysis">
          <p>{missAnalysis.summary}</p>
          {missAnalysis.primaryErrorFocus && (
            <p className="text-xs mt-1.5"><span className="font-semibold text-primary">Focus:</span> {missAnalysis.primaryErrorFocus}</p>
          )}
          {missAnalysis.primaryErrorType && (
            <div className="mt-2.5">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Primary error</p>
              <LabelChips labels={[friendlyErrorType(missAnalysis.primaryErrorType)]} variant="warm" />
              {missAnalysis.errorTypeEvidence?.[missAnalysis.primaryErrorType] && (
                <p className="text-xs text-muted-foreground mt-1.5 italic">
                  {missAnalysis.errorTypeEvidence[missAnalysis.primaryErrorType]}
                </p>
              )}
            </div>
          )}
          {missAnalysis.secondaryErrorTypes?.length > 0 && (
            <div className="mt-2.5">
              <LabelChips
                labels={missAnalysis.secondaryErrorTypes.map(friendlyErrorType)}
                variant="default"
                title="Also noticed"
              />
              {missAnalysis.secondaryErrorTypes.some((k) => missAnalysis.errorTypeEvidence?.[k]) && (
                <ul className="text-xs text-muted-foreground mt-1.5 space-y-0.5 list-disc pl-4">
                  {missAnalysis.secondaryErrorTypes
                    .filter((k) => missAnalysis.errorTypeEvidence?.[k])
                    .map((k) => (
                      <li key={k}>
                        <span className="font-medium">{friendlyErrorType(k)}:</span>{" "}
                        <span className="italic">{missAnalysis.errorTypeEvidence[k]}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          {booleanItems.length > 0 && (
            <BooleanStatusRow className="mt-2.5" items={booleanItems} />
          )}
        </Section>
        );
      })()}


      {/* What Matters Most For This Error - hidden for cleaner UX */}
      {/* Teaching Decision - hidden for cleaner UX */}

      {/* Explanation */}
      {!isLevel1 && !isCorrect && coachingText.fullExplanation && (
        <Section icon={BookOpen} title="Explanation">
          <p>{coachingText.fullExplanation}</p>
        </Section>
      )}

      {/* Memory Tip */}
      {coachingText.memoryTip && (
        <Section icon={Lightbulb} title="Memory Tip">
          <p className="italic">{coachingText.memoryTip}</p>
        </Section>
      )}

      {/* Say It Aloud */}
      {/* Say It Aloud (L1 only — for L2/L3 this is shown inside Form Teaching) */}
      {isLevel1 && coachingText.sayAloudTip && (
        <Section icon={Volume2} title="Say It Aloud">
          <p>{coachingText.sayAloudTip}</p>
        </Section>
      )}


      {/* Next Step - hidden */}

    </div>
  );
}
