# Backend Tests

Este diretório contém testes para o backend do CRM.

## Estrutura de Testes

- `test_commissions.py` - Testes de cálculo de comissões, geração de códigos e validações

## Como Executar os Testes

```bash
# Executar todos os testes
cd /app/backend
pytest tests/

# Executar com verbose
pytest tests/ -v

# Executar arquivo específico
pytest tests/test_commissions.py

# Executar teste específico
pytest tests/test_commissions.py::TestCommissionCalculation::test_telecom_commission_tier_0
```

## Cobertura de Testes

### Implementados:
- ✅ Cálculo de comissões (telecomunicações e energia)
- ✅ Patamares de comissão
- ✅ Geração de códigos de parceiros
- ✅ Geração de códigos de vendas
- ✅ Validação NIF com CRC

### A Implementar (Futuro):
- Testes de integração de endpoints
- Testes de autenticação e permissões
- Testes de dashboard por perfil
- Testes de exportação Excel
