export function isMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.parent !== window;
}

export function getMiniAppContext() {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  return {
    fid: urlParams.get('fid'),
    username: urlParams.get('username'),
    displayName: urlParams.get('displayName'),
  };
}