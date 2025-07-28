"""Add ServiceLineSimplifiedOfferingMapping table

Revision ID: ee9c0152a798
Revises: 00000000
Create Date: 2025-07-28 13:34:08.665531

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'ee9c0152a798'
down_revision: Union[str, Sequence[str], None] = '00000000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the simplified offering mapping table
    op.create_table('servicelinesimplifiedofferingmapping',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('simplified_offering', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the simplified offering mapping table
    op.drop_table('servicelinesimplifiedofferingmapping')
