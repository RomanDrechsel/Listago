package de.romandrechsel.listago.admob;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import de.romandrechsel.listago.logging.Logger;

@CapacitorPlugin(name = "AdMob")
public class AdmobPlugin extends Plugin
{
    private static final String TAG = "AdmobPlugin";
    private FrameLayout bannerContainer;
    private AdView adView;
    private boolean isInitialized = false;
    private boolean isBannerPresented = false;

    private final int defaultInitializationTimeout = 30;

    @PluginMethod
    public void Initialize(PluginCall call)
    {
        long startTime = System.currentTimeMillis();

        Activity activity = this.getActivity();

        Boolean initializeForTesting = call.getBoolean("initializeForTesting", false);
        List<String> testingDevices = new ArrayList<>();
        JSArray jsTestingDevices = call.getArray("testingDevices");
        if (jsTestingDevices != null)
        {
            for (int i = 0; i < jsTestingDevices.length(); i++)
            {
                try
                {
                    testingDevices.add(jsTestingDevices.getString(i));
                }
                catch (JSONException ex)
                {
                    Logger.Error(TAG, "Could not fetch AdMob testing device: ", ex);
                }
            }
        }

        if (Boolean.TRUE.equals(initializeForTesting) || !testingDevices.isEmpty())
        {
            RequestConfiguration configuration = new RequestConfiguration.Builder()
                .setTestDeviceIds(testingDevices)
                .build();
            MobileAds.setRequestConfiguration(configuration);
        }

        activity.runOnUiThread(() ->
        {
            int timeout = this.defaultInitializationTimeout;
            Integer timeoutOverride = call.getInt("timeout", this.defaultInitializationTimeout);
            if (timeoutOverride != null && timeoutOverride > 0)
            {
                timeout = timeoutOverride;
            }

            JSObject ret = new JSObject();
            final AtomicBoolean isDone = new AtomicBoolean(false);
            Handler timeoutHandler = new Handler(Looper.getMainLooper());

            Runnable timeoutRunnable = () ->
            {
                if (isDone.compareAndSet(false, true))
                {
                    this.isInitialized = false;
                    ret.put("initialized", false);
                    ret.put("duration", System.currentTimeMillis() - startTime);
                    call.resolve(ret);
                }
            };

            timeoutHandler.postDelayed(timeoutRunnable, timeout * 1000L);
            MobileAds.initialize(activity, initializationStatus ->
            {
                if (isDone.compareAndSet(false, true))
                {
                    timeoutHandler.removeCallbacks(timeoutRunnable);
                    this.isInitialized = true;
                    ret.put("initialized", true);
                    ret.put("duration", System.currentTimeMillis() - startTime);
                    call.resolve(ret);
                }
                else
                {
                    this.isInitialized = true;
                    Logger.Important(TAG, "AdMob initialized late (after " + (System.currentTimeMillis() - startTime) + "ms");
                }
            });
        });
    }

    @PluginMethod
    public void ShowBanner(PluginCall call)
    {
        String adId = call.getString("adId");
        Boolean jsIsTesting = call.getBoolean("isTesting", false);
        boolean isTesting = Boolean.TRUE.equals(jsIsTesting);
        String jsGravity = call.getString("gravity", "BOTTOM");
        int bannerGravity = (jsGravity == null || !jsGravity.equals("TOP") ? Gravity.BOTTOM : Gravity.TOP);

        if (!isTesting && (adId == null || adId.isEmpty()))
        {
            call.reject("Missing adId");
            return;
        }

        if (isTesting)
        {
            adId = "ca-app-pub-3940256099942544/6300978111";
        }

        Activity activity = this.getActivity();
        String finalAdId = adId;
        activity.runOnUiThread(() ->
        {
            try
            {
                this.removeBannerInternal();

                this.bannerContainer = new FrameLayout(activity);
                this.bannerContainer.setClipToPadding(false);

                FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                containerParams.gravity = bannerGravity | Gravity.CENTER_HORIZONTAL;

                ViewGroup rootView = activity.findViewById(android.R.id.content);
                rootView.addView(this.bannerContainer, containerParams);

                this.applySystemBarInsets(activity);

                this.adView = new AdView(activity);
                this.adView.setAdUnitId(finalAdId);

                AdSize adSize = this.getAnchoredAdaptiveBannerSize(activity);
                this.adView.setAdSize(adSize);

                FrameLayout.LayoutParams adParams = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                adParams.gravity = Gravity.CENTER;

                this.bannerContainer.addView(this.adView, adParams);

                long startTime = System.currentTimeMillis();

                this.adView.setAdListener(new AdListener()
                {
                    @Override
                    public void onAdLoaded()
                    {
                        AdmobPlugin.this.isBannerPresented = true;
                        JSObject loaded = new JSObject();
                        loaded.put("adId", finalAdId);
                        loaded.put("isTesting", isTesting);
                        loaded.put("duration", System.currentTimeMillis() - startTime);
                        AdmobPlugin.this.notifyListeners("bannerLoaded", loaded);
                        AdmobPlugin.this.notifyBannerSize(AdmobPlugin.this.adView.getAdSize(), activity);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError)
                    {
                        JSObject error = new JSObject();
                        error.put("adId", finalAdId);
                        error.put("isTesting", isTesting);
                        error.put("duration", System.currentTimeMillis() - startTime);
                        error.put("code", loadAdError.getCode());
                        error.put("message", loadAdError.getMessage());
                        error.put("domain", loadAdError.getDomain());

                        AdmobPlugin.this.notifyListeners("bannerFailedToLoad", error);
                        AdmobPlugin.this.notifyBannerSize(new AdSize(0, 0), activity);
                    }

                    @Override
                    public void onAdClosed()
                    {
                        JSObject closed = new JSObject();
                        closed.put("adId", finalAdId);
                        closed.put("isTesting", isTesting);
                        closed.put("duration", System.currentTimeMillis() - startTime);
                        AdmobPlugin.this.notifyListeners("bannerClosed", closed);
                        AdmobPlugin.this.notifyBannerSize(new AdSize(0, 0), activity);
                    }
                });

                AdRequest request = new AdRequest.Builder().build();
                this.adView.loadAd(request);
                call.resolve();
            }
            catch (Exception e)
            {
                Logger.Error(TAG, "Could not show AdMob banner: ", e);
                call.reject("Could not show banner", e);
            }
        });
    }

    @PluginMethod
    public void HideBanner(PluginCall call)
    {
        Activity activity = this.getActivity();
        activity.runOnUiThread(() ->
        {
            if (this.bannerContainer != null)
            {
                this.bannerContainer.setVisibility(android.view.View.GONE);
            }

            this.isBannerPresented = false;
            this.notifyBannerSize(new AdSize(0, 0), activity);
            call.resolve();
        });
    }

    @PluginMethod
    public void ResumeBanner(PluginCall call)
    {
        Activity activity = getActivity();

        activity.runOnUiThread(() ->
        {
            if (this.bannerContainer != null)
            {
                this.bannerContainer.setVisibility(android.view.View.VISIBLE);
                this.isBannerPresented = true;

                if (this.adView != null)
                {
                    this.notifyBannerSize(this.adView.getAdSize(), activity);
                }
            }

            call.resolve();
        });
    }

    @PluginMethod
    public void RemoveBanner(PluginCall call)
    {
        Activity activity = getActivity();

        activity.runOnUiThread(() ->
        {
            this.removeBannerInternal();
            this.notifyBannerSize(new AdSize(0, 0), activity);
            call.resolve();
        });
    }

    @PluginMethod
    public void GetState(PluginCall call)
    {
        JSObject status = new JSObject();
        status.put("isAdMobInitialized", this.isInitialized);
        status.put("isBannerPresented", this.isBannerPresented);
        call.resolve(status);
    }

    private void removeBannerInternal()
    {
        if (this.adView != null)
        {
            this.adView.destroy();
            this.adView = null;
        }

        if (this.bannerContainer != null)
        {
            ViewGroup parent = (ViewGroup) this.bannerContainer.getParent();
            if (parent != null)
            {
                parent.removeView(this.bannerContainer);
            }

            this.bannerContainer = null;
        }

        this.isBannerPresented = false;
    }

    private void applySystemBarInsets(Activity activity)
    {
        ViewCompat.setOnApplyWindowInsetsListener(this.bannerContainer, (view, windowInsets) ->
        {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());

            view.setPadding(
                insets.left,
                insets.top,
                insets.right,
                insets.bottom
            );

            return windowInsets;
        });

        this.bannerContainer.post(() ->
        {
            ViewCompat.requestApplyInsets(this.bannerContainer);
        });
    }

    private AdSize getAnchoredAdaptiveBannerSize(Activity activity)
    {
        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
        int adWidth = Math.round(metrics.widthPixels / metrics.density);
        return AdSize.getLargeAnchoredAdaptiveBannerAdSize(activity, adWidth);
    }

    private void notifyBannerSize(@Nullable AdSize adsize, @Nullable Activity activity)
    {
        int height = (adsize == null || activity == null) ? 0 : adsize.getHeightInPixels(activity);
        JSObject size = new JSObject();
        size.put("height", Math.max(height, 0));
        size.put("width", adView != null ? adView.getWidth() : 0);
        this.notifyListeners("bannerSizeChanged", size);
    }
}
