import { buildAttribution } from './core/attribution.js';
import { templatePath } from './core/path-template.js';
import type { Tracker } from './tracker.js';

export const PAGE_VIEW = 'page_view';

export interface PageLocation {
  readonly pathname: string;
  readonly search: string;
  readonly hostname: string;
}

export interface PageViewDependencies {
  readonly location: () => PageLocation;
  readonly referrer: string;
  readonly watch: (onNavigate: () => void) => () => void;
  readonly guard: (action: () => void) => void;
}

export function startPageViews(
  tracker: Tracker,
  pathRules: readonly string[],
  deps: PageViewDependencies,
): () => void {
  let lastPath: string | undefined;
  let referrer: string | undefined = deps.referrer;

  const recordPageView = (): void => {
    const { pathname, search, hostname } = deps.location();
    const path = templatePath(pathname, pathRules);
    if (path === lastPath) {
      return;
    }
    lastPath = path;
    const entryAttribution = buildAttribution({ search, referrer, ownHost: hostname });
    referrer = undefined;
    tracker.enqueue({ name: PAGE_VIEW, path, entryAttribution });
  };

  deps.guard(recordPageView);
  return deps.watch(() => {
    deps.guard(recordPageView);
  });
}
