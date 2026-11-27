// Some mobile browsers resize only the visual viewport when the keyboard opens.
export function installMobileKeyboard() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement;
  const touch = matchMedia('(any-pointer: coarse)');
  let frame = 0;
  let layoutWidth = window.innerWidth;
  let restingHeight = window.innerHeight;
  const update = () => {
    frame = 0;
    const field = document.activeElement;
    const editable = field instanceof HTMLElement && (field.isContentEditable ||
      field.matches('textarea:not([readonly]):not([inputmode="none"]), input:is([type="text"],[type="search"],[type="email"],[type="url"],[type="tel"],[type="password"],[type="number"],:not([type])):not([readonly]):not([inputmode="none"])'));
    const height = window.innerHeight;
    if (layoutWidth !== window.innerWidth || !editable) {
      layoutWidth = window.innerWidth;
      restingHeight = height;
    } else {
      restingHeight = Math.max(restingHeight, height);
    }
    const inset = restingHeight - viewport.height;
    if (!touch.matches || !editable || Math.abs(viewport.scale - 1) > .01 || inset < 80) {
      root.style.removeProperty('--spire-keyboard-height');
      root.style.removeProperty('--spire-keyboard-top');
      root.removeAttribute('data-keyboard-open');
      return;
    }
    root.style.setProperty('--spire-keyboard-height', `${viewport.height}px`);
    root.style.setProperty('--spire-keyboard-top', `${viewport.offsetTop}px`);
    root.setAttribute('data-keyboard-open', '');
    const bounds = field.getBoundingClientRect();
    const selection = field.isContentEditable ? getSelection() : null;
    let target = bounds;
    if (selection?.focusNode && field.contains(selection.focusNode) && selection.rangeCount) {
      const caret = document.createRange();
      caret.setStart(selection.focusNode, selection.focusOffset);
      const rect = caret.getBoundingClientRect();
      if (rect.height) target = rect;
    }
    const top = viewport.offsetTop + 8;
    const bottom = viewport.offsetTop + viewport.height - 8;
    if (target.bottom <= bottom && target.top >= top) return;
    if (target === bounds) {
      field.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
      return;
    }
    // A rich editor can be taller than the screen: reveal the caret, not the whole editor.
    for (let parent = field.parentElement; parent; parent = parent.parentElement) {
      if (!/auto|scroll/.test(getComputedStyle(parent).overflowY) || parent.scrollHeight <= parent.clientHeight) continue;
      const box = parent.getBoundingClientRect();
      const upper = Math.max(top, box.top + 8), lower = Math.min(bottom, box.bottom - 8);
      if (lower <= upper) continue;
      const delta = target.bottom > lower ? target.bottom - lower : Math.min(0, target.top - upper);
      const before = parent.scrollTop;
      parent.scrollTop += delta;
      const moved = parent.scrollTop - before;
      if (moved) target = new DOMRect(target.x, target.y - moved, target.width, target.height);
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  for (const event of ['focusin', 'focusout', 'input', 'selectionchange']) document.addEventListener(event, schedule);
}
