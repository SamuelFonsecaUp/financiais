# 🚀 Roadmap: Super Importador Inteligente (Meu Financeiro)

Este documento registra as 6 melhorias planejadas para o módulo de importação de extratos (OFX / CSV) do aplicativo **Meu Financeiro**.

Repositório: [https://github.com/SamuelFonsecaUp/financiais](https://github.com/SamuelFonsecaUp/financiais)

---

## 📋 Lista de Melhorias & Status

### 1. 🎯 Detecção Automática do Banco e Conta/Cartão (Auto-matching via OFX)
- [ ] Extrair `<BANKID>`, `<ORG>`, `<ACCTID>`, `<ACCTTYPE>` dos arquivos OFX.
- [ ] Adicionar catálogo de códigos de bancos (260 Nubank, 341 Itaú, 033 Santander, 237 Bradesco, etc.).
- [ ] Cruzar com as contas/cartões cadastrados e selecionar automaticamente o destino.
- [ ] Identificar faturas de cartão (`<CREDITCARDMSGSRSV1>`) e chavear para Cartão de Crédito.
- [ ] Exibir badge visual na tela informando a conta detectada.

### 2. 🔄 Detecção Inteligente de Transferências Entre Contas Próprias
- [ ] Analisar padrões de Pix/TED/DOC e casar valores e datas entre contas do usuário.
- [ ] Sugerir conversão do lançamento para `transfer` interno.
- [ ] Evitar distorção de relatórios (não contar transferência própria como receita ou despesa).
- [ ] Permitir confirmação ou descarte da sugestão com 1 clique.

### 3. 🏷️ Criar Nova Categoria sem Sair da Importação
- [ ] Adicionar botão `+ Nova Categoria` dentro do seletor de categorias na revisão.
- [ ] Modal rápido para criar categoria com nome, tipo (receita/despesa), ícone e cor.
- [ ] Aplicar a categoria recém-criada imediatamente ao lançamento/grupo em revisão.

### 4. ✏️ Edição Rápida da Descrição na Revisão
- [ ] Edição inline da descrição de qualquer lançamento antes de confirmar a importação.
- [ ] Possibilidade de renomear o nome do estabelecimento no modo agrupado.
- [ ] Salvar o padrão renomeado nas regras automáticas aprendidas.

### 5. 🔍 Busca em Tempo Real e Filtros Rápidos na Revisão
- [ ] Campo de busca instantânea (por descrição, valor ou dados do extrato).
- [ ] Filtro rápido: "Apenas pendentes de categoria".
- [ ] Filtro rápido: "Apenas receitas" ou "Apenas despesas".
- [ ] Filtro rápido: "Duplicatas ocultas".

### 6. 📂 Importação em Lote (Arrastar Vários Arquivos de uma Vez)
- [ ] Suporte a seleção múltipla de arquivos (`.ofx`, `.csv`) no diálogo e no Drag & Drop.
- [ ] Fila de importação mostrando os arquivos adicionados e os bancos detectados.
- [ ] Processamento sequencial sem necessidade de recomeçar o fluxo do zero.

---

## 🛠️ Como continuar o desenvolvimento em outro dia
Quando quiser retomar o desenvolvimento:
1. Abra o assistente no projeto.
2. Diga: *"Bora continuar as tarefas do ROADMAP_IMPORTADOR.md, vamos fazer a tarefa 1 e 3 hoje"*.
3. O assistente lerá este arquivo e o plano técnico e continuará de onde paramos!

---

*Documento gerado e versionado no Git em 13/09/2026.*
