package com.leandroribeiro.lenamp.audio;

import androidx.annotation.Nullable;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Serviço de reprodução do LENAMP.
 *
 * O Player e a MediaSession vivem fora da Activity para que o Android possa
 * manter o áudio, controles de sistema e notificação mesmo com a WebView em
 * segundo plano ou com a tela bloqueada.
 */
public final class LenampPlaybackService extends MediaSessionService {
    private MediaSession mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();
        ExoPlayer player = new ExoPlayer.Builder(this).build();
        mediaSession = new MediaSession.Builder(this, player).build();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.getPlayer().release();
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }
}
