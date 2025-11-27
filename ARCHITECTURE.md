# MP Grupo - CRM - Arquitetura da Aplicação

## 📋 Visão Geral

Sistema de CRM para gestão de parceiros e vendas com sistema complexo de comissões.

**Stack Tecnológico:**
- **Frontend:** React 18 + TailwindCSS + Shadcn UI
- **Backend:** FastAPI + Python 3.11
- **Database:** MongoDB
- **Auth:** JWT

---

## 📁 Estrutura do Projeto

```
/app/
├── backend/
│   ├── server.py           # Main FastAPI app, all endpoints
│   ├── models.py           # Pydantic models for DB entities
│   ├── utils.py            # Helper functions (password, commission, validation)
│   ├── routes/             # [Future] Separated route modules
│   ├── tests/              # Unit tests
│   │   ├── test_commissions.py
│   │   └── README.md
│   ├── .env               # Environment variables
│   └── requirements.txt   # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/        # Shadcn UI components
│   │   │   ├── Layout.js  # Main layout with sidebar
│   │   │   └── CommissionConfig.js  # Commission configuration UI
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── ChangePassword.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Partners.js
│   │   │   ├── Sales.js
│   │   │   ├── Operators.js
│   │   │   ├── Users.js
│   │   │   └── Profile.js
│   │   ├── App.js         # Main router
│   │   └── App.css        # Global styles
│   ├── public/
│   └── package.json
│
└── uploads/               # Uploaded documents storage
```

---

## 🔐 Sistema de Autenticação

### Tipos de Utilizadores

1. **Admin** (role: `admin`)
   - Acesso total ao sistema
   - Vê todas as comissões
   - Gere utilizadores, parceiros e operadoras
   - Dashboards globais

2. **Backoffice** (role: `bo`)
   - Regista e edita vendas
   - Vê todas as vendas SEM comissões
   - Pode desativar/reativar operadoras
   - Dashboards de quantidades

3. **Parceiro** (role: `partner`)
   - Vê apenas suas próprias vendas
   - Acesso a valores de comissões
   - Dashboard com comissões por tipo/estado
   - Pode adicionar notas

4. **Parceiro Comercial** (role: `partner_commercial`)
   - Associado a um parceiro
   - Vê apenas vendas registadas por si
   - SEM acesso a comissões

### Fluxo de Autenticação

1. Login → JWT token gerado
2. Token incluído em todas as requests (Header: `Authorization: Bearer {token}`)
3. Middleware `get_current_user()` valida token
4. Redirecionamento obrigatório para mudar password no 1º login

---

## 💰 Sistema de Comissões

### Lógica de Cálculo

**Patamares por Operadora/Parceiro:**
- Cada operadora tem sua configuração de patamares
- Patamares aplicados baseado em vendas do PARCEIRO naquela OPERADORA
- Contadores independentes entre operadoras

**Estrutura de Configuração:**
```json
{
  "particular": {
    "M3": {
      "tiers": [
        {"min_sales": 0, "multiplier": 1.5},
        {"min_sales": 3, "multiplier": 2.0}
      ]
    }
  },
  "empresarial": {
    "M3": {
      "tiers": [
        {"min_sales": 0, "multiplier": 2.0}
      ]
    }
  }
}
```

**Exemplo:**
- Parceiro Paulo tem 4 vendas na Vodafone
- Vodafone: patamar 0-2=1.5x, 3+=2.0x
- 4ª venda: aplica 2.0x ✅

**Âmbitos:**
1. **Telecomunicações:** `comissão = monthly_value × multiplier`
2. **Energia/Solar/Dual:** `comissão = commission_value` (valor fixo)

### Comissões a Pagar

- Apenas vendas com status **"Ativo"**
- Dashboard mensal mostra comissões a pagar do mês selecionado

---

## 🔢 Geração de Códigos

### Códigos de Parceiros
**Formato:** `[TIPO][1001+sequencial]`
- D2D1001, D2D1002, ...
- Rev1001, Rev1002, ...
- Rev+1001, Rev+1002, ...

Cada tipo mantém contador próprio.

### Códigos de Vendas
**Formato:** `[3 letras parceiro][sequencial mês 4 dígitos][mês 2 dígitos]`
- ALB000111 = Alberto, 1ª venda, novembro
- ALB000211 = Alberto, 2ª venda, novembro
- JOÃ000112 = João, 1ª venda, dezembro

Suporta caracteres especiais (Ã, Ç, etc).

---

## 📊 Dashboards

### Admin Dashboard
- Total vendas + parceiros
- Comissões totais, a pagar (só Ativo), pagas
- Vendas por tipo, estado, parceiro, operadora
- Gráfico 12 meses (barras por âmbito)

### BO Dashboard
- Total vendas (sem comissões)
- Vendas por tipo e estado
- Evolução por parceiro
- Gráfico 12 meses

### Parceiro Dashboard
- Vendas pessoais
- Comissões totais, pendentes, pagas
- Comissões por estado e tipo
- Gráfico 12 meses

### Comercial Dashboard
- Vendas registadas por si
- Totais por âmbito (sem comissões)
- Gráfico 12 meses

**Filtro Mensal:**
- Seletor mês/ano no canto superior direito
- Predefinido: mês atual
- Dashboard reinicia ao dia 1 de cada mês

---

## ✅ Validações

### NIF com CRC
- NIFs começados por **5** validam dígito de controlo
- Algoritmo: multiplica por [9,8,7,6,5,4,3,2], calcula 11-(soma%11)
- Feedback visual em tempo real no frontend

### CPE
**Formato:** `PT0002` + 12 dígitos + 2 letras
Exemplo: `PT0002123456789012AB`

### CUI
**Formato:** `PT16` + 15 dígitos + 2 letras
Exemplo: `PT161234567890123456AB`

---

## 📤 Exportação Excel

**Endpoint:** `GET /api/sales/export/excel`

**Parâmetros:**
- `start_date` (opcional)
- `end_date` (opcional)

**Colunas Exportadas:**
- Código, Data, Parceiro, Âmbito, Tipo Cliente
- Nome/NIF/Contacto Cliente
- Operadora, Status, Requisição
- **Comissão** (só Admin/Parceiro)
- Campos específicos por âmbito
- Paga Operador, Data Pagamento

**Formatação:**
- Header azul com texto branco
- Colunas auto-ajustadas
- Arquivo: `vendas_YYYYMMDD_HHMMSS.xlsx`

---

## 📁 Gestão de Documentos

### Parceiros
- Upload de documentos múltiplos
- Download individual
- Armazenamento em `/uploads/`

**Endpoints:**
- `POST /api/partners/{id}/documents` - Upload
- `GET /api/partners/{id}/documents/{doc_id}` - Download

---

## 🔧 Funcionalidades Implementadas

### Core
✅ Sistema de Comissões (patamares por operadora/parceiro)  
✅ Dashboards Específicos por Perfil  
✅ Geração Automática de Códigos  
✅ Validação NIF com CRC  
✅ Dashboard Mensal com Gráfico 12 Meses  
✅ Exportação Excel  
✅ Upload/Download Documentos  
✅ Edição de Vendas (Admin/BO)  
✅ Sistema de Notas  

### Gestão
✅ CRUD Parceiros  
✅ CRUD Vendas  
✅ CRUD Operadoras (configuração comissões)  
✅ CRUD Utilizadores  

### Segurança
✅ Login JWT  
✅ Passwords fortes  
✅ Mudança obrigatória no 1º login  
✅ Permissões por role  

---

## 🧪 Testes

**Localização:** `/app/backend/tests/`

**Executar:**
```bash
cd /app/backend
pytest tests/ -v
```

**Cobertura Atual:**
- Cálculo de comissões
- Geração de códigos
- Validação NIF com CRC

**Total:** 11 testes ✅

---

## 🚀 Deployment

**Supervisord:**
- Backend: `sudo supervisorctl restart backend`
- Frontend: `sudo supervisorctl restart frontend`

**Status:**
```bash
sudo supervisorctl status
```

**Logs:**
```bash
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.err.log
```

---

## 📝 Próximos Passos (Futuro)

### Refatoração
- [ ] Separar routes em módulos (`/app/backend/routes/`)
- [ ] Criar mais testes de integração
- [ ] Implementar cache para dashboards

### Features
- [ ] Relatórios PDF
- [ ] Notificações por email
- [ ] Histórico de alterações (audit log)
- [ ] Backup automático

### Performance
- [ ] Indexação MongoDB
- [ ] Paginação de vendas
- [ ] Lazy loading de documentos

---

**Versão:** 1.0  
**Última Atualização:** Novembro 2025  
**Status:** ✅ Produção Ready
