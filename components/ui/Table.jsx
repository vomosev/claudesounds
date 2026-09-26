'use client';

import React from 'react';

/**
 * Shared Table primitive.
 *
 * columns: [{ key, header, align: 'left'|'right'|'center', width, render(row, index) }]
 * rows: array of row objects
 * rowKey: string key name or function(row, index) => string
 */
export default function Table({
  columns = [],
  rows = [],
  rowKey = 'id',
  emptyMessage = 'Nothing to show yet.',
  loading = false,
  skeletonRows = 5,
  caption,
  className = '',
}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const colCount = safeColumns.length || 1;

  const getKey = (row, index) => {
    try {
      if (typeof rowKey === 'function') {
        const k = rowKey(row, index);
        return k === undefined || k === null ? `row-${index}` : String(k);
      }
      if (row && typeof row === 'object' && row[rowKey] !== undefined && row[rowKey] !== null) {
        return String(row[rowKey]);
      }
    } catch (err) {
      // fall through to index-based key
    }
    return `row-${index}`;
  };

  const alignClass = (align) => {
    if (align === 'right') return 'table__cell--right';
    if (align === 'center') return 'table__cell--center';
    return 'table__cell--left';
  };

  const renderCell = (column, row, index) => {
    if (typeof column.render === 'function') {
      try {
        return column.render(row, index);
      } catch (err) {
        return <span className="table__cell-error">—</span>;
      }
    }
    const value = row ? row[column.key] : undefined;
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return String(value);
    }
    if (React.isValidElement(value)) return value;
    return '—';
  };

  const cellClass = (column) => {
    const isNumeric = column.align === 'right';
    return [
      'table__cell',
      alignClass(column.align),
      isNumeric ? 'table__cell--numeric' : 'table__cell--text',
      column.className || '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  return (
    <div className={['table-wrap', className].filter(Boolean).join(' ')}>
      <table className="table">
        {caption ? <caption className="table__caption">{caption}</caption> : null}
        <thead className="table__head">
          <tr>
            {safeColumns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={['table__th', alignClass(column.align)].join(' ')}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
            {safeColumns.length === 0 ? (
              <th scope="col" className="table__th table__cell--left">
                Data
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody className="table__body">
          {loading
            ? Array.from({ length: Math.max(1, skeletonRows) }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="table__row table__row--skeleton">
                  {Array.from({ length: colCount }).map((__, colIndex) => (
                    <td key={`skeleton-${rowIndex}-${colIndex}`} className="table__cell">
                      <span className="skeleton skeleton--line" aria-hidden="true" />
                      <span className="sr-only">Loading</span>
                    </td>
                  ))}
                </tr>
              ))
            : null}

          {!loading && safeRows.length === 0 ? (
            <tr className="table__row table__row--empty">
              <td className="table__cell table__cell--empty" colSpan={colCount}>
                <p className="table__empty-message">{emptyMessage}</p>
              </td>
            </tr>
          ) : null}

          {!loading &&
            safeRows.map((row, index) => (
              <tr key={getKey(row, index)} className="table__row">
                {safeColumns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    {renderCell(column, row, index)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableToolbar({ children, className = '' }) {
  return <div className={['table-toolbar', className].filter(Boolean).join(' ')}>{children}</div>;
}