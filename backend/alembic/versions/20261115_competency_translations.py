"""Store optional English competency content."""
from alembic import op
import sqlalchemy as sa

revision = "competency_translations"
down_revision = "assessment_translations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("competencies", sa.Column("translation_en", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))


def downgrade():
    op.drop_column("competencies", "translation_en")
