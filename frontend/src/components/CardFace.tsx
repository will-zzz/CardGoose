import type { Ref } from 'react';
import type { Layer as KonvaLayer } from 'konva/lib/Layer';
import { Group as KonvaGroup, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type { LayoutElement, LayoutStateV2 } from '../types/layout';
import { applyTemplate } from '../lib/template';
import { isVisible } from '../lib/layoutTree';
import { useImageElement } from './useImageElement';

function RectEl({ el }: { el: Extract<LayoutElement, { type: 'rect' }> }) {
  return (
    <Rect
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      fill={el.fill}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth ?? 0}
      rotation={el.rotation ?? 0}
    />
  );
}

function TextEl({
  el,
  row,
}: {
  el: Extract<LayoutElement, { type: 'text' }>;
  row: Record<string, string>;
}) {
  const text = applyTemplate(el.text, row);
  const fs = el.fontSize ?? 16;
  return (
    <Text
      x={el.x}
      y={el.y}
      width={el.width}
      text={text}
      fontSize={fs}
      fill={el.fill ?? '#f3f4f6'}
      align={el.align ?? 'left'}
      wrap="word"
      rotation={el.rotation ?? 0}
    />
  );
}

function ImageEl({
  el,
  assetUrls,
}: {
  el: Extract<LayoutElement, { type: 'image' }>;
  assetUrls: Record<string, string>;
}) {
  const url = assetUrls[el.artKey];
  const img = useImageElement(url);
  if (!img) {
    return (
      <Rect
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        fill="#2a2a32"
        stroke="#444"
        strokeWidth={1}
        rotation={el.rotation ?? 0}
      />
    );
  }
  return (
    <KonvaImage
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      image={img}
      rotation={el.rotation ?? 0}
    />
  );
}

function CardNode({
  node,
  row,
  assetUrls,
}: {
  node: LayoutElement;
  row: Record<string, string>;
  assetUrls: Record<string, string>;
}) {
  if (!isVisible(node)) return null;
  if (node.type === 'rect') return <RectEl el={node} />;
  if (node.type === 'text') return <TextEl el={node} row={row} />;
  return <ImageEl el={node} assetUrls={assetUrls} />;
}

export function CardFace({
  state,
  row,
  assetUrls,
  pixelWidth,
  layerRef,
}: {
  state: LayoutStateV2;
  row: Record<string, string>;
  assetUrls: Record<string, string>;
  pixelWidth: number;
  /** For headless export: observe draw completion */
  layerRef?: Ref<KonvaLayer>;
}) {
  const scale = pixelWidth / state.width;
  const pixelHeight = state.height * scale;
  const bg = state.background ?? '#1e1e24';

  return (
    <Stage width={pixelWidth} height={pixelHeight}>
      <Layer ref={layerRef}>
        <KonvaGroup scaleX={scale} scaleY={scale}>
          <Rect width={state.width} height={state.height} fill={bg} />
          {state.root.map((node) => (
            <CardNode key={node.id} node={node} row={row} assetUrls={assetUrls} />
          ))}
        </KonvaGroup>
      </Layer>
    </Stage>
  );
}
