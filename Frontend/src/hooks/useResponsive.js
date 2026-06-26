import { useEffect, useState } from "react";

export function useResponsive() {
  const getWidth = () => window.innerWidth;

  const [width, setWidth] = useState(getWidth());

  useEffect(() => {
    const handleResize = () => {
      setWidth(getWidth());
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    width,

    isMobile: width < 768,

    isTablet: width >= 768 && width < 1024,

    isDesktop: width >= 1024,
  };
}
