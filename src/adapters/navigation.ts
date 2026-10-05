export interface NavigationTarget {
  readonly history: History;
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
}

export function watchNavigation(onNavigate: () => void, target: NavigationTarget): () => void {
  const { history } = target;
  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<History['pushState']>) => {
    pushState(...args);
    onNavigate();
  };
  history.replaceState = (...args: Parameters<History['replaceState']>) => {
    replaceState(...args);
    onNavigate();
  };
  target.addEventListener('popstate', onNavigate);
  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    target.removeEventListener('popstate', onNavigate);
  };
}
