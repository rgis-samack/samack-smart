# 📺 Premium Web IPTV Player & Dashboard

[![JavaScript](https://img.shields.io/badge/javascript-ES6%2B-yellow.svg?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/HTML5)
[![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/CSS3)
[![SQLite WebAssembly](https://img.shields.io/badge/sqlite--wasm-sql.js-active.svg?logo=sqlite&logoColor=white)](https://github.com/sql-js/sql.js)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Hospedagem-brightgreen.svg?logo=github&logoColor=white)](https://pages.github.com/)

Uma aplicação web moderna, responsiva e de alta performance projetada para carregar, gerenciar e reproduzir listas de canais, filmes e séries diretamente no navegador. 

Desenvolvida com o tema escuro **Obsidian Neon**, a plataforma combina alto apelo visual com recursos técnicos robustos para players de vídeo HLS e reprodução contínua.

---

## ✨ Recursos Principais

https://rgis-samack.github.io/samack-smart/

### 1. Suporte a Múltiplos Formatos (Drag & Drop)
Arraste e solte o arquivo da sua lista diretamente na interface. O dashboard processa e categoriza tudo localmente no seu navegador:
*   **Listas M3U / M3U8**: Importação direta de arquivos de texto padrão de canais e VODs.
*   **Arquivos JSON**:
    *   *Estruturado*: Formato pré-categorizado (`canais`, `filmes` e `series`).
    *   *Plano (Array)*: Conversão inteligente e mapeamento de chaves legadas (`nome` -> `titulo`, `categoria` -> `grupo`, etc.).
*   **Bancos de Dados SQLite (`.db` / `.sqlite`)**: Através da biblioteca **`sql.js` (WebAssembly)**, o navegador lê o arquivo binário localmente, monta um banco de dados temporário na memória e executa as consultas diretamente nos canais, sem nenhuma requisição de servidor.

### 2. Agrupamento Inteligente de Séries
*   Agrupa de forma automática milhares de episódios avulsos em cartões de séries unificados baseados em seus logos/capas.
*   **Navegador de Temporadas**: Interface lateral interativa integrada no player que permite selecionar a temporada desejada e navegar pela lista ordenada de episódios de forma contínua.
*   **Enriquecimento de Metadados**: Faz a busca em segundo plano na API do servidor de mídia para recuperar capas em alta resolução e os nomes reais das séries (com fallback via regex e TMDB).

### 3. Otimização de Buffering & Player Auto-Cura
*   **Buffer Estendido**: Pré-carregamento de **120 segundos (2 minutos)** de vídeo no cache da memória RAM, com limite de expansão de até **240 segundos (4 minutos)**.
*   **Web Workers**: O processamento de download de segmentos de vídeo e análise de buffer roda em um thread separado do navegador, mantendo a navegação do site fluida e livre de lag.
*   **Conexão Auto-Cura**: Em caso de oscilações de rede, o player intercepta os erros de buffer fatal e tenta recuperar a conexão (`hls.startLoad()`) e a mídia (`hls.recoverMediaError()`) de forma autônoma.
*   **Auto-Empurrão (Nudging)**: Se a reprodução nativa de um arquivo MP4/VOD ficar travada no estado de carregamento por mais de 3.5 segundos, o player realiza um micro-avanço de `0.1s` na linha do tempo para forçar o navegador a restabelecer a conexão com o fluxo de rede.

### 4. Player Integrado & Externo
*   Reprodutor nativo compatível com transmissões ao vivo (.m3u8) e arquivos diretos (.mp4, .mkv).
*   Suporte a protocolos de redirecionamento para abertura direta no **VLC Media Player** instalado no computador do usuário.

---

## 🌐 Hospedagem Gratuita no GitHub Pages

Você pode publicar esta ferramenta na nuvem de forma gratuita em poucos passos:

1. **Crie um repositório** na sua conta do GitHub.
2. **Envie os arquivos** da pasta do dashboard para o repositório.
3. Acesse as **Settings** (Configurações) do repositório no GitHub.
4. No menu esquerdo, clique em **Pages**.
5. Em **Build and deployment**, selecione a branch principal (`main` ou `master`), a pasta `/ (root)` e clique em **Save**.
6. Em instantes, o link público do seu player estará disponível no formato:
   `https://<seu-usuario>.github.io/<nome-do-repositorio>/`
