import type { Database } from "@/lib/supabase/database.types";

export type SubmissionStatus = Database["public"]["Enums"]["submission_status"];
export type ReviewVerdict = Database["public"]["Enums"]["review_verdict"];

export const verdicts: readonly ReviewVerdict[] = ["correct", "needs_fix", "retry"];
export const errorTypes = ["makhraj", "sifat", "vowel", "length", "other"] as const;
export type ErrorType = (typeof errorTypes)[number];

export type AttemptStats = {
  /** Attempts whose file reached the teacher (submitted or reviewed). */
  saved: number;
  correct: number;
  /** "Needs fixing" and "try again" verdicts. */
  notYet: number;
  awaitingReview: number;
};

/**
 * Counts from real rows only. Unfinished uploads and technical failures are
 * not attempts at pronunciation and are left out.
 */
export function attemptStats(
  attempts: { status: SubmissionStatus; verdict: ReviewVerdict | null }[],
): AttemptStats {
  const stats: AttemptStats = { saved: 0, correct: 0, notYet: 0, awaitingReview: 0 };
  for (const attempt of attempts) {
    if (attempt.status === "needs_teacher_review") {
      stats.saved++;
      stats.awaitingReview++;
    } else if (attempt.status === "reviewed") {
      stats.saved++;
      if (attempt.verdict === "correct") stats.correct++;
      else if (attempt.verdict) stats.notYet++;
    }
  }
  return stats;
}
