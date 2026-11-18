"""Store per-question competency weights."""
from alembic import op
import sqlalchemy as sa

revision = "competency_weights"
down_revision = "assignment_progress"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("assessment_questions", sa.Column("competency_weights_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))


def downgrade():
    op.drop_column("assessment_questions", "competency_weights_json")
