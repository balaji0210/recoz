from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

class TraceAnalyzer:
    def assemble_waterfall(self, spans: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Builds a hierarchical tree from a flat list of spans, calculates relative offsets,
        depth levels, and automatically identifies the Root Cause Bottleneck / Failure.
        """
        if not spans:
            return {"root": None, "spans": [], "summary": {}, "root_cause_hint": None}

        # Convert start times to timestamps for comparison
        parsed_spans = []
        min_start_ms = float('inf')
        max_end_ms = float('-inf')

        for s in spans:
            st = s["start_time"].timestamp() * 1000 if isinstance(s["start_time"], datetime) else s["start_time"]
            et = s["end_time"].timestamp() * 1000 if isinstance(s["end_time"], datetime) else s["end_time"]
            min_start_ms = min(min_start_ms, st)
            max_end_ms = max(max_end_ms, et)
            
            parsed_spans.append({
                **s,
                "start_ms": st,
                "end_ms": et,
                "duration_ms": round(s.get("duration_ms", et - st), 2),
                "children": []
            })

        total_trace_duration = max(1.0, max_end_ms - min_start_ms)

        # Build ID lookup
        span_by_id = {s["span_id"]: s for s in parsed_spans}
        roots = []

        for s in parsed_spans:
            s["offset_ms"] = round(s["start_ms"] - min_start_ms, 2)
            s["offset_percent"] = round((s["offset_ms"] / total_trace_duration) * 100, 2)
            s["duration_percent"] = max(0.5, round((s["duration_ms"] / total_trace_duration) * 100, 2))

            parent_id = s.get("parent_span_id")
            if parent_id and parent_id in span_by_id:
                span_by_id[parent_id]["children"].append(s)
            else:
                roots.append(s)

        # Find Root Cause Hint (failing span or slowest child span)
        root_cause = None
        error_spans = [s for s in parsed_spans if s.get("status_code") == "ERROR"]
        if error_spans:
            # Deepest or latest error span
            failing_span = error_spans[-1]
            root_cause = {
                "type": "ERROR",
                "span_id": failing_span["span_id"],
                "service_name": failing_span["service_name"],
                "operation": failing_span["name"],
                "message": failing_span.get("status_message") or f"Service '{failing_span['service_name']}' returned an error."
            }
        else:
            # Slowest non-root span
            non_roots = [s for s in parsed_spans if s.get("parent_span_id")]
            if non_roots:
                slowest = max(non_roots, key=lambda s: s["duration_ms"])
                if slowest["duration_ms"] > total_trace_duration * 0.4:
                    root_cause = {
                        "type": "BOTTLENECK",
                        "span_id": slowest["span_id"],
                        "service_name": slowest["service_name"],
                        "operation": slowest["name"],
                        "message": f"Operation '{slowest['name']}' in {slowest['service_name']} took {slowest['duration_ms']}ms ({slowest['duration_percent']}% of total trace time)."
                    }

        return {
            "root_spans": roots,
            "all_spans": parsed_spans,
            "total_duration_ms": round(total_trace_duration, 2),
            "span_count": len(parsed_spans),
            "services_count": len(set(s["service_name"] for s in parsed_spans)),
            "root_cause_hint": root_cause
        }

    def compute_service_map(self, spans: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes the directed dependency graph of services from trace span parent-child relations.
        Calculates calls count, average latency, and error rate for nodes and edges.
        """
        nodes = {}
        edges = defaultdict(lambda: {"count": 0, "total_duration": 0.0, "errors": 0})
        
        span_lookup = {s["span_id"]: s for s in spans}

        for s in spans:
            svc = s["service_name"]
            if svc not in nodes:
                nodes[svc] = {
                    "id": svc,
                    "name": svc,
                    "type": s.get("kind", "service"),
                    "request_count": 0,
                    "total_duration": 0.0,
                    "error_count": 0
                }
            
            nodes[svc]["request_count"] += 1
            nodes[svc]["total_duration"] += s.get("duration_ms", 0.0)
            if s.get("status_code") == "ERROR":
                nodes[svc]["error_count"] += 1

            parent_id = s.get("parent_span_id")
            if parent_id and parent_id in span_lookup:
                parent_svc = span_lookup[parent_id]["service_name"]
                if parent_svc != svc:
                    edge_key = (parent_svc, svc)
                    edges[edge_key]["count"] += 1
                    edges[edge_key]["total_duration"] += s.get("duration_ms", 0.0)
                    if s.get("status_code") == "ERROR":
                        edges[edge_key]["errors"] += 1

        # Format nodes list
        nodes_list = []
        for svc, data in nodes.items():
            reqs = data["request_count"]
            nodes_list.append({
                "id": svc,
                "name": svc,
                "type": data["type"],
                "request_count": reqs,
                "avg_latency_ms": round(data["total_duration"] / max(1, reqs), 2),
                "error_rate_percent": round((data["error_count"] / max(1, reqs)) * 100, 2),
                "status": "danger" if data["error_count"] > 0 else "healthy"
            })

        # Format edges list
        edges_list = []
        for (source, target), stats in edges.items():
            cnt = stats["count"]
            edges_list.append({
                "source": source,
                "target": target,
                "call_count": cnt,
                "avg_latency_ms": round(stats["total_duration"] / max(1, cnt), 2),
                "error_rate_percent": round((stats["errors"] / max(1, cnt)) * 100, 2)
            })

        return {
            "nodes": nodes_list,
            "edges": edges_list
        }

trace_analyzer = TraceAnalyzer()
