from sqlalchemy import Column, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text
from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(Text, nullable=False, unique=True)
    display_name = Column(Text, nullable=True)
    hashed_password = Column(Text, nullable=True)  # bcrypt/argon2 hash
    idp_provider = Column(Text, nullable=True)     # bv. 'intra' (placeholder SSO)
    idp_subject = Column(Text, nullable=True)      # extern user-id vanuit IdP
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()"))
