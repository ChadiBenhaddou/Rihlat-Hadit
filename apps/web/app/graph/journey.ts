/** Journey state (SPEC §12 ب). Everything lives in the URL so any view can be shared. */
import type { IsnadGraph } from '@isnad/shared';

export type Direction = 'trace' | 'journey'; // تتبّع الإسناد: from al-Bukhari up · رحلة النقل: from the source down

export interface JourneyState {
  active: boolean;
  routeId: number | null;
  dir: Direction;
  step: number;
  speed: number;
}

export function readJourney(params: URLSearchParams, g: IsnadGraph): JourneyState {
  const route = Number(params.get('route'));
  // Default to the first connected route; a suspended one only when every route is suspended.
  const fallback = (g.chains.find((c) => !c.isSuspended) ?? g.chains[0])?.id ?? null;
  const routeId = g.chains.some((c) => c.id === route) ? route : fallback;
  const speed = Number(params.get('speed'));
  return {
    active: params.get('mode') === 'journey',
    routeId,
    dir: params.get('dir') === 'journey' ? 'journey' : 'trace',
    step: Math.max(0, Number(params.get('step')) || 0),
    speed: [0.5, 1, 2].includes(speed) ? speed : 1,
  };
}

/** Node ids of the route in the order the journey visits them. */
export function journeyOrder(g: IsnadGraph, s: JourneyState): string[] {
  const c = g.chains.find((x) => x.id === s.routeId);
  if (!c) return [];
  return s.dir === 'trace' ? [...c.nodeIds] : [...c.nodeIds].reverse();
}

export const STEP_MS = 1200;
