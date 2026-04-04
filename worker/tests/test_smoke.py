"""Smoke tests for worker package layout."""


def test_baker_importable():
    import baker  # noqa: PLC0415

    assert baker.__doc__ is not None
