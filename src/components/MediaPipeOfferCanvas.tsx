import React, { useEffect, useRef } from 'react';

export interface BoundingBoxPct {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MediaPipeOverlayProps {
  imageSrc: string;
  contadoLabel: string;
  cuotasLabel: string;
  isConveniente: boolean;
  contadoBoxPct?: BoundingBoxPct;
  cuotasBoxPct?: BoundingBoxPct;
  isUserUploadedOcr?: boolean;
}

const DEFAULT_CONTADO_BOX: BoundingBoxPct = { x: 0.045, y: 0.6, w: 0.91, h: 0.125 };
const DEFAULT_CUOTAS_BOX: BoundingBoxPct = { x: 0.045, y: 0.75, w: 0.91, h: 0.185 };

export const MediaPipeOfferCanvas: React.FC<MediaPipeOverlayProps> = ({
  imageSrc,
  contadoLabel,
  cuotasLabel,
  isConveniente,
  contadoBoxPct = DEFAULT_CONTADO_BOX,
  cuotasBoxPct = DEFAULT_CUOTAS_BOX,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let isUnmounted = false;

    const drawOverlay = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      source: HTMLImageElement
    ) => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);

      // 1. Recuadro Verde: PRECIO CONTADO
      const cx = Math.round(width * contadoBoxPct.x);
      const cy = Math.round(height * contadoBoxPct.y);
      const cw = Math.round(width * contadoBoxPct.w);
      const ch = Math.round(height * contadoBoxPct.h);

      ctx.save();
      ctx.fillStyle = 'rgba(21, 128, 61, 0.12)';
      ctx.fillRect(cx, cy, cw, ch);

      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = Math.max(3, width * 0.006);
      ctx.strokeRect(cx, cy, cw, ch);

      const dotR = Math.max(4, width * 0.008);
      ctx.fillStyle = '#15803D';
      [
        [cx, cy],
        [cx + cw, cy],
        [cx, cy + ch],
        [cx + cw, cy + ch],
      ].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fill();
      });

      const fontSize = Math.max(13, Math.round(width * 0.026));
      ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
      const padX = 10;
      const labelH = fontSize + 10;
      const textWidth = ctx.measureText(contadoLabel).width;
      const badgeY = Math.max(4, cy - labelH - 2);

      ctx.fillStyle = '#15803D';
      ctx.fillRect(cx, badgeY, Math.min(width - cx - 4, textWidth + padX * 2), labelH);
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(contadoLabel, cx + padX, badgeY + labelH / 2);
      ctx.restore();

      // 2. Recuadro de Cuotas (Rojo #B91C1C si hay sobreprecio, Verde #15803D si es sin recargo)
      const qx = Math.round(width * cuotasBoxPct.x);
      const qy = Math.round(height * cuotasBoxPct.y);
      const qw = Math.round(width * cuotasBoxPct.w);
      const qh = Math.round(height * cuotasBoxPct.h);

      const cuotasColor = isConveniente ? '#15803D' : '#B91C1C';
      const cuotasTint = isConveniente
        ? 'rgba(21, 128, 61, 0.12)'
        : 'rgba(185, 28, 28, 0.14)';

      ctx.save();
      ctx.fillStyle = cuotasTint;
      ctx.fillRect(qx, qy, qw, qh);

      ctx.strokeStyle = cuotasColor;
      ctx.lineWidth = Math.max(3, width * 0.006);
      ctx.strokeRect(qx, qy, qw, qh);

      ctx.fillStyle = cuotasColor;
      [
        [qx, qy],
        [qx + qw, qy],
        [qx, qy + qh],
        [qx + qw, qy + qh],
      ].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fill();
      });

      // Linea conectora entre precio de contado y recuadro de cuotas
      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = cuotasColor;
      ctx.lineWidth = 2;
      ctx.moveTo(cx + cw - 24, cy + ch);
      ctx.lineTo(qx + qw - 24, qy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
      const qTextWidth = ctx.measureText(cuotasLabel).width;
      const qBadgeY = Math.max(4, qy - labelH - 2);

      ctx.fillStyle = cuotasColor;
      ctx.fillRect(qx, qBadgeY, Math.min(width - qx - 4, qTextWidth + padX * 2), labelH);
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(cuotasLabel, qx + padX, qBadgeY + labelH / 2);
      ctx.restore();
    };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isUnmounted) return;
      const w = img.naturalWidth || 600;
      const h = img.naturalHeight || 800;
      canvas.width = w;
      canvas.height = h;
      drawOverlay(ctx, w, h, img);
    };
    img.src = imageSrc;

    return () => {
      isUnmounted = true;
    };
  }, [imageSrc, contadoLabel, cuotasLabel, isConveniente, contadoBoxPct, cuotasBoxPct]);

  return (
    <div className="mediapipe-viewer">
      <div className="mediapipe-canvas-wrap">
        <canvas ref={canvasRef} className="mediapipe-canvas" />
      </div>
    </div>
  );
};
