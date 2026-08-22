# LENAMP — camada nativa Android

A camada nativa agora tem dois plugins Capacitor:

- `LenampAudioPlugin` — controla `MediaSessionService` + ExoPlayer/Media3 para reprodução em segundo plano.
- `LenampLibraryPlugin` — consulta a biblioteca do aparelho via `MediaStore` e devolve URIs `content://` persistentes.
- `LenampPlaybackService` — mantém a sessão de áudio fora da WebView.

## Permissões

- Android 13+ (`API 33+`): `READ_MEDIA_AUDIO`.
- Android 12L e anteriores: `READ_EXTERNAL_STORAGE` com `maxSdkVersion=32`.
- Reprodução em segundo plano: `FOREGROUND_SERVICE` e `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.

## Instalação

Depois de gerar a plataforma Android:

```bash
npm install
npx cap add android
npm run android:native
npm run cap:sync
```

O script é idempotente e pode ser executado novamente.
