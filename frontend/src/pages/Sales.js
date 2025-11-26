import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API } from "../App";

const POWER_OPTIONS = ["1.15kVA", "2.3kVA", "3.45kVA", "4.6kVA", "5.75kVA", "6.9kVA", "10.35kVA", "13.8kVA", "17.25kVA", "20.7kVA", "27.6kVA", "34.5kVA", "41.4kVA", "Outros"];

const Sales = ({ user }) => {
  const [sales, setSales] = useState([]);
  const [partners, setPartners] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    partner_id: "",
    scope: "telecomunicacoes",
    client_type: "particular",
    client_name: "",
    client_nif: "",
    client_contact: "",
    client_email: "",
    client_iban: "",
    installation_address: "",
    operator_id: "",
    service_type: "",
    monthly_value: "",
    cpe: "",
    power: "",
    entry_type: "",
    cui: "",
    tier: "",
    observations: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, partnersRes, operatorsRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/partners`),
        axios.get(`${API}/operators`)
      ]);
      setSales(salesRes.data);
      setPartners(partnersRes.data);
      setOperators(operatorsRes.data);
      
      if (user?.role === 'partner' && partnersRes.data.length > 0) {
        setFormData(prev => ({ ...prev, partner_id: partnersRes.data[0].id }));
      }
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (formData.cpe) {
      const cpeUpper = formData.cpe.toUpperCase();
      if (!/^PT0002\d{12}[A-Z]{2}$/.test(cpeUpper)) {
        toast.error("CPE inválido: PT0002 + 12 dígitos + 2 letras");
        return;
      }
      formData.cpe = cpeUpper;
    }
    
    if (formData.cui) {
      const cuiUpper = formData.cui.toUpperCase();
      if (!/^PT16\d{15}[A-Z]{2}$/.test(cuiUpper)) {
        toast.error("CUI inválido: PT16 + 15 dígitos + 2 letras");
        return;
      }
      formData.cui = cuiUpper;
    }

    try {
      const submitData = { ...formData };
      if (submitData.monthly_value) submitData.monthly_value = parseFloat(submitData.monthly_value);
      
      await axios.post(`${API}/sales`, submitData);
      toast.success("Venda criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar venda");
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      partner_id: user?.role === 'partner' && partners.length > 0 ? partners[0].id : "",
      scope: "telecomunicacoes",
      client_name: "",
      client_nif: "",
      client_contact: "",
      client_email: "",
      client_iban: "",
      installation_address: "",
      operator_id: "",
      service_type: "",
      monthly_value: "",
      cpe: "",
      power: "",
      entry_type: "",
      cui: "",
      tier: "",
      observations: ""
    });
  };

  const filteredOperators = operators.filter(op => 
    formData.scope === 'dual' || op.scope === formData.scope || op.scope === 'dual'
  );

  const filteredSales = selectedStatus ? sales.filter(s => s.status === selectedStatus) : sales;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Vendas</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="btn-primary"><Plus className="w-4 h-4 mr-2" />Nova Venda</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-2xl">Nova Venda</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input type="date" value={formData.date} max={new Date().toISOString().split('T')[0]} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div>
                  <Label>Parceiro *</Label>
                  <Select value={formData.partner_id} onValueChange={(v) => setFormData({...formData, partner_id: v})} disabled={user?.role === 'partner'}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Âmbito *</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({...formData, scope: v, operator_id: "", service_type: "", cpe: "", cui: ""})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telecomunicacoes">Telecomunicações</SelectItem>
                      <SelectItem value="energia">Energia</SelectItem>
                      <SelectItem value="solar">Solar</SelectItem>
                      <SelectItem value="dual">Dual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome Cliente *</Label>
                  <Input value={formData.client_name} onChange={(e) => setFormData({...formData, client_name: e.target.value})} required />
                </div>
                <div>
                  <Label>NIF Cliente *</Label>
                  <Input value={formData.client_nif} onChange={(e) => setFormData({...formData, client_nif: e.target.value})} required />
                </div>
                <div>
                  <Label>Contacto Cliente *</Label>
                  <Input value={formData.client_contact} onChange={(e) => setFormData({...formData, client_contact: e.target.value})} required />
                </div>
                <div>
                  <Label>Email Cliente</Label>
                  <Input type="email" value={formData.client_email} onChange={(e) => setFormData({...formData, client_email: e.target.value})} />
                </div>
                <div>
                  <Label>IBAN Cliente</Label>
                  <Input value={formData.client_iban} onChange={(e) => setFormData({...formData, client_iban: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label>Morada de Instalação/Fornecimento</Label>
                  <Input value={formData.installation_address} onChange={(e) => setFormData({...formData, installation_address: e.target.value})} />
                </div>
                <div>
                  <Label>Operadora *</Label>
                  <Select value={formData.operator_id} onValueChange={(v) => setFormData({...formData, operator_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {filteredOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.scope === 'telecomunicacoes' && (
                  <>
                    <div>
                      <Label>Tipo Serviço *</Label>
                      <Select value={formData.service_type} onValueChange={(v) => setFormData({...formData, service_type: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M3">M3</SelectItem>
                          <SelectItem value="M4">M4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Mensalidade (€) *</Label>
                      <Input type="number" step="0.01" value={formData.monthly_value} onChange={(e) => setFormData({...formData, monthly_value: e.target.value})} required />
                    </div>
                  </>
                )}
                
                {(formData.scope === 'energia' || formData.scope === 'solar') && (
                  <>
                    <div>
                      <Label>CPE * (PT0002...)</Label>
                      <Input value={formData.cpe} onChange={(e) => setFormData({...formData, cpe: e.target.value.toUpperCase()})} placeholder="PT0002XXXXXXXXXXXX" required />
                    </div>
                    <div>
                      <Label>Potência *</Label>
                      <Select value={formData.power} onValueChange={(v) => setFormData({...formData, power: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {formData.scope === 'energia' && (
                  <div className="col-span-2">
                    <Label>Tipo de Entrada *</Label>
                    <Select value={formData.entry_type} onValueChange={(v) => setFormData({...formData, entry_type: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alteração de comercializadora">Alteração de comercializadora</SelectItem>
                        <SelectItem value="Alteração de comercializadora com alteração de titular">Alteração de comercializadora com alteração de titular</SelectItem>
                        <SelectItem value="Entrada Direta">Entrada Direta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {formData.scope === 'dual' && (
                  <>
                    <div>
                      <Label>CPE * (PT0002...)</Label>
                      <Input value={formData.cpe} onChange={(e) => setFormData({...formData, cpe: e.target.value.toUpperCase()})} placeholder="PT0002XXXXXXXXXXXX" required />
                    </div>
                    <div>
                      <Label>Potência *</Label>
                      <Select value={formData.power} onValueChange={(v) => setFormData({...formData, power: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {POWER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>CUI * (PT16...)</Label>
                      <Input value={formData.cui} onChange={(e) => setFormData({...formData, cui: e.target.value.toUpperCase()})} placeholder="PT16XXXXXXXXXXXXXXXXX" required />
                    </div>
                    <div>
                      <Label>Escalão *</Label>
                      <Select value={formData.tier} onValueChange={(v) => setFormData({...formData, tier: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {["1", "2", "3", "4"].map(t => <SelectItem key={t} value={t}>Escalão {t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.observations} onChange={(e) => setFormData({...formData, observations: e.target.value})} rows={3} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">Cancelar</Button>
                <Button type="submit" className="btn-primary">Criar Venda</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 mb-4">
        <Button onClick={() => setSelectedStatus("")} variant={selectedStatus === "" ? "default" : "outline"} size="sm">Todas</Button>
        <Button onClick={() => setSelectedStatus("Para registo")} variant={selectedStatus === "Para registo" ? "default" : "outline"} size="sm">Para registo</Button>
        <Button onClick={() => setSelectedStatus("Pendente")} variant={selectedStatus === "Pendente" ? "default" : "outline"} size="sm">Pendente</Button>
        <Button onClick={() => setSelectedStatus("Concluido")} variant={selectedStatus === "Concluido" ? "default" : "outline"} size="sm">Concluído</Button>
        <Button onClick={() => setSelectedStatus("Ativo")} variant={selectedStatus === "Ativo" ? "default" : "outline"} size="sm">Ativo</Button>
        <Button onClick={() => setSelectedStatus("Cancelado")} variant={selectedStatus === "Cancelado" ? "default" : "outline"} size="sm">Cancelado</Button>
      </div>

      <div className="professional-card p-6">
        <div className="table-container overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Data</th>
                <th>Parceiro</th>
                <th>Âmbito</th>
                <th>Cliente</th>
                <th>Operadora</th>
                <th>Status</th>
                {user?.role !== 'bo' && user?.role !== 'partner_commercial' && <th>Comissão</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={user?.role !== 'bo' && user?.role !== 'partner_commercial' ? 8 : 7} className="text-center py-8 text-gray-400">Nenhuma venda encontrada</td></tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-semibold text-blue-600">{sale.sale_code}</td>
                    <td>{new Date(sale.date).toLocaleDateString('pt-PT')}</td>
                    <td>{partners.find(p => p.id === sale.partner_id)?.name}</td>
                    <td className="capitalize">{sale.scope}</td>
                    <td>{sale.client_name}</td>
                    <td>{operators.find(o => o.id === sale.operator_id)?.name}</td>
                    <td><span className={`status-badge status-${sale.status.toLowerCase().replace(' ', '-')}`}>{sale.status}</span></td>
                    {user?.role !== 'bo' && user?.role !== 'partner_commercial' && (
                      <td className="font-semibold text-green-600">
                        {sale.commission ? `€${sale.commission.toFixed(2)}` : '-'}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sales;
