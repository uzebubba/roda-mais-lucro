export const scrollElementIntoView = (element: HTMLElement) => {
  if (
    typeof window === "undefined" ||
    typeof element?.scrollIntoView !== "function"
  ) {
    return;
  }

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const margin = 72;

  const needsScroll =
    rect.top < margin ||
    rect.bottom > viewportHeight - margin ||
    rect.left < 16 ||
    rect.right > viewportWidth - 16;

  if (needsScroll) {
    try {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    } catch (_error) {
      // Fallback without smooth behavior
      element.scrollIntoView();
    }
  }
};
