# Execução automática de casos de teste

Os casos podem ser executados em um navegador Chromium sem salvar credenciais de teste.

## Preparar a API

1. Configure `DATABASE_URL`, `JWT_SECRET` e `PORT` no ambiente da API.
2. Em produção, configure `QA_ALLOWED_HOSTS` com os nomes exatos dos ambientes autorizados, separados por vírgula. Exemplo: `QA_ALLOWED_HOSTS=qa.exemplo.com,staging.exemplo.com`.
3. Instale o Chromium no ambiente que executará a API: `npx playwright install chromium`.
4. Aplique as migrações do banco antes de iniciar a API.

Em desenvolvimento, `localhost`, `127.0.0.1` e `::1` são aceitos sem `QA_ALLOWED_HOSTS`. Em produção, os hosts precisam estar explicitamente autorizados e a URL deve usar HTTPS. Credenciais, parâmetros de consulta e fragmentos não são aceitos na URL base. Navegações do caso usam caminhos relativos à URL base.

Configure o caso com ações em ordem:

- **Abrir caminho:** navega para um caminho relativo, como `/login`.
- **Preencher campo:** usa um seletor CSS e um valor.
- **Clicar elemento:** clica no primeiro elemento correspondente ao seletor CSS.
- **Verificar elemento visível:** espera que um elemento identificado por seletor CSS apareça.
- **Verificar texto na página:** espera o texto indicado.

Para dados sigilosos, use um marcador no valor do campo, por exemplo `{{secret:senha}}`. Ao iniciar a execução, informe a URL do ambiente e o segredo. O valor informado é enviado somente à execução atual e não é salvo no caso nem no histórico. Cada execução registra URL, duração, resultado e resultado de cada etapa; segredos são omitidos.

Use a automação somente em ambientes próprios ou explicitamente autorizados. Os recursos solicitados pelo navegador também são limitados aos hosts de desenvolvimento permitidos ou aos hosts configurados em `QA_ALLOWED_HOSTS`.
