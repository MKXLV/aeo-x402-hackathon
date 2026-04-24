"use client";

import type { ReactNode } from "react";
import type { AnalysisJob, AnswerBlock, StructuredSource } from "@/lib/types";
import UgcPanel from "./UgcPanel";

export default function ResultsView({ job }: { job: AnalysisJob }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Run Status"
          value={labelForStatus(job.status)}
          subvalue={`Job ${job.id.slice(0, 8)}`}
        />
        <MetricCard
          label="Sources"
          value={String(job.sources.length)}
          subvalue={`${job.urls.length} input URL${job.urls.length === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="AEO Answers"
          value={String(job.answerBlocks.length)}
          subvalue={job.profile?.category || "Awaiting synthesis"}
        />
        <MetricCard
          label="Content Bundle"
          value={job.content ? "Ready" : "Pending"}
          subvalue={
            job.substack?.published
              ? "Substack post created"
              : job.ghost?.published
              ? "Ghost draft published"
              : "Channels optional"
          }
        />
      </section>

      <UgcPanel job={job} />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Panel
            eyebrow="Company Profile"
            title={job.profile?.name || job.company}
            description="Structured knowledge synthesized across the fetched sources."
          >
            {job.profile ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ProfileItem label="Category" value={job.profile.category} />
                <ProfileItem label="Audience" value={job.profile.audience} />
                <ProfileItem label="Problem" value={job.profile.problem} />
                <ProfileItem label="Solution" value={job.profile.solution} />
                <ProfileItem
                  label="Capabilities"
                  value={job.profile.capabilities.join(", ")}
                />
                <ProfileItem
                  label="Differentiators"
                  value={job.profile.differentiators.join(", ")}
                />
                <div className="md:col-span-2">
                  <ProfileItem label="Summary" value={job.profile.summary} />
                </div>
              </div>
            ) : (
              <EmptyState text="No profile generated for this run." />
            )}
          </Panel>

          <Panel
            eyebrow="AEO Answers"
            title="Answer Blocks"
            description="Citation-ready answers designed for answer-engine retrieval."
          >
            <div className="grid gap-4">
              {job.answerBlocks.length > 0 ? (
                job.answerBlocks.map((block, index) => (
                  <AnswerCard key={`${block.question}-${index}`} block={block} />
                ))
              ) : (
                <EmptyState text="No answer blocks were generated." />
              )}
            </div>
          </Panel>

          <Panel
            eyebrow="Sources"
            title="Structured Inputs"
            description="What the agent extracted and normalized before synthesis."
          >
            <div className="grid gap-4">
              {job.sources.length > 0 ? (
                job.sources.map((source) => (
                  <SourceCard key={source.url} source={source} />
                ))
              ) : (
                <EmptyState text="No structured sources are attached to this job." />
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            eyebrow="Pipeline"
            title="Execution Trace"
            description="Every step the autonomous pipeline executed for this run."
          >
            <div className="space-y-3">
              {job.steps.length > 0 ? (
                job.steps.map((step, index) => (
                  <div
                    key={`${step.name}-${index}`}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium text-slate-100">
                        {step.name}
                      </div>
                      <span className={statusClass(step.status)}>
                        {step.status}
                      </span>
                    </div>
                    {step.detail && (
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {step.detail}
                      </p>
                    )}
                    <div className="mt-2 text-xs text-slate-500">
                      {new Date(step.at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No pipeline steps recorded yet." />
              )}
            </div>
          </Panel>

          <Panel
            eyebrow="Generated Content"
            title="Campaign Assets"
            description="Blog, podcast, and outreach outputs generated from the knowledge layer."
          >
            {job.content ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                    Blog Draft
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {job.content.blog.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {job.content.blog.excerpt}
                  </p>
                  <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-xs leading-6 text-slate-300">
                    {job.content.blog.body_markdown}
                  </pre>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                    Podcast Script
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {job.content.podcast.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {job.content.podcast.intro}
                  </p>
                  <div className="mt-4 space-y-3">
                    {job.content.podcast.segments.map((segment, index) => (
                      <div
                        key={`${segment.speaker}-${index}`}
                        className="rounded-lg border border-slate-800 bg-slate-900/80 p-3"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {segment.speaker}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {job.content.podcast.outro}
                  </p>
                </div>

                <div className="space-y-3">
                  {job.content.outreach.map((item, index) => (
                    <div
                      key={`${item.platform}-${index}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                            {item.platform}
                          </div>
                          <h3 className="mt-1 text-base font-semibold text-white">
                            {item.influencer_persona}
                          </h3>
                        </div>
                        <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                          {item.subject}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {item.message}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                    Substack Edition
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {job.content.substack.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {job.content.substack.subtitle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.content.substack.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-xs leading-6 text-slate-300">
                    {job.content.substack.body_markdown}
                  </pre>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                    Ghost Publish
                  </div>
                  <p className="mt-2 leading-6">
                    {job.ghost?.note ||
                      "Ghost publishing was not requested for this run."}
                  </p>
                  {job.ghost?.url && (
                    <a
                      className="mt-2 inline-flex text-cyan-300 underline underline-offset-4"
                      href={job.ghost.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Ghost draft
                    </a>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                    Substack Publish
                  </div>
                  <p className="mt-2 leading-6">
                    {job.substack?.note ||
                      "Substack publishing was not requested for this run."}
                  </p>
                  {job.substack?.url && (
                    <a
                      className="mt-2 inline-flex text-cyan-300 underline underline-offset-4"
                      href={job.substack.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Substack post
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState text="No generated content is attached to this run." />
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 text-sm text-slate-400">{subvalue}</div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-200">{value || "—"}</p>
    </div>
  );
}

function AnswerCard({ block }: { block: AnswerBlock }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
      <h3 className="text-base font-semibold tracking-tight text-white">
        {block.question}
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{block.answer}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {block.sources.map((source) => (
          <a
            key={source}
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
            href={source}
            rel="noreferrer"
            target="_blank"
          >
            {trimUrl(source)}
          </a>
        ))}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: StructuredSource }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
            {source.source}
          </div>
          <h3 className="mt-1 text-base font-semibold text-white">
            {source.title}
          </h3>
        </div>
        <a
          className="text-sm text-cyan-300 underline underline-offset-4"
          href={source.url}
          rel="noreferrer"
          target="_blank"
        >
          Open source
        </a>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">{source.content}</p>

      {source.sections.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {source.sections.map((section, index) => (
            <div
              key={`${section.heading}-${index}`}
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-3"
            >
              <div className="text-sm font-medium text-slate-100">
                {section.heading}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {section.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {(source.entities.length > 0 || source.claims.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TagList label="Entities" values={source.entities} />
          <TagList label="Claims" values={source.claims} />
        </div>
      )}
    </div>
  );
}

function TagList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return <EmptyState text={`No ${label.toLowerCase()}.`} />;

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-5 text-sm text-slate-500">
      {text}
    </div>
  );
}

function trimUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function labelForStatus(status: AnalysisJob["status"]): string {
  if (status === "complete") return "Complete";
  if (status === "running") return "Running";
  if (status === "error") return "Error";
  return "Pending";
}

function statusClass(status: string): string {
  if (status === "done") {
    return "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-300";
  }
  if (status === "warn" || status === "skip") {
    return "rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-300";
  }
  if (status === "error") {
    return "rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-red-300";
  }
  return "rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300";
}
