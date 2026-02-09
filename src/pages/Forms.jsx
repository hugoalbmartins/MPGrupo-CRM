import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, FileText, ArrowLeft, Building2, FolderOpen, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperators } from "@/hooks/useOperatorsData";
import { supabase } from "../lib/supabase";

const Forms = ({ user }) => {
  const { operatorId } = useParams();
  const navigate = useNavigate();

  const { data: allOperators, isLoading } = useOperators(false);

  const operators = useMemo(() => {
    if (!allOperators) return [];
    return allOperators.filter(op => op.documents && op.documents.length > 0);
  }, [allOperators]);

  const selectedOperator = useMemo(() => {
    if (!operatorId || !operators.length) return null;
    return operators.find(op => op.id === operatorId);
  }, [operatorId, operators]);

  const handleDownloadDocument = async (doc) => {
    try {
      if (doc.url) {
        window.open(doc.url, '_blank');
        toast.success('Formulário aberto');
      } else if (doc.path) {
        const { data, error } = await supabase.storage
          .from('operator-documents')
          .download(doc.path);

        if (error) throw error;

        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename || 'document';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Formulário descarregado com sucesso');
      }
    } catch (error) {
      toast.error("Erro ao descarregar documento");
      console.error(error);
    }
  };

  const getScopeLabel = (scope) => {
    const labels = {
      'telecomunicacoes': 'Telecomunicações',
      'energia': 'Energia',
      'solar': 'Solar',
      'dual': 'Dual'
    };
    return labels[scope] || scope;
  };

  const getScopeBadgeColor = (scope) => {
    const colors = {
      'telecomunicacoes': 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      'energia': 'bg-green-500/10 text-green-400 border border-green-500/20',
      'solar': 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
      'dual': 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
    };
    return colors[scope] || 'bg-dark-700 text-slate-300 border border-dark-700';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card className="p-8 bg-dark-850 border border-white/[0.06]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (operators.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-white">Formulários</h1>
          <p className="text-sm text-slate-400 mt-1">Documentos das operadoras</p>
        </div>

        <Card className="p-12 bg-dark-850 border border-white/[0.06]">
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-dark-700 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-4 ring-dark-700">
              <FolderOpen className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Nenhum formulário disponível
            </h3>
            <p className="text-slate-400">
              Os formulários das operadoras serão disponibilizados assim que forem adicionados pelo administrador.
            </p>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!operatorId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-white">Formulários</h1>
          <p className="text-sm text-slate-400 mt-1">
            Selecione uma operadora para visualizar os formulários disponíveis
          </p>
        </div>

        <Card className="p-6 bg-dark-850 border border-white/[0.06]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operators.map((operator, index) => (
              <motion.button
                key={operator.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/forms/${operator.id}`)}
                className="group relative bg-dark-800 hover:bg-dark-700 border-2 border-dark-700 hover:border-cyber-500/30 rounded-xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-dark-700 to-dark-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Building2 className="w-6 h-6 text-cyber-400" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyber-400 group-hover:translate-x-1 transition-all duration-300" />
                </div>

                <h3 className="font-bold text-lg text-white mb-2 group-hover:text-cyber-400 transition-colors">
                  {operator.name}
                </h3>

                <Badge className={`${getScopeBadgeColor(operator.scope)} mb-3`}>
                  {getScopeLabel(operator.scope)}
                </Badge>

                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-cyber-400" />
                  <span className="font-semibold text-cyber-400">
                    {operator.documents.length} {operator.documents.length === 1 ? 'formulário' : 'formulários'}
                  </span>
                </div>

                <div className="absolute inset-0 rounded-xl ring-2 ring-transparent group-hover:ring-cyber-500/30 transition-all duration-300 pointer-events-none" />
              </motion.button>
            ))}
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!selectedOperator) {
    return (
      <Card className="p-12 bg-dark-850 border border-white/[0.06]">
        <div className="text-center">
          <p className="text-slate-400">Operadora não encontrada</p>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/forms')}
            variant="outline"
            className="border-2 border-dark-700 hover:border-cyber-500/30 hover:bg-dark-700 text-slate-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">
                {selectedOperator.name}
              </h1>
              <Badge className={getScopeBadgeColor(selectedOperator.scope)}>
                {getScopeLabel(selectedOperator.scope)}
              </Badge>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {selectedOperator.documents?.length || 0} {selectedOperator.documents?.length === 1 ? 'formulário disponível' : 'formulários disponíveis'}
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6 bg-dark-850 border border-white/[0.06]">
        {selectedOperator.documents && selectedOperator.documents.length > 0 ? (
          <div className="space-y-3">
            {selectedOperator.documents.map((doc, index) => (
              <motion.div
                key={doc.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-dark-800 hover:bg-dark-700 border-2 border-dark-700 hover:border-cyber-500/30 rounded-xl transition-all duration-300 hover:shadow-md"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-dark-700 to-dark-800 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-lg">
                    <FileText className="w-6 h-6 text-cyber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate group-hover:text-cyber-400 transition-colors">
                      {doc.filename || 'Documento'}
                    </h3>
                    {doc.uploaded_at && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Adicionado em {new Date(doc.uploaded_at).toLocaleDateString('pt-PT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handleDownloadDocument(doc)}
                  className="bg-gradient-to-r from-cyber-500 to-cyber-600 text-white hover:from-cyber-400 hover:to-cyber-500 w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-300"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descarregar
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400">
              Nenhum formulário disponível para esta operadora
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default Forms;
