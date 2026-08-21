# LENAMP — áudio nativo Android

Esta pasta contém a camada nativa do player Android.

- `LenampPlaybackService.java` mantém `ExoPlayer` + `MediaSession` em um `MediaSessionService`.
- `LenampAudioPlugin.java` expõe o serviço ao JavaScript do Capacitor.
- `scripts/install-android-audio.mjs` copia os arquivos e aplica as alterações necessárias no projeto Android gerado.

## Instalação

Depois de instalar as dependências e gerar a plataforma Android:

```bash
npm install
npx cap add android
npm run android:audio
npm run cap:sync
```

O instalador é idempotente: pode ser executado novamente após regenerações do projeto Android.

## Importante

A camada nativa recebe URIs persistentes (`content://` ou `file://`). O player web atual ainda trabalha com `Blob`/IndexedDB. A próxima etapa é a biblioteca via Android MediaStore, que fornecerá essas URIs sem duplicar a biblioteca de músicas.
