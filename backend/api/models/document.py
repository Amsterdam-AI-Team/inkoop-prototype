from sqlalchemy import Column, Text, TIMESTAMP, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import text
from .base import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=text("gen_random_uuid()"))
    flow_id = Column(UUID(as_uuid=True),
                     ForeignKey("flows.id", ondelete="CASCADE"),
                     nullable=False)
    title = Column(Text, nullable=False)
    mime_type = Column(Text, nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    tags = Column(ARRAY(Text), nullable=True)
    text_content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False,
                        server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False,
                        server_default=text("NOW()"))
