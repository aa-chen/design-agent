import { z } from 'zod';

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

const baseSchema = {
  id: z.string().min(1, 'id 不能为空'),
  layer: z.string().optional(),
  color: z.string().optional(),
  visible: z.boolean().optional(),
  lineStyle: z.enum(['solid', 'dashed']).optional(),
};

export const elementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('line'),
    from: vec3Schema,
    to: vec3Schema,
    ...baseSchema,
  }),
  z.object({
    type: z.literal('polyline'),
    points: z.array(vec3Schema).min(2, 'polyline 至少需要 2 个点'),
    closed: z.boolean().optional(),
    ...baseSchema,
  }),
  z.object({
    type: z.literal('circle'),
    center: vec3Schema,
    radius: z.number().positive('半径必须为正数'),
    ...baseSchema,
  }),
  z.object({
    type: z.literal('arc'),
    center: vec3Schema,
    radius: z.number().positive('半径必须为正数'),
    startAngle: z.number(),
    endAngle: z.number(),
    ...baseSchema,
  }),
  z.object({
    type: z.literal('rect'),
    min: vec3Schema,
    max: vec3Schema,
    ...baseSchema,
  }),
  z.object({
    type: z.literal('text'),
    position: vec3Schema,
    content: z.string(),
    height: z.number().optional(),
    rotation: z.number().optional(),
    ...baseSchema,
  }),
]);

export const annotationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('dimension'),
    from: vec3Schema,
    to: vec3Schema,
    offset: vec3Schema,
    text: z.string().optional(),
    textHeight: z.number().optional(),
    ...baseSchema,
  }),
  z.object({
    type: z.literal('text'),
    position: vec3Schema,
    content: z.string(),
    height: z.number().optional(),
    rotation: z.number().optional(),
    ...baseSchema,
  }),
]);

export const cadPartSchema = z.object({
  id: z.string().min(1, '零件 id 不能为空'),
  name: z.string(),
  elementIds: z.array(z.string()),
});

export const cadModelSchema = z.object({
  version: z.string(),
  name: z.string(),
  unit: z.enum(['mm', 'inch']).optional(),
  parts: z.array(cadPartSchema).default([]),
  elements: z.array(elementSchema),
  annotations: z.array(annotationSchema).default([]),
});

export type CadModelSchema = z.infer<typeof cadModelSchema>;
