"""Add consolidated ServiceLineOfferingMapping table

Revision ID: 2030232af3ea
Revises: ee9c0152a798
Create Date: 2025-07-28 13:51:51.245652

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '2030232af3ea'
down_revision: Union[str, Sequence[str], None] = 'ee9c0152a798'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the consolidated offering mapping table
    op.create_table('servicelineofferingmapping',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('internal_service', sa.String(), nullable=False),
        sa.Column('simplified_offering', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the consolidated offering mapping table
    op.drop_table('servicelineofferingmapping')
