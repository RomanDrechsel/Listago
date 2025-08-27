package de.romandrechsel.listago.appupdate;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.tasks.Task;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

import de.romandrechsel.listago.logging.Logger;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin
{
    private AppUpdateManager appUpdateManager;
    private AppUpdateInfo appUpdateInfo;
    private InstallStateUpdatedListener listener;

    private static final String TAG = "AppUpdate";

    public void load()
    {
        this.appUpdateManager = AppUpdateManagerFactory.create(this.getContext());
    }

    @PluginMethod
    public void getAppUpdateInfo(PluginCall call)
    {
        try
        {
            boolean isGooglePlayServicesAvailable = this.isGooglePlayServicesAvailable();
            if (!isGooglePlayServicesAvailable)
            {
                Logger.Error(TAG, "Google Play Services not available");
                JSObject ret = new JSObject();
                ret.put("error", "GOOGLE_PLAY_SERVICES_NOT_AVAILABLE");
                call.resolve(ret);
                return;
            }

            Task<AppUpdateInfo> appUpdateInfoTask = this.appUpdateManager.getAppUpdateInfo();
            appUpdateInfoTask.addOnSuccessListener(appUpdateInfo ->
            {
                this.appUpdateInfo = appUpdateInfo;
                PackageInfo pInfo;
                try
                {
                    pInfo = this.getPackageInfo();
                }
                catch (PackageManager.NameNotFoundException e)
                {
                    Logger.Error(TAG, "Could not get app update info: ", e);
                    JSObject ret = new JSObject();
                    ret.put("error", "FAILED");
                    call.resolve(ret);
                    return;
                }

                JSObject ret = new JSObject();
                //ret.put("currentVersionName", pInfo.versionName);
                ret.put("currentVersionCode", String.valueOf(pInfo.getLongVersionCode()));
                ret.put("availableVersionCode", String.valueOf(appUpdateInfo.availableVersionCode()));
                ret.put("updateAvailable", appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE);
                //ret.put("updatePriority", appUpdateInfo.updatePriority());
                //ret.put("immediateUpdateAllowed", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
                ret.put("flexibleUpdateAllowed", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
                /*Integer clientVersionStalenessDays = appUpdateInfo.clientVersionStalenessDays();
                if (clientVersionStalenessDays != null)
                {
                    ret.put("clientVersionStalenessDays", clientVersionStalenessDays);
                }*/
                ret.put("installStatus", appUpdateInfo.installStatus());
                call.resolve(ret);
            });
            appUpdateInfoTask.addOnFailureListener(failure ->
            {
                Logger.Error(TAG, "Could not get app update info: ", failure);
                JSObject ret = new JSObject();
                ret.put("error", "FAILED");
                call.resolve(ret);
            });
        }
        catch (Exception exception)
        {
            Logger.Error(TAG, "Could not get app update info: ", exception);
            JSObject ret = new JSObject();
            ret.put("error", "FAILED");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void performUpdate(PluginCall call)
    {
        if (this.updateAvailable(call))
        {
            if (this.appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
            {
                this.listener = state ->
                {
                    int installStatus = state.installStatus();
                    JSObject ret = new JSObject();
                    ret.put("installStatus", installStatus);
                    if (installStatus == InstallStatus.DOWNLOADING)
                    {
                        ret.put("bytesDownloaded", state.bytesDownloaded());
                        ret.put("totalBytesToDownload", state.totalBytesToDownload());
                    }
                    this.notifyListeners("onFlexibleUpdateStateChange", ret);
                };
                this.appUpdateManager.registerListener(this.listener);

                ActivityResultLauncher<IntentSenderRequest> activityResultLauncher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), result ->
                {
                    JSObject ret = new JSObject();
                    ret.put("type", "flexible");
                    switch (result.getResultCode())
                    {
                        case Activity.RESULT_OK -> ret.put("accepted", true);
                        case Activity.RESULT_CANCELED -> ret.put("accepted", false);
                    }
                    call.resolve(ret);
                });

                this.appUpdateManager.startUpdateFlowForResult(this.appUpdateInfo, activityResultLauncher, AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build());
            }
            else if (this.appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
            {
                ActivityResultLauncher<IntentSenderRequest> activityResultLauncher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), result ->
                {
                    JSObject ret = new JSObject();
                    ret.put("type", "immediate");
                    switch (result.getResultCode())
                    {
                        case Activity.RESULT_OK -> ret.put("accepted", true);
                        case Activity.RESULT_CANCELED -> ret.put("accepted", false);
                    }
                    call.resolve(ret);
                });

                this.appUpdateManager.startUpdateFlowForResult(this.appUpdateInfo, activityResultLauncher, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build());
            }
            else
            {
                JSObject ret = new JSObject();
                ret.put("type", "not_allowed");
                call.resolve(ret);
            }
        }
    }

    @PluginMethod
    public void completeFlexibleUpdate(PluginCall call)
    {
        if (this.appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
        {
            this.unregisterListener();
            this.appUpdateManager.completeUpdate();
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppStore(PluginCall call)
    {
        try
        {
            String packageName = this.getContext().getPackageName();
            Intent launchIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName));
            try
            {
                this.getBridge().getActivity().startActivity(launchIntent);
            }
            catch (ActivityNotFoundException ex)
            {
                launchIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + packageName));
                this.getBridge().getActivity().startActivity(launchIntent);
            }
            call.resolve();
        }
        catch (Exception exception)
        {
            Logger.Error(TAG, "Could not open app store: ", exception);
            call.reject(exception.getMessage());
        }
    }

    private boolean isGooglePlayServicesAvailable()
    {
        GoogleApiAvailability googleApiAvailability = GoogleApiAvailability.getInstance();
        int resultCode = googleApiAvailability.isGooglePlayServicesAvailable(bridge.getContext());
        return resultCode == ConnectionResult.SUCCESS;
    }

    private PackageInfo getPackageInfo() throws PackageManager.NameNotFoundException
    {
        String packageName = this.getContext().getPackageName();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        {
            return this.getContext().getPackageManager().getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0));
        }
        else
        {
            return this.getContext().getPackageManager().getPackageInfo(packageName, 0);
        }
    }

    private boolean updateAvailable(PluginCall call)
    {
        if (this.appUpdateInfo == null)
        {
            JSObject ret = new JSObject();
            ret.put("code", "UPDATE_INFO_MISSING");
            call.resolve(ret);
            return false;
        }
        else if (this.appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_NOT_AVAILABLE)
        {
            JSObject ret = new JSObject();
            ret.put("code", "UPDATE_NOT_AVAILABLE");
            call.resolve(ret);
            return false;
        }
        return true;
    }

    private void unregisterListener()
    {
        if (this.listener == null || this.appUpdateManager == null)
        {
            return;
        }
        this.appUpdateManager.unregisterListener(this.listener);
        this.listener = null;
    }
}
