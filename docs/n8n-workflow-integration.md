# Integração n8n → API de Dados

Após processar chat ou upload, adicione um node **HTTP Request** no final do workflow n8n.

## Configuração do node

| Campo | Valor |
|-------|-------|
| Method | `POST` |
| URL | `http://SEU_SERVIDOR:8787/internal/events/chat-completed` |
| Header | `X-API-Key: <N8N_INTERNAL_API_KEY>` |
| Body Content Type | JSON |

---

## Payload mínimo (recomendado)

A API **preenche o resto automaticamente**:

- `audit` → inferido (`file_upload` se houver anexo, senão `chat_query`)
- `sources` → extraídos dos links markdown na resposta (`[nome](url)`)
- `roles` / `groups` inválidos → ignorados (default: `colaborador`)
- Valores com prefixo `=` do n8n → limpos automaticamente
- `attachment` pode ser **string** (só o nome do arquivo)

```json
{
  "requestId": "{{ $json.requestId || $execution.id }}",
  "conversationId": "{{ $json.conversationId }}",
  "user": {
    "id": "{{ $json.userId }}",
    "userName": "{{ $json.userName }}",
    "userEmail": "{{ $json.userEmail }}"
  },
  "userMessage": {
    "content": "{{ $json.query }}",
    "attachment": "{{ $json.fileName }}"
  },
  "assistantMessage": {
    "content": "{{ $json.answer }}"
  }
}
```

### Exemplo real (como o seu)

```json
{
  "requestId": "c2462d577db64f46ee2536b63ea5e8424676d8198893be017fe4cdf0d5fa566a",
  "conversationId": "5f1350f328257eb59f715fe04f557da2266c407c26fe767d98ac0c841280d30f",
  "sessionId": "c2462d577db64f46ee2536b63ea5e8424676d8198893be017fe4cdf0d5fa566a",
  "user": {
    "id": "usuario.exemplo",
    "userName": "Nome Completo",
    "userEmail": "usuario@empresa.com"
  },
  "userMessage": {
    "content": "Jogue este arquivo na pasta Procedimentos de TI",
    "attachment": "Requisitos-Agente-RH.txt"
  },
  "assistantMessage": {
    "content": "O arquivo \"Requisitos-Agente-RH.txt\" foi importado com sucesso..."
  }
}
```

**Não precisa enviar:** `audit`, `sources`, `roles`, `groups`, `metadata`, `processingMs`.

---

## Campos obrigatórios

| Campo | Alternativa |
|-------|-------------|
| `conversationId` | `sessionId` |
| `user.id` | `userId` no root |
| `userMessage.content` | `query` no root |
| `assistantMessage.content` | `answer` no root |

---

## Payload ainda mais curto (flat)

Se preferir tudo no root:

```json
{
  "conversationId": "{{ $json.conversationId }}",
  "userId": "{{ $json.userId }}",
  "userName": "{{ $json.userName }}",
  "query": "{{ $json.query }}",
  "answer": "{{ $json.answer }}"
}
```

---

## Dicas n8n

1. **Evite `roles` e `groups`** se não tiver arrays válidos — a API usa `colaborador` por padrão.
2. **`attachment` como string** — passe só o nome do arquivo: `"Requisitos-Agente-RH.txt"`.
3. **Links na resposta** — se a resposta tiver `[arquivo](https://...)`, a API registra como documento acessado automaticamente.
4. **Expressões que falham** — valores como `"=2026-08-14..."` ou `"="` são ignorados/limpos.
5. **`requestId` único por mensagem** — use `$json.requestId` ou `$execution.id`. Não use `sessionId`: ele se repete na sessão e só a primeira mensagem seria gravada.

---

## Payload completo (opcional)

Use só se tiver todos os dados disponíveis:

```json
{
  "requestId": "{{ $json.requestId || $execution.id }}",
  "conversationId": "{{ $json.conversationId }}",
  "sessionId": "{{ $json.sessionId }}",
  "user": {
    "id": "{{ $json.userId }}",
    "userName": "{{ $json.userName }}",
    "userEmail": "{{ $json.userEmail }}",
    "roles": ["colaborador"],
    "groups": []
  },
  "userMessage": {
    "content": "{{ $json.query }}",
    "attachment": { "name": "{{ $json.fileName }}" }
  },
  "assistantMessage": {
    "content": "{{ $json.answer }}",
    "sources": []
  },
  "audit": {
    "action": "file_upload",
    "result": "success"
  }
}
```

---

## Retry e idempotência

- Configure **3 tentativas** com intervalo de 2s no HTTP Request.
- `requestId` duplicado → API retorna `duplicate: true` sem gravar de novo.

## Variáveis de ambiente n8n

```env
DATA_API_URL=http://localhost:8787
N8N_INTERNAL_API_KEY=sua-chave-do-server-env
```

Reinicie a API de dados após deploy para aplicar a normalização do payload.
