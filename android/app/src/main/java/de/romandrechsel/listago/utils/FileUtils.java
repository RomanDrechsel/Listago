package de.romandrechsel.listago.utils;

import java.io.File;

import de.romandrechsel.listago.logging.Logger;

public class FileUtils {
    public static final String TAG = "FileUtils";

    public static class DeleteDirResult {
        public boolean Success;
        public int Directories;
        public int Files;
        public long Size;

        public DeleteDirResult() {
            this.Success = true;
            this.Directories = 0;
            this.Files = 0;
            this.Size = 0;
        }

        public void Add(DeleteDirResult other) {
            if (!other.Success) {
                this.Success = false;
            }
            this.Directories += (Math.max(other.Directories, 0));
            this.Files += (Math.max(other.Files, 0));
            this.Size += (Math.max(other.Size, 0));
        }
    }

    public static DeleteDirResult DeleteDirectory(File dir, boolean delete_if_empty) {
        DeleteDirResult result = new DeleteDirResult();
        if (dir != null && dir.isDirectory()) {
            boolean deleted_all = true;
            String[] children = null;
            try {
                children = dir.list();
            } catch (Exception ex) {
                Logger.Error(TAG, "Could not list directory " + dir.getAbsolutePath());
                result.Success = false;
            }
            if (children != null) {
                for (String child : children) {
                    DeleteDirResult del = FileUtils.DeleteDirectory(new File(dir, child), true);
                    result.Add(del);
                    if (!del.Success) {
                        deleted_all = false;
                    }
                }
            }
            if (deleted_all) {
                if (delete_if_empty && dir.delete()) {
                    result.Directories++;
                }
            } else {
                result.Success = false;
            }
        } else if (dir != null && dir.isFile()) {
            long size = dir.length();
            if (dir.delete()) {
                result.Files++;
                result.Size += size;
            } else {
                result.Success = false;
            }
        } else {
            result.Success = false;
        }
        return result;
    }
}
