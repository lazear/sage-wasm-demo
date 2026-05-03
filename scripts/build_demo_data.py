#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import csv
import gzip
import json
import math
import re
import struct
import zlib
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from xml.etree import ElementTree as ET


@dataclass
class SearchHit:
    filename: str
    scan: int
    precursor_mz: float
    precursor_charge: int
    peptide: str
    proteins: List[str]
    hyperscore: float
    row_id: int


def strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def read_results_table(path: Path, target_file: Optional[str], top_n: int) -> Tuple[List[SearchHit], str]:
    importer = subprocess.Popen(["zstd", "-dc", str(path)], stdout=subprocess.PIPE, text=True) if path.suffix == ".zst" else None
    close_handle = True

    counts: Counter[str] = Counter()
    rows: List[SearchHit] = []

    if importer is not None:
        if importer.stdout is None:
            raise SystemExit(f"Failed to open ZST stream for {path}")
        handle = importer.stdout
    else:
        opener = gzip.open if path.suffix.endswith(".gz") else open
        handle = opener(path, "rt", newline="")

    try:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            try:
                if row.get("rank", "") != "1" or row.get("label", "") != "1":
                    continue
            except KeyError:
                continue

            filename = row.get("filename", "")
            scannr = row.get("scannr", "")
            match = re.search(r"scan=(\d+)", scannr or "")
            if not match:
                continue

            try:
                scan = int(match.group(1))
                precursor_mz = float(row.get("expmass", ""))
                precursor_charge = int(row.get("charge", ""))
                hyperscore = float(row.get("hyperscore", "nan"))
                psm_id = int(row.get("psm_id", "0") or 0)
            except ValueError:
                continue

            protein_field = row.get("proteins", "") or ""
            proteins = [p for p in re.split(r"[;,]", protein_field) if p.strip()]
            peptides = (row.get("peptide", "") or "").strip()

            counts[filename] += 1
            rows.append(
                SearchHit(
                    filename=filename,
                    scan=scan,
                    precursor_mz=precursor_mz,
                    precursor_charge=precursor_charge,
                    peptide=peptides,
                    proteins=proteins,
                    hyperscore=hyperscore,
                    row_id=psm_id,
                )
            )
    finally:
        if close_handle:
            handle.close()
        if importer is not None:
            importer.wait()

    if not rows:
        raise SystemExit("No usable rows found in results table.")

    if not target_file:
        target_file = counts.most_common(1)[0][0]

    filtered = [row for row in rows if row.filename == target_file]
    if not filtered:
        raise SystemExit(f"No rows for filename '{target_file}'.")

    filtered.sort(key=lambda row: row.hyperscore, reverse=True)

    selected: List[SearchHit] = []
    seen_scans: Set[int] = set()
    for row in filtered:
        if row.scan in seen_scans:
            continue
        selected.append(row)
        seen_scans.add(row.scan)
        if len(selected) >= top_n:
            break

    if not selected:
        raise SystemExit("No scans selected after ranking and deduping.")

    return selected, target_file


def parse_accession(entry: str) -> Optional[str]:
    token = entry.strip().split()[0]
    if not token:
        return None

    if token.startswith("sp|") or token.startswith("tr|") or token.startswith("rev_"):
        parts = token.split("|")
        if len(parts) >= 3:
            return parts[1]

    return token


def load_fasta(path: Path) -> Dict[str, str]:
    records: Dict[str, str] = {}
    current_acc: Optional[str] = None
    current_seq: List[str] = []

    opener = gzip.open if path.suffix.endswith(".gz") else open
    with opener(path, "rt") as handle:
        for raw in handle:
            line = raw.strip()
            if not line:
                continue
            if line.startswith(">"):
                if current_acc is not None:
                    records[current_acc] = "".join(current_seq)

                header = line[1:].strip()
                token = header.split()[0]
                if token.startswith("sp|") or token.startswith("tr|"):
                    parts = token.split("|")
                    if len(parts) >= 2:
                        current_acc = parts[1]
                    else:
                        current_acc = token
                elif "|" in token:
                    parts = token.split("|")
                    current_acc = parts[1] if len(parts) >= 2 else token
                else:
                    current_acc = token

                current_seq = []
            else:
                current_seq.append(line)

    if current_acc is not None:
        records[current_acc] = "".join(current_seq)

    return records


def decode_base64_binary(binary_text: str, precision: int, compressed: bool) -> Optional[List[float]]:
    raw = base64.b64decode(binary_text)
    if compressed:
        raw = zlib.decompress(raw)

    if precision == 32:
        fmt = "f"
        size = 4
    elif precision == 64:
        fmt = "d"
        size = 8
    else:
        return None

    if len(raw) % size != 0:
        return None

    count = len(raw) // size
    if count == 0:
        return []

    return list(struct.unpack(f"<{count}{fmt}", raw))


def parse_spectrum_scan_id(spectrum_id: str) -> Optional[int]:
    if not spectrum_id:
        return None
    match = re.search(r"scan=(\d+)", spectrum_id)
    if not match:
        return None
    return int(match.group(1))


def parse_binary_arrays(element: ET.Element) -> Tuple[Optional[List[float]], Optional[List[float]]]:
    mzs: Optional[List[float]] = None
    intensities: Optional[List[float]] = None

    for bda in element.findall(".//{*}binaryDataArray"):
        accessions: Set[str] = set()
        precision = 64
        compressed = False
        for cv in bda.findall("./{*}cvParam"):
            acc = cv.attrib.get("accession", "")
            if not acc:
                continue
            accessions.add(acc)
            if acc == "MS:1000521":
                precision = 32
            elif acc == "MS:1000574":
                compressed = True

        is_mz = "MS:1000514" in accessions
        is_intensity = "MS:1000515" in accessions
        if not (is_mz or is_intensity):
            continue

        binary_node = bda.find("./{*}binary")
        if binary_node is None or not (binary_node.text or "").strip():
            continue

        values = decode_base64_binary(binary_node.text.strip(), precision, compressed)
        if values is None:
            continue

        if is_mz:
            mzs = values
        elif is_intensity:
            intensities = values

    if mzs is None or intensities is None:
        return None, None

    n = min(len(mzs), len(intensities))
    if n <= 0:
        return [], []

    return mzs[:n], intensities[:n]


def extract_spectra_from_mzml(path: Path, scans: Set[int], hits: List[SearchHit]) -> Dict[int, Dict[str, object]]:
    required: Dict[int, SearchHit] = {hit.scan: hit for hit in hits}
    results: Dict[int, Dict[str, object]] = {}

    opener = gzip.open if path.suffix.endswith(".gz") else open

    scan_to_hit = required
    with opener(path, "rt") as raw:
        for _, elem in ET.iterparse(raw, events=("end",)):
            if strip_ns(elem.tag) != "spectrum":
                continue

            spectrum_id = elem.attrib.get("id", "")
            scan = parse_spectrum_scan_id(spectrum_id)
            if scan is None or scan not in scan_to_hit:
                elem.clear()
                continue

            precursor_charge = scan_to_hit[scan].precursor_charge
            precursor_mz = scan_to_hit[scan].precursor_mz
            has_ms2 = False

            for cv in elem.findall(".//{*}cvParam"):
                if cv.attrib.get("accession") == "MS:1000511":
                    has_ms2 = cv.attrib.get("value") == "2"
                    break

            if has_ms2:
                precursor_list = elem.find("./{*}precursorList")
                if precursor_list is not None:
                    precursor_charge = precursor_charge
                    precursor_mz = precursor_mz
                    selected_ion = precursor_list.find("./{*}precursor/{*}selectedIonList/{*}selectedIon")
                    if selected_ion is not None:
                        for cv in selected_ion.findall("./{*}cvParam"):
                            if cv.attrib.get("accession") == "MS:1000041":
                                try:
                                    precursor_charge = int(float(cv.attrib.get("value", "0")))
                                except ValueError:
                                    pass
                            if cv.attrib.get("accession") == "MS:1000744":
                                try:
                                    precursor_mz = float(cv.attrib.get("value", "0"))
                                except ValueError:
                                    pass

                mz_values, intensity_values = parse_binary_arrays(elem)
                if mz_values is not None and intensity_values is not None:
                    peaks = [
                        {"mz": float(mz), "intensity": float(intensity)}
                        for mz, intensity in zip(mz_values, intensity_values)
                        if math.isfinite(mz) and math.isfinite(intensity)
                    ]

                    if peaks:
                        results[scan] = {
                            "precursorMz": precursor_mz,
                            "precursorCharge": precursor_charge,
                            "peaks": peaks,
                        }
            elem.clear()

    return results


def write_demo_data(
    output_json: Path,
    output_fasta: Path,
    source_filename: str,
    full_fasta: Dict[str, str],
    selected_hits: List[SearchHit],
    spectra_by_scan: Dict[int, Dict[str, object]],
):
    all_proteins: List[str] = []
    seen_proteins: Set[str] = set()

    queries = []
    for hit in selected_hits:
        payload = spectra_by_scan.get(hit.scan)
        if payload is None:
            continue

        for token in hit.proteins:
            accession = parse_accession(token)
            if accession and accession not in seen_proteins and accession in full_fasta:
                seen_proteins.add(accession)
                all_proteins.append(accession)

        peak_count = len(payload.get("peaks", []))
        if peak_count == 0:
            continue

        queries.append(
            {
                "id": f"{source_filename}:scan={hit.scan}",
                "sourceName": f"{source_filename}:scan={hit.scan}",
                "precursorMz": float(payload["precursorMz"]),
                "precursorCharge": int(payload["precursorCharge"]),
                "peptideHint": hit.peptide,
                "peaks": payload["peaks"],
            }
        )

    if not queries:
        raise SystemExit("No valid spectra found in mzML file for selected scans.")

    fasta_lines: List[str] = []
    for accession in all_proteins:
        sequence = full_fasta.get(accession)
        if not sequence:
            continue
        fasta_lines.append(f">{accession}")
        fasta_lines.append(sequence)

    output_fasta.write_text("\n".join(fasta_lines) + "\n", encoding="utf-8")

    payload = {
        "fastaSource": str(output_fasta.name),
        "proteinCount": len(all_proteins),
        "queries": queries,
    }
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build demo sage wasm dataset from results.sage.tsv and one mzML.")
    parser.add_argument("--results", default=str(Path.home() / "data" / "PXD003881" / "results.sage.tsv"))
    parser.add_argument("--fasta", default=str(Path.home() / "data" / "PXD003881" / "PXD003881.fasta"))
    parser.add_argument("--mzml", default=None, help="Specific mzML filename or path. If a filename, it is resolved relative to results file directory.")
    parser.add_argument("--top", type=int, default=100, help="Number of top ranked candidate rows to include.")
    parser.add_argument("--out-json", default="demo_data.json")
    parser.add_argument("--out-fasta", default="mini.fasta")
    return parser.parse_args()


def resolve_mzml_path(results_path: Path, requested: Optional[str]) -> Path:
    if requested is None:
        return None

    candidate = Path(requested)
    if candidate.exists():
        return candidate

    # try resolve filename against results directory
    candidate = results_path.parent / requested
    if candidate.exists():
        return candidate

    raise SystemExit(f"Cannot resolve mzML file '{requested}'.")


def main() -> None:
    args = parse_args()

    results_path = Path(args.results).expanduser()
    fasta_path = Path(args.fasta).expanduser()
    if not results_path.exists() or not results_path.is_file():
        raise SystemExit(f"Results file not found: {results_path}")
    if not fasta_path.exists() or not fasta_path.is_file():
        raise SystemExit(f"FASTA file not found: {fasta_path}")

    preferred = Path(args.mzml).name if args.mzml and not Path(args.mzml).exists() else (str(Path(args.mzml)) if args.mzml else None)

    selected_hits, selected_filename = read_results_table(results_path, preferred, args.top)

    if args.mzml:
        mzml_path = resolve_mzml_path(results_path, args.mzml)
        if not mzml_path.suffix.lower().endswith(".gz") and not mzml_path.suffix.lower().endswith(".mzml"):
            raise SystemExit(f"Unsupported mzML extension: {mzml_path}")
    else:
        # If not given explicitly, we expect this filename to be present in the results directory.
        mzml_path = results_path.parent / selected_filename
        if not mzml_path.exists():
            # as fallback, search for any matching file name in results directory
            candidates = list(results_path.parent.glob(selected_filename))
            if not candidates:
                raise SystemExit(f"Cannot locate mzML file {selected_filename} in {results_path.parent}")
            mzml_path = candidates[0]

    full_fasta = load_fasta(fasta_path)

    needed_scans = {hit.scan for hit in selected_hits}
    spectra = extract_spectra_from_mzml(mzml_path, needed_scans, selected_hits)

    output_json = Path(args.out_json)
    output_fasta = Path(args.out_fasta)
    write_demo_data(output_json, output_fasta, selected_filename, full_fasta, selected_hits, spectra)


if __name__ == "__main__":
    main()
