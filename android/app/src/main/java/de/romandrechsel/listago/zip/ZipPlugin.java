package de.romandrechsel.listago.zip;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import de.romandrechsel.listago.logging.Logger;

@CapacitorPlugin(name = "ZipPlugin")
public class ZipPlugin extends Plugin
{
    private static final String TAG = "ZipPlugin";

    @Nullable
    private ByteArrayOutputStream _baos;
    @Nullable
    private ZipOutputStream _zos;

    @PluginMethod
    public void Zip(@NonNull final PluginCall call)
    {
        boolean success = false;
        try
        {
            this._baos = new ByteArrayOutputStream();
            this._zos = new ZipOutputStream(this._baos);

            Integer level = call.getInt("level", null);
            this._zos.setLevel(Objects.requireNonNullElse(level, 6));
            this._zos.setMethod(ZipOutputStream.DEFLATED);
            success = true;
        }
        catch (Exception e)
        {
            Logger.Error(TAG, "Cound not create zip stream: " + e.getMessage());
        }

        JSObject ret = new JSObject();
        ret.put("success", success);
        call.resolve(ret);
    }

    @PluginMethod
    public void addFile(final PluginCall call)
    {
        boolean success = false;
        String filename = call.getString("filename", null);
        String content = call.getString("content", null);
        if (this._zos == null)
        {
            Logger.Error(TAG, "Could not add file: zip stream is not initialized");
        }
        else
        {
            if (filename == null || content == null)
            {
                Logger.Error(TAG, "Could not add file: filename or content is null");
            }
            else
            {
                try
                {
                    ZipEntry entry = new ZipEntry(filename);
                    this._zos.putNextEntry(entry);
                    this._zos.write(content.getBytes());
                    this._zos.closeEntry();
                    success = true;
                }
                catch (IOException e)
                {
                    Logger.Error(TAG, "Could not add file to zip archive: " + e.getMessage());
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("path", filename);
        call.resolve(ret);
    }

    @PluginMethod
    public void Store(final PluginCall call)
    {
        boolean success = false;
        String outputPath = call.getString("filename");

        if (this._zos == null || this._baos == null)
        {
            Logger.Error(TAG, "Could not add file: zip stream is not initialized");
        }
        else
        {
            if (outputPath == null)
            {
                Logger.Error(TAG, "Could not store zip archive: filename is null");
            }
            else
            {
                File cacheDir = getContext().getCacheDir();
                File finalOutputFile = new File(cacheDir, outputPath);
                File parentDir = finalOutputFile.getParentFile();

                boolean dirExists = false;
                if (parentDir != null && !parentDir.exists())
                {
                    if (!parentDir.mkdirs())
                    {
                        Logger.Error(TAG, "Could not create directory for zip archive: " + parentDir.getAbsolutePath());
                    }
                    else
                    {
                        dirExists = true;
                    }
                }

                if (dirExists)
                {
                    try
                    {
                        this._zos.close();
                        byte[] zipBytes = this._baos.toByteArray();
                        FileOutputStream fos = new FileOutputStream(finalOutputFile);
                        fos.write(zipBytes);
                        fos.close();
                        success = true;
                    }
                    catch (IOException e)
                    {
                        Logger.Error(TAG, "Could not store zip archive in '" + outputPath + "': " + e.getMessage());
                    }
                }
            }
        }

        this._zos = null;
        this._baos = null;

        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("path", outputPath);
        call.resolve(ret);
    }

    @PluginMethod
    public void Clear(PluginCall call)
    {
        if (this._zos != null)
        {
            this._zos = null;
        }
        if (this._baos != null)
        {
            this._baos = null;
        }
        call.resolve();
    }
}
