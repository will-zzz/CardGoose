import { useEffect, useState } from 'react';

export function useImageElement(url: string | undefined): CanvasImageSource | null {
  const [img, setImg] = useState<CanvasImageSource | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const i = new window.Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => setImg(i);
    i.onerror = () => setImg(null);
    i.src = url;
    return () => {
      i.onload = null;
      i.onerror = null;
    };
  }, [url]);
  return img;
}
