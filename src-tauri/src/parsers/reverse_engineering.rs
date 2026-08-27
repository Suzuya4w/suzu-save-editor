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
            "zlib" => {
                let mut zlib_start = 0;
                for i in 0..data.len() - 1 {
                    if data[i] == 0x78
                        && (data[i + 1] == 0x9C
                            || data[i + 1] == 0xDA
                            || data[i + 1] == 0x01
                            || data[i + 1] == 0x5E)
                    {
                        zlib_start = i;
                        break;
                    }
                }
                
                let mut decoder = ZlibDecoder::new(&data[zlib_start..]);
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
