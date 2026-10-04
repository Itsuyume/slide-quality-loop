import { z } from 'zod';
import { criterionSchema, digestSchema, identifierSchema } from './schema.js';

export const sideSchema = z.enum(['A', 'B']);
const winnerSchema = z.enum(['A', 'B', 'tie', 'uncertain']);
const regionSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().positive().max(1), z.number().positive().max(1)])
  .refine(([x, y, w, h]) => x + w <= 1.001 && y + h <= 1.001, 'Region extends beyond the image.');
export const packetSchema = z.object({
  packetId: digestSchema, pairId: digestSchema, contractSha256: digestSchema,
  protocolVersion: z.literal('1'), role: identifierSchema, brief: z.string(),
  images: z.object({ A: digestSchema, B: digestSchema }).strict(),
  questions: z.array(z.object({ id: identifierSchema, question: z.string() })), criteria: z.array(criterionSchema).optional()
}).strict();
export type Packet = z.infer<typeof packetSchema>;
export const reviewSchema = z.object({
  packetId: digestSchema, images: z.object({ A: digestSchema, B: digestSchema }).strict(),
  reviewer: z.object({ id: identifierSchema, origin: z.enum(['independent-agent', 'api', 'host']), independent: z.boolean(), authorshipHidden: z.boolean() }).strict(),
  overall: z.enum(['A', 'B', 'tie', 'both-bad', 'uncertain']),
  adequacy: z.object({ A: z.enum(['adequate', 'inadequate', 'uncertain']), B: z.enum(['adequate', 'inadequate', 'uncertain']) }).strict(),
  axes: z.object({ hierarchy: winnerSchema, space: winnerSchema, grouping: winnerSchema, typography: winnerSchema, roleFit: winnerSchema }).strict(),
  observations: z.array(z.object({ side: sideSchema, region: regionSchema, observation: z.string().min(12), consequence: z.string().min(12) }).strict()).min(2),
  reading: z.array(z.object({ side: sideSchema, questionId: identifierSchema, answer: z.string().min(1), region: regionSchema }).strict()).min(2),
  assessments: z.array(z.object({ side: sideSchema, criterionId: identifierSchema,
    verdict: z.enum(['satisfied', 'problem', 'uncertain']), region: regionSchema, rationale: z.string().min(12) }).strict()).optional()
}).strict();
export type Review = z.infer<typeof reviewSchema>;
export const feedbackSchema = z.object({ imageSha256: digestSchema, role: identifierSchema, label: z.enum(['accepted', 'rejected', 'pending']),
  origin: z.literal('human'), evidence: z.string().min(1), progress: z.enum(['improved', 'unchanged', 'worse']).optional() }).strict();
export type Feedback = z.infer<typeof feedbackSchema>;
