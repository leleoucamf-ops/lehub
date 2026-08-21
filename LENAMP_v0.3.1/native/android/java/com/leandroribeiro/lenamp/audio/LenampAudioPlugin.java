package com.leandroribeiro.lenamp.audio;

import android.content.ComponentName;
import android.net.Uri;

import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "LenampAudio")
public final class LenampAudioPlugin extends Plugin {
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private Player.Listener playerListener;

    @Override
    public void load() {
        super.load();
        connectController();
    }

    private void connectController() {
        if (controllerFuture != null) return;

        SessionToken token = new SessionToken(
            getContext(),
            new ComponentName(getContext(), LenampPlaybackService.class)
        );

        controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
        Executor mainExecutor = ContextCompat.getMainExecutor(getContext());
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                attachPlayerListener();
                emitState();
            } catch (Exception error) {
                controller = null;
            }
        }, mainExecutor);
    }

    private void attachPlayerListener() {
        if (controller == null || playerListener != null) return;
        playerListener = new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                emitState();
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                emitState();
            }

            @Override
            public void onMediaItemTransition(MediaItem mediaItem, int reason) {
                emitState();
            }
        };
        controller.addListener(playerListener);
    }

    private interface ControllerAction {
        void run(MediaController mediaController) throws Exception;
    }

    private void withController(PluginCall call, ControllerAction action) {
        connectController();
        Executor mainExecutor = ContextCompat.getMainExecutor(getContext());

        if (controller != null) {
            try {
                action.run(controller);
            } catch (Exception error) {
                call.reject("Falha no áudio nativo do LENAMP.", error);
            }
            return;
        }

        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                attachPlayerListener();
                action.run(controller);
            } catch (Exception error) {
                call.reject("Não foi possível conectar ao serviço de áudio do LENAMP.", error);
            }
        }, mainExecutor);
    }

    private MediaItem mediaItemFromJson(JSONObject data) {
        String uriValue = data.optString("uri", "");
        if (uriValue.isEmpty()) {
            throw new IllegalArgumentException("URI da faixa ausente.");
        }

        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .setTitle(data.optString("title", "Faixa"))
            .setArtist(data.optString("artist", "LENAMP"))
            .setAlbumTitle(data.optString("album", "Biblioteca local"));

        String artworkUri = data.optString("artworkUri", "");
        if (!artworkUri.isEmpty()) {
            metadata.setArtworkUri(Uri.parse(artworkUri));
        }

        return new MediaItem.Builder()
            .setMediaId(data.optString("id", uriValue))
            .setUri(Uri.parse(uriValue))
            .setMediaMetadata(metadata.build())
            .build();
    }

    @PluginMethod
    public void loadPlaylist(PluginCall call) {
        JSArray items = call.getArray("tracks");
        if (items == null || items.length() == 0) {
            call.reject("Playlist nativa vazia.");
            return;
        }

        withController(call, mediaController -> {
            List<MediaItem> mediaItems = new ArrayList<>();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item != null) mediaItems.add(mediaItemFromJson(item));
            }

            if (mediaItems.isEmpty()) {
                call.reject("Nenhuma faixa nativa válida.");
                return;
            }

            int requestedIndex = call.getInt("currentIndex", 0);
            int index = Math.max(0, Math.min(requestedIndex, mediaItems.size() - 1));
            long positionMs = Math.max(0L, call.getLong("positionMs", 0L));
            boolean autoplay = call.getBoolean("autoplay", false);

            mediaController.setMediaItems(mediaItems, index, positionMs);
            mediaController.prepare();
            if (autoplay) mediaController.play();

            JSObject result = new JSObject();
            result.put("loaded", true);
            result.put("count", mediaItems.size());
            result.put("currentIndex", index);
            call.resolve(result);
            emitState();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        withController(call, mediaController -> {
            mediaController.play();
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(call, mediaController -> {
            mediaController.pause();
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        withController(call, mediaController -> {
            mediaController.stop();
            mediaController.seekTo(0L);
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long positionMs = Math.max(0L, call.getLong("positionMs", 0L));
        withController(call, mediaController -> {
            mediaController.seekTo(positionMs);
            call.resolve();
            emitState();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        double raw = call.getDouble("value", 1.0);
        float value = (float) Math.max(0.0, Math.min(1.0, raw));
        withController(call, mediaController -> {
            mediaController.setVolume(value);
            call.resolve();
        });
    }

    @PluginMethod
    public void setRepeat(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        withController(call, mediaController -> {
            mediaController.setRepeatMode(enabled ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
            call.resolve();
        });
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        withController(call, mediaController -> {
            mediaController.setShuffleModeEnabled(enabled);
            call.resolve();
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        withController(call, mediaController -> call.resolve(buildState(mediaController)));
    }

    private JSObject buildState(MediaController mediaController) {
        JSObject state = new JSObject();
        state.put("isPlaying", mediaController.isPlaying());
        state.put("playbackState", mediaController.getPlaybackState());
        state.put("currentIndex", mediaController.getCurrentMediaItemIndex());
        state.put("positionMs", Math.max(0L, mediaController.getCurrentPosition()));
        state.put("durationMs", Math.max(0L, mediaController.getDuration()));
        state.put("shuffle", mediaController.getShuffleModeEnabled());
        state.put("repeatMode", mediaController.getRepeatMode());
        return state;
    }

    private void emitState() {
        if (controller == null) return;
        notifyListeners("playbackState", buildState(controller), true);
    }

    @Override
    protected void handleOnDestroy() {
        if (controller != null && playerListener != null) {
            controller.removeListener(playerListener);
        }
        playerListener = null;

        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
        }
        controllerFuture = null;
        controller = null;
        super.handleOnDestroy();
    }
}
