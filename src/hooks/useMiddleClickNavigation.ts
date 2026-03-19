import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to handle middle-click (scroll wheel click) on links to open them in a new tab
 * Supports:
 * - Standard <a> tags with href attributes
 * - Clickable elements with data-navigate-to attributes
 * - External links (http/https/mailto/tel)
 */
export function useMiddleClickNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      // Only handle middle-click (button 1)
      if (event.button !== 1) return;

      const target = event.target as HTMLElement;

      // Check for data-navigate-to attribute on the clicked element or parents
      const navigableElement = target.closest('[data-navigate-to]') as HTMLElement | null;

      if (navigableElement) {
        const path = navigableElement.getAttribute('data-navigate-to');
        if (path) {
          // Check if it's an external link
          if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('mailto:') || path.startsWith('tel:')) {
            // For external links, let the browser handle it naturally
            return;
          }

          // For internal routes, open in a new tab
          const newUrl = new URL(path, window.location.origin);
          window.open(newUrl.toString(), '_blank');
          event.preventDefault();
        }
        return;
      }

      // Find the nearest anchor tag
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');

        if (href) {
          // Check if it's an external link
          if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            // For external links, let the browser handle it naturally
            return;
          }

          // For internal routes, open in a new tab
          const newUrl = new URL(href, window.location.origin);
          window.open(newUrl.toString(), '_blank');
          event.preventDefault();
        }
      }
    };

    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [navigate]);
}
