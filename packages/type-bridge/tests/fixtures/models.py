"""Stdlib-only models exercising the typing features that matter for conversion."""

from __future__ import annotations

import datetime as dt
from collections.abc import Callable, Mapping, Sequence
from dataclasses import KW_ONLY, InitVar, dataclass, field
from decimal import Decimal
from enum import Enum, Flag, IntEnum, auto
from typing import (
    Any,
    ClassVar,
    Final,
    Generic,
    Literal,
    NamedTuple,
    NewType,
    Optional,
    Protocol,
    TypedDict,
    TypeVar,
    Union,
)
from uuid import UUID

from typing_extensions import NotRequired, ReadOnly, Required

T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)
K = TypeVar("K", bound=str)

UserId = NewType("UserId", UUID)
"""Opaque user identifier."""


class Color(Enum):
    RED = "red"
    GREEN = "green"
    BLUE = "blue"


class Level(IntEnum):
    LOW = auto()
    MID = auto()
    HIGH = 10
    MAX = auto()


class Perm(Flag):
    READ = auto()
    WRITE = auto()
    ALL = READ | WRITE


class Point(NamedTuple):
    x: float
    y: float
    label: str = ""


class Address(TypedDict):
    line1: str
    line2: NotRequired[str]
    country: str


class Settings(TypedDict, total=False):
    theme: Literal["light", "dark"]
    #: Font size in points.
    font_size: int
    beta: Required[bool]
    version: ReadOnly[int]


@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: Literal["USD", "EUR"] = "USD"


@dataclass
class User:
    """A person with an account."""

    id: UserId
    name: str
    """Display name."""
    email: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    color: Color = Color.RED
    created: dt.datetime = field(default_factory=dt.datetime.now)
    _: KW_ONLY
    address: Address | None = None
    password: InitVar[str | None] = None
    registry: ClassVar[dict[str, User]] = {}


@dataclass
class Page(Generic[T]):
    items: Sequence[T]
    total: int
    next: Page[T] | None = None


class Reader(Protocol[T_co]):
    @property
    def name(self) -> str: ...

    def read(self, size: int = -1, /) -> T_co: ...

    def close(self) -> None: ...


class Plugin:
    """A plain class: attributes are declared in __init__."""

    version: Final = 2

    def __init__(self, name: str, priority: int = 0) -> None:
        self.name = name
        self.priority = priority
        self.enabled: bool = True
        self._cache: dict[str, Any] = {}

    def run(self, payload: Mapping[str, Any]) -> bool:
        return True


Handler = Callable[[str, int], None]
Json = Union[dict[str, "Json"], list["Json"], str, int, float, bool, None]
Pair = tuple[K, T]
Matrix = list[list[float]]
Coordinates = tuple[float, ...]
MAX_USERS = 100
