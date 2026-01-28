import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  const breadcrumbNames = {
    dashboard: 'Dashboard',
    partners: 'Parceiros',
    sales: 'Vendas',
    forms: 'Formulários',
    alerts: 'Alertas',
    operators: 'Operadoras',
    users: 'Utilizadores',
    profile: 'Perfil',
    'commission-reports': 'Autos de Comissões',
    'my-reports': 'Meus Autos',
    'operator-validations': 'Validação de Ativações',
    objectives: 'Objetivos',
  };

  if (pathnames.length === 0) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm mb-6">
      <Link
        to="/dashboard"
        className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors group"
      >
        <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline">Início</span>
      </Link>

      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = breadcrumbNames[name] || name.charAt(0).toUpperCase() + name.slice(1);

        return (
          <React.Fragment key={name}>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            {isLast ? (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-slate-900 font-semibold"
              >
                {displayName}
              </motion.span>
            ) : (
              <Link
                to={routeTo}
                className="text-slate-500 hover:text-indigo-600 transition-colors"
              >
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
