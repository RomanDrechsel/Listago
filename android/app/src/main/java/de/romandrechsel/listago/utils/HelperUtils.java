package de.romandrechsel.listago.utils;

import androidx.annotation.Nullable;

public class HelperUtils
{
    @Nullable
    public static Long toLong(String str)
    {
        if (str == null || str.isEmpty())
        {
            return null;
        }

        try
        {
            return Long.parseLong(str);
        }
        catch (NumberFormatException ex)
        {
            return null;
        }
    }
}
