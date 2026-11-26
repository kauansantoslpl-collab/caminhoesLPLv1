# Checklist de Carretas · LPL

Aplicação web para o motorista fazer o **checklist diário da carreta/caminhão antes de sair**, com painel de administração para acompanhar os registros por data, motorista e placa.

Uso interno, não comercial. Front-end estático (HTML, CSS e JavaScript puro, sem build), com **Firebase Authentication** e **Cloud Firestore** como back end e hospedagem na **Vercel**.

---

## Sumário
1. [Visão geral](#1-visão-geral)
2. [Funcionalidades](#2-funcionalidades)
3. [Regras de negócio](#3-regras-de-negócio)
4. [Documentação técnica](#4-documentação-técnica)
5. [Configuração e execução](#5-configuração-e-execução)
6. [Deploy na Vercel](#6-deploy-na-vercel)
7. [Segurança](#7-segurança)
8. [Limitações conhecidas](#8-limitações-conhecidas)
9. [Possíveis evoluções](#9-possíveis-evoluções)

---

## 1. Visão geral

| Item | Descrição |
|---|---|
| Objetivo | Digitalizar o "Checklist Manutenção Diária Carretas LPL" (antes em Excel) |
| Perfis | **Motorista** (preenche) e **Admin** (consulta e cadastra) |
| Front-end | HTML + CSS + JS (módulos ES), sem framework e sem build |
| Back end | Firebase Authentication (e-mail/senha) + Cloud Firestore |
| Hospedagem | Vercel (site estático) |
| Interface | Tema preto, fonte Manrope, foco em acessibilidade e uso no celular |

### Estrutura do projeto

```
.
├── index.html          # Estrutura da página (cabeçalho, áreas de login, motorista e admin)
├── style.css           # Estilos (tema preto, alto contraste, alvos de toque grandes)
├── app.js              # Toda a lógica: autenticação, telas e acesso ao Firestore
├── firebase-config.js  # Configuração do projeto Firebase
└── README.md
```

> O `index.html` contém só a estrutura. As telas do motorista e do admin são montadas pelo `app.js` conforme o perfil de quem entra.

---

## 2. Funcionalidades

### Motorista
- Login com usuário e senha.
- Preenchimento do checklist: data, caminhão, quilometragem, horímetro e os 25 itens de inspeção.
- Cada item recebe uma resposta: **OK**, **NG**, **N/A** ou **CRÍTICO**.
- Barra de progresso fixa ("12 de 25 respondidos").
- Observação obrigatória e campo de ação imediata quando o item é NG ou CRÍTICO.
- Observações gerais opcionais.
- Histórico com os 10 últimos checklists enviados por ele.

### Admin
- **Checklists:** filtro por data, motorista e placa, lista de recentes (últimos 100), detalhe item a item e impressão.
- **Motoristas:** cadastro (nome, usuário e senha), ativar e desativar.
- **Caminhões:** cadastro (placa, número da carreta/equipamento e descrição), ativar e desativar.

---

## 3. Regras de negócio

### Itens do checklist
São 25 itens, divididos nos grupos abaixo. A lista fica na constante `ITENS` no topo do `app.js`.

| Grupo | Itens |
|---|---|
| Segurança | 1 a 5 |
| Freios | 6 a 8 |
| Pneus/Rodas | 9 e 10 |
| Acoplamento | 11 e 12 |
| Suspensão | 13 |
| Estrutura | 14 |
| Baú/Carreta | 15 a 18 |
| Elétrica | 19 |
| Vazamentos | 20 |
| Sinalização | 21 |
| Equipamentos | 22 |
| Documentação | 23 |
| Limpeza/5S | 24 |
| Condições gerais | 25 |

Cada item tem uma periodicidade (a maioria "Diário"; o item 5, de manutenção preventiva, não tem periodicidade).

### Respostas possíveis
| Resposta | Significado |
|---|---|
| **OK** | Item conforme |
| **NG** | Não conforme: registrar a ocorrência |
| **N/A** | Não se aplica a esta carreta |
| **CRÍTICO** | Risco grave: **não liberar o veículo para operação** |

### Validações no envio
1. Todos os 25 itens precisam ser respondidos.
2. Itens **NG** e **CRÍTICO** exigem a descrição da ocorrência. A ação imediata é opcional.
3. É obrigatório escolher o caminhão e informar a quilometragem. O horímetro é opcional.

### Resultado do checklist
Calculado automaticamente no envio:
- Se houver **ao menos um CRÍTICO** → resultado **CRÍTICO**.
- Senão, se houver **ao menos um NG** → resultado **NG**.
- Senão → **OK**.

### Cadastros
- **Motoristas:** o login é o *usuário* informado em minúsculas (letras, números, ponto, hífen e sublinhado). O usuário é único. Motoristas inativos não conseguem entrar.
- **Caminhões:** a placa é gravada em maiúsculas e sem espaços e não pode se repetir. Caminhões inativos deixam de aparecer na lista do motorista, mas o histórico de checklists é mantido.
- Nada é excluído pelo app: usa-se **desativar**, para preservar o histórico.

### Registros
- Um checklist enviado **não pode ser editado** (somente o admin pode apagá-lo, pelo Firestore).
- O mesmo caminhão pode ter mais de um checklist no mesmo dia (não há bloqueio de duplicidade).
- Cada checklist guarda uma "foto" dos dados no momento do envio (nome do motorista, placa e texto dos itens), então mudanças posteriores nos cadastros não alteram os registros antigos.

---

## 4. Documentação técnica

### Arquitetura

```
Navegador (HTML/CSS/JS)
   │  Firebase JS SDK 10.12.2 (módulos ES via CDN gstatic)
   ├── Authentication (e-mail/senha)
   └── Cloud Firestore
```

Não há servidor próprio: o navegador conversa direto com o Firebase, e o controle de acesso é feito pelas **regras de segurança do Firestore**.

### Autenticação
O Firebase Authentication exige e-mail. Para o motorista usar só "usuário + senha", o app converte o usuário em e-mail interno:

```
usuário "joao.silva"  →  joao.silva@lpl-checklist.app
```

O domínio é fictício (não recebe e-mails) e fica na constante `DOMAIN` do `app.js`.

**Fluxo de login**
1. `signInWithEmailAndPassword` com o e-mail derivado.
2. Lê `users/{uid}` no Firestore.
3. Se o documento não existe ou `ativo === false`, faz logout e mostra "Acesso não liberado".
4. Se `role === "admin"`, abre o painel admin; senão, a tela do motorista.

**Cadastro de motorista pelo admin:** o app cria a conta usando uma **segunda instância** do Firebase (`initializeApp(config, nome)`), para que o admin **não seja deslogado** ao criar outro usuário. Depois grava o perfil em `users/{uid}`.

### Modelo de dados (Firestore)

**`users/{uid}`** (o ID do documento é o UID do Authentication)

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | string | Nome completo |
| `usuario` | string | Login (minúsculo) |
| `role` | string | `admin` ou `motorista` |
| `ativo` | boolean | Se pode acessar |
| `criadoEm` | timestamp | Data de criação |

**`caminhoes/{id}`**

| Campo | Tipo | Descrição |
|---|---|---|
| `placa` | string | Maiúscula, sem espaços |
| `numero` | string | Nº da carreta/equipamento |
| `descricao` | string | Texto livre |
| `ativo` | boolean | Se aparece para o motorista |

**`checklists/{id}`**

| Campo | Tipo | Descrição |
|---|---|---|
| `data` | string `AAAA-MM-DD` | Data do checklist |
| `caminhaoId` | string | ID em `caminhoes` |
| `placa`, `numero` | string | Cópia dos dados do caminhão |
| `motoristaId` | string | UID do motorista |
| `motoristaNome` | string | Cópia do nome |
| `km` | number | Quilometragem |
| `horimetro` | number ou null | Horímetro |
| `itens` | array | `{ n, grupo, item, status, obs, acao }` por item |
| `resultado` | string | `OK`, `NG` ou `CRITICO` |
| `obs` | string | Observações gerais |
| `criadoEm` | timestamp | Horário do servidor |

### Consultas
- Checklists por data: `where("data", "==", data)`.
- Recentes: `orderBy("criadoEm", "desc")` com `limit(100)`.
- Histórico do motorista: `where("motoristaId", "==", uid)`, ordenado no navegador.
- Os filtros por motorista e placa são aplicados **no navegador**, sobre os resultados já carregados. Por isso não são necessários índices compostos.

### Regras de segurança do Firestore

Publique no console do Firebase (Firestore > Regras):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signed() { return request.auth != null; }
    function isAdmin() {
      return signed() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /users/{uid} {
      allow read: if signed() && (request.auth.uid == uid || isAdmin());
      allow write: if isAdmin();
    }
    match /caminhoes/{id} {
      allow read: if signed();
      allow write: if isAdmin();
    }
    match /checklists/{id} {
      allow create: if signed() && request.resource.data.motoristaId == request.auth.uid;
      allow read: if signed() && (resource.data.motoristaId == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }
  }
}
```

| Coleção | Leitura | Escrita |
|---|---|---|
| `users` | O próprio usuário ou admin | Somente admin |
| `caminhoes` | Qualquer usuário logado | Somente admin |
| `checklists` | O próprio motorista ou admin | Motorista cria em nome dele; admin apaga; ninguém edita |

### Interface e acessibilidade
- Tema preto de alto contraste, fonte Manrope, texto base de 18px.
- Botões e campos com no mínimo 56px de altura (uso com luva ou em movimento).
- Respostas com **ícone + texto** (✓ OK, ! NG, – N/A, ⚠ CRÍTICO), sem depender só da cor.
- Foco de teclado visível, respeito à preferência de reduzir movimento, impressão com tema claro.

---

## 5. Configuração e execução

### Firebase
1. Criar o projeto e adicionar um **app Web**. Copiar o `firebaseConfig` para o `firebase-config.js`.
2. **Authentication > Sign-in method:** ativar **E-mail/senha**.
3. **Firestore Database:** criar o banco e publicar as regras da seção anterior.
4. **Authentication > Configurações > Domínios autorizados:** conferir o `localhost` e adicionar o domínio da Vercel.

### Primeiro administrador (uma vez só)
1. Authentication > Usuários > **Adicionar usuário**: e-mail `admin@lpl-checklist.app` e uma senha de pelo menos 6 caracteres. Copiar o **UID**.
2. Firestore > coleção `users` > documento com ID igual ao UID, com os campos:
   - `nome` (string), `usuario` = `admin` (string), `role` = `admin` (string), `ativo` = `true` (boolean).
3. Entrar no app com o usuário `admin`. Os demais cadastros são feitos pelo próprio app.

### Rodar localmente
Os módulos ES exigem um servidor (não abra o `index.html` com duplo clique):

```bash
npx serve
# ou
python3 -m http.server 8000
```

---

## 6. Deploy na Vercel
1. Suba a pasta para um repositório no GitHub.
2. Na Vercel, **Add New > Project** e importe o repositório.
3. *Framework Preset:* **Other**. Sem comando de build e sem pasta de saída especial (a raiz já é o site).
4. Após o deploy, adicione o domínio da Vercel nos **Domínios autorizados** do Firebase Authentication.

---

## 7. Segurança
- A `apiKey` do Firebase Web **não é segredo**: ela só identifica o projeto. Quem protege os dados são as **regras do Firestore**, então mantenha-as publicadas e revise-as.
- Senhas são tratadas pelo Firebase Authentication (o app nunca as armazena).
- Os dados de checklist são acessíveis apenas ao próprio motorista e ao admin.
- Recomenda-se definir uma senha forte para o `admin` e trocar as senhas iniciais dos motoristas.

---

## 8. Limitações conhecidas
- **Desativar motorista é verificado só pelo app** (no login). As regras não checam o campo `ativo`; para bloqueio total, o ideal é também desabilitar o usuário no Firebase Authentication.
- A **data do checklist é editável** pelo motorista (vem preenchida com o dia atual).
- A **redefinição de senha** é manual, pelo console do Firebase (Authentication).
- Não há exclusão de motoristas, caminhões ou checklists pelo app.
- O filtro por motorista e placa atua sobre os resultados carregados: a lista "recentes" traz no máximo 100 registros.
- Sem modo offline: é preciso conexão para enviar o checklist.
- Não há fotos, assinatura, exportação para Excel/PDF nem notificações.

---

## 9. Possíveis evoluções
- Fluxo da **manutenção**: dar baixa nos itens NG/CRÍTICO (responsável, data/hora da correção, status e visto do líder), como na planilha original.
- Bloqueio de duplicidade (um checklist por caminhão por dia) ou alerta de caminhões sem checklist no dia.
- Anexar fotos aos itens com problema.
- Exportação para Excel/PDF e filtro por período.
- Redefinição de senha pelo painel do admin (Cloud Functions).
- Modo offline (PWA) com envio quando voltar a conexão.
- Dashboard com indicadores (itens mais reprovados, caminhões com mais ocorrências).
