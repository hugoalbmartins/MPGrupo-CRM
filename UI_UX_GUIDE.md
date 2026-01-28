# Guia UI/UX - CRM MP GRUPO

## Visão Geral
O CRM foi completamente reformulado seguindo os melhores princípios de design SaaS moderno, com foco em usabilidade, performance e experiência visual premium.

## Stack Tecnológica

### Core
- **React 19** - Framework principal
- **Tailwind CSS** - Estilização utilitária
- **Framer Motion** - Animações e transições suaves
- **Lucide React** - Biblioteca de ícones moderna
- **Recharts** - Gráficos e visualizações de dados

### Componentes
- **Radix UI** - Componentes acessíveis e sem estilo
- **shadcn/ui** - Sistema de componentes customizáveis

## Paleta de Cores

### Cores Primárias
- **Slate** - Base neutra para backgrounds e textos
  - Slate 50-100: Backgrounds
  - Slate 600-900: Textos e elementos escuros

- **Indigo** - Cor de destaque (CTAs, links, elementos ativos)
  - Indigo 500-600: Botões primários
  - Indigo 50-100: Backgrounds de estados hover

### Cores Secundárias
- **Red** (500-600): Alertas e notificações urgentes
- **Green** (500-600): Status de sucesso
- **Amber** (500-600): Avisos

## Efeitos Visuais

### Glassmorphism
Aplicado em cards e componentes principais para criar profundidade e modernidade:

```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.5);
  box-shadow: 0 8px 32px rgba(148, 163, 184, 0.1);
}
```

### Gradientes
Utilizados em:
- Background geral da aplicação
- Sidebar (Slate 900 → Slate 800 → Slate 900)
- Botões primários (Indigo 600 → Indigo 500)
- Estados ativos de navegação

### Sombras e Elevação
Sistema de elevação em 3 níveis:
- **Nível 1**: Cards padrão (`shadow-xl`)
- **Nível 2**: Cards em hover (`shadow-2xl`)
- **Nível 3**: Modais e dropdowns (`shadow-2xl` com blur)

## Componentes Principais

### Layout
**Sidebar Colapsável**
- Estado expandido: 280px de largura
- Estado colapsado: 80px de largura
- Animações suaves com Framer Motion
- Tooltips aparecem no estado colapsado
- Botão de colapso posicionado estrategicamente

**Header**
- Glassmorphism com backdrop blur
- Sticky positioning
- Breadcrumbs para navegação contextual
- Badge de notificações animado
- Avatar do usuário com gradiente

### Navegação
**Menu Items**
- Estados: Normal, Hover, Ativo
- Ícones animados (escala no hover)
- Badge de contador para alertas
- Transições de 200ms para feedback instantâneo

**Breadcrumbs**
- Navegação hierárquica clara
- Ícone Home para retorno rápido
- Último item em destaque
- Separadores visuais (ChevronRight)

### Loading States
**Skeleton Screens**
- `SkeletonCard`: Para cards de estatísticas
- `SkeletonTable`: Para tabelas de dados
- `SkeletonChart`: Para gráficos
- `SkeletonDashboard`: Layout completo

Características:
- Animação de pulse suave
- Gradientes de Slate 100 → Slate 50
- Transições de fade-in ao carregar dados reais

### Feedback Visual
**Tooltips**
- Delay de 300ms (não intrusivo)
- Background: Slate 900
- Posicionamento inteligente
- Aparece apenas em contextos necessários

**Animações**
- Fade In: Entrada de conteúdo
- Slide Up: Cards e modais
- Scale In: Botões e badges
- Duração padrão: 300ms

## Responsividade

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Comportamentos
**Mobile**
- Sidebar em overlay (desliza da esquerda)
- Menu hamburger no topo esquerdo
- Breadcrumbs condensados
- Cards em coluna única

**Desktop**
- Sidebar fixa com opção de colapso
- Layout de duas colunas
- Breadcrumbs completos
- Grid responsivo para cards

## Classes Utilitárias Customizadas

### Componentes
```css
.glass-card - Card com glassmorphism
.glass-card-hover - Glass card com efeito hover
.stat-card - Card de estatística completo
.btn-primary - Botão primário com gradiente Indigo
.btn-secondary - Botão secundário com gradiente Slate
.nav-item-active - Estado ativo de navegação
.nav-item - Estado normal de navegação
.table-glass - Tabela com glassmorphism
```

### Utilitários
```css
.text-gradient - Texto com gradiente Indigo
.animate-fade-in - Animação de fade
.animate-slide-up - Animação de deslize
.animate-scale-in - Animação de escala
.scrollbar-thin - Scrollbar estilizada
```

## Melhores Práticas

### Performance
1. **Lazy Loading**: Componentes pesados carregados sob demanda
2. **Memoização**: Componentes otimizados com React.memo
3. **Debouncing**: Inputs de busca com delay de 300ms
4. **Virtual Scrolling**: Para listas longas

### Acessibilidade
1. **Contraste**: Mínimo de 4.5:1 para textos
2. **Focus States**: Visíveis em todos os elementos interativos
3. **ARIA Labels**: Em ícones e botões sem texto
4. **Keyboard Navigation**: Totalmente funcional

### Consistência
1. **Espaçamento**: Sistema base de 4px (0.25rem)
2. **Border Radius**: 1rem para cards, 0.75rem para botões
3. **Transições**: 200ms ease-in-out (padrão)
4. **Tipografia**: Sistema de escalas definido

## Hierarquia Visual

### Títulos
- **H1**: 2rem (text-2xl) - Títulos de página
- **H2**: 1.5rem (text-xl) - Seções principais
- **H3**: 1.25rem (text-lg) - Subsecções
- **Body**: 0.875rem (text-sm) - Texto padrão

### Pesos de Fonte
- **Bold** (700): Títulos e CTAs
- **Semibold** (600): Subtítulos e labels importantes
- **Medium** (500): Navegação e botões
- **Regular** (400): Corpo de texto

## Componentes de Dashboard

### Cards de Estatística
- Glassmorphism com hover effect
- Ícone com gradiente colorido
- Valor em destaque (2rem)
- Label descritivo
- Indicador de tendência (opcional)

### Gráficos
- Recharts com tema customizado
- Cores da paleta Slate/Indigo
- Tooltips informativos
- Grid suave
- Animações na entrada

### Tabelas
- Header com gradient background
- Hover em linhas (Indigo 50/30)
- Bordas suaves (Slate 100/50)
- Sticky header
- Paginação integrada

## Exemplos de Uso

### Card com Glassmorphism
```jsx
<div className="glass-card glass-card-hover p-6">
  <h3 className="text-lg font-semibold text-slate-900">Título</h3>
  <p className="text-sm text-slate-600">Conteúdo</p>
</div>
```

### Botão Primário
```jsx
<button className="btn-primary px-6 py-3">
  Ação Principal
</button>
```

### Skeleton de Carregamento
```jsx
import { SkeletonDashboard } from '@/components/ui/skeleton-loader';

{loading ? <SkeletonDashboard /> : <DashboardContent />}
```

## Conclusão

Este sistema de design foi construído para escalar, com componentes modulares e reutilizáveis que mantêm consistência visual em toda a aplicação. O foco está em:

- ✅ **Clareza**: Interface limpa e intuitiva
- ✅ **Performance**: Carregamento rápido e animações suaves
- ✅ **Modernidade**: Visual SaaS profissional de alto nível
- ✅ **Acessibilidade**: Utilizável por todos
- ✅ **Responsividade**: Funcional em qualquer dispositivo
