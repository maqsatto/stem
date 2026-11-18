"""Store optional English project content."""
from alembic import op
import sqlalchemy as sa

revision = "project_translations"
down_revision = "algorithm_translations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("projects", sa.Column("translation_en", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))


def downgrade():
    op.drop_column("projects", "translation_en")
