"""Add ServiceLineInternalServiceMapping table

Revision ID: 7687e1211076
Revises: dd10a36a8f78
Create Date: 2025-07-25 11:22:01.889909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '7687e1211076'
down_revision: Union[str, Sequence[str], None] = 'dd10a36a8f78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create internal service mapping table
    op.create_table('servicelineinternalservicemapping',
    sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('internal_service', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop internal service mapping table
    op.drop_table('servicelineinternalservicemapping')
