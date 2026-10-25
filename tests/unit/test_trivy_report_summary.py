"""Tests for the nightly CVE scan report renderer.

The gate this feeds used to scrape Trivy's human-readable table for "Total: N",
which a clean image never prints, so a green image failed the run. These tests
pin the JSON-derived behaviour that replaced it, including the clean case.
"""

import json
from pathlib import Path

import pytest

from scripts.trivy_report_summary import (
    count_by_severity,
    fingerprint,
    load_findings,
    main,
    render_issue_body,
    render_counts,
    render_outputs,
    render_summary,
    render_table,
)

DATA_DIR = Path(__file__).parent / "data"
IMAGE = "docker.io/karimz1/imgcompress:nightly"


def _load(name):
    with (DATA_DIR / name).open(encoding="utf-8") as handle:
        return json.load(handle)


@pytest.fixture
def clean_report():
    return _load("trivy-clean.json")


@pytest.fixture
def dirty_report():
    return _load("trivy-findings.json")


def test_clean_report_has_no_findings(clean_report):
    assert load_findings(clean_report) == []


def test_clean_summary_states_the_image_is_clean(clean_report):
    summary = render_summary(load_findings(clean_report), image=IMAGE)

    assert "clean" in summary
    assert "| Severity |" not in summary


def test_clean_outputs_are_all_zero(clean_report):
    outputs = render_outputs(load_findings(clean_report))

    assert "critical=0" in outputs
    assert "total=0" in outputs


def test_duplicate_rows_are_collapsed(dirty_report):
    findings = load_findings(dirty_report)

    pip_rows = [f for f in findings if f.package == "pip"]
    assert len(pip_rows) == 1
    assert len(findings) == 4


def test_findings_are_sorted_by_severity(dirty_report):
    severities = [f.severity for f in load_findings(dirty_report)]

    assert severities == ["CRITICAL", "HIGH", "MEDIUM", "LOW"]


def test_counts_are_derived_per_severity(dirty_report):
    counts = count_by_severity(load_findings(dirty_report))

    assert counts["CRITICAL"] == 1
    assert counts["HIGH"] == 1
    assert counts["MEDIUM"] == 1
    assert counts["LOW"] == 1


def test_table_links_the_cve_when_trivy_supplies_a_url(dirty_report):
    table = "\n".join(render_table(load_findings(dirty_report)))

    assert "[CVE-2026-1000](https://avd.aquasec.com/nvd/cve-2026-1000)" in table


def test_table_falls_back_to_plain_text_without_a_url(dirty_report):
    table = "\n".join(render_table(load_findings(dirty_report)))

    assert "| CVE-2026-4000 |" in table


def test_table_renders_a_dash_for_a_missing_fixed_version(dirty_report):
    row = next(
        line
        for line in render_table(load_findings(dirty_report))
        if "CVE-2026-4000" in line
    )

    assert "| `-` |" in row


def test_table_reports_omitted_rows_instead_of_truncating_silently(dirty_report):
    lines = render_table(load_findings(dirty_report), max_rows=2)

    data_rows = [line for line in lines[2:] if line.startswith("|")]
    assert len(data_rows) == 2
    assert any("2 further finding(s) omitted" in line for line in lines)


def test_summary_reports_failure_when_a_critical_is_present(dirty_report):
    summary = render_summary(load_findings(dirty_report), image=IMAGE)

    assert "**Result:** failed. 1 fixable CRITICAL" in summary
    assert "CVE-2026-1000" in summary


def test_summary_passes_when_only_lower_severities_are_present(dirty_report):
    findings = [f for f in load_findings(dirty_report) if f.severity != "CRITICAL"]

    summary = render_summary(findings, image=IMAGE)

    assert "**Result:** passed." in summary
    assert "3 lower-severity finding(s)" in summary


def test_summary_includes_the_scan_metadata(dirty_report):
    summary = render_summary(
        load_findings(dirty_report),
        image=IMAGE,
        digest="sha256:fada29",
        trivy_version="0.70.0",
        run_url="https://example.invalid/run/1",
    )

    assert f"`{IMAGE}`" in summary
    assert "sha256:fada29" in summary
    assert "Trivy 0.70.0" in summary
    assert "https://example.invalid/run/1" in summary


def test_issue_body_carries_the_marker_and_fingerprint(dirty_report):
    findings = load_findings(dirty_report)
    marker = f"<!-- nightly-cve-scan:{IMAGE} -->"

    body = render_issue_body(findings, image=IMAGE, marker=marker)

    assert body.startswith(marker)
    assert f"<!-- fingerprint:{fingerprint(findings)} -->" in body


def test_fingerprint_ignores_report_ordering(dirty_report):
    findings = load_findings(dirty_report)

    assert fingerprint(findings) == fingerprint(list(reversed(findings)))


def test_fingerprint_changes_when_a_finding_appears(dirty_report):
    findings = load_findings(dirty_report)

    assert fingerprint(findings) != fingerprint(findings[1:])


def test_outputs_are_valid_workflow_key_value_lines(dirty_report):
    outputs = render_outputs(load_findings(dirty_report))
    pairs = dict(line.split("=", 1) for line in outputs.strip().splitlines())

    assert pairs["critical"] == "1"
    assert pairs["high"] == "1"
    assert pairs["total"] == "4"
    assert len(pairs["fingerprint"]) == 16


def test_main_writes_every_artifact(tmp_path):
    summary = tmp_path / "summary.md"
    issue = tmp_path / "issue-body.md"
    outputs = tmp_path / "outputs.txt"

    exit_code = main(
        [
            str(DATA_DIR / "trivy-findings.json"),
            "--image",
            IMAGE,
            "--summary-out",
            str(summary),
            "--issue-out",
            str(issue),
            "--github-output",
            str(outputs),
        ]
    )

    assert exit_code == 0
    assert "Container CVE scan" in summary.read_text(encoding="utf-8")
    assert f"<!-- nightly-cve-scan:{IMAGE} -->" in issue.read_text(encoding="utf-8")
    assert "critical=1" in outputs.read_text(encoding="utf-8")


def test_main_appends_to_the_github_command_files(tmp_path):
    """$GITHUB_STEP_SUMMARY and $GITHUB_OUTPUT are shared, append-only files."""
    summary = tmp_path / "summary.md"
    outputs = tmp_path / "outputs.txt"
    summary.write_text("written by an earlier step\n", encoding="utf-8")
    outputs.write_text("earlier=value\n", encoding="utf-8")

    main(
        [
            str(DATA_DIR / "trivy-clean.json"),
            "--image",
            IMAGE,
            "--summary-out",
            str(summary),
            "--github-output",
            str(outputs),
        ]
    )

    assert summary.read_text(encoding="utf-8").startswith("written by an earlier step")
    assert "earlier=value" in outputs.read_text(encoding="utf-8")
    assert "critical=0" in outputs.read_text(encoding="utf-8")


def test_count_row_keeps_all_graded_severities(dirty_report):
    findings = [f for f in load_findings(dirty_report) if f.severity == "MEDIUM"]

    header, _, values = render_counts(count_by_severity(findings))

    assert header == "| CRITICAL | HIGH | MEDIUM | LOW |"
    assert values == "| 0 | 0 | 1 | 0 |"


def test_count_row_is_empty_without_findings(clean_report):
    assert render_counts(count_by_severity(load_findings(clean_report))) == []
