import { useEffect, useState } from 'react';

export function useImageElement(url: string | undefined): CanvasImageSource | null {
  const [loaded, setLoaded] = useState<{ u: string; img: CanvasImageSource } | null>(null);

  useEffect(() => {
    if (!url) {
      return () => {
        setLoaded(null);
      };
    }
    let cancelled = false;
    const i = new window.Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => {
      if (!cancelled) setLoaded({ u: url, img: i });
    };
    i.onerror = () => {
      if (!cancelled) setLoaded(null);
    };
    i.src = url;
    return () => {
      cancelled = true;
      i.onload = null;
      i.onerror = null;
      setLoaded(null);
    };
  }, [url]);

  if (!url) return null;
  return loaded?.u === url ? loaded.img : null;
}
