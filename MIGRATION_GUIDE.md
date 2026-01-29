# 🚀 Guia Rápido de Migração - Ultra-Tech CRM

## 📋 Status da Migração

### ✅ Infraestrutura Completa (100%)
- [x] React Query configurado
- [x] Design System Ultra-Tech completo
- [x] Todos os hooks criados
- [x] Componentes reutilizáveis criados
- [x] Build funcional

### ✅ Hooks Criados
- [x] `/src/hooks/useDashboardData.js` - Dashboard stats
- [x] `/src/hooks/useSalesData.js` - Sales CRUD
- [x] `/src/hooks/usePartnersData.js` - Partners CRUD
- [x] `/src/hooks/useUsersData.js` - Users CRUD
- [x] `/src/hooks/useOperatorsData.js` - Operators CRUD
- [x] `/src/hooks/useAlertsData.js` - Alerts CRUD
- [x] `/src/hooks/useObjectivesData.js` - Objectives CRUD
- [x] `/src/hooks/useCommissionReportsData.js` - Reports

### ✅ Componentes UI
- [x] `/src/components/ui/stat-card.jsx` - StatCard, StatCardGold
- [x] `/src/components/ui/responsive-table.jsx` - Tables mobile/desktop
- [x] `/src/components/ui/chart-container.jsx` - Charts com scroll

### 🔄 Páginas para Migrar
- [x] ChangePassword.jsx - ✅ MIGRADA
- [ ] Dashboard.jsx - PENDENTE (1313 linhas)
- [ ] Sales.jsx - PENDENTE (2553 linhas)
- [ ] Partners.jsx - PENDENTE (651 linhas)
- [ ] Users.jsx - PENDENTE (533 linhas)
- [ ] Operators.jsx - PENDENTE (637 linhas)
- [ ] Alerts.jsx - PENDENTE (491 linhas)
- [ ] Forms.jsx - PENDENTE (187 linhas)
- [ ] CommissionReports.jsx - PENDENTE (1326 linhas)

---

## 🎯 Padrão de Migração (Copy-Paste)

### 1. Substituir useState + useEffect por Hooks

#### ❌ Antes (Manual Fetch)
```jsx
const [partners, setPartners] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchPartners();
}, []);

const fetchPartners = async () => {
  setLoading(true);
  try {
    const data = await partnersService.getPartners();
    setPartners(data);
  } catch (error) {
    toast.error('Erro ao carregar parceiros');
  } finally {
    setLoading(false);
  }
};
```

#### ✅ Depois (React Query Hook)
```jsx
import { usePartners } from '@/hooks/usePartnersData';

const { data: partners, isLoading } = usePartners();
// Background refresh automático! ⚡
```

---

### 2. Implementar Optimistic Updates

#### ❌ Antes (Loading Manual)
```jsx
const handleCreate = async (formData) => {
  setLoading(true);
  try {
    await partnersService.createPartner(formData);
    await fetchPartners(); // Refetch manual
    toast.success('Criado!');
  } catch (error) {
    toast.error('Erro!');
  } finally {
    setLoading(false);
  }
};
```

#### ✅ Depois (Optimistic)
```jsx
import { useCreatePartner } from '@/hooks/usePartnersData';

const createMutation = useCreatePartner();

const handleCreate = (formData) => {
  createMutation.mutate(formData);
  // UI atualiza INSTANTANEAMENTE!
  // Toast automático
  // Rollback automático se erro
};
```

---

### 3. Aplicar Design System Ultra-Tech

#### Containers e Cards
```jsx
// ❌ Antes
<div className="bg-white shadow rounded-lg p-6">

// ✅ Depois
<div className="glass-ultra p-6 spring-transition">
```

#### Stat Cards
```jsx
// ❌ Antes
<div className="stat-card">
  <p className="text-sm text-gray-600">Total</p>
  <p className="text-3xl font-bold">{total}</p>
</div>

// ✅ Depois
import { StatCard } from '@/components/ui/stat-card';

<StatCard
  title="Total"
  value={total}
  subtitle={`${count} itens`}
  icon={ShoppingCart}
  gradient="from-navy-900 to-navy-800"
  delay={0}
/>
```

#### Botões
```jsx
// ❌ Antes
<button className="bg-blue-600 text-white px-4 py-2">
  Criar
</button>

// ✅ Depois
<Button className="btn-gold shadow-gold-glow spring-transition">
  <Plus className="w-4 h-4 mr-2" />
  Criar
</Button>
```

#### Texto (SEMPRE #000000)
```jsx
// ❌ Antes
<h1 className="text-3xl font-bold text-navy-900">

// ✅ Depois
<h1 className="text-3xl font-bold" style={{ color: '#000000' }}>
```

#### Inputs
```jsx
// ❌ Antes
<input className="w-full px-3 py-2 border" />

// ✅ Depois
<input className="input-modern w-full" />
```

---

### 4. Implementar Responsive Tables

#### ❌ Antes (Só Desktop)
```jsx
<table className="w-full">
  <thead>
    <tr>
      {headers.map(h => <th>{h}</th>)}
    </tr>
  </thead>
  <tbody>
    {data.map(item => (
      <tr key={item.id}>
        <td>{item.name}</td>
        <td>{item.email}</td>
      </tr>
    ))}
  </tbody>
</table>
```

#### ✅ Depois (Mobile + Desktop)
```jsx
import { ResponsiveTable, TruncatedCell } from '@/components/ui/responsive-table';

<ResponsiveTable
  headers={['Nome', 'Email', 'Ações']}
  data={data}
  renderRow={(item) => (
    <>
      <td className="px-6 py-4">
        <TruncatedCell text={item.name} maxLength={30} />
      </td>
      <td className="px-6 py-4">
        <span style={{ color: '#000000' }}>{item.email}</span>
      </td>
      <td className="px-6 py-4">
        <Button size="sm">Editar</Button>
      </td>
    </>
  )}
  renderMobileCard={(item) => (
    <div className="space-y-2">
      <div className="font-bold" style={{ color: '#000000' }}>
        {item.name}
      </div>
      <div className="text-sm" style={{ color: '#7a7a7a' }}>
        {item.email}
      </div>
      <Button size="sm" className="w-full">Ver Detalhes</Button>
    </div>
  )}
  emptyMessage="Nenhum dado encontrado"
/>
```

---

### 5. Loading States

#### ❌ Antes
```jsx
if (loading) {
  return <div>Loading...</div>;
}
```

#### ✅ Depois
```jsx
import { StatCardSkeleton } from '@/components/ui/stat-card';
import { TableSkeleton } from '@/components/ui/responsive-table';

if (isLoading) {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
      </div>
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
```

---

### 6. Charts com Horizontal Scroll

```jsx
import { ChartContainer } from '@/components/ui/chart-container';

<ChartContainer
  title="Vendas por Operadora"
  subtitle="Distribuição mensal"
  scrollable={true}  // Ativa scroll horizontal
  delay={0.2}
  actions={
    <Button size="sm" variant="outline">Exportar</Button>
  }
>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={chartData}>
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
```

---

## 🎨 Checklist Ultra-Tech (Para Cada Página)

### Visual
- [ ] Substituir `.glass-card` por `.glass-ultra`
- [ ] Adicionar `.spring-transition` em cards/buttons
- [ ] Usar `.btn-gold .shadow-gold-glow` em botões de ação
- [ ] Usar `.btn-secondary` em botões de cancelar
- [ ] Garantir todo texto usa `style={{ color: '#000000' }}`
- [ ] Adicionar `.animate-fade-in` no container principal
- [ ] Usar `.input-modern` em todos os inputs
- [ ] Usar `.select-modern` em todos os selects

### Performance
- [ ] Substituir fetch manual por hooks React Query
- [ ] Implementar optimistic updates (create, update, delete)
- [ ] Adicionar loading skeletons (StatCardSkeleton, TableSkeleton)
- [ ] Remover spinners que bloqueiam UI

### Responsive
- [ ] Substituir tables por `ResponsiveTable`
- [ ] Adicionar `renderMobileCard` para mobile
- [ ] Usar `TruncatedCell` em células longas
- [ ] Adicionar `.horizontal-scroll` em tables/charts largos

### Animations
- [ ] Adicionar `delay` nos StatCards (0, 0.1, 0.2, ...)
- [ ] Usar `motion.div` com `framer-motion` onde apropriado
- [ ] Adicionar `.animate-slide-up` em alertas
- [ ] Adicionar `.animate-scale-in` em ícones

---

## 📁 Exemplo Completo: Migração de Partners.jsx

### Imports
```jsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StatCard, StatCardSkeleton } from '@/components/ui/stat-card';
import { ResponsiveTable, TruncatedCell, TableSkeleton } from '@/components/ui/responsive-table';
import { usePartners, useCreatePartner, useUpdatePartner, useDeletePartner } from '@/hooks/usePartnersData';
```

### Component
```jsx
function Partners() {
  const [dialogOpen, setDialogOpen] = useState(false);

  // React Query hooks (background refresh automático)
  const { data: partners, isLoading, error } = usePartners();

  // Optimistic mutations
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const deleteMutation = useDeletePartner();

  const handleCreate = (formData) => {
    createMutation.mutate(formData, {
      onSuccess: () => setDialogOpen(false)
    });
  };

  const handleUpdate = (partnerId, updates) => {
    updateMutation.mutate({ partnerId, updates });
  };

  const handleDelete = (partnerId) => {
    if (!confirm('Tem certeza?')) return;
    deleteMutation.mutate(partnerId);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <StatCardSkeleton />
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
      {/* Header */}
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Parceiros"
          value={partners?.length || 0}
          icon={Users}
          gradient="from-navy-900 to-navy-800"
          delay={0}
        />
      </div>

      {/* Table */}
      <ResponsiveTable
        headers={['Nome', 'Email', 'Tipo', 'Status', 'Ações']}
        data={partners}
        renderRow={(partner) => (
          <>
            <td className="px-6 py-4">
              <TruncatedCell text={partner.name} />
            </td>
            <td className="px-6 py-4">
              <span style={{ color: '#000000' }}>{partner.email}</span>
            </td>
            <td className="px-6 py-4">
              <Badge>{partner.type}</Badge>
            </td>
            <td className="px-6 py-4">
              <Badge variant={partner.active ? 'default' : 'secondary'}>
                {partner.active ? 'Ativo' : 'Inativo'}
              </Badge>
            </td>
            <td className="px-6 py-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleEdit(partner)}
                  className="spring-transition"
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(partner.id)}
                  className="spring-transition"
                >
                  Eliminar
                </Button>
              </div>
            </td>
          </>
        )}
        renderMobileCard={(partner) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: '#000000' }}>
                {partner.name}
              </span>
              <Badge variant={partner.active ? 'default' : 'secondary'}>
                {partner.active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <div className="text-sm" style={{ color: '#7a7a7a' }}>
              <div>{partner.email}</div>
              <div>Tipo: {partner.type}</div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1 spring-transition"
                onClick={() => handleEdit(partner)}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 spring-transition"
                onClick={() => handleDelete(partner.id)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
        emptyMessage="Nenhum parceiro encontrado"
      />

      {/* Dialog (unchanged) */}
    </div>
  );
}

export default Partners;
```

---

## 🚀 Ordem Recomendada de Migração

1. **Forms.jsx** (187 linhas) - Simples, bom para testar padrão
2. **Alerts.jsx** (491 linhas) - Média complexidade
3. **Users.jsx** (533 linhas) - Usa hooks useUsersData
4. **Operators.jsx** (637 linhas) - Usa hooks useOperatorsData
5. **Partners.jsx** (651 linhas) - Usa hooks usePartnersData
6. **Dashboard.jsx** (1313 linhas) - Grande mas essencial
7. **CommissionReports.jsx** (1326 linhas) - Grande
8. **Sales.jsx** (2553 linhas) - Maior, deixar por último

---

## 🛠️ Comandos Úteis

### Build
```bash
npm run build
```

### Preview
```bash
npm run preview
```

### Dev
```bash
npm run dev
```

---

## 📚 Referências

- **Guia Completo**: `ULTRA_TECH_IMPLEMENTATION_GUIDE.md`
- **Resumo Técnico**: `ULTRA_TECH_REFACTOR_COMPLETE.md`
- **Resumo Executivo**: `ULTRA_TECH_SUMMARY.md`
- **Hooks**: `/src/hooks/use*Data.js`
- **Componentes**: `/src/components/ui/*.jsx`
- **CSS System**: `/src/index.css`

---

## ✅ Validação Final

Após migrar cada página, verificar:

1. **Build** passa sem erros
2. **Background refresh** funciona (esperar 5min e ver dados atualizarem)
3. **Optimistic UI** funciona (criar/editar/deletar sem spinners)
4. **Responsive** funciona (mobile < 768px mostra cards)
5. **Texto** todo em preto puro (#000000)
6. **Botões** principais em dourado com glow
7. **Animações** suaves (spring transitions)

---

**Status**: Infraestrutura 100% ✅ | Migração de Páginas em Progresso 🔄

**Build**: ✓ Funcional | **Performance**: ⚡ Optimized | **Design**: 💎 Ultra-Tech
