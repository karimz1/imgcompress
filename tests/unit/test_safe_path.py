"""Paths built from request values may only name a direct child of a known folder."""

import os

import pytest

from backend.image_converter.infrastructure.safe_path import direct_child


def test_When_NameIsAPlainChild_Expect_ResolvedPath(tmp_path):
    (tmp_path / "source_editor_abc").mkdir()
    assert direct_child(str(tmp_path), "source_editor_abc") == str(tmp_path.resolve() / "source_editor_abc")


def test_When_ChildDoesNotExistYet_Expect_PathAnyway(tmp_path):
    assert direct_child(tmp_path, "new.png") == str(tmp_path.resolve() / "new.png")


def test_When_BaseIsReachedThroughALink_Expect_RealBase(tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    os.symlink(real, tmp_path / "link")
    assert direct_child(tmp_path / "link", "a") == str(real.resolve() / "a")


@pytest.mark.parametrize(
    "name",
    ["", ".", "..", "../x", "../../etc/passwd", "a/../../x", "a/b", "a/./b", "/etc/passwd", "a\x00b", "a/"],
)
def test_When_NameLeavesOrNestsTheBase_Expect_None(tmp_path, name):
    (tmp_path / "a").mkdir()
    assert direct_child(tmp_path, name) is None


def test_When_AbsoluteNameInsideTheBase_Expect_None(tmp_path):
    (tmp_path / "a").mkdir()
    assert direct_child(tmp_path, str(tmp_path / "a")) is None


def test_When_ChildIsALinkOutside_Expect_None(tmp_path):
    base = tmp_path / "base"
    base.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    os.symlink(outside, base / "evil")
    assert direct_child(base, "evil") is None


def test_When_ChildIsALinkToASibling_Expect_None(tmp_path):
    (tmp_path / "converted_x").mkdir()
    os.symlink(tmp_path / "converted_x", tmp_path / "source_editor_y")
    assert direct_child(tmp_path, "source_editor_y") is None


def test_When_NameIsNotAString_Expect_None(tmp_path):
    assert direct_child(tmp_path, None) is None
    assert direct_child(tmp_path, 42) is None
