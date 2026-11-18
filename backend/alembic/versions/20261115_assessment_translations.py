"""Store optional English assessment content."""
from alembic import op
import sqlalchemy as sa

revision = "assessment_translations"
down_revision = "task_translations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("assessments", sa.Column("translation_en", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))
    op.add_column("assessment_questions", sa.Column("body_en", sa.Text(), nullable=False, server_default=""))


def downgrade():
    op.drop_column("assessment_questions", "body_en")
    op.drop_column("assessments", "translation_en")
