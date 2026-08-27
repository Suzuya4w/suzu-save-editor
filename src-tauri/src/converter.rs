use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write, Seek, SeekFrom};
use std::path::{Path, PathBuf};

/// Strips the first N bytes from a file and saves it as `[filename]_suzu_stripped.[ext]`
#[tauri::command]
pub async fn strip_save_header(file_path: String, bytes_to_strip: usize) -> Result<String, String> {
    let input_path = Path::new(&file_path);
    if !input_path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let output_path = generate_output_path(input_path, "_suzu_stripped");

    let mut in_file = BufReader::new(File::open(input_path).map_err(|e| e.to_string())?);
    let mut out_file = BufWriter::new(File::create(&output_path).map_err(|e| e.to_string())?);

    // Skip the first N bytes
    in_file.seek(SeekFrom::Start(bytes_to_strip as u64)).map_err(|e| e.to_string())?;

    // Copy the rest
    std::io::copy(&mut in_file, &mut out_file).map_err(|e| e.to_string())?;

    Ok(output_path.to_string_lossy().to_string())
}

/// Prepends a hex string to a file and saves it as `[filename]_suzu_injected.[ext]`
#[tauri::command]
pub async fn inject_save_header(file_path: String, hex_string_header: String) -> Result<String, String> {
    let input_path = Path::new(&file_path);
    if !input_path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    // Clean up the hex string (remove spaces, commas, "0x")
    let cleaned_hex = hex_string_header
        .replace(" ", "")
        .replace(",", "")
        .replace("0x", "")
        .replace("0X", "");

    // Decode hex
    let header_bytes = hex::decode(&cleaned_hex).map_err(|e| format!("Invalid hex string: {}", e))?;

    let output_path = generate_output_path(input_path, "_suzu_injected");

    let mut in_file = BufReader::new(File::open(input_path).map_err(|e| e.to_string())?);
    let mut out_file = BufWriter::new(File::create(&output_path).map_err(|e| e.to_string())?);

    // Write the injected header first
    out_file.write_all(&header_bytes).map_err(|e| e.to_string())?;

    // Append the original file contents
    std::io::copy(&mut in_file, &mut out_file).map_err(|e| e.to_string())?;

    Ok(output_path.to_string_lossy().to_string())
}

/// Swaps the endianness in chunks (e.g. 2, 4, 8 bytes) and saves as `[filename]_suzu_endian.[ext]`
#[tauri::command]
pub async fn swap_endianness(file_path: String, chunk_size: usize) -> Result<String, String> {
    if chunk_size < 2 {
        return Err("Chunk size must be at least 2".to_string());
    }

    let input_path = Path::new(&file_path);
    if !input_path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let output_path = generate_output_path(input_path, "_suzu_endian");

    let mut in_file = BufReader::new(File::open(input_path).map_err(|e| e.to_string())?);
    let mut out_file = BufWriter::new(File::create(&output_path).map_err(|e| e.to_string())?);

    // Read the whole file into memory since saves are usually small enough, 
    // but doing it in a buffer stream is better for safety. Let's do streaming.
    let mut buffer = vec![0; 1024 * 64]; // 64KB buffer
    let mut remainder: Vec<u8> = Vec::new();

    loop {
        let bytes_read = in_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }

        let mut data_to_process = Vec::new();
        data_to_process.append(&mut remainder);
        data_to_process.extend_from_slice(&buffer[..bytes_read]);

        // 1. Calculate remainder size
        let remainder_len = data_to_process.len() % chunk_size;
        let safe_len = data_to_process.len() - remainder_len;
        
        // 2. Split data into processable part and remainder without copying
        let (to_process, rest) = data_to_process.split_at_mut(safe_len);
        
        // 3. Reverse in-place
        for chunk in to_process.chunks_exact_mut(chunk_size) {
            chunk.reverse();
        }

        // 4. Write processed data directly
        out_file.write_all(to_process).map_err(|e| e.to_string())?;

        // 5. Store remainder for next loop iteration
        remainder = rest.to_vec();
    }

    // Write any leftover bytes exactly as they were (we can't reverse a partial chunk safely)
    if !remainder.is_empty() {
        out_file.write_all(&remainder).map_err(|e| e.to_string())?;
    }

    Ok(output_path.to_string_lossy().to_string())
}

/// Helper function to generate an output file path with a suffix
fn generate_output_path(input_path: &Path, suffix: &str) -> PathBuf {
    let mut output_path = input_path.to_path_buf();
    let file_stem = input_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let extension = input_path
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_else(|| "".to_string());

    let new_file_name = if extension.is_empty() {
        format!("{}{}", file_stem, suffix)
    } else {
        format!("{}{}.{}", file_stem, suffix, extension)
    };

    output_path.set_file_name(new_file_name);
    output_path
}
