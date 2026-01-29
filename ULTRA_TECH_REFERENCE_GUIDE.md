# Ultra-Tech Design System - Guia de Referência Rápida

## 🎨 Paleta de Cores

### Cores Principais
- **Navy Deep**: `#0f172a` - Cor primária escura
- **Navy Mid**: `#1e293b` - Cor secundária
- **Gold**: `#d4af37` - Cor de destaque
- **Black**: `#000000` - Texto principal

### Cores de Texto
```css
color-cyan    → Azul ciano (telecomunicações)
color-orange  → Laranja (energia)
color-green   → Verde (solar, sucesso)
color-blue    → Azul (informação)
color-purple  → Roxo (comissões)
```

### Cores de Fundo (Ícones)
```css
bg-cyan       → Gradient cyan
bg-orange     → Gradient orange
bg-green      → Gradient green
bg-blue       → Gradient blue
bg-purple     → Gradient purple
```

---

## 📦 Componentes Principais

### Cartões

#### Cartão Padrão
```jsx
<div className="stat-card spring-transition">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>
        Título
      </p>
      <p className="text-3xl font-bold mb-1" style={{ color: '#000000' }}>
        Valor
      </p>
      <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>
        Subtítulo
      </p>
    </div>
    <div className="w-14 h-14 bg-gradient-to-r from-navy-900 to-navy-800 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
      <Icon className="w-7 h-7 text-white" />
    </div>
  </div>
</div>
```

#### Cartão Dourado (Premium)
```jsx
<div className="stat-card-gold spring-transition">
  {/* Mesmo conteúdo do cartão padrão */}
</div>
```

#### Container com Vidro
```jsx
<div className="glass-ultra p-6">
  {/* Conteúdo */}
</div>
```

---

## 🎯 Botões

### Botão Primário (Navy)
```jsx
<button className="btn-primary px-4 py-2">
  Ação Principal
</button>
```

### Botão Dourado (Premium)
```jsx
<button className="btn-gold px-4 py-2">
  Ação Premium
</button>
```

### Botão Secundário
```jsx
<button className="btn-secondary px-4 py-2">
  Ação Secundária
</button>
```

---

## 📊 Tabelas

### Container de Tabela
```jsx
<div className="glass-ultra p-6">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="table-header">
          <th>Coluna 1</th>
          <th>Coluna 2</th>
        </tr>
      </thead>
      <tbody>
        <tr className="table-row">
          <td>Valor 1</td>
          <td>Valor 2</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## 🎭 Animações

### Transição Suave (Spring)
```jsx
<div className="spring-transition">
  {/* Transição suave em todas as propriedades */}
</div>
```

### Fade In
```jsx
<div className="animate-fade-in">
  {/* Aparece com fade */}
</div>
```

### Slide Up
```jsx
<div className="animate-slide-up">
  {/* Desliza para cima */}
</div>
```

### Scale In
```jsx
<div className="animate-scale-in">
  {/* Escala para dentro */}
</div>
```

---

## 📝 Inputs e Formulários

### Input Moderno
```jsx
<input
  type="text"
  className="input-modern w-full"
  placeholder="Digite aqui..."
/>
```

### Select Moderno
```jsx
<select className="select-modern w-full">
  <option>Opção 1</option>
  <option>Opção 2</option>
</select>
```

---

## 🎨 Badges de Status

### Badge Padrão
```jsx
<span className="status-badge status-para-registo">
  Para Registo
</span>
```

### Variantes
```css
status-para-registo  → Amarelo (aguardando)
status-pendente      → Laranja (pendente)
status-concluido     → Verde (concluído)
status-ativo         → Azul (ativo)
status-cancelado     → Vermelho (cancelado)
```

---

## 💎 Efeitos Especiais

### Sombra Dourada
```jsx
<div className="shadow-gold">
  {/* Sombra gold padrão */}
</div>
```

### Brilho Dourado
```jsx
<div className="shadow-gold-glow">
  {/* Sombra gold intensa */}
</div>
```

### Gradiente de Texto Gold
```jsx
<h1 className="text-gradient-gold">
  Texto Dourado
</h1>
```

### Gradiente de Texto Navy
```jsx
<h1 className="text-gradient-navy">
  Texto Navy
</h1>
```

---

## 🎯 Padrões de Uso

### Dashboard Cards
1. Use `stat-card` para métricas padrão
2. Use `stat-card-gold` para destaque de métricas importantes
3. Adicione `spring-transition` para animações suaves
4. Use ícones com gradientes navy ou cores específicas

### Gráficos e Charts
1. Envolva em `glass-ultra p-6`
2. Use cores consistentes da paleta
3. Adicione títulos com `text-lg font-semibold text-navy-900`

### Listas e Tabelas
1. Container: `glass-ultra p-6`
2. Cabeçalho: `table-header`
3. Linhas: `table-row`
4. Hover automático incluído

### Formulários
1. Labels: `text-sm font-semibold` com `color: #595959`
2. Inputs: `input-modern`
3. Selects: `select-modern`
4. Botões: `btn-primary` ou `btn-gold`

---

## ⚡ Dicas de Performance

1. **Use spring-transition** apenas onde necessário
2. **Evite animações em listas longas** - use scroll virtual
3. **Combine classes** para reduzir HTML
4. **Use glass-ultra** para containers principais
5. **Prefira stat-card** sobre custom styling

---

## 🎨 Cores por Contexto

### Telecomunicações
- Ícone: `bg-cyan` ou `from-cyan-500 to-cyan-600`
- Texto: `color-cyan` ou `text-cyan-600`

### Energia
- Ícone: `bg-orange` ou `from-orange-500 to-orange-600`
- Texto: `color-orange` ou `text-orange-600`

### Solar
- Ícone: `bg-green` ou `from-green-500 to-green-600`
- Texto: `color-green` ou `text-green-600`

### Comissões
- Ícone: `from-purple-500 to-purple-600`
- Texto: `text-purple-600`

### Informação
- Ícone: `from-blue-500 to-blue-600`
- Texto: `text-blue-600`

---

## 📱 Responsividade

### Breakpoints Tailwind
```
sm:  640px   - Mobile landscape
md:  768px   - Tablet
lg:  1024px  - Desktop pequeno
xl:  1280px  - Desktop grande
2xl: 1536px  - Desktop muito grande
```

### Grid Responsivo
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Cards adaptativos */}
</div>
```

---

## 🔍 Exemplo Completo: Card de Métrica

```jsx
<div className="stat-card spring-transition">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <p className="text-sm font-semibold mb-2" style={{ color: '#595959' }}>
        Total de Vendas
      </p>
      <p className="text-3xl font-bold mb-1" style={{ color: '#000000' }}>
        1,234
      </p>
      <p className="text-xs font-medium" style={{ color: '#7a7a7a' }}>
        Este mês
      </p>
    </div>
    <div className="w-14 h-14 bg-gradient-to-r from-navy-900 to-navy-800 rounded-xl flex items-center justify-center shadow-lg spring-transition hover:scale-110">
      <ShoppingCart className="w-7 h-7 text-white" />
    </div>
  </div>
</div>
```

---

**Mantido e documentado por:** Sistema Ultra-Tech
**Última atualização:** 29 Janeiro 2026
**Versão:** 1.0 - Consolidado
