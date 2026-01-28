import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient = "from-navy-900 to-navy-800",
  delay = 0,
  onClick,
  badge,
  className = ""
}) => {
  const cardClasses = `stat-card cursor-${onClick ? 'pointer' : 'default'} ${className}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={onClick ? { scale: 1.03, y: -4 } : {}}
      className={cardClasses}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>
            {title}
          </p>
          <p className="text-3xl font-bold mb-1" style={{ color: '#000000' }}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`w-14 h-14 bg-gradient-to-r ${gradient} rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
      </div>
      {badge && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.2, type: 'spring', stiffness: 500 }}
          className="absolute -top-2 -right-2"
        >
          {badge}
        </motion.div>
      )}
    </motion.div>
  );
};

export const StatCardGold = ({
  title,
  value,
  subtitle,
  icon: Icon,
  delay = 0,
  onClick,
  className = ""
}) => {
  const cardClasses = `stat-card-gold cursor-${onClick ? 'pointer' : 'default'} relative overflow-hidden ${className}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={onClick ? { scale: 1.03, y: -4, boxShadow: '0 0 20px rgba(212, 175, 55, 0.5)' } : {}}
      className={cardClasses}
      onClick={onClick}
    >
      <div className="flex items-center justify-between relative z-10">
        <div className="flex-1">
          <p className="text-sm font-semibold mb-2" style={{ color: '#7a6e00' }}>
            {title}
          </p>
          <p className="text-3xl font-bold mb-1 text-gradient-gold">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs font-medium" style={{ color: '#9a8e00' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="w-14 h-14 bg-gradient-to-r from-gold-ultra to-gold-500 rounded-xl flex items-center justify-center shadow-gold-glow spring-transition hover:scale-110">
          <Icon className="w-7 h-7 text-navy-900" />
        </div>
      </div>
    </motion.div>
  );
};

export const StatCardSkeleton = () => (
  <div className="glass-ultra p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="h-4 bg-navy-200 rounded w-1/2 mb-3" />
        <div className="h-8 bg-navy-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-navy-100 rounded w-1/3" />
      </div>
      <div className="w-14 h-14 bg-navy-200 rounded-xl" />
    </div>
  </div>
);
