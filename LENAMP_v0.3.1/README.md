# LENAMP v0.3.2

Player de áudio local em HTML, CSS e JavaScript, empacotado com Capacitor para Android.

**Sua música. Zero anúncios.**

## Estado desta versão

A v0.3.1 adiciona a fundação nativa para reprodução Android em segundo plano sem desmontar o player web existente:

- `MediaSessionService` com AndroidX Media3;
- `ExoPlayer` rodando fora da Activity/WebView;
- sessão de mídia para controles do Android, fones e Bluetooth;
- notificação multimídia gerenciada pelo Media3;
- ponte Capacitor `LenampAudio`;
- comandos nativos de play, pause, stop, seek, volume, repeat e shuffle;
- carregamento de playlist nativa por URI;
- script idempotente que instala a camada nativa depois que o Capacitor gerar `android/`.

## Por que esta etapa foi separada

No navegador, as faixas atuais são `Blob`s armazenados em IndexedDB. Um serviço Android não deve depender de `blob:` URLs da WebView. O serviço nativo foi preparado para trabalhar com URIs persistentes do Android (`content://`), que serão fornecidas na próxima etapa através do MediaStore.

Isso evita copiar toda a biblioteca para armazenamento interno apenas para manter o áudio tocando em segundo plano.

## Estrutura relevante

- `index.html` — interface principal
- `css/` — estilos
- `js/app.js` — player web, playlist, equalizador e visualizador
- `js/native-audio.js` — fachada JavaScript para o áudio nativo
- `js/media-session.js` — integração Media Session do navegador
- `js/storage.js` — persistência web em IndexedDB
- `native/android/` — código Java da camada Media3
- `scripts/install-android-audio.mjs` — instala a camada Media3 no Android gerado
- `scripts/build-web.mjs` — gera `www/`

## Gerar Android

Requisitos locais: Node 22+, JDK e Android Studio compatíveis com Capacitor 8.

```bash
npm install
npm run build
npm run android:add
```

Depois da primeira geração:

```bash
npm run android
```

O comando `android:add` gera a plataforma, instala o serviço de áudio e sincroniza os arquivos web.

## Áudio em segundo plano

O serviço nativo está implementado e pronto para receber faixas por URI. Para o LENAMP usar essa camada com a biblioteca real do telefone, ainda falta a etapa MediaStore. Até lá, o player continua usando o mecanismo web atual e não promete persistência de áudio nativo com a tela apagada.

## Sobre

LENAMP é um projeto independente criado por Leandro Ribeiro, inspirado no espírito dos players clássicos de desktop. Não possui afiliação com o Winamp — é apenas nostalgia e uma homenagem.


## v0.3.2 — viewport Android

A interface principal agora escala para preencher o maior espaço útil disponível da tela, mantendo a proporção clássica e sem rolagem. O cálculo usa `visualViewport` quando disponível, respeita áreas seguras (`safe-area`) e recalcula após rotação, retorno do segundo plano e mudanças de viewport.
