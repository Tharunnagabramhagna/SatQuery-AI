import { useState } from 'react';
import type { GroundingBox } from '../../types/visualization';
import { toViewBoxBounds } from '../../mock/mockGrounding';

interface GroundingOverlayProps {
  boxes: GroundingBox[];
  visible: boolean;
  opacity: number;
  selectedGroundingId?: string | null;
  highlightedRegionId?: string | null;
  onSelectGrounding?: (groundingId: string, regionId: string) => void;
}

export function GroundingOverlay({
  boxes,
  visible,
  opacity = 90,
  selectedGroundingId,
  highlightedRegionId,
  onSelectGrounding,
}: GroundingOverlayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!visible || boxes.length === 0) return null;

  return (
    <g
      className="grounding-overlay-layer pointer-events-none transition-opacity duration-150"
      style={{ opacity: opacity / 100 }}
    >
      {boxes.map((box) => {
        // Derive exact SVG viewBox (800x500) bounds from single source of truth (normalized coordinates)
        const bounds = toViewBoxBounds(box.normalized, 800, 500);
        const isSelected = selectedGroundingId === box.id;
        const isHighlighted = highlightedRegionId === box.regionId;
        const isHovered = hoveredId === box.id;
        const isActive = isSelected || isHighlighted || isHovered;

        // Corner bracket marker size
        const bracketLen = Math.min(10, Math.min(bounds.width, bounds.height) / 3);
        const { x, y, width, height } = bounds;

        // Tag position: above the box, or flipped below if too close to top edge
        const tagHeight = 16;
        const tagY = y > 24 ? y - tagHeight - 3 : y + height + 3;
        const labelText = `${box.label} • Demo ${box.confidence}%`;
        const approxTagWidth = labelText.length * 6 + 14;

        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          onSelectGrounding?.(box.id, box.regionId);
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onSelectGrounding?.(box.id, box.regionId);
          }
        };

        return (
          <g
            key={box.id}
            className="grounding-item"
            onMouseEnter={() => setHoveredId(box.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Interactive Click Target Area */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill={isActive ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.04)'}
              stroke={isActive ? '#38bdf8' : 'rgba(56, 189, 248, 0.65)'}
              strokeWidth={isActive ? 2 : 1.2}
              strokeDasharray={isActive ? 'none' : '3 2'}
              rx={2}
              className="pointer-events-auto cursor-pointer transition-all duration-150 focus:outline-none"
              tabIndex={0}
              role="button"
              aria-label={`Grounding result: ${box.label}, Demo Confidence ${box.confidence}%`}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
            />

            {/* Precision Corner HUD Bracket Accents */}
            <path
              d={`
                M ${x} ${y + bracketLen} L ${x} ${y} L ${x + bracketLen} ${y}
                M ${x + width - bracketLen} ${y} L ${x + width} ${y} L ${x + width} ${y + bracketLen}
                M ${x} ${y + height - bracketLen} L ${x} ${y + height} L ${x + bracketLen} ${y + height}
                M ${x + width - bracketLen} ${y + height} L ${x + width} ${y + height} L ${x + width} ${y + height - bracketLen}
              `}
              fill="none"
              stroke={isActive ? '#67e8f9' : '#38bdf8'}
              strokeWidth={isActive ? 2 : 1.5}
              className="pointer-events-none"
            />

            {/* Quiet Design: Detailed floating label displayed ONLY on hover or selection */}
            {isActive && (
              <g
                className="pointer-events-auto cursor-pointer animate-in fade-in zoom-in-[0.97] duration-100"
                onClick={handleClick}
              >
                <rect
                  x={x}
                  y={tagY}
                  width={approxTagWidth}
                  height={tagHeight}
                  rx={3}
                  fill="rgba(7, 11, 21, 0.92)"
                  stroke={isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.5)'}
                  strokeWidth={1}
                />
                <circle
                  cx={x + 7}
                  cy={tagY + tagHeight / 2}
                  r={2.5}
                  fill={box.confidence >= 90 ? '#34d399' : '#38bdf8'}
                />
                <text
                  x={x + 14}
                  y={tagY + 11}
                  fill="#e0f2fe"
                  fontSize="8.5"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontWeight="600"
                  letterSpacing="0.02em"
                  className="select-none"
                >
                  {labelText}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
