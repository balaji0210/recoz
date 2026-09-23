import json
import re
from typing import List, Dict, Any, Optional

BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
B64_MAP = {char: i for i, char in enumerate(BASE64_CHARS)}

def decode_vlq_mappings(mappings_str: str) -> List[List[List[int]]]:
    """
    Decodes Source Map v3 VLQ mappings string into integer segment lists.
    Format per generated line: [ [gen_col, src_idx, orig_line, orig_col, name_idx?], ... ]
    """
    lines = mappings_str.split(';')
    decoded_lines = []
    
    src_idx = 0
    orig_line = 0
    orig_col = 0
    name_idx = 0
    
    for line in lines:
        if not line:
            decoded_lines.append([])
            continue
            
        segments = line.split(',')
        decoded_segments = []
        gen_col = 0
        
        for seg in segments:
            if not seg:
                continue
            values = []
            shift = 0
            value = 0
            
            for char in seg:
                if char not in B64_MAP:
                    continue
                digit = B64_MAP[char]
                continuation = digit & 32
                digit &= 31
                value += digit << shift
                shift += 5
                
                if not continuation:
                    negate = value & 1
                    value >>= 1
                    values.append(-value if negate else value)
                    value = 0
                    shift = 0
                    
            if not values:
                continue
                
            gen_col += values[0]
            
            if len(values) >= 4:
                src_idx += values[1]
                orig_line += values[2]
                orig_col += values[3]
                
                seg_res = [gen_col, src_idx, orig_line, orig_col]
                if len(values) >= 5:
                    name_idx += values[4]
                    seg_res.append(name_idx)
                decoded_segments.append(seg_res)
            else:
                decoded_segments.append([gen_col])
                
        decoded_lines.append(decoded_segments)
        
    return decoded_lines

class SourceMapSymbolicator:
    def __init__(self, raw_map_json: str):
        self.map_data = json.loads(raw_map_json)
        self.sources = self.map_data.get("sources", [])
        self.sources_content = self.map_data.get("sourcesContent", [])
        self.names = self.map_data.get("names", [])
        self.decoded_mappings = decode_vlq_mappings(self.map_data.get("mappings", ""))

    def lookup(self, line: int, col: int) -> Optional[Dict[str, Any]]:
        """
        Looks up original file, line, and column for a 1-indexed generated line and 0-indexed column.
        """
        line_idx = line - 1
        if line_idx < 0 or line_idx >= len(self.decoded_mappings):
            return None
            
        segments = self.decoded_mappings[line_idx]
        if not segments:
            return None
            
        # Binary search or scan for nearest generated column <= col
        best_seg = None
        for seg in segments:
            if len(seg) >= 4:
                if seg[0] <= col:
                    best_seg = seg
                else:
                    break
                    
        if not best_seg or len(best_seg) < 4:
            return None
            
        src_file_idx = best_seg[1]
        orig_line = best_seg[2] + 1  # convert to 1-indexed
        orig_col = best_seg[3]
        
        orig_file = self.sources[src_file_idx] if 0 <= src_file_idx < len(self.sources) else "unknown"
        function_name = None
        if len(best_seg) >= 5 and 0 <= best_seg[4] < len(self.names):
            function_name = self.names[best_seg[4]]
            
        source_code_snippet = None
        if 0 <= src_file_idx < len(self.sources_content) and self.sources_content[src_file_idx]:
            code_lines = self.sources_content[src_file_idx].split('\n')
            start = max(0, orig_line - 3)
            end = min(len(code_lines), orig_line + 2)
            source_code_snippet = [
                {"line": i + 1, "code": code_lines[i], "is_error_line": (i + 1 == orig_line)}
                for i in range(start, end)
            ]
            
        return {
            "source": orig_file,
            "line": orig_line,
            "column": orig_col,
            "name": function_name,
            "context": source_code_snippet
        }

def parse_stack_frames(raw_stack: str) -> List[Dict[str, Any]]:
    """
    Parses V8 / standard JavaScript stack trace lines into structured frames.
    Example line: 'at handleClick (http://localhost:5173/assets/app.js:45:12)'
    """
    frames = []
    lines = raw_stack.split('\n')
    
    # Regex matching 'at funcName (url_or_file:line:col)' or 'at url_or_file:line:col'
    frame_with_func = re.compile(r'^\s*at\s+(?P<func>[^\(\s]+)\s+\((?P<file>.+?):(?P<line>\d+):(?P<col>\d+)\)')
    frame_without_func = re.compile(r'^\s*at\s+(?P<file>.+?):(?P<line>\d+):(?P<col>\d+)')
    
    for line in lines:
        match = frame_with_func.search(line)
        if match:
            frames.append({
                "function": match.group("func") or "<anonymous>",
                "filename": match.group("file"),
                "lineno": int(match.group("line")),
                "colno": int(match.group("col")),
                "raw": line.strip()
            })
            continue

        match = frame_without_func.search(line)
        if match:
            frames.append({
                "function": "<anonymous>",
                "filename": match.group("file"),
                "lineno": int(match.group("line")),
                "colno": int(match.group("col")),
                "raw": line.strip()
            })
            continue

        if line.strip().startswith("at "):
            frames.append({
                "function": "<anonymous>",
                "filename": "unknown",
                "lineno": 0,
                "colno": 0,
                "raw": line.strip()
            })
    return frames
