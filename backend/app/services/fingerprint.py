import re
import hashlib
from typing import Optional, List, Dict, Any

UUID_REGEX = re.compile(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')
HEX_REGEX = re.compile(r'\b0x[0-9a-fA-F]+\b|\b[0-9a-fA-F]{16,64}\b')
NUM_REGEX = re.compile(r'\b\d+\b')
URL_QUERY_REGEX = re.compile(r'\?.*$')
FILE_HASH_REGEX = re.compile(r'\.[a-f0-9]{8,32}\.(js|css|ts)')

def normalize_error_message(message: str) -> str:
    """
    Sanitizes dynamic parameters from error messages (UUIDs, IDs, numbers, hashes)
    so identical errors group together properly.
    """
    if not message:
        return "Unknown Error"
    
    msg = message.strip()
    # Replace UUIDs
    msg = UUID_REGEX.sub('<UUID>', msg)
    # Replace Hex / Hashes
    msg = HEX_REGEX.sub('<HASH>', msg)
    # Replace standalone numbers
    msg = NUM_REGEX.sub('<NUM>', msg)
    return msg

def normalize_stack_frame(frame: str) -> str:
    """
    Strips query strings, chunk hashes, and column numbers from a stack frame string.
    """
    cleaned = URL_QUERY_REGEX.sub('', frame.strip())
    cleaned = FILE_HASH_REGEX.sub('.[hash].\\1', cleaned)
    # Remove exact line:col numbers at the end of files (e.g., app.js:123:45 -> app.js)
    cleaned = re.sub(r':\d+:\d+', '', cleaned)
    cleaned = re.sub(r':\d+', '', cleaned)
    return cleaned

def generate_error_fingerprint(error_type: str, message: str, raw_stack: Optional[str] = None) -> str:
    """
    Generates a deterministic SHA-256 fingerprint from error type, normalized message,
    and top normalized stack frames.
    """
    norm_type = (error_type or "Error").strip()
    norm_msg = normalize_error_message(message)
    
    stack_sig = ""
    if raw_stack:
        lines = [line.strip() for line in raw_stack.split('\n') if line.strip()]
        # Take top 3 stack frames ignoring node_modules if possible
        frames = []
        for line in lines:
            if line.startswith("at ") or "@" in line:
                frames.append(normalize_stack_frame(line))
                if len(frames) >= 3:
                    break
        stack_sig = "|".join(frames)
    
    raw_signature = f"{norm_type}::{norm_msg}::{stack_sig}"
    return hashlib.sha256(raw_signature.encode('utf-8')).hexdigest()
