'use client';

import { useEffect, useRef, useState } from 'react';
import { missionStreamUrl } from '@/lib/api';
import type {
  MissionBeatDescriptor,
  MissionStreamEvent,
  ScenarioResult,
} from '@/lib/types';

type MissionPhase =
  | 'idle'
  | 'connecting'
  | 'running'
  | 'complete'
  | 'failed'
  | 'aborted';

export interface TimelineBeat {
  index: number;
  kind: string;
  label: string;
  ts: string;
}

export interface MissionStreamState {
  phase: MissionPhase;
  snapshot: ScenarioResult | null;
  beats: TimelineBeat[];
  totalBeats: number | null;
  error: string | null;
}

const INITIAL: MissionStreamState = {
  phase: 'idle',
  snapshot: null,
  beats: [],
  totalBeats: null,
  error: null,
};

/**
 * Subscribe to a mission's server-sent event stream.
 *
 * The hook opens an :class:`EventSource` against
 * ``/missions/{runId}/stream`` and collapses the incoming frames into
 * a single :class:`MissionStreamState`. Components can render the
 * current snapshot + beat log without owning any SSE plumbing.
 *
 * Passing ``null`` for ``runId`` disables the subscription, letting
 * callers mount the hook before a run exists.
 */
export function useMissionStream(runId: string | null): MissionStreamState {
  const [state, setState] = useState<MissionStreamState>(INITIAL);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) {
      setState(INITIAL);
      return;
    }

    setState({ ...INITIAL, phase: 'connecting' });

    const es = new EventSource(missionStreamUrl(runId));
    esRef.current = es;

    const onMessage = (raw: MessageEvent) => {
      let parsed: MissionStreamEvent | null = null;
      try {
        parsed = JSON.parse(raw.data) as MissionStreamEvent;
      } catch {
        return;
      }
      if (!parsed) return;

      setState((prev) => applyEvent(prev, parsed!));

      // Close once we've seen a terminal frame.
      if (
        parsed.type === 'mission_complete' ||
        parsed.type === 'mission_failed' ||
        parsed.type === 'mission_aborted'
      ) {
        es.close();
      }
    };

    es.addEventListener('mission_started', onMessage);
    es.addEventListener('beat', onMessage);
    es.addEventListener('mission_complete', onMessage);
    es.addEventListener('mission_failed', onMessage);
    es.addEventListener('mission_aborted', onMessage);
    // Unknown / default event types fall through here (e.g. replay
    // frames the backend may add later).
    es.onmessage = onMessage;
    es.onerror = () => {
      setState((prev) =>
        prev.phase === 'running' || prev.phase === 'connecting'
          ? {
              ...prev,
              phase: 'failed',
              error: prev.error ?? 'Mission stream disconnected',
            }
          : prev,
      );
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [runId]);

  return state;
}

function applyEvent(
  prev: MissionStreamState,
  event: MissionStreamEvent,
): MissionStreamState {
  switch (event.type) {
    case 'mission_started':
      return {
        ...prev,
        phase: 'running',
        error: null,
      };
    case 'beat':
      return {
        ...prev,
        phase: 'running',
        snapshot: event.snapshot,
        totalBeats: event.beat_total,
        beats: appendBeat(prev.beats, event.beat_index, event.beat, event.ts),
      };
    case 'mission_complete':
      return {
        ...prev,
        phase: 'complete',
        snapshot: event.snapshot,
        error: null,
      };
    case 'mission_failed':
      return {
        ...prev,
        phase: 'failed',
        error: event.error,
      };
    case 'mission_aborted':
      return { ...prev, phase: 'aborted' };
    default:
      return prev;
  }
}

function appendBeat(
  beats: TimelineBeat[],
  index: number,
  descriptor: MissionBeatDescriptor,
  ts: string,
): TimelineBeat[] {
  // Guard against duplicate beat indices from replay + live overlap.
  if (beats.some((b) => b.index === index)) return beats;
  return [...beats, { index, kind: descriptor.kind, label: descriptor.label, ts }];
}
