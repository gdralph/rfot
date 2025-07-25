"""Remove category dependency from ServiceLineOfferingThreshold

Revision ID: dd10a36a8f78
Revises: 8dcdfabe29ff
Create Date: 2025-07-25 11:13:50.620369

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'dd10a36a8f78'
down_revision: Union[str, Sequence[str], None] = '8dcdfabe29ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # For SQLite, we need to recreate the table without the foreign key column
    
    # Create new table without service_line_category_id
    op.create_table('servicelineofferingthreshold_new',
        sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('stage_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('threshold_count', sa.Integer(), nullable=False),
        sa.Column('increment_multiplier', sa.Float(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Copy data from old table (excluding service_line_category_id)
    op.execute("""
        INSERT INTO servicelineofferingthreshold_new (service_line, stage_name, threshold_count, increment_multiplier, id)
        SELECT service_line, stage_name, threshold_count, increment_multiplier, id
        FROM servicelineofferingthreshold
    """)
    
    # Drop old table and rename new one
    op.drop_table('servicelineofferingthreshold')
    op.rename_table('servicelineofferingthreshold_new', 'servicelineofferingthreshold')


def downgrade() -> None:
    """Downgrade schema."""
    # Add back category dependency
    op.add_column('servicelineofferingthreshold', sa.Column('service_line_category_id', sa.INTEGER(), nullable=False))
    op.create_foreign_key(None, 'servicelineofferingthreshold', 'servicelinecategory', ['service_line_category_id'], ['id'])
