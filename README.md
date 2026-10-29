# Remind-QA

<p align="center">
  <img src="https://img.shields.io/badge/Remind-QA-8B5CF6?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Remind-QA" />
  <img src="https://img.shields.io/badge/Quality_Assurance-7C3AED?style=for-the-badge" alt="Quality Assurance" />

</p>

<p align="center">
  <strong>Qualidade de software começa com testes bem planejados.</strong>
  <br />
  Uma plataforma para organizar requisitos, gerenciar casos de teste e acompanhar ciclos de QA.
</p>

<p align="center">
  <a href="#sobre-o-projeto">Sobre</a> •
  <a href="#funcionalidades">Funcionalidades</a> •
  <a href="#tecnologias">Tecnologias</a> •
  <a href="#instalação">Instalação</a> •
  <a href="#roadmap">Roadmap</a>
</p>

---

## Sobre o projeto

O **Remind-QA** é uma aplicação web em desenvolvimento, idealizada para centralizar atividades de Quality Assurance (QA) em um ambiente organizado e intuitivo.

A plataforma busca facilitar o planejamento, a execução e o acompanhamento de testes de software, conectando requisitos, casos de teste, ciclos de execução e resultados.

O projeto também explora conceitos importantes de desenvolvimento de software, análise de requisitos, rastreabilidade e melhoria contínua da qualidade.

### Problema que o projeto busca resolver

Durante o desenvolvimento de um sistema, informações de requisitos, cenários de teste, defeitos e resultados podem ficar espalhadas em diferentes ferramentas.

O Remind-QA propõe reunir essas informações para facilitar o acompanhamento das atividades, identificar lacunas de cobertura e apoiar decisões sobre a qualidade de uma entrega.

## Funcionalidades

> A aplicação está em desenvolvimento e pode sofrer alterações. Os itens abaixo representam o escopo planejado e devem ser atualizados conforme eu for estudando.

### Gestão de projetos
- Organização dos projetos de software.
- Visualização dos detalhes de cada projeto.
- Centralização das informações relacionadas à qualidade.

### Gestão de requisitos
- Cadastro e organização de requisitos.
- Identificação dos requisitos que precisam de validação.
- Associação entre requisitos e casos de teste.

### Casos de teste
- Cadastro de casos de teste com título e objetivo.
- Definição de pré-condições e dados de teste.
- Descrição de passos e resultados esperados.
- Classificação por tipo, prioridade e status.
- Associação a requisitos relacionados.

### Ciclos de teste
- Planejamento de ciclos por versão ou entrega.
- Associação de casos de teste a cada ciclo.
- Organização por ambiente e período de execução.
- Acompanhamento do progresso dos testes.

### Execução e resultados
- Registro dos resultados das execuções.
- Identificação de testes aprovados, reprovados ou bloqueados.
- Histórico das execuções.
- Apoio à análise de falhas e regressões.

### Indicadores de qualidade
- Acompanhamento do progresso dos ciclos.
- Visão geral dos resultados de execução.
- Identificação de testes pendentes.
- Evolução futura de indicadores de cobertura e qualidade.

## Tecnologias

Tecnologias identificadas na estrutura do projeto:

<p>
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/npm-CB3837?style=flat-square&logo=npm&logoColor=white" alt="npm" />
</p>

- **React:** construção de interfaces baseadas em componentes.
- **TypeScript:** tipagem estática e maior previsibilidade no código.
- **Vite:** ambiente de desenvolvimento e build da aplicação web.
- **Tailwind CSS:** estilização e consistência visual.
- **Node.js e npm:** execução de ferramentas JavaScript e gerenciamento de dependências.

## Arquitetura e estrutura do projeto

O repositório utiliza uma organização com diretório de aplicações.

```text
Remind-QA/
├── apps/
│   └── web/
│       └── src/
│           └── pages/
│               ├── ProjectDetail.tsx
│               ├── Projects.tsx
│               └── QAWorkspace.tsx
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

## Instalação

### Pré-requisitos

- Git instalado.
- Node.js em uma versão compatível com o projeto.
- npm instalado.

### 1. Clone o repositório

```bash
git clone https://github.com/raissacvf/Remind-QA.git
```

### 2. Acesse a pasta

```bash
cd Remind-QA
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Inicie a aplicação

Consulte os scripts definidos no `package.json` da raiz. Caso o script `dev` esteja configurado para iniciar a aplicação web, execute:

```bash
npm run dev
```

Se a aplicação estiver configurada para executar dentro de `apps/web`, entre nesse diretório e consulte o respectivo `package.json` para identificar os comandos corretos.

> Os comandos de execução poderão ser ajustados à medida que a configuração do projeto for consolidada.

## Como contribuir

O projeto está em desenvolvimento e pode evoluir por etapas.

1. Faça um fork do repositório.
2. Crie uma branch para sua alteração.
3. Implemente e valide a funcionalidade.
4. Faça um commit com uma mensagem descritiva.
5. Abra um pull request com a explicação das mudanças.

Sugestão de nomenclatura de branches:

```text
feat/cadastro-casos-teste
fix/validacao-formulario
docs/atualizacao-readme
```

## Roadmap

- [ ] Consolidar a estrutura inicial da aplicação.
- [ ] Implementar o gerenciamento de projetos.
- [ ] Implementar o gerenciamento de requisitos.
- [ ] Desenvolver o cadastro de casos de teste.
- [ ] Implementar ciclos de teste e execuções.
- [ ] Registrar e acompanhar defeitos.
- [ ] Criar matriz de rastreabilidade.
- [ ] Desenvolver dashboard de qualidade.
- [ ] Implementar relatórios e exportações.
- [ ] Ampliar a cobertura com testes automatizados.
- [ ] Avaliar integrações com pipelines de CI/CD.

## Conceitos de QA aplicados

O Remind-QA pretende incorporar boas práticas de qualidade de software, como:

- Testes funcionais, regressivos, smoke e de integração.
- Definição de pré-condições e resultados esperados.
- Separação entre status do caso de teste e resultado da execução.
- Rastreabilidade entre requisitos, testes e defeitos.
- Registro histórico para facilitar auditorias e análise de regressões.

## Objetivo de aprendizado

Este projeto faz parte da evolução prática em desenvolvimento web e qualidade de software, aplicando conceitos de:

- Desenvolvimento de aplicações web.
- Análise e organização de requisitos.
- Planejamento e gerenciamento de testes.
- Modelagem de processos.
- Boas práticas de versionamento com Git e GitHub.

## Autoria

**Raissa Castro**

Desenvolvimento de Software • Desenvolvimento Web • Análise de Requisitos • Quality Assurance

- GitHub: [@raissacvf](https://github.com/raissacvf)
- Repositório: [Remind-QA](https://github.com/raissacvf/Remind-QA)

---

<p align="center">
  <strong>Remind-QA</strong>
  <br />
  Planejar melhor. Testar com propósito. Evoluir com qualidade.
</p>
