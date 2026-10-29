import React from 'react';

interface QrProps {
  token: string;
  size?: number;
  showTokenLabel?: boolean;
}

// Deterministic 21x21 QR Version 1 matrix generator with standard finder and timing patterns
export const QrCodeMatrix: React.FC<QrProps> = ({
  token,
  size = 136,
  showTokenLabel = true,
}) => {
  const gridSize = 21;
  const matrix: boolean[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(false)
  );

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr >= 0 && rr < gridSize && cc >= 0 && cc < gridSize) {
          reserved[rr][cc] = true;
          const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = inOuter || inInner;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, gridSize - 7);
  placeFinder(gridSize - 7, 0);

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    reserved[6][i] = true;
    matrix[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    matrix[i][6] = i % 2 === 0;
  }

  // Deterministic bit stream from token string
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let bitIndex = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!reserved[r][c]) {
        const charCode = token.charCodeAt(bitIndex % token.length);
        const mixed = ((hash >>> (bitIndex % 24)) ^ charCode ^ (r * 13 + c * 7)) & 1;
        matrix[r][c] = mixed === 1;
        bitIndex++;
      }
    }
  }

  return (
    <div className="inline-flex flex-col items-center">
      <div
        className="p-2 bg-white border border-[#D9DED7] rounded-[6px]"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox={`0 0 ${gridSize} ${gridSize}`}
          className="w-full h-full"
          shapeRendering="crispEdges"
          role="img"
          aria-label={`Asset QR code for token ${token}`}
        >
          <rect width={gridSize} height={gridSize} fill="#FFFFFF" />
          {matrix.map((row, rIdx) =>
            row.map((cell, cIdx) =>
              cell ? (
                <rect
                  key={`${rIdx}-${cIdx}`}
                  x={cIdx}
                  y={rIdx}
                  width={1}
                  height={1}
                  fill="#202923"
                />
              ) : null
            )
          )}
        </svg>
      </div>
      {showTokenLabel && (
        <span className="mt-1.5 text-xs font-mono-tech text-[var(--text-secondary)] select-all">
          {token}
        </span>
      )}
    </div>
  );
};
