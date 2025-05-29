package de.romandrechsel.listago.garmin;

import com.google.gson.Gson;

import java.util.HashMap;
import java.util.Map;

public class DeviceMessage
{
    public int Size = 0;
    public Map<String, Object> Message = new HashMap<>();

    public String Json()
    {
        return new Gson().toJson(this.Message);
    }
}
