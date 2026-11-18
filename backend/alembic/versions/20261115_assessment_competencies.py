"""Allow diagnostic questions to contribute to multiple competencies."""
from alembic import op
import sqlalchemy as sa

revision = "assessment_competencies"
down_revision = "cdd34b57c6f3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("assessment_questions", sa.Column("competency_ids_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))


def downgrade():
    op.drop_column("assessment_questions", "competency_ids_json")
