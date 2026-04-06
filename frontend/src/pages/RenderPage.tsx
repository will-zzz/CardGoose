import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Layer as KonvaLayer } from 'konva';
import { CardFace } from '../components/CardFace';
import { ensureLayoutState, type LayoutStateV2 } from '../types/layout';

export type HeadlessRenderPayload = {
  layout: unknown;
  row: Record<string, string>;
  assetUrls: Record<string, string>;
  pixelWidth: number;
};

function preloadUrls(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          if (!url) {
            resolve();
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  ).then(() => undefined);
}

type CardFrame = {
  state: LayoutStateV2;
  row: Record<string, string>;
  assetUrls: Record<string, string>;
  pixelWidth: number;
};

type HeadlessWindow = Window &
  typeof globalThis & {
    __CF_RENDER_READY__?: boolean;
    __CF_HEADLESS_DONE?: boolean;
    __CF_HEADLESS_ERROR?: string | null;
  };

/**
 * Headless card render target for the PDF worker (Playwright).
 * The worker dispatches `cf-render` with payload detail (short sync evaluate), then polls
 * `window.__CF_HEADLESS_DONE` — avoids long async `page.evaluate`, which breaks if the tab
 * reloads (Vite HMR) or the execution context is torn down mid-await.
 */
export function RenderPage() {
  const layerRef = useRef<KonvaLayer>(null);
  const [card, setCard] = useState<CardFrame | null>(null);
  const cardRef = useRef<CardFrame | null>(null);
  cardRef.current = card;
  const pendingResolve = useRef<
    ((v: { ok: true; width: number; height: number }) => void) | null
  >(null);

  const finishFrame = useCallback(() => {
    const resolve = pendingResolve.current;
    const c = cardRef.current;
    if (!resolve || !c) return;
    console.info('[CF] finishFrame (canvas ready)');
    pendingResolve.current = null;
    const scale = c.pixelWidth / c.state.width;
    const pixelHeight = c.state.height * scale;
    resolve({ ok: true, width: c.pixelWidth, height: pixelHeight });
  }, []);

  useLayoutEffect(() => {
    if (!card) return;
    const layer = layerRef.current;
    if (!layer) return;

    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          finishFrame();
        });
      });
    };

    // Konva 10 removed Node#once — use on + off (see Konva upgrade / Node.d.ts).
    const onAfterDraw = () => {
      layer.off('afterDraw', onAfterDraw);
      run();
    };
    layer.on('afterDraw', onAfterDraw);
    layer.batchDraw();

    const t = window.setTimeout(() => {
      layer.off('afterDraw', onAfterDraw);
      run();
    }, 3000);

    return () => {
      window.clearTimeout(t);
      layer.off('afterDraw', onAfterDraw);
    };
  }, [card, finishFrame]);

  const runRender = useCallback(async (payload: HeadlessRenderPayload) => {
    const state = ensureLayoutState(payload.layout);
    const urls = Object.values(payload.assetUrls ?? {}).filter(Boolean);
    console.info('[CF] preload start', { urlCount: urls.length, pixelWidth: payload.pixelWidth });
    await preloadUrls(urls);
    console.info('[CF] preload done');
    return new Promise<{ ok: true; width: number; height: number }>((resolve, reject) => {
      try {
        pendingResolve.current = resolve;
        console.info('[CF] setCard');
        setCard({
          state,
          row: payload.row,
          assetUrls: payload.assetUrls ?? {},
          pixelWidth: Math.max(32, Math.round(payload.pixelWidth)),
        });
      } catch (e) {
        pendingResolve.current = null;
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }, []);

  useEffect(() => {
    const w = window as HeadlessWindow;

    const onCfRender = async (e: Event) => {
      const ce = e as CustomEvent<HeadlessRenderPayload>;
      w.__CF_HEADLESS_ERROR = null;
      console.info('[CF] cf-render handler start');
      try {
        await runRender(ce.detail);
        console.info('[CF] cf-render handler done');
        w.__CF_HEADLESS_DONE = true;
      } catch (err) {
        w.__CF_HEADLESS_ERROR = err instanceof Error ? err.message : String(err);
        w.__CF_HEADLESS_DONE = true;
      }
    };

    window.addEventListener('cf-render', onCfRender);

    const readyTimer = window.setTimeout(() => {
      w.__CF_RENDER_READY__ = true;
    }, 0);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('cf-render', onCfRender);
      w.__CF_RENDER_READY__ = false;
    };
  }, [runRender]);

  if (!card) {
    return (
      <div
        className="render-page-root"
        style={{ minHeight: 1, minWidth: 1, background: 'transparent' }}
        aria-hidden
      />
    );
  }

  return (
    <div className="render-page-root" style={{ lineHeight: 0, background: '#ffffff' }}>
      <CardFace
        state={card.state}
        row={card.row}
        assetUrls={card.assetUrls}
        pixelWidth={card.pixelWidth}
        layerRef={layerRef}
      />
    </div>
  );
}
