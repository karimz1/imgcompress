import sys

import pytest

from backend.image_converter import argument_parser
from backend.image_converter.presentation.cli.argument_parser import parse_arguments as parse_cli_arguments


def test_cli_help_is_forwarded_to_cli_parser(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["bootstraper.py", "cli", "--help"])
    args, remaining = argument_parser.parse_arguments()
    assert args.mode == "cli"
    assert remaining == ["--help"]

    with pytest.raises(SystemExit) as exc:
        parse_cli_arguments(remaining)
    assert exc.value.code == 0

    output = capsys.readouterr().out
    assert "--quality QUALITY" in output
    assert "--width WIDTH" in output
    assert "--format {jpeg,png,avif,pdf}" in output
    assert "--pdf-preset" in output
    assert "--pdf-scale" in output
    assert "--pdf-margin-mm" in output
    assert "--pdf-paginate" in output
    assert "--json-output" in output


def test_global_help_prints_and_exits(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["bootstraper.py", "--help"])
    with pytest.raises(SystemExit) as exc:
        argument_parser.parse_arguments()
    assert exc.value.code == 0
    output = capsys.readouterr().out
    assert "imgcompress" in output
    assert "{cli,web}" in output
