use flate2::read::{GzDecoder, ZlibDecoder};
use std::io::Read;

pub struct RevEngUtils;

impl RevEngUtils {
    pub fn calculate_entropy(data: &[u8]) -> f64 {
        if data.is_empty() {
            return 0.0;
        }
        let mut frequencies = [0usize; 256];
        for &byte in data {
            frequencies[byte as usize] += 1;
        }

        let mut entropy = 0.0;
        let len = data.len() as f64;

        for &count in &frequencies {
            if count > 0 {
                let p = count as f64 / len;
                entropy -= p * p.log2();
            }
        }
        entropy
    }

    pub fn extract_strings(data: &[u8], min_len: usize, show_letters: bool, show_digits: bool, show_symbols: bool) -> Vec<String> {
        let mut strings = Vec::new();
        let mut current_string = String::new();

        for &byte in data {
            let is_letter = byte.is_ascii_alphabetic();
            let is_digit = byte.is_ascii_digit();
            let is_printable = byte >= 32 && byte <= 126;
            let is_symbol = is_printable && !is_letter && !is_digit;

            let is_valid = (is_letter && show_letters) || (is_digit && show_digits) || (is_symbol && show_symbols);

            if is_valid {
                current_string.push(byte as char);
            } else {
                if current_string.len() >= min_len {
                    strings.push(current_string.clone());
                }
                current_string.clear();
            }
        }
        if current_string.len() >= min_len {
            strings.push(current_string);
        }

        strings
    }

    pub fn auto_guess_xor_key(data: &[u8]) -> Vec<u8> {
        if data.is_empty() { return vec![]; }
        let mut frequencies = [0usize; 256];
        for &byte in data {
            frequencies[byte as usize] += 1;
        }
        let mut max_freq = 0;
        let mut most_freq_byte = 0;
        for (i, &count) in frequencies.iter().enumerate() {
            if count > max_freq {
                max_freq = count;
                most_freq_byte = i as u8;
            }
        }
        // Asumsi: byte yang paling sering muncul di file biner biasanya adalah 0x00.
        // Jika Plaintext = 0x00, maka Ciphertext = 0x00 ^ Key = Key.
        // Jadi most_freq_byte kemungkinan besar adalah kuncinya (untuk single-byte XOR).
        vec![most_freq_byte]
    }

    pub fn auto_heal_header(data: &[u8]) -> Result<Vec<u8>, String> {
        let max_scan = std::cmp::min(data.len(), 1024);
        for i in 0..max_scan.saturating_sub(1) {
            // ZLIB (78 9C, 78 DA, 78 01, 78 5E)
            if data[i] == 0x78 && (data[i+1] == 0x9C || data[i+1] == 0xDA || data[i+1] == 0x01 || data[i+1] == 0x5E) {
                return Ok(data[i..].to_vec());
            }
            // GZIP (1F 8B)
            if data[i] == 0x1F && data[i+1] == 0x8B {
                return Ok(data[i..].to_vec());
            }
            // ZIP / PK (50 4B 03 04)
            if i + 3 < max_scan && data[i] == 0x50 && data[i+1] == 0x4B && data[i+2] == 0x03 && data[i+3] == 0x04 {
                return Ok(data[i..].to_vec());
            }
            // JSON ( {" atau [{ )
            if (data[i] == b'{' && data[i+1] == b'"') || (data[i] == b'[' && data[i+1] == b'{') {
                return Ok(data[i..].to_vec());
            }
        }
        Err("No known magic signatures (Zlib, Gzip, Zip, JSON) found in the first 1024 bytes.".to_string())
    }

    pub fn xor_decrypt(data: &[u8], key: &[u8]) -> Vec<u8> {
        if key.is_empty() {
            return data.to_vec();
        }
        data.iter()
            .enumerate()
            .map(|(i, &byte)| byte ^ key[i % key.len()])
            .collect()
    }

    pub fn decompress_payload(data: &[u8], method: &str) -> Result<Vec<u8>, String> {
        let mut decompressed = Vec::new();
        match method {
            "zlib" | "zlib_utf8" => {
                let actual_data = if method == "zlib_utf8" {
                    let utf8_str = std::str::from_utf8(data).map_err(|e| format!("Not valid UTF-8: {}", e))?;
                    let mut fixed = Vec::with_capacity(utf8_str.len());
                    for c in utf8_str.chars() {
                        if c as u32 > 255 {
                            return Err(format!("Cannot fix UTF-8: contains codepoint > 255 ({})", c as u32));
                        }
                        fixed.push(c as u8);
                    }
                    fixed
                } else {
                    data.to_vec()
                };

                let mut zlib_start = 0;
                for i in 0..actual_data.len().saturating_sub(1) {
                    if actual_data[i] == 0x78
                        && (actual_data[i + 1] == 0x9C
                            || actual_data[i + 1] == 0xDA
                            || actual_data[i + 1] == 0x01
                            || actual_data[i + 1] == 0x5E)
                    {
                        zlib_start = i;
                        break;
                    }
                }
                
                let mut decoder = ZlibDecoder::new(&actual_data[zlib_start..]);
                decoder
                    .read_to_end(&mut decompressed)
                    .map_err(|e| format!("Zlib Error: {}", e))?;
                Ok(decompressed)
            }
            "gzip" => {
                let mut decoder = GzDecoder::new(data);
                decoder
                    .read_to_end(&mut decompressed)
                    .map_err(|e| format!("Gzip Error: {}", e))?;
                Ok(decompressed)
            }
            _ => Err("Unsupported compression method".to_string()),
        }
    }
}
