"""drop_smeallocationrule_table

Revision ID: 22643048be70
Revises: 589bd4f5d583
Create Date: 2025-07-21 20:34:53.610261

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision: str = '22643048be70'
down_revision: Union[str, Sequence[str], None] = '589bd4f5d583'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_table('smeallocationrule')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table('smeallocationrule',
    sa.Column('team_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('effort_per_million', sa.Float(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
