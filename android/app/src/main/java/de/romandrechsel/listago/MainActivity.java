package de.romandrechsel.listago;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;
import androidx.annotation.Nullable;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import de.romandrechsel.listago.garmin.ConnectIQPlugin;
import de.romandrechsel.listago.logging.Logger;
import de.romandrechsel.listago.sysinfo.SysInfoPlugin;
import de.romandrechsel.listago.utils.FileUtils;

public class MainActivity extends BridgeActivity {
    private Intent _pendingIntent;
    private static final String TAG = "MainActivity";
    private ArrayList<SysInfoPlugin.InitialAction> _initActions = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ConnectIQPlugin.class);
        registerPlugin(SysInfoPlugin.class);
        this.handleAppUpdate();
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
        insetsController.setAppearanceLightStatusBars(false);

        this.handleIntent(this.getIntent());
    }

    @Override
    public void onStart() {
        super.onStart();
        EdgeToEdge.enable(this);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(true);
        }

        SysInfoPlugin plugin = this.GetSysInfoPlugin();
        if (plugin != null) {
            int currentNightMode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            plugin.SetNightMode(currentNightMode == Configuration.UI_MODE_NIGHT_YES);
            if (this._initActions != null) {
                for (SysInfoPlugin.InitialAction action : this._initActions) {
                    plugin.InitialActionDone(action);
                }
                this._initActions = null;
            }
            if (this._pendingIntent != null) {
                plugin.handleIntent(this._pendingIntent);
                this._pendingIntent = null;
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        this.handleIntent(intent);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean isNightMode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            isNightMode = getResources().getConfiguration().isNightModeActive();
        } else {
            int currentNightMode = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
            isNightMode = currentNightMode == Configuration.UI_MODE_NIGHT_YES;
        }
        SysInfoPlugin plugin = this.GetSysInfoPlugin();
        if (plugin != null) {
            plugin.SetNightMode(isNightMode);
        }
    }

    private SysInfoPlugin GetSysInfoPlugin() {
        if (this.getBridge() != null) {
            PluginHandle handle = this.getBridge().getPlugin("SysInfo");
            if (handle != null) {
                return (SysInfoPlugin) handle.getInstance();
            }

        }
        return null;
    }

    private void handleIntent(@Nullable Intent intent) {
        if (intent != null) {
            SysInfoPlugin plugin = this.GetSysInfoPlugin();
            if (plugin != null) {
                plugin.handleIntent(intent);
            } else {
                this._pendingIntent = intent;
            }
        }
    }

    private void handleAppUpdate() {
        long currentVersionCode = -1;
        try {
            PackageInfo packageInfo = this.getPackageManager().getPackageInfo(this.getPackageName(), 0);
            currentVersionCode = packageInfo.getLongVersionCode();
        } catch (PackageManager.NameNotFoundException e) {
            Logger.Error(TAG, "Could not read package version number: ", e);
        }

        if (currentVersionCode > 0) {
            SharedPreferences sharedPreferences = this.getSharedPreferences(this.getString(R.string.shared_pref), Context.MODE_PRIVATE);
            long lastVersionCode = sharedPreferences.getLong("lastVersionCode", -1);

            if (currentVersionCode > lastVersionCode) {
                sharedPreferences.edit().putLong("lastVersionCode", currentVersionCode).apply();
                boolean success = false;
                Exception ex = null;
                try {
                    File webviewCache = new File(getApplicationContext().getCacheDir().getParent(), "app_webview");
                    success = FileUtils.DeleteDirectory(webviewCache, false).Success;
                } catch (Exception e) {
                    Logger.Error(TAG, "Could not delete webview cache: ", e);
                    ex = e;
                }

                Map<String, Object> payload = new HashMap<>();
                payload.put("success", success);
                if (ex != null) {
                    payload.put("error", ex.getMessage());
                }
                payload.put("to", currentVersionCode);
                payload.put("from", lastVersionCode);
                SysInfoPlugin.InitialAction action = new SysInfoPlugin.InitialAction("appUpdate", payload);
                SysInfoPlugin plugin = this.GetSysInfoPlugin();
                if (plugin != null) {
                    plugin.InitialActionDone(action);
                } else {
                    if (this._initActions == null) {
                        this._initActions = new ArrayList<>();
                    }
                    this._initActions.add(action);
                }
            }
        }
    }
}
