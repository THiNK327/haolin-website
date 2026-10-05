'use client';
import { lazy, type ComponentType } from 'react';
import type { VerificationProps, WorkspaceProps } from '../../lib/playground/types';

/** Lazy imports keep each tool's examples out of the catalog and other tool bundles. */
export const exampleModules: Partial<Record<string, ComponentType>> = {
  crasdi: lazy(() => import('./crasdi-example')),
};

/** Register a real workspace before setting its interactive status to available. */
export const interactiveModules: Partial<Record<string, ComponentType<WorkspaceProps>>> = {};

/** Future email/login/challenge UIs go here. No provider or verification service is enabled. */
export const verificationProviders: Partial<Record<string, ComponentType<VerificationProps>>> = {};
