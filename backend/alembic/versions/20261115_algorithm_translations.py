"""Store optional English algorithm content."""
from alembic import op
import sqlalchemy as sa

revision = "algorithm_translations"
down_revision = "lesson_translations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("algorithms", sa.Column("translation_en", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))


def downgrade():
    op.drop_column("algorithms", "translation_en")
