export function onPageHide(
  listener: () => void,
  doc: Document = document,
  win: Window = window,
): () => void {
  const onVisibilityChange = () => {
    if (doc.visibilityState === 'hidden') {
      listener();
    }
  };
  doc.addEventListener('visibilitychange', onVisibilityChange);
  win.addEventListener('pagehide', listener);
  return () => {
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    win.removeEventListener('pagehide', listener);
  };
}
