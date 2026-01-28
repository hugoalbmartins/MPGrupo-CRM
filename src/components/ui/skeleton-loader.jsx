import React from 'react';
import { motion } from 'framer-motion';

export const SkeletonCard = ({ className = "" }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className={`bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl p-6 ${className}`}
  >
    <div className="space-y-3">
      <div className="h-4 bg-slate-200 rounded-lg w-3/4 animate-pulse" />
      <div className="h-8 bg-slate-200 rounded-lg w-1/2 animate-pulse" />
      <div className="h-3 bg-slate-200 rounded-lg w-full animate-pulse" />
    </div>
  </motion.div>
);

export const SkeletonTable = ({ rows = 5, columns = 5 }) => (
  <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-xl overflow-hidden">
    <div className="p-6 border-b border-slate-200/50">
      <div className="h-6 bg-slate-200 rounded-lg w-1/4 animate-pulse" />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50/50">
          <tr>
            {Array(columns).fill(0).map((_, i) => (
              <th key={i} className="px-6 py-4">
                <div className="h-4 bg-slate-200 rounded-lg animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array(rows).fill(0).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-t border-slate-100">
              {Array(columns).fill(0).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4">
                  <div className="h-4 bg-slate-100 rounded-lg animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const SkeletonChart = ({ className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-xl p-6 ${className}`}
  >
    <div className="h-6 bg-slate-200 rounded-lg w-1/3 mb-6 animate-pulse" />
    <div className="h-64 bg-gradient-to-t from-slate-100 to-slate-50 rounded-xl animate-pulse" />
  </motion.div>
);

export const SkeletonStat = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-gradient-to-br from-white to-slate-50/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-xl p-6"
  >
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 bg-slate-200 rounded-lg w-1/2 animate-pulse" />
      <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
    </div>
    <div className="h-8 bg-slate-200 rounded-lg w-3/4 mb-2 animate-pulse" />
    <div className="h-3 bg-slate-200 rounded-lg w-1/2 animate-pulse" />
  </motion.div>
);

export const SkeletonDashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array(4).fill(0).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonChart />
      <SkeletonChart />
    </div>
    <SkeletonTable rows={5} columns={6} />
  </div>
);
