type ScrollOptions = {
  bottomOffset?: number;
  topOffset?: number;
};

export const scrollElementIntoView = (element: HTMLElement, options?: ScrollOptions) => {
  if (
    typeof window === "undefined" ||
    typeof element?.getBoundingClientRect !== "function"
  ) {
    return;
  }

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const isMobile = viewportWidth <= 520;
  const marginTop = options?.topOffset ?? (isMobile ? 40 : 60);
  const marginSide = 16;
  const reservedBottom = options?.bottomOffset ?? (isMobile ? 320 : 60);
  const maxBottom = viewportHeight - reservedBottom;

  const needsScroll =
    rect.top < marginTop ||
    rect.bottom > maxBottom ||
    rect.left < marginSide ||
    rect.right > viewportWidth - marginSide;

  if (needsScroll) {
    const offsetTop = rect.top < marginTop ? rect.top - marginTop : 0;
    const offsetBottom = rect.bottom > maxBottom ? rect.bottom - maxBottom : 0;
    const deltaY = offsetTop !== 0 ? offsetTop : offsetBottom;

    try {
      window.scrollBy({
        top: deltaY,
        behavior: "smooth",
      });
    } catch (_error) {
      window.scrollBy(0, deltaY);
    }
  }

  if (!needsScroll) {
    try {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    } catch (_error) {
      element.scrollIntoView();
    }
  }
};
