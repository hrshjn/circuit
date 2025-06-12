/**
 * Builds the most stable selector for an element, preferring attributes that
 * are less likely to change between sessions.
 */
export function bestSelector(el: Element): string {
  // 1. Check for stable ID (not dynamic/generated)
  const id = el.getAttribute('id');
  if (id && !/(\d{4,}|floating-ui|generated|dynamic|temp)/.test(id)) {
    return `#${CSS.escape(id)}`;
  }

  // 2. Prefer data-testid (most stable for testing)
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // 3. Use aria-label (stable for accessibility)
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    return `[aria-label="${CSS.escape(ariaLabel)}"]`;
  }

  // 4. Role with text content
  const role = el.getAttribute('role');
  const text = (el as HTMLElement).innerText?.trim().substring(0, 30);
  if (role && text) {
    return `[role="${role}"]:has-text("${text}")`;
  }

  // 5. Class-based selector (if classes look stable)
  const classList = Array.from(el.classList);
  const stableClasses = classList.filter(c => 
    !c.match(/\d{2,}/) && // No generated numbers
    !c.includes('--') &&  // No BEM modifiers
    c.length > 3          // Not too short
  );
  
  if (stableClasses.length > 0 && text) {
    const classSelector = stableClasses.map(c => `.${CSS.escape(c)}`).join('');
    return `${el.tagName.toLowerCase()}${classSelector}:has-text("${text}")`;
  }

  // 6. Fallback: tag + text
  if (text) {
    return `${el.tagName.toLowerCase()}:has-text("${text}")`;
  }

  // 7. Last resort: nth-child (least stable)
  const parent = el.parentElement;
  if (parent) {
    const index = Array.from(parent.children).indexOf(el);
    return `${parent.tagName.toLowerCase()} > ${el.tagName.toLowerCase()}:nth-child(${index + 1})`;
  }

  return ''; // No good selector found
}

/**
 * Scroll to bottom of page to trigger lazy-loaded content
 */
export async function lazyScroll(page: any) {
  await page.evaluate(async () => {
    let lastScrollY = 0;
    for (let i = 0; i < 5; i++) {
      window.scrollBy(0, window.innerHeight);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const currentScrollY = window.scrollY;
      if (currentScrollY === lastScrollY) break; // No more content to load
      lastScrollY = currentScrollY;
    }
    
    // Scroll back to top for consistent screenshots
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 200));
  });
} 