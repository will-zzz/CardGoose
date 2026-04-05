import { Group as KonvaGroup, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type { LayoutNode, LayoutStateV2 } from '../types/layout';
import { applyTemplate } from '../lib/template';
import { isVisible } from '../lib/layoutTree';
import { useImageElement } from './useImageElement';

function RectEl({
  el,
}: {
  el: Extract<LayoutNode, { type: 'rect' }>;
}) {
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
  el: Extract<LayoutNode, { type: 'text' }>;
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
  el: Extract<LayoutNode, { type: 'image' }>;
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
  node: LayoutNode;
  row: Record<string, string>;
  assetUrls: Record<string, string>;
}) {
  if (!isVisible(node)) return null;
  if (node.type === 'group') {
    return (
      <KonvaGroup x={node.x} y={node.y} rotation={node.rotation ?? 0}>
        {node.children.map((c) => (
          <CardNode key={c.id} node={c} row={row} assetUrls={assetUrls} />
        ))}
      </KonvaGroup>
    );
  }
  if (node.type === 'rect') return <RectEl el={node} />;
  if (node.type === 'text') return <TextEl el={node} row={row} />;
  return <ImageEl el={node} assetUrls={assetUrls} />;
}

export function CardFace({
  state,
  row,
  assetUrls,
  pixelWidth,
}: {
  state: LayoutStateV2;
  row: Record<string, string>;
  assetUrls: Record<string, string>;
  pixelWidth: number;
}) {
  const scale = pixelWidth / state.width;
  const pixelHeight = state.height * scale;
  const bg = state.background ?? '#1e1e24';

  return (
    <Stage width={pixelWidth} height={pixelHeight}>
      <Layer>
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
