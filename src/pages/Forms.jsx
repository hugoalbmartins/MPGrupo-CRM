import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "../lib/supabase";

const Forms = ({ user }) => {
  const { operatorId } = useParams();
  const navigate = useNavigate();
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOperators();
  }, []);

  useEffect(() => {
    if (operators.length > 0 && operatorId) {
      const operator = operators.find(op => op.id === operatorId);
      setSelectedOperator(operator);
    }
  }, [operators, operatorId]);

  const fetchOperators = async () => {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .eq('hidden', false)
        .order('name');

      if (error) throw error;

      // Filtrar apenas operadoras com documentos
      const operatorsWithDocs = (data || []).filter(op => op.documents && op.documents.length > 0);
      setOperators(operatorsWithDocs);
    } catch (error) {
      toast.error("Erro ao carregar operadoras");
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  // Se não há operadoras com documentos
  if (operators.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Formulários</h1>
        <div className="professional-card p-8 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Nenhum formulário disponível no momento.</p>
          <p className="text-sm text-gray-500 mt-2">
            Os formulários serão disponibilizados assim que forem adicionados às operadoras.
          </p>
        </div>
      </div>
    );
  }

  // Se não há operadora selecionada, mostrar lista de operadoras
  if (!operatorId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Formulários</h1>
        <div className="professional-card p-6">
          <p className="text-gray-600 mb-6">
            Selecione uma operadora para visualizar os formulários disponíveis:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operators.map((operator) => (
              <Button
                key={operator.id}
                onClick={() => navigate(`/forms/${operator.id}`)}
                className="h-auto flex flex-col items-start p-4 bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-400 text-left"
                variant="outline"
              >
                <span className="font-semibold text-lg text-gray-900">{operator.name}</span>
                <span className="text-sm text-gray-600 capitalize">{operator.scope}</span>
                <span className="text-xs text-blue-600 mt-2">
                  📄 {operator.documents.length} formulário(s)
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Mostrar documentos da operadora selecionada
  if (!selectedOperator) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Operadora não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/forms')} variant="outline">
          ← Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{selectedOperator.name}</h1>
          <p className="text-sm text-gray-600 capitalize">{selectedOperator.scope}</p>
        </div>
      </div>

      <div className="professional-card p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Formulários Disponíveis</h2>
        {selectedOperator.documents && selectedOperator.documents.length > 0 ? (
          <div className="space-y-3">
            {selectedOperator.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <div>
                    <span className="font-medium block">{doc.filename}</span>
                    <span className="text-xs text-gray-500">
                      Adicionado em: {new Date(doc.uploaded_at).toLocaleDateString('pt-PT')}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => handleDownloadDocument(doc)}
                  className="btn-primary"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descarregar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum formulário disponível para esta operadora.</p>
        )}
      </div>
    </div>
  );
};

export default Forms;
