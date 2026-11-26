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
| Interface | Tema escuro, fonte Manrope, identidade LPL, responsivo para celular |

### Estrutura do projeto

```
.
├── index.html            # Estrutura: cabeçalho, login, áreas do motorista/admin e janela de exclusão
├── style.css             # Estilos (tema escuro, responsivo, impressão)
├── app.js                # Toda a lógica: autenticação, telas e acesso ao Firestore
├── firebase-config.js    # Configuração do projeto Firebase
├── firestore.rules       # Regras de segurança (publicadas manualmente no console)
├── LPL_2022_branco.png   # Logo da LPL (cabeçalho e login)
└── README.md
```

> O `index.html` contém só a estrutura. As telas do motorista e do admin são montadas pelo `app.js` conforme o perfil de quem entra. O logo precisa ficar na mesma pasta do `index.html`.

---

## 2. Funcionalidades

### Motorista
- Login com usuário (ou e-mail) e senha.
- Preenchimento do checklist: data, caminhão, quilometragem, horímetro e os 25 itens de inspeção.
- Cada item recebe uma resposta: **OK**, **NG**, **N/A** ou **CRÍTICO** (com ícone e texto, sem depender só da cor).
- Barra de progresso fixa ("12 de 25 respondidos").
- Observação obrigatória e campo de ação imediata quando o item é NG ou CRÍTICO.
- Observações gerais opcionais.
- Histórico com os 10 últimos checklists enviados por ele.

### Admin
- **Checklists:** filtro por data, motorista e placa, lista de recentes (últimos 100), detalhe item a item e impressão.
- **Motoristas:** cadastro (nome, usuário e senha), **desativar/reativar** e **excluir** (com janela de confirmação).
- **Caminhões:** cadastro (placa, número da carreta/equipamento e descrição), desativar/reativar.

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
- **Admin:** é identificado pelo **UID fixo** configurado no `app.js` e nas regras do Firestore (ver seção 4). Não aparece na lista de motoristas.
- **Motoristas:** o login é o *usuário* (letras minúsculas, números, ponto, hífen e sublinhado), que vira o e-mail interno `usuario@lpl-checklist.app`. O usuário é único.
  - **Desativar:** o motorista não consegue mais entrar nem enviar/ler checklists (bloqueado no app e nas regras). Pode ser reativado.
  - **Excluir:** remove o cadastro do motorista (documento em `users`) e bloqueia o acesso. Os checklists já enviados **são preservados**. A conta no Firebase Authentication **não é removida** (ver limitações).
- **Caminhões:** a placa é gravada em maiúsculas e sem espaços e não pode se repetir. Caminhões inativos deixam de aparecer na lista do motorista, mas o histórico é mantido.

### Registros
- O app não permite editar nem apagar checklists enviados.
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

### Autenticação e perfis
O Firebase Authentication exige e-mail. No login, o campo "Usuário ou e-mail" funciona assim:

```
"joao.silva"           →  joao.silva@lpl-checklist.app
"fulano@empresa.com"   →  usado como está
```

O domínio interno é fictício (não recebe e-mails) e fica na constante `DOMAIN` do `app.js`.

**Fluxo de login**
1. `signInWithEmailAndPassword` com o e-mail resultante.
2. Lê `users/{uid}` no Firestore.
3. Se o UID for o do admin e o documento não existir, o app **cria o documento automaticamente** (`role: "admin"`).
4. Para os demais, se o documento não existe ou `ativo === false`, faz logout e mostra "Acesso não liberado".
5. O admin abre o painel; o motorista abre o formulário.

Erros do Firebase são traduzidos em mensagens claras (login por e-mail/senha desativado, chave de API inválida, regras não publicadas, falha de rede, credenciais incorretas etc.).

**Cadastro de motorista pelo admin:** o app cria a conta usando uma **segunda instância** do Firebase (`initializeApp(config, nome)`), para que o admin **não seja deslogado**. Depois grava o perfil em `users/{uid}`.

### Modelo de dados (Firestore)

As coleções só aparecem quando o primeiro documento é gravado (o Firestore não cria coleções vazias).

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

Publique no console do Firebase (Firestore > Regras) o conteúdo do `firestore.rules`, sempre que ele for alterado:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn() && request.auth.uid == "MjQLZheA6NhKLfy4Z8JM8VP8jVb2";
    }

    function isActiveDriver() {
      return signedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "motorista"
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get("ativo", true) == true;
    }

    match /users/{userId} {
      allow read: if isAdmin() || (signedIn() && request.auth.uid == userId);
      allow create: if isAdmin() && (
        userId == request.auth.uid
          ? request.resource.data.role == "admin"
          : request.resource.data.role == "motorista"
      );
      allow update: if isAdmin() && userId != request.auth.uid
        && resource.data.role == "motorista"
        && request.resource.data.role == "motorista";
      allow delete: if isAdmin()
        && userId != request.auth.uid
        && resource.data.role == "motorista";
    }

    match /caminhoes/{truckId} {
      allow read: if signedIn();
      allow create, update, delete: if isAdmin();
    }

    match /checklists/{checklistId} {
      allow read: if isAdmin()
        || (isActiveDriver() && resource.data.motoristaId == request.auth.uid);
      allow create: if isActiveDriver()
        && request.resource.data.motoristaId == request.auth.uid;
      allow update, delete: if isAdmin();
    }
  }
}
```

| Coleção | Leitura | Escrita |
|---|---|---|
| `users` | Admin, ou o próprio usuário | Admin cria o próprio perfil (como admin) e cria, altera e exclui motoristas; não altera o próprio perfil nem muda `role` |
| `caminhoes` | Qualquer usuário logado | Somente admin |
| `checklists` | Admin, ou motorista **ativo** lendo os próprios | Motorista **ativo** cria em nome dele; admin pode alterar e apagar (o app não usa essas opções) |

### Interface e acessibilidade
- Tema escuro, fonte Manrope, identidade visual LPL (logo no cabeçalho e tela de login em duas colunas).
- Respostas com **ícone + texto** (✓ OK, ! NG, – N/A, ⚠ CRÍTICO).
- Foco de teclado visível, respeito à preferência de reduzir movimento, layout responsivo e impressão com tema claro.

---

## 5. Configuração e execução

### Firebase
1. Criar o projeto e adicionar um **app Web**. Copiar o `firebaseConfig` para o `firebase-config.js`.
2. **Authentication > Sign-in method:** ativar **E-mail/senha**.
3. **Authentication > Usuários:** criar a conta do administrador (e-mail e senha). O **UID** dela deve ser o mesmo configurado em `ADMIN_UID` (`app.js`) e na função `isAdmin()` (`firestore.rules`).
4. **Firestore Database:** criar o banco e publicar as regras (aba Regras).
5. **Authentication > Configurações > Domínios autorizados:** conferir o `localhost` e adicionar o domínio da Vercel.

### Primeiro acesso do administrador
Entre com o e-mail real da conta do admin (ou o usuário correspondente) e a senha. No primeiro login o app cria automaticamente o documento `users/{UID_ADMIN}`. Depois, cadastre caminhões e motoristas pelo próprio app.

### Trocar o administrador
O UID do admin está em **dois lugares**: `ADMIN_UID` no `app.js` e a função `isAdmin()` nas regras. Altere os dois e publique as regras novamente.

### Rodar localmente
Os módulos ES exigem um servidor (não abra o `index.html` com duplo clique):

```bash
npx serve
# ou
python3 -m http.server 8000
```

---

## 6. Deploy na Vercel
1. Suba a pasta para um repositório no GitHub (com o `LPL_2022_branco.png` junto).
2. Na Vercel, **Add New > Project** e importe o repositório.
3. *Framework Preset:* **Other**. Sem comando de build e sem pasta de saída especial (a raiz já é o site).
4. Após o deploy, adicione o domínio da Vercel nos **Domínios autorizados** do Firebase Authentication.

---

## 7. Segurança
- A `apiKey` do Firebase Web **não é segredo**: ela só identifica o projeto. Quem protege os dados são as **regras do Firestore**, então mantenha-as publicadas e atualizadas.
- Senhas são tratadas pelo Firebase Authentication (o app nunca as armazena).
- Motoristas só leem e criam os próprios checklists, e só enquanto estiverem **ativos**.
- O UID do admin é público no código, mas não dá acesso por si só: é preciso estar autenticado nessa conta.
- Defina uma senha forte para o admin e troque as senhas iniciais dos motoristas.

---

## 8. Limitações conhecidas
- **Excluir motorista não remove a conta do Firebase Authentication.** Para liberar o mesmo usuário para um novo cadastro, apague a conta também em Authentication > Usuários. Enquanto isso, quem tenta entrar com ela é barrado por não ter cadastro.
- A **data do checklist é editável** pelo motorista (vem preenchida com o dia atual).
- A **redefinição de senha** é manual, pelo console do Firebase.
- Caminhões não podem ser excluídos pelo app (só desativados), e não há exclusão de checklists pela interface.
- Os caminhões podem ser lidos por qualquer usuário logado, inclusive motorista desativado.
- O filtro por motorista e placa atua sobre os resultados carregados: a lista "recentes" traz no máximo 100 registros.
- Sem modo offline: é preciso conexão para enviar o checklist.
- Não há fotos, assinatura, exportação para Excel/PDF nem notificações.
- O logo original é uma imagem grande (6488×3503 px); reduzir o arquivo deixa o carregamento mais rápido no celular.

---

## 9. Possíveis evoluções
- Fluxo da **manutenção**: dar baixa nos itens NG/CRÍTICO (responsável, data/hora da correção, status e visto do líder), como na planilha original.
- Bloqueio de duplicidade (um checklist por caminhão por dia) ou alerta de caminhões sem checklist no dia.
- Anexar fotos aos itens com problema.
- Exportação para Excel/PDF e filtro por período.
- Exclusão completa de motoristas e redefinição de senha pelo painel (Cloud Functions com Admin SDK).
- Modo offline (PWA) com envio quando voltar a conexão.
- Dashboard com indicadores (itens mais reprovados, caminhões com mais ocorrências).
