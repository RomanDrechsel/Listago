package de.romandrechsel.listago;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import de.romandrechsel.listago.garmin.ConnectIQPlugin;
import de.romandrechsel.listago.sysinfo.SysInfoPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        registerPlugin(ConnectIQPlugin.class);
        registerPlugin(SysInfoPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart()
    {
        super.onStart();
        EdgeToEdge.enable(this);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WebView webView = getBridge().getWebView();
        if (webView != null)
        {
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(true);
        }

        SysInfoPlugin plugin = this.GetSysInfoPlugin();
        if (plugin != null)
        {
            int currentNightMode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            plugin.SetNightMode(currentNightMode == Configuration.UI_MODE_NIGHT_YES);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig)
    {
        super.onConfigurationChanged(newConfig);
        boolean isNightMode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
        {
            isNightMode = getResources().getConfiguration().isNightModeActive();
        }
        else
        {
            int currentNightMode = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
            isNightMode = currentNightMode == Configuration.UI_MODE_NIGHT_YES;
        }
        SysInfoPlugin plugin = this.GetSysInfoPlugin();
        if (plugin != null)
        {
            plugin.SetNightMode(isNightMode);
        }
    }

    private SysInfoPlugin GetSysInfoPlugin()
    {
        PluginHandle handle = this.getBridge().getPlugin("SysInfo");
        if (handle != null)
        {
            return (SysInfoPlugin) handle.getInstance();
        }
        return null;
    }
}
