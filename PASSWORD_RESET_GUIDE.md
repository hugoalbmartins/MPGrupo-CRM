# Guia de Reset de Password

## Problema Identificado

Alguns utilizadores (especialmente parceiros) não conseguem fazer login com erro "Invalid login credentials" (400).

### Causa Raiz

Os utilizadores foram criados no sistema através da edge function `create-user`, mas:
- A password foi definida quando o utilizador foi criado
- O utilizador pode ter esquecido ou nunca recebeu a password
- Não há forma do utilizador recuperar a password por si próprio

## Solução Implementada

Criada uma funcionalidade de **Reset de Password** para administradores.

### Como Usar (Administrador)

1. **Login como Admin**
   - Faça login com uma conta de administrador (role: `admin`)

2. **Aceder à Gestão de Utilizadores**
   - Navegue para o menu **"Utilizadores"**
   - Verá a lista de todos os utilizadores do sistema

3. **Resetar Password**
   - Localize o utilizador que precisa de resetar a password
   - Clique no botão **laranja com ícone de chave** (🔑)
   - Um dialog abrirá com uma password forte gerada automaticamente
   - **Importante:** Copie essa password - você precisará fornecê-la ao utilizador

4. **Opções no Dialog**
   - **Password Gerada:** Uma password forte é gerada automaticamente
   - **Gerar Nova:** Clique em "Gerar" para criar uma password diferente
   - **Editar:** Pode editar manualmente a password se preferir
   - **Confirmar:** Clique em "Resetar Password" para aplicar

5. **Após o Reset**
   - A password do utilizador será alterada imediatamente
   - O sistema mostrará uma notificação com a nova password (guarde-a!)
   - O utilizador receberá a flag `must_change_password = true`
   - Na próxima vez que o utilizador fizer login, será obrigado a mudar a password

### Características da Funcionalidade

- ✅ Apenas administradores podem resetar passwords
- ✅ Password forte gerada automaticamente (8+ caracteres, maiúsculas, números, símbolos)
- ✅ Possibilidade de gerar múltiplas passwords até encontrar uma adequada
- ✅ Possibilidade de editar manualmente a password
- ✅ Notificação de sucesso com a password visível por 10 segundos
- ✅ Utilizador é obrigado a mudar a password no próximo login
- ✅ Funciona para todos os tipos de utilizadores (admin, bo, gestor, partner, etc.)

## Utilizadores Atuais no Sistema

Foram identificados os seguintes utilizadores:

| Email | Nome | Role | Status Auth |
|-------|------|------|-------------|
| `hugo.martins@marciopinto.pt` | Hugo Martins | Admin | ✅ Login OK |
| `geral@marciopinto.pt` | Marcio Pinto | Admin | ✅ Login OK |
| `adriana.ferreira@marciopinto.pt` | Adriana Ferreira | Back Office | ✅ Login OK |
| `hugo.martins@mpgrupo.pt` | Hugo A Martins | Gestor Nv1 | ✅ Login OK |
| `ana_fernandes_7@hotmail.com` | ANTONIO LUIS MOTA GOMES | Partner | ⚠️ Nunca fez login |

## Como Resolver o Problema do Parceiro

Para o utilizador **ANTONIO LUIS MOTA GOMES** que não consegue fazer login:

### Passo 1: Fazer Login como Admin
```
Email: hugo.martins@marciopinto.pt ou geral@marciopinto.pt
Password: [sua password de admin]
```

### Passo 2: Resetar a Password do Parceiro
1. Vá para **Utilizadores**
2. Encontre **ANTONIO LUIS MOTA GOMES** (ana_fernandes_7@hotmail.com)
3. Clique no botão **🔑 Reset Password** (laranja)
4. Copie a password gerada (exemplo: `Tr@nsp0rt2024!`)
5. Clique em **"Resetar Password"**

### Passo 3: Fornecer a Nova Password ao Parceiro
Envie ao parceiro:
```
Email de Login: ana_fernandes_7@hotmail.com
Password Temporária: [A password que copiou]

Importante: Você será obrigado a mudar esta password no primeiro login.
```

### Passo 4: Parceiro Faz Login
O parceiro deve:
1. Ir à página de login
2. Usar o email: `ana_fernandes_7@hotmail.com`
3. Usar a password temporária fornecida
4. Após o login, será redirecionado para mudar a password
5. Criar uma nova password pessoal

## Requisitos de Password

Todas as passwords devem ter:
- ✅ Mínimo 8 caracteres
- ✅ Pelo menos 1 letra maiúscula (A-Z)
- ✅ Pelo menos 1 número (0-9)
- ✅ Pelo menos 1 caractere especial (@, !, #, $, %, etc.)

Exemplos de passwords válidas:
- `Transp0rt@2024`
- `Secure#Pass123`
- `MyP@ssw0rd!`

## Segurança

A funcionalidade de reset de password:
- ✅ Usa Supabase Edge Functions com autenticação JWT
- ✅ Requer permissões de administrador
- ✅ Valida a força da password
- ✅ Atualiza a password no auth.users do Supabase
- ✅ Define flag para forçar mudança de password
- ✅ Todas as comunicações são via HTTPS
- ✅ Passwords são hasheadas automaticamente pelo Supabase Auth

## Troubleshooting

### "Only admins can reset passwords"
- Certifique-se de estar logado com uma conta de administrador
- Verifique se o seu role na tabela `users` é `'admin'`

### "Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char"
- Use o botão "Gerar" para criar uma password válida automaticamente
- Ou certifique-se de que a password manual cumpre os requisitos

### "Failed to reset password"
- Verifique a conexão com a internet
- Tente fazer logout e login novamente
- Verifique os logs no console do navegador (F12)

### Parceiro continua a não conseguir fazer login
- Certifique-se de que forneceu a password exata (copiar/colar)
- Verifique se o email está correto (case-insensitive)
- Tente resetar a password novamente
- Verifique se o utilizador existe em `auth.users` no Supabase Dashboard

## Manutenção

### Como Administrador de Sistema

Para verificar o estado dos utilizadores:

1. **Via Interface Web:**
   - Login como admin
   - Vá para "Utilizadores"
   - Visualize todos os utilizadores e seus roles

2. **Via Supabase Dashboard:**
   ```sql
   -- Ver utilizadores e seu estado de auth
   SELECT
     u.id,
     u.email,
     u.name,
     u.role,
     CASE
       WHEN au.id IS NOT NULL THEN 'Auth OK'
       ELSE 'Sem Auth'
     END as auth_status
   FROM public.users u
   LEFT JOIN auth.users au ON u.id = au.id
   ORDER BY u.email;
   ```

## Notas Técnicas

### Edge Function: `reset-user-password`

Localização: `/supabase/functions/reset-user-password/index.ts`

Funcionalidade:
- Autentica o utilizador atual
- Verifica se é administrador
- Valida a nova password
- Usa Service Role Key para atualizar a password via Admin API
- Define `must_change_password = true` na tabela users

### Service: `usersService.resetPassword()`

Localização: `/src/services/usersService.js`

Funcionalidade:
- Valida a password localmente
- Chama a edge function com autenticação JWT
- Trata erros e retorna resultado

---

## Suporte

Para problemas ou dúvidas:
1. Verifique este guia primeiro
2. Consulte os logs do navegador (F12 → Console)
3. Verifique o Supabase Dashboard → Authentication → Users
4. Contacte o administrador do sistema
