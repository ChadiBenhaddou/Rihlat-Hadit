/**
 * Shared payload contracts (SPEC §10). The Worker, the client and the tests
 * all validate against these schemas; change them here only.
 */
import { z } from 'zod';

export const ReviewStatus = z.enum(['auto', 'in_review', 'reviewed', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const LinkKind = z.enum(['connected', 'suspended', 'gap', 'uncertain']);
export type LinkKind = z.infer<typeof LinkKind>;

export const Terminus = z.enum(['prophet', 'companion', 'successor', 'other']);
export type Terminus = z.infer<typeof Terminus>;

export const NodeRole = z.enum(['prophet', 'companion', 'narrator', 'compiler', 'unresolved']);
export type NodeRole = z.infer<typeof NodeRole>;

/** 'n:<narratorId>' for a resolved narrator, 'u:<chainId>:<position>' for an unresolved mention. */
export const NodeId = z.string().regex(/^(n:\d+|u:\d+:\d+)$/);

/**
 * A research aid, never a verdict (SPEC §13). Every indicator states its
 * inputs, a one-sentence formula and its scope. No combined score exists.
 */
export const Indicator = z.object({
  key: z.enum([
    'contemporaneity',
    'shared_places',
    'transmission_phrase',
    'tadlis_anana',
    'chain_length',
    'common_link',
    'layer_counts',
    'gaps',
  ]),
  labelAr: z.string(),
  formulaAr: z.string(),
  scopeAr: z.string(),
  inputs: z.array(
    z.object({ labelAr: z.string(), value: z.string().nullable(), citationIds: z.array(z.number().int()) }),
  ),
  valueAr: z.string(),
  nodeIds: z.array(NodeId).optional(),
});
export type Indicator = z.infer<typeof Indicator>;

export const Citation = z.object({
  id: z.number().int(),
  sourceSlug: z.string(),
  locator: z.string().optional(),
  url: z.url().optional(),
});
export type Citation = z.infer<typeof Citation>;

export const GraphNode = z.object({
  id: NodeId,
  narratorId: z.number().int().optional(),
  slug: z.string().optional(),
  nameAr: z.string(),
  honorificAr: z.string().optional(),
  role: NodeRole,
  tabaqa: z.number().int().optional(),
  birthAh: z.number().int().optional(),
  deathAh: z.number().int().optional(),
  deathAhMax: z.number().int().optional(),
  summaryGradeAr: z.string().optional(),
  citationIds: z.array(z.number().int()),
  reviewStatus: ReviewStatus,
});
export type GraphNode = z.infer<typeof GraphNode>;

/** Teacher → student: the direction of transmission. */
export const GraphEdge = z.object({
  from: NodeId,
  to: NodeId,
  termAr: z.string().optional(),
  kind: LinkKind,
  chainIds: z.array(z.number().int()).min(1),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const GraphChain = z.object({
  id: z.number().int(),
  hadithNumber: z.number().int(),
  routeNo: z.number().int(),
  /** index 0 = the compiler, last = the source. */
  nodeIds: z.array(NodeId).min(1),
  isSuspended: z.boolean(),
  terminus: Terminus,
});
export type GraphChain = z.infer<typeof GraphChain>;

export const IsnadGraph = z.object({
  dataVersion: z.string(),
  scope: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('hadith'), collection: z.string(), number: z.number().int() }),
    z.object({ kind: z.literal('group'), groupId: z.number().int() }),
  ]),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  chains: z.array(GraphChain),
  indicators: z.array(Indicator),
  citations: z.array(Citation),
});
export type IsnadGraph = z.infer<typeof IsnadGraph>;

export const VersionResponse = z.object({ dataVersion: z.string() });
export type VersionResponse = z.infer<typeof VersionResponse>;

/** RFC 9457 problem details. */
export const ProblemDetails = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetails>;
