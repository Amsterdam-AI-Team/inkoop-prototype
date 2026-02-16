from sqlalchemy import Column, Text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text
from .base import Base


class Flow(Base):
    __tablename__ = "flows"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    collection_id = Column(UUID(as_uuid=True),
                           ForeignKey("collections.id", ondelete="CASCADE"),
                           nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    template_name = Column(Text, nullable=False)
    template_content = Column(Text, nullable=False)
    context_content = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False,
                        server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False,
                        server_default=text("NOW()"))
