"""Drop old mapping tables - servicelineinternalservicemapping and servicelinesimlifiedofferingmapping

Revision ID: ec6e4fb75d09
Revises: 2030232af3ea
Create Date: 2025-07-28 14:02:10.088479

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec6e4fb75d09'
down_revision: Union[str, Sequence[str], None] = '2030232af3ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop old mapping tables as they've been consolidated into servicelineofferingmapping
    # Only drop servicelinesimplifiedofferingmapping (servicelineinternalservicemapping doesn't exist)
    op.drop_table('servicelinesimplifiedofferingmapping')


def downgrade() -> None:
    """Downgrade schema."""
    # Recreate the old table (though data won't be preserved)
    op.create_table(
        'servicelinesimplifiedofferingmapping',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('simplified_offering', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
