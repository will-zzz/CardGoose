import { useEffect, useState } from 'react';

export function useImageElement(url: string | undefined): CanvasImageSource | null {
  const [loaded, setLoaded] = useState<{ u: string; img: CanvasImageSource } | null>(null);

  useEffect(() => {
    if (!url) return;
    const i = new window.Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => setLoaded({ u: url, img: i });
    i.onerror = () => setLoaded(null);
    i.src = url;
    return () => {
      i.onload = null;
      i.onerror = null;
    };
  }, [url]);

  if (!url) return null;
  return loaded?.u === url ? loaded.img : null;
}
