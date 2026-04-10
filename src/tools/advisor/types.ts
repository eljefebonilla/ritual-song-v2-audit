/**
 * Advisor tool types — cost-aware LLM advisor for liturgical music decisions.
 * Ref: DESIGN-SPEC-v2.md Section 16 — tools/advisor/
 */

export interface AdvisorResponse {
  answer: string;
  model: string;
  tier: "cheap" | "strong";
  estimatedCostCents: number;
  timestamp: number;
}

export interface VerificationResult {
  confidence: number; // 0-1
  approved: boolean;
  issues: string[];
  alternatives: string[];
  explanation: string;
  model: string;
}

export interface PlanReviewResult {
  overallScore: number; // 0-100
  positionFeedback: Record<
    string,
    {
      score: number;
      comment: string;
      suggestion?: string;
    }
  >;
  liturgicalNotes: string[];
  model: string;
}

export type AdvisorModel = "cheap" | "strong";

export interface AdvisorConfig {
  cheapModel: string;
  strongModel: string;
  openrouterApiKey: string;
  maxRetries: number;
  timeoutMs: number;
}
