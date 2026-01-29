import React, { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        // Se for uma URL direta, abrir
        window.open(doc.url, '_blank');
      } else if (doc.path) {
        // Se for um path no Supabase Storage
        const { data, error } = await supabase.storage
          .from('operator-documents')
          .download(doc.path);

        if (error) throw error;

        // Criar URL temporária e fazer download
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename || 'document';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      toast.error("Erro ao descarregar documento");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="h-10 bg-gray-200 rounded-lg w-1/4 animate-pulse"></div>
        <div className="glass-ultra p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Se não há operadoras com documentos
  if (operators.length === 0) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>Formulários</h1>
        <div className="glass-ultra p-8 text-center spring-transition">
          <div className="w-20 h-20 bg-gradient-to-r from-navy-900 to-navy-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <p className="text-lg font-semibold mb-2" style={{ color: '#000000' }}>
            Nenhum formulário disponível no momento
          </p>
          <p className="text-sm" style={{ color: '#7a7a7a' }}>
            Os formulários serão disponibilizados assim que forem adicionados às operadoras
          </p>
        </div>
      </div>
    );
  }

  // Se não há operadora selecionada, mostrar lista de operadoras
  if (!operatorId) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>Formulários</h1>
        <div className="glass-ultra p-6 spring-transition">
          <p className="mb-6 font-medium" style={{ color: '#000000' }}>
            Selecione uma operadora para visualizar os formulários disponíveis:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operators.map((operator, index) => (
              <button
                key={operator.id}
                onClick={() => navigate(`/forms/${operator.id}`)}
                className="glass-ultra h-auto flex flex-col items-start p-5 text-left spring-transition hover:shadow-lg hover:border-gold-ultra group"
                style={{
                  animationDelay: `${index * 0.05}s`,
                  border: '1px solid rgba(0,0,0,0.1)'
                }}
              >
                <span className="font-bold text-lg mb-1 group-hover:text-gold-ultra spring-transition" style={{ color: '#000000' }}>
                  {operator.name}
                </span>
                <span className="text-sm capitalize mb-3" style={{ color: '#7a7a7a' }}>
                  {operator.scope}
                </span>
                <div className="flex items-center gap-2 mt-auto">
                  <FileText className="w-4 h-4 text-gold-ultra" />
                  <span className="text-xs font-semibold" style={{ color: '#d4af37' }}>
                    {operator.documents.length} formulário(s)
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Mostrar documentos da operadora selecionada
  if (!selectedOperator) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <p className="font-medium" style={{ color: '#7a7a7a' }}>
          Operadora não encontrada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate('/forms')}
          className="btn-secondary spring-transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>
            {selectedOperator.name}
          </h1>
          <p className="text-sm capitalize font-medium" style={{ color: '#7a7a7a' }}>
            {selectedOperator.scope}
          </p>
        </div>
      </div>

      <div className="glass-ultra p-6 spring-transition">
        <h2 className="text-xl font-bold mb-6" style={{ color: '#000000' }}>
          Formulários Disponíveis
        </h2>
        {selectedOperator.documents && selectedOperator.documents.length > 0 ? (
          <div className="space-y-3">
            {selectedOperator.documents.map((doc, index) => (
              <div
                key={doc.id}
                className="glass-ultra flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 spring-transition hover:shadow-lg group"
                style={{
                  animationDelay: `${index * 0.05}s`,
                  border: '1px solid rgba(0,0,0,0.05)'
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-r from-navy-900 to-navy-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold block truncate" style={{ color: '#000000' }}>
                      {doc.filename}
                    </span>
                    <span className="text-xs block" style={{ color: '#7a7a7a' }}>
                      Adicionado em: {new Date(doc.uploaded_at).toLocaleDateString('pt-PT')}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => handleDownloadDocument(doc)}
                  className="btn-gold shadow-gold-glow spring-transition w-full sm:w-auto"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descarregar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: '#7a7a7a' }} />
            <p style={{ color: '#7a7a7a' }}>
              Nenhum formulário disponível para esta operadora
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Forms;
