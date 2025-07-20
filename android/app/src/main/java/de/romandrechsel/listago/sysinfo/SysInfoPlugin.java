package de.romandrechsel.listago.sysinfo;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Set;

import de.romandrechsel.listago.logging.Logger;
import de.romandrechsel.listago.utils.FileUtils;

@CapacitorPlugin(name = "SysInfo")
public class SysInfoPlugin extends Plugin {
    private static final String TAG = "SysInfoPlugin";

    private Boolean _isNightMode = null;
    private Boolean _appIsReady = false;
    private Intent _pendingIntent = null;

    @PluginMethod
    public void DisplayDensity(PluginCall call) {
        Context context = this.getContext();
        DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        float density = metrics.density;
        JSObject ret = new JSObject();
        ret.put("density", density);
        call.resolve(ret);
    }

    @PluginMethod
    public void NightMode(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isNightMode", this._isNightMode);
        call.resolve(ret);
    }

    @PluginMethod
    public void Logcat(PluginCall call) {
        String level = call.getString("level", "n");
        String message = call.getString("message", null);
        if (message != null && level != null) {
            switch (level) {
                case "d":
                    Log.d(TAG, message);
                    break;
                case "i":
                    Log.w(TAG, message);
                    break;
                case "e":
                    Log.e(TAG, message);
                    break;
                case "n":
                default:
                    Log.i(TAG, message);
                    break;
            }
        }
    }

    @PluginMethod
    public void ClearAppCache(PluginCall call) {
        FileUtils.DeleteDirResult result = this.DeleteCache();

        JSObject ret = new JSObject();
        ret.put("success", result.Success);
        ret.put("directories", result.Directories);
        ret.put("files", result.Files);
        ret.put("size", result.Size);
        call.resolve(ret);
    }

    @PluginMethod
    public void AppInstalled(PluginCall call) {
        String packageName = call.getString("packageName", null);

        boolean installed = false;
        if (packageName != null) {
            PackageManager pm = this.getContext().getPackageManager();
            try {
                pm.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES);
                installed = true;
                Logger.Debug(TAG, "App '" + packageName + "' is installed");
            } catch (PackageManager.NameNotFoundException e) {
                Logger.Debug(TAG, "App '" + packageName + "' is NOT installed");
            }
        }

        JSObject res = new JSObject();
        res.put("installed", installed);
        call.resolve(res);
    }

    @PluginMethod
    public void AppIsReady(PluginCall call) {
        this._appIsReady = true;
        if (this._pendingIntent != null) {
            this.handleIntent(this._pendingIntent);
            this._pendingIntent = null;
        }
        call.resolve();
    }

    public void SetNightMode(@NonNull Boolean isNightMode) {
        if (this._isNightMode != isNightMode) {
            if (this._isNightMode != null) {
                JSObject data = new JSObject();
                data.put("isNightMode", isNightMode);
                this.notifyListeners("NIGHTMODE", data);
            }
            this._isNightMode = isNightMode;
        }
    }

    public void handleIntent(Intent intent) {
        String action = intent.getAction();
        if (action == null || action.equals(Intent.ACTION_MAIN)) {
            return;
        }
        if (!this._appIsReady) {
            this._pendingIntent = intent;
            return;
        }

        JSObject data = new JSObject();
        data.put("action", intent.getAction());
        data.put("type", intent.getType());
        Bundle extras = intent.getExtras();
        if (extras != null) {
            JSObject extrasJson = new JSObject();
            Set<String> keys = extras.keySet();
            for (String key : keys) {
                Object value = extras.get(key);
                if (key.equals("android.intent.extra.STREAM")) {
                    Uri fileUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                    if (fileUri != null && fileUri.getPath() != null) {
                        try {
                            Context context = this.getContext();
                            InputStream inputStream = context.getContentResolver().openInputStream(fileUri);
                            if (inputStream == null) {
                                Logger.Error(TAG, "Received file stream, but could not open it: ", fileUri.toString());
                                continue;
                            }

                            File cacheDir = context.getCacheDir();
                            File receivedDir = new File(cacheDir, "received");
                            if (!receivedDir.exists()) {
                                if (!receivedDir.mkdirs()) {
                                    Logger.Error(TAG, "Failed to create directory '" + receivedDir.getAbsolutePath() + "'");
                                    continue;
                                }
                            }
                            String fileName = new File(fileUri.getPath()).getName();
                            File destFile = new File(receivedDir, fileName);

                            FileOutputStream outputStream = new FileOutputStream(destFile);
                            byte[] buffer = new byte[1024];
                            int len;
                            while ((len = inputStream.read(buffer)) > 0) {
                                outputStream.write(buffer, 0, len);
                            }

                            inputStream.close();
                            outputStream.close();
                            extrasJson.put("android.intent.extra.STREAM", destFile.getAbsolutePath());
                        } catch (Exception e) {
                            Logger.Error(TAG, "Failed to import file: " + fileUri, e);
                        }
                    } else {
                        Logger.Error(TAG, "Failed to import file: file not found at '" + value + "'");
                    }
                } else if (value instanceof String || value instanceof Number || value instanceof Boolean) {
                    extrasJson.put(key, value);
                } else if (value != null) {
                    extrasJson.put(key, value.toString());
                }
            }
            data.put("extras", extrasJson);
        }
        this.notifyListeners("INTENT", data);
    }

    private FileUtils.DeleteDirResult DeleteCache() {
        File dir = getContext().getCacheDir();
        Logger.Debug(TAG, "Clear app cache at " + dir.getAbsolutePath());
        return FileUtils.DeleteDirectory(dir, false);
    }

}
