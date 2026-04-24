import { generateContent } from "../../src/lib/agent/generator";
import type {
  AgentConfig,
  AnswerBlock,
  CompanyProfile,
  GeneratedContent,
} from "../../src/lib/types";

export interface GenerateInput {
  profile: CompanyProfile;
  answerBlocks: AnswerBlock[];
  config: AgentConfig;
}

export type GenerateOperation = (
  input: GenerateInput
) => Promise<GeneratedContent>;

export const generate: GenerateOperation = async (input) => {
  if (!input.profile) throw new Error("profile is required");
  return generateContent(input.profile, input.answerBlocks || [], input.config);
};
