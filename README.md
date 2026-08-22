# LENAMP v0.4.2

Player de áudio local em HTML, CSS e JavaScript, com PWA e camada Android via Capacitor.

**Sua música. Zero anúncios.**

## Correção v0.4.2 — botão ATUALIZAR

- no Android, o rótulo **ATUALIZAR** agora depende da plataforma e não da detecção do plugin;
- a ponte `LenampLibrary` usa `Capacitor.registerPlugin()` quando disponível, com fallback legado;
- mensagens da biblioteca no Android também usam **ATUALIZAR**.

## Novidade principal — biblioteca Android / MediaStore

A v0.4.1 liga a interface do LENAMP à biblioteca real de músicas do Android:

- solicita a permissão correta conforme a versão do Android;
- consulta `MediaStore.Audio.Media` sem copiar os arquivos;
- recebe URI nativa `content://` para cada faixa;
- carrega título, artista, álbum e duração;
- ordena as faixas por título;
- restaura a faixa atual e a posição anterior usando o estado salvo;
- o botão **ADICIONAR** vira **ATUALIZAR** no Android e refaz a leitura da biblioteca;
- a capa embutida da faixa é carregada sob demanda, evitando varrer imagens de toda a biblioteca de uma vez;
- reprodução das faixas do MediaStore passa pela camada Media3/ExoPlayer, permitindo segundo plano, tela bloqueada e controles do sistema.

No navegador/PWA, nada muda: o LENAMP continua usando o seletor de arquivos e IndexedDB.

## Permissões Android

- Android 13 ou superior: `READ_MEDIA_AUDIO`.
- Android 12L ou inferior: `READ_EXTERNAL_STORAGE` limitado até API 32.
- Áudio em segundo plano: `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.

## Arquitetura

- `js/app.js` — estado da interface e orquestração do player.
- `js/native-library.js` — fachada JS para a biblioteca Android.
- `js/native-audio.js` — fachada JS para o serviço Media3.
- `native/android/.../LenampLibraryPlugin.java` — consulta MediaStore e extrai capa sob demanda.
- `native/android/.../LenampAudioPlugin.java` — comandos do ExoPlayer/MediaSession.
- `native/android/.../LenampPlaybackService.java` — reprodução em segundo plano.
- `scripts/install-android-audio.mjs` — instala os plugins, permissões e serviço no projeto Android gerado.

## Atualizar um projeto Android já existente

Extraia esta versão por cima do projeto fonte do LENAMP e rode:

```bash
npm install
npm run android:native
npm run cap:sync
```

Depois abra/recompile pelo Android Studio.

Se você apagar e gerar `android/` novamente:

```bash
npm run android:add
```

## Teste esperado no Android

Na primeira abertura, o sistema pede acesso a músicas e áudio. Após permitir, o LENAMP lê a biblioteca e preenche a lista automaticamente. Em seguida teste:

1. tocar uma música;
2. bloquear a tela;
3. usar play/pause e próxima pela notificação;
4. voltar ao LENAMP e verificar se a posição acompanha a reprodução;
5. adicionar uma música nova ao aparelho e tocar **ATUALIZAR**.

## Observação técnica

A equalização Web Audio continua funcionando para arquivos abertos no navegador/PWA. As faixas reproduzidas pelo ExoPlayer Android ainda não passam pelo equalizador Web Audio; uma etapa posterior pode implementar equalização nativa com `AudioEffect` sem misturar as duas arquiteturas.

## Sobre

LENAMP é um projeto independente criado por Leandro Ribeiro, inspirado no espírito dos players clássicos de desktop. Não possui afiliação com o Winamp — é apenas nostalgia e uma homenagem.

## Correção de permissões — v0.4.1

O LENAMP **não precisa** de microfone, câmera, fotos ou vídeos. A única permissão de mídia usada no Android 13+ é `READ_MEDIA_AUDIO` ("músicas e áudio").

O instalador nativo agora remove automaticamente permissões antigas ou indevidas (`RECORD_AUDIO`, `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` etc.) do `AndroidManifest.xml` antes de sincronizar.

Para validar a correção em um aparelho que já recebeu builds anteriores, desinstale o LENAMP antigo uma vez, rode `npm run android:native`, `npm run cap:sync` e instale novamente. Isso limpa permissões previamente concedidas ao pacote durante os testes.
