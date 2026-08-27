-- Suzu Save Editor - Example Lua Parser
-- Place this file in the 'scripts' folder of the application

-- 1. Metadata function
-- Returns a JSON string containing the plugin information
function metadata()
    return [[{
        "name": "Example Save Parser",
        "version": "1.0.0",
        "author": "Modder Name",
        "description": "A basic example showing how to read and write save files."
    }]]
end

-- 2. Detect function
-- Receives: bytes (an array of numbers representing the file's bytes)
-- Returns: true if the plugin can parse this file, false otherwise
function detect(bytes)
    -- As a simple example, let's assume our save file always starts with the ASCII letters "SAVE"
    -- 'S' = 83, 'A' = 65, 'V' = 86, 'E' = 69
    if #bytes < 4 then return false end
    
    return bytes[1] == 83 and bytes[2] == 65 and bytes[3] == 86 and bytes[4] == 69
end

-- 3. Parse function
-- Receives: bytes (an array of numbers)
-- Returns: a Lua table containing the extracted data. This will be automatically converted to JSON for the UI.
function parse_to_json(bytes)
    -- In a real scenario, you would extract numbers and strings based on offsets.
    -- Here we just return mock data for demonstration purposes.
    
    local parsed_data = {
        player_name = "Suzuya",
        level = 50,
        resources = {
            gold = 10000,
            gems = 500
        }
    }
    
    return parsed_data
end

-- 4. Encode function
-- Receives: json_table (a Lua table containing the data sent back from the UI)
-- Returns: an array of numbers representing the new binary file bytes
function json_to_binary(json_table)
    -- In a real scenario, you would rebuild the byte array using the data from json_table.
    -- We'll just write our "SAVE" magic header, followed by some dummy bytes.
    
    local new_bytes = {}
    
    -- Write "SAVE" header
    table.insert(new_bytes, 83) -- S
    table.insert(new_bytes, 65) -- A
    table.insert(new_bytes, 86) -- V
    table.insert(new_bytes, 69) -- E
    
    -- (Write your serialized data here)
    -- For example, you can print values to see what the UI sent back:
    -- print("Saving new level: " .. json_table.level)
    
    return new_bytes
end
