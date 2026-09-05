/// <reference path="../.astro/types.d.ts" />
import type { Rhythm } from './lib/section-rhythm';

declare global {
  namespace App {
    interface Locals {
      /** Per-page section rhythm, created in src/middleware.ts. */
      rhythm: Rhythm;
      /** Citation keys in the order the body first cited them; drives References.astro. */
      citeOrder: string[];
    }
  }
}
export {};
