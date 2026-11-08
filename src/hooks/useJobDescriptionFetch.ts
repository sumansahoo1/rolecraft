'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  createJobFetchController,
  type JobFetchController,
  type JobFetchStartOptions,
} from '@/lib/jd-link/controller';
import { fetchJobDescription } from '@/lib/jd-link/extract';
import { initialJobFetchState, reduceJobFetch } from '@/lib/jd-link/state';

export function useJobDescriptionFetch() {
  const [state, dispatch] = useReducer(reduceJobFetch, initialJobFetchState);
  const mountedRef = useRef(true);
  const controllerRef = useRef<JobFetchController | null>(null);

  // Create the controller in an effect so no ref is read during render
  // (react-hooks/refs). Event handlers run after this effect has committed.
  useEffect(() => {
    mountedRef.current = true;
    const controller = createJobFetchController({
      dispatch,
      fetchJobDescription,
      isMounted: () => mountedRef.current,
    });
    controllerRef.current = controller;
    return () => {
      mountedRef.current = false;
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const fetchJob = useCallback((input: string, options: JobFetchStartOptions) => {
    const controller = controllerRef.current;
    if (!controller) return Promise.resolve(null);
    return controller.start(input, options);
  }, []);
  const cancel = useCallback(() => controllerRef.current?.cancel(), []);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    attemptedUrl: state.attemptedUrl,
    fetchJob,
    cancel,
  };
}
