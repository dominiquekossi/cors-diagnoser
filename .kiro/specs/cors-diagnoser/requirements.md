# Requirements Document

## Introduction

O cors-diagnoser é um pacote NPM que auxilia desenvolvedores a diagnosticar automaticamente problemas de CORS (Cross-Origin Resource Sharing) tanto no backend quanto no frontend. O pacote intercepta erros, analisa headers HTTP, valida configurações de preflight e gera logs explicativos com recomendações de solução, tornando o debugging de CORS mais acessível e eficiente.

## Glossary

- **CORS Diagnoser**: O sistema de diagnóstico de CORS que inclui componentes para backend e frontend
- **Express Middleware**: Componente do CORS Diagnoser que intercepta requisições HTTP no servidor Express
- **Browser Listener**: Componente do CORS Diagnoser que captura erros de CORS no navegador
- **Analyzer**: Componente do CORS Diagnoser que analisa headers e identifica problemas de configuração CORS
- **Preflight Request**: Requisição HTTP OPTIONS enviada pelo navegador antes da requisição real para verificar permissões CORS
- **Origin Header**: Header HTTP que indica a origem da requisição
- **CORS Headers**: Headers HTTP relacionados a CORS (Access-Control-Allow-Origin, Access-Control-Allow-Headers, etc.)
- **Diagnosis Object**: Objeto contendo issue, description e recommendation sobre um problema CORS detectado

## Requirements

### Requirement 1

**User Story:** Como desenvolvedor backend, quero um middleware Express que intercepte requisições e detecte problemas de CORS, para que eu possa identificar rapidamente configurações incorretas no meu servidor.

#### Acceptance Criteria

1. WHEN a requisição HTTP chega ao servidor, THE Express Middleware SHALL interceptar a requisição antes de chegar aos handlers de rota
2. WHEN a requisição é do tipo OPTIONS, THE Express Middleware SHALL verificar a presença dos CORS Headers obrigatórios na resposta
3. WHEN o Origin Header está presente na requisição, THE Express Middleware SHALL validar se o Access-Control-Allow-Origin na resposta é compatível com a origem solicitante
4. WHEN o Access-Control-Allow-Origin está ausente na resposta, THE Express Middleware SHALL gerar um log indicando o problema e a rota afetada
5. WHERE verbose mode está habilitado, THE Express Middleware SHALL exibir logs detalhados de todas as verificações CORS realizadas

### Requirement 2

**User Story:** Como desenvolvedor backend, quero receber mensagens de log claras e acionáveis sobre problemas de CORS, para que eu possa corrigir as configurações sem precisar pesquisar extensivamente.

#### Acceptance Criteria

1. WHEN um problema de CORS é detectado, THE Analyzer SHALL gerar um Diagnosis Object contendo issue, description e recommendation
2. THE Express Middleware SHALL formatar logs com prefixo identificável "[CORS-DIAGNOSER]" seguido da descrição do problema
3. WHEN Access-Control-Allow-Headers está ausente em uma Preflight Request, THE Analyzer SHALL incluir recomendação específica para adicionar o header necessário
4. WHEN múltiplos problemas são detectados na mesma requisição, THE Analyzer SHALL retornar uma lista com todos os Diagnosis Objects identificados
5. THE Analyzer SHALL fornecer recomendações práticas que referenciem configurações específicas de middleware CORS

### Requirement 3

**User Story:** Como desenvolvedor frontend, quero capturar erros de CORS que ocorrem no navegador e receber explicações sobre as causas prováveis, para que eu possa comunicar o problema ao time de backend ou ajustar minhas requisições.

#### Acceptance Criteria

1. WHEN o Browser Listener é inicializado, THE Browser Listener SHALL registrar um event listener para eventos de erro global
2. WHEN um erro contendo a palavra "CORS" é capturado, THE Browser Listener SHALL identificar o erro como relacionado a CORS
3. WHEN um erro de CORS é identificado, THE Browser Listener SHALL exibir no console explicações sobre possíveis causas (servidor não enviou Access-Control-Allow-Origin, conflito com credentials, preflight bloqueado)
4. WHERE verbose mode está habilitado, THE Browser Listener SHALL exibir informações adicionais sobre o contexto do erro
5. THE Browser Listener SHALL expor uma função listenCorsErrors que aceita opções de configuração

### Requirement 4

**User Story:** Como desenvolvedor, quero uma API simples e consistente para integrar o cors-diagnoser tanto no backend quanto no frontend, para que eu possa adicionar o diagnóstico ao meu projeto com mínimo esforço.

#### Acceptance Criteria

1. THE CORS Diagnoser SHALL exportar a função corsDiagnoser que retorna um middleware Express compatível
2. THE CORS Diagnoser SHALL exportar a função analyzeHeaders que aceita objetos de requisição e resposta
3. THE CORS Diagnoser SHALL exportar a função listenCorsErrors para uso no navegador
4. WHEN corsDiagnoser é invocado sem parâmetros, THE Express Middleware SHALL funcionar com configurações padrão
5. WHEN listenCorsErrors é invocado sem parâmetros, THE Browser Listener SHALL funcionar com configurações padrão

### Requirement 5

**User Story:** Como desenvolvedor, quero instalar o cors-diagnoser via NPM e ter acesso a documentação clara, para que eu possa começar a usar o pacote rapidamente em meus projetos.

#### Acceptance Criteria

1. THE CORS Diagnoser SHALL ser publicável como pacote NPM com nome "cors-diagnoser"
2. THE CORS Diagnoser SHALL incluir um arquivo package.json com metadados corretos (main, types, keywords)
3. THE CORS Diagnoser SHALL incluir um README.md com exemplos de uso para backend e frontend
4. THE CORS Diagnoser SHALL ser compilado para JavaScript com definições TypeScript (.d.ts) incluídas
5. THE CORS Diagnoser SHALL incluir scripts NPM para build e desenvolvimento

### Requirement 6

**User Story:** Como desenvolvedor, quero que o cors-diagnoser analise headers HTTP de forma precisa, para que os diagnósticos gerados sejam confiáveis e úteis.

#### Acceptance Criteria

1. WHEN uma requisição contém Origin Header, THE Analyzer SHALL extrair e normalizar o valor da origem
2. WHEN uma resposta contém Access-Control-Allow-Origin, THE Analyzer SHALL comparar com a origem da requisição
3. WHEN Access-Control-Allow-Origin é "\*" e credentials mode está habilitado, THE Analyzer SHALL identificar o conflito como um problema
4. WHEN uma Preflight Request não recebe os headers apropriados, THE Analyzer SHALL identificar quais headers estão faltando
5. THE Analyzer SHALL utilizar funções auxiliares do módulo utils para normalização e detecção de tipos de erro

### Requirement 7

**User Story:** Como desenvolvedor, quero receber exemplos de código prontos para copiar e colar nas mensagens de diagnóstico, para que eu possa corrigir problemas de CORS imediatamente sem precisar pesquisar a sintaxe correta.

#### Acceptance Criteria

1. WHEN um problema de CORS é detectado, THE Analyzer SHALL incluir um exemplo de código corretivo no Diagnosis Object
2. WHEN Access-Control-Allow-Origin está ausente, THE Analyzer SHALL fornecer exemplo de configuração de middleware CORS para Express
3. WHEN Access-Control-Allow-Headers está incorreto, THE Analyzer SHALL fornecer exemplo mostrando como adicionar headers específicos
4. WHEN credentials mode causa conflito, THE Analyzer SHALL fornecer exemplos tanto para backend quanto frontend mostrando configuração correta
5. THE Analyzer SHALL formatar exemplos de código com syntax highlighting quando exibidos no console

### Requirement 8

**User Story:** Como desenvolvedor, quero que o cors-diagnoser detecte padrões comuns de erro de CORS, para que eu receba diagnósticos mais precisos baseados em situações reais que outros desenvolvedores enfrentam.

#### Acceptance Criteria

1. WHEN Access-Control-Allow-Origin é "\*" e a requisição inclui credentials, THE Analyzer SHALL identificar este padrão como "wildcard-credentials-conflict"
2. WHEN múltiplas origens precisam ser permitidas mas apenas uma string é configurada, THE Analyzer SHALL identificar o padrão "multiple-origins-misconfiguration"
3. WHEN Preflight Request falha mas requisição simples funcionaria, THE Analyzer SHALL identificar o padrão "preflight-only-failure"
4. WHEN headers customizados são enviados mas não estão em Access-Control-Allow-Headers, THE Analyzer SHALL identificar o padrão "custom-headers-not-allowed"
5. THE Analyzer SHALL manter um catálogo interno de pelo menos 10 padrões comuns de erro CORS com soluções específicas

### Requirement 9

**User Story:** Como desenvolvedor, quero visualizar um histórico dos erros de CORS detectados durante minha sessão de desenvolvimento, para que eu possa identificar padrões e problemas recorrentes.

#### Acceptance Criteria

1. WHEN o Express Middleware detecta um erro de CORS, THE Express Middleware SHALL armazenar o erro em um histórico em memória
2. THE CORS Diagnoser SHALL expor uma função getErrorHistory que retorna lista de erros detectados
3. WHEN getErrorHistory é invocado, THE CORS Diagnoser SHALL retornar erros ordenados por timestamp mais recente primeiro
4. WHEN o mesmo erro ocorre múltiplas vezes, THE CORS Diagnoser SHALL agrupar ocorrências e incluir contador de repetições
5. THE CORS Diagnoser SHALL limitar o histórico a 100 entradas mais recentes para evitar consumo excessivo de memória

### Requirement 10

**User Story:** Como desenvolvedor, quero comparar a configuração CORS atual do meu servidor com a configuração recomendada, para que eu possa entender exatamente o que precisa ser alterado.

#### Acceptance Criteria

1. THE Analyzer SHALL expor uma função compareConfiguration que aceita configuração atual e configuração esperada
2. WHEN compareConfiguration é invocado, THE Analyzer SHALL retornar um diff mostrando diferenças entre configurações
3. WHEN uma propriedade está faltando na configuração atual, THE Analyzer SHALL marcar como "missing" no diff
4. WHEN uma propriedade tem valor incorreto, THE Analyzer SHALL mostrar valor atual e valor recomendado lado a lado
5. THE Analyzer SHALL destacar visualmente no console as diferenças críticas que bloqueiam requisições CORS

### Requirement 11

**User Story:** Como desenvolvedor, quero testar se uma origem específica será aceita pela minha configuração CORS, para que eu possa validar mudanças antes de fazer deploy.

#### Acceptance Criteria

1. THE CORS Diagnoser SHALL expor uma função testOrigin que aceita uma URL de origem e configuração CORS
2. WHEN testOrigin é invocado, THE CORS Diagnoser SHALL simular uma requisição da origem especificada
3. WHEN a origem seria bloqueada, THE testOrigin SHALL retornar resultado indicando falha com motivo específico
4. WHEN a origem seria aceita, THE testOrigin SHALL retornar resultado indicando sucesso com headers que seriam enviados
5. THE testOrigin SHALL validar tanto requisições simples quanto Preflight Requests

### Requirement 12

**User Story:** Como desenvolvedor, quero receber sugestões de segurança relacionadas à minha configuração CORS, para que eu não exponha meu servidor a vulnerabilidades enquanto resolvo problemas de CORS.

#### Acceptance Criteria

1. WHEN Access-Control-Allow-Origin é configurado como "\*" em produção, THE Analyzer SHALL emitir um aviso de segurança
2. WHEN Access-Control-Allow-Credentials é true com origem wildcard, THE Analyzer SHALL emitir um alerta crítico de segurança
3. WHEN headers sensíveis estão expostos via Access-Control-Expose-Headers, THE Analyzer SHALL sugerir revisão da lista de headers
4. WHEN Access-Control-Allow-Methods inclui métodos desnecessários, THE Analyzer SHALL recomendar princípio de menor privilégio
5. THE Analyzer SHALL categorizar avisos de segurança em níveis: info, warning, critical

### Requirement 13

**User Story:** Como desenvolvedor, quero que o cors-diagnoser tenha uma estrutura de código modular e bem organizada, para que eu possa entender, manter e contribuir com o projeto facilmente.

#### Acceptance Criteria

1. THE CORS Diagnoser SHALL organizar código backend em diretório src/backend
2. THE CORS Diagnoser SHALL organizar código frontend em diretório src/frontend
3. THE CORS Diagnoser SHALL organizar utilitários compartilhados em diretório src/core
4. THE CORS Diagnoser SHALL exportar todas as APIs públicas através de src/index.ts
5. THE CORS Diagnoser SHALL utilizar TypeScript com configuração strict habilitada
