package de.romandrechsel.listago.share;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Parcelable;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "SharePlugin")
public class SharePlugin extends Plugin
{
    private static final String TAG = "SharePlugin";

    @PluginMethod
    public void SendEmail(PluginCall call) throws JSONException
    {
        JSObject ret = new JSObject();

        String receiver = call.getString("receiver", null);
        String subject = call.getString("subject", null);
        String body = call.getString("body", null);
        JSArray attachments = call.getArray("attachments", null);
        String chooserTitle = call.getString("chooserTitle", null);

        ArrayList<Uri> uris = new ArrayList<>();
        if (attachments != null)
        {
            List<Object> paths = attachments.toList();
            for (Object path : paths)
            {
                Uri uri = Uri.parse(path.toString());
                if (uri.getPath() != null)
                {
                    File file = new File(uri.getPath());
                    if (file.exists())
                    {
                        Uri contentUri = FileProvider.getUriForFile(this.getContext(), this.getContext().getPackageName() + ".fileprovider", file);
                        uris.add(contentUri);
                    }
                }

            }
        }

        PackageManager pm = this.getContext().getPackageManager();
        Intent probe = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"));
        List<ResolveInfo> emailApps = pm.queryIntentActivities(probe, 0);

        if (emailApps.isEmpty())
        {
            ret.put("success", false);
            ret.put("message", "No email app found");
        }
        else
        {
            ArrayList<Intent> targetedIntents = new ArrayList<>();

            for (ResolveInfo info : emailApps)
            {
                Intent targeted;
                if (uris.size() > 1)
                {
                    targeted = new Intent(Intent.ACTION_SEND_MULTIPLE);
                    targeted.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                }
                else if (!uris.isEmpty())
                {
                    targeted = new Intent(Intent.ACTION_SEND);
                    targeted.putExtra(Intent.EXTRA_STREAM, uris.get(0));
                }
                else
                {
                    targeted = new Intent(Intent.ACTION_SEND);
                }

                targeted.setType("*/*");
                targeted.putExtra(Intent.EXTRA_EMAIL, new String[]{receiver});
                targeted.putExtra(Intent.EXTRA_SUBJECT, subject);
                targeted.putExtra(Intent.EXTRA_TEXT, body);
                targeted.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                targeted.setPackage(info.activityInfo.packageName);

                targetedIntents.add(targeted);
            }

            if (!targetedIntents.isEmpty())
            {
                Intent firstIntent = targetedIntents.remove(0);
                Intent chooser = Intent.createChooser(firstIntent, chooserTitle);

                if (!targetedIntents.isEmpty())
                {
                    Parcelable[] extraIntents = targetedIntents.toArray(new Parcelable[0]);
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents);
                }

                getContext().startActivity(chooser);
            }
        }

        ret.put("success", true);
        call.resolve(ret);
    }
}
