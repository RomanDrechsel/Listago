package de.romandrechsel.listago.admob;

import android.app.Activity;
import android.content.res.Configuration;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
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
import com.google.android.ump.ConsentDebugSettings;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import de.romandrechsel.listago.MainActivity;
import de.romandrechsel.listago.logging.Logger;

@CapacitorPlugin(name = "AdMob")
public class AdmobPlugin extends Plugin
{
    private static final String TAG = "AdmobPlugin";
    @Nullable
    private FrameLayout bannerContainer;
    @Nullable
    private AdView adView;
    private boolean isInitialized = false;
    private boolean isBannerPresented = false;
    private boolean isBannerLoaded = false;
    @Nullable
    private ConsentInformation consentInformation;

    private final int defaultInitializationTimeout = 30;
    private String lastAdId = null;
    private Boolean lastIsTesting = null;
    private Integer lastGravity = null;
    private Integer lastOrientation = null;

    @Override
    public void load()
    {
        super.load();
        MainActivity activity = (MainActivity) this.getActivity();
        if (activity != null)
        {
            activity.addConfigurationChangedListener(this::onConfigurationChanged);
        }
    }

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

        this.lastOrientation = activity.getResources().getConfiguration().orientation;
    }

    @PluginMethod
    public void RequestNewBanner(PluginCall call)
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

        this.lastAdId = adId;
        this.lastIsTesting = isTesting;
        this.lastGravity = bannerGravity;
        this.requestNewBannerInternal(adId, isTesting, bannerGravity, call, false);
    }

    @PluginMethod
    public void HideBanner(PluginCall call)
    {
        if (this.bannerContainer == null)
        {
            call.reject("No AdMob banner to hide.");
            return;
        }

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
        if (this.bannerContainer == null)
        {
            call.reject("No AdMob banner to resume.");
            return;
        }

        Activity activity = this.getActivity();

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
    public void DestroyBanner(PluginCall call)
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
        status.put("areBannersAllowed", this.consentInformation != null && this.consentInformation.canRequestAds());
        status.put("isBannerPresented", this.isBannerPresented);
        status.put("isBannerLoaded", this.adView != null && this.isBannerLoaded);
        call.resolve(status);
    }

    @PluginMethod
    public void RequestConsentInfo(PluginCall call)
    {
        Activity activity = getActivity();

        Boolean debug = call.getBoolean("debug", false);
        String testDeviceId = call.getString("testDeviceId");

        ConsentRequestParameters.Builder paramsBuilder = new ConsentRequestParameters.Builder();

        if (Boolean.TRUE.equals(debug))
        {
            ConsentDebugSettings.Builder debugBuilder = new ConsentDebugSettings.Builder(activity).setDebugGeography(ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA);

            if (testDeviceId != null && !testDeviceId.isEmpty())
            {
                debugBuilder.addTestDeviceHashedId(testDeviceId);
            }

            paramsBuilder.setConsentDebugSettings(debugBuilder.build());
        }

        this.consentInformation = UserMessagingPlatform.getConsentInformation(activity);

        activity.runOnUiThread(() ->
        {
            this.consentInformation.requestConsentInfoUpdate(
                activity,
                paramsBuilder.build(),
                () ->
                {
                    JSObject result = new JSObject();
                    result.put("canRequestAds", consentInformation.canRequestAds());
                    result.put("privacyOptionsRequired", consentInformation.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
                    result.put("status", this.convertConsentStatus(consentInformation.getConsentStatus()));
                    call.resolve(result);
                },
                formError ->
                {
                    call.reject(formError.getMessage());
                }
            );
        });
    }

    @PluginMethod
    public void LoadAndShowConsentFormIfRequired(PluginCall call)
    {
        Activity activity = getActivity();

        activity.runOnUiThread(() ->
        {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                activity,
                formError ->
                {
                    if (formError != null)
                    {
                        Logger.Error(TAG, "Could not show consent form: ", formError);
                        call.reject(formError.getMessage());
                        return;
                    }

                    ConsentInformation info = UserMessagingPlatform.getConsentInformation(activity);

                    JSObject result = new JSObject();
                    result.put("canRequestAds", info.canRequestAds());
                    result.put("status", this.convertConsentStatus(info.getConsentStatus()));
                    result.put("privacyOptionsRequired", info.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);

                    call.resolve(result);
                }
            );
        });
    }

    @PluginMethod
    public void ResetConsentInfo(PluginCall call)
    {
        Activity activity = getActivity();

        activity.runOnUiThread(() ->
        {
            UserMessagingPlatform.getConsentInformation(activity).reset();
            call.resolve();
        });
    }

    @PluginMethod
    public void ShowPrivacyOptionsForm(PluginCall call)
    {
        Activity activity = getActivity();

        activity.runOnUiThread(() ->
        {
            UserMessagingPlatform.showPrivacyOptionsForm(
                activity,
                formError ->
                {
                    if (formError != null)
                    {
                        Logger.Error(TAG, "Could not show privacy options form: ", formError);
                        call.reject(formError.getMessage());
                        return;
                    }

                    call.resolve();
                }
            );
        });
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

    private void requestNewBannerInternal(String adId, Boolean isTesting, int gravity, @Nullable PluginCall call, @Nullable Boolean hideView)
    {
        Activity activity = this.getActivity();
        activity.runOnUiThread(() ->
        {
            try
            {
                this.removeBannerInternal();

                this.bannerContainer = new FrameLayout(activity);
                this.bannerContainer.setClipToPadding(false);
                if (Boolean.TRUE.equals(hideView))
                {
                    this.bannerContainer.setVisibility(View.INVISIBLE);
                }

                FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                containerParams.gravity = gravity | Gravity.CENTER_HORIZONTAL;

                ViewGroup rootView = activity.findViewById(android.R.id.content);
                rootView.addView(this.bannerContainer, containerParams);

                this.applySystemBarInsets(activity);

                this.adView = new AdView(activity);
                this.adView.setAdUnitId(adId);

                //AdSize adSize = this.getAnchoredAdaptiveBannerSize(activity);
                AdSize adSize = AdSize.BANNER;
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
                        AdmobPlugin.this.isBannerLoaded = true;
                        AdmobPlugin.this.isBannerPresented = true;
                        JSObject loaded = new JSObject();
                        loaded.put("adId", adId);
                        loaded.put("isTesting", isTesting);
                        loaded.put("duration", System.currentTimeMillis() - startTime);
                        AdmobPlugin.this.notifyListeners("bannerLoaded", loaded);
                        AdmobPlugin.this.notifyBannerSize(AdmobPlugin.this.adView.getAdSize(), activity);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError)
                    {
                        AdmobPlugin.this.isBannerLoaded = false;
                        JSObject error = new JSObject();
                        error.put("adId", adId);
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
                        AdmobPlugin.this.isBannerLoaded = false;
                        JSObject closed = new JSObject();
                        closed.put("adId", adId);
                        closed.put("isTesting", isTesting);
                        closed.put("duration", System.currentTimeMillis() - startTime);
                        AdmobPlugin.this.notifyListeners("bannerClosed", closed);
                        AdmobPlugin.this.notifyBannerSize(new AdSize(0, 0), activity);
                    }
                });

                AdRequest request = new AdRequest.Builder().build();
                this.adView.loadAd(request);
                if (call != null)
                {
                    call.resolve();
                }
            }
            catch (Exception e)
            {
                AdmobPlugin.this.isBannerLoaded = false;
                AdmobPlugin.this.isBannerPresented = false;
                Logger.Error(TAG, "Could not show AdMob banner: ", e);
                if (call != null)
                {
                    call.reject("Could not show banner", e);
                }
            }
        });
    }

    private void applySystemBarInsets(Activity activity)
    {
        if (this.bannerContainer == null)
        {
            return;
        }

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
        int height = 0;
        int width = 0;
        if (adsize != null && activity != null)
        {
            DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
            height = adsize.getHeightInPixels(activity);
            width = adsize.getWidthInPixels(activity);
            if (height > 0)
            {
                height = Math.round(height / metrics.density);
            }
            if (width > 0)
            {
                width = Math.round(width / metrics.density);
            }
        }
        JSObject size = new JSObject();
        size.put("height", Math.max(height, 0));
        size.put("width", Math.max(width, 0));
        this.notifyListeners("bannerSizeChanged", size);
    }

    private void onConfigurationChanged(Configuration newConfig)
    {
        if (newConfig.orientation == this.lastOrientation)
        {
            return;
        }

        if (!this.isInitialized || this.adView == null || this.bannerContainer == null || this.lastAdId == null || this.lastIsTesting == null || this.lastGravity == null || !this.isBannerLoaded)
        {
            return;
        }

        this.getActivity().runOnUiThread(() ->
        {
            JSObject reload = new JSObject();
            reload.put("oldOrientation", this.lastOrientation == Configuration.ORIENTATION_PORTRAIT ? "PORTRAIT" : "LANDSCAPE");
            reload.put("newOrientation", newConfig.orientation == Configuration.ORIENTATION_PORTRAIT ? "PORTRAIT" : "LANDSCAPE");
            this.notifyListeners("bannerNewOrientation", reload);

            boolean wasVisible = this.bannerContainer.getVisibility() == android.view.View.VISIBLE;
            this.requestNewBannerInternal(this.lastAdId, this.lastIsTesting, this.lastGravity, null, !wasVisible);
        });
        this.lastOrientation = newConfig.orientation;
    }

    private String convertConsentStatus(int status)
    {
        switch (status)
        {
            case ConsentInformation.ConsentStatus.REQUIRED:
                return "REQUIRED";
            case ConsentInformation.ConsentStatus.NOT_REQUIRED:
                return "NOT_REQUIRED";
            case ConsentInformation.ConsentStatus.OBTAINED:
                return "OBTAINED";
            case ConsentInformation.ConsentStatus.UNKNOWN:
                return "UNKNOWN";
            default:
                return "EROR";
        }
    }
}
