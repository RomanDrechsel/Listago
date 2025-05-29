package de.romandrechsel.listago.logging;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;

import de.romandrechsel.listago.garmin.ConnectIQPlugin;

public class Logger
{
    public static ConnectIQPlugin Plugin = null
        ;
    public static void Debug(@NonNull String tag, @NonNull String message, Object obj)
    {
        Logger.SendLog("debug", tag, message, obj);
        Log.d(tag, message);
    }

    public static void Debug(@NonNull String tag, @NonNull String message)
    {
        Logger.Debug(tag, message, null);
    }

    public static void Notice(@NonNull String tag, @NonNull String message, Object obj)
    {
        Logger.SendLog("notice", tag, message, obj);
        Log.i(tag, message);
    }

    public static void Notice(@NonNull String tag, @NonNull String message)
    {
        Logger.Notice(tag, message, null);
    }

    public static void Important(@NonNull String tag, @NonNull String message, Object obj)
    {
        Logger.SendLog("important", tag, message, obj);
        Log.w(tag, message);
    }

    public static void Important(@NonNull String tag, @NonNull String message)
    {
        Logger.Important(tag, message, null);
    }

    public static void Error(@NonNull String tag, @NonNull String message, Object obj)
    {
        Logger.SendLog("error", tag, message, obj);
        Log.e(tag, message);

    }

    public static void Error(@NonNull String tag, @NonNull String message)
    {
        Logger.Error(tag, message, null);
    }

    private static void SendLog(@NonNull String level, @NonNull String tag, @NonNull String message, @Nullable Object obj)
    {
        JSObject log = new JSObject();
        log.put("level", level);
        log.put("tag", tag);
        log.put("message", message);
        if (obj != null)
        {
            log.put("obj", obj);
        }

        if (Logger.Plugin != null)
        {
            Logger.Plugin.emitJsEvent("LOG", log);
        }
    }
}
