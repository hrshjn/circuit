import { z } from 'zod';

export const StateSchema = z.object({
  url: z.string(),
  depth: z.number(),
  dom: z.string(),
});
export type State = z.infer<typeof StateSchema>;

export const CandidateSchema = z.object({
  selector: z.string(),
  text: z.string().optional(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const ResultSchema = z.object({
  newState: StateSchema,
  tracePath: z.string(),
});
export type Result = z.infer<typeof ResultSchema>;

export const EvaluationSchema = z.object({
  score: z.number(),
  notes: z.string(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export interface Command {
  command: 'click' | 'fill' | 'go_to';
  selector?: string;
  value?: string;
  url?: string;
}

export interface Step {
  url: string;
  commandLog: Command[];
} 