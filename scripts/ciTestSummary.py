#!/usr/bin/env python3
"""Append a short Markdown summary of JUnit XML files to $GITHUB_STEP_SUMMARY.

Usage: ciTestSummary.py "<title>" report.xml [report.xml ...]
Missing files are listed as such, so a crash before the tests ran still shows up.
Never fails the job; the test step already decides that.
"""
import os
import sys
import xml.etree.ElementTree as ET

MAX_LISTED = 20


def suites(root):
    return [root] if root.tag == "testsuite" else list(root.iter("testsuite"))


def summarize(path):
    root = ET.parse(path).getroot()
    totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    failed = []
    for suite in suites(root):
        for key in totals:
            totals[key] += int(suite.get(key, 0) or 0)
        for case in suite.iter("testcase"):
            if case.find("failure") is not None or case.find("error") is not None:
                name = case.get("name", "?")
                cls = case.get("classname", "")
                failed.append(f"{cls}::{name}" if cls else name)
    return totals, failed


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return
    title, paths = sys.argv[1], sys.argv[2:]
    lines = [f"### {title}", "", "| Report | Tests | Failed | Errors | Skipped |", "|---|---|---|---|---|"]
    all_failed = []
    for path in paths:
        name = os.path.basename(path)
        if not os.path.isfile(path):
            lines.append(f"| {name} | not written | | | |")
            continue
        try:
            t, failed = summarize(path)
        except ET.ParseError as exc:
            lines.append(f"| {name} | unreadable ({exc}) | | | |")
            continue
        mark = "❌" if t["failures"] or t["errors"] else "✅"
        lines.append(f"| {mark} {name} | {t['tests']} | {t['failures']} | {t['errors']} | {t['skipped']} |")
        all_failed += failed
    if all_failed:
        lines += ["", "Failed:"] + [f"- `{f}`" for f in all_failed[:MAX_LISTED]]
        if len(all_failed) > MAX_LISTED:
            lines.append(f"- … and {len(all_failed) - MAX_LISTED} more")
    text = "\n".join(lines) + "\n\n"
    target = os.environ.get("GITHUB_STEP_SUMMARY")
    if target:
        with open(target, "a", encoding="utf-8") as f:
            f.write(text)
    print(text)


if __name__ == "__main__":
    main()
