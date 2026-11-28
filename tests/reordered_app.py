"""Test fixture that changes the numeric positions of the first two cases."""

from app import main
from app.levels.catalog import load_levels


def load_reordered_levels():
    levels = load_levels()
    first, second, *_ = levels.values()
    levels[first.id] = first.model_copy(update={"order": second.order})
    levels[second.id] = second.model_copy(update={"order": first.order})
    return dict(sorted(levels.items(), key=lambda item: item[1].order))


main.load_levels = load_reordered_levels
app = main.app
