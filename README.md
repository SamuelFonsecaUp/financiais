# 💰 Meu Financeiro — Controle Financeiro Pessoal 100% Offline

[![Plataforma](https://img.shields.io/badge/Plataforma-Windows%2010%2B-blue.svg?style=flat-square&logo=windows)](https://microsoft.com)
[![Offline](https://img.shields.io/badge/Funcionamento-100%25%20Offline-success.svg?style=flat-square&logo=airplayvideo)](https://github.com)
[![Electron](https://img.shields.io/badge/Electron-44.3-47848F.svg?style=flat-square&logo=electron)](https://www.electronjs.org)
[![React](https://img.shields.io/badge/React-19.3-61DAFB.svg?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/Banco%20de%20Dados-SQLite%20(WAL)-003B57.svg?style=flat-square&logo=sqlite)](https://sqlite.org)
[![TailwindCSS](https://img.shields.io/badge/Estilização-TailwindCSS%203.4-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)

**Meu Financeiro** é um aplicativo desktop completo de **gestão financeira pessoal**, desenvolvido com foco obsessivo em **velocidade instantânea**, **privacidade absoluta**, **design moderno glassmorphic** e **funcionamento 100% offline**.

Nenhum dado financeiro trafega pela internet ou depende de servidores remotos, nuvens (Firebase, Supabase, etc.) ou APIs de terceiros. Todas as informações residem exclusivamente no disco rígido do seu computador com banco de dados relacional **SQLite** de alta performance.

---

## 🌟 Principais Funcionalidades

### 1. 🛡️ Privacidade e Funcionamento 100% Offline
- Opera sem conexão com a internet.
- Banco de dados local em `%APPDATA%\financeiro\meu_financeiro.sqlite` com modo WAL (*Write-Ahead Logging*).
- Proteção opcional por **PIN de segurança local** criptografado com **SHA-256 + Salt individual**.
- Bloqueio automático por inatividade e cofre seguro.

### 2. 🏦 Gestão de Contas Bancárias e Carteiras
- Controle de contas correntes, poupança, dinheiro em espécie, carteiras digitais e investimentos.
- Atualização em tempo real de saldos e extrato individual por conta.
- Transferências financeiras entre contas com validação de saldo e histórico duplo.

### 3. 💳 Cartões de Crédito e Parcelamentos Inteligentes
- Gestão de múltiplos cartões com controle de **limite total, limite utilizado e limite disponível**.
- Definição personalizada de **Dia de Fechamento** e **Dia de Vencimento**.
- Compras parceladas (2x até 72x) com projeção e divisão automática das parcelas mês a mês.
- Pagamento de fatura integrado que debita o valor diretamente da conta bancária escolhida.

### 4. 🧠 Conciliação Bancária & Importação OFX / CSV
- Leitor universal de extratos **OFX**, **QFX** e planilhas **CSV** de bancos como Itaú, Bradesco, Santander, Nubank, Inter, Caixa, Banco do Brasil, etc.
- **Detecção de duplicatas** inteligente por identificador único `FITID` e verificação composta.
- **Agrupamento automático por estabelecimento/origem** (ex: reúne 15 compras do iFood em um único card com soma total).
- Mapeador adaptativo de colunas CSV com suporte a separadores `;`, `,`, `TAB` ou `|`.

### 5. 🗄️ Cofre Permanente de Extratos OFX
- Todo arquivo OFX ou CSV aberto pelo usuário é **automaticamente preservado em cópia original** no diretório seguro do app (`%APPDATA%\financeiro\imported_statements\`).
- Histórico completo de extratos bancários com data de importação, tamanho, banco e atalho direto para abrir a pasta no Windows Explorer.

### 6. ✨ Aprendizado Contínuo de Regras de Categorização
- O sistema aprende automaticamente para onde você destina cada estabelecimento comercial.
- Ao categorizar um estabelecimento uma vez, as próximas importações reconhecem o padrão instantaneamente.
- Gerenciador visual de regras com contador de correspondências e edição em lote.

### 7. 🏷️ Categorias Personalizadas
- Divisão clara entre categorias de **Receitas** e **Despesas**.
- Paleta completa de cores e ícones temáticos para identificação visual rápida.
- Proteção contra exclusão acidental de categorias com movimentações vinculadas.

### 8. 🔁 Lançamentos Recorrentes & Despesas Fixas
- Gerenciamento de salários, aluguel, condomínio, luz, internet e assinaturas mensais.
- Frequência mensal, semanal ou anual com dia fixo de vencimento e alertas automáticos.

### 9. 🎯 Metas Financeiras (Cofrinhos Virtuais)
- Definição de objetivos (Viagem, Reserva de Emergência, Carro Novo, etc.).
- Barra de progresso visual de percentual atingido e dias restantes.
- Aportes rápidos que podem opcionalmente debitar de uma conta bancária.

### 10. 📊 Orçamentos por Categoria (Teto de Gastos)
- Definição de limites mensais de gastos para cada categoria.
- Alertas visuais e notificações automáticas antes de ultrapassar o orçamento estipulado.

### 11. 📅 Calendário Financeiro & Projeção Diária
- Visualização mensal estilo calendário com indicação dos dias de receitas e despesas.
- Projeção de fluxo de caixa futuro para planejamento antecipado.

### 12. 📈 Relatórios & Gráficos Interativos
- Gráficos em pizza e barras interativas via **Recharts** com filtros por mês, semana, ano ou datas customizadas.
- Exportação completa de dados para planilhas compatíveis com Excel (**CSV**).
- Sistema de **Backup Completo em JSON** para restaurar em qualquer máquina com um clique.

---

## 🎨 Interface & Experiência de Uso

- **Design Dark Glassmorphic Moderno**: Desenvolvido sob medida com paleta Slate/Emerald e transparências com blur.
- **Listas Suspensas Personalizadas (`CustomSelect`)**: Dropdowns fluidos que substituem os selects nativos feios do Windows, com busca rápida integrada, badges de cores de categorias e animações de escala.
- **Micro-interações e Transições Suaves**: Animações fluidas entre abas, modais com entrada dimensional e feedback imediato por toasts contextuais.

---

## 🏗️ Arquitetura do Software

```text
Meu Financeiro
├── electron/
│   ├── main.cjs            # Ciclo de vida do Electron, janelas e handlers de IPC
│   ├── preload.cjs         # ContextBridge com isolamento de contexto seguro
│   ├── database.cjs        # Inicialização do SQLite (WAL), índices e migrações
│   ├── services.cjs        # Regras de negócio, cálculos, OFX parser e cofre
│   └── crypto.cjs          # Criptografia com Salt e SHA-256 para PIN
├── src/
│   ├── components/         # Dropdowns customizados, Modais, Sidebar, Navbar, etc.
│   ├── context/            # FinancialContext central com estado global reativo
│   ├── types/              # Tipagens estritas TypeScript
│   ├── utils/              # Formatadores de moeda (BRL), datas e validadores
│   └── views/              # Telas do aplicativo (Dashboard, Lançamentos, etc.)
└── release/                # Executável empacotado para Windows
```

---

## 💻 Requisitos do Sistema

- **Sistema Operacional:** Windows 10 ou Windows 11 (64-bit).
- **Ambiente de Desenvolvimento:** Node.js 18+ e npm.

---

## 🚀 Como Executar o Projeto

### 1. Clonar ou Baixar o Repositório
```bash
cd Financeiro
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Executar em Modo de Desenvolvimento (Hot Reload)
```bash
npm run dev
```
> O comando iniciará o servidor Vite (`localhost:5173`) e abrirá a janela do Electron automaticamente.

### 4. Executar os Testes Automatizados
```bash
npm test
```

### 5. Compilar e Gerar o Executável para Windows
Para gerar o executável portátil descompactado:
```bash
npm run build
npm run pack
```
O executável final estará pronto em:
`release\win-unpacked\Meu Financeiro.exe`

Para gerar o instalador de distribuição NSIS:
```bash
npm run dist
```

---

## 📁 Onde os Dados Ficam Armazenados no Windows

No Windows, todos os arquivos gerados pelo aplicativo são salvos de forma isolada no seu perfil de usuário local:

- **Banco de Dados SQLite:**  
  `%APPDATA%\financeiro\meu_financeiro.sqlite`
- **Cofre de Extratos OFX e CSV:**  
  `%APPDATA%\financeiro\imported_statements\`
- **Logs de Erros Locais:**  
  `%APPDATA%\financeiro\app_errors.log`

---

## 📄 Licença

Distribuído sob a licença **MIT**. Uso livre para controle financeiro pessoal.
