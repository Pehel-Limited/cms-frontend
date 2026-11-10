'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'denied'
  | 'unsupported'
  | 'error';

const MAX_RECORDING_MS = 15_000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

/**
 * Microphone capture for the voice flow. Nothing is recorded until the customer taps the mic, the
 * tracks are always released on stop, and a recording is capped at 15 seconds. When the browser has
 * no microphone support or access is refused, `state` says so and the caller falls back to typing.
 */
export function useVoiceRecorder(onRecorded: (audio: Blob) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onRecorded);
  callbackRef.current = onRecorded;

  const release = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setState('unsupported');
      return;
    }
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        release();
        setState('idle');
        if (blob.size > 0) callbackRef.current(blob);
      };
      recorder.onerror = () => {
        release();
        setState('error');
      };
      recorderRef.current = recorder;
      recorder.start();
      setState('recording');
      timerRef.current = setTimeout(stop, MAX_RECORDING_MS);
    } catch (err) {
      release();
      const name = (err as { name?: string })?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }, [release, stop]);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      release();
    },
    [release]
  );

  return { state, start, stop };
}
