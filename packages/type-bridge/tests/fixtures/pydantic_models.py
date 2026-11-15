"""Pydantic v2 models, as a FastAPI service would declare them."""

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, computed_field
from pydantic.alias_generators import to_camel


class Role(StrEnum):
    ADMIN = "admin"
    MEMBER = "member"


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Profile(ApiModel):
    display_name: str
    avatar_url: Optional[HttpUrl] = None
    birthday: date | None = None


class Account(ApiModel):
    """An account as the API returns it."""

    account_id: int
    email: EmailStr
    role: Role = Role.MEMBER
    profile: Profile
    created_at: datetime
    password_hash: str = Field(exclude=True)
    tags: set[str] = Field(default_factory=set, description="Free-form labels.")
    score: Annotated[float, Field(ge=0, le=1)] = 0.0
    _session: str = ""

    @computed_field
    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    @property
    def internal(self) -> str:
        return "not serialized"


class Cat(BaseModel):
    kind: Literal["cat"]
    lives: int = 9


class Dog(BaseModel):
    kind: Literal["dog"]
    good_boy: bool = Field(True, alias="goodBoy")


class Owner(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str
    pets: list[Annotated[Union[Cat, Dog], Field(discriminator="kind")]]
