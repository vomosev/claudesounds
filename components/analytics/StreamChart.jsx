'use client';

import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';

const numberFormatter = new Intl.NumberFormat('en-US');
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function formatValue(value, metric) {
  if (metric === 'revenue') return currencyFormatter.format(Number(value) || 0);
  return numberFormatter.format(Math.round(Number(value) || 0));
}

function formatDateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StreamChart({
  series,
  loading = false,
  error = null,
  metric = 'streams',
  title = 'Daily streams',
  onRetry,
}) {
  if (loading) {
    return (
      <div className="chart">
        <div className="chart__header">
          <h3 className="chart__title">{title}</h3>
        </div>
        <div className="chart__frame chart__frame--skeleton" aria-hidden="false">
          <Spinner size="md" label="Loading chart data" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart">
        <div className="chart__header">
          <h3 className="chart__title">{title}</h3>
        </div>
        <div className="chart__frame">
          <EmptyState
            tone="error"
            title="Chart data unavailable"
            description={
              typeof error === 'string'
                ? error
                : error.message || 'We could not load streaming data right now.'
            }
            action={
              onRetry ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
                  Retry
                </button>
              ) : null
            }
          />
        </div>
      </div>
    );
  }

  const points = Array.isArray(series) ? series : [];

  if (points.length === 0) {
    return (
      <div className="chart">
        <div className="chart__header">
          <h3 className="chart__title">{title}</h3>
        </div>
        <div className="chart__frame">
          <EmptyState
            title="No streaming activity yet"
            description="Once your releases go live on stores, daily streams and revenue will appear here."
          />
        </div>
      </div>
    );
  }

  const values = points.map((point) =>
    metric === 'revenue' ? Number(point.revenue) || 0 : Number(point.streams) || 0
  );
  const maxValue = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = total / values.length;

  const width = 720;
  const height = 260;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 28;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = values.map((value, index) => {
    const x = points.length > 1 ? padLeft + index * stepX : padLeft + plotWidth / 2;
    const y = padTop + plotHeight - (value / maxValue) * plotHeight;
    return { x, y };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(2)} ${(padTop + plotHeight).toFixed(
          2
        )} L${coords[0].x.toFixed(2)} ${(padTop + plotHeight).toFixed(2)} Z`
      : '';

  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => padTop + plotHeight * ratio);

  const metricLabel = metric === 'revenue' ? 'Revenue' : 'Streams';

  return (
    <div className="chart">
      <div className="chart__header">
        <h3 className="chart__title">{title}</h3>
        <dl className="chart__legend">
          <div className="chart__legend-item">
            <dt>Total</dt>
            <dd>{formatValue(total, metric)}</dd>
          </div>
          <div className="chart__legend-item">
            <dt>Daily avg</dt>
            <dd>{formatValue(average, metric)}</dd>
          </div>
          <div className="chart__legend-item">
            <dt>Peak</dt>
            <dd>{formatValue(maxValue, metric)}</dd>
          </div>
        </dl>
      </div>

      <div className="chart__frame">
        <svg
          className="chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${metricLabel} over the last ${points.length} days. Total ${formatValue(
            total,
            metric
          )}, peak ${formatValue(maxValue, metric)}.`}
        >
          <defs>
            <linearGradient id="claudesounds-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="chart__grad-start" />
              <stop offset="100%" className="chart__grad-end" />
            </linearGradient>
          </defs>

          {gridLines.map((y, index) => (
            <line
              key={`grid-${index}`}
              className="chart__grid"
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
            />
          ))}

          {areaPath ? <path className="chart__area" d={areaPath} fill="url(#claudesounds-chart-fill)" /> : null}
          {linePath ? <path className="chart__line" d={linePath} /> : null}

          {coords.map((point, index) =>
            index % labelEvery === 0 || index === coords.length - 1 ? (
              <circle
                key={`dot-${points[index].date || index}`}
                className="chart__dot"
                cx={point.x}
                cy={point.y}
                r="3"
              />
            ) : null
          )}

          {points.map((point, index) =>
            index % labelEvery === 0 || index === points.length - 1 ? (
              <text
                key={`label-${point.date || index}`}
                className="chart__axis-label"
                x={coords[index].x}
                y={height - 8}
                textAnchor={
                  index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'
                }
              >
                {formatDateLabel(point.date)}
              </text>
            ) : null
          )}
        </svg>
      </div>

      <details className="chart__data">
        <summary>View data table</summary>
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">
              {metricLabel} by day for the selected period
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Streams</th>
                <th scope="col">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={point.date || `row-${index}`}>
                  <th scope="row">{formatDateLabel(point.date)}</th>
                  <td>{numberFormatter.format(Math.round(Number(point.streams) || 0))}</td>
                  <td>{currencyFormatter.format(Number(point.revenue) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}