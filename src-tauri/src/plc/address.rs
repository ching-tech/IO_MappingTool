#[derive(Debug, Clone)]
pub enum PlcDevice {
    Word { prefix: String, num: u32 },
    Bool { prefix: String, num: u32 },
    BitInWord { prefix: String, num: u32, bit: u8 },
}

/// Parse address strings like: DM100, DM100.5, M5, MR3, W10, R20, B5, D100
pub fn parse_device_address(s: &str, is_keyence: bool) -> Option<PlcDevice> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }

    // Check for bit-in-word syntax: e.g. DM100.5
    if let Some(dot_pos) = s.rfind('.') {
        let word_part = &s[..dot_pos];
        let bit_part = &s[dot_pos + 1..];
        if let Ok(bit) = bit_part.parse::<u8>() {
            if bit < 16 {
                if let Some(PlcDevice::Word { prefix, num }) = parse_device_address(word_part, is_keyence) {
                    return Some(PlcDevice::BitInWord { prefix, num, bit });
                }
            }
        }
        return None;
    }

    // Find where the numeric part starts
    let alpha_end = s.find(|c: char| c.is_ascii_digit()).unwrap_or(s.len());
    if alpha_end == 0 || alpha_end == s.len() {
        return None;
    }

    let prefix = s[..alpha_end].to_uppercase();
    let num_str = &s[alpha_end..];
    let num = num_str.parse::<u32>().ok()?;

    // Classify by prefix
    match prefix.as_str() {
        // Word devices (KEYENCE & Mitsubishi, excluding R which is conditional)
        "DM" | "D" | "W" | "TN" | "CN" | "SD" | "ZR" | "FM" => {
            Some(PlcDevice::Word { prefix, num })
        }
        // Bit-only devices (KEYENCE & Mitsubishi)
        "M" | "MR" | "LR" | "B" | "F" | "V" | "TC" | "CC" | "SB" | "SM" => {
            Some(PlcDevice::Bool { prefix, num })
        }
        // R is a Bit device for KEYENCE, but a Word device for Mitsubishi
        "R" => {
            if is_keyence {
                Some(PlcDevice::Bool { prefix, num })
            } else {
                Some(PlcDevice::Word { prefix, num })
            }
        }
        _ => None,
    }
}
