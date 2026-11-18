"""Track started assignments separately from submitted work."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "assignment_progress"
down_revision = "assessment_competencies"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("assignment_progress",
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assignments.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False))


def downgrade():
    op.drop_table("assignment_progress")
