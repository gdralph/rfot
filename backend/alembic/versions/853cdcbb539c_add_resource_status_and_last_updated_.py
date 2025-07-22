"""Add resource_status and last_updated fields to opportunity_resource_timeline

Revision ID: 853cdcbb539c
Revises: f87e3dc2e200
Create Date: 2025-07-22 17:07:04.323860

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '853cdcbb539c'
down_revision: Union[str, Sequence[str], None] = 'f87e3dc2e200'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if columns already exist before adding them
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('opportunity_resource_timeline')]
    
    if 'resource_status' not in columns:
        op.add_column('opportunity_resource_timeline', sa.Column('resource_status', sa.VARCHAR(20), nullable=False, server_default='Predicted'))
        op.create_index(op.f('ix_opportunity_resource_timeline_resource_status'), 'opportunity_resource_timeline', ['resource_status'], unique=False)
    
    if 'last_updated' not in columns:
        op.add_column('opportunity_resource_timeline', sa.Column('last_updated', sa.DateTime(), nullable=False, server_default='2025-01-01 00:00:00'))
        op.create_index(op.f('ix_opportunity_resource_timeline_last_updated'), 'opportunity_resource_timeline', ['last_updated'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Remove resource_status and last_updated columns from opportunity_resource_timeline
    op.drop_index(op.f('ix_opportunity_resource_timeline_resource_status'), table_name='opportunity_resource_timeline')
    op.drop_index(op.f('ix_opportunity_resource_timeline_last_updated'), table_name='opportunity_resource_timeline')
    op.drop_column('opportunity_resource_timeline', 'last_updated')
    op.drop_column('opportunity_resource_timeline', 'resource_status')
