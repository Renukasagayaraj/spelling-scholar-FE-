import { cn } from "@/lib/utils";
import { LabelChips } from "./LabelChips";

interface TeachingCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function TeachingCard({ title, icon, children, className }: TeachingCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 flex-1 min-w-0", className)}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <div className="space-y-2.5 text-sm leading-relaxed text-foreground/85">{children}</div>
    </div>
  );
}

interface FormTeachingData {
  summary: string;
  patterns: string[];
  chunks: string[];
  chunkReason: string;
  sayAloudFocus: string;
}

export function FormTeachingContent({ data }: { data: FormTeachingData }) {
  return (
    <>
      {data.summary && <p>{data.summary}</p>}
      <LabelChips labels={data.patterns} variant="default" title="Patterns" />
      <LabelChips labels={data.chunks} variant="accent" title="Chunks" />
      {data.chunkReason && <p className="text-xs text-muted-foreground italic">{data.chunkReason}</p>}
      {data.sayAloudFocus && (
        <p className="text-xs"><span className="font-semibold text-primary">Say aloud:</span> {data.sayAloudFocus}</p>
      )}
    </>
  );
}

interface ConceptTeachingData {
  summary: string;
  meaningFocus: string;
  originFocus: string;
  morphologyFocus: string;
  originLabels: string[];
  morphologyLabels: string[];
  relatedForms?: string[];
}

function hasContent(data: ConceptTeachingData): boolean {
  return !!(
    data.summary || data.originLabels?.length || data.morphologyLabels?.length
  );
}

export function ConceptTeachingContent({ data }: { data: ConceptTeachingData }) {
  if (!hasContent(data)) {
    return <p className="text-muted-foreground italic text-xs">No strong concept clue needed for this word right now.</p>;
  }
  return (
    <>
      {data.summary && <p>{data.summary}</p>}
      <LabelChips labels={data.originLabels} variant="accent" title="Origin" />
      <LabelChips labels={data.morphologyLabels} variant="warm" title="Morphology" />
    </>
  );
}
