import { useState, useEffect, useCallback, useRef } from 'react';

export const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Debounce function to limit the rate at which we check scroll position
  const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      const later = () => {
        timeout = null;
        func(...args);
      };
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const checkScroll = useCallback(() => {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const shouldBeVisible = scrollY > 300;
    
    if (shouldBeVisible !== isVisible) {
      setIsVisible(shouldBeVisible);
    }
  }, [isVisible]);

  // Debounced version of checkScroll
  const debouncedCheckScroll = useCallback(
    debounce(checkScroll, 100),
    [checkScroll]
  );

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    // Add scroll event listener
    window.addEventListener('scroll', debouncedCheckScroll, { passive: true });
    
    // Initial check
    checkScroll();
    
    return () => {
      window.removeEventListener('scroll', debouncedCheckScroll);
    };
  }, [checkScroll, debouncedCheckScroll]);

  return (
    <button
      ref={buttonRef}
      onClick={scrollToTop}
      className={`fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 z-[9999] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label="Scroll to top"
      style={{
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)'
      }}
    >
      <span className="block text-xl">↑</span>
    </button>
  );
};

export default ScrollToTop;
