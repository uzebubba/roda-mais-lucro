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
  
  // Detecta se é elemento da barra inferior (bottomNav)
  const isBottomElement = rect.top > viewportHeight * 0.75;
  
  const marginTop = options?.topOffset ?? (isMobile ? 80 : 60);
  const reservedBottom = options?.bottomOffset ?? (isMobile ? (isBottomElement ? 300 : 380) : 60);

  // Para elementos na barra inferior, mantém visível sem scroll excessivo
  if (isBottomElement && isMobile) {
    const elementBottom = rect.bottom;
    const visibleBottom = viewportHeight - 100; // Deixa espaço para o tooltip acima
    
    if (elementBottom > visibleBottom) {
      const scrollAmount = elementBottom - visibleBottom;
      try {
        window.scrollBy({
          top: scrollAmount,
          behavior: "smooth",
        });
        return new Promise(resolve => setTimeout(resolve, 300));
      } catch (_error) {
        window.scrollBy(0, scrollAmount);
      }
    }
    return;
  }

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
