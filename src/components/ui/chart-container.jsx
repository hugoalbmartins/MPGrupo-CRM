import React from 'react';
import { motion } from 'framer-motion';

export const ChartContainer = ({
  title,
  subtitle,
  children,
  actions,
  delay = 0,
  scrollable = false,
  className = ""
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      className={`glass-ultra p-6 spring-transition ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold" style={{ color: '#000000' }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm font-medium mt-1" style={{ color: '#7a7a7a' }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={scrollable ? 'horizontal-scroll scrollbar-modern' : ''}>
        <div className={scrollable ? 'min-w-[800px]' : ''}>
          {children}
        </div>
      </div>
    </motion.div>
  );
};

export const ChartSkeleton = ({ title }) => (
  <div className="glass-ultra p-6 animate-pulse">
    <div className="mb-6">
      <div className="h-5 bg-navy-200 rounded w-1/3" />
    </div>
    <div className="h-64 bg-navy-100 rounded" />
  </div>
);

export const GridLayout = ({ children, cols = 4, gap = 6, className = "" }) => {
  const gridClass = `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-${gap} ${className}`;

  return <div className={gridClass}>{children}</div>;
};
