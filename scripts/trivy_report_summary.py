#!/usr/bin/env python3
"""Render a Trivy JSON report into the artefacts the nightly CVE scan publishes.

The nightly workflow used to decide whether the image was clean by grepping the
human-readable table report for "Total: N". Trivy only prints that line for
targets that actually have findings, so a clean image produced no match, grep
exited 1, and `set -o pipefail` failed the step: green images turned the run
red. Every number here comes from the JSON report instead, which is stable
across Trivy releases and cannot fail open.

The scan runs with --ignore-unfixed, so everything reported here has a fix
available upstream and is therefore actionable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import NamedTuple, Sequence

SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN")

# Long reports are unreadable in a job summary and GitHub truncates the page at
# 1 MiB anyway. The omitted count is always printed, never silently dropped.
MAX_TABLE_ROWS = 50

REMEDIATION_NOTE = (
    "Base image CVEs are normally cleared by the `Refresh Dockerfile base image "
    "digests` workflow, which reopens a PR whenever the upstream digest moves. "
    "If that workflow is green and this is still red, upstream has not shipped a "
    "patch yet."
)


class Finding(NamedTuple):
    severity: str
    vuln_id: str
    package: str
    installed: str
    fixed: str
    pkg_type: str
    target: str
    url: str

    @property
    def key(self) -> tuple[str, str, str, str]:
        """Identity used for de-duplication and for the fingerprint."""
        return (self.target, self.package, self.vuln_id, self.installed)


def _severity_rank(severity: str) -> int:
    try:
        return SEVERITIES.index(severity)
    except ValueError:
        return len(SEVERITIES)


def load_findings(report: dict) -> list[Finding]:
    """Flatten a Trivy JSON report into de-duplicated, severity-sorted findings.

    Trivy repeats the same CVE once per affected target, and a package can be
    vendored into several targets inside one image, so identical rows are
    collapsed on (target, package, id, installed version).
    """
    seen: dict[tuple[str, str, str, str], Finding] = {}

    for result in report.get("Results") or []:
        target = str(result.get("Target") or "")
        pkg_type = str(result.get("Type") or "")
        for vuln in result.get("Vulnerabilities") or []:
            finding = Finding(
                severity=str(vuln.get("Severity") or "UNKNOWN").upper(),
                vuln_id=str(vuln.get("VulnerabilityID") or "UNKNOWN"),
                package=str(vuln.get("PkgName") or ""),
                installed=str(vuln.get("InstalledVersion") or ""),
                fixed=str(vuln.get("FixedVersion") or ""),
                pkg_type=pkg_type,
                target=target,
                url=str(vuln.get("PrimaryURL") or ""),
            )
            seen.setdefault(finding.key, finding)

    return sorted(
        seen.values(),
        key=lambda f: (_severity_rank(f.severity), f.vuln_id, f.package, f.target),
    )


def count_by_severity(findings: Sequence[Finding]) -> dict[str, int]:
    counts = {severity: 0 for severity in SEVERITIES}
    for finding in findings:
        counts[finding.severity] = counts.get(finding.severity, 0) + 1
    return counts


def fingerprint(findings: Sequence[Finding]) -> str:
    """Stable digest of the finding set, independent of report ordering.

    The tracking issue stores this so a nightly run that finds exactly what the
    previous one found updates the issue silently instead of commenting again.
    """
    joined = "\n".join(sorted("|".join(f.key) for f in findings))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:16]


def _cve_cell(finding: Finding) -> str:
    if finding.url:
        return f"[{finding.vuln_id}]({finding.url})"
    return finding.vuln_id


def render_table(findings: Sequence[Finding], max_rows: int = MAX_TABLE_ROWS) -> list[str]:
    lines = [
        "| Severity | CVE | Package | Installed | Fixed in | Type |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for finding in findings[:max_rows]:
        lines.append(
            "| {severity} | {cve} | `{package}` | `{installed}` | `{fixed}` | {pkg_type} |".format(
                severity=finding.severity,
                cve=_cve_cell(finding),
                package=finding.package,
                installed=finding.installed or "-",
                fixed=finding.fixed or "-",
                pkg_type=finding.pkg_type or "-",
            )
        )

    omitted = len(findings) - max_rows
    if omitted > 0:
        lines.append("")
        lines.append(
            f"{omitted} further finding(s) omitted from this table. "
            "The full list is in the `trivy-results.log` artifact and in the Security tab."
        )
    return lines


def render_counts(counts: dict[str, int]) -> list[str]:
    present = [s for s in SEVERITIES if counts.get(s)]
    if not present:
        return []
    header = "| " + " | ".join(present) + " |"
    divider = "| " + " | ".join("---" for _ in present) + " |"
    values = "| " + " | ".join(str(counts[s]) for s in present) + " |"
    return [header, divider, values]


def _metadata_lines(
    image: str,
    digest: str,
    trivy_version: str,
    run_url: str,
) -> list[str]:
    lines = [f"**Image:** `{image}`"]
    if digest:
        lines.append(f"**Digest:** `{digest}`")
    if trivy_version:
        lines.append(f"**Scanner:** Trivy {trivy_version}")
    if run_url:
        lines.append(f"**Run:** {run_url}")
    return [line + "  " for line in lines]


def render_summary(
    findings: Sequence[Finding],
    *,
    image: str,
    digest: str = "",
    trivy_version: str = "",
    run_url: str = "",
    gate_severity: str = "CRITICAL",
) -> str:
    counts = count_by_severity(findings)
    blocking = counts.get(gate_severity, 0)

    lines = ["## Container CVE scan", ""]
    lines += _metadata_lines(image, digest, trivy_version, run_url)
    lines.append("")

    if not findings:
        lines.append(
            "**Result:** clean. No fixable vulnerabilities of any severity were found."
        )
        return "\n".join(lines) + "\n"

    if blocking:
        lines.append(
            f"**Result:** failed. {blocking} fixable {gate_severity} "
            f"vulnerability(ies) present in the published image."
        )
    else:
        lines.append(
            f"**Result:** passed. No fixable {gate_severity} vulnerabilities; "
            f"{len(findings)} lower-severity finding(s) listed below for awareness."
        )

    lines.append("")
    lines += render_counts(counts)
    lines.append("")
    lines += render_table(findings)
    lines.append("")
    lines.append(REMEDIATION_NOTE)
    lines.append("")
    lines.append(
        "Every finding below has a fix available upstream; the scan runs with "
        "`--ignore-unfixed`."
    )
    return "\n".join(lines) + "\n"


def render_issue_body(
    findings: Sequence[Finding],
    *,
    image: str,
    marker: str,
    digest: str = "",
    trivy_version: str = "",
    run_url: str = "",
    gate_severity: str = "CRITICAL",
) -> str:
    counts = count_by_severity(findings)
    blocking = counts.get(gate_severity, 0)

    lines = [
        marker,
        f"<!-- fingerprint:{fingerprint(findings)} -->",
        "",
        f"The nightly container scan found **{blocking} fixable {gate_severity}** "
        f"vulnerability(ies) in `{image}`.",
        "",
    ]
    lines += _metadata_lines(image, digest, trivy_version, run_url)
    lines.append("")
    lines += render_counts(counts)
    lines.append("")
    lines += render_table(findings)
    lines.append("")
    lines.append(REMEDIATION_NOTE)
    lines.append("")
    lines.append(
        "This issue is maintained automatically by the `Nightly container CVE scan` "
        "workflow and is closed once the image is clean."
    )
    return "\n".join(lines) + "\n"


def render_outputs(findings: Sequence[Finding]) -> str:
    counts = count_by_severity(findings)
    pairs = {severity.lower(): counts.get(severity, 0) for severity in SEVERITIES}
    pairs["total"] = len(findings)
    pairs["fingerprint"] = fingerprint(findings)
    return "".join(f"{key}={value}\n" for key, value in pairs.items())


def _write(path: str | None, content: str, mode: str = "w") -> None:
    """Write content to path; "-" means stdout.

    $GITHUB_STEP_SUMMARY and $GITHUB_OUTPUT are append-only command files that
    other steps also write to, so those two are opened in append mode.
    """
    if not path:
        return
    if path == "-":
        sys.stdout.write(content)
        return
    target = Path(path)
    if str(target.parent) not in (".", ""):
        target.parent.mkdir(parents=True, exist_ok=True)
    with target.open(mode, encoding="utf-8") as handle:
        handle.write(content)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a Trivy JSON report into markdown reports and workflow outputs."
    )
    parser.add_argument("report", help="Path to a Trivy JSON report")
    parser.add_argument("--image", required=True, help="Image reference that was scanned")
    parser.add_argument("--digest", default="", help="Repo digest of the scanned image")
    parser.add_argument("--trivy-version", default="", help="Trivy version used")
    parser.add_argument("--run-url", default="", help="URL of the workflow run")
    parser.add_argument(
        "--gate-severity",
        default="CRITICAL",
        choices=list(SEVERITIES),
        help="Severity that fails the run (default: CRITICAL)",
    )
    parser.add_argument("--marker", default="", help="Hidden marker identifying the tracking issue")
    parser.add_argument("--summary-out", help="Write the job summary markdown here ('-' for stdout)")
    parser.add_argument("--issue-out", help="Write the tracking issue body here ('-' for stdout)")
    parser.add_argument("--github-output", help="Append key=value counts here ('-' for stdout)")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)

    with open(args.report, encoding="utf-8") as handle:
        report = json.load(handle)

    findings = load_findings(report)
    marker = args.marker or f"<!-- nightly-cve-scan:{args.image} -->"

    _write(
        args.summary_out,
        render_summary(
            findings,
            image=args.image,
            digest=args.digest,
            trivy_version=args.trivy_version,
            run_url=args.run_url,
            gate_severity=args.gate_severity,
        ),
        mode="a",
    )
    _write(
        args.issue_out,
        render_issue_body(
            findings,
            image=args.image,
            marker=marker,
            digest=args.digest,
            trivy_version=args.trivy_version,
            run_url=args.run_url,
            gate_severity=args.gate_severity,
        ),
    )
    _write(args.github_output, render_outputs(findings), mode="a")
    return 0


if __name__ == "__main__":
    sys.exit(main())
