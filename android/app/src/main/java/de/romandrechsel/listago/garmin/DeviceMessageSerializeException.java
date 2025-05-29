package de.romandrechsel.listago.garmin;

import org.jetbrains.annotations.NotNull;

import java.util.Objects;

public class DeviceMessageSerializeException extends RuntimeException
{
    public DeviceMessageSerializeException(@NotNull String message)
    {
        super(message);
    }

    @Override
    @NotNull
    public String getMessage()
    {
        return Objects.requireNonNull(super.getMessage());
    }
}
