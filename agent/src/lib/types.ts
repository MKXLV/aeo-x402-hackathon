export type SourceType = "github" | "docs" | "blog" | "video" | "profile" | "other";

export interface AgentConfig {
  llmProvider: "openai" | "anthropic";
  llmApiKey: string;
  llmModel: string;
  tinyfishApiKey?: string;
  tinyfishEndpoint?: string;
  tinyfishAgentEndpoint?: string;
  wundergraphEndpoint?: string;
  ghostAdminUrl?: string;
  ghostAdminKey?: string;
  substackPublicationUrl?: string;
  substackEmail?: string;
  substackPassword?: string;
  substackPublishMode?: "draft" | "publish";
  substackSendEmail?: boolean;
  substackAudience?: "everyone" | "free" | "paid" | "founding";
  databaseUrl?: string;
}

export interface RawPage {
  url: string;
  html: string;
  status: number;
  fetchedBy: "tinyfish" | "fetch";
  fetchedAt: string;
}

export interface ExtractedContent {
  url: string;
  source: SourceType;
  title: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  metadata: Record<string, string>;
}

export interface StructuredSource {
  source: SourceType;
  url: string;
  title: string;
  content: string;
  sections: { heading: string; body: string }[];
  entities: string[];
  claims: string[];
}

export interface CompanyProfile {
  name: string;
  category: string;
  problem: string;
  solution: string;
  capabilities: string[];
  differentiators: string[];
  audience: string;
  summary: string;
}

export interface AnswerBlock {
  question: string;
  answer: string;
  sources: string[];
}

export interface PodcastScript {
  title: string;
  intro: string;
  segments: { speaker: string; text: string }[];
  outro: string;
}

export interface InfluencerOutreach {
  influencer_persona: string;
  platform: string;
  subject: string;
  message: string;
}

export interface BlogPost {
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string;
}

export interface SubstackEdition {
  title: string;
  subtitle: string;
  slug: string;
  body_markdown: string;
  tags: string[];
}

export interface GeneratedContent {
  faq: AnswerBlock[];
  blog: BlogPost;
  podcast: PodcastScript;
  outreach: InfluencerOutreach[];
  substack: SubstackEdition;
}

export interface PublishResult {
  published: boolean;
  url?: string;
  note?: string;
  status?: string;
  runId?: string;
}

export type UgcPostState =
  | "queued"
  | "submitted"
  | "posted"
  | "failed"
  | "refunded";

export type UgcOrderState =
  | "paid"
  | "dispatched"
  | "completed"
  | "partial"
  | "failed";

export interface UgcPostResult {
  id: string;
  platform: string;
  kind: string;
  body: string;
  provider: string;
  upstream?: string | null;
  provider_order_id?: string | null;
  state: UgcPostState;
  unit_price_usdc: string;
  error?: string | null;
}

export interface UgcOrderResult {
  id: string;
  state: UgcOrderState;
  payer_address: string;
  total_usdc: string;
  posts: UgcPostResult[];
  createdAt: string;
  sellerUrl: string;
  txNote?: string;
  error?: string;
}

export interface JobStep {
  name: string;
  status: "running" | "done" | "warn" | "error" | "skip";
  detail?: string;
  at: string;
}

export interface AnalysisJob {
  id: string;
  createdAt: string;
  status: "pending" | "running" | "complete" | "error";
  company: string;
  urls: string[];
  steps: JobStep[];
  sources: StructuredSource[];
  profile?: CompanyProfile;
  answerBlocks: AnswerBlock[];
  content?: GeneratedContent;
  ghost?: PublishResult;
  substack?: PublishResult;
  ugc?: UgcOrderResult;
  error?: string;
}
