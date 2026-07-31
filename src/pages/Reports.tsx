import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Target,
  BookOpen,
  LifeBuoy,
  CalendarClock,
  Trophy,
  Download,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  type DateRange,
  type ReportPagination,
  type ReportSection,
  type ReportSessionWord,
  type ReportsMock,
} from "@/lib/reportsMock";
import { UnauthorizedError, fetchReports, fetchReportSessionDetails } from "@/lib/api";
import { AccessDenied } from "@/components/AccessDenied";

const RANGES: { key: DateRange; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

type TabKey = "overview" | "miss" | "knowledge" | "support" | "sessions" | "mockbee";
const TABS: { key: TabKey; label: string; Icon: typeof BarChart3 }[] = [
  { key: "overview", label: "Overview", Icon: BarChart3 },
  { key: "miss", label: "Miss Analysis", Icon: Target },
  { key: "knowledge", label: "Word Knowledge", Icon: BookOpen },
  { key: "support", label: "Support Usage", Icon: LifeBuoy },
  { key: "sessions", label: "Sessions", Icon: CalendarClock },
  { key: "mockbee", label: "Mock Bee", Icon: Trophy },
];

const TAB_SECTIONS: Record<TabKey, ReportSection> = {
  overview: "overview",
  miss: "missAnalysis",
  knowledge: "wordKnowledge",
  support: "supportUsage",
  sessions: "sessions",
  mockbee: "mockBee",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
];

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-display font-semibold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-sm", className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function TableCard({
  title,
  subtitle,
  headers,
  rows,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left font-semibold px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border/40">
                {row.map((c, j) => (
                  <td key={j} className="px-4 py-2 text-foreground/90 align-top">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusPill(correct: boolean) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        correct ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      )}
    >
      {correct ? "Correct" : "Incorrect"}
    </span>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
  } as React.CSSProperties,
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 } as React.CSSProperties,
};

function downloadReviewCards(round: { id: string; date: string; reviewCards: unknown[] }) {
  const data = JSON.stringify({ roundId: round.id, date: round.date, reviewCards: round.reviewCards }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `mock-bee-review-${round.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [range, setRange] = useState<DateRange>("30d");
  const [tab, setTab] = useState<TabKey>("overview");
  const [source, setSource] = useState<Partial<ReportsMock>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPagination, setSessionPagination] = useState<ReportPagination | null>(null);
  const [sessionWords, setSessionWords] = useState<Record<string, ReportSessionWord[]>>({});
  const [sessionDetailError, setSessionDetailError] = useState<Record<string, string>>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const section = TAB_SECTIONS[tab];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchReports(range, section, section === "sessions" ? sessionPage : 1)
      .then((data) => {
        if (!active) return;
        setSource((current) => ({ ...current, ...data }));
        if (data.pagination) setSessionPagination(data.pagination);
      })
      .catch((reason: unknown) => {
        if (reason instanceof UnauthorizedError) {
          if (active) setRequiresSignIn(true);
          return;
        }
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load reports");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [range, section, sessionPage]);

  const d = source[section] ? source as ReportsMock : null;

  if (requiresSignIn) return <AccessDenied />;

  const changeRange = (nextRange: DateRange) => {
    setRange(nextRange);
    setSource({});
    setSessionPage(1);
    setSessionPagination(null);
    setExpandedSessionId(null);
    setSessionWords({});
  };

  const toggleSession = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    if (sessionWords[sessionId]) return;

    setLoadingSessionId(sessionId);
    setSessionDetailError((current) => ({ ...current, [sessionId]: "" }));
    try {
      const words = await fetchReportSessionDetails(sessionId);
      setSessionWords((current) => ({ ...current, [sessionId]: words }));
    } catch (reason) {
      setSessionDetailError((current) => ({
        ...current,
        [sessionId]: reason instanceof Error
          ? reason.message
          : "Unable to load session details",
      }));
    } finally {
      setLoadingSessionId((current) => current === sessionId ? null : current);
    }
  };

  // all error keys for miss analysis by level and by mode, for building the stacked bar charts
  const missLevelKeys = source.missAnalysis
    ? Array.from(new Set(source.missAnalysis.byLevel.flatMap((row) => Object.keys(row).filter((key) => key !== "level"))))
    : [];
  const missModeKeys = source.missAnalysis
    ? Array.from(new Set(source.missAnalysis.byMode.flatMap((row) => Object.keys(row).filter((key) => key !== "mode"))))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-lg font-display font-semibold text-foreground">Reports</h1>
          <span className="ml-2 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-semibold">
            Your practice data
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center rounded-lg border border-border/60 bg-card/60 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => changeRange(r.key)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    range === r.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-accent/40">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!d && loading && <p className="text-sm text-muted-foreground">Loading your report…</p>}
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
        {d && (
          <>
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                  <KpiCard label="Total attempted" value={d.overview.totalAttempted} />
                  <KpiCard label="Accuracy" value={`${d.overview.accuracy}%`} />
                  <KpiCard label="Correct" value={d.overview.totalCorrect} />
                  <KpiCard label="Incorrect" value={d.overview.totalIncorrect} />
                  <KpiCard label="Sessions" value={d.overview.sessionsCompleted} />
                  <KpiCard label="Avg / session" value={d.overview.avgAttemptsPerSession} />
                  <KpiCard label="Practice time" value={`${d.overview.practiceTimeMinutes}m`} />
                  {/* <KpiCard label="Practice time" value={`${d.overview.practiceTimeMinutes}m`} hint="needs backend tracking" /> */}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Accuracy trend" subtitle="Daily accuracy % over the selected range">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={d.overview.accuracyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                        <RTooltip {...tooltipStyle} />
                        <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Attempts over time" subtitle="Number of word attempts per day">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.overview.attemptsTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="attempts" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Practice by mode">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={d.overview.byMode} dataKey="attempts" nameKey="mode" innerRadius={55} outerRadius={90} paddingAngle={2}>
                          {d.overview.byMode.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <RTooltip {...tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Practice by level">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.overview.byLevel} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis type="category" dataKey="level" stroke="hsl(var(--muted-foreground))" fontSize={11} width={70} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="attempts" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </>
            )}

            {tab === "miss" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Top primary error categories">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={d.missAnalysis.primary} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis type="category" dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Top secondary error categories">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={d.missAnalysis.secondary} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis type="category" dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Miss categories by level">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={d.missAnalysis.byLevel}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="level" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {missLevelKeys.map((errorType, index) => (
                          <Bar
                            key={errorType}
                            dataKey={errorType}
                            stackId="a"
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Miss categories by mode">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={d.missAnalysis.byMode}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mode" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {missModeKeys.map((errorType, index) => (
                          <Bar
                            key={errorType}
                            dataKey={errorType}
                            stackId="a"
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <TableCard
                  title="Recent incorrect attempts"
                  subtitle="Most recent 20 incorrect attempts"
                  headers={["Target", "Attempt", "Primary error", "Secondary", "Date", "Mode", "Level"]}
                  rows={d.missAnalysis.recentIncorrect.map((r) => [
                    <span className="font-mono font-semibold">{r.target}</span>,
                    <span className="font-mono text-destructive line-through">{r.attempt}</span>,
                    r.primary,
                    r.secondary.join(", ") || "—",
                    r.date,
                    r.mode,
                    r.level,
                  ])}
                />
                {/* <TableCard
              title="Recent missed words"
              subtitle="Most recent 20 distinct incorrect target words"
              headers={["Target", "Attempt", "Primary error", "Secondary", "Date", "Mode", "Level"]}
              rows={d.missAnalysis.recentMissedWords.map((r) => [
                <span className="font-mono font-semibold">{r.target}</span>,
                <span className="font-mono text-destructive line-through">{r.attempt}</span>,
                r.primary,
                r.secondary.join(", ") || "—",
                r.date,
                r.mode,
                r.level,
              ])}
            /> */}
              </>
            )}

            {tab === "knowledge" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Attempts by origin">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={d.wordKnowledge.byOrigin} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis type="category" dataKey="origin" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="attempts" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Attempts by part of speech">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={d.wordKnowledge.byPos} dataKey="attempts" nameKey="pos" outerRadius={95}>
                          {d.wordKnowledge.byPos.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <RTooltip {...tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Attempts by difficulty">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.wordKnowledge.byDifficulty}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="difficulty" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="attempts" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Attempts by grade band">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.wordKnowledge.byGradeBand}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="band" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="attempts" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Most-missed origins" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.wordKnowledge.mostMissedOrigins}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="origin" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="incorrect" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <TableCard
                    title="Recent words by origin"
                    headers={["Word", "Origin", "Date", ""]}
                    rows={d.wordKnowledge.recentByOrigin.map((r) => [
                      <span className="font-mono">{r.word}</span>,
                      r.origin,
                      r.date,
                      statusPill(r.correct),
                    ])}
                  />
                  <TableCard
                    title="Recent difficult words"
                    headers={["Word", "Origin", "Date", ""]}
                    rows={d.wordKnowledge.recentHard.map((r) => [
                      <span className="font-mono">{r.word}</span>,
                      r.origin,
                      r.date,
                      statusPill(r.correct),
                    ])}
                  />
                  <TableCard
                    title="Recent foreign-origin words"
                    headers={["Word", "Origin", "Date", ""]}
                    rows={d.wordKnowledge.recentForeign.map((r) => [
                      <span className="font-mono">{r.word}</span>,
                      r.origin,
                      r.date,
                      statusPill(r.correct),
                    ])}
                  />
                </div>
              </>
            )}

            {tab === "support" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <KpiCard label="Definition viewed" value={d.supportUsage.definition} />
                  <KpiCard label="Example viewed" value={d.supportUsage.example} />
                  <KpiCard label="Origin viewed" value={d.supportUsage.origin} />
                  <KpiCard label="Part of speech viewed" value={d.supportUsage.partOfSpeech} />
                  <KpiCard label="Repeat word" value={d.supportUsage.repeat} />
                  <KpiCard label="Voice input" value={d.supportUsage.voice} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Support usage by mode">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={d.supportUsage.byMode}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mode" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="definition" name="Definition" stackId="a" fill={CHART_COLORS[0]} />
                        <Bar dataKey="example" name="Example" stackId="a" fill={CHART_COLORS[1]} />
                        <Bar dataKey="origin" name="Origin" stackId="a" fill={CHART_COLORS[2]} />
                        <Bar dataKey="partOfSpeech" name="Part of speech" stackId="a" fill={CHART_COLORS[3]} />
                        <Bar dataKey="repeat" name="Repeat" stackId="a" fill={CHART_COLORS[4]} />
                        <Bar dataKey="voice" name="Voice input" stackId="a" fill={CHART_COLORS[5]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Support usage by level">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={d.supportUsage.byLevel}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="level" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="definition" name="Definition" stackId="a" fill={CHART_COLORS[0]} />
                        <Bar dataKey="example" name="Example" stackId="a" fill={CHART_COLORS[1]} />
                        <Bar dataKey="origin" name="Origin" stackId="a" fill={CHART_COLORS[2]} />
                        <Bar dataKey="partOfSpeech" name="Part of speech" stackId="a" fill={CHART_COLORS[3]} />
                        <Bar dataKey="repeat" name="Repeat" stackId="a" fill={CHART_COLORS[4]} />
                        <Bar dataKey="voice" name="Voice input" stackId="a" fill={CHART_COLORS[5]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <TableCard
                  title="Recent attempts where supports were used"
                  headers={["Word", "Supports used", "Mode", "Level", "Date", ""]}
                  rows={d.supportUsage.recentWithSupport.map((r) => [
                    <span className="font-mono">{r.word}</span>,
                    <div className="flex flex-wrap gap-1">
                      {r.supports.map((s) => (
                        <span key={s} className="rounded-full bg-chip text-chip-foreground px-2 py-0.5 text-[10px] font-medium">{s}</span>
                      ))}
                    </div>,
                    r.mode,
                    r.level,
                    r.date,
                    statusPill(r.correct),
                  ])}
                />
              </>
            )}

            {tab === "sessions" && (
              <div className="space-y-4">
                {d.sessions.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{s.startedAt}</p>
                        <p className="text-xs text-muted-foreground">{s.mode} · {s.level} · {s.durationMinutes}m</p>
                      </div>
                      <span className={cn(
                        "ml-auto rounded-full px-2.5 py-1 text-xs font-semibold",
                        s.accuracy >= 75 ? "bg-success/15 text-success" : s.accuracy >= 60 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                      )}>
                        {s.accuracy}% accuracy
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Attempted</p><p className="font-semibold">{s.attempted}</p></div>
                      <div><p className="text-xs text-muted-foreground">Correct</p><p className="font-semibold text-success">{s.correct}</p></div>
                      <div><p className="text-xs text-muted-foreground">Incorrect</p><p className="font-semibold text-destructive">{s.incorrect}</p></div>
                      <div><p className="text-xs text-muted-foreground">Top miss types</p><p className="font-medium">{s.topMissCategories.join(", ")}</p></div>
                      <div>
                        <p className="text-xs text-muted-foreground">Supports</p>
                        <p className="font-medium">D {s.supportsUsed.definition} · E {s.supportsUsed.example} · O {s.supportsUsed.origin} · P {s.supportsUsed.partOfSpeech} · R {s.supportsUsed.repeat} · V {s.supportsUsed.voice}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => void toggleSession(s.id)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {expandedSessionId === s.id ? "Hide per-word breakdown" : "View per-word breakdown →"}
                      </button>
                    </div>
                    {expandedSessionId === s.id && (
                      <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                        {loadingSessionId === s.id ? (
                          <p className="text-sm text-muted-foreground">Loading word details…</p>
                        ) : sessionDetailError[s.id] ? (
                          <p className="text-sm text-destructive">{sessionDetailError[s.id]}</p>
                        ) : (sessionWords[s.id]?.length ?? 0) === 0 ? (
                          <p className="text-sm text-muted-foreground">No word attempts were recorded for this session.</p>
                        ) : sessionWords[s.id].map((word, index) => (
                          <div key={`${word.target}-${index}`} className="rounded-xl bg-muted/35 p-4 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-semibold">{word.target}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-mono">{word.attempt || "—"}</span>
                              {statusPill(word.correct)}
                            </div>
                            <p className="mt-2"><span className="font-medium">Miss analysis:</span> {word.primaryError}{word.secondaryErrors.length ? ` · ${word.secondaryErrors.join(", ")}` : ""}</p>
                            <p className="mt-1"><span className="font-medium">Explanation:</span> {word.explanation}</p>
                            <p className="mt-1"><span className="font-medium">Memory tip:</span> {word.memoryTip}</p>
                            <p className="mt-1"><span className="font-medium">Word breakdown:</span> {word.wordBreakdown}</p>
                            <p className="mt-1"><span className="font-medium">Concept teaching:</span> {word.conceptTeaching}</p>
                            <p className="mt-1"><span className="font-medium">Say aloud:</span> {word.sayAloudTip}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {sessionPagination && sessionPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setExpandedSessionId(null);
                        setSessionPage((current) => Math.max(1, current - 1));
                      }}
                      disabled={sessionPagination.page <= 1 || loading}
                      className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Page {sessionPagination.page} of {sessionPagination.totalPages}
                    </span>
                    <button
                      onClick={() => {
                        setExpandedSessionId(null);
                        setSessionPage((current) =>
                          Math.min(sessionPagination.totalPages, current + 1));
                      }}
                      disabled={sessionPagination.page >= sessionPagination.totalPages || loading}
                      className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Per-word section shows target word, child attempt, correctness, miss analysis, explanation, memory tip, word breakdown, concept teaching, and say-aloud tip.
                </p>
              </div>
            )}

            {tab === "mockbee" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Rounds completed" value={d.mockBee.roundsCompleted} />
                  <KpiCard label="Average score" value={d.mockBee.avgScore} hint="correct / round" />
                  <KpiCard label="Best round" value={`${d.mockBee.accuracyByRound.length ? Math.max(...d.mockBee.accuracyByRound.map((r) => r.accuracy)) : 0}%`} />
                  <KpiCard label="Total timeouts" value={d.mockBee.timeoutsByRound.reduce((a, b) => a + b.timeouts, 0)} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Accuracy by round">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={d.mockBee.accuracyByRound}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="round" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                        <RTooltip {...tooltipStyle} />
                        <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Timeouts by round">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.mockBee.timeoutsByRound}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="round" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="timeouts" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Level-wise mock bee accuracy" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.mockBee.accuracyByLevel} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                        <YAxis type="category" dataKey="level" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                        <RTooltip {...tooltipStyle} />
                        <Bar dataKey="accuracy" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <TableCard
                  title="Round summaries"
                  subtitle="Downloadable review cards available at the end of each round"
                  headers={["Date", "Level", "Attempted", "Correct", "Incorrect", "Timed out", ""]}
                  rows={d.mockBee.rounds.map((r) => [
                    r.date,
                    r.level,
                    r.attempted,
                    <span className="text-success font-semibold">{r.correct}</span>,
                    <span className="text-destructive font-semibold">{r.incorrect}</span>,
                    r.timedOut,
                    <button
                      onClick={() => downloadReviewCards(r)}
                      disabled={r.reviewCards.length === 0}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                    >
                      <Download className="h-3 w-3" /> Review card
                    </button>,
                  ])}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
