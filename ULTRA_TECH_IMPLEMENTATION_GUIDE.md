# 🚀 Ultra-Tech CRM - Guia de Implementação Completo

## 📋 Índice
1. [Arquitetura Ultra-Tech](#arquitetura-ultra-tech)
2. [Sistema de Design](#sistema-de-design)
3. [Hooks React Query](#hooks-react-query)
4. [Componentes Reutilizáveis](#componentes-reutilizáveis)
5. [Padrões de Implementação](#padrões-de-implementação)
6. [Performance](#performance)
7. [Guia de Migração](#guia-de-migração)

---

## 🎨 Arquitetura Ultra-Tech

### Princípios Fundamentais

1. **Optimistic UI**: Todas as operações mostram resultado imediato, com rollback em caso de erro
2. **Background Sync**: Dados são atualizados silenciosamente a cada 5 minutos
3. **Lazy Loading**: Todas as rotas são code-splitted para carregamento rápido
4. **Zero Overlap**: Sistema de grid CSS garante que nenhum elemento se sobrepõe
5. **Glassmorphism**: Design moderno com blur e transparências

---

## 🎨 Sistema de Design

### Paleta de Cores

```css
/* Cores Principais */
--ultra-tech-blue-deep: #0f172a;  /* Navy profundo */
--ultra-tech-blue-mid: #1e293b;   /* Navy médio */
--ultra-tech-gold: #d4af37;       /* Dourado premium */
--ultra-tech-black: #000000;      /* Preto puro para texto */
```

### Classes CSS Disponíveis

#### Glassmorphism
```jsx
<div className="glass-ultra">
  {/* Fundo branco translúcido com blur */}
</div>

<div className="glass-sidebar-ultra">
  {/* Sidebar com gradiente navy e blur */}
</div>
```

#### Stat Cards
```jsx
<div className="stat-card">
  {/* Card de estatística padrão */}
</div>

<div className="stat-card-gold">
  {/* Card de estatística com acento dourado */}
</div>
```

#### Tabelas
```jsx
<div className="horizontal-scroll scrollbar-modern">
  <table className="table-modern">
    <thead className="table-header">
      {/* Cabeçalho fixo com gradiente */}
    </thead>
    <tbody>
      <tr className="table-row">
        {/* Linha com hover dourado */}
      </tr>
    </tbody>
  </table>
</div>
```

#### Botões
```jsx
<button className="btn-primary">
  {/* Botão navy com hover effect */}
</button>

<button className="btn-gold shadow-gold-glow">
  {/* Botão dourado com glow effect */}
</button>

<button className="btn-secondary">
  {/* Botão branco com borda navy */}
</button>
```

#### Inputs
```jsx
<input className="input-modern" />
<select className="select-modern" />
```

#### Animações
```jsx
<div className="spring-transition">
  {/* Transição com efeito mola */}
</div>

<div className="animate-fade-in">
  {/* Fade in suave */}
</div>

<div className="animate-slide-up">
  {/* Slide up com fade */}
</div>
```

#### Text Utilities
```jsx
<span className="text-truncate" title="Texto completo">
  {/* Trunca texto com reticências */}
</span>

<span className="text-gradient-gold">
  {/* Texto com gradiente dourado */}
</span>

<span className="text-gradient-navy">
  {/* Texto com gradiente navy */}
</span>
```

#### Badges
```jsx
<span className="badge-gold">Premium</span>
<span className="badge-navy">Standard</span>
```

#### Responsive
```jsx
<div className="responsive-card-view">
  {/* Grid que se adapta ao tamanho da tela */}
</div>

<div className="table-to-cards">
  {/* Mostra apenas em desktop */}
</div>

<div className="mobile-card-view">
  {/* Mostra apenas em mobile */}
</div>
```

---

## 🎣 Hooks React Query

### Hooks Disponíveis

#### Dashboard Hooks
```jsx
import { useDashboardStats, useProposalStats, usePartnerStats } from '@/hooks/useDashboardData';

function Dashboard({ user }) {
  const { data: stats, isLoading, error } = useDashboardStats(year, month);
  const { data: proposalStats } = useProposalStats();
  const { data: partnerData } = usePartnerStats(user);

  // Background refresh automático
  // Sem spinners que interrompem o usuário
}
```

#### Sales Hooks
```jsx
import {
  useSales,
  useCreateSale,
  useUpdateSale,
  useDeleteSale
} from '@/hooks/useSalesData';

function Sales() {
  // Fetch com auto-refresh
  const { data: sales, isLoading } = useSales(filters);

  // Optimistic create
  const createMutation = useCreateSale();
  const handleCreate = (newSale) => {
    createMutation.mutate(newSale); // UI atualiza imediatamente
  };

  // Optimistic update
  const updateMutation = useUpdateSale();
  const handleUpdate = (saleId, updates) => {
    updateMutation.mutate({ saleId, updates });
  };

  // Optimistic delete
  const deleteMutation = useDeleteSale();
  const handleDelete = (saleId) => {
    deleteMutation.mutate(saleId);
  };
}
```

#### Partners Hooks
```jsx
import {
  usePartners,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner
} from '@/hooks/usePartnersData';

function Partners() {
  const { data: partners, isLoading } = usePartners();
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const deleteMutation = useDeletePartner();

  // Todas as operações são optimistic
}
```

#### Users Hooks
```jsx
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser
} from '@/hooks/useUsersData';

function Users() {
  const { data: users, isLoading } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
}
```

---

## 🧩 Componentes Reutilizáveis

### StatCard & StatCardGold

```jsx
import { StatCard, StatCardGold, StatCardSkeleton } from '@/components/ui/stat-card';
import { ShoppingCart, Award } from 'lucide-react';

function Dashboard() {
  if (isLoading) return <StatCardSkeleton />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Vendas"
        value={stats.totalSales}
        subtitle={`${stats.totalPartners} parceiros`}
        icon={ShoppingCart}
        gradient="from-navy-900 to-navy-800"
        delay={0}
      />

      <StatCardGold
        title="Comissões"
        value={`€${stats.totalCommission.toFixed(2)}`}
        subtitle="Este mês"
        icon={Award}
        delay={0.1}
        onClick={() => handleClick()}
      />
    </div>
  );
}
```

### ResponsiveTable

```jsx
import { ResponsiveTable, TruncatedCell, TableSkeleton } from '@/components/ui/responsive-table';

function SalesPage() {
  if (isLoading) return <TableSkeleton rows={10} columns={8} />;

  const headers = ['Cliente', 'Parceiro', 'Operadora', 'Valor', 'Status', 'Data', 'Ações'];

  const renderRow = (sale) => (
    <>
      <td className="px-6 py-4">
        <TruncatedCell text={sale.client_name} maxLength={30} />
      </td>
      <td className="px-6 py-4">
        <TruncatedCell text={sale.partners?.name} />
      </td>
      <td className="px-6 py-4">
        <span style={{ color: '#000000' }}>{sale.operators?.name}</span>
      </td>
      <td className="px-6 py-4">
        <span className="font-bold" style={{ color: '#000000' }}>
          €{parseFloat(sale.manual_commission || 0).toFixed(2)}
        </span>
      </td>
      <td className="px-6 py-4">
        <Badge className={getStatusClass(sale.status)}>
          {sale.status}
        </Badge>
      </td>
      <td className="px-6 py-4">
        <span style={{ color: '#000000' }}>
          {new Date(sale.date).toLocaleDateString('pt-PT')}
        </span>
      </td>
      <td className="px-6 py-4">
        <Button size="sm" onClick={() => handleEdit(sale)}>
          Editar
        </Button>
      </td>
    </>
  );

  const renderMobileCard = (sale) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold" style={{ color: '#000000' }}>
          {sale.client_name}
        </span>
        <Badge className={getStatusClass(sale.status)}>
          {sale.status}
        </Badge>
      </div>
      <div className="text-sm" style={{ color: '#7a7a7a' }}>
        <div>Parceiro: {sale.partners?.name}</div>
        <div>Operadora: {sale.operators?.name}</div>
        <div className="font-bold" style={{ color: '#000000' }}>
          €{parseFloat(sale.manual_commission || 0).toFixed(2)}
        </div>
      </div>
      <Button size="sm" className="w-full" onClick={() => handleEdit(sale)}>
        Ver Detalhes
      </Button>
    </div>
  );

  return (
    <ResponsiveTable
      headers={headers}
      data={sales}
      renderRow={renderRow}
      renderMobileCard={renderMobileCard}
      emptyMessage="Nenhuma venda encontrada"
    />
  );
}
```

### ChartContainer

```jsx
import { ChartContainer, ChartSkeleton } from '@/components/ui/chart-container';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function Dashboard() {
  if (isLoading) return <ChartSkeleton title="Vendas por Operadora" />;

  return (
    <ChartContainer
      title="Vendas por Operadora"
      subtitle="Dados do mês corrente"
      scrollable={true}  // Ativa horizontal scroll
      delay={0.2}
      actions={
        <Button size="sm" variant="outline">
          Exportar
        </Button>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#d4af37" />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

---

## 📐 Padrões de Implementação

### 1. Página com Optimistic UI

```jsx
import React from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard, StatCardSkeleton } from '@/components/ui/stat-card';
import { ResponsiveTable, TableSkeleton } from '@/components/ui/responsive-table';
import { usePartners, useCreatePartner, useUpdatePartner, useDeletePartner } from '@/hooks/usePartnersData';

function Partners() {
  // Background fetch com auto-refresh
  const { data: partners, isLoading, error } = usePartners();

  // Optimistic mutations
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const deleteMutation = useDeletePartner();

  const handleCreate = async (formData) => {
    createMutation.mutate(formData);
    // UI atualiza imediatamente, sem esperar resposta
  };

  const handleUpdate = async (partnerId, updates) => {
    updateMutation.mutate({ partnerId, updates });
  };

  const handleDelete = async (partnerId) => {
    if (!confirm('Tem certeza?')) return;
    deleteMutation.mutate(partnerId);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <StatCardSkeleton />
        </div>
        <TableSkeleton rows={10} columns={6} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 glass-ultra">
        <p style={{ color: '#000000' }}>Erro ao carregar dados</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header com botão golden */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>
          Parceiros
        </h1>
        <Button
          className="btn-gold shadow-gold-glow spring-transition"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Criar Parceiro
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Parceiros"
          value={partners.length}
          icon={Users}
          delay={0}
        />
      </div>

      {/* Responsive Table */}
      <ResponsiveTable
        headers={['Nome', 'Email', 'Tipo', 'Status', 'Ações']}
        data={partners}
        renderRow={(partner) => (
          <>
            <td className="px-6 py-4">
              <TruncatedCell text={partner.name} />
            </td>
            {/* ... */}
          </>
        )}
        renderMobileCard={(partner) => (
          <div className="space-y-2">
            {/* Mobile card layout */}
          </div>
        )}
      />
    </div>
  );
}

export default Partners;
```

### 2. Form com Validação e Optimistic Update

```jsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePartner } from '@/hooks/usePartnersData';

function CreatePartnerDialog({ open, onOpenChange }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'partner'
  });

  const createMutation = useCreatePartner();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação
    if (!formData.name || !formData.email) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Optimistic update
    createMutation.mutate(formData, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({ name: '', email: '', type: 'partner' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-ultra">
        <DialogHeader>
          <DialogTitle style={{ color: '#000000' }}>
            Criar Novo Parceiro
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              className="input-modern"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              className="input-modern"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="btn-secondary flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="btn-gold shadow-gold-glow flex-1"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Dashboard com Charts e Horizontal Scroll

```jsx
import React from 'react';
import { ChartContainer } from '@/components/ui/chart-container';
import { StatCard, StatCardGold } from '@/components/ui/stat-card';
import { useDashboardStats } from '@/hooks/useDashboardData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function Dashboard({ user }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data: stats, isLoading } = useDashboardStats(year, month);

  if (isLoading) {
    return <div className="animate-pulse">{/* Skeleton */}</div>;
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Vendas"
          value={stats.totalSales}
          subtitle={`${stats.totalPartners} parceiros`}
          icon={ShoppingCart}
          gradient="from-navy-900 to-navy-800"
          delay={0}
        />
        <StatCardGold
          title="Comissões"
          value={`€${stats.totalCommission.toFixed(2)}`}
          subtitle="Este mês"
          icon={Award}
          delay={0.1}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer
          title="Vendas por Operadora"
          subtitle="Distribuição mensal"
          scrollable={true}
          delay={0.2}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.byOperator}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
              <XAxis dataKey="name" stroke="#000000" />
              <YAxis stroke="#000000" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #d4af37',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" fill="#d4af37" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer
          title="Comissões por Parceiro"
          subtitle="Top 10 do mês"
          scrollable={true}
          delay={0.3}
        >
          <ResponsiveContainer width="100%" height={300}>
            {/* Chart content */}
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}
```

---

## ⚡ Performance

### Otimizações Implementadas

1. **Code Splitting**: Todas as rotas são lazy-loaded
2. **React Query**: Cache inteligente com stale-time de 5 minutos
3. **Background Refresh**: Dados atualizados silenciosamente
4. **Optimistic UI**: Zero latência percebida pelo usuário
5. **Memoização**: Componentes pesados memoizados
6. **Suspense Boundaries**: Loading states hierárquicos

### Configuração React Query

```jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // Não refetch ao focar janela
      retry: 1,                       // 1 retry em caso de erro
      staleTime: 5 * 60 * 1000,      // 5 minutos de cache
      refetchInterval: 5 * 60 * 1000 // Background refresh a cada 5 min
    },
  },
});
```

### Bundle Size

```
Total CSS:     99.25 kB (gzip: 15.74 kB)
Lazy Routes:   35 chunks code-splitted
Initial Load:  ~500 kB (gzip: ~150 kB)
```

---

## 🔄 Guia de Migração

### Migrar Página Existente para Ultra-Tech

#### Passo 1: Substituir fetch manual por hooks

**Antes:**
```jsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData();
}, []);

const fetchData = async () => {
  setLoading(true);
  const result = await service.getData();
  setData(result);
  setLoading(false);
};
```

**Depois:**
```jsx
import { usePartners } from '@/hooks/usePartnersData';

const { data, isLoading } = usePartners();
// Background refresh automático!
```

#### Passo 2: Implementar Optimistic Updates

**Antes:**
```jsx
const handleCreate = async (formData) => {
  setLoading(true);
  await service.create(formData);
  await fetchData(); // Reload tudo
  setLoading(false);
  toast.success('Criado!');
};
```

**Depois:**
```jsx
const createMutation = useCreatePartner();

const handleCreate = (formData) => {
  createMutation.mutate(formData);
  // UI atualiza instantaneamente!
  // Toast é automático do hook
};
```

#### Passo 3: Aplicar Design System

**Antes:**
```jsx
<div className="bg-white shadow rounded-lg p-4">
  <h2 className="text-xl font-bold">Título</h2>
</div>
```

**Depois:**
```jsx
<div className="glass-ultra p-6 spring-transition">
  <h2 className="text-xl font-bold" style={{ color: '#000000' }}>
    Título
  </h2>
</div>
```

#### Passo 4: Adicionar Responsive Table

**Antes:**
```jsx
<table className="w-full">
  <thead>
    <tr>
      {headers.map(h => <th key={h}>{h}</th>)}
    </tr>
  </thead>
  <tbody>
    {data.map(item => (
      <tr key={item.id}>
        <td>{item.name}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**Depois:**
```jsx
<ResponsiveTable
  headers={headers}
  data={data}
  renderRow={(item) => (
    <>
      <td className="px-6 py-4">
        <TruncatedCell text={item.name} />
      </td>
    </>
  )}
  renderMobileCard={(item) => (
    <div>
      <span className="font-bold">{item.name}</span>
    </div>
  )}
/>
```

#### Passo 5: Adicionar Animations

```jsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
  className="glass-ultra"
>
  {/* Content */}
</motion.div>
```

---

## 🎯 Checklist de Implementação

### Para Cada Página

- [ ] Substituir fetch manual por hooks React Query
- [ ] Implementar optimistic updates (create, update, delete)
- [ ] Aplicar classes do design system (glass-ultra, stat-card, etc)
- [ ] Adicionar ResponsiveTable com mobile cards
- [ ] Implementar TruncatedCell com tooltips
- [ ] Adicionar spring-transition e animações
- [ ] Usar btn-gold com shadow-gold-glow para ações principais
- [ ] Garantir texto preto puro (#000000) em todo o conteúdo
- [ ] Adicionar horizontal scroll em tabelas/charts largos
- [ ] Testar responsividade (desktop, tablet, mobile)

### Para Novos Componentes

- [ ] Usar motion.div para animações
- [ ] Implementar loading skeleton
- [ ] Adicionar error boundaries
- [ ] Usar Suspense para lazy loading
- [ ] Aplicar glassmorphism nos containers
- [ ] Garantir accessibilidade (ARIA labels)

---

## 📚 Exemplos Completos

Ver os seguintes arquivos para exemplos completos:

- **Hooks**: `/src/hooks/useDashboardData.js`
- **Components**: `/src/components/ui/stat-card.jsx`
- **Responsive Tables**: `/src/components/ui/responsive-table.jsx`
- **Chart Containers**: `/src/components/ui/chart-container.jsx`
- **App Setup**: `/src/App.jsx`
- **CSS System**: `/src/index.css`

---

## 🚀 Deploy

### Build de Produção

```bash
npm run build
```

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

---

## 📞 Suporte

Para questões sobre implementação, consulte:
- Este guia de implementação
- Documentação de componentes inline
- Exemplos de código nos hooks e componentes

---

**Desenvolvido com ❤️ usando React Query, Framer Motion, e Tailwind CSS**
