import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Search, Users, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/responsive-table";
import { clientsService } from "../services/clientsService";
import { partnersService } from "../services/partnersService";

const Clients = ({ user }) => {
  const [clients, setClients] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientsData, partnersData] = await Promise.all([
        clientsService.getAll(),
        partnersService.getAll().catch(() => []),
      ]);
      setClients(clientsData);
      setPartners(partnersData);
    } catch (error) {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return [c.client_name, c.client_nif, c.client_contact, c.client_email, c.client_iban, c.partner_name]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
  });

  const handleEdit = (client) => {
    setEditingClient(client.id);
    setEditForm({
      client_name: client.client_name || "",
      client_contact: client.client_contact || "",
      client_email: client.client_email || "",
      client_iban: client.client_iban || "",
    });
  };

  const handleSave = async (clientId) => {
    try {
      await clientsService.update(clientId, editForm);
      toast.success("Cliente atualizado com sucesso");
      setEditingClient(null);
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar cliente: " + error.message);
    }
  };

  const canEdit = user?.role === "admin" || user?.role === "bo";

  return (
    <div className="min-h-screen" style={{ background: "#080c14" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-cyber-500 to-cyber-600 rounded-lg flex items-center justify-center shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Clientes</h1>
          </div>
          <p className="text-sm text-slate-400 ml-13">
            {user?.role === "partner"
              ? "Clientes das suas vendas registadas"
              : "Todos os clientes registados no sistema"}
          </p>
        </motion.div>

        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por nome, NIF, contacto, email, IBAN..."
            className="pl-10 bg-dark-900 border-dark-700 focus:border-cyber-500 focus:ring-cyber-500/20 text-white"
          />
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <Card className="bg-dark-850 border-dark-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700" style={{ background: "rgba(6,182,212,0.03)" }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">NIF</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contacto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">IBAN</th>
                    {user?.role !== "partner" && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Parceiro</th>
                    )}
                    {canEdit && (
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className="text-center py-12 text-slate-500">
                        Nenhum cliente encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client, idx) => (
                      <tr
                        key={client.id}
                        className={`border-b border-dark-700/50 hover:bg-cyber-500/5 transition-colors ${idx % 2 === 0 ? "" : "bg-dark-900/30"}`}
                      >
                        <td className="px-4 py-3 text-sm text-white font-mono">{client.client_nif}</td>
                        <td className="px-4 py-3 text-sm text-white">
                          {editingClient === client.id ? (
                            <Input
                              value={editForm.client_name}
                              onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                              className="bg-dark-900 border-dark-700 text-white text-sm h-8"
                            />
                          ) : (
                            client.client_name || "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {editingClient === client.id ? (
                            <Input
                              value={editForm.client_contact}
                              onChange={(e) => setEditForm({ ...editForm, client_contact: e.target.value })}
                              className="bg-dark-900 border-dark-700 text-white text-sm h-8"
                            />
                          ) : (
                            client.client_contact || "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {editingClient === client.id ? (
                            <Input
                              value={editForm.client_email}
                              onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })}
                              className="bg-dark-900 border-dark-700 text-white text-sm h-8"
                            />
                          ) : (
                            client.client_email || "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                          {editingClient === client.id ? (
                            <Input
                              value={editForm.client_iban}
                              onChange={(e) => setEditForm({ ...editForm, client_iban: e.target.value })}
                              className="bg-dark-900 border-dark-700 text-white text-sm h-8"
                            />
                          ) : (
                            client.client_iban || "-"
                          )}
                        </td>
                        {user?.role !== "partner" && (
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="outline" className="border-cyber-500/30 text-cyber-400">
                              {client.partner_name || "-"}
                            </Badge>
                          </td>
                        )}
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            {editingClient === client.id ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(client.id)}
                                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingClient(null)}
                                  className="h-8 px-3 text-slate-400 hover:text-white"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(client)}
                                className="h-8 px-3 text-cyber-400 hover:text-cyber-300 hover:bg-cyber-500/10"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!loading && (
          <p className="text-xs text-slate-500 mt-4">
            {filteredClients.length} {filteredClients.length === 1 ? "cliente" : "clientes"}
          </p>
        )}
      </div>
    </div>
  );
};

export default Clients;
