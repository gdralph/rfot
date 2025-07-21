"""drop_stageeffortestimate_table

Revision ID: 64b70a121ef6
Revises: 22643048be70
Create Date: 2025-07-21 20:38:17.565389

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision: str = '64b70a121ef6'
down_revision: Union[str, Sequence[str], None] = '22643048be70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_table('stageeffortestimate')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table('stageeffortestimate',
    sa.Column('category_id', sa.Integer(), nullable=False),
    sa.Column('stage_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('default_effort_weeks', sa.Float(), nullable=False),
    sa.Column('default_duration_weeks', sa.Integer(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['opportunitycategory.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
