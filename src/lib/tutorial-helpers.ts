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
  const marginTop = options?.topOffset ?? (isMobile ? 80 : 60);
  const reservedBottom = options?.bottomOffset ?? (isMobile ? 380 : 60);

  // Calcula a posição ideal para centralizar o elemento na área visível
  const visibleAreaHeight = viewportHeight - marginTop - reservedBottom;
  const targetTop = marginTop + (visibleAreaHeight / 2) - (rect.height / 2);
  const scrollAmount = rect.top - targetTop;

  if (Math.abs(scrollAmount) > 10) {
    try {
      window.scrollBy({
        top: scrollAmount,
        behavior: "smooth",
      });
      
      // Aguarda um pouco para o scroll completar
      return new Promise(resolve => setTimeout(resolve, 300));
    } catch (_error) {
      window.scrollBy(0, scrollAmount);
    }
  }
};
