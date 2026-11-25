/*
 * Detection profile for Luma's native check-in success toast.
 *
 * Evidence, from reading Luma's own scan-page bundle (no guest data touched):
 *   - Every toast is a react-hot-toast bar: <div style="background-color: var(--...-bg-color)"> containing
 *     a message element with role="status".
 *   - Standard-mode / guest-drawer check-in shows the fixed text "已签到。" (observed).
 *   - Express (快速) mode POSTs /event/admin/check-in/express and, on status "success", shows the
 *     SERVER-provided message in a success-styled toast (bar background var(--success-bg-color)).
 *     That message is not the fixed "已签到。" text, which is why Express mode never celebrated.
 *   - Failures use var(--error-bg-color) and "already checked in" / "open guest" use the neutral
 *     primary-colour toast, so they are never success-styled.
 *   - Removing a check-in ("Removed check in.") is ALSO a success-styled toast, so removal wording is
 *     explicitly excluded.
 *
 * Rule: success = a role="status" element that is either (a) exactly "已签到。", or (b) non-empty, inside a
 * bar whose inline style uses --success-bg-color, and whose text carries no removal/undo wording.
 * count = how many such elements are visible right now. Text is never stored, logged or sent anywhere.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUCCESS_TEXT = '已签到。';
  const SUCCESS_STYLE = 'var(--success-bg-color)';
  const REMOVAL = /撤销|撤消|取消|移除|删除|undo|remov|uncheck|cancel|revok|revert/i;

  function isSuccessToast(el) {
    const text = (el.textContent || '').trim();
    if (!text) return false;
    if (text === SUCCESS_TEXT) return true;
    if (REMOVAL.test(text)) return false;
    const bar = el.parentElement;
    const style = bar && typeof bar.getAttribute === 'function' ? bar.getAttribute('style') : null;
    return typeof style === 'string' && style.includes(SUCCESS_STYLE);
  }

  const profile = {
    id: 'luma-native-success-toast-zh-v1',
    verified: true,
    read(root) {
      let count = 0;
      for (const el of root.querySelectorAll('[role="status"]')) {
        if (isSuccessToast(el)) count += 1;
      }
      return count ? { state: 'success', count } : { state: 'idle' };
    },
  };

  return { profile, SUCCESS_TEXT };
});
