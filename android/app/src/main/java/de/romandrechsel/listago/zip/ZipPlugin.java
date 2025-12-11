package de.romandrechsel.listago.zip;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URI;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
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
    public void Unzip(final PluginCall call)
    {
        boolean success = true;
        int num_files = 0;
        int num_dirs = 0;
        String sourcePath = call.getString("archive");
        String targetPath = call.getString("outputPath");
        JSObject ret = new JSObject();

        if (sourcePath == null || targetPath == null)
        {
            Logger.Error(TAG, "Could not unzip: sourcePath or targetPath is null");
            success = false;
        }
        else
        {
            File sourceFile;
            try
            {
                sourceFile = new File(new URI(sourcePath));
            }
            catch (Exception e)
            {
                sourceFile = new File(sourcePath);
            }
            File targetDir;
            try
            {
                targetDir = new File(new URI(targetPath));
            }
            catch (Exception e)
            {
                targetDir = new File(targetPath);
            }

            if (!sourceFile.exists())
            {
                Logger.Error(TAG, "Could not unzip: source file '" + sourceFile.getAbsolutePath() + "' does not exist");
                success = false;
            }
            else
            {
                if (!targetDir.exists())
                {
                    boolean create = targetDir.mkdirs();
                    if (!create)
                    {
                        Logger.Error(TAG, "Could not unzip: output directory '" + targetDir.getAbsolutePath() + "' could not be created");
                        success = false;
                    }
                    else
                    {
                        FileInputStream fis;
                        try
                        {
                            fis = new FileInputStream(sourceFile);
                        }
                        catch (Exception e)
                        {
                            Logger.Error(TAG, "Could not unzip: could not open source file '" + sourceFile.getAbsolutePath() + "': " + e.getMessage());
                            ret.put("success", false);
                            call.resolve(ret);
                            return;
                        }
                        ZipInputStream zis = new ZipInputStream(new BufferedInputStream(fis));
                        ZipEntry entry = null;
                        byte[] buffer = new byte[4096];

                        do
                        {
                            try
                            {
                                entry = zis.getNextEntry();
                            }
                            catch (Exception e)
                            {
                                Logger.Error(TAG, "Could not unzip: could not read zip entry: " + e.getMessage());
                                success = false;
                            }

                            if (entry != null)
                            {
                                File outFile = new File(targetDir, entry.getName());

                                if (entry.isDirectory())
                                {
                                    create = outFile.mkdirs();
                                    if (!create)
                                    {
                                        Logger.Error(TAG, "Could not unzip: output directory '" + outFile.getAbsolutePath() + "' could not be created");
                                        success = false;
                                    }
                                    else
                                    {
                                        num_dirs++;
                                    }
                                }
                                else
                                {
                                    File parent = outFile.getParentFile();
                                    if (parent != null && !parent.exists())
                                    {
                                        create = parent.mkdirs();
                                        if (!create)
                                        {
                                            Logger.Error(TAG, "Could not unzip: output directory '" + parent.getAbsolutePath() + "' could not be created");
                                            success = false;
                                            continue;
                                        }
                                        else
                                        {
                                            num_dirs++;
                                        }
                                    }

                                    FileOutputStream fos;
                                    try
                                    {

                                        fos = new FileOutputStream(outFile);
                                    }
                                    catch (Exception e)
                                    {
                                        Logger.Error(TAG, "Could not unzip: could not open output file '" + outFile.getAbsolutePath() + "': " + e.getMessage());
                                        success = false;
                                        continue;
                                    }

                                    int len;
                                    try
                                    {
                                        while ((len = zis.read(buffer)) > 0)
                                        {
                                            fos.write(buffer, 0, len);
                                        }
                                        fos.close();
                                        num_files++;
                                    }
                                    catch (Exception e)
                                    {
                                        Logger.Error(TAG, "Could not unzip: could not read zip entry: " + e.getMessage());
                                        success = false;
                                        continue;
                                    }
                                }
                                try
                                {
                                    zis.closeEntry();
                                }
                                catch (Exception e)
                                {
                                    Logger.Error(TAG, "Could not unzip: could not close zip entry: " + e.getMessage());
                                    success = false;
                                }
                            }
                        }
                        while (entry != null);
                    }
                }
            }
        }

        ret.put("success", success);
        ret.put("path", targetPath);
        ret.put("numFiles", num_files);
        ret.put("numFolders", num_dirs);
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
