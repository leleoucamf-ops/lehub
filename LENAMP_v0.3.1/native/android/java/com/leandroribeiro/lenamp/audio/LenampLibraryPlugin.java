package com.leandroribeiro.lenamp.audio;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "LenampLibrary",
    permissions = {
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public final class LenampLibraryPlugin extends Plugin {
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();

    private String requiredPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? Manifest.permission.READ_MEDIA_AUDIO
            : Manifest.permission.READ_EXTERNAL_STORAGE;
    }

    private boolean hasAudioPermission() {
        return ContextCompat.checkSelfPermission(getContext(), requiredPermission()) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject permissionResult() {
        JSObject result = new JSObject();
        result.put("granted", hasAudioPermission());
        result.put("permission", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "READ_MEDIA_AUDIO" : "READ_EXTERNAL_STORAGE");
        return result;
    }

    @PluginMethod
    public void checkAccess(PluginCall call) {
        call.resolve(permissionResult());
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (hasAudioPermission()) {
            call.resolve(permissionResult());
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("audio", call, "permissionCallback");
        } else {
            requestPermissionForAlias("storage", call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        call.resolve(permissionResult());
    }

    private Uri audioCollection() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        }
        return MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
    }

    @PluginMethod
    public void listTracks(PluginCall call) {
        if (!hasAudioPermission()) {
            call.reject("Permissão de áudio não concedida.", "PERMISSION_DENIED");
            return;
        }

        ioExecutor.execute(() -> {
            try {
                ContentResolver resolver = getContext().getContentResolver();
                Uri collection = audioCollection();
                String[] projection = new String[] {
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.DISPLAY_NAME,
                    MediaStore.Audio.Media.TITLE,
                    MediaStore.Audio.Media.ARTIST,
                    MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.ALBUM_ID,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.SIZE,
                    MediaStore.Audio.Media.MIME_TYPE
                };

                String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " + MediaStore.Audio.Media.DURATION + " > 0";
                String sortOrder = MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC";
                JSArray tracks = new JSArray();

                try (Cursor cursor = resolver.query(collection, projection, selection, null, sortOrder)) {
                    if (cursor != null) {
                        int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                        int displayNameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
                        int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                        int artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                        int albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                        int albumIdColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);
                        int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                        int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
                        int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);

                        while (cursor.moveToNext()) {
                            long id = cursor.getLong(idColumn);
                            long albumId = cursor.getLong(albumIdColumn);
                            Uri contentUri = ContentUris.withAppendedId(collection, id);

                            JSObject item = new JSObject();
                            item.put("id", "android-media-" + id);
                            item.put("mediaStoreId", id);
                            item.put("uri", contentUri.toString());
                            item.put("displayName", safeString(cursor, displayNameColumn, "Faixa"));
                            item.put("title", safeString(cursor, titleColumn, safeString(cursor, displayNameColumn, "Faixa")));
                            item.put("artist", normalizeUnknown(safeString(cursor, artistColumn, "")));
                            item.put("album", normalizeUnknown(safeString(cursor, albumColumn, "")));
                            item.put("albumId", albumId);
                            item.put("durationMs", Math.max(0L, cursor.getLong(durationColumn)));
                            item.put("sizeBytes", Math.max(0L, cursor.getLong(sizeColumn)));
                            item.put("mimeType", safeString(cursor, mimeColumn, "audio/*"));
                            tracks.put(item);
                        }
                    }
                }

                JSObject result = new JSObject();
                result.put("tracks", tracks);
                result.put("count", tracks.length());
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Não foi possível ler a biblioteca de músicas do Android.", error);
            }
        });
    }

    @PluginMethod
    public void getDetails(PluginCall call) {
        if (!hasAudioPermission()) {
            call.reject("Permissão de áudio não concedida.", "PERMISSION_DENIED");
            return;
        }

        String uriValue = call.getString("uri", "");
        if (uriValue.isEmpty()) {
            call.reject("URI da faixa ausente.");
            return;
        }

        ioExecutor.execute(() -> {
            MediaExtractor extractor = new MediaExtractor();
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            JSObject result = new JSObject();
            try {
                Uri uri = Uri.parse(uriValue);
                extractor.setDataSource(getContext(), uri, null);

                Integer bitrateKbps = null;
                Integer sampleRateHz = null;
                Integer channels = null;

                for (int i = 0; i < extractor.getTrackCount(); i++) {
                    MediaFormat format = extractor.getTrackFormat(i);
                    String mime = format.getString(MediaFormat.KEY_MIME);
                    if (mime == null || !mime.startsWith("audio/")) continue;

                    if (format.containsKey(MediaFormat.KEY_BIT_RATE)) {
                        bitrateKbps = Math.max(0, Math.round(format.getInteger(MediaFormat.KEY_BIT_RATE) / 1000f));
                    }
                    if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                        sampleRateHz = Math.max(0, format.getInteger(MediaFormat.KEY_SAMPLE_RATE));
                    }
                    if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                        channels = Math.max(0, format.getInteger(MediaFormat.KEY_CHANNEL_COUNT));
                    }
                    break;
                }

                retriever.setDataSource(getContext(), uri);
                if (bitrateKbps == null) {
                    String rawBitrate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE);
                    if (rawBitrate != null) {
                        try {
                            bitrateKbps = Math.max(0, Math.round(Long.parseLong(rawBitrate) / 1000f));
                        } catch (NumberFormatException ignored) {
                            // Mantém ausente.
                        }
                    }
                }

                byte[] picture = retriever.getEmbeddedPicture();
                String dataUrl = "";
                if (picture != null && picture.length > 0) {
                    String mime = detectImageMime(picture);
                    dataUrl = "data:" + mime + ";base64," + Base64.encodeToString(picture, Base64.NO_WRAP);
                }

                if (bitrateKbps != null) result.put("bitrateKbps", bitrateKbps);
                if (sampleRateHz != null) result.put("sampleRateHz", sampleRateHz);
                if (channels != null) result.put("channels", channels);
                result.put("dataUrl", dataUrl);
                call.resolve(result);
            } catch (Exception error) {
                call.resolve(result);
            } finally {
                try { extractor.release(); } catch (Exception ignored) { }
                try { retriever.release(); } catch (Exception ignored) { }
            }
        });
    }

    @PluginMethod
    public void getArtwork(PluginCall call) {
        if (!hasAudioPermission()) {
            call.reject("Permissão de áudio não concedida.", "PERMISSION_DENIED");
            return;
        }

        String uriValue = call.getString("uri", "");
        if (uriValue.isEmpty()) {
            call.reject("URI da faixa ausente.");
            return;
        }

        ioExecutor.execute(() -> {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                retriever.setDataSource(getContext(), Uri.parse(uriValue));
                byte[] picture = retriever.getEmbeddedPicture();
                JSObject result = new JSObject();

                if (picture == null || picture.length == 0) {
                    result.put("dataUrl", "");
                    call.resolve(result);
                    return;
                }

                String mime = detectImageMime(picture);
                String encoded = Base64.encodeToString(picture, Base64.NO_WRAP);
                result.put("dataUrl", "data:" + mime + ";base64," + encoded);
                call.resolve(result);
            } catch (Exception error) {
                JSObject result = new JSObject();
                result.put("dataUrl", "");
                call.resolve(result);
            } finally {
                try {
                    retriever.release();
                } catch (Exception ignored) {
                    // Sem ação.
                }
            }
        });
    }

    private String safeString(Cursor cursor, int column, String fallback) {
        if (column < 0 || cursor.isNull(column)) return fallback;
        String value = cursor.getString(column);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private String normalizeUnknown(String value) {
        if (value == null) return "";
        String normalized = value.trim();
        if (normalized.equalsIgnoreCase("<unknown>")) return "";
        return normalized;
    }

    private String detectImageMime(byte[] data) {
        if (data.length >= 8 &&
            (data[0] & 0xFF) == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47) {
            return "image/png";
        }
        if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return "image/jpeg";
    }

    @Override
    protected void handleOnDestroy() {
        ioExecutor.shutdownNow();
        super.handleOnDestroy();
    }
}
