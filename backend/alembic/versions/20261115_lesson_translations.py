"""Store optional English lesson content without replacing the original."""
from alembic import op
import sqlalchemy as sa

revision = "lesson_translations"
down_revision = "competency_weights"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("lessons", sa.Column("translation_en", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))


def downgrade():
    op.drop_column("lessons", "translation_en")
