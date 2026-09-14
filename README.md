<div align="center">
  <img src="public/assets/pigo-full.png" alt="Pigo - Finanças Pessoais" width="340" />

  <p><strong>Gestão financeira inteligente, segura e com funcionamento Local-First.</strong></p>
  <p>Controle absoluto das suas contas, faturas de cartão, investimentos e projeção futura, 100% no seu controle.</p>

  <p>
    <a href="#-principais-funcionalidades">Funcionalidades</a> •
    <a href="#-sincronização-local-first--nuvem-supabase">Sincronização na Nuvem</a> •
    <a href="#-motor-de-inteligência-financeira">Inteligência Local</a> •
    <a href="#-compartilhar-e-instalar-em-outro-pc">Instalação em Outro PC</a> •
    <a href="#-desenvolvimento">Desenvolvimento</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Plataforma-Windows%2010%2B-blue.svg?style=flat-square&logo=windows" alt="Windows" />
    <img src="https://img.shields.io/badge/Arquitetura-Local--First%20%2B%20Cloud-success.svg?style=flat-square&logo=sqlite" alt="Local First" />
    <img src="https://img.shields.io/badge/Tema-Claro%20%26%20Escuro-amber.svg?style=flat-square" alt="Dark and Light Mode" />
    <img src="https://img.shields.io/badge/Electron-44.3-47848F.svg?style=flat-square&logo=electron" alt="Electron" />
    <img src="https://img.shields.io/badge/React-19.3-61DAFB.svg?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-7.0-3178C6.svg?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Banco%20de%20Dados-SQLite%20(WAL)-003B57.svg?style=flat-square&logo=sqlite" alt="SQLite" />
    <img src="https://img.shields.io/badge/Nuvem-Supabase%20Sync-3ECF8E.svg?style=flat-square&logo=supabase" alt="Supabase" />
  </p>
</div>

---

## 💡 Sobre o Pigo

O **Pigo** é uma solução desktop moderna de **gestão financeira pessoal** criada com os mais altos padrões de usabilidade, velocidade e privacidade.

Diferente de sistemas web comuns que travam sem internet ou vendem seus dados, o Pigo adota o padrão **Local-First**:
1. **Velocidade Instantânea**: Todas as operações (cadastros, conciliações, relatórios e buscas) rodam localmente com banco de dados de alto desempenho **SQLite (WAL)**. O app abre em milissegundos e funciona perfeitamente sem internet.
2. **Sincronização em Nuvem (Supabase)**: Quando você se conecta, as informações sincronizam em segundo plano com seu banco na nuvem. Você pode usar o app em múltiplos computadores mantendo tudo idêntico e sincronizado.
3. **Inteligência 100% Local**: Análise preditiva, detecção de gastos duplicados, sugestão de categorias e score de saúde financeira são processados na sua máquina, garantindo sua privacidade.

---

## 🌟 Principais Funcionalidades

### 🌓 Modo Claro & Modo Escuro (Light & Dark)
- Alternância instantânea com um clique no cabeçalho (ícone de Sol / Lua).
- Paleta **Dark Glassmorphic** sob medida para redução da fadiga visual e visual moderno.
- Paleta **Light Clean** com contrastes nítidos e superfícies claras para ambientes bem iluminados.

### 🔁 Lançamentos Recorrentes com Inteligência de Histórico
- **Detecção Automática de Recorrências**: O Pigo analisa seu histórico de extratos e identifica despesas que se repetem com frequência e valores semelhantes (ex: Netflix, Spotify, Condomínio, Aluguel, Provedor de Internet).
- **Puxar do Histórico em Tempo Real**: Ao digitar o nome de uma despesa ou receita, o Pigo busca instantaneamente se você já fez lançamentos semelhantes no passado.
- **Preenchimento em 1 Clique**: Sugere e preenche automaticamente o valor médio, categoria, forma de pagamento (conta ou cartão) e o dia do vencimento com base no histórico.
- **Automação de Vencimentos**: Gera as transações automaticamente na data certa ou sob seu comando manual.

### 🏦 Gestão de Contas Bancárias e Carteiras
- Controle completo de contas correntes, poupança, carteiras digitais, investimentos e dinheiro vivo.
- Transferências financeiras entre contas com atualização simultânea e validação de saldo.
- Extrato individual e unificado com filtros por período e categoria.

### 💳 Cartões de Crédito & Faturas
- Múltiplos cartões com limite total, limite utilizado e limite disponível em tempo real.
- Suporte a **Dia de Fechamento** e **Dia de Vencimento**.
- Compras parceladas (2x até 72x) com distribuição e projeção mês a mês nas faturas futuras.
- Pagamento de fatura integrado que baixa o valor diretamente da conta bancária de sua escolha.

### 🧠 Conciliação Bancária & Importador OFX / CSV
- Leitor universal de arquivos **OFX / QFX** e planilhas **CSV** de bancos brasileiros (Nubank, Inter, Itaú, Bradesco, Santander, Caixa, Banco do Brasil, C6, etc.).
- **Detecção Inteligente de Duplicatas** via identificador bancário `FITID` e comparação de data/valor.
- **Agrupamento Automático**: Reúne múltiplos lançamentos do mesmo estabelecimento para conferência rápida.
- **Regras de Categorização com Aprendizado**: Ao categorizar um estabelecimento uma vez, as próximas importações aplicam a regra automaticamente.
- **Cofre de Extratos**: Cópia original de todos os arquivos importados é preservada com segurança na pasta do aplicativo.

### 🎯 Metas Financeiras (Cofrinhos Virtuais)
- Defina objetivos com prazo e valor pretendido (Reserva de Emergência, Viagem, Troca de Carro, etc.).
- Aportes rápidos com débito opcional da conta bancária.
- Barra de progresso visual de percentual atingido e dias restantes.

### 📊 Orçamentos por Categoria (Teto de Gastos)
- Estipule metas mensais de despesa por categoria (Alimentação, Transporte, Lazer, etc.).
- Alertas visuais e notificações antes de ultrapassar o limite estabelecido.

### 📅 Calendário Financeiro & Projeção Diária
- Visão mensal em formato de calendário com todos os vencimentos, recebimentos e faturas.
- Visualização clara dos dias com maior concentração de contas a pagar.

### 📈 Relatórios & Gráficos Interativos
- Gráficos interativos em pizza e barras (Recharts) por categoria, evolução mensal e fluxo de caixa.
- Exportação de dados para planilhas **CSV / Excel**.
- Sistema de **Backup e Restauração em JSON** para portabilidade total.

---

## 🧠 Motor de Inteligência Financeira

O Pigo possui um motor de inteligência financeira integrado que opera **100% offline**:

1. **Score de Saúde Financeira (0 a 100)**: Analisa taxa de poupança, comprometimento de renda fixa, uso do limite de crédito e consistência de gastos.
2. **Previsão de Saldo (Cashflow Forecast)**: Projeta seu saldo para os próximos 30, 60 e 90 dias com base nas receitas e despesas recorrentes.
3. **Detecção de Anomalias**: Alerta sobre despesas com valor muito acima da média habitual em cada categoria.
4. **Insights Contextuais**: Recomendações personalizadas sobre onde economizar e quando antecipar pagamentos.

---

## ☁️ Sincronização Local-First + Nuvem (Supabase)

O Pigo combina o melhor dos dois mundos: **independência local** e **sincronização na nuvem**.

```
  [ Computador A ]                        [ Computador B ]
  SQLite Local (WAL)                     SQLite Local (WAL)
          │                                      ▲
          ▼                                      │
     (Push Sync)                            (Pull Sync)
          └───────────► [ Supabase Cloud ] ──────┘
                        PostgreSQL + Auth
```

### Como Funciona:
- Ao abrir o app pela primeira vez, o assistente de inicialização pergunta:
  - **"Já tenho uma conta na Nuvem"**: Você informa seu e-mail e senha do Supabase e o Pigo restaura automaticamente todas as suas contas, faturas, transações, categorias e regras na nova máquina.
  - **"Começar do Zero"**: Inicia uma base limpa para você configurar como desejar.
- **Trabalho sem conexão**: Se a internet cair, você continua usando normalmente. Quando a conexão voltar, o motor sincroniza as alterações pendentes.
- **Proteção de Integridade**: A sincronização gerencia chaves estrangeiras (`PRAGMA foreign_keys`) de forma segura, garantindo que nenhum dado seja corrompido durante restaurações em massa.

---

## 📦 Compartilhar e Instalar em Outro PC

Para instalar o Pigo no computador de outra pessoa ou em uma nova máquina sua:

### 1. Arquivo que você deve enviar
Envie o instalador gerado:
```
release/Meu Financeiro Setup 1.0.0.exe
```
*(Ou o executável descompactado em `release/win-unpacked/`)*

### 2. Passo a Passo no Novo Computador
1. Execute o instalador `Meu Financeiro Setup 1.0.0.exe`.
2. Na tela de boas-vindas do **Pigo**, escolha:
   - **"Já tenho uma conta na Nuvem"**
3. Digite o **E-mail** e a **Senha** cadastrados na sua conta.
4. Clique em **"Entrar e Sincronizar Tudo"**.
5. O Pigo puxará instantaneamente todas as contas bancárias, cartões, extratos e transações existentes na nuvem.
6. A partir desse momento, ambos os computadores sincronizarão automaticamente em tempo real!

---

## 🛠️ Arquitetura do Código

```text
Pigo (Financeiro)
├── electron/
│   ├── main.cjs                # Ciclo de vida do Electron e handlers de IPC
│   ├── preload.cjs             # ContextBridge com isolamento seguro
│   ├── database.cjs            # SQLite com WAL, schema, índices e migrações
│   ├── services.cjs            # Lógica central de negócio e conciliação bancária
│   ├── syncEngine.cjs          # Motor de sincronização Local-First com Supabase
│   ├── intelligenceEngine.cjs  # Motor de inteligência, previsões e anomalias
│   ├── ofxParser.cjs           # Parser de extratos bancários OFX/QFX
│   └── crypto.cjs              # Criptografia SHA-256 com Salt para PIN
├── src/
│   ├── assets/                 # Logomarcas do Pigo (ícone e versão completa)
│   ├── components/             # Dropdowns CustomSelect, Modais, Sidebar, Navbar
│   ├── context/                # FinancialContext com gerenciamento reativo e tema
│   ├── types/                  # Tipagem estrita em TypeScript
│   ├── utils/                  # Formatadores BRL, datas e cálculos
│   └── views/                  # Telas do app (Dashboard, Lançamentos, Recorrentes, etc.)
└── release/                    # Instaladores compilados para Windows
```

---

## 🚀 Desenvolvimento

### Requisitos:
- **Node.js**: Versão 18 ou superior.
- **NPM**: Versão 9 ou superior.
- **Sistema Operacional**: Windows 10 ou 11 (64-bit).

### Comandos:

#### 1. Instalar dependências:
```bash
npm install
```

#### 2. Executar em modo de desenvolvimento (com Hot Reload):
```bash
npm run dev
```

#### 3. Executar os testes automatizados (Vitest):
```bash
npm test
```

#### 4. Gerar build de produção do frontend:
```bash
npm run build
```

#### 5. Empacotar o instalador executável para Windows:
```bash
npm run dist
```
O instalador final estará localizado na pasta:
`release/Meu Financeiro Setup 1.0.0.exe`

---

## 🔒 Segurança e Privacidade

- **Criptografia Local de PIN**: O PIN de acesso nunca é gravado em texto puro. Ele utiliza algoritmo **SHA-256** com *salt* criptográfico individual.
- **Sem Rastreamento**: O Pigo não contém anúncios, telemetria invasiva ou bibliotecas de terceiros para monitoramento de comportamento.
- **Controle dos Seus Dados**: Todos os seus dados financeiros pertencem exclusivamente a você.

---

<div align="center">
  <p><strong>Pigo — Finanças Pessoais</strong></p>
  <p>Feito para quem valoriza privacidade, elegância e autonomia financeira.</p>
</div>
