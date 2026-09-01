export interface ElementSpec {
  className?: string;
  text?: string;
  /** Accessible name, for controls whose visible content is a shape or glyph. */
  label?: string;
  style?: Partial<CSSStyleDeclaration>;
  children?: (Node | null | undefined)[];
}

/**
 * Build an element. Text is always set via `textContent`, never innerHTML —
 * nothing in this app renders untrusted markup, and keeping it that way is
 * cheaper than auditing it later.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  spec: ElementSpec = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (spec.className) node.className = spec.className;
  if (spec.text !== undefined) node.textContent = spec.text;
  if (spec.label) node.setAttribute('aria-label', spec.label);
  if (spec.style) Object.assign(node.style, spec.style);
  for (const child of spec.children ?? []) {
    if (child) node.appendChild(child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  node.textContent = '';
}

/**
 * A tappable control. Always a real `<button>`, so it is keyboard reachable
 * and announced correctly.
 *
 * Pass a `signal` from anything that runs inside a session: a game's listeners
 * must not be able to outlive the game. Screens that replace their whole DOM
 * on every change — the setup screen — do not need one.
 */
export function button(
  spec: ElementSpec & { onTap: () => void; signal?: AbortSignal },
): HTMLButtonElement {
  const node = el('button', spec);
  node.type = 'button';
  node.addEventListener('click', spec.onTap, spec.signal ? { signal: spec.signal } : undefined);
  return node;
}
