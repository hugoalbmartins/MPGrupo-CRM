import React from 'react';
import { motion } from 'framer-motion';
import { Card } from './card';

export const ResponsiveTable = ({
  headers,
  data,
  renderRow,
  renderMobileCard,
  emptyMessage = "Nenhum dado disponível",
  className = ""
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="glass-ultra p-12 text-center">
        <p style={{ color: '#000000' }} className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="table-to-cards horizontal-scroll scrollbar-modern">
        <div className={`glass-ultra overflow-hidden ${className}`}>
          <table className="w-full">
            <thead className="table-header">
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider"
                    style={{ color: '#000000' }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100/40">
              {data.map((item, index) => (
                <motion.tr
                  key={item.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.3 }}
                  className="table-row spring-transition hover:shadow-md"
                >
                  {renderRow(item, index)}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mobile-card-view space-y-4">
        {data.map((item, index) => (
          <motion.div
            key={item.id || index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <Card className="glass-ultra p-4 spring-transition hover:shadow-gold">
              {renderMobileCard(item, index)}
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  );
};

export const TruncatedCell = ({ text, maxLength = 30, className = "" }) => {
  const truncated = text && text.length > maxLength;
  const displayText = truncated ? text.substring(0, maxLength) + '...' : text;

  return (
    <span
      className={`text-truncate ${className}`}
      title={truncated ? text : undefined}
      style={{ color: '#000000' }}
    >
      {displayText || '-'}
    </span>
  );
};

export const TableSkeleton = ({ rows = 5, columns = 6 }) => (
  <div className="glass-ultra overflow-hidden animate-pulse">
    <div className="table-header">
      <div className="flex gap-4 px-6 py-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-navy-200 rounded flex-1" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-navy-100/40">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-navy-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  </div>
);
