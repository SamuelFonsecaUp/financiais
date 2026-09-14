# 🚀 Roadmap: Super Importador Inteligente (Meu Financeiro)

Este documento registra as 6 melhorias planejadas para o módulo de importação de extratos (OFX / CSV) do aplicativo **Meu Financeiro**.

Repositório: [https://github.com/SamuelFonsecaUp/financiais](https://github.com/SamuelFonsecaUp/financiais)

---

## 📋 Lista de Melhorias & Status

### 1. 🎯 Detecção Automática do Banco e Conta/Cartão (Auto-matching via OFX)
- [x] Extrair `<BANKID>`, `<ORG>`, `<ACCTID>`, `<ACCTTYPE>` dos arquivos OFX.
- [x] Adicionar catálogo de códigos de bancos (260 Nubank, 341 Itaú, 033 Santander, 237 Bradesco, etc.).
- [x] Cruzar com as contas/cartões cadastrados e selecionar automaticamente o destino.
- [x] Identificar faturas de cartão (`<CREDITCARDMSGSRSV1>`) e chavear para Cartão de Crédito.
- [x] Exibir badge e aviso visual na tela informando a conta detectada.

### 2. 🔄 Detecção Inteligente de Transferências Entre Contas Próprias
- [x] Analisar padrões de Pix/TED/DOC e casar valores e datas entre contas do usuário.
- [x] Identificar transferências internas no backend durante a conciliação.
- [x] Exibir aviso visual no card do lançamento com a conta de origem/destino.

### 3. 🏷️ Criar Nova Categoria sem Sair da Importação
- [x] Adicionar botão `+ Nova Categoria` e opção no menu suspenso de categorias na revisão.
- [x] Modal rápido integrado (`CategoryModal`) para criar categoria com nome, tipo, ícone e cor.
- [x] Aplicar a categoria recém-criada imediatamente ao lançamento ou grupo em revisão.

### 4. ✏️ Edição Rápida da Descrição na Revisão
- [x] Edição inline da descrição de qualquer lançamento antes de confirmar a importação.
- [x] Possibilidade de renomear o nome do estabelecimento no modo agrupado (com tecla Enter para salvar e Esc para cancelar).

### 5. 🔍 Busca em Tempo Real e Filtros Rápidos na Revisão
- [x] Campo de busca instantânea no cabeçalho da revisão (por descrição, valor, loja ou memorando).
- [x] Filtros com chips rápidos: "Todos", "⚠️ Sem Categoria" (com destaque), "Categorizados", "Receitas", "Despesas", "Duplicadas".

### 6. 📂 Importação em Lote (Arrastar Vários Arquivos de uma Vez)
- [x] Suporte a seleção múltipla de arquivos (`.ofx`, `.csv`) no diálogo do sistema operacional e no Drag & Drop.
- [x] Detecção visual de arraste com feedback dinâmico na área de upload.
- [x] Combinação automática e conciliação sequencial unificada de múltiplos extratos.

---

## 🛠️ Como continuar o desenvolvimento em outro dia
Quando quiser retomar o desenvolvimento:
1. Abra o assistente no projeto.
2. Diga: *"Bora continuar as tarefas do ROADMAP_IMPORTADOR.md, vamos fazer a tarefa 1 e 3 hoje"*.
3. O assistente lerá este arquivo e o plano técnico e continuará de onde paramos!

---

*Documento gerado e versionado no Git em 13/09/2026.*
