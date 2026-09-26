'use client';

import { useMemo } from 'react';

const VIEW_WIDTH = 1000;

function defaultFormatter(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  const n = Number(value);
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function BarChart({
  data = [],
  height = 240,
  ariaLabel = 'Bar chart',
  valueFormatter = defaultFormatter,
}) {
  const points = useMemo(
    () =>
      (Array.isArray(data) ? data : [])
        .filter((d) => d && typeof d === 'object')
        .map((d) => ({
          label: String(d.label ?? ''),
          value: Number.isFinite(Number(d.value)) ? Number(d.value) : 0,
        })),
    [data]
  );

  const max = useMemo(() => {
    if (points.length === 0) return 0;
    return points.reduce((acc, p) => (p.value > acc ? p.value : acc), 0);
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="chart chart--empty" style={{ minHeight: `${height}px` }}>
        <p className="chart__empty-text">No data for this period.</p>
      </div>
    );
  }

  const viewHeight = Math.max(120, Number(height) || 240);
  const padTop = 12;
  const padBottom = 28;
  const plotHeight = viewHeight - padTop - padBottom;
  const safeMax = max > 0 ? max : 1;

  const slot = VIEW_WIDTH / points.length;
  const barWidth = Math.max(2, Math.min(slot * 0.62, 48));

  const gridLines = [
    { ratio: 1, value: safeMax },
    { ratio: 0.5, value: safeMax / 2 },
    { ratio: 0, value: 0 },
  ];

  // Show at most ~6 x-axis labels so they never overlap at 360px.
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="chart" style={{ minHeight: `${viewHeight}px` }}>
      <div className="chart__legend">
        {gridLines.map((line) => (
          <span key={line.ratio} className="chart__legend-item">
            {valueFormatter(line.value)}
          </span>
        ))}
      </div>
      <svg
        className="chart__svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        style={{ height: `${viewHeight}px` }}
      >
        <title>{ariaLabel}</title>
        {gridLines.map((line) => {
          const y = padTop + plotHeight - plotHeight * line.ratio;
          return (
            <line
              key={`grid-${line.ratio}`}
              className={line.ratio === 0 ? 'chart__axis' : 'chart__gridline'}
              x1="0"
              x2={VIEW_WIDTH}
              y1={y}
              y2={y}
            />
          );
        })}

        {points.map((point, index) => {
          const ratio = point.value / safeMax;
          const barHeight = Math.max(point.value > 0 ? 2 : 0, plotHeight * ratio);
          const x = index * slot + (slot - barWidth) / 2;
          const y = padTop + plotHeight - barHeight;
          return (
            <g key={`${point.label}-${index}`}>
              <rect
                className="chart__bar-hit"
                x={index * slot}
                y={padTop}
                width={slot}
                height={plotHeight}
              >
                <title>{`${point.label}: ${valueFormatter(point.value)}`}</title>
              </rect>
              <rect
                className="chart__bar"
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="2"
              >
                <title>{`${point.label}: ${valueFormatter(point.value)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <ul className="chart__labels">
        {points.map((point, index) => (
          <li
            key={`label-${point.label}-${index}`}
            className="chart__label"
            aria-hidden={index % labelStep === 0 ? undefined : 'true'}
          >
            {index % labelStep === 0 ? point.label : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}