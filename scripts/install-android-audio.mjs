import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const androidRoot = path.join(root, 'android');

if (!existsSync(androidRoot)) {
  throw new Error('Projeto Android ausente. Execute: npm install && npx cap add android');
}

const javaRoot = path.join(androidRoot, 'app', 'src', 'main', 'java', 'com', 'leandroribeiro', 'lenamp');
const audioJavaRoot = path.join(javaRoot, 'audio');
await mkdir(audioJavaRoot, { recursive: true });
await cp(
  path.join(root, 'native', 'android', 'java', 'com', 'leandroribeiro', 'lenamp', 'audio'),
  audioJavaRoot,
  { recursive: true },
);

const mainActivityPath = path.join(javaRoot, 'MainActivity.java');
const mainActivity = `package com.leandroribeiro.lenamp;\n\nimport android.os.Bundle;\n\nimport com.getcapacitor.BridgeActivity;\nimport com.leandroribeiro.lenamp.audio.LenampAudioPlugin;\nimport com.leandroribeiro.lenamp.audio.LenampLibraryPlugin;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(LenampAudioPlugin.class);\n        registerPlugin(LenampLibraryPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}\n`;
await writeFile(mainActivityPath, mainActivity, 'utf8');

const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');

// LENAMP usa somente leitura de áudio. Remove permissões multimídia antigas/indevidas
// que possam ter ficado no projeto Android de builds anteriores.
const forbiddenPermissions = [
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
];

for (const permissionName of forbiddenPermissions) {
  const escaped = permissionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const permissionRegex = new RegExp(`\\s*<uses-permission\\b[^>]*android:name=["']${escaped}["'][^>]*/?>`, 'g');
  manifest = manifest.replace(permissionRegex, '');
}

// Também elimina uma feature de microfone que possa ter sobrado de um projeto antigo.
manifest = manifest.replace(/\s*<uses-feature\b[^>]*android:name=["']android\.hardware\.microphone["'][^>]*\/?\s*>/g, '');

const permissions = [
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
  '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
];

const missingPermissions = permissions.filter((permission) => {
  const permissionName = permission.match(/android:name="([^"]+)"/)?.[1];
  return permissionName && !manifest.includes(`android:name="${permissionName}"`);
});

if (missingPermissions.length) {
  const permissionBlock = `\n    <!-- LENAMP: áudio em segundo plano + biblioteca MediaStore -->\n    ${missingPermissions.join('\n    ')}\n`;
  manifest = manifest.replace(/<application\b/, `${permissionBlock}\n    <application`);
}

const serviceBlock = `\n        <!-- LENAMP: Media3 mantém a sessão ativa fora da WebView -->\n        <service\n            android:name=".audio.LenampPlaybackService"\n            android:foregroundServiceType="mediaPlayback"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="androidx.media3.session.MediaSessionService" />\n                <action android:name="android.media.browse.MediaBrowserService" />\n            </intent-filter>\n        </service>\n`;

if (!manifest.includes('.audio.LenampPlaybackService')) {
  manifest = manifest.replace(/\s*<\/application>/, `${serviceBlock}\n    </application>`);
}

await writeFile(manifestPath, manifest, 'utf8');

const gradlePath = path.join(androidRoot, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
const dependencyMarker = 'LENAMP_MEDIA3_DEPENDENCIES';

if (!gradle.includes(dependencyMarker)) {
  const media3Dependencies = `\n    // ${dependencyMarker}\n    implementation "androidx.media3:media3-exoplayer:1.11.0"\n    implementation "androidx.media3:media3-session:1.11.0"`;

  if (/dependencies\s*\{/.test(gradle)) {
    gradle = gradle.replace(/dependencies\s*\{/, (match) => `${match}${media3Dependencies}`);
  } else {
    gradle += `\n\ndependencies {${media3Dependencies}\n}\n`;
  }
  await writeFile(gradlePath, gradle, 'utf8');
}

console.log('LENAMP: áudio nativo + biblioteca MediaStore instalados no projeto Android.');
