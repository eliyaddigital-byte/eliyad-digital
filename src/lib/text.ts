const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** ממיר [[טקסט]] להדגשת מרקר. כל השאר עובר escaping. */
export function mark(s: string): string {
  return esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="mark">$1</span>');
}
/** טקסט נקי (ללא סימוני [[ ]]) – ל-meta ו-schema */
export function plain(s: string): string {
  return s.replace(/\[\[(.+?)\]\]/g, '$1');
}
export const withBase = (p: string) => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${p.replace(/^\//, '')}`;
