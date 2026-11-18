"""Store optional English task and option content."""
from alembic import op
import sqlalchemy as sa

revision = "task_translations"
down_revision = "project_translations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("translation_en", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))
    op.add_column("task_options", sa.Column("label_en", sa.Text(), nullable=False, server_default=""))


def downgrade():
    op.drop_column("task_options", "label_en")
    op.drop_column("tasks", "translation_en")
